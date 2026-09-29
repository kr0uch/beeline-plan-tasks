package web

import (
	"net/http"
	"time"

	"github.com/kr0uch/beeline-plan-tasks/pkg/logger"
)

func LoggerMiddleware(zapLogger logger.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()

			reqLogger := zapLogger.With(
				logger.String("method", r.Method),
				logger.String("path", r.URL.Path))

			reqLogger.Info("request started")

			next.ServeHTTP(w, r)

			duration := time.Since(start)

			logFields := []logger.Field{
				logger.Duration("duration", duration),
			}

			httpError := GetHttpErrorFromCtx(r.Context())

			if httpError.HasError() {
				logFields = append(
					logFields,
					logger.String("error", httpError.Error()),
					logger.String("error_payload", httpError.Payload),
					logger.Int("status_code", httpError.Code),
				)

				reqLogger.With(logFields...).Error("request failed")
				return
			}

			reqLogger.With(logFields...).Info("request completed")
		})
	}
}
