from uuid import UUID, uuid4

from common.postgres import PostgresClient

from src.models.model_config import ModelUsageLog


class ModelUsageLogRepository:
    def __init__(self, db: PostgresClient) -> None:
        self._db = db

    async def create(self, log: ModelUsageLog) -> None:
        await self._db.execute(
            """
            INSERT INTO model_usage_logs (
                id, tenant_id, workspace_id, user_id, service_client_id,
                model_id, model_key, operation_type,
                input_tokens, output_tokens, cost,
                status, error_message, latency_ms
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8,
                $9, $10, $11,
                $12, $13, $14
            )
            """,
            uuid4(),
            log.tenant_id,
            log.workspace_id,
            log.user_id,
            log.service_client_id,
            log.model_id,
            log.model_key,
            log.operation_type,
            log.input_tokens,
            log.output_tokens,
            log.cost,
            log.status,
            log.error_message,
            log.latency_ms,
        )

    async def list(
        self,
        tenant_id: UUID | None = None,
        model_id: UUID | None = None,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict]:
        conditions: list[str] = []
        args: list = []

        if tenant_id is not None:
            args.append(tenant_id)
            conditions.append(f"tenant_id = ${len(args)}")
        if model_id is not None:
            args.append(model_id)
            conditions.append(f"model_id = ${len(args)}")
        if status is not None:
            args.append(status)
            conditions.append(f"status = ${len(args)}")

        where = f" WHERE {' AND '.join(conditions)}" if conditions else ""
        args.extend([limit, offset])
        rows = await self._db.fetch(
            f"SELECT id, tenant_id, workspace_id, user_id, service_client_id, "
            f"model_id, model_key, operation_type, "
            f"input_tokens, output_tokens, cost, status, latency_ms, created_at "
            f"FROM model_usage_logs{where} "
            f"ORDER BY created_at DESC "
            f"LIMIT ${len(args) - 1} OFFSET ${len(args)}",
            *args,
        )
        return [dict(r) for r in rows]
