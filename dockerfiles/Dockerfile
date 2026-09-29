FROM golang:1.27-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o ./bin/beeline-server ./cmd/main.go

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata wget

WORKDIR /app

COPY --from=builder /app/bin/beeline-server /bin/beeline-server

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/api/v1/health || exit 1

CMD ["/bin/beeline-server"]
