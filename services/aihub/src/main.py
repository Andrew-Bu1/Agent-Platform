from contextlib import asynccontextmanager
from fastapi import FastAPI
import uvicorn
from src.config import get_settings
from src.presentation.controllers import set_embedding_router, set_rerank_router
from common import PostgresClient

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    settings = get_settings()
    app.state.db = PostgresClient(settings.postgres_url)
    await app.state.db.connect()
    yield
    # Shutdown
    await app.state.db.disconnect()

app = FastAPI(
    docs_url="/swagger",
    lifespan=lifespan,
)

@app.get("/health")
def health():
    return {"status": "ok", "settings": get_settings().model_dump()}

set_embedding_router(app)
set_rerank_router(app)

if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run("src.main:app", host="0.0.0.0", port=settings.port)