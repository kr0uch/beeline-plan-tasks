package logger

import (
	"os"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

type LoggerConfig struct {
	LogFilePath string `yaml:"log_path"`
}

type Logger interface {
	Info(msg string, fields ...Field)
	Error(msg string, fields ...Field)
	With(fields ...Field) Logger
}
type ZapLogger struct {
	*zap.Logger
}

func NewLogger(cfg LoggerConfig) (Logger, error) {
	err := os.MkdirAll(cfg.LogFilePath, 0750)
	if err != nil {
		return nil, err
	}
	file, err := os.OpenFile(cfg.LogFilePath+"beeline_server.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0640)
	if err != nil {
		return nil, err
	}

	fileCore := zapcore.NewCore(
		zapcore.NewJSONEncoder(zap.NewDevelopmentEncoderConfig()),
		zapcore.AddSync(file),
		zapcore.InfoLevel,
	)

	stdout := zapcore.NewCore(
		zapcore.NewJSONEncoder(zap.NewDevelopmentEncoderConfig()),
		zapcore.AddSync(os.Stdout),
		zapcore.InfoLevel,
	)

	core := zapcore.NewTee(fileCore, stdout)

	zapLogger := zap.New(core, zap.AddCaller(), zap.AddStacktrace(zap.ErrorLevel))

	return &ZapLogger{Logger: zapLogger}, nil
}

type Field zap.Field

func Int(key string, value int) Field {
	return Field(zap.Int(key, value))
}

func String(key, val string) Field {
	return Field(zap.String(key, val))
}

func Duration(key string, val time.Duration) Field {
	return Field(zap.Duration(key, val))
}

func Time(key string, val time.Time) Field {
	return Field(zap.Time(key, val))
}

func Error(err error) Field {
	return Field(zap.Error(err))
}

func (z *ZapLogger) Info(msg string, fields ...Field) {
	z.Logger.Info(msg, toZapFields(fields)...)
}

func (z *ZapLogger) Error(msg string, fields ...Field) {
	z.Logger.Error(msg, toZapFields(fields)...)
}

func (z *ZapLogger) With(fields ...Field) Logger {
	return &ZapLogger{Logger: z.Logger.With(toZapFields(fields)...)}
}

func toZapFields(fields []Field) []zap.Field {
	zapFields := make([]zap.Field, len(fields))
	for i, field := range fields {
		zapFields[i] = zap.Field(field)
	}
	return zapFields
}
