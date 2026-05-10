package com.agentplatform.studio.api.bff.datahub;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.studio.service.DatahubProxyService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * BFF proxy for DataHub datasource, document, ingestion, chunk and search endpoints.
 * All routes require authentication (bearer forwarded to DataHub).
 */
@RestController
@RequestMapping("/api/v1/datahub")
@RequiredArgsConstructor
public class DatahubProxyController {

    private final DatahubProxyService datahubProxy;

    // ── Datasources ───────────────────────────────────────────────────────────

    @GetMapping("/datasources")
    public JsonNode listDatasources(@AuthenticationPrincipal AuthContext auth) {
        return datahubProxy.get("/datasources");
    }

    @GetMapping("/datasources/{id}")
    public JsonNode getDatasource(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return datahubProxy.get("/datasources/" + id);
    }

    @PostMapping("/datasources")
    @ResponseStatus(HttpStatus.CREATED)
    public JsonNode createDatasource(@AuthenticationPrincipal AuthContext auth,
                                     @RequestBody JsonNode body) {
        return datahubProxy.post("/datasources", body);
    }

    @PutMapping("/datasources/{id}")
    public JsonNode updateDatasource(@AuthenticationPrincipal AuthContext auth,
                                     @PathVariable UUID id,
                                     @RequestBody JsonNode body) {
        return datahubProxy.put("/datasources/" + id, body);
    }

    @DeleteMapping("/datasources/{id}")
    public JsonNode deleteDatasource(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return datahubProxy.delete("/datasources/" + id);
    }

    // ── Documents ─────────────────────────────────────────────────────────────

    @GetMapping("/datasources/{datasourceId}/documents")
    public JsonNode listDocuments(@AuthenticationPrincipal AuthContext auth,
                                  @PathVariable UUID datasourceId) {
        return datahubProxy.get("/datasources/" + datasourceId + "/documents");
    }

    @GetMapping("/documents/{id}")
    public JsonNode getDocument(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return datahubProxy.get("/documents/" + id);
    }

    @PutMapping("/documents/{id}")
    public JsonNode updateDocument(@AuthenticationPrincipal AuthContext auth,
                                   @PathVariable UUID id,
                                   @RequestBody JsonNode body) {
        return datahubProxy.put("/documents/" + id, body);
    }

    @DeleteMapping("/documents/{id}")
    public JsonNode deleteDocument(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return datahubProxy.delete("/documents/" + id);
    }

    // ── Ingestions ────────────────────────────────────────────────────────────

    @PostMapping("/documents/{documentId}/ingestions")
    @ResponseStatus(HttpStatus.CREATED)
    public JsonNode createIngestion(@AuthenticationPrincipal AuthContext auth,
                                    @PathVariable UUID documentId,
                                    @RequestBody JsonNode body) {
        return datahubProxy.post("/documents/" + documentId + "/ingestions", body);
    }

    @GetMapping("/documents/{documentId}/ingestions")
    public JsonNode listIngestions(@AuthenticationPrincipal AuthContext auth,
                                   @PathVariable UUID documentId) {
        return datahubProxy.get("/documents/" + documentId + "/ingestions");
    }

    @GetMapping("/ingestions/{id}")
    public JsonNode getIngestion(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return datahubProxy.get("/ingestions/" + id);
    }

    @DeleteMapping("/ingestions/{id}")
    public JsonNode deleteIngestion(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return datahubProxy.delete("/ingestions/" + id);
    }

    // ── Chunks ────────────────────────────────────────────────────────────────

    @GetMapping("/ingestions/{ingestionId}/chunks")
    public JsonNode listChunks(@AuthenticationPrincipal AuthContext auth,
                               @PathVariable UUID ingestionId) {
        return datahubProxy.get("/ingestions/" + ingestionId + "/chunks");
    }

    @GetMapping("/chunks/{id}")
    public JsonNode getChunk(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return datahubProxy.get("/chunks/" + id);
    }

    // ── Search ────────────────────────────────────────────────────────────────

    @PostMapping("/datasources/{datasourceId}/search")
    public JsonNode search(@AuthenticationPrincipal AuthContext auth,
                           @PathVariable UUID datasourceId,
                           @RequestBody JsonNode body) {
        return datahubProxy.post("/datasources/" + datasourceId + "/search", body);
    }
}
