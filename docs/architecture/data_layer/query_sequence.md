# Data Layer — Query / Vector Search Sequence

DataHub's search is **stateless with respect to AI models**: the caller must supply the query vector directly. DataHub does not call any embedding model at query time. This keeps the search endpoint fast, model-agnostic, and free of external dependencies on the hot path.

---

## Typical Client Flow (with embedding step)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant AIHub as AIHub<br/>POST /v1/embed
    participant DH as DataHub API<br/>POST /datasources/{id}/search
    participant PG as PostgreSQL<br/>(pgvector)

    Note over C,AIHub: Step 1 — client embeds the query text using the same model used at ingestion

    C->>AIHub: POST /v1/embed {model: "...", input: ["user query text"]}<br/>Authorization: Bearer <access_token>
    AIHub-->>C: {data: [{embedding: [f1, f2, ..., fN]}]}

    Note over C,PG: Step 2 — client sends the raw vector to DataHub for similarity search

    C->>DH: POST /datasources/{id}/search {vector: [f1,...,fN], topK: 10}<br/>Authorization: Bearer <access_token>
    DH->>DH: verify JWT → extract tenant_id, workspace_id
    DH->>PG: SELECT id FROM datasources WHERE id=$id AND tenant_id=$t AND workspace_id=$w
    PG-->>DH: datasource row (or 404 if not owned by caller)

    DH->>DH: determine table from vector length:<br/>384 → chunk_384dimension<br/>768 → chunk_768dimension<br/>1024 → chunk_1024dimension<br/>other → 400 Bad Request

    DH->>PG: SELECT e.chunk_id, c.content,<br/>       1 - (e.embedding <=> $vector::vector) AS score<br/>FROM chunk_{N}dimension e<br/>JOIN chunks c ON c.id = e.chunk_id<br/>WHERE e.datasource_id=$id<br/>  AND e.tenant_id=$t<br/>  AND e.workspace_id=$w<br/>ORDER BY e.embedding <=> $vector<br/>LIMIT $topK
    PG-->>DH: [{chunk_id, content, score}] sorted DESC by score

    DH-->>C: 200 [{chunk_id, content, score}]
```

---

## Single-Service Flow (caller already has the vector)

If the caller already holds a query vector (e.g., cached from a previous embed call or produced by a different service), they skip step 1 and call DataHub directly.

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant DH as DataHub API
    participant PG as PostgreSQL

    C->>DH: POST /datasources/{id}/search {vector: [...], topK: 5}<br/>Authorization: Bearer <access_token>
    DH->>DH: verify JWT (tenant_id, workspace_id from claims)
    DH->>PG: verify datasource ownership (tenant + workspace scope)
    DH->>PG: cosine similarity search in chunk_{N}dimension<br/>WHERE datasource_id=$id AND tenant_id=$t AND workspace_id=$w<br/>ORDER BY embedding <=> $vector LIMIT 5
    PG-->>DH: top-5 chunks
    DH-->>C: 200 [{chunk_id, content, score}]
```

---

## Vector Index Details

Each dimension table has an **HNSW index** on the `embedding` column:

```sql
CREATE INDEX idx_chunk_384_embedding_hnsw
    ON chunk_384dimension USING hnsw (embedding vector_cosine_ops);
```

pgvector uses approximate nearest-neighbour search over this index. All WHERE clauses (`datasource_id`, `tenant_id`, `workspace_id`) are applied as post-filters after the ANN retrieval.

---

## Key Design Constraints

| Constraint | Reason |
|---|---|
| Caller supplies the query vector | Keeps DataHub stateless — no AI model dependency on the search hot path |
| Vector dimension determines table | 384 / 768 / 1024 are the only supported sizes; other sizes return `400 Bad Request` |
| Datasource ownership verified before search | Prevents cross-tenant data leakage — even if a valid JWT is presented, the datasource must belong to that tenant+workspace |
| No RAG / LLM integration in DataHub | RAG generation is the caller's responsibility — DataHub only returns raw chunks and scores |
