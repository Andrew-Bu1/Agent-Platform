import asyncio
import time
from typing import Any
from uuid import UUID

import httpx
import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.algorithms import RSAAlgorithm

from src.models.auth import CallerContext

_bearer = HTTPBearer()


class JwksCache:
    """
    Fetches and caches RSA public keys from the IAM JWKS endpoint.
    Re-fetches through a serialized, rate-limited path when an unknown kid is
    encountered, which handles key rotation without polling.
    """

    def __init__(self, iam_base_url: str) -> None:
        self._url = f"{iam_base_url}/.well-known/jwks.json"
        self._keys: dict[str, Any] = {}
        self._load_lock = asyncio.Lock()
        self._last_fetch = 0.0

    async def load(self) -> None:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(self._url)
            resp.raise_for_status()
            data = resp.json()
        self._keys = {
            jwk["kid"]: RSAAlgorithm.from_jwk(jwk)
            for jwk in data.get("keys", [])
        }
        self._last_fetch = time.monotonic()

    async def get_key(self, kid: str) -> Any | None:
        if kid in self._keys:
            return self._keys[kid]

        async with self._load_lock:
            if kid in self._keys:
                return self._keys[kid]
            if time.monotonic() - self._last_fetch < 60:
                return None
            await self.load()
        return self._keys.get(kid)


async def get_caller_context(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> CallerContext:
    token = credentials.credentials

    try:
        header = jwt.get_unverified_header(token)
    except jwt.DecodeError:
        raise HTTPException(status_code=401, detail="Malformed token")

    kid = header.get("kid")
    if not kid:
        raise HTTPException(status_code=401, detail="Token missing key ID")

    jwks: JwksCache = request.app.state.jwks_cache
    public_key = await jwks.get_key(kid)
    if public_key is None:
        raise HTTPException(status_code=401, detail="Unknown signing key")

    iam_cfg = request.app.state.iam_config
    try:
        claims = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=iam_cfg.audience,
            issuer=iam_cfg.issuer,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    tenant_id_raw = claims.get("tenant_id")
    if not tenant_id_raw:
        raise HTTPException(status_code=401, detail="Token missing tenant_id claim")

    workspace_id_raw = claims.get("workspace_id")

    return CallerContext(
        subject=claims["sub"],
        tenant_id=UUID(tenant_id_raw),
        workspace_id=UUID(workspace_id_raw) if workspace_id_raw else None,
        caller_type=claims.get("type", "user"),
        bearer_token=credentials.credentials,
        permissions=claims.get("permissions", []),
    )
