package aihub

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// Client talks to the AIHub service (OpenAI-compatible HTTP API).
type Client struct {
	baseURL      string
	httpClient   *http.Client
	streamClient *http.Client // no timeout; relies on context cancellation
}

func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
		streamClient: &http.Client{},
	}
}

// ---- Chat completions -------------------------------------------------------

type Message struct {
	Role       string      `json:"role"`
	Content    interface{} `json:"content"` // string or []ContentPart
	ToolCalls  []ToolCall  `json:"tool_calls,omitempty"`
	ToolCallID string      `json:"tool_call_id,omitempty"`
	Name       string      `json:"name,omitempty"`
}

type ContentPart struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

type ToolCall struct {
	ID       string         `json:"id"`
	Type     string         `json:"type"` // "function"
	Function FunctionCall   `json:"function"`
}

type FunctionCall struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"` // JSON string
}

type Tool struct {
	Type     string       `json:"type"` // "function"
	Function FunctionDef  `json:"function"`
}

type FunctionDef struct {
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Parameters  json.RawMessage `json:"parameters,omitempty"` // JSON Schema
}

type ChatRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Tools       []Tool    `json:"tools,omitempty"`
	ToolChoice  string    `json:"tool_choice,omitempty"`
	MaxTokens   int       `json:"max_tokens,omitempty"`
	Temperature float64   `json:"temperature,omitempty"`
	Stream      bool      `json:"stream,omitempty"`
}

type ChatResponse struct {
	ID      string   `json:"id"`
	Choices []Choice `json:"choices"`
	Usage   Usage    `json:"usage"`
}

type Choice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message"`
	FinishReason string  `json:"finish_reason"`
}

type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// Chat calls /v1/chat/completions and returns the full response.
func (c *Client) Chat(ctx context.Context, req ChatRequest) (*ChatResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal chat request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("POST /v1/chat/completions: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errBody map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&errBody)
		return nil, fmt.Errorf("aihub error %d: %v", resp.StatusCode, errBody)
	}

	var chatResp ChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return nil, fmt.Errorf("decode chat response: %w", err)
	}
	return &chatResp, nil
}

// ---- Streaming chat --------------------------------------------------------

// StreamDelta is a single parsed chunk from a streaming chat response.
// Text tokens arrive individually; tool calls are assembled and delivered once
// on the final Done=true delta.
type StreamDelta struct {
	Content      string     // text token (empty on tool-call-only or done chunks)
	ToolCalls    []ToolCall // assembled tool calls (only on Done=true)
	FinishReason string     // only on Done=true
	Done         bool
	Err          error
}

// internal streaming parse types
type streamToolCallDelta struct {
	Index    int          `json:"index"`
	ID       string       `json:"id,omitempty"`
	Type     string       `json:"type,omitempty"`
	Function FunctionCall `json:"function"`
}
type streamMsgDelta struct {
	Content   json.RawMessage       `json:"content,omitempty"`
	ToolCalls []streamToolCallDelta `json:"tool_calls,omitempty"`
}
type streamChoiceItem struct {
	Delta        streamMsgDelta `json:"delta"`
	FinishReason *string        `json:"finish_reason"`
}
type streamChunk struct {
	Choices []streamChoiceItem `json:"choices"`
}

// ChatStream calls /v1/chat/completions with stream=true and returns a channel
// of StreamDelta. The caller must drain the channel; it is closed when the
// stream ends or the context is cancelled.
func (c *Client) ChatStream(ctx context.Context, req ChatRequest) (<-chan StreamDelta, error) {
	req.Stream = true
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal chat request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("build stream request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")

	resp, err := c.streamClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("POST /v1/chat/completions stream: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		var errBody map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&errBody)
		resp.Body.Close()
		return nil, fmt.Errorf("aihub stream error %d: %v", resp.StatusCode, errBody)
	}

	ch := make(chan StreamDelta, 64)
	go func() {
		defer close(ch)
		defer resp.Body.Close()

		type tcAssembler struct {
			id   string
			name string
			args strings.Builder
		}
		assemblers := map[int]*tcAssembler{}
		var lastFinishReason string

		scanner := bufio.NewScanner(resp.Body)
		for scanner.Scan() {
			line := scanner.Text()
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			data := strings.TrimPrefix(line, "data: ")
			if data == "[DONE]" {
				break
			}
			var chunk streamChunk
			if err := json.Unmarshal([]byte(data), &chunk); err != nil || len(chunk.Choices) == 0 {
				continue
			}
			choice := chunk.Choices[0]
			if choice.FinishReason != nil && *choice.FinishReason != "" {
				lastFinishReason = *choice.FinishReason
			}
			delta := choice.Delta

			// Text content delta
			if len(delta.Content) > 0 && string(delta.Content) != "null" {
				var contentStr string
				if err := json.Unmarshal(delta.Content, &contentStr); err == nil && contentStr != "" {
					ch <- StreamDelta{Content: contentStr}
				}
			}

			// Tool call deltas — accumulate by index
			for _, tcd := range delta.ToolCalls {
				a, ok := assemblers[tcd.Index]
				if !ok {
					a = &tcAssembler{}
					assemblers[tcd.Index] = a
				}
				if tcd.ID != "" {
					a.id = tcd.ID
				}
				if tcd.Function.Name != "" {
					a.name = tcd.Function.Name
				}
				a.args.WriteString(tcd.Function.Arguments)
			}
		}

		if err := scanner.Err(); err != nil {
			ch <- StreamDelta{Err: err}
			return
		}

		// Assemble final tool calls in index order.
		var toolCalls []ToolCall
		for i := 0; i < len(assemblers); i++ {
			a, ok := assemblers[i]
			if !ok {
				break
			}
			toolCalls = append(toolCalls, ToolCall{
				ID:   a.id,
				Type: "function",
				Function: FunctionCall{
					Name:      a.name,
					Arguments: a.args.String(),
				},
			})
		}
		ch <- StreamDelta{Done: true, ToolCalls: toolCalls, FinishReason: lastFinishReason}
	}()

	return ch, nil
}

// ---- Embeddings ------------------------------------------------------------

type EmbedRequest struct {
	Model string   `json:"model"`
	Input []string `json:"input"`
}

type EmbedResponse struct {
	Data  []EmbedData `json:"data"`
	Usage Usage       `json:"usage"`
}

type EmbedData struct {
	Index     int       `json:"index"`
	Embedding []float64 `json:"embedding"`
}

func (c *Client) Embed(ctx context.Context, req EmbedRequest) (*EmbedResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal embed request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/v1/embeddings", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("build embed request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("POST /v1/embeddings: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var errBody map[string]interface{}
		_ = json.NewDecoder(resp.Body).Decode(&errBody)
		return nil, fmt.Errorf("aihub embed error %d: %v", resp.StatusCode, errBody)
	}

	var embedResp EmbedResponse
	if err := json.NewDecoder(resp.Body).Decode(&embedResp); err != nil {
		return nil, fmt.Errorf("decode embed response: %w", err)
	}
	return &embedResp, nil
}
