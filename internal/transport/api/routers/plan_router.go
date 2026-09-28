package routers

import (
	"net/http"

	"github.com/kr0uch/beeline-plan-tasks/internal/transport/api/handlers"
	"github.com/kr0uch/beeline-plan-tasks/pkg/web"
)

func NewPlanRouter(planService handlers.PlanService) *http.ServeMux {
	controller := handlers.NewPlanController(planService)
	router := http.NewServeMux()

	router.HandleFunc("POST /plan", web.HandleWithError(controller.PlanHandler))
	router.HandleFunc("GET /plan", web.HandleWithError(controller.GetPlanHandler))
	router.HandleFunc("POST /replan", web.HandleWithError(controller.ReplanHandler))
	router.HandleFunc("GET /engineers", web.HandleWithError(controller.GetEngineersHandler))
	router.HandleFunc("GET /health", web.HandleWithError(controller.HealthHandler))

	return router
}
