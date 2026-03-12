from fastapi import Request

from src.repositories.model_config import ModelConfigRepository
from src.repositories.model_usage_log import ModelUsageLogRepository
from src.services.router import ServiceRouter


def get_service_router(request: Request) -> ServiceRouter:
    return request.app.state.service_router


def get_model_config_repo(request: Request) -> ModelConfigRepository:
    return request.app.state.model_config_repo


def get_model_usage_log_repo(request: Request) -> ModelUsageLogRepository:
    return request.app.state.model_usage_log_repo
