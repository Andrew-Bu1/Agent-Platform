from contextlib import asynccontextmanager

from common.logger import setup_logging
from common.postgres import PostgresClient
from fastapi import FastAPI

from src.api import chat as chat_api
from src.api import embedding as embedding_api
from src.api import model_config as model_config_api
from src.api import model_usage_log as model_usage_log_api
from src.api import rerank as rerank_api
from src.config import load_settings
from src.repositories.model_config import ModelConfigRepository
from src.repositories.model_usage_log import ModelUsageLogRepository
from src.services.router import ServiceRouter


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = load_settings()

    pg = PostgresClient(settings.postgres.url)
    await pg.connect()

    model_config_repo = ModelConfigRepository(pg)
    model_usage_log_repo = ModelUsageLogRepository(pg)

    app.state.model_config_repo = model_config_repo
    app.state.model_usage_log_repo = model_usage_log_repo
    app.state.service_router = ServiceRouter(
        model_config_repo=model_config_repo,
        model_usage_log_repo=model_usage_log_repo,
        open_router_config=settings.open_router,
    )

    yield

    await pg.close()


app = FastAPI(
    title="AIHub API",
    description="API for AIHub services",
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app)
