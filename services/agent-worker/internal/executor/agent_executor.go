package executor

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-worker/internal/aihub"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-worker/internal/model"
	"github.com/Andrew-Bu1/Agent-Platform/services/agent-worker/internal/repository"
	"github.com/google/uuid"
)

const defaultMaxIterations = 10
const maxAllowedIterations = 100 // hard ceiling regardless of node/agent config

// EventPublisher publishes SSE-envelope events for a run in real-time.
// Both token deltas and structural events (AgentStarted, ToolCallCompleted, etc.)
// are sent through this interface so the client sees them as they happen.
type EventPublisher interface {
	PublishEvent(ctx context.Context, runID uuid.UUID, payload json.RawMessage) error
}

// AgentExecutor runs a single agent node using a ReAct loop.
type AgentExecutor struct {
	agentRepo   *repository.AgentRepository
	toolRepo    *repository.ToolRepository
	messageRepo *repository.MessageRepository
	nodeRunRepo *repository.NodeRunRepository
	toolExec    *ToolExecutor
	aihub       *aihub.Client
	eventPub    EventPublisher // nil disables real-time publishing (tests)
}

func NewAgentExecutor(
	agentRepo *repository.AgentRepository,
	toolRepo *repository.ToolRepository,
	messageRepo *repository.MessageRepository,
	nodeRunRepo *repository.NodeRunRepository,
	aihubClient *aihub.Client,
	eventPub EventPublisher,
) *AgentExecutor {
	return &AgentExecutor{
		agentRepo:   agentRepo,
		toolRepo:    toolRepo,
		messageRepo: messageRepo,
		nodeRunRepo: nodeRunRepo,
		toolExec:    NewToolExecutor(),
		aihub:       aihubClient,
		eventPub:    eventPub,
	}
}

// Execute runs the ReAct loop for an agent node (or the supervisor-handoff loop
// for an agent_team node).
// Returns (outputJSON, []WorkerEvent, error).
func (e *AgentExecutor) Execute(ctx context.Context, job model.NodeJob) (json.RawMessage, []model.WorkerEvent, error) {
	var nodeCfg model.NodeAgentConfig
	if len(job.NodeConfig) > 0 {
		if err := json.Unmarshal(job.NodeConfig, &nodeCfg); err != nil {
			return nil, nil, fmt.Errorf("parse node config: %w", err)
		}
	}
	if nodeCfg.AgentID == uuid.Nil {
		return nil, nil, fmt.Errorf("node config missing agentId")
	}

	if job.NodeType == "agent_team" {
		return e.executeTeam(ctx, job, nodeCfg)
	}

	agent, err := e.agentRepo.GetByID(ctx, nodeCfg.AgentID, job.TenantID, job.WorkspaceID)
	if err != nil {
		return nil, nil, fmt.Errorf("load agent: %w", err)
	}

	var agentCfg model.AgentConfig
	if len(agent.Config) > 0 {
		_ = json.Unmarshal(agent.Config, &agentCfg)
	}

	maxIter := defaultMaxIterations
	if nodeCfg.MaxIterations > 0 {
		maxIter = nodeCfg.MaxIterations
	} else if agentCfg.MaxIterations > 0 {
		maxIter = agentCfg.MaxIterations
	}
	if maxIter > maxAllowedIterations {
		maxIter = maxAllowedIterations
	}

	mem := resolveMemoryConfig(nodeCfg.Memory, agentCfg.Memory)

	var aihubTools []aihub.Tool
	toolMap := map[string]*model.Tool{}
	if len(agent.ToolIDs) > 0 {
		tools, err := e.toolRepo.GetByIDs(ctx, agent.ToolIDs, job.TenantID, job.WorkspaceID)
		if err != nil {
			return nil, nil, fmt.Errorf("load tools: %w", err)
		}
		for _, t := range tools {
			toolMap[t.Name] = t
			aihubTools = append(aihubTools, aihub.Tool{
				Type: "function",
				Function: aihub.FunctionDef{
					Name:        t.Name,
					Description: t.Description,
					Parameters:  t.SchemaJSON,
				},
			})
		}
	}

	messages, err := e.buildMessages(ctx, job, agent, mem)
	if err != nil {
		return nil, nil, fmt.Errorf("build messages: %w", err)
	}

	var events []model.WorkerEvent

	agentStartedPayload := json.RawMessage(`{"agent_id":"` + agent.ID.String() + `"}`)
	events = append(events, model.WorkerEvent{EventType: "AgentStarted", PayloadJSON: agentStartedPayload})
	e.publishEvent(ctx, job, "AgentStarted", agentStartedPayload)

	_ = e.nodeRunRepo.SetStarted(ctx, job.NodeRunID, time.Now())

	for iter := 0; iter < maxIter; iter++ {
		stepStartedPayload := json.RawMessage(fmt.Sprintf(`{"iteration":%d}`, iter+1))
		events = append(events, model.WorkerEvent{EventType: "AgentStepStarted", PayloadJSON: stepStartedPayload})
		e.publishEvent(ctx, job, "AgentStepStarted", stepStartedPayload)

		chatReq := aihub.ChatRequest{
			Model:    agent.ModelID,
			Messages: messages,
			Tools:    aihubTools,
		}
		if len(aihubTools) > 0 {
			chatReq.ToolChoice = "auto"
		}

		deltaCh, err := e.aihub.ChatStream(ctx, chatReq)
		if err != nil {
			return nil, events, fmt.Errorf("aihub chat stream: %w", err)
		}

		var contentBuf strings.Builder
		var finalToolCalls []aihub.ToolCall
		var finishReason string

		for delta := range deltaCh {
			if delta.Err != nil {
				return nil, events, fmt.Errorf("aihub stream: %w", delta.Err)
			}
			if delta.Done {
				finalToolCalls = delta.ToolCalls
				finishReason = delta.FinishReason
				break
			}
			if delta.Content != "" {
				contentBuf.WriteString(delta.Content)
				e.publishToken(ctx, job, delta.Content)
			}
		}

		assistantMsg := aihub.Message{
			Role:      "assistant",
			Content:   contentBuf.String(),
			ToolCalls: finalToolCalls,
		}
		messages = append(messages, assistantMsg)

		stepDonePayload := json.RawMessage(fmt.Sprintf(`{"iteration":%d,"finish_reason":%q}`, iter+1, finishReason))
		events = append(events, model.WorkerEvent{EventType: "AgentStepCompleted", PayloadJSON: stepDonePayload})
		e.publishEvent(ctx, job, "AgentStepCompleted", stepDonePayload)

		if len(assistantMsg.ToolCalls) == 0 {
			output := e.extractOutput(assistantMsg)
			completedPayload := json.RawMessage(`{}`)
			events = append(events, model.WorkerEvent{EventType: "AgentCompleted", PayloadJSON: completedPayload})
			e.publishEvent(ctx, job, "AgentCompleted", completedPayload)
			return output, events, nil
		}

		for _, tc := range assistantMsg.ToolCalls {
			startPayload := json.RawMessage(fmt.Sprintf(`{"tool_call_id":%q,"tool":%q}`,
				tc.ID, tc.Function.Name))
			events = append(events, model.WorkerEvent{EventType: "ToolCallStarted", PayloadJSON: startPayload})
			e.publishEvent(ctx, job, "ToolCallStarted", startPayload)

			toolResult, toolErr := e.runToolCall(ctx, tc, toolMap)

			toolPayload := json.RawMessage(fmt.Sprintf(`{"tool_call_id":%q,"tool":%q,"error":%v}`,
				tc.ID, tc.Function.Name, toolErr != nil))
			events = append(events, model.WorkerEvent{EventType: "ToolCallCompleted", PayloadJSON: toolPayload})
			e.publishEvent(ctx, job, "ToolCallCompleted", toolPayload)

			var contentStr string
			if toolErr != nil {
				contentStr = fmt.Sprintf(`{"error":%q}`, toolErr.Error())
			} else {
				contentStr = string(toolResult)
			}

			messages = append(messages, aihub.Message{
				Role:       "tool",
				Content:    contentStr,
				ToolCallID: tc.ID,
				Name:       tc.Function.Name,
			})
		}
	}

	return nil, events, fmt.Errorf("agent exceeded max iterations (%d)", maxIter)
}

// executeTeam runs the supervisor-handoff loop for an agent_team node.
//
// The supervisor agent is given a synthetic `delegate_to_agent` tool that lists
// all member agents. When the supervisor calls that tool the worker runs the
// named member's full ReAct loop and returns its output as the tool result.
// The supervisor then decides whether to delegate again or produce a final reply.
//
// Final output:
//   - If ExitAgentID is set and that agent was the last to run, its output is returned.
//   - Otherwise the supervisor's last text reply is returned.
func (e *AgentExecutor) executeTeam(ctx context.Context, job model.NodeJob, nodeCfg model.NodeAgentConfig) (json.RawMessage, []model.WorkerEvent, error) {
	supervisor, err := e.agentRepo.GetByID(ctx, nodeCfg.AgentID, job.TenantID, job.WorkspaceID)
	if err != nil {
		return nil, nil, fmt.Errorf("load supervisor agent: %w", err)
	}

	// Load member agents (name → agent for delegation lookup).
	membersByName := map[string]*model.Agent{}
	membersByID := map[uuid.UUID]*model.Agent{}
	if len(nodeCfg.MemberAgentIDs) > 0 {
		members, err := e.agentRepo.GetByIDs(ctx, nodeCfg.MemberAgentIDs, job.TenantID, job.WorkspaceID)
		if err != nil {
			return nil, nil, fmt.Errorf("load member agents: %w", err)
		}
		for id, a := range members {
			membersByName[a.Name] = a
			membersByID[id] = a
		}
	}

	// Build enum of valid agent names for the delegate tool schema.
	memberNames := make([]string, 0, len(membersByName))
	for name := range membersByName {
		memberNames = append(memberNames, name)
	}
	memberEnum, _ := json.Marshal(memberNames)
	delegateSchema := json.RawMessage(`{"type":"object","required":["agent_name","input"],"properties":{"agent_name":{"type":"string","enum":` + string(memberEnum) + `,"description":"Name of the member agent to delegate to"},"input":{"type":"string","description":"Task or question to pass to the member agent"}}}`)

	delegateTool := aihub.Tool{
		Type: "function",
		Function: aihub.FunctionDef{
			Name:        "delegate_to_agent",
			Description: "Hand off a sub-task to a specialised member agent and receive its output.",
			Parameters:  delegateSchema,
		},
	}

	// Load supervisor's own tools plus the delegation tool.
	toolMap := map[string]*model.Tool{}
	var aihubTools []aihub.Tool
	if len(supervisor.ToolIDs) > 0 {
		tools, err := e.toolRepo.GetByIDs(ctx, supervisor.ToolIDs, job.TenantID, job.WorkspaceID)
		if err != nil {
			return nil, nil, fmt.Errorf("load supervisor tools: %w", err)
		}
		for _, t := range tools {
			toolMap[t.Name] = t
			aihubTools = append(aihubTools, aihub.Tool{
				Type: "function",
				Function: aihub.FunctionDef{
					Name:        t.Name,
					Description: t.Description,
					Parameters:  t.SchemaJSON,
				},
			})
		}
	}
	if len(membersByName) > 0 {
		aihubTools = append(aihubTools, delegateTool)
	}

	var supervisorCfg model.AgentConfig
	if len(supervisor.Config) > 0 {
		_ = json.Unmarshal(supervisor.Config, &supervisorCfg)
	}
	supMem := resolveMemoryConfig(nodeCfg.Memory, supervisorCfg.Memory)

	messages, err := e.buildMessages(ctx, job, supervisor, supMem)
	if err != nil {
		return nil, nil, fmt.Errorf("build supervisor messages: %w", err)
	}

	var events []model.WorkerEvent

	supervisorStarted := json.RawMessage(`{"agent_id":"` + supervisor.ID.String() + `","role":"supervisor"}`)
	events = append(events, model.WorkerEvent{EventType: "AgentStarted", PayloadJSON: supervisorStarted})
	e.publishEvent(ctx, job, "AgentStarted", supervisorStarted)
	_ = e.nodeRunRepo.SetStarted(ctx, job.NodeRunID, time.Now())

	maxIter := defaultMaxIterations
	if nodeCfg.MaxIterations > 0 {
		maxIter = nodeCfg.MaxIterations
	} else if supervisorCfg.MaxIterations > 0 {
		maxIter = supervisorCfg.MaxIterations
	}
	if maxIter > maxAllowedIterations {
		maxIter = maxAllowedIterations
	}

	var lastMemberOutput json.RawMessage
	var lastMemberID uuid.UUID

	for iter := 0; iter < maxIter; iter++ {
		stepStarted := json.RawMessage(fmt.Sprintf(`{"iteration":%d}`, iter+1))
		events = append(events, model.WorkerEvent{EventType: "AgentStepStarted", PayloadJSON: stepStarted})
		e.publishEvent(ctx, job, "AgentStepStarted", stepStarted)

		chatReq := aihub.ChatRequest{
			Model:      supervisor.ModelID,
			Messages:   messages,
			Tools:      aihubTools,
			ToolChoice: "auto",
		}

		deltaCh, err := e.aihub.ChatStream(ctx, chatReq)
		if err != nil {
			return nil, events, fmt.Errorf("supervisor chat stream: %w", err)
		}

		var contentBuf strings.Builder
		var finalToolCalls []aihub.ToolCall
		var finishReason string

		for delta := range deltaCh {
			if delta.Err != nil {
				return nil, events, fmt.Errorf("supervisor stream: %w", delta.Err)
			}
			if delta.Done {
				finalToolCalls = delta.ToolCalls
				finishReason = delta.FinishReason
				break
			}
			if delta.Content != "" {
				contentBuf.WriteString(delta.Content)
				e.publishToken(ctx, job, delta.Content)
			}
		}

		assistantMsg := aihub.Message{
			Role:      "assistant",
			Content:   contentBuf.String(),
			ToolCalls: finalToolCalls,
		}
		messages = append(messages, assistantMsg)

		stepDone := json.RawMessage(fmt.Sprintf(`{"iteration":%d,"finish_reason":%q}`, iter+1, finishReason))
		events = append(events, model.WorkerEvent{EventType: "AgentStepCompleted", PayloadJSON: stepDone})
		e.publishEvent(ctx, job, "AgentStepCompleted", stepDone)

		if len(finalToolCalls) == 0 {
			// Supervisor produced a final reply — done.
			events = append(events, model.WorkerEvent{EventType: "AgentCompleted", PayloadJSON: json.RawMessage(`{}`)})
			e.publishEvent(ctx, job, "AgentCompleted", json.RawMessage(`{}`))

			// Return exit agent's output if it was the last to run, otherwise supervisor reply.
			if nodeCfg.ExitAgentID != uuid.Nil && lastMemberID == nodeCfg.ExitAgentID && lastMemberOutput != nil {
				return lastMemberOutput, events, nil
			}
			return e.extractOutput(assistantMsg), events, nil
		}

		// Process tool calls — handle delegate_to_agent specially.
		for _, tc := range finalToolCalls {
			startPayload := json.RawMessage(fmt.Sprintf(`{"tool_call_id":%q,"tool":%q}`, tc.ID, tc.Function.Name))
			events = append(events, model.WorkerEvent{EventType: "ToolCallStarted", PayloadJSON: startPayload})
			e.publishEvent(ctx, job, "ToolCallStarted", startPayload)

			var toolResultContent string
			var toolErr error

			if tc.Function.Name == "delegate_to_agent" {
				var args struct {
					AgentName string `json:"agent_name"`
					Input     string `json:"input"`
				}
				if err := json.Unmarshal([]byte(tc.Function.Arguments), &args); err != nil {
					toolErr = fmt.Errorf("invalid delegate args: %w", err)
				} else {
					member, ok := membersByName[args.AgentName]
					if !ok {
						toolErr = fmt.Errorf("unknown member agent %q", args.AgentName)
					} else {
						memberInput, _ := json.Marshal(map[string]string{"input": args.Input})
						memberJob := job
						memberJob.InputJSON = memberInput

						delegateStarted := json.RawMessage(fmt.Sprintf(`{"agent_id":%q,"agent_name":%q,"role":"member"}`, member.ID, member.Name))
						events = append(events, model.WorkerEvent{EventType: "AgentStarted", PayloadJSON: delegateStarted})
						e.publishEvent(ctx, job, "AgentStarted", delegateStarted)

						memberOut, memberEvts, memberErr := e.runMemberAgent(ctx, memberJob, member)
						events = append(events, memberEvts...)
						if memberErr != nil {
							toolErr = fmt.Errorf("member agent %q: %w", args.AgentName, memberErr)
						} else {
							lastMemberOutput = memberOut
							lastMemberID = member.ID
							toolResultContent = string(memberOut)
						}
					}
				}
			} else {
				var rawResult json.RawMessage
				rawResult, toolErr = e.runToolCall(ctx, tc, toolMap)
				if toolErr == nil {
					toolResultContent = string(rawResult)
				}
			}

			if toolErr != nil {
				toolResultContent = fmt.Sprintf(`{"error":%q}`, toolErr.Error())
			}

			donePayload := json.RawMessage(fmt.Sprintf(`{"tool_call_id":%q,"tool":%q,"error":%v}`, tc.ID, tc.Function.Name, toolErr != nil))
			events = append(events, model.WorkerEvent{EventType: "ToolCallCompleted", PayloadJSON: donePayload})
			e.publishEvent(ctx, job, "ToolCallCompleted", donePayload)

			messages = append(messages, aihub.Message{
				Role:       "tool",
				Content:    toolResultContent,
				ToolCallID: tc.ID,
				Name:       tc.Function.Name,
			})
		}
	}

	return nil, events, fmt.Errorf("agent_team exceeded max iterations (%d)", maxIter)
}

// runMemberAgent runs a single member agent's ReAct loop and returns its output.
// It reuses the existing per-agent logic but does not re-publish AgentStarted
// (the caller already did that before invoking).
func (e *AgentExecutor) runMemberAgent(ctx context.Context, job model.NodeJob, agent *model.Agent) (json.RawMessage, []model.WorkerEvent, error) {
	var aihubTools []aihub.Tool
	toolMap := map[string]*model.Tool{}
	if len(agent.ToolIDs) > 0 {
		tools, err := e.toolRepo.GetByIDs(ctx, agent.ToolIDs, job.TenantID, job.WorkspaceID)
		if err != nil {
			return nil, nil, fmt.Errorf("load member tools: %w", err)
		}
		for _, t := range tools {
			toolMap[t.Name] = t
			aihubTools = append(aihubTools, aihub.Tool{
				Type: "function",
				Function: aihub.FunctionDef{
					Name:        t.Name,
					Description: t.Description,
					Parameters:  t.SchemaJSON,
				},
			})
		}
	}

	var memberAgentCfg model.AgentConfig
	if len(agent.Config) > 0 {
		_ = json.Unmarshal(agent.Config, &memberAgentCfg)
	}
	memberMem := resolveMemoryConfig(model.MemoryConfig{}, memberAgentCfg.Memory)

	messages, err := e.buildMessages(ctx, job, agent, memberMem)
	if err != nil {
		return nil, nil, fmt.Errorf("build member messages: %w", err)
	}

	var events []model.WorkerEvent
	maxIter := defaultMaxIterations
	if memberAgentCfg.MaxIterations > 0 {
		maxIter = memberAgentCfg.MaxIterations
	}
	if maxIter > maxAllowedIterations {
		maxIter = maxAllowedIterations
	}

	for iter := 0; iter < maxIter; iter++ {
		stepStarted := json.RawMessage(fmt.Sprintf(`{"iteration":%d}`, iter+1))
		events = append(events, model.WorkerEvent{EventType: "AgentStepStarted", PayloadJSON: stepStarted})
		e.publishEvent(ctx, job, "AgentStepStarted", stepStarted)

		chatReq := aihub.ChatRequest{
			Model:    agent.ModelID,
			Messages: messages,
			Tools:    aihubTools,
		}
		if len(aihubTools) > 0 {
			chatReq.ToolChoice = "auto"
		}

		deltaCh, err := e.aihub.ChatStream(ctx, chatReq)
		if err != nil {
			return nil, events, fmt.Errorf("member chat stream: %w", err)
		}

		var contentBuf strings.Builder
		var finalToolCalls []aihub.ToolCall
		var finishReason string

		for delta := range deltaCh {
			if delta.Err != nil {
				return nil, events, fmt.Errorf("member stream: %w", delta.Err)
			}
			if delta.Done {
				finalToolCalls = delta.ToolCalls
				finishReason = delta.FinishReason
				break
			}
			if delta.Content != "" {
				contentBuf.WriteString(delta.Content)
				e.publishToken(ctx, job, delta.Content)
			}
		}

		assistantMsg := aihub.Message{
			Role:      "assistant",
			Content:   contentBuf.String(),
			ToolCalls: finalToolCalls,
		}
		messages = append(messages, assistantMsg)

		stepDone := json.RawMessage(fmt.Sprintf(`{"iteration":%d,"finish_reason":%q}`, iter+1, finishReason))
		events = append(events, model.WorkerEvent{EventType: "AgentStepCompleted", PayloadJSON: stepDone})
		e.publishEvent(ctx, job, "AgentStepCompleted", stepDone)

		if len(finalToolCalls) == 0 {
			events = append(events, model.WorkerEvent{EventType: "AgentCompleted", PayloadJSON: json.RawMessage(`{}`)})
			e.publishEvent(ctx, job, "AgentCompleted", json.RawMessage(`{}`))
			return e.extractOutput(assistantMsg), events, nil
		}

		for _, tc := range finalToolCalls {
			startPayload := json.RawMessage(fmt.Sprintf(`{"tool_call_id":%q,"tool":%q}`, tc.ID, tc.Function.Name))
			events = append(events, model.WorkerEvent{EventType: "ToolCallStarted", PayloadJSON: startPayload})
			e.publishEvent(ctx, job, "ToolCallStarted", startPayload)

			toolResult, toolErr := e.runToolCall(ctx, tc, toolMap)

			donePayload := json.RawMessage(fmt.Sprintf(`{"tool_call_id":%q,"tool":%q,"error":%v}`, tc.ID, tc.Function.Name, toolErr != nil))
			events = append(events, model.WorkerEvent{EventType: "ToolCallCompleted", PayloadJSON: donePayload})
			e.publishEvent(ctx, job, "ToolCallCompleted", donePayload)

			var contentStr string
			if toolErr != nil {
				contentStr = fmt.Sprintf(`{"error":%q}`, toolErr.Error())
			} else {
				contentStr = string(toolResult)
			}
			messages = append(messages, aihub.Message{
				Role:       "tool",
				Content:    contentStr,
				ToolCallID: tc.ID,
				Name:       tc.Function.Name,
			})
		}
	}

	return nil, events, fmt.Errorf("member agent exceeded max iterations (%d)", maxIter)
}

// publishEvent wraps payload in an SSEEvent envelope and publishes it in real-time.
func (e *AgentExecutor) publishEvent(ctx context.Context, job model.NodeJob, eventType string, payload json.RawMessage) {
	if e.eventPub == nil {
		return
	}
	ev, err := json.Marshal(struct {
		Type string          `json:"type"`
		Data json.RawMessage `json:"data"`
	}{eventType, payload})
	if err != nil {
		return
	}
	_ = e.eventPub.PublishEvent(ctx, job.RunID, ev)
}

// publishToken publishes a single streaming token delta in real-time.
func (e *AgentExecutor) publishToken(ctx context.Context, job model.NodeJob, content string) {
	inner, err := json.Marshal(map[string]string{
		"content":     content,
		"node_id":     job.NodeID,
		"node_run_id": job.NodeRunID.String(),
	})
	if err != nil {
		return
	}
	e.publishEvent(ctx, job, "token", inner)
}

func (e *AgentExecutor) buildMessages(ctx context.Context, job model.NodeJob, agent *model.Agent, mem model.MemoryConfig) ([]aihub.Message, error) {
	var messages []aihub.Message

	if agent.SystemPrompt != "" {
		messages = append(messages, aihub.Message{
			Role:    "system",
			Content: agent.SystemPrompt,
		})
	}

	if job.ThreadID != nil {
		switch mem.Strategy {
		case "none":
			// stateless — skip history entirely

		case "summarize":
			if err := e.appendSummarizeHistory(ctx, job, agent, mem, &messages); err != nil {
				return nil, err
			}

		default: // "last_n" and anything unrecognised
			n := mem.LastN
			if n <= 0 {
				n = 20
			}
			history, err := e.messageRepo.GetLastNByThreadID(ctx, *job.ThreadID, job.TenantID, job.WorkspaceID, n)
			if err != nil {
				return nil, fmt.Errorf("load thread history: %w", err)
			}
			for _, m := range history {
				messages = append(messages, messageToAihub(m))
			}
		}
	}

	var inputContent string
	if len(job.InputJSON) > 0 && string(job.InputJSON) != `{}` {
		inputContent = string(job.InputJSON)
	}
	if inputContent != "" {
		messages = append(messages, aihub.Message{
			Role:    "user",
			Content: inputContent,
		})
	}

	return messages, nil
}

// appendSummarizeHistory implements the rolling-summary strategy:
//  1. Find the latest 'summary' message in the thread.
//  2. Load all messages after it (the unsummarized tail).
//  3. If tail > threshold, call the summarizer and insert a new 'summary' message.
//  4. Append [system: summary text] + tail to messages.
func (e *AgentExecutor) appendSummarizeHistory(ctx context.Context, job model.NodeJob, agent *model.Agent, mem model.MemoryConfig, messages *[]aihub.Message) error {
	threshold := mem.SummarizeThreshold
	if threshold <= 0 {
		threshold = 40
	}

	summary, err := e.messageRepo.GetLatestSummaryByThreadID(ctx, *job.ThreadID, job.TenantID, job.WorkspaceID)
	if err != nil {
		return fmt.Errorf("load summary message: %w", err)
	}

	var tail []*model.Message
	if summary != nil {
		tail, err = e.messageRepo.GetAfterCreatedAt(ctx, *job.ThreadID, job.TenantID, job.WorkspaceID, summary.CreatedAt)
	} else {
		tail, err = e.messageRepo.GetByThreadID(ctx, *job.ThreadID, job.TenantID, job.WorkspaceID, 0)
	}
	if err != nil {
		return fmt.Errorf("load tail messages: %w", err)
	}

	if len(tail) > threshold {
		newSummary, err := e.callSummarizer(ctx, job, agent, mem, summary, tail)
		if err != nil {
			return fmt.Errorf("summarize history: %w", err)
		}
		summary = newSummary
		tail = nil // everything is now in the summary
	}

	if summary != nil {
		var summaryText string
		_ = json.Unmarshal(summary.ContentJSON, &summaryText)
		if summaryText == "" {
			summaryText = string(summary.ContentJSON)
		}
		*messages = append(*messages, aihub.Message{
			Role:    "system",
			Content: "Summary of the conversation so far:\n" + summaryText,
		})
	}

	for _, m := range tail {
		*messages = append(*messages, messageToAihub(m))
	}
	return nil
}

// callSummarizer sends a summarize prompt to the LLM and stores the result as
// a 'summary' role message in the thread, returning the inserted message.
func (e *AgentExecutor) callSummarizer(ctx context.Context, job model.NodeJob, agent *model.Agent, mem model.MemoryConfig, existing *model.Message, tail []*model.Message) (*model.Message, error) {
	var promptBuf strings.Builder
	if existing != nil {
		var prev string
		_ = json.Unmarshal(existing.ContentJSON, &prev)
		if prev == "" {
			prev = string(existing.ContentJSON)
		}
		promptBuf.WriteString("You have an existing conversation summary and new messages since that summary.\n")
		promptBuf.WriteString("Produce an updated summary that preserves all key facts, decisions, and context.\n\n")
		promptBuf.WriteString("Existing summary:\n")
		promptBuf.WriteString(prev)
		promptBuf.WriteString("\n\nNew messages since the summary:\n")
	} else {
		promptBuf.WriteString("Summarize the following conversation history concisely, preserving all key decisions, facts, and context:\n\n")
	}

	for _, m := range tail {
		var content string
		if err := json.Unmarshal(m.ContentJSON, &content); err != nil {
			content = string(m.ContentJSON)
		}
		promptBuf.WriteString(m.Role)
		promptBuf.WriteString(": ")
		promptBuf.WriteString(content)
		promptBuf.WriteString("\n")
	}

	summarizerModel := mem.SummarizeModel
	if summarizerModel == "" {
		summarizerModel = agent.ModelID
	}

	resp, err := e.aihub.Chat(ctx, aihub.ChatRequest{
		Model: summarizerModel,
		Messages: []aihub.Message{
			{Role: "user", Content: promptBuf.String()},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("summarizer chat: %w", err)
	}
	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("summarizer returned no choices")
	}

	summaryText := ""
	switch v := resp.Choices[0].Message.Content.(type) {
	case string:
		summaryText = v
	default:
		b, _ := json.Marshal(v)
		summaryText = string(b)
	}

	contentJSON, _ := json.Marshal(summaryText)
	msg := &model.Message{
		ID:          uuid.New(),
		TenantID:    job.TenantID,
		WorkspaceID: job.WorkspaceID,
		ThreadID:    *job.ThreadID,
		Role:        "summary",
		ContentJSON: contentJSON,
		MetadataJSON: json.RawMessage(`{}`),
		CreatedAt:   time.Now(),
	}
	if err := e.messageRepo.Insert(ctx, msg); err != nil {
		return nil, fmt.Errorf("insert summary message: %w", err)
	}
	return msg, nil
}

// messageToAihub converts a stored Message to an aihub.Message.
func messageToAihub(m *model.Message) aihub.Message {
	var content interface{}
	if err := json.Unmarshal(m.ContentJSON, &content); err != nil {
		content = string(m.ContentJSON)
	}
	return aihub.Message{Role: m.Role, Content: content}
}

// resolveMemoryConfig picks the first non-empty strategy from node config, then
// agent config, then falls back to last_n with a window of 20.
func resolveMemoryConfig(nodeMem, agentMem model.MemoryConfig) model.MemoryConfig {
	if nodeMem.Strategy != "" {
		return nodeMem
	}
	if agentMem.Strategy != "" {
		return agentMem
	}
	return model.MemoryConfig{Strategy: "last_n", LastN: 20}
}

func (e *AgentExecutor) runToolCall(ctx context.Context, tc aihub.ToolCall, toolMap map[string]*model.Tool) (json.RawMessage, error) {
	tool, ok := toolMap[tc.Function.Name]
	if !ok {
		return nil, fmt.Errorf("tool %q not found", tc.Function.Name)
	}
	return e.toolExec.Execute(ctx, tool, tc.Function.Arguments)
}

func (e *AgentExecutor) extractOutput(msg aihub.Message) json.RawMessage {
	var content string
	switch v := msg.Content.(type) {
	case string:
		content = v
	default:
		data, _ := json.Marshal(v)
		content = string(data)
	}
	if json.Valid([]byte(content)) {
		return json.RawMessage(content)
	}
	wrapped, _ := json.Marshal(map[string]string{"output": content})
	return json.RawMessage(wrapped)
}
