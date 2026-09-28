package routers

import (
	"net/http"

	"github.com/kr0uch/beeline-plan-tasks/internal/core/repository"
	"github.com/kr0uch/beeline-plan-tasks/internal/core/service"
	"github.com/kr0uch/beeline-plan-tasks/internal/transport/api/handlers"
	"github.com/kr0uch/beeline-plan-tasks/pkg/web"
)

func NewPlanRouter(
	engineerRepository repository.EngineerRepository,
	taskRepository repository.TaskRepository,
	mlRepository repository.MLRepository,
	geoRepository repository.GeoRepository,
	groqClient repository.GroqClient,
	cacheRepository repository.CacheRepository,
) *http.ServeMux {

	srv := service.NewPlanService(
		engineerRepository,
		taskRepository,
		mlRepository,
		geoRepository,
		groqClient,
		cacheRepository,
	)
	controller := handlers.NewPlanController(srv)
	router := http.NewServeMux()

	router.HandleFunc("POST /plan", web.HandleWithError(controller.PlanHandler))
	router.HandleFunc("POST /replan", web.HandleWithError(controller.ReplanHandler))

	return router
}
