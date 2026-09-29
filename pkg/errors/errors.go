package errors

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
)

type HttpError struct {
	Message string `json:"-"`
	Payload string `json:"-"`
	Code    int    `json:"-"`
}

func (e *HttpError) Error() string {
	if e.Message != "" {
		return e.Message
	}
	return ErrUnknownError.Error()
}

func NewHttpError(message string, code int) error {
	return &HttpError{Message: message, Code: code}
}

func NewHttpErrorWithPayload(message string, code int) func(string) error {
	return func(payload string) error {
		return &HttpError{Message: message, Payload: payload, Code: code}
	}
}

func ParseHttpError(err error) *HttpError {
	var val *HttpError
	if errors.As(err, &val) {
		return val
	}
	return &HttpError{
		Message: err.Error(),
		Code:    http.StatusInternalServerError,
	}
}

func (e *HttpError) SetError(err error) {
	parsedErr := ParseHttpError(err)
	e.Message = parsedErr.Message
	e.Payload = parsedErr.Payload
	e.Code = parsedErr.Code
}

func (e *HttpError) HasError() bool {
	return e != nil && e.Message != "" && e.Code != 0
}

type HttpErrorResponse struct {
	Error   string `json:"error" validate:"required"`
	Details string `json:"details,omitempty"`
}

// MarshalJSON отдаёт payload клиенту только для 4xx: в 5xx там детали внутренних
// и внешних сервисов, они пишутся только в лог.
func (e *HttpError) MarshalJSON() ([]byte, error) {
	resp := HttpErrorResponse{Error: ErrUnknownError.Error()}

	if e.HasError() {
		resp.Error = e.Error()
		if e.Code < http.StatusInternalServerError {
			resp.Details = e.Payload
		}
	}
	return json.Marshal(resp)
}

func MarshalError(err error) []byte {
	httpError := ParseHttpError(err)
	data, _ := json.Marshal(httpError)
	return data
}

func (e *HttpError) Is(target error) bool {
	t, ok := target.(*HttpError)
	if !ok {
		return false
	}

	return e.Code == t.Code && e.Message == t.Message
}

func IsTimeout(err error) bool {
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	var netErr net.Error
	return errors.As(err, &netErr) && netErr.Timeout()
}

var (
	ErrInternalServer = NewHttpError("internal server error", http.StatusInternalServerError)
	ErrUnknownError   = NewHttpError("unknown error", http.StatusInternalServerError)

	ErrInvalidRegion         = NewHttpError("invalid region", http.StatusBadRequest)
	ErrInvalidMultipartForm  = NewHttpError("invalid multipart form", http.StatusBadRequest)
	ErrTasksFileMissing      = NewHttpError("tasks_file is missing in multipart form", http.StatusBadRequest)
	ErrInvalidTasksCSVHeader = NewHttpErrorWithPayload("invalid or missing columns in tasks CSV", http.StatusBadRequest)
	ErrInvalidTaskRow        = NewHttpErrorWithPayload("invalid task row in CSV", http.StatusBadRequest)
	ErrNoTasksInCSV          = NewHttpError("tasks CSV contains no valid tasks", http.StatusBadRequest)
	ErrInvalidRequestData    = NewHttpErrorWithPayload("invalid request data", http.StatusBadRequest)

	ErrRegionNotFound = NewHttpError("region not found: no engineers file for region", http.StatusNotFound)
	ErrPlanNotFound   = NewHttpError("plan for region not found, call POST /plan first", http.StatusNotFound)

	ErrPlanOutdated = NewHttpError("cached plan references unknown engineer, rebuild it with POST /plan", http.StatusConflict)

	ErrOpenEngineersCSV           = NewHttpErrorWithPayload("failed to open engineers CSV", http.StatusInternalServerError)
	ErrInvalidEngineersCSVHeaders = NewHttpErrorWithPayload("invalid or missing columns in engineers CSV", http.StatusInternalServerError)
	ErrInvalidEngineerRow         = NewHttpErrorWithPayload("invalid engineer row in CSV", http.StatusInternalServerError)
	ErrMarshalPayload             = NewHttpErrorWithPayload("failed to marshal payload", http.StatusInternalServerError)
	ErrCreateRequest              = NewHttpErrorWithPayload("failed to create request", http.StatusInternalServerError)

	ErrMLService       = NewHttpErrorWithPayload("ml service is unavailable", http.StatusBadGateway)
	ErrGeocoderService = NewHttpErrorWithPayload("geocoding service is unavailable", http.StatusBadGateway)
	ErrInvalidResponse = NewHttpErrorWithPayload("invalid response from external service", http.StatusBadGateway)

	ErrMLTimeout       = NewHttpErrorWithPayload("ml service timed out", http.StatusGatewayTimeout)
	ErrGeocoderTimeout = NewHttpErrorWithPayload("geocoding service timed out", http.StatusGatewayTimeout)
)
