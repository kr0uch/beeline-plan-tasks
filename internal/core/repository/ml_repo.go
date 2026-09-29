package repository

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/dto"
	"github.com/kr0uch/beeline-plan-tasks/pkg/errors"
)

const maxErrorBodyBytes = 2048

type MLRepo struct {
	client       *http.Client
	baseURL      string
	timeLimitSec int
}

func NewMLRepository(
	client *http.Client,
	baseURL string,
	timeLimitSec int,
) *MLRepo {

	return &MLRepo{
		client:       client,
		baseURL:      baseURL,
		timeLimitSec: timeLimitSec,
	}
}

func (r *MLRepo) FetchOptimalPlan(
	ctx context.Context,
	request *dto.MLPlanRequest,
) (*dto.PlanResponse, error) {
	if request.Options == nil {
		request.Options = r.defaultOptions()
	}
	return r.post(ctx, "/plan", request)
}

func (r *MLRepo) FetchOptimalReplan(
	ctx context.Context,
	request *dto.MLReplanRequest,
) (*dto.PlanResponse, error) {
	if request.Options == nil {
		request.Options = r.defaultOptions()
	}
	return r.post(ctx, "/replan", request)
}

func (r *MLRepo) Ping(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, r.baseURL+"/health", nil)
	if err != nil {
		return err
	}

	resp, err := r.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("ml health: %s", resp.Status)
	}
	return nil
}

func (r *MLRepo) defaultOptions() *dto.MLOptions {
	if r.timeLimitSec <= 0 {
		return nil
	}
	return &dto.MLOptions{TimeLimitSec: r.timeLimitSec}
}

func (r *MLRepo) post(
	ctx context.Context,
	path string,
	request any,
) (*dto.PlanResponse, error) {

	body, err := json.Marshal(request)
	if err != nil {
		return nil, errors.ErrMarshalPayload(err.Error())
	}

	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodPost, r.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, errors.ErrCreateRequest(err.Error())
	}
	httpRequest.Header.Set("Content-Type", "application/json")

	response, err := r.client.Do(httpRequest)
	if err != nil {
		if errors.IsTimeout(err) {
			return nil, errors.ErrMLTimeout(err.Error())
		}
		return nil, errors.ErrMLService(err.Error())
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		details, _ := io.ReadAll(io.LimitReader(response.Body, maxErrorBodyBytes))
		return nil, errors.ErrMLService(fmt.Sprintf("ml %s: %s: %s", path, response.Status, details))
	}

	var result dto.PlanResponse
	if err = json.NewDecoder(response.Body).Decode(&result); err != nil {
		return nil, errors.ErrInvalidResponse(fmt.Sprintf("ml %s: %s", path, err))
	}

	return &result, nil
}
