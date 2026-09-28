package servers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	_ "github.com/kr0uch/beeline-plan-tasks/docs"
	"github.com/kr0uch/beeline-plan-tasks/internal/core/repository"
	"github.com/kr0uch/beeline-plan-tasks/internal/transport/api/routers"
	"github.com/kr0uch/beeline-plan-tasks/pkg/logger"
	"github.com/kr0uch/beeline-plan-tasks/pkg/web"
	httpSwagger "github.com/swaggo/http-swagger"
)

type ServerConfig struct {
	Host          string `yaml:"host"`
	Port          int    `yaml:"port"`
	SwaggerConfig struct {
		Host   string `yaml:"host"`
		Schema string `yaml:"schema"`
	} `yaml:"swagger"`
}

type Server struct {
	config ServerConfig
	server *http.Server
	logger logger.Logger
}

const VersionPrefix = "/api/v1"

func NewServer(
	config ServerConfig,
	logger logger.Logger,
	engineerRepository repository.EngineerRepository,
	taskRepository repository.TaskRepository,
	mlRepository repository.MLRepository,
	geoRepository repository.GeoRepository,
	groqClient repository.GroqClient,
	cacheRepository repository.CacheRepository,
) *Server {

	mainMux := http.NewServeMux()

	planRouter := routers.NewPlanRouter(
		engineerRepository,
		taskRepository,
		mlRepository,
		geoRepository,
		groqClient,
		cacheRepository,
	)

	apiMux := http.NewServeMux()
	apiMux.Handle("/", planRouter)

	handler := web.GlobalMiddleware(
		web.ErrorMiddleware(
			web.LoggerMiddleware(logger)(
				apiMux,
			),
		),
	)

	mainMux.Handle(VersionPrefix+"/", http.StripPrefix(VersionPrefix, handler))
	mainMux.Handle(VersionPrefix+"/swagger/", httpSwagger.WrapHandler)

	server := &http.Server{
		Addr:    fmt.Sprintf("%s:%d", config.Host, config.Port),
		Handler: mainMux,
	}

	return &Server{
		config: config,
		server: server,
		logger: logger,
	}
}

func (s *Server) Start() error {

	s.logger.With(logger.Time("started_at", time.Now())).Info(fmt.Sprintf("Server started on %s", s.server.Addr))
	return s.server.ListenAndServe()
}

func (s *Server) Stop() error {

	s.logger.With(logger.Time("stopped_at", time.Now())).Info("Server stopped")
	return s.server.Shutdown(context.Background())
}
