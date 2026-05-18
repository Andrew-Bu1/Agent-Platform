import time
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

import httpx
from fastapi import HTTPException

from common.redis import RedisClient

# ── Feature entitlements ──────────────────────────────────────────────────────

_FeatureSet = set[str]


class FeatureCache:
    """Fetches enabled feature keys from IAM and caches them per tenant for 5 minutes."""

    _TTL = 300.0

    def __init__(self, iam_base_url: str) -> None:
        self._url = f"{iam_base_url}/entitlements/features"
        self._store: dict[str, tuple[float, _FeatureSet]] = {}

    async def get(self, tenant_id: UUID, bearer_token: str) -> _FeatureSet:
        key = str(tenant_id)
        now = time.monotonic()

        if key in self._store:
            fetched_at, data = self._store[key]
            if now - fetched_at < self._TTL:
                return data

        async with httpx.AsyncClient(timeout=5) as client:
            try:
                resp = await client.get(
                    self._url,
                    headers={"Authorization": f"Bearer {bearer_token}"},
                )
                resp.raise_for_status()
                body = resp.json()
                entries: list[dict] = body.get("data", [])
                data = {e["featureKey"] for e in entries if e.get("enabled")}
            except Exception:
                # Fail open: if IAM is unreachable, do not block the request.
                data = set()

        self._store[key] = (now, data)
        return data


class FeatureGuard:
    """Raises HTTP 403 when the tenant does not have a required feature enabled."""

    def __init__(self, iam_base_url: str) -> None:
        self._cache = FeatureCache(iam_base_url)

    async def require(self, tenant_id: UUID, bearer_token: str, feature_key: str) -> None:
        enabled = await self._cache.get(tenant_id, bearer_token)
        if feature_key not in enabled:
            raise HTTPException(
                status_code=403,
                detail=f"Feature not enabled for this tenant: '{feature_key}'",
            )


@dataclass
class Entitlement:
    model_key: str
    operation_type: str
    allowed: bool
    rpm_limit: int | None
    tpm_limit: int | None
    daily_token_limit: int | None
    monthly_token_limit: int | None


# (model_key, operation_type) -> Entitlement
_EntitlementMap = dict[tuple[str, str], Entitlement]


class EntitlementCache:
    """Fetches model entitlements from IAM and caches them per tenant for 5 minutes."""

    _TTL = 300.0  # seconds

    def __init__(self, iam_base_url: str) -> None:
        self._url = f"{iam_base_url}/entitlements/models"
        # tenant_id (str) -> (fetched_at monotonic, entitlement map)
        self._store: dict[str, tuple[float, _EntitlementMap]] = {}

    async def get(self, tenant_id: UUID, bearer_token: str) -> _EntitlementMap:
        key = str(tenant_id)
        now = time.monotonic()

        if key in self._store:
            fetched_at, data = self._store[key]
            if now - fetched_at < self._TTL:
                return data

        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                self._url,
                headers={"Authorization": f"Bearer {bearer_token}"},
            )
            resp.raise_for_status()
            body = resp.json()

        entries: list[dict] = body.get("data", [])
        data = {
            (e["modelKey"], e["operationType"]): Entitlement(
                model_key=e["modelKey"],
                operation_type=e["operationType"],
                allowed=e["allowed"],
                rpm_limit=e.get("rpmLimit"),
                tpm_limit=e.get("tpmLimit"),
                daily_token_limit=e.get("dailyTokenLimit"),
                monthly_token_limit=e.get("monthlyTokenLimit"),
            )
            for e in entries
        }
        self._store[key] = (now, data)
        return data

    def invalidate(self, tenant_id: UUID) -> None:
        self._store.pop(str(tenant_id), None)


class EntitlementGuard:
    """
    Enforces model entitlements and rate limits.

    Before a call  → check allowed + RPM + current TPM/daily/monthly counters.
    After a call   → increment TPM/daily/monthly with actual tokens (best-effort).

    Trade-off: token counters (TPM, daily, monthly) are checked against completed-request
    totals, so concurrent in-flight requests may slightly overshoot limits within one
    request window. This is accepted to avoid output-token pre-estimation complexity.
    """

    def __init__(self, iam_base_url: str, redis: RedisClient) -> None:
        self._cache = EntitlementCache(iam_base_url)
        self._redis = redis

    async def get_allowed_keys(self, tenant_id: UUID, bearer_token: str) -> set[tuple[str, str]]:
        """Return the set of (model_key, operation_type) pairs the tenant is allowed to use."""
        entitlements = await self._cache.get(tenant_id, bearer_token)
        return {key for key, ent in entitlements.items() if ent.allowed}

    async def check_before_call(
        self,
        tenant_id: UUID,
        model_key: str,
        operation_type: str,
        bearer_token: str,
    ) -> None:
        entitlements = await self._cache.get(tenant_id, bearer_token)
        ent = entitlements.get((model_key, operation_type))

        if ent is None or not ent.allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Tenant is not entitled to use model '{model_key}' for '{operation_type}'",
            )

        # RPM — increment before the call so in-flight requests count toward the limit.
        if ent.rpm_limit is not None:
            rpm_key = f"aihub:rpm:{tenant_id}:{model_key}:{operation_type}"
            count = await self._redis.client.incr(rpm_key)
            if count == 1:
                await self._redis.client.expire(rpm_key, 60)
            if count > ent.rpm_limit:
                raise HTTPException(status_code=429, detail="RPM limit exceeded")

        # TPM / daily / monthly — read current totals; increment happens after the call.
        if ent.tpm_limit is not None:
            minute = int(time.time() // 60)
            tpm_key = f"aihub:tpm:{tenant_id}:{model_key}:{operation_type}:{minute}"
            current = await self._redis.client.get(tpm_key)
            if current is not None and int(current) >= ent.tpm_limit:
                raise HTTPException(status_code=429, detail="TPM limit exceeded")

        if ent.daily_token_limit is not None:
            day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            daily_key = f"aihub:daily:{tenant_id}:{model_key}:{operation_type}:{day}"
            current = await self._redis.client.get(daily_key)
            if current is not None and int(current) >= ent.daily_token_limit:
                raise HTTPException(status_code=429, detail="Daily token limit exceeded")

        if ent.monthly_token_limit is not None:
            month = datetime.now(timezone.utc).strftime("%Y-%m")
            monthly_key = f"aihub:monthly:{tenant_id}:{model_key}:{operation_type}:{month}"
            current = await self._redis.client.get(monthly_key)
            if current is not None and int(current) >= ent.monthly_token_limit:
                raise HTTPException(status_code=429, detail="Monthly token limit exceeded")

    async def record_usage(
        self,
        tenant_id: UUID,
        model_key: str,
        operation_type: str,
        total_tokens: int,
    ) -> None:
        if total_tokens <= 0:
            return

        minute = int(time.time() // 60)
        day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        month = datetime.now(timezone.utc).strftime("%Y-%m")

        tpm_key = f"aihub:tpm:{tenant_id}:{model_key}:{operation_type}:{minute}"
        daily_key = f"aihub:daily:{tenant_id}:{model_key}:{operation_type}:{day}"
        monthly_key = f"aihub:monthly:{tenant_id}:{model_key}:{operation_type}:{month}"

        try:
            async with self._redis.client.pipeline(transaction=False) as pipe:
                pipe.incrby(tpm_key, total_tokens)
                pipe.expire(tpm_key, 120)        # covers current + next minute bucket
                pipe.incrby(daily_key, total_tokens)
                pipe.expire(daily_key, 90000)    # 25 hours (outlives the UTC day)
                pipe.incrby(monthly_key, total_tokens)
                pipe.expire(monthly_key, 2764800)  # 32 days (outlives the month)
                await pipe.execute()
        except Exception:
            pass  # usage recording is best-effort; do not fail the API response
