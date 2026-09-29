package handlers

import (
	"encoding/json"
	"net/http"
)

// GetPlanHandler godoc
// @Summary Текущий план региона
// @Description Последний построенный или перепланированный план без пересчёта: маршруты, назначения с полными заявками, неназначенные с адресами и причинами, метрики
// @Tags Планирование
// @Produce json
// @Success 200 {object} dto.PlanResponse
// @Param region query string true "регион планирования: east, southeast, southcenter"
// @Failure 400 {object} errors.HttpErrorResponse "invalid region"
// @Failure 404 {object} errors.HttpErrorResponse "plan for region not found, call POST /plan first"
// @Failure 500 {object} errors.HttpErrorResponse "internal server error"
// @Router /plan [get]
func (c *PlanController) GetPlanHandler(
	w http.ResponseWriter,
	r *http.Request,
) error {

	region, err := parseRegion(r)
	if err != nil {
		return err
	}

	plan, err := c.planService.GetCurrentPlan(r.Context(), region)
	if err != nil {
		return err
	}

	return json.NewEncoder(w).Encode(plan)
}

// GetEngineersHandler godoc
// @Summary Бригады региона
// @Description ФИО, транспорт, навыки, оборудование, смена и депо каждой бригады; если план уже построен — маршрут и загрузка смены
// @Tags Бригады
// @Produce json
// @Success 200 {array} dto.EngineerView
// @Param region query string true "регион планирования: east, southeast, southcenter"
// @Failure 400 {object} errors.HttpErrorResponse "invalid region"
// @Failure 404 {object} errors.HttpErrorResponse "region not found: no engineers file for region"
// @Failure 500 {object} errors.HttpErrorResponse "internal server error"
// @Failure 502 {object} errors.HttpErrorResponse "geocoding service is unavailable | invalid response from external service"
// @Failure 504 {object} errors.HttpErrorResponse "geocoding service timed out"
// @Router /engineers [get]
func (c *PlanController) GetEngineersHandler(
	w http.ResponseWriter,
	r *http.Request,
) error {

	region, err := parseRegion(r)
	if err != nil {
		return err
	}

	engineers, err := c.planService.GetEngineers(r.Context(), region)
	if err != nil {
		return err
	}

	return json.NewEncoder(w).Encode(engineers)
}

// HealthHandler godoc
// @Summary Состояние сервиса
// @Description Статус бекенда и доступность ML-сервиса
// @Tags Служебное
// @Produce json
// @Success 200 {object} dto.HealthResponse
// @Router /health [get]
func (c *PlanController) HealthHandler(
	w http.ResponseWriter,
	r *http.Request,
) error {
	return json.NewEncoder(w).Encode(c.planService.Health(r.Context()))
}
