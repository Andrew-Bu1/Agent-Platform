package com.agentplatform.studio.api.bff.iam;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.studio.service.IamProxyService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * BFF proxy for IAM service clients, exposed in the web app as client API keys.
 */
@RestController
@RequestMapping("/api/v1/service-clients")
@RequiredArgsConstructor
public class IamServiceClientController {

    private final IamProxyService iamProxy;

    @GetMapping
    public JsonNode list(@AuthenticationPrincipal AuthContext auth) {
        return iamProxy.authGet("/service-clients");
    }

    @GetMapping("/{id}")
    public JsonNode get(@AuthenticationPrincipal AuthContext auth,
                        @PathVariable String id) {
        return iamProxy.authGet("/service-clients/" + id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public JsonNode create(@AuthenticationPrincipal AuthContext auth,
                           @RequestBody JsonNode body) {
        return iamProxy.authPost("/service-clients", body);
    }

    @PatchMapping("/{id}")
    public JsonNode update(@AuthenticationPrincipal AuthContext auth,
                           @PathVariable String id,
                           @RequestBody JsonNode body) {
        return iamProxy.authPatch("/service-clients/" + id, body);
    }

    @PostMapping("/{id}/rotate-secret")
    public JsonNode rotateSecret(@AuthenticationPrincipal AuthContext auth,
                                 @PathVariable String id) {
        return iamProxy.authPost("/service-clients/" + id + "/rotate-secret", null);
    }

    @PatchMapping("/{id}/activate")
    public JsonNode activate(@AuthenticationPrincipal AuthContext auth,
                             @PathVariable String id) {
        return iamProxy.authPatch("/service-clients/" + id + "/activate", null);
    }

    @PatchMapping("/{id}/deactivate")
    public JsonNode deactivate(@AuthenticationPrincipal AuthContext auth,
                               @PathVariable String id) {
        return iamProxy.authPatch("/service-clients/" + id + "/deactivate", null);
    }

    @DeleteMapping("/{id}")
    public JsonNode delete(@AuthenticationPrincipal AuthContext auth,
                           @PathVariable String id) {
        return iamProxy.authDelete("/service-clients/" + id);
    }

    @GetMapping("/{id}/permissions")
    public JsonNode listPermissions(@AuthenticationPrincipal AuthContext auth,
                                    @PathVariable String id) {
        return iamProxy.authGet("/service-clients/" + id + "/permissions");
    }

    @PostMapping("/{id}/permissions")
    @ResponseStatus(HttpStatus.CREATED)
    public JsonNode assignPermission(@AuthenticationPrincipal AuthContext auth,
                                     @PathVariable String id,
                                     @RequestBody JsonNode body) {
        return iamProxy.authPost("/service-clients/" + id + "/permissions", body);
    }

    @DeleteMapping("/{id}/permissions/{permissionId}")
    public JsonNode revokePermission(@AuthenticationPrincipal AuthContext auth,
                                     @PathVariable String id,
                                     @PathVariable String permissionId) {
        return iamProxy.authDelete("/service-clients/" + id + "/permissions/" + permissionId);
    }
}
