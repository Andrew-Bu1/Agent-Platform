from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from common.logger import get_logger

from src.api.dependencies import get_caller_context, get_service_router
from src.middleware.auth import CallerContext
from src.models.chat import ChatResponse
from src.services.router import ServiceRouter


class ChatRequest(BaseModel):
    model: str
    messages: list[dict[str, Any]]
    stream: bool = False
    tools: list[dict[str, Any]] | None = None
    tool_choice: str | dict[str, Any] | None = None


def router() -> APIRouter:
    r = APIRouter(tags=["chat"])
    logger = get_logger(__name__)

    @r.post("/chat")
    async def chat(
        request: ChatRequest,
        service_router: ServiceRouter = Depends(get_service_router),
        ctx: CallerContext = Depends(get_caller_context),
    ):
        logger.info(
            f"Chat request: model={request.model!r} stream={request.stream} "
            f"tools={len(request.tools) if request.tools else 0} "
            f"tenant={ctx.tenant_id}"
        )
        if request.stream:
            stream_gen = await service_router.chat_stream(
                request.model, request.messages, ctx,
                tools=request.tools, tool_choice=request.tool_choice,
            )
            return StreamingResponse(
                stream_gen,
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )
        return await service_router.chat(
            request.model, request.messages, ctx,
            tools=request.tools, tool_choice=request.tool_choice,
        )

    return r
