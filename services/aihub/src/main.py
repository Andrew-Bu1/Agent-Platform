from contextlib import asynccontextmanager

from common.logger import setup_logging
from common.postgres import PostgresClient
from common.redis import RedisClient
from common.storage import MinioStorage
from fastapi import FastAPI

from src.adapters.registry import build_registry
from src.api import chat as chat_api
from src.api import embedding as embedding_api
from src.api import model_config as model_config_api
from src.api import model_usage_log as model_usage_log_api
from src.api import providers as providers_api
from src.api import rerank as rerank_api
from src.config import load_settings
from src.middleware.auth import JwksCache
from src.repositories.model_config import ModelConfigRepository
from src.repositories.model_usage_log import ModelUsageLogRepository
from src.repositories.providers import ProvidersRepository
from src.services.entitlement import EntitlementGuard
from src.services.router import ServiceRouter


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = load_settings()

    pg = PostgresClient(settings.postgres.url)
    await pg.connect()

    redis = RedisClient(settings.redis.url)
    await redis.connect()

    jwks_cache = JwksCache(settings.iam.base_url)
    await jwks_cache.load()

    model_config_repo = ModelConfigRepository(pg)
    model_usage_log_repo = ModelUsageLogRepository(pg)
    providers_repo = ProvidersRepository(pg)
    entitlement_guard = EntitlementGuard(settings.iam.base_url, redis)

    minio = MinioStorage(settings.minio)
    minio.ensure_bucket()

    active_providers = await providers_repo.get_all_active()
    registry = build_registry(
        active_providers,
        model_dir=settings.model.dir,
        encryption_key=settings.provider.encryption_key,
    )

    app.state.model_config_repo = model_config_repo
    app.state.model_usage_log_repo = model_usage_log_repo
    app.state.providers_repo = providers_repo
    app.state.jwks_cache = jwks_cache
    app.state.iam_config = settings.iam
    app.state.provider_encryption_key = settings.provider.encryption_key
    app.state.minio = minio
    app.state.service_router = ServiceRouter(
        model_config_repo=model_config_repo,
        model_usage_log_repo=model_usage_log_repo,
        entitlement_guard=entitlement_guard,
        registry=registry,
    )

    yield

    await pg.close()
    await redis.close()


app = FastAPI(
    title="AIHub API",
    description="AI model gateway — chat, embedding, reranking",
    version="1.0.0",
    docs_url="/swagger",
    lifespan=lifespan,
)

setup_logging()

app.include_router(chat_api.router(), prefix="/v1")
app.include_router(embedding_api.router(), prefix="/v1")
app.include_router(rerank_api.router(), prefix="/v1")
app.include_router(model_config_api.router(), prefix="/v1")
app.include_router(model_usage_log_api.router(), prefix="/v1")
app.include_router(providers_api.router(), prefix="/v1")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app)
