from common import PostgresClient

class ModelConfigRepository:
    def __init__(self, db: PostgresClient):
        self._db = db

    async def get_model_config(self, model_id: str):
        return await self._db.fetchrow(
            "SELECT * FROM model_configs WHERE model_id = $1",
            model_id,
        )
