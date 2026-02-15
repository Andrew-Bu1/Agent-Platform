from common import PostgresClient

class ModelUsageRepository:
    def __init__(self, db: PostgresClient):
        self._db = db

    async def log_usage(
        self,
        model_id: str,
        input_tokens: int,
        output_tokens: int,
        total_tokens: int,
        total_cost: float | None = None,
    ) -> None:
        await self._db.execute(
            """
            INSERT INTO model_usage_logs (
                model_id,
                input_tokens,
                output_tokens,
                total_tokens,
                total_cost
            ) VALUES ($1, $2, $3, $4, $5)
            """,
            model_id,
            input_tokens,
            output_tokens,
            total_tokens,
            total_cost,
        )
