from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from src.api.dependencies import get_caller_context, get_model_usage_log_repo
from src.models.auth import CallerContext
from src.repositories.model_usage_log import ModelUsageLogRepository


def router() -> APIRouter:
    r = APIRouter(prefix="/platform/analytics", tags=["analytics"])

    @r.get("/usage")
    async def usage_summary(
        tenant_id: UUID | None = Query(default=None),
        days: int = Query(default=30, ge=1, le=365),
        ctx: CallerContext = Depends(get_caller_context),
        repo: ModelUsageLogRepository = Depends(get_model_usage_log_repo),
    ):
        # Permission rules (sourced from permission-matrix.md):
        #   platform_admin  → model:manage   → may query any tenant or all tenants
        #   tenant_admin / workspace_owner → member:manage → may query own tenant only
        #   all others → 403
        is_platform_admin = "model:manage" in ctx.permissions
        is_tenant_manager = "member:manage" in ctx.permissions

        if not is_platform_admin and not is_tenant_manager:
            raise HTTPException(status_code=403, detail="Insufficient permissions for analytics")

        if not is_platform_admin:
            # Tenant-level callers are restricted to their own tenant.
            if tenant_id is None:
                # Implicitly scope to own tenant instead of returning all.
                tenant_id = ctx.tenant_id
            elif tenant_id != ctx.tenant_id:
                raise HTTPException(
                    status_code=403,
                    detail="platform_admin required to query another tenant's analytics",
                )

        return await repo.platform_analytics(tenant_id=tenant_id, days=days)

    return r
