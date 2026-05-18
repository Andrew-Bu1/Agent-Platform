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

// Execute runs the ReAct loop for an agent node.
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

	agent, err := e.agentRepo.GetByID(ctx, nodeCfg.AgentID, job.TenantID, job.WorkspaceID)
	if err != nil {
		return nil, nil, fmt.Errorf("load agent: %w", err)
	}

	maxIter := defaultMaxIterations
	if nodeCfg.MaxIterations > 0 {
		maxIter = nodeCfg.MaxIterations
	} else {
		var agentCfg model.AgentConfig
		if len(agent.Config) > 0 {
			_ = json.Unmarshal(agent.Config, &agentCfg)
		}
		if agentCfg.MaxIterations > 0 {
			maxIter = agentCfg.MaxIterations
		}
	}

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

	messages, err := e.buildMessages(ctx, job, agent)
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

func (e *AgentExecutor) buildMessages(ctx context.Context, job model.NodeJob, agent *model.Agent) ([]aihub.Message, error) {
	var messages []aihub.Message

	if agent.SystemPrompt != "" {
		messages = append(messages, aihub.Message{
			Role:    "system",
			Content: agent.SystemPrompt,
		})
	}

	if job.ThreadID != nil {
		history, err := e.messageRepo.GetByThreadID(ctx, *job.ThreadID, job.TenantID, job.WorkspaceID, 100)
		if err != nil {
			return nil, fmt.Errorf("load thread history: %w", err)
		}
		for _, m := range history {
			var content interface{}
			if err := json.Unmarshal(m.ContentJSON, &content); err != nil {
				content = string(m.ContentJSON)
			}
			messages = append(messages, aihub.Message{
				Role:    m.Role,
				Content: content,
			})
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
