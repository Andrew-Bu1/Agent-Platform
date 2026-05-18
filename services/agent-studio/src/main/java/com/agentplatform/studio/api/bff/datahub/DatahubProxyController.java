package com.agentplatform.studio.api.bff.datahub;

import com.agentplatform.common.security.AuthContext;
import com.agentplatform.common.web.ApiResponse;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

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
    public ApiResponse<JsonNode> listDatasources(@AuthenticationPrincipal AuthContext auth) {
        return ApiResponse.ok(datahubProxy.get("/datasources"));
    }

    @GetMapping("/datasources/{id}")
    public ApiResponse<JsonNode> getDatasource(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return ApiResponse.ok(datahubProxy.get("/datasources/" + id));
    }

    @PostMapping("/datasources")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<JsonNode> createDatasource(@AuthenticationPrincipal AuthContext auth,
                                     @RequestBody JsonNode body) {
        return ApiResponse.ok(datahubProxy.post("/datasources", body));
    }

    @PutMapping("/datasources/{id}")
    public ApiResponse<JsonNode> updateDatasource(@AuthenticationPrincipal AuthContext auth,
                                     @PathVariable UUID id,
                                     @RequestBody JsonNode body) {
        return ApiResponse.ok(datahubProxy.put("/datasources/" + id, body));
    }

    @DeleteMapping("/datasources/{id}")
    public ApiResponse<JsonNode> deleteDatasource(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return ApiResponse.ok(datahubProxy.delete("/datasources/" + id));
    }

    // ── Documents ─────────────────────────────────────────────────────────────

    @GetMapping("/datasources/{datasourceId}/documents")
    public ApiResponse<JsonNode> listDocuments(@AuthenticationPrincipal AuthContext auth,
                                  @PathVariable UUID datasourceId) {
        return ApiResponse.ok(datahubProxy.get("/datasources/" + datasourceId + "/documents"));
    }

    @PostMapping(value = "/datasources/{datasourceId}/documents", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<JsonNode> uploadDocument(@AuthenticationPrincipal AuthContext auth,
                                   @PathVariable UUID datasourceId,
                                   @RequestParam("file") MultipartFile file,
                                   @RequestParam(value = "metadata", required = false) String metadata) {
        return ApiResponse.ok(datahubProxy.uploadMultipart("/datasources/" + datasourceId + "/documents", file, metadata));
    }

    @GetMapping("/documents/{id}")
    public ApiResponse<JsonNode> getDocument(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return ApiResponse.ok(datahubProxy.get("/documents/" + id));
    }

    @PutMapping("/documents/{id}")
    public ApiResponse<JsonNode> updateDocument(@AuthenticationPrincipal AuthContext auth,
                                   @PathVariable UUID id,
                                   @RequestBody JsonNode body) {
        return ApiResponse.ok(datahubProxy.put("/documents/" + id, body));
    }

    @DeleteMapping("/documents/{id}")
    public ApiResponse<JsonNode> deleteDocument(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return ApiResponse.ok(datahubProxy.delete("/documents/" + id));
    }

    // ── Ingestions ────────────────────────────────────────────────────────────

    @PostMapping("/documents/{documentId}/ingestions")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<JsonNode> createIngestion(@AuthenticationPrincipal AuthContext auth,
                                    @PathVariable UUID documentId,
                                    @RequestBody JsonNode body) {
        return ApiResponse.ok(datahubProxy.post("/documents/" + documentId + "/ingestions", body));
    }

    @GetMapping("/documents/{documentId}/ingestions")
    public ApiResponse<JsonNode> listIngestions(@AuthenticationPrincipal AuthContext auth,
                                   @PathVariable UUID documentId) {
        return ApiResponse.ok(datahubProxy.get("/documents/" + documentId + "/ingestions"));
    }

    @GetMapping("/ingestions/{id}")
    public ApiResponse<JsonNode> getIngestion(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return ApiResponse.ok(datahubProxy.get("/ingestions/" + id));
    }

    @DeleteMapping("/ingestions/{id}")
    public ApiResponse<JsonNode> deleteIngestion(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return ApiResponse.ok(datahubProxy.delete("/ingestions/" + id));
    }

    // ── Chunks ────────────────────────────────────────────────────────────────

    @GetMapping("/ingestions/{ingestionId}/chunks")
    public ApiResponse<JsonNode> listChunks(@AuthenticationPrincipal AuthContext auth,
                               @PathVariable UUID ingestionId) {
        return ApiResponse.ok(datahubProxy.get("/ingestions/" + ingestionId + "/chunks"));
    }

    @GetMapping("/chunks/{id}")
    public ApiResponse<JsonNode> getChunk(@AuthenticationPrincipal AuthContext auth, @PathVariable UUID id) {
        return ApiResponse.ok(datahubProxy.get("/chunks/" + id));
    }

    // ── Search ────────────────────────────────────────────────────────────────

    @PostMapping("/datasources/{datasourceId}/search")
    public ApiResponse<JsonNode> search(@AuthenticationPrincipal AuthContext auth,
                           @PathVariable UUID datasourceId,
                           @RequestBody JsonNode body) {
        return ApiResponse.ok(datahubProxy.post("/datasources/" + datasourceId + "/search", body));
    }

    // ── DLQ Admin ─────────────────────────────────────────────────────────────

    @GetMapping("/ingestions/dlq")
    public ApiResponse<JsonNode> listDlq(@AuthenticationPrincipal AuthContext auth,
                             @RequestParam(value = "limit", required = false, defaultValue = "100") int limit) {
        return ApiResponse.ok(datahubProxy.get("/ingestions/dlq?limit=" + limit));
    }

    @PostMapping("/ingestions/dlq/replay")
    public ApiResponse<JsonNode> replayDlq(@AuthenticationPrincipal AuthContext auth) {
        return ApiResponse.ok(datahubProxy.post("/ingestions/dlq/replay", null));
    }

    @DeleteMapping("/ingestions/dlq")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clearDlq(@AuthenticationPrincipal AuthContext auth) {
        datahubProxy.delete("/ingestions/dlq");
    }
}
