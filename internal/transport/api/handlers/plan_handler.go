package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"regexp"

	"github.com/kr0uch/beeline-plan-tasks/internal/core/models/dto"
	"github.com/kr0uch/beeline-plan-tasks/pkg/errors"
)

var regionPattern = regexp.MustCompile(`^[a-z_]{1,32}$`)

func parseRegion(r *http.Request) (string, error) {
	region := r.FormValue("region")
	if !regionPattern.MatchString(region) {
		return "", errors.ErrInvalidRegion
	}
	return region, nil
}

const minutesPerDay = 24 * 60

func validateReplanRequest(req *dto.ReplanRequest) error {
	task := req.NewTask
	switch {
	case req.CurrentTimeMin < 0 || req.CurrentTimeMin > minutesPerDay:
		return errors.ErrInvalidRequestData("current_time_min must be within [0, 1440]")
	case task == nil:
		return errors.ErrInvalidRequestData("new_task is required")
	case task.ID <= 0:
		return errors.ErrInvalidRequestData("new_task.id must be positive")
	case task.Address == "" && (task.Lat == 0 || task.Lon == 0):
		return errors.ErrInvalidRequestData("new_task needs address or lat/lon")
	case task.TWStart < 0 || task.TWEnd <= task.TWStart:
		return errors.ErrInvalidRequestData("new_task window must satisfy 0 <= tw_start < tw_end")
	}
	return nil
}

func explainWithLLM(r *http.Request) bool {
	return r.URL.Query().Get("explain") != "rules"
}

type PlanService interface {
	Plan(
		ctx context.Context,
		request *dto.PlanRequest,
	) (*dto.PlanResponse, error)
	Replan(
		ctx context.Context,
		request *dto.ReplanRequest,
	) (*dto.PlanResponse, error)
	GetCurrentPlan(
		ctx context.Context,
		region string,
	) (*dto.PlanResponse, error)
	GetEngineers(
		ctx context.Context,
		region string,
	) ([]dto.EngineerView, error)
	Health(ctx context.Context) *dto.HealthResponse
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
// @Param explain query string false "rules — объяснения только по правилам, без LLM; по умолчанию llm"
// @Failure 400 {object} errors.HttpErrorResponse "invalid region | invalid multipart form | tasks_file is missing in multipart form | invalid or missing columns in tasks CSV | invalid task row in CSV | tasks CSV contains no valid tasks"
// @Failure 404 {object} errors.HttpErrorResponse "region not found: no engineers file for region"
// @Failure 500 {object} errors.HttpErrorResponse "internal server error"
// @Failure 502 {object} errors.HttpErrorResponse "ml service is unavailable | geocoding service is unavailable | invalid response from external service"
// @Failure 504 {object} errors.HttpErrorResponse "ml service timed out | geocoding service timed out"
// @Router /plan [post]
func (c *PlanController) PlanHandler(
	w http.ResponseWriter,
	r *http.Request,
) error {

	region, err := parseRegion(r)
	if err != nil {
		return err
	}

	if err = r.ParseMultipartForm(64 << 20); err != nil {
		return errors.ErrInvalidMultipartForm
	}

	tasksFile, _, err := r.FormFile("tasks_file")
	if err != nil {
		return errors.ErrTasksFileMissing
	}
	defer tasksFile.Close()

	planRequest := &dto.PlanRequest{
		Region:         region,
		TasksReader:    tasksFile,
		ExplainWithLLM: explainWithLLM(r),
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
// @Param explain query string false "rules — объяснения только по правилам, без LLM; по умолчанию llm"
// @Failure 400 {object} errors.HttpErrorResponse "invalid region | invalid request data"
// @Failure 404 {object} errors.HttpErrorResponse "region not found: no engineers file for region | plan for region not found, call POST /plan first"
// @Failure 409 {object} errors.HttpErrorResponse "cached plan references unknown engineer, rebuild it with POST /plan"
// @Failure 500 {object} errors.HttpErrorResponse "internal server error"
// @Failure 502 {object} errors.HttpErrorResponse "ml service is unavailable | geocoding service is unavailable | invalid response from external service"
// @Failure 504 {object} errors.HttpErrorResponse "ml service timed out | geocoding service timed out"
// @Router /replan [post]
func (c *PlanController) ReplanHandler(
	w http.ResponseWriter,
	r *http.Request,
) error {

	region, err := parseRegion(r)
	if err != nil {
		return err
	}

	var replanRequest dto.ReplanRequest

	replanRequest.Region = region

	err = json.NewDecoder(r.Body).Decode(&replanRequest)
	if err != nil {
		return errors.ErrInvalidRequestData(err.Error())
	}
	if err = validateReplanRequest(&replanRequest); err != nil {
		return err
	}
	replanRequest.ExplainWithLLM = explainWithLLM(r)

	planResponse, err := c.planService.Replan(r.Context(), &replanRequest)
	if err != nil {
		return err
	}

	return json.NewEncoder(w).Encode(planResponse)
}
