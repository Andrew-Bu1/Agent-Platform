# ─── Build stage ─────────────────────────────────────────────
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Copy module manifests only — layer is cached unless go.mod/go.sum change
COPY go.work go.work.sum ./
COPY libs/go/go.mod libs/go/go.sum ./libs/go/
COPY services/agent-orchestrator/go.mod services/agent-orchestrator/go.sum ./services/agent-orchestrator/
COPY services/agent-worker/go.mod services/agent-worker/go.sum ./services/agent-worker/
COPY services/data-worker/go.mod services/data-worker/go.sum ./services/data-worker/
COPY services/datahub/go.mod services/datahub/go.sum ./services/datahub/

RUN go work sync

# Copy source after deps are cached
COPY libs/go/ ./libs/go/
COPY services/datahub/ ./services/datahub/

# Build
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o /datahub \
    ./services/datahub/cmd/

# ─── Runtime stage ───────────────────────────────────────────
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /datahub .

EXPOSE 8080

ENTRYPOINT ["./datahub"]