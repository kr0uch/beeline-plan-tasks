package web

import (
	"net/http"
)

type Handler func(w http.ResponseWriter, r *http.Request) error

func HandleWithError(handler Handler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		httpError := GetHttpErrorFromCtx(r.Context())

		err := handler(w, r)

		if err != nil {
			httpError.SetError(err)
		}
	}
}
