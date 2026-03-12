from uuid import UUID, uuid4

from common.postgres import PostgresClient

from src.models.model_config import ModelUsageLog


class ModelUsageLogRepository:
    def __init__(self, db: PostgresClient) -> None:
        self._db = db

    async def create(self, log: ModelUsageLog) -> None:
        await self._db.execute(
            "INSERT INTO model_usage_logs "
            "(id, model_id, input_tokens, output_tokens, cost, status) "
            "VALUES ($1, $2, $3, $4, $5, $6)",
            uuid4(),
            log.model_id,
            log.input_tokens,
            log.output_tokens,
            log.cost,
            log.status,
        )

    async def list(
        self,
        model_id: UUID | None = None,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict]:
        conditions: list[str] = []
        args: list = []

        if model_id is not None:
            args.append(model_id)
            conditions.append(f"model_id = ${len(args)}")
        if status is not None:
            args.append(status)
            conditions.append(f"status = ${len(args)}")

        where = f" WHERE {' AND '.join(conditions)}" if conditions else ""
        args.extend([limit, offset])
        rows = await self._db.fetch(
            f"SELECT id, model_id, input_tokens, output_tokens, cost, status, created_at "
            f"FROM model_usage_logs{where} "
            f"ORDER BY created_at DESC "
            f"LIMIT ${len(args) - 1} OFFSET ${len(args)}",
            *args,
        )
        return [dict(r) for r in rows]
