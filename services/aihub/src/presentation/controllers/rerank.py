from fastapi import FastAPI, APIRouter

def include_router(app: FastAPI) -> None:

    router = APIRouter(prefix="/rerank", tags=["Rerank Model"])

    @router.post("")
    async def rerank():
        return "rerank"
    
    app.include_router(router)

















