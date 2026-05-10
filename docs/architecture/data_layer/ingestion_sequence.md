# Data Layer — Ingestion Sequence

Full pipeline from document upload to searchable embeddings.
Three Redis queues, three worker types, one PostgreSQL pool, one MinIO bucket.

---

## Phase 1 — Document Upload (DataHub API)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant DH as DataHub API
    participant MinIO as MinIO
    participant PG as PostgreSQL
    participant Redis as Redis

    C->>DH: POST /datasources/{id}/documents (multipart/form-data)<br/>Authorization: Bearer <access_token>
    DH->>DH: verify JWT → extract tenant_id, workspace_id
    DH->>DH: verify datasource belongs to tenant/workspace
    DH->>DH: compute SHA-256 hash of file bytes
    DH->>PG: SELECT id FROM documents WHERE file_hash=$hash AND datasource_id=$id AND tenant_id=$t AND workspace_id=$w
    alt hash exists → duplicate
        PG-->>DH: existing document row
        DH-->>C: 409 Conflict
    else new file
        PG-->>DH: empty
        DH->>MinIO: PUT {datasource_id}/{document_id}/{filename}
        MinIO-->>DH: ok
        DH->>PG: INSERT documents {id, tenant_id, workspace_id, datasource_id, name, file_hash, storage_path, status=active}
        PG-->>DH: document row
        DH-->>C: 201 {document}
    end

    Note over C,DH: Separate request to trigger processing

    C->>DH: POST /documents/{doc_id}/ingestions {chunk_strategy, chunk_config, embedding_model}<br/>Authorization: Bearer <access_token>
    DH->>DH: verify document belongs to tenant/workspace
    DH->>PG: INSERT ingestions {id, tenant_id, workspace_id, document_id, chunk_strategy, chunk_config, embedding_model, status=pending}
    PG-->>DH: ingestion row
    DH->>Redis: RPush datahub:queue:ingestion {IngestionJob}
    DH-->>C: 202 Accepted {ingestion_id, status=pending}
```

---

## Phase 2 — IngestionWorker: Download + Parse

```mermaid
sequenceDiagram
    autonumber
    participant Redis as Redis<br/>datahub:queue:ingestion
    participant IW as IngestionWorker
    participant MinIO as MinIO
    participant PG as PostgreSQL
    participant CQ as Redis<br/>datahub:queue:chunking
    participant DLQ as Redis<br/>datahub:queue:dlq

    loop every job
        IW->>Redis: BLPop (5s timeout)
        Redis-->>IW: IngestionJob {ingestion_id, document_id, tenant_id, workspace_id, storage_path, filename, chunk_strategy, chunk_config, embedding_model}
        IW->>PG: UPDATE ingestions SET status=processing WHERE id=ingestion_id
        IW->>MinIO: GET {storage_path}
        MinIO-->>IW: file bytes

        IW->>IW: detect extension from filename
        alt .txt
            IW->>IW: bytes → string (trim)
        else .docx
            IW->>IW: unzip → parse word/document.xml → extract <w:t> text nodes
        else unsupported
            IW->>PG: UPDATE ingestions SET status=failed
            IW->>DLQ: RPush {queue, payload, error}
        end

        alt text is empty
            IW->>PG: UPDATE ingestions SET status=completed
            Note over IW: No chunks produced — pipeline ends here
        else text extracted
            IW->>CQ: RPush ChunkingJob {ingestion_id, document_id, tenant_id, workspace_id, text, chunk_strategy, chunk_config, embedding_model}
        end
    end
```

---

## Phase 3 — ChunkWorker: Split + Persist Chunks

```mermaid
sequenceDiagram
    autonumber
    participant CQ as Redis<br/>datahub:queue:chunking
    participant CW as ChunkWorker
    participant PG as PostgreSQL
    participant Redis as Redis<br/>(counters)
    participant EQ as Redis<br/>datahub:queue:embedding
    participant DLQ as Redis<br/>datahub:queue:dlq

    loop every job
        CW->>CQ: BLPop (5s timeout)
        CQ-->>CW: ChunkingJob

        CW->>PG: SELECT datasource_id FROM documents WHERE id=$doc AND tenant_id=$t AND workspace_id=$w
        PG-->>CW: datasource_id

        CW->>CW: instantiate chunker for strategy:
        Note over CW: fixed_size — split by rune count<br/>ChunkSize=512, ChunkOverlap=50
        Note over CW: recursive_split — split by separators<br/>ChunkSize=512, ChunkOverlap=50<br/>separators=["\n\n","\n",". "," ",""]
        Note over CW: semantic_chunking — TF-IDF cosine similarity<br/>MaxChunkSize=1024, SimilarityThreshold=0.4

        CW->>CW: chunk text → []Chunk{index, content}

        alt zero chunks produced
            CW->>PG: UPDATE ingestions SET status=completed
        else N chunks
            CW->>Redis: SET datahub:embed:remaining:{ingestion_id} = N
            Note over CW,Redis: Counter set BEFORE pushing jobs — prevents race where all<br/>embeds finish before counter is visible

            loop for each chunk
                CW->>PG: INSERT chunks {id, tenant_id, workspace_id, document_id, ingestion_id, chunk_index, content, metadata}<br/>ON CONFLICT (tenant_id, workspace_id, ingestion_id, chunk_index) DO NOTHING
                CW->>EQ: RPush EmbedJob {chunk_id, ingestion_id, tenant_id, workspace_id, datasource_id, content, embedding_model}
            end

            CW->>PG: UPDATE ingestions SET status=chunked
        end

        alt error at any step
            CW->>PG: UPDATE ingestions SET status=failed
            CW->>DLQ: RPush {queue, payload, error}
        end
    end
```

---

## Phase 4 — EmbedWorker: Vectorize + Store

```mermaid
sequenceDiagram
    autonumber
    participant EQ as Redis<br/>datahub:queue:embedding
    participant EW as EmbedWorker
    participant IAM as IAM Service
    participant AIHub as AIHub<br/>POST /v1/embed
    participant PG as PostgreSQL<br/>(dimension tables)
    participant Redis as Redis<br/>(counters)
    participant DLQ as Redis<br/>datahub:queue:dlq

    Note over EW,IAM: Token obtained once, cached until 30s before expiry
    EW->>IAM: POST /oauth/token {grant_type=client_credentials, client_id, client_secret}
    IAM-->>EW: {access_token, expires_in}

    loop every job
        EW->>EQ: BLPop (5s timeout)
        EQ-->>EW: EmbedJob {chunk_id, ingestion_id, tenant_id, workspace_id, datasource_id, content, embedding_model}

        EW->>AIHub: POST /v1/embed {model: embedding_model, input: [content]}<br/>Authorization: Bearer <access_token>
        AIHub-->>EW: {data: [{embedding: [f1, f2, ..., fN]}]}

        EW->>EW: determine table by vector length:
        Note over EW: len=384  → chunk_384dimension<br/>len=768  → chunk_768dimension<br/>len=1024 → chunk_1024dimension<br/>other    → error → DLQ

        EW->>PG: INSERT INTO chunk_{N}dimension {id, tenant_id, workspace_id, chunk_id, datasource_id, embedding=[f1,f2,...]}<br/>ON CONFLICT (id) DO NOTHING
        PG-->>EW: ok

        EW->>Redis: DECR datahub:embed:remaining:{ingestion_id}
        Redis-->>EW: remaining count

        alt remaining == 0
            EW->>PG: UPDATE ingestions SET status=completed
        end

        alt error (any step, including Redis decrement failure)
            EW->>DLQ: RPush {queue, payload, error}
            Note over EW: Any error (embed call, DB insert, or Redis decrement) returns the<br/>job to the DLQ for replay. The ingestion is not failed immediately.
        end
    end
```

---

## Full Pipeline at a Glance

```
Client
  │
  ├─ POST /datasources/{id}/documents    → MinIO + DB: document record
  │
  └─ POST /documents/{id}/ingestions     → DB: ingestion (pending)
                                          → Redis: IngestionJob
                                                        │
                                              IngestionWorker
                                              ├─ MinIO download
                                              ├─ parse text (.txt / .docx)
                                              └─ Redis: ChunkingJob (or → completed if empty)
                                                              │
                                                    ChunkWorker
                                                    ├─ fetch datasource_id (tenant-scoped)
                                                    ├─ split text by strategy
                                                    ├─ DB: INSERT N chunks
                                                    ├─ Redis: counter = N
                                                    ├─ Redis: N × EmbedJob
                                                    └─ DB: ingestion → chunked
                                                                    │
                                                            EmbedWorker (N concurrent)
                                                            ├─ IAM: /oauth/token (cached)
                                                            ├─ AIHub: /v1/embed → vector[dim]
                                                            ├─ DB: INSERT chunk_{dim}dimension
                                                            ├─ Redis: DECR counter
                                                            └─ if counter == 0 → DB: ingestion → completed
```

---

## Ingestion Status Lifecycle

```
pending → processing → chunked → completed
                    ↘               ↗
                      failed (any stage)
```

| Status | Set by | Condition |
|---|---|---|
| `pending` | DataHub API | On ingestion create |
| `processing` | IngestionWorker | Job dequeued |
| `completed` | IngestionWorker | Extracted text is empty |
| `chunked` | ChunkWorker | All chunks inserted + embed jobs queued |
| `completed` | EmbedWorker | Embed counter reaches 0 |
| `failed` | Any worker | Any unrecoverable error |

---

## Supported File Formats

| Extension | Parser | Notes |
|---|---|---|
| `.txt` | Direct bytes → string | Trimmed |
| `.docx` | ZIP → `word/document.xml` → `<w:t>` nodes | Concatenates all text runs |
| Other | Error | Ingestion fails immediately |
