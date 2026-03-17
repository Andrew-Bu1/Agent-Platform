# ─── Build stage ─────────────────────────────────────────────
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Copy all go workspace + module manifests at once
COPY go.work ./
COPY . .

# Download deps (cached unless go.mod/sum change)
RUN go work sync && go work download

# Build
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -o /datahub \
    ./services/datahub/cmd/

# ─── Runtime stage ───────────────────────────────────────────
FROM alpine:3.21


WORKDIR /app

COPY --from=builder /datahub .

EXPOSE 8080

ENTRYPOINT ["./datahub"]