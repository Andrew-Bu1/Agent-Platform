from pydantic_settings import BaseSettings, SettingsConfigDict


class AihubConfig(BaseSettings):
  

    model_config = SettingsConfigDict(
        env_prefix="AIHUB_",
        env_file="tests/load/aihub/.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "http://localhost:8000"

    # Comma-separated strings — split into lists below.
    embed_models: str = "BAAI/bge-m3,sentence-transformers/multilingual-e5-base,sentence-transformers/all-MiniLM-L6-v2"
    rerank_models: str = "BAAI/bge-reranker-base,BAAI/bge-reranker-v2-m3"

    embed_task_weight: int = 3
    rerank_task_weight: int = 1

    rerank_top_n: int | None = None
    wait_min: float = 0.5
    wait_max: float = 2.0


def _parse_csv(value: str) -> list[str]:
    return [m.strip() for m in value.split(",") if m.strip()]


_cfg = AihubConfig()

HOST = _cfg.host
EMBED_MODELS: list[str] = _parse_csv(_cfg.embed_models)
RERANK_MODELS: list[str] = _parse_csv(_cfg.rerank_models)
EMBED_TASK_WEIGHT = _cfg.embed_task_weight
RERANK_TASK_WEIGHT = _cfg.rerank_task_weight
RERANK_TOP_N = _cfg.rerank_top_n
WAIT_MIN = _cfg.wait_min
WAIT_MAX = _cfg.wait_max
