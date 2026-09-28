package repository

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"

	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/dto"
	"github.com/kr0uch/beeline-plan-tasks/pkg/errors"
)

type MLRepository interface {
	FetchOptimalPlan(
		ctx context.Context,
		request *dto.MLPlanRequest,
	) (*dto.PlanResponse, error)
	FetchOptimalReplan(
		ctx context.Context,
		request *dto.MLReplanRequest,
	) (*dto.PlanResponse, error)
}

type mlRepo struct {
	client  *http.Client
	baseURL string
}

func NewMLRepository(
	client *http.Client,
	baseURL string,
) MLRepository {

	return &mlRepo{
		client:  client,
		baseURL: baseURL,
	}
}

func postML[Req any](
	ctx context.Context,
	client *http.Client,
	url string,
	request Req,
) (*dto.PlanResponse, error) {

	body, err := json.Marshal(request)
	if err != nil {
		return nil, errors.ErrMarshalPayload(err.Error())
	}

	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(body))
	if err != nil {
		return nil, errors.ErrInvalidRequest
	}
	httpRequest.Header.Set("Content-Type", "application/json")

	response, err := client.Do(httpRequest)
	if err != nil {
		return nil, errors.ErrExternalService(err.Error())
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return nil, errors.ErrExternalService(response.Status)
	}

	var result dto.PlanResponse
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		return nil, errors.ErrDecodeResponse(err.Error())
	}

	return &result, nil
}

func (r *mlRepo) FetchOptimalPlan(
	ctx context.Context,
	request *dto.MLPlanRequest,
) (*dto.PlanResponse, error) {

	return postML[dto.MLPlanRequest](
		ctx,
		r.client,
		r.baseURL+"/plan",
		*request,
	)
}

func (r *mlRepo) FetchOptimalReplan(
	ctx context.Context,
	request *dto.MLReplanRequest,
) (*dto.PlanResponse, error) {

	return postML[dto.MLReplanRequest](
		ctx,
		r.client,
		r.baseURL+"/replan",
		*request,
	)
}
