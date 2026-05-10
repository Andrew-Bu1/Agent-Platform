# ─── Build stage ─────────────────────────────────────────────
FROM golang:1.25-alpine AS builder

WORKDIR /app

COPY go.work ./
COPY . .

RUN go work sync

RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o /agent-orchestrator \
    ./services/agent-orchestrator/cmd/

# ─── Runtime stage ───────────────────────────────────────────
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /agent-orchestrator .

EXPOSE 8081

ENTRYPOINT ["./agent-orchestrator"]
