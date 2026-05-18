"""Shared pytest fixtures for aihub unit tests.

The test app wires up the analytics router (and others as needed) with
dependency overrides so no real DB / Redis / IAM is required.
"""
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

from src.api import analytics as analytics_api
from src.api.dependencies import get_caller_context, get_model_usage_log_repo
from src.models.auth import CallerContext


PLATFORM_TENANT_ID    = UUID("00000000-0000-0000-0003-000000000001")
PLATFORM_WORKSPACE_ID = UUID("00000000-0000-0000-0005-000000000001")
OTHER_TENANT_ID       = UUID("11111111-1111-1111-1111-111111111111")

PLATFORM_ADMIN_PERMS  = ["model:manage", "member:manage", "agent:run"]
TENANT_ADMIN_PERMS    = ["member:manage", "agent:run"]
WORKSPACE_MEMBER_PERMS = ["agent:run"]


def make_caller(tenant_id: UUID, permissions: list[str]) -> CallerContext:
    return CallerContext(
        subject=str(UUID("00000000-0000-0000-0002-000000000001")),
        tenant_id=tenant_id,
        workspace_id=PLATFORM_WORKSPACE_ID,
        caller_type="user",
        bearer_token="test-token",
        permissions=permissions,
    )


def analytics_summary_stub() -> dict:
    return {
        "totals": {
            "request_count": 100,
            "input_tokens": 50000,
            "output_tokens": 10000,
            "cost": "1.5000",
            "avg_latency_ms": 800,
            "success_count": 95,
            "failed_count": 3,
            "rejected_count": 2,
            "timeout_count": 0,
        },
        "by_model": [],
        "by_tenant": [],
    }


@pytest.fixture
def mock_usage_repo():
    repo = MagicMock()
    repo.platform_analytics = AsyncMock(return_value=analytics_summary_stub())
    return repo


def build_test_app(caller: CallerContext, usage_repo) -> FastAPI:
    app = FastAPI()
    app.include_router(analytics_api.router(), prefix="/v1")

    app.dependency_overrides[get_caller_context]        = lambda: caller
    app.dependency_overrides[get_model_usage_log_repo]  = lambda: usage_repo

    return app


@pytest.fixture
def platform_admin_caller():
    return make_caller(PLATFORM_TENANT_ID, PLATFORM_ADMIN_PERMS)


@pytest.fixture
def tenant_admin_caller():
    return make_caller(PLATFORM_TENANT_ID, TENANT_ADMIN_PERMS)


@pytest.fixture
def member_caller():
    return make_caller(PLATFORM_TENANT_ID, WORKSPACE_MEMBER_PERMS)


@pytest.fixture
def other_tenant_caller():
    return make_caller(OTHER_TENANT_ID, TENANT_ADMIN_PERMS)
