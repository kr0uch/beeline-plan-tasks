package repository

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/dto"
)

//go:embed llm/prompts/system_explanation.md
var systemPrompt string

type GroqClient interface {
	EnrichPlan(ctx context.Context, resp *dto.PlanResponse)
}

type groqClient struct {
	client  *http.Client
	baseURL string
	model   string
	apiKey  string
}

func NewGroqClient(
	client *http.Client,
	model string,
	apiKey string,
) GroqClient {
	return &groqClient{
		client:  client,
		baseURL: "https://api.groq.com/openai/v1/chat/completions",
		model:   model,
		apiKey:  apiKey,
	}
}

type taskPayload struct {
	ID         int    `json:"id"`
	Status     string `json:"status"`
	Engineer   string `json:"engineer,omitempty"`
	ArrivalMin int    `json:"arrival_min,omitempty"`
	Priority   string `json:"priority,omitempty"`
	Reason     string `json:"reason,omitempty"`
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

func (c *groqClient) EnrichPlan(ctx context.Context, resp *dto.PlanResponse) {
	var payload []taskPayload

	for _, t := range resp.Assigned {
		payload = append(payload, taskPayload{
			ID:         t.TaskID,
			Status:     "assigned",
			Engineer:   t.EngineerName,
			ArrivalMin: t.ArrivalMin,
			Priority:   t.Priority,
		})
	}

	for _, t := range resp.Unassigned {
		payload = append(payload, taskPayload{
			ID:     t.TaskID,
			Status: "unassigned",
			Reason: t.Reason,
		})
	}

	if len(payload) == 0 {
		return
	}

	tasksJSON, err := json.Marshal(payload)
	if err != nil {
		c.applyFallback(resp)
		return
	}

	groqReq := groqRequest{
		Model: c.model,
		Messages: []message{
			{
				Role:    "system",
				Content: systemPrompt,
			},
			{
				Role:    "user",
				Content: string(tasksJSON),
			},
		},
		Temperature: 0.2,
	}

	bodyBytes, _ := json.Marshal(groqReq)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		c.applyFallback(resp)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	httpResp, err := c.client.Do(req)
	if err != nil || httpResp.StatusCode != http.StatusOK {
		if httpResp != nil {
			httpResp.Body.Close()
		}
		c.applyFallback(resp)
		return
	}

	var groqResp groqResponse

	err = json.NewDecoder(httpResp.Body).Decode(&groqResp)
	httpResp.Body.Close()

	if err != nil || len(groqResp.Choices) == 0 {
		c.applyFallback(resp)
		return
	}

	var explanations map[string]string
	if err := json.Unmarshal([]byte(groqResp.Choices[0].Message.Content), &explanations); err != nil {
		c.applyFallback(resp)
		return
	}

	for i := range resp.Assigned {
		idStr := strconv.Itoa(resp.Assigned[i].TaskID)
		if text, ok := explanations[idStr]; ok {
			resp.Assigned[i].Explanation = text
		}
	}

	for i := range resp.Unassigned {
		idStr := strconv.Itoa(resp.Unassigned[i].TaskID)
		if text, ok := explanations[idStr]; ok {
			resp.Unassigned[i].Explanation = text
		}
	}

	c.applyFallback(resp)
}

func (c *groqClient) applyFallback(resp *dto.PlanResponse) {
	for i := range resp.Assigned {
		if resp.Assigned[i].Explanation == "" {
			resp.Assigned[i].Explanation = fmt.Sprintf(
				"Назначено инженеру %s (прибытие: %d мин, приоритет: %s).",
				resp.Assigned[i].EngineerName, resp.Assigned[i].ArrivalMin, resp.Assigned[i].Priority,
			)
		}
	}
	for i := range resp.Unassigned {
		if resp.Unassigned[i].Explanation == "" {
			resp.Unassigned[i].Explanation = fmt.Sprintf("Не назначено. Причина: %s", resp.Unassigned[i].Reason)
		}
	}
}
