package com.agentplatform.iam.api.auth;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;
import java.util.UUID;

/**
 * Response for POST /auth/login.
 * Always includes a short-lived {@code preAuthToken} (5 minutes).
 * <ul>
 *   <li>{@code requireTenantCreation=true}: user has no tenants yet — FE must call
 *       {@code POST /tenants/bootstrap} to create their first tenant + workspace.</li>
 *   <li>{@code requireTenantSelection=true}: multiple tenants — FE shows tenant picker.</li>
 *   <li>Both false: single tenant auto-resolved — FE can skip the picker.
 *       {@code tenantId} will be set to the resolved tenant.</li>
 * </ul>
 * After choosing a tenant, call {@code POST /auth/workspaces} to get that tenant's workspaces,
 * then call {@code POST /auth/switch-context} to get the full access token.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record LoginResponse(
        String preAuthToken,
        boolean requireTenantCreation,   // true = user has no tenants, must create one first
        boolean requireTenantSelection,
        UUID tenantId,           // set when requireTenantSelection=false and requireTenantCreation=false
        List<TenantInfo> tenants // set when requireTenantSelection=true
) {}
