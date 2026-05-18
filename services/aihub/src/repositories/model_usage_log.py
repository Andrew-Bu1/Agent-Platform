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

    async def platform_analytics(
        self,
        tenant_id: UUID | None = None,
        days: int = 30,
    ) -> dict:
        """Aggregate usage stats for platform admins. tenant_id=None means all tenants."""
        base_where = "WHERE created_at >= NOW() - ($1 || ' days')::INTERVAL"
        args_base: list = [str(days)]

        if tenant_id is not None:
            base_where += " AND tenant_id = $2"
            args_base.append(tenant_id)

        # overall totals
        totals_row = await self._db.fetch(
            f"""
            SELECT
                COUNT(*)                                            AS request_count,
                COALESCE(SUM(input_tokens),  0)                    AS input_tokens,
                COALESCE(SUM(output_tokens), 0)                    AS output_tokens,
                COALESCE(SUM(cost::numeric), 0)                    AS cost,
                COALESCE(AVG(latency_ms), 0)                       AS avg_latency_ms,
                COUNT(*) FILTER (WHERE status = 'success')         AS success_count,
                COUNT(*) FILTER (WHERE status = 'failed')          AS failed_count,
                COUNT(*) FILTER (WHERE status = 'rejected')        AS rejected_count,
                COUNT(*) FILTER (WHERE status = 'timeout')         AS timeout_count
            FROM model_usage_logs {base_where}
            """,
            *args_base,
        )
        totals = dict(totals_row[0]) if totals_row else {}

        # by model + operation
        model_rows = await self._db.fetch(
            f"""
            SELECT
                model_key,
                operation_type,
                COUNT(*)                                            AS request_count,
                COALESCE(SUM(input_tokens),  0)                    AS input_tokens,
                COALESCE(SUM(output_tokens), 0)                    AS output_tokens,
                COALESCE(SUM(cost::numeric), 0)                    AS cost,
                COALESCE(AVG(latency_ms), 0)                       AS avg_latency_ms,
                COUNT(*) FILTER (WHERE status = 'success')         AS success_count,
                COUNT(*) FILTER (WHERE status != 'success')        AS error_count
            FROM model_usage_logs {base_where}
            GROUP BY model_key, operation_type
            ORDER BY input_tokens DESC
            """,
            *args_base,
        )

        # per-tenant breakdown (only when viewing all tenants)
        tenant_rows: list = []
        if tenant_id is None:
            tenant_rows = await self._db.fetch(
                f"""
                SELECT
                    tenant_id::text,
                    COUNT(*)                                        AS request_count,
                    COALESCE(SUM(input_tokens),  0)                AS input_tokens,
                    COALESCE(SUM(output_tokens), 0)                AS output_tokens,
                    COALESCE(SUM(cost::numeric), 0)                AS cost
                FROM model_usage_logs {base_where}
                GROUP BY tenant_id
                ORDER BY input_tokens DESC
                """,
                *args_base,
            )

        return {
            "totals": {k: float(v) if hasattr(v, "__float__") else v for k, v in totals.items()},
            "by_model": [dict(r) for r in model_rows],
            "by_tenant": [dict(r) for r in tenant_rows],
        }

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
