from fastapi import Request

from src.middleware.auth import get_caller_context as _get_caller_context
from src.repositories.model_config import ModelConfigRepository
from src.repositories.model_usage_log import ModelUsageLogRepository
from src.repositories.providers import ProvidersRepository
from src.services.router import ServiceRouter

# Re-export so endpoints import from one place.
get_caller_context = _get_caller_context


def get_service_router(request: Request) -> ServiceRouter:
    return request.app.state.service_router


def get_model_config_repo(request: Request) -> ModelConfigRepository:
    return request.app.state.model_config_repo


def get_model_usage_log_repo(request: Request) -> ModelUsageLogRepository:
    return request.app.state.model_usage_log_repo


def get_providers_repo(request: Request) -> ProvidersRepository:
    return request.app.state.providers_repo
