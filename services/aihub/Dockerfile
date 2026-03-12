FROM python:3.12-slim AS deps

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy dependency manifests first (better Docker cache)
COPY pyproject.toml uv.lock ./

COPY libs/python/pyproject.toml libs/python/README.md ./libs/python/
COPY libs/python/src ./libs/python/src

COPY services/aihub/pyproject.toml ./services/aihub/

RUN uv sync \
    --package aihub \
    --frozen \
    --no-editable \
    --no-install-project


# ---------- runtime stage ----------
FROM python:3.12-slim AS runtime

WORKDIR /app/services/aihub

COPY --from=deps /app/.venv /app/.venv

COPY services/aihub/src ./src
COPY services/aihub/scripts ./scripts

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app/services/aihub" \
    # Keep HuggingFace hub temp cache out of the models volume
    HF_HOME="/tmp/hf-cache"

# The download script writes to <script_dir>/../.models = /app/services/aihub/.models
# Mount a named volume there in docker compose to persist models across restarts.
RUN mkdir -p .models

EXPOSE 8000

# Downloads any missing models on first start, then launches the server.
CMD ["bash", "-c", "python scripts/download_models.py && uvicorn src.main:app --host 0.0.0.0 --port 8000"]