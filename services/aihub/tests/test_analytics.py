"""Tests for GET /v1/platform/analytics/usage.

Covers:
  - RBAC: platform_admin, tenant_admin, workspace_member
  - tenant_id scoping rules
  - days query param validation
"""
import pytest
from httpx import ASGITransport, AsyncClient
from uuid import UUID

from tests.conftest import (
    PLATFORM_TENANT_ID,
    OTHER_TENANT_ID,
    build_test_app,
)


pytestmark = pytest.mark.asyncio


# ── Platform admin ───────────────────────────────────────────────────────────

async def test_platform_admin_no_tenant_filter(platform_admin_caller, mock_usage_repo):
    app = build_test_app(platform_admin_caller, mock_usage_repo)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/v1/platform/analytics/usage")

    assert resp.status_code == 200
    data = resp.json()
    assert "totals" in data
    assert data["totals"]["request_count"] == 100
    mock_usage_repo.platform_analytics.assert_awaited_once_with(tenant_id=None, days=30)


async def test_platform_admin_can_filter_any_tenant(platform_admin_caller, mock_usage_repo):
    other = str(OTHER_TENANT_ID)
    app = build_test_app(platform_admin_caller, mock_usage_repo)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/v1/platform/analytics/usage?tenant_id={other}")

    assert resp.status_code == 200
    mock_usage_repo.platform_analytics.assert_awaited_once_with(
        tenant_id=OTHER_TENANT_ID, days=30
    )


async def test_platform_admin_custom_days(platform_admin_caller, mock_usage_repo):
    app = build_test_app(platform_admin_caller, mock_usage_repo)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/v1/platform/analytics/usage?days=7")

    assert resp.status_code == 200
    mock_usage_repo.platform_analytics.assert_awaited_once_with(tenant_id=None, days=7)


# ── Tenant admin ─────────────────────────────────────────────────────────────

async def test_tenant_admin_auto_scoped_to_own_tenant(tenant_admin_caller, mock_usage_repo):
    app = build_test_app(tenant_admin_caller, mock_usage_repo)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/v1/platform/analytics/usage")

    assert resp.status_code == 200
    # Should auto-scope to caller's tenant
    mock_usage_repo.platform_analytics.assert_awaited_once_with(
        tenant_id=PLATFORM_TENANT_ID, days=30
    )


async def test_tenant_admin_can_query_own_tenant_explicitly(tenant_admin_caller, mock_usage_repo):
    app = build_test_app(tenant_admin_caller, mock_usage_repo)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/v1/platform/analytics/usage?tenant_id={PLATFORM_TENANT_ID}")

    assert resp.status_code == 200


async def test_tenant_admin_cannot_query_other_tenant(tenant_admin_caller, mock_usage_repo):
    other = str(OTHER_TENANT_ID)
    app = build_test_app(tenant_admin_caller, mock_usage_repo)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/v1/platform/analytics/usage?tenant_id={other}")

    assert resp.status_code == 403
    assert "platform_admin" in resp.json()["detail"].lower()


# ── Workspace member (no analytics permission) ───────────────────────────────

async def test_workspace_member_gets_403(member_caller, mock_usage_repo):
    app = build_test_app(member_caller, mock_usage_repo)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/v1/platform/analytics/usage")

    assert resp.status_code == 403
    mock_usage_repo.platform_analytics.assert_not_called()


# ── Query param validation ───────────────────────────────────────────────────

async def test_days_below_minimum_rejected(platform_admin_caller, mock_usage_repo):
    app = build_test_app(platform_admin_caller, mock_usage_repo)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/v1/platform/analytics/usage?days=0")

    assert resp.status_code == 422


async def test_days_above_maximum_rejected(platform_admin_caller, mock_usage_repo):
    app = build_test_app(platform_admin_caller, mock_usage_repo)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/v1/platform/analytics/usage?days=366")

    assert resp.status_code == 422


async def test_days_boundary_values(platform_admin_caller, mock_usage_repo):
    app = build_test_app(platform_admin_caller, mock_usage_repo)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r1 = await client.get("/v1/platform/analytics/usage?days=1")
        r2 = await client.get("/v1/platform/analytics/usage?days=365")

    assert r1.status_code == 200
    assert r2.status_code == 200


# ── Response shape ───────────────────────────────────────────────────────────

async def test_response_contains_expected_fields(platform_admin_caller, mock_usage_repo):
    app = build_test_app(platform_admin_caller, mock_usage_repo)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/v1/platform/analytics/usage")

    body = resp.json()
    assert "totals" in body
    assert "by_model" in body
    assert "by_tenant" in body

    totals = body["totals"]
    for field in ("request_count", "input_tokens", "output_tokens", "cost",
                  "success_count", "failed_count", "rejected_count"):
        assert field in totals, f"missing field: {field}"
