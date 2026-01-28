from fastapi import FastAPI

app = FastAPI(
    title="AI Hub",
    description="API service for AI models including Embedding, Rerank",
    version="1.0.0",
    docs_url="/swagger",
)