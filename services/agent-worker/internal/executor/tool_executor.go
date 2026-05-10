package executor

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/Andrew-Bu1/Agent-Platform/services/agent-worker/internal/model"
)

// HTTPToolConfig is the shape of tools.config_json for tool_type = "http".
type HTTPToolConfig struct {
	URL     string            `json:"url"`
	Method  string            `json:"method"`  // GET, POST, PUT, DELETE, PATCH
	Headers map[string]string `json:"headers"`
}

// ToolExecutor dispatches tool calls to their implementations.
type ToolExecutor struct {
	httpClient *http.Client
}

func NewToolExecutor() *ToolExecutor {
	return &ToolExecutor{
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// Execute runs a tool call.
// Returns (outputJSON, error).
func (e *ToolExecutor) Execute(ctx context.Context, tool *model.Tool, argumentsJSON string) (json.RawMessage, error) {
	switch tool.ToolType {
	case "http":
		return e.executeHTTP(ctx, tool, argumentsJSON)
	default:
		return nil, fmt.Errorf("unsupported tool_type: %s", tool.ToolType)
	}
}

func (e *ToolExecutor) executeHTTP(ctx context.Context, tool *model.Tool, argumentsJSON string) (json.RawMessage, error) {
	var cfg HTTPToolConfig
	if len(tool.ConfigJSON) > 0 {
		if err := json.Unmarshal(tool.ConfigJSON, &cfg); err != nil {
			return nil, fmt.Errorf("parse tool config: %w", err)
		}
	}

	if cfg.URL == "" {
		return nil, fmt.Errorf("http tool %s has no url in config", tool.ID)
	}

	method := cfg.Method
	if method == "" {
		method = http.MethodPost
	}

	var bodyReader io.Reader
	if method != http.MethodGet && method != http.MethodHead {
		bodyReader = bytes.NewBufferString(argumentsJSON)
	}

	req, err := http.NewRequestWithContext(ctx, method, cfg.URL, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("build http request for tool %s: %w", tool.ID, err)
	}
	if bodyReader != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range cfg.Headers {
		req.Header.Set(k, v)
	}

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("tool %s http request failed: %w", tool.ID, err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read tool response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("tool %s returned HTTP %d: %s", tool.ID, resp.StatusCode, string(respBody))
	}

	// Attempt to return raw JSON; wrap plain text otherwise.
	if json.Valid(respBody) {
		return json.RawMessage(respBody), nil
	}
	wrapped, _ := json.Marshal(map[string]string{"result": string(respBody)})
	return json.RawMessage(wrapped), nil
}
