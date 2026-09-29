package repository

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/dto"
)

const groqChatURL = "https://api.groq.com/openai/v1/chat/completions"

//go:embed llm/prompts/system_explanation.md
var systemPrompt string

type GroqClient struct {
	client  *http.Client
	baseURL string
	model   string
	apiKey  string
}

func NewGroqClient(
	client *http.Client,
	model string,
	apiKey string,
) *GroqClient {
	return &GroqClient{
		client:  client,
		baseURL: groqChatURL,
		model:   model,
		apiKey:  apiKey,
	}
}

type taskPayload struct {
	ID       int    `json:"id"`
	Status   string `json:"status"`
	Engineer string `json:"engineer,omitempty"`
	Arrival  string `json:"arrival,omitempty"`
	Window   string `json:"window,omitempty"`
	LateMin  int    `json:"late_min,omitempty"`
	Priority string `json:"priority,omitempty"`
	Reason   string `json:"reason,omitempty"`
	Facts    string `json:"facts"`
}

type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type groqRequest struct {
	Model       string    `json:"model"`
	Messages    []message `json:"messages"`
	Temperature float64   `json:"temperature"`
}

type groqResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func (c *GroqClient) EnrichPlan(ctx context.Context, resp *dto.PlanResponse) {
	if c.apiKey == "" {
		return
	}

	payload := buildExplanationPayload(resp)
	if len(payload) == 0 {
		return
	}

	explanations, err := c.fetchExplanations(ctx, payload)
	if err != nil {
		return
	}

	for i := range resp.Assigned {
		if text := explanations[strconv.Itoa(resp.Assigned[i].TaskID)]; text != "" {
			resp.Assigned[i].Explanation = text
		}
	}
	for i := range resp.Unassigned {
		if text := explanations[strconv.Itoa(resp.Unassigned[i].TaskID)]; text != "" {
			resp.Unassigned[i].Explanation = text
		}
	}
}

func buildExplanationPayload(resp *dto.PlanResponse) []taskPayload {
	payload := make([]taskPayload, 0, len(resp.Assigned)+len(resp.Unassigned))

	for _, t := range resp.Assigned {
		item := taskPayload{
			ID:       t.TaskID,
			Status:   "assigned",
			Engineer: t.EngineerName,
			Arrival:  formatMinutesToHM(t.ArrivalMin),
			LateMin:  t.LateMin,
			Priority: t.Priority,
			Facts:    t.Explanation,
		}
		if start, end, ok := t.Window(); ok {
			item.Window = formatMinutesToHM(start) + "–" + formatMinutesToHM(end)
		}
		payload = append(payload, item)
	}
	for _, t := range resp.Unassigned {
		payload = append(payload, taskPayload{
			ID:     t.TaskID,
			Status: "unassigned",
			Reason: t.Reason,
			Facts:  t.Explanation,
		})
	}

	return payload
}

func (c *GroqClient) fetchExplanations(
	ctx context.Context,
	payload []taskPayload,
) (map[string]string, error) {

	tasksJSON, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	bodyBytes, err := json.Marshal(groqRequest{
		Model: c.model,
		Messages: []message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: string(tasksJSON)},
		},
		Temperature: 0.2,
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	httpResp, err := c.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer httpResp.Body.Close()

	if httpResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("groq: %s", httpResp.Status)
	}

	var groqResp groqResponse
	if err = json.NewDecoder(httpResp.Body).Decode(&groqResp); err != nil {
		return nil, err
	}
	if len(groqResp.Choices) == 0 {
		return nil, fmt.Errorf("groq: empty choices")
	}

	var explanations map[string]string
	if err = json.Unmarshal([]byte(stripCodeFence(groqResp.Choices[0].Message.Content)), &explanations); err != nil {
		return nil, err
	}

	return explanations, nil
}

func stripCodeFence(content string) string {
	content = strings.TrimSpace(content)
	if !strings.HasPrefix(content, "```") {
		return content
	}
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimPrefix(content, "json")
	content = strings.TrimSuffix(content, "```")
	return strings.TrimSpace(content)
}
