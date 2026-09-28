package web

import (
	"context"

	"github.com/kr0uch/beeline-plan-tasks/pkg/errors"
)

type ctxKey int

const (
	CtxHttpErrorKey ctxKey = iota
)

func GetHttpErrorFromCtx(ctx context.Context) *errors.HttpError {
	val := ctx.Value(CtxHttpErrorKey)
	if val == nil {
		return nil
	}

	err, ok := val.(*errors.HttpError)
	if !ok {
		return nil
	}
	return err
}
