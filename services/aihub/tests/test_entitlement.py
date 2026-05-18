"""Unit tests for EntitlementGuard permission logic.

These test the in-memory cache hit/miss logic and the entitlement filtering
without making real HTTP calls to IAM or Redis.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

from src.services.entitlement import EntitlementGuard


TENANT_A = UUID("aaaaaaaa-0000-0000-0000-000000000001")
TENANT_B = UUID("bbbbbbbb-0000-0000-0000-000000000001")

ENTITLEMENTS_TENANT_A = [
    {"model_key": "claude-3-5-sonnet", "operation_type": "chat",  "allowed": True,  "rpm_limit": 60,  "tpm_limit": 100000, "daily_token_limit": None, "monthly_token_limit": None},
    {"model_key": "bge-m3",            "operation_type": "embed", "allowed": True,  "rpm_limit": 120, "tpm_limit": None,   "daily_token_limit": None, "monthly_token_limit": None},
    {"model_key": "gpt-4o",            "operation_type": "chat",  "allowed": False, "rpm_limit": 0,   "tpm_limit": None,   "daily_token_limit": None, "monthly_token_limit": None},
]


@pytest.fixture
def mock_redis():
    r = MagicMock()
    r.get  = AsyncMock(return_value=None)
    r.setex = AsyncMock()
    return r


@pytest.fixture
def guard(mock_redis):
    g = EntitlementGuard(iam_base_url="http://iam:8080", redis=mock_redis)
    return g


# ── get_allowed_keys ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_allowed_keys_returns_only_allowed(guard):
    with patch.object(guard, "_fetch_from_iam", new=AsyncMock(return_value=ENTITLEMENTS_TENANT_A)):
        keys = await guard.get_allowed_keys(TENANT_A, "bearer-token")

    # claude-3-5-sonnet:chat and bge-m3:embed are allowed; gpt-4o:chat is not
    assert ("claude-3-5-sonnet", "chat")  in keys
    assert ("bge-m3",            "embed") in keys
    assert ("gpt-4o",            "chat")  not in keys


@pytest.mark.asyncio
async def test_get_allowed_keys_excludes_disallowed(guard):
    with patch.object(guard, "_fetch_from_iam", new=AsyncMock(return_value=ENTITLEMENTS_TENANT_A)):
        keys = await guard.get_allowed_keys(TENANT_A, "bearer-token")

    assert len(keys) == 2


# ── get_entitlement ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_entitlement_returns_correct_limits(guard):
    with patch.object(guard, "_fetch_from_iam", new=AsyncMock(return_value=ENTITLEMENTS_TENANT_A)):
        ent = await guard.get_entitlement(TENANT_A, "claude-3-5-sonnet", "chat", "bearer-token")

    assert ent is not None
    assert ent["rpm_limit"] == 60
    assert ent["tpm_limit"] == 100000
    assert ent["allowed"] is True


@pytest.mark.asyncio
async def test_get_entitlement_returns_none_for_unknown_model(guard):
    with patch.object(guard, "_fetch_from_iam", new=AsyncMock(return_value=ENTITLEMENTS_TENANT_A)):
        ent = await guard.get_entitlement(TENANT_A, "unknown-model", "chat", "bearer-token")

    assert ent is None


@pytest.mark.asyncio
async def test_get_entitlement_blocked_model_has_allowed_false(guard):
    with patch.object(guard, "_fetch_from_iam", new=AsyncMock(return_value=ENTITLEMENTS_TENANT_A)):
        ent = await guard.get_entitlement(TENANT_A, "gpt-4o", "chat", "bearer-token")

    assert ent is not None
    assert ent["allowed"] is False


# ── Cache behaviour ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_iam_called_only_once_within_ttl(guard):
    fetch_mock = AsyncMock(return_value=ENTITLEMENTS_TENANT_A)
    with patch.object(guard, "_fetch_from_iam", new=fetch_mock):
        await guard.get_allowed_keys(TENANT_A, "bearer-token")
        await guard.get_allowed_keys(TENANT_A, "bearer-token")
        await guard.get_allowed_keys(TENANT_A, "bearer-token")

    # IAM should be contacted only once; subsequent calls hit the in-memory cache
    fetch_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_different_tenants_have_independent_caches(guard):
    fetch_mock = AsyncMock(return_value=ENTITLEMENTS_TENANT_A)
    with patch.object(guard, "_fetch_from_iam", new=fetch_mock):
        await guard.get_allowed_keys(TENANT_A, "bearer-a")
        await guard.get_allowed_keys(TENANT_B, "bearer-b")

    # One call per tenant
    assert fetch_mock.await_count == 2


@pytest.mark.asyncio
async def test_cache_invalidated_after_ttl(guard):
    """Simulate cache expiry by manually clearing the internal cache."""
    fetch_mock = AsyncMock(return_value=ENTITLEMENTS_TENANT_A)
    with patch.object(guard, "_fetch_from_iam", new=fetch_mock):
        await guard.get_allowed_keys(TENANT_A, "bearer-token")

        # Simulate TTL expiry by clearing the cache
        guard._cache.clear()

        await guard.get_allowed_keys(TENANT_A, "bearer-token")

    assert fetch_mock.await_count == 2
