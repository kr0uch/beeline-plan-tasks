package errors

import (
	"encoding/json"
	"errors"
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
	Error string `json:"error" validate:"required"`
}

func (e *HttpError) MarshalJSON() ([]byte, error) {
	resp := HttpErrorResponse{ErrUnknownError.Error()}

	if e.HasError() {
		resp.Error = e.Error()
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

	return e.Code == t.Code
}

var (
	ErrInternalServer = NewHttpError("internal server error", http.StatusInternalServerError)
	ErrUnknownError   = NewHttpError("unknown error", http.StatusInternalServerError)

	ErrFailedParseMultipartForm = NewHttpError("failed to parse csv multipart form", http.StatusBadRequest)
	ErrInvalidCSVHeaders        = NewHttpError("invalid or missing CSV headers", http.StatusBadRequest)
	ErrTasksFileMissing         = NewHttpError("required tasks file is missing in multipart form", http.StatusBadRequest)

	ErrFailedOpenCSV              = NewHttpErrorWithPayload("failed to open csv file", http.StatusInternalServerError)
	ErrInvalidCSVRow              = NewHttpErrorWithPayload("failed to parse CSV row: invalid data format", http.StatusInternalServerError)
	ErrInvalidEngineersCSVHeaders = NewHttpErrorWithPayload("invalid or missing CSV header in engineers file", http.StatusInternalServerError)

	ErrDecodeResponse = NewHttpErrorWithPayload("failed to decode response", http.StatusInternalServerError)
	ErrInvalidRequest = NewHttpError("failed to create request", http.StatusInternalServerError)
	ErrMarshalPayload = NewHttpErrorWithPayload("failed to marshal payload", http.StatusInternalServerError)

	ErrExternalService = NewHttpErrorWithPayload("external service is unavailable", http.StatusBadGateway)
	ErrInvalidResponse = NewHttpErrorWithPayload("invalid response from external service", http.StatusBadGateway)
	ErrAddressNotFound = NewHttpError("address not found", http.StatusNotFound)

	ErrEngineerIdNotFound = NewHttpError("engineer id not found", http.StatusInternalServerError)
	ErrInvalidRequestData = NewHttpErrorWithPayload("invalid request data", http.StatusBadRequest)

	ErrInvalidRegion = NewHttpError("invalid region", http.StatusBadRequest)
)
