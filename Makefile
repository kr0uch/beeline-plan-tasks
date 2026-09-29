CMD_PATH=./cmd/main.go
MAIN_FILE=main.go
MAIN_DIR=./cmd
DOCS_DIR=./docs

export GOPRIVATE=://github.com*

GO=go
SWAG=swag
SWAG_INIT=$(SWAG) init -g $(CMD_PATH) -o $(DOCS_DIR) --parseInternal
DOCKER=docker
DOCKER_COMPOSE=$(DOCKER) compose
DOCKER_SYSTEM=$(DOCKER) system

.PHONY: swag
swag:
	$(SWAG_INIT)
	$(GO) mod tidy

.PHONY: run
run: swag
	$(GO) run $(CMD_PATH)

.PHONY: clean
clean:
	$(GO) clean
	rm -rf docs/
	rm -rf data/cache/

.PHONY: docker-build
docker-build:
	$(DOCKER_COMPOSE) build

.PHONY: docker-up
docker-up:
	$(DOCKER_COMPOSE) up -d

.PHONY: docker-down
docker-down:
	$(DOCKER_COMPOSE) down

.PHONY: docker-restart
docker-restart: docker-down docker-up

.PHONY: docker-logs
docker-logs:
	$(DOCKER_COMPOSE) logs -f

.PHONY: docker-clean
docker-clean:
	$(DOCKER_COMPOSE) down -v
	$(DOCKER_SYSTEM) prune -f

.PHONY: docker-global-network
docker-global-network:
	$(DOCKER) network create global-app-network