package config

import (
	"github.com/ilyakaznacheev/cleanenv"
	"github.com/kr0uch/beeline-plan-tasks/internal/transport/api/servers"
	"github.com/kr0uch/beeline-plan-tasks/pkg/logger"
)

type Config struct {
	servers.ServerConfig `yaml:"server"`
	logger.LoggerConfig  `yaml:"logger"`

	MLServiceURL   string `yaml:"ml_service_url"`
	MLTimeLimitSec int    `yaml:"ml_time_limit_sec" env-default:"10"`

	EngineersDataDir string `yaml:"engineers_data_dir"`
	CacheDataDir     string `yaml:"cache_data_dir"`

	GeoapifyApiKey string `yaml:"geoapify_api_key"`

	GroqApiKey string `yaml:"groq_api_key"`
	GroqModel  string `yaml:"groq_model"`
}

func NewConfig() (*Config, error) {
	var cfg Config
	err := cleanenv.ReadConfig(".yaml", &cfg)
	if err != nil {
		return nil, err
	}

	return &cfg, nil
}
