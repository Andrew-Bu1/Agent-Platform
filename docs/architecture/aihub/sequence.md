# AIHub — Sequence Diagrams

## 1. Startup — registry initialization

```mermaid
sequenceDiagram
    autonumber
    participant App as AIHub startup
    participant PG as PostgreSQL
    participant IAM as IAM Service<br/>JWKS endpoint
    participant Reg as AdapterRegistry

    App->>PG: connect
    App->>IAM: GET /.well-known/jwks.json
    IAM-->>App: {keys: [{kid, n, e, ...}]}
    Note over App: JwksCache stores kid→RSAPublicKey

    App->>PG: SELECT active providers (provider_key, adapter_type, config_json, base_url)
    PG-->>App: provider rows

    loop for each provider row
        alt adapter_type = openai_compatible
            App->>Reg: decrypt config_json.api_key with PROVIDER_ENCRYPTION_KEY
            App->>Reg: register OpenAICompatibleChatAdapter(base_url, api_key)
        else adapter_type = local
            App->>Reg: register LocalEmbedAdapter + LocalRerankAdapter
        end
    end

    App-->>App: ServiceRouter ready
```

---

## 2. JWT authentication (every request)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant Auth as get_caller_context<br/>(FastAPI dependency)
    participant JWKS as JwksCache<br/>(in-memory)
    participant IAM as IAM Service<br/>(JWKS endpoint)

    C->>Auth: Authorization: Bearer <jwt>
    Auth->>Auth: decode header → kid
    Auth->>JWKS: get_key(kid)
    alt kid known
        JWKS-->>Auth: RSAPublicKey
    else kid unknown (key rotation)
        JWKS->>IAM: GET /.well-known/jwks.json
        IAM-->>JWKS: updated key set
        JWKS-->>Auth: RSAPublicKey (or None → 401)
    end
    Auth->>Auth: jwt.decode(token, public_key, RS256)
    Note over Auth: Extract: sub, tenant_id, workspace_id, type, permissions
    Auth-->>C: CallerContext (or 401 on failure)
```

---

## 3. Chat — non-streaming

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant API as POST /v1/chat
    participant Auth as JWT middleware
    participant SR as ServiceRouter
    participant PG as PostgreSQL<br/>model_configs
    participant EG as EntitlementGuard
    participant Redis as Redis
    participant IAM as IAM Service<br/>/entitlements/models
    participant Adp as OpenAICompatibleChatAdapter
    participant Prov as Provider API<br/>(e.g. OpenRouter)
    participant Log as PostgreSQL<br/>model_usage_logs

    C->>API: POST /v1/chat {model, messages, stream:false}
    API->>Auth: verify JWT → CallerContext
    Auth-->>API: CallerContext {tenant_id, ...}

    API->>SR: chat(model_key, messages, ctx)
    SR->>PG: SELECT mc.*, p.provider_key FROM model_configs mc JOIN providers p WHERE model_key=$1
    PG-->>SR: ModelConfig

    SR->>EG: check_before_call(tenant_id, model_key, op_type, bearer_token)
    EG->>IAM: GET /entitlements/models (cached 5 min)
    IAM-->>EG: entitlement list
    EG->>Redis: INCR rpm_key (60 s TTL)
    EG->>Redis: GET tpm/daily/monthly counters
    EG-->>SR: ok (or 403/429)

    SR->>Adp: chat(config, messages, tools, tool_choice)
    Adp->>Prov: POST /chat/completions {model: provider_model_id, messages, ...}
    Prov-->>Adp: ChatCompletion {id, choices, usage}
    Adp-->>SR: ChatResponse

    SR->>EG: record_usage(tenant_id, model_key, op_type, total_tokens)
    EG->>Redis: INCRBY tpm+daily+monthly (pipeline, best-effort)

    SR->>Log: INSERT model_usage_logs {tenant_id, model_id, tokens, cost, latency_ms, status}

    SR-->>API: ChatResponse
    API-->>C: 200 ChatResponse
```

---

## 4. Chat — streaming (SSE)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant API as POST /v1/chat<br/>stream:true
    participant SR as ServiceRouter
    participant EG as EntitlementGuard
    participant Adp as OpenAICompatibleChatAdapter
    participant Prov as Provider API
    participant Log as PostgreSQL<br/>model_usage_logs

    C->>API: POST /v1/chat {model, messages, stream:true}
    API->>SR: chat_stream(model_key, messages, ctx)
    SR->>EG: check_before_call (same as non-streaming)
    EG-->>SR: ok

    SR->>Adp: chat_stream(config, messages)
    Adp->>Prov: POST /chat/completions {stream:true, stream_options:{include_usage:true}}

    loop SSE chunks
        Prov-->>Adp: data: {delta: ...}
        Adp-->>SR: bytes chunk
        SR-->>C: data: {delta: ...}
        Note over SR: parse chunk, capture last usage object
    end

    Prov-->>Adp: data: [DONE]
    Adp-->>SR: data: [DONE]
    SR-->>C: data: [DONE]

    Note over SR,Log: After stream ends (finally block)
    SR->>EG: record_usage(tenant_id, model_key, op_type, total_tokens)
    SR->>Log: INSERT model_usage_logs
```

---

## 5. Embedding

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant API as POST /v1/embed
    participant SR as ServiceRouter
    participant EG as EntitlementGuard
    participant Adp as LocalEmbedAdapter<br/>(SentenceTransformer)
    participant Log as PostgreSQL<br/>model_usage_logs

    C->>API: POST /v1/embed {model, input: [...]}
    API->>SR: embed(model_key, inputs, ctx)
    SR->>EG: check_before_call
    EG-->>SR: ok

    SR->>Adp: embed(config, inputs)
    alt model already loaded
        Adp->>Adp: use cached SentenceTransformer
    else first request for this model
        Adp->>Adp: SentenceTransformer(.models/<model_key>)<br/>or download from HuggingFace Hub
    end
    Adp->>Adp: run_in_executor → model.encode(inputs)
    Adp-->>SR: EmbedResponse {data: [{index, embedding}], usage}

    SR->>EG: record_usage(total_tokens)
    SR->>Log: INSERT model_usage_logs
    SR-->>API: EmbedResponse
    API-->>C: 200 EmbedResponse
```

---

## 6. Reranking

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant API as POST /v1/rerank
    participant SR as ServiceRouter
    participant EG as EntitlementGuard
    participant Adp as LocalRerankAdapter<br/>(CrossEncoder)
    participant Log as PostgreSQL<br/>model_usage_logs

    C->>API: POST /v1/rerank {model, query, documents, top_n}
    API->>SR: rerank(model_key, query, documents, top_n, ctx)
    SR->>EG: check_before_call
    EG-->>SR: ok

    SR->>Adp: rerank(config, query, documents, top_n)
    Adp->>Adp: build pairs [(query, doc) for doc in documents]
    Adp->>Adp: run_in_executor → model.predict(pairs)
    Adp->>Adp: sort by score DESC, trim to top_n
    Adp-->>SR: RerankResponse {results: [{index, document, relevance_score}]}

    SR->>EG: record_usage(len(documents))
    SR->>Log: INSERT model_usage_logs
    SR-->>API: RerankResponse
    API-->>C: 200 RerankResponse
```

---

## 7. Provider CRUD

```mermaid
sequenceDiagram
    autonumber
    participant Admin as Admin Client
    participant API as /v1/providers
    participant Crypto as Fernet crypto
    participant Repo as ProvidersRepository
    participant PG as PostgreSQL

    Admin->>API: POST /v1/providers {provider_key, base_url, adapter_type, api_key}
    API->>Crypto: encrypt(api_key, PROVIDER_ENCRYPTION_KEY)
    Crypto-->>API: encrypted_api_key
    API->>Repo: create(provider_key, base_url, adapter_type, config_json={api_key: encrypted})
    Repo->>PG: INSERT INTO providers ...
    PG-->>Repo: new row
    Repo-->>API: row (config_json replaced with has_api_key: true)
    API-->>Admin: 201 {id, provider_key, has_api_key: true, ...}

    Note over Admin,API: Rotate API key
    Admin->>API: PATCH /v1/providers/{id} {api_key: "new-key"}
    API->>Crypto: encrypt("new-key")
    API->>Repo: update(id, config_json={api_key: new_encrypted})
    Note over Repo: config_json merged with ||, other fields preserved
    Repo->>PG: UPDATE providers SET config_json = config_json || $new WHERE id=$1
    PG-->>Repo: updated row
    API-->>Admin: 200 {has_api_key: true, ...}

    Note over Admin: Service restart required to reload registry with new key
```

---

## 8. Entitlement check detail

```mermaid
sequenceDiagram
    autonumber
    participant SR as ServiceRouter
    participant EG as EntitlementGuard
    participant Cache as EntitlementCache<br/>(in-memory, 5 min TTL)
    participant IAM as IAM Service
    participant Redis as Redis

    SR->>EG: check_before_call(tenant_id, model_key, op_type, bearer_token)
    EG->>Cache: get(tenant_id, bearer_token)

    alt cache miss or expired
        Cache->>IAM: GET /entitlements/models<br/>Authorization: Bearer <token>
        IAM-->>Cache: [{modelKey, operationType, allowed, rpmLimit, tpmLimit, ...}]
        Cache->>Cache: store with 5-min TTL
    end

    Cache-->>EG: entitlement map
    EG->>EG: lookup (model_key, op_type) → Entitlement

    alt no entitlement row OR allowed=false
        EG-->>SR: 403 Forbidden
    end

    EG->>Redis: INCR aihub:rpm:{tenant}:{model}:{op} (60 s TTL)
    alt count > rpm_limit
        EG-->>SR: 429 RPM limit exceeded
    end

    EG->>Redis: GET aihub:tpm:{tenant}:{model}:{op}:{minute}
    alt current >= tpm_limit
        EG-->>SR: 429 TPM limit exceeded
    end

    EG->>Redis: GET aihub:daily:{tenant}:{model}:{op}:{date}
    EG->>Redis: GET aihub:monthly:{tenant}:{model}:{op}:{month}
    alt any counter at limit
        EG-->>SR: 429 limit exceeded
    end

    EG-->>SR: ok — proceed with call
```
