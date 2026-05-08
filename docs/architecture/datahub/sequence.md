# DataHub & Data-Worker — Features & Flow Sequences

## Features

---

### 1. DataHub API Service

DataHub is the HTTP-facing service that manages the full lifecycle of knowledge data — from raw file storage through to vector-indexed, searchable chunks. It is tenant-and-workspace scoped: every entity belongs to a `(tenant_id, workspace_id)` pair and queries are always filtered by both, preventing any cross-tenant data access.

#### 1.1 Datasource Management

A **datasource** is a named collection of documents, analogous to a folder or dataset. It is the top-level container that groups related documents and is the unit of access for vector search.

- **Create** — registers a new datasource with a name and optional description. A UUID v7 is generated as the primary key.
- **Get / List** — retrieves a single datasource by ID or lists all datasources belonging to the caller's tenant + workspace.
- **Update** — modifies the name or description of an existing datasource.
- **Delete** — removes the datasource record. All child documents, ingestions, chunks, and embeddings cascade-delete via database foreign keys.

Uniqueness is enforced at the `(tenant_id, workspace_id, name)` level — two workspaces inside the same tenant may reuse the same datasource name.

#### 1.2 Document Management

A **document** is a single uploaded file associated with a datasource. It carries the file's storage path in MinIO, a SHA-256 content hash for deduplication, and arbitrary JSON metadata for downstream use.

- **Upload (`multipart/form-data`)** — the handler reads the file bytes from the form, computes a SHA-256 hash, checks for an existing document with the same hash in the same datasource (`FindByHash`), and rejects with `409 Conflict` if a duplicate is found. On success, the file is uploaded to MinIO at path `<datasource_id>/<filename>` and the document record is persisted to `documents`.
- **List by datasource** — returns all documents belonging to a given datasource within the caller's tenant/workspace scope.
- **Get by ID** — retrieves a single document record.
- **Update** — allows modifying the `storage_path` (e.g., after a file migration) or `metadata` JSON.
- **Delete** — removes the document record; cascades to ingestions, chunks, and embeddings.

#### 1.3 Ingestion Management

An **ingestion** represents one processing run of a document: it pairs the document with a chunking strategy, a chunking config, and an embedding model. The same document can be ingested multiple times with different strategies or models.

- **Create (→ 202 Accepted)** — validates that `chunk_strategy` is one of `fixed_size`, `recursive_split`, or `semantic_chunking`; that `embedding_model` is non-empty; and that `chunk_config` is valid JSON. It inserts an ingestion record with `status = pending`, then publishes an `IngestionJob` to the Redis ingestion queue via `RPush`. Returns `202 Accepted` immediately — processing is asynchronous.
- **List by document** — returns all ingestion runs for a given document.
- **Get by ID** — retrieves a single ingestion record and its current status.
- **Delete** — removes the ingestion; cascades to chunks and embeddings.

**Status lifecycle** (after the fixes applied): `pending → processing → chunked → completed` (or `failed` at any stage).

#### 1.4 Chunk Management (read-only)

Chunks are produced exclusively by the `ChunkWorker`; the DataHub API exposes only read endpoints.

- **List by ingestion** — returns all chunks produced by a specific ingestion run, ordered by `chunk_index`.
- **Get by ID** — retrieves a single chunk with its `content` and `metadata`.

#### 1.5 Vector Search

The search endpoint performs an approximate nearest-neighbour cosine similarity search using **pgvector** against the pre-computed embedding tables.

- **Search** — accepts a raw `vector` (float array) and an optional `topK` (default 10). The vector length determines which dimension table to query (`chunk_384dimension`, `chunk_768dimension`, or `chunk_1024dimension`). The datasource ownership is verified first (tenant-scoped), then the query runs:
  ```sql
  SELECT chunk_id, content, (1 - (embedding <=> $vector)) AS score
  FROM chunk_<dim>dimension
  WHERE datasource_id=$1 AND tenant_id=$2 AND workspace_id=$3
  ORDER BY embedding <=> $vector
  LIMIT $topK
  ```
  Results are returned as `[{chunk_id, content, score}]` sorted by descending relevance.

**Design note:** the caller is expected to generate the query vector externally (e.g., by calling AIHub `/v1/embed`) before calling this endpoint. The API deliberately does not embed text inline to keep the service stateless with respect to AI models.

---

### 2. Data-Worker Service

Data-Worker is a background processing service with **no HTTP interface**. It runs three types of concurrent workers, each polling a Redis list queue. All workers share the same PostgreSQL pool and write results directly to the database. Worker concurrency is controlled by `WORKER_CONCURRENCY` (default 4), giving `3 × N` total goroutines.

#### 2.1 IngestionWorker

Responsible for the first stage of the pipeline: downloading the raw file from MinIO and extracting its plain text.

- Polls `datahub:queue:ingestion` via `BLPop` with a 5-second timeout.
- On dequeue, marks the ingestion as **`processing`** in the database immediately (prevents silent stalls from appearing as `pending`).
- Downloads the file bytes from MinIO using the `StoragePath` from the job.
- Detects file type from the `Filename` extension and dispatches to the appropriate parser:
  - `.txt` → direct byte-to-string conversion.
  - `.docx` → ZIP extraction → `word/document.xml` → XML unmarshal → concatenate `<w:t>` text nodes.
- If the extracted text is empty, the ingestion is silently skipped (no chunks produced).
- Pushes a `ChunkingJob` (carrying the raw text, strategy, config, model) to `datahub:queue:chunking`.
- On any error: marks ingestion as **`failed`** and pushes the raw payload to the dead-letter queue (`datahub:queue:dlq`).

#### 2.2 ChunkWorker

Responsible for splitting the extracted text into chunks and recording them in the database.

- Polls `datahub:queue:chunking` via `BLPop`.
- Fetches `datasource_id` from the `documents` table, **filtered by `tenant_id` AND `workspace_id`** (cross-tenant safety fix).
- Instantiates the correct chunker based on `chunk_strategy`:
  - **`fixed_size`** — splits text by rune count using `ChunkSize` runes per chunk and `ChunkOverlap` runes of overlap between adjacent chunks. Defaults: size=512, overlap=50.
  - **`recursive_split`** — recursively splits by a prioritised list of separators (`\n\n`, `\n`, `. `, ` `, `""`). Pieces still larger than `ChunkSize` are re-split with the next separator. Small pieces are merged with overlap. Defaults: size=512, overlap=50, standard separators.
  - **`semantic_chunking`** — splits into sentences, then merges adjacent sentences whose TF-weighted bag-of-words cosine similarity exceeds `SimilarityThreshold`, as long as the merged size stays within `MaxChunkSize`. Defaults: maxSize=1000, threshold=0.5.
- If the text produces **zero chunks** (e.g., blank document), marks ingestion as `completed` immediately and exits.
- Otherwise, sets a Redis counter `datahub:embed:remaining:<ingestion_id> = N` **before** pushing any embed jobs (avoids a race where all embeds complete before the counter is visible).
- For each chunk: inserts a row into `chunks` (with `chunk_index`, `content`, JSON metadata) and pushes an `EmbedJob` to `datahub:queue:embedding`.
- Updates ingestion status to **`chunked`** after all chunks are inserted and all embed jobs are queued.
- On error: marks ingestion as `failed` and pushes to DLQ.

#### 2.3 EmbedWorker

Responsible for generating embeddings via AIHub and storing them in the appropriate pgvector table.

- Polls `datahub:queue:embedding` via `BLPop`.
- Calls AIHub: `POST {AIHUB_URL}/v1/embed` with `{model, input: [chunk_text]}`. The HTTP client has a 60-second timeout.
- Determines the target table from the vector dimension returned:
  - 384 → `chunk_384dimension`
  - 768 → `chunk_768dimension`
  - 1024 → `chunk_1024dimension`
  - Any other dimension → error (pushed to DLQ).
- Inserts the embedding using pgvector's literal syntax (`[f1,f2,...]::vector`) with `ON CONFLICT (id) DO NOTHING` for idempotency.
- Decrements the Redis counter `datahub:embed:remaining:<ingestion_id>`. When the counter reaches **0**, all chunks for the ingestion have been embedded and the ingestion is updated to **`completed`**.
- On error: pushes the raw job payload to the DLQ. The ingestion is **not** immediately failed on a single embed error — only the counter increment is skipped, so a re-processed job can still complete it.

#### 2.4 Dead-Letter Queue

All three workers push failed payloads to `datahub:queue:dlq` (configurable via `REDIS_DLQ_KEY`). Each DLQ entry is a JSON object:
```json
{ "queue": "<source_queue>", "payload": "<original_json>", "error": "<error_message>" }
```
The DLQ is a Redis list, so a separate consumer or admin tool can inspect, replay, or discard entries at any time.

---

### 3. Queue Contract

| Queue key | Producer | Consumer | Job type |
|---|---|---|---|
| `datahub:queue:ingestion` | DataHub `IngestionService` | `IngestionWorker` | `IngestionJob` |
| `datahub:queue:chunking` | `IngestionWorker` | `ChunkWorker` | `ChunkingJob` |
| `datahub:queue:embedding` | `ChunkWorker` | `EmbedWorker` | `EmbedJob` |
| `datahub:queue:dlq` | All workers (on error) | Admin / replay tool | DLQ entry |

All queues use Redis List with `RPush` (producer) and `BLPop` (consumer) — simple FIFO.

---

### 4. Database Tables

| Table | Owner | Purpose |
|---|---|---|
| `datasources` | DataHub | Named document collections per tenant/workspace |
| `documents` | DataHub | Uploaded files with hash, MinIO path, metadata |
| `ingestions` | DataHub (write), Workers (status updates) | Processing runs — one per document+strategy+model |
| `chunks` | ChunkWorker | Text fragments produced by chunking |
| `chunk_384dimension` | EmbedWorker | pgvector embeddings, 384-dim |
| `chunk_768dimension` | EmbedWorker | pgvector embeddings, 768-dim |
| `chunk_1024dimension` | EmbedWorker | pgvector embeddings, 1024-dim |

All tables use `(tenant_id, workspace_id)` composite scoping with cascading foreign key deletes.

---

## Flow Sequences

---

### Flow 1 — Sign Up & Bootstrap (prerequisite)

> Not part of DataHub itself, but required before any DataHub call. Included for completeness.

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant IAM as IAM Service

    C->>IAM: POST /auth/signup {email, password, name}
    IAM-->>C: {userId, email, name}

    C->>IAM: POST /auth/login {email, password}
    IAM-->>C: {preAuthToken, requireTenantCreation=true}

    C->>IAM: POST /tenants/bootstrap {preAuthToken, tenantName, workspaceName}
    IAM-->>C: {access_token, refresh_token, tenantId, workspaceId}

    Note over C: All subsequent requests use Authorization: Bearer <access_token>
```

---

### Flow 2 — Create Datasource

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant DH as DataHub API
    participant DB as PostgreSQL

    C->>DH: POST /datasources<br/>Authorization: Bearer <token><br/>{name, description?}
    DH->>DH: Extract tenantId + workspaceId from JWT
    DH->>DB: INSERT INTO datasources<br/>(id=UUIDv7, tenant_id, workspace_id, name, description)
    DB-->>DH: new row
    DH-->>C: 201 Created {id, name, description, createdAt}
```

---

### Flow 3 — Upload Document

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant DH as DataHub API
    participant DB as PostgreSQL
    participant Minio as MinIO

    C->>DH: POST /datasources/{datasource_id}/documents<br/>multipart/form-data: file, metadata?
    DH->>DH: Read file bytes (32 MB limit)<br/>SHA-256(bytes) → fileHash
    DH->>DB: SELECT id FROM documents<br/>WHERE datasource_id=? AND tenant_id=?<br/>AND workspace_id=? AND file_hash=?
    alt Duplicate detected
        DB-->>DH: existing row
        DH-->>C: 409 Conflict "file already exists"
    else New file
        DB-->>DH: no row
        DH->>Minio: PutObject(bucket, "<datasource_id>/<filename>", bytes)
        Minio-->>DH: ok
        DH->>DB: INSERT INTO documents<br/>(id, tenant_id, workspace_id, datasource_id,<br/>name, file_hash, storage_path, metadata)
        DB-->>DH: new row
        DH-->>C: 201 Created {id, name, storagePath, createdAt}
    end
```

---

### Flow 4 — Create Ingestion (trigger async pipeline)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant DH as DataHub API
    participant DB as PostgreSQL
    participant Redis as Redis

    C->>DH: POST /documents/{document_id}/ingestions<br/>{chunk_strategy, chunk_config, embedding_model}
    DH->>DH: Validate strategy ∈ {fixed_size, recursive_split, semantic_chunking}<br/>Validate embedding_model non-empty<br/>Validate chunk_config is valid JSON
    alt Validation fails
        DH-->>C: 400 Bad Request
    else Valid
        DH->>DB: SELECT storage_path FROM documents WHERE id=? AND tenant_id=? AND workspace_id=?
        DB-->>DH: storage_path
        DH->>DB: INSERT INTO ingestions<br/>(id, tenant_id, workspace_id, document_id,<br/>chunk_strategy, chunk_config, embedding_model, status='pending')
        DB-->>DH: new row
        DH->>Redis: RPush datahub:queue:ingestion<br/>IngestionJob{ingestion_id, document_id, tenant_id,<br/>workspace_id, storage_path, filename,<br/>chunk_strategy, chunk_config, embedding_model}
        Redis-->>DH: ok
        DH-->>C: 202 Accepted {id, status='pending', createdAt}
    end
```

---

### Flow 5 — IngestionWorker (stage 1: download + parse)

```mermaid
sequenceDiagram
    autonumber
    participant Redis as Redis
    participant IW as IngestionWorker
    participant DB as PostgreSQL
    participant Minio as MinIO

    loop poll every 5s
        Redis-->>IW: BLPop datahub:queue:ingestion → IngestionJob
        IW->>DB: UPDATE ingestions SET status='processing' WHERE id=?
        IW->>Minio: GetObject(bucket, storage_path)
        alt Download fails
            Minio-->>IW: error
            IW->>DB: UPDATE ingestions SET status='failed'
            IW->>Redis: RPush datahub:queue:dlq {queue, payload, error}
        else Download ok
            Minio-->>IW: file bytes
            IW->>IW: parser.ExtractText(bytes, filename)<br/>.txt → direct<br/>.docx → XML parse word/document.xml
            alt Parse fails or empty text
                IW->>DB: UPDATE ingestions SET status='failed'
                IW->>Redis: RPush datahub:queue:dlq
            else Text extracted
                IW->>Redis: RPush datahub:queue:chunking<br/>ChunkingJob{ingestion_id, document_id, tenant_id,<br/>workspace_id, text, chunk_strategy, chunk_config, embedding_model}
            end
        end
    end
```

---

### Flow 6 — ChunkWorker (stage 2: split + enqueue embeds)

```mermaid
sequenceDiagram
    autonumber
    participant Redis as Redis
    participant CW as ChunkWorker
    participant DB as PostgreSQL

    loop poll every 5s
        Redis-->>CW: BLPop datahub:queue:chunking → ChunkingJob
        CW->>DB: SELECT datasource_id FROM documents<br/>WHERE id=? AND tenant_id=? AND workspace_id=?
        DB-->>CW: datasource_id
        CW->>CW: chunker.New(strategy, config)<br/>chunks = chunker.Chunk(text)
        alt 0 chunks (empty document)
            CW->>DB: UPDATE ingestions SET status='completed'
        else N chunks
            CW->>Redis: SET datahub:embed:remaining:<ingestion_id> = N  TTL=24h
            loop for each chunk
                CW->>DB: INSERT INTO chunks<br/>(id=UUID, tenant_id, workspace_id,<br/>document_id, ingestion_id,<br/>chunk_index, content, metadata)
                CW->>Redis: RPush datahub:queue:embedding<br/>EmbedJob{ingestion_id, chunk_id, datasource_id,<br/>tenant_id, workspace_id, content, embedding_model}
            end
            CW->>DB: UPDATE ingestions SET status='chunked'
        end
        alt Any error
            CW->>DB: UPDATE ingestions SET status='failed'
            CW->>Redis: RPush datahub:queue:dlq
        end
    end
```

---

### Flow 7 — EmbedWorker (stage 3: embed + store vectors)

```mermaid
sequenceDiagram
    autonumber
    participant Redis as Redis
    participant EW as EmbedWorker
    participant AIHub as AIHub API
    participant DB as PostgreSQL

    loop poll every 5s
        Redis-->>EW: BLPop datahub:queue:embedding → EmbedJob
        EW->>AIHub: POST /v1/embed<br/>{model, input: [chunk_text]}
        alt AIHub error / timeout (60s)
            AIHub-->>EW: error
            EW->>Redis: RPush datahub:queue:dlq
        else Success
            AIHub-->>EW: {data: [{embedding: [f1,f2,...]}]}
            EW->>EW: dim = len(vector)<br/>table = chunk_<dim>dimension
            alt Unsupported dimension
                EW->>Redis: RPush datahub:queue:dlq
            else Supported
                EW->>DB: INSERT INTO chunk_<dim>dimension<br/>(id, tenant_id, workspace_id, chunk_id,<br/>datasource_id, embedding::vector)<br/>ON CONFLICT (id) DO NOTHING
                EW->>Redis: DECR datahub:embed:remaining:<ingestion_id>
                alt remaining == 0
                    EW->>DB: UPDATE ingestions SET status='completed'
                end
            end
        end
    end
```

---

### Flow 8 — Vector Search

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant EXT as Embedding Source (e.g. AIHub)
    participant DH as DataHub API
    participant DB as PostgreSQL

    Note over C,EXT: Caller must generate the query vector externally first
    C->>EXT: POST /v1/embed {model, input: ["query text"]}
    EXT-->>C: {data: [{embedding: [f1,f2,...]}]}

    C->>DH: POST /datasources/{id}/search<br/>Authorization: Bearer <token><br/>{vector: [...], topK: 10}
    DH->>DH: Extract tenantId + workspaceId from JWT
    DH->>DB: SELECT id FROM datasources<br/>WHERE id=? AND tenant_id=? AND workspace_id=?
    alt Datasource not found
        DB-->>DH: no row
        DH-->>C: 404 Not Found
    else Found
        DB-->>DH: row
        DH->>DH: dim = len(vector) → select table
        DH->>DB: SELECT chunk_id, content,<br/>(1-(embedding <=> $vector)) AS score<br/>FROM chunk_<dim>dimension<br/>WHERE datasource_id=? AND tenant_id=? AND workspace_id=?<br/>ORDER BY embedding <=> $vector<br/>LIMIT topK
        DB-->>DH: [{chunk_id, content, score}, ...]
        DH-->>C: 200 OK [{chunk_id, content, score}, ...]
    end
```

---

### Flow 9 — Full End-to-End Pipeline

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant DH as DataHub API
    participant Redis as Redis
    participant IW as IngestionWorker
    participant CW as ChunkWorker
    participant EW as EmbedWorker
    participant AIHub as AIHub
    participant Minio as MinIO
    participant DB as PostgreSQL

    C->>DH: POST /datasources → 201
    DH->>DB: INSERT datasources

    C->>DH: POST /datasources/{id}/documents → 201
    DH->>Minio: upload file
    DH->>DB: INSERT documents

    C->>DH: POST /documents/{id}/ingestions → 202
    DH->>DB: INSERT ingestions (pending)
    DH->>Redis: RPush :ingestion → IngestionJob

    Note over IW: async — IngestionWorker
    IW->>DB: status = processing
    IW->>Minio: download file
    IW->>IW: parse text
    IW->>Redis: RPush :chunking → ChunkingJob

    Note over CW: async — ChunkWorker
    CW->>DB: get datasource_id (tenant-scoped)
    CW->>CW: split text into N chunks
    CW->>Redis: SET counter = N
    CW->>DB: INSERT N chunks
    CW->>Redis: RPush :embedding × N → EmbedJob
    CW->>DB: status = chunked

    Note over EW: async — EmbedWorker (×N)
    loop for each EmbedJob
        EW->>AIHub: POST /v1/embed
        AIHub-->>EW: vector[dim]
        EW->>DB: INSERT chunk_<dim>dimension
        EW->>Redis: DECR counter
        alt counter == 0
            EW->>DB: status = completed
        end
    end

    C->>DH: GET /ingestions/{id} → {status: "completed"}

    C->>AIHub: POST /v1/embed {query text}
    AIHub-->>C: query vector
    C->>DH: POST /datasources/{id}/search {vector, topK}
    DH->>DB: cosine similarity search
    DB-->>DH: ranked chunks
    DH-->>C: [{chunk_id, content, score}]
```

        DocRepo-->>DocSvc: DocumentResponse
        DocSvc-->>DH: DocumentResponse
        DH-->>C: 201 DocumentResponse
    end
```

## Trigger Ingestion

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant DH as DataHub API
    participant IngSvc as IngestionService
    participant IngRepo as IngestionRepository
    participant DocRepo as DocumentRepository
    participant DB as PostgreSQL
    participant Redis as Redis Queue

    C->>DH: POST /documents/{document_id}/ingestions<br/>{chunk_strategy, chunk_config, embedding_model}
    DH->>IngSvc: CreateIngestion(document_id, req)
    IngSvc->>DocRepo: GetByID(document_id)
    DocRepo->>DB: SELECT * FROM document WHERE id=?
    DB-->>DocRepo: document (storage_path, ...)
    DocRepo-->>IngSvc: document

    IngSvc->>IngRepo: Insert(ingestion{status="pending"})
    IngRepo->>DB: INSERT INTO ingestion
    DB-->>IngRepo: ingestion row
    IngRepo-->>IngSvc: IngestionResponse

    IngSvc->>Redis: RPUSH <REDIS_INGESTION_QUEUE><br/>ChunkJob{ingestion_id, document_id,<br/>storage_path, chunk_strategy,<br/>chunk_config, embedding_model}

    alt Queue success
        Redis-->>IngSvc: ok
        IngSvc-->>DH: IngestionResponse (status=pending)
        DH-->>C: 202 Accepted
    else Queue failure
        Redis-->>IngSvc: error
        IngSvc->>IngRepo: UpdateStatus(id, "pending")
        IngSvc-->>DH: error
        DH-->>C: 500 Internal Server Error
    end
```

## Async Ingestion Processing (data-worker)

```mermaid
sequenceDiagram
    autonumber
    participant Redis as Redis Queue
    participant DW as data-worker
    participant Minio as MinIO
    participant AH as AIHub<br/>/v1/embed
    participant DB as PostgreSQL

    loop consume forever
        DW->>Redis: BLPOP <queue_key>
        Redis-->>DW: ChunkJob JSON
        DW->>DW: parse ChunkJob
        DW->>DB: UPDATE ingestion SET status='processing'
        DW->>Minio: GetObject(storage_path)
        Minio-->>DW: file bytes
        DW->>DW: split into chunks<br/>(chunk_strategy + chunk_config)
        loop each chunk
            DW->>AH: POST /v1/embed {model, input: chunk.content}
            AH-->>DW: EmbedResponse {embedding vector}
            DW->>DB: INSERT INTO chunk {content, chunk_index, ...}
            DW->>DB: INSERT INTO chunk_Ndimension {chunk_id, embedding}
        end
        alt All chunks successful
            DW->>DB: UPDATE ingestion SET status='completed'
        else Error
            DW->>DB: UPDATE ingestion SET status='failed'
        end
    end
```

## Datasource CRUD

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant DH as DataHub API
    participant DSRepo as DatasourceRepository
    participant DB as PostgreSQL

    C->>DH: POST /datasources {name, description?}
    DH->>DSRepo: Insert(datasource)
    DSRepo->>DB: INSERT INTO datasource
    DB-->>DSRepo: row
    DSRepo-->>DH: DatasourceResponse
    DH-->>C: 201 DatasourceResponse

    C->>DH: GET /datasources
    DH->>DSRepo: ListAll()
    DSRepo->>DB: SELECT * FROM datasource
    DB-->>DSRepo: rows
    DH-->>C: 200 [DatasourceResponse, ...]

    C->>DH: PUT /datasources/{id} {name?, description?}
    DH->>DSRepo: Update(id, fields)
    DSRepo->>DB: UPDATE datasource SET ... WHERE id=?
    DB-->>DSRepo: updated row
    DH-->>C: 200 DatasourceResponse

    C->>DH: DELETE /datasources/{id}
    DH->>DSRepo: Delete(id)
    DSRepo->>DB: DELETE FROM datasource WHERE id=?<br/>(CASCADE → document → ingestion → chunk)
    DH-->>C: 204 No Content
```

## Query Chunks (read-only)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant DH as DataHub API
    participant ChunkRepo as ChunkRepository
    participant DB as PostgreSQL

    C->>DH: GET /ingestions/{ingestion_id}/chunks
    DH->>ChunkRepo: ListByIngestion(ingestion_id)
    ChunkRepo->>DB: SELECT * FROM chunk<br/>WHERE ingestion_id=?<br/>ORDER BY chunk_index ASC
    DB-->>ChunkRepo: chunk rows
    ChunkRepo-->>DH: [ChunkResponse, ...]
    DH-->>C: 200 [ChunkResponse, ...]

    C->>DH: GET /chunks/{id}
    DH->>ChunkRepo: GetByID(id)
    ChunkRepo->>DB: SELECT * FROM chunk WHERE id=?
    DB-->>ChunkRepo: chunk row
    DH-->>C: 200 ChunkResponse
```
