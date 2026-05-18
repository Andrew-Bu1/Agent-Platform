import json
from dataclasses import dataclass, field
from uuid import UUID

from common.postgres import PostgresClient

_SELECT_FULL = (
    "SELECT id, provider_key, display_name, description, logo_url, base_url, adapter_type, "
    "config_json, is_active, sort_order, created_at, updated_at FROM providers"
)
_SELECT_LIST = (
    "SELECT id, provider_key, display_name, description, logo_url, base_url, adapter_type, "
    "config_json, is_active, sort_order, created_at, updated_at "
    "FROM providers ORDER BY sort_order ASC, display_name ASC"
)


@dataclass
class ProviderRecord:
    """Lightweight row used to build the adapter registry at startup."""
    id: UUID
    provider_key: str
    display_name: str
    base_url: str | None
    adapter_type: str
    config_json: dict = field(default_factory=dict)
    is_active: bool = True


def _parse_config(value) -> dict:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        return json.loads(value) if value else {}
    return {}


def _to_public(row: dict) -> dict:
    """Strip sensitive fields from a provider row before returning it to the API."""
    out = dict(row)
    config = _parse_config(out.pop("config_json", {}) or {})
    out["has_api_key"] = bool(config.get("api_key"))
    return out


class ProvidersRepository:
    def __init__(self, db: PostgresClient) -> None:
        self._db = db

    async def get_all_active(self) -> list[ProviderRecord]:
        rows = await self._db.fetch(
            "SELECT id, provider_key, display_name, base_url, adapter_type, config_json, is_active "
            "FROM providers WHERE is_active = TRUE"
        )
        return [
            ProviderRecord(
                id=r["id"],
                provider_key=r["provider_key"],
                display_name=r["display_name"],
                base_url=r["base_url"],
                adapter_type=r["adapter_type"],
                config_json=_parse_config(r["config_json"]),  # asyncpg returns JSONB as str
                is_active=r["is_active"],
            )
            for r in rows
        ]

    async def get_id_by_key(self, provider_key: str) -> UUID | None:
        rows = await self._db.fetch(
            "SELECT id FROM providers WHERE provider_key = $1 AND is_active = TRUE",
            provider_key,
        )
        return rows[0]["id"] if rows else None

    async def get_by_id(self, id: UUID) -> dict | None:
        rows = await self._db.fetch(f"{_SELECT_FULL} WHERE id = $1", id)
        return _to_public(dict(rows[0])) if rows else None

    async def list(self) -> list[dict]:
        rows = await self._db.fetch(_SELECT_LIST)
        return [_to_public(dict(r)) for r in rows]

    async def create(
        self,
        *,
        id: UUID,
        provider_key: str,
        display_name: str,
        description: str | None,
        logo_url: str | None,
        base_url: str | None,
        adapter_type: str,
        sort_order: int,
        config_json: dict,
    ) -> dict:
        import json
        rows = await self._db.fetch(
            """
            INSERT INTO providers
                (id, provider_key, display_name, description, logo_url, base_url, adapter_type, sort_order, config_json)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
            RETURNING id, provider_key, display_name, description, logo_url, base_url, adapter_type,
                      config_json, is_active, sort_order, created_at, updated_at
            """,
            id, provider_key, display_name, description, logo_url, base_url, adapter_type, sort_order,
            json.dumps(config_json),
        )
        return _to_public(dict(rows[0]))

    async def update(
        self,
        id: UUID,
        *,
        display_name: str | None,
        description: str | None,
        logo_url: str | None,
        base_url: str | None,
        adapter_type: str | None,
        is_active: bool | None,
        sort_order: int | None,
        config_json: dict | None,
    ) -> dict | None:
        import json
        sets = []
        params: list = [id]
        idx = 2

        for col, val in [
            ("display_name", display_name),
            ("description", description),
            ("logo_url", logo_url),
            ("base_url", base_url),
            ("adapter_type", adapter_type),
            ("is_active", is_active),
            ("sort_order", sort_order),
        ]:
            if val is not None:
                sets.append(f"{col} = ${idx}")
                params.append(val)
                idx += 1

        if config_json is not None:
            # Merge with existing config_json so other keys are preserved.
            sets.append(f"config_json = config_json || ${idx}::jsonb")
            params.append(json.dumps(config_json))
            idx += 1

        if not sets:
            return await self.get_by_id(id)

        sets.append("updated_at = NOW()")
        sql = (
            f"UPDATE providers SET {', '.join(sets)} WHERE id = $1 "
            "RETURNING id, provider_key, display_name, description, logo_url, base_url, adapter_type, "
            "config_json, is_active, sort_order, created_at, updated_at"
        )
        rows = await self._db.fetch(sql, *params)
        return _to_public(dict(rows[0])) if rows else None

    async def delete(self, id: UUID) -> bool:
        rows = await self._db.fetch(
            "DELETE FROM providers WHERE id = $1 RETURNING id", id
        )
        return len(rows) > 0
