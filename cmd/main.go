package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/kr0uch/beeline-plan-tasks/docs"
	"github.com/kr0uch/beeline-plan-tasks/internal/config"
	"github.com/kr0uch/beeline-plan-tasks/internal/core/repository"
	"github.com/kr0uch/beeline-plan-tasks/internal/transport/api/servers"
	"github.com/kr0uch/beeline-plan-tasks/pkg/logger"
)

// @title           Beeline Plan Tasks
// @version         1.0
// @schemes http
// @host      localhost:80
// @BasePath  /api/v1
// @externalDocs.description  OpenAPI

func main() {
	cfg, err := config.NewConfig()
	if err != nil {
		log.Fatal(err)
	}

	docs.SwaggerInfo.Host = cfg.ServerConfig.SwaggerConfig.Host
	docs.SwaggerInfo.Schemes = []string{cfg.ServerConfig.SwaggerConfig.Schema}

	zapLogger, err := logger.NewLogger(cfg.LoggerConfig)
	if err != nil {
		log.Fatal(err)
	}

	engineerRepo := repository.NewEngineerRepository(cfg.EngineersDataDir)
	taskRepo := repository.NewTaskRepository()
	mlRepo := repository.NewMLRepository(
		&http.Client{
			Timeout: 30 * time.Second,
		},
		cfg.MLServiceURL,
	)
	geoRepo := repository.NewGeoRepository(
		&http.Client{
			Timeout: 15 * time.Second,
		},
		cfg.GeoapifyApiKey,
	)
	groqClient := repository.NewGroqClient(
		&http.Client{
			Timeout: 15 * time.Second,
		},
		cfg.GroqModel,
		cfg.GroqApiKey,
	)
	cacheRepo := repository.NewCacheRepository(cfg.CacheDataDir)

	server := servers.NewServer(
		cfg.ServerConfig,
		zapLogger,
		engineerRepo,
		taskRepo,
		mlRepo,
		geoRepo,
		groqClient,
		cacheRepo,
	)

	graceChan := make(chan os.Signal, 1)
	signal.Notify(
		graceChan,
		syscall.SIGINT,
		syscall.SIGTERM,
	)

	go func() {
		if err := server.Start(); err != nil {
			zapLogger.Error("server.Start", logger.Error(err))
		}

	}()
	<-graceChan

	if err = server.Stop(); err != nil {
		zapLogger.Error("server.Stop", logger.Error(err))
	}

}
