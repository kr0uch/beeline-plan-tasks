package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/dto"
	"github.com/kr0uch/beeline-plan-tasks/pkg/errors"
)

type PlanService interface {
	Plan(
		ctx context.Context,
		request *dto.PlanRequest,
	) (*dto.PlanResponse, error)
	Replan(
		ctx context.Context,
		request *dto.ReplanRequest,
	) (*dto.PlanResponse, error)
}

type PlanController struct {
	planService PlanService
}

func NewPlanController(
	planService PlanService,
) *PlanController {

	return &PlanController{
		planService: planService,
	}
}

// PlanHandler godoc
// @Summary Планирование задач по загруженному CSV файлу
// @Description Получает CSV файл через multipart/form-data по ключу "tasks_file" и выполняет оптимальную и неоптимальную планировку
// @Tags Планирование
// @Accept multipart/form-data
// @Produce json
// @Success 200 {object} dto.PlanResponse
// @Param region query string true "регион планирования: east, southeast, southcenter"
// @Param tasks_file formData file true "CSV файл с задачами"
// @Failure 400 {object} errors.HttpErrorResponse "failed to parse csv multipart form"
// @Failure 400 {object} errors.HttpErrorResponse "invalid region"
// @Failure 400 {object} errors.HttpErrorResponse "invalid or missing CSV headers"
// @Failure 400 {object} errors.HttpErrorResponse "required tasks file is missing in multipart form"
// @Failure 404 {object} errors.HttpErrorResponse "address not found"
// @Failure 500 {object} errors.HttpErrorResponse "internal server error"
// @Failure 502 {object} errors.HttpErrorResponse "external service is unavailable"
// @Router /plan [post]
func (c *PlanController) PlanHandler(
	w http.ResponseWriter,
	r *http.Request,
) error {

	if err := r.ParseMultipartForm(64 << 20); err != nil {
		return errors.ErrFailedParseMultipartForm
	}

	tasksFile, _, err := r.FormFile("tasks_file")
	if err != nil {
		return errors.ErrTasksFileMissing

	}

	defer tasksFile.Close()

	region := r.FormValue("region")

	if region == "" {
		return errors.ErrInvalidRegion
	}

	planRequest := &dto.PlanRequest{
		Region:      region,
		TasksReader: tasksFile,
	}

	planResponse, err := c.planService.Plan(r.Context(), planRequest)
	if err != nil {
		return err

	}

	return json.NewEncoder(w).Encode(planResponse)
}

// ReplanHandler godoc
// @Summary Перепланирование задач по ранее загруженному CSV файлу с учетом новой задачи
// @Description Получает новую задачу и текущее время и перепланирует план работ
// @Tags Планирование
// @Accept application/json
// @Produce json
// @Success 200 {object} dto.PlanResponse
// @Param region query string true "регион планирования: east, southeast, southcenter"
// @Param request body dto.ReplanRequest true "Данные новой заявки и текущее время"
// @Failure 400 {object} errors.HttpErrorResponse "invalid region"
// @Failure 400 {object} errors.HttpErrorResponse "invalid request data"
// @Failure 404 {object} errors.HttpErrorResponse "address not found"
// @Failure 500 {object} errors.HttpErrorResponse "internal server error"
// @Failure 502 {object} errors.HttpErrorResponse "external service is unavailable"
// @Router /replan [post]
func (c *PlanController) ReplanHandler(
	w http.ResponseWriter,
	r *http.Request,
) error {

	region := r.FormValue("region")

	if region == "" {
		return errors.ErrInvalidRegion
	}

	var replanRequest dto.ReplanRequest

	replanRequest.Region = region

	err := json.NewDecoder(r.Body).Decode(&replanRequest)
	if err != nil {
		return errors.ErrInvalidRequestData(err.Error())
	}

	planResponse, err := c.planService.Replan(r.Context(), &replanRequest)
	if err != nil {
		return err
	}

	return json.NewEncoder(w).Encode(planResponse)
}
