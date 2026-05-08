# ─── Build stage ─────────────────────────────────────────────
FROM golang:1.25-alpine AS builder

WORKDIR /app

COPY go.work ./
COPY . .

RUN go work sync

RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o /data-worker \
    ./services/data-worker/cmd/

# ─── Runtime stage ───────────────────────────────────────────
FROM alpine:3.21

WORKDIR /app

COPY --from=builder /data-worker .

ENTRYPOINT ["./data-worker"]
