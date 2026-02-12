sequenceDiagram
    autonumber
    
    actor User
    participant Datahub
    participant PgVector as PgVector (Vector DB)
    participant EmbedModel as Embedding Model
    participant LLM as LLM Service
    
    %% === PHASE 1: QUERY RECEIPT ===
    rect rgb(255, 245, 230)
        Note over User, Datahub: PHASE 1: RECEIVE QUERY
        User->>Datahub: POST /search
        
        Datahub->>Datahub: Validate request
    end
    
    %% === PHASE 2: QUERY EMBEDDING ===
    rect rgb(240, 248, 255)
        Note over Datahub, EmbedModel: PHASE 2: VECTORIZE QUERY
        
        Datahub->>EmbedModel: Generate embedding(query)
        Note right of EmbedModel: Same model used<br/>for document chunks
        
        EmbedModel-->>Datahub: Return query_vector[n]
    end
    
    %% === PHASE 3: VECTOR SEARCH ===
    rect rgb(230, 255, 230)
        Note over Datahub, PgVector: PHASE 3: SIMILARITY SEARCH
        
        Datahub->>PgVector: Vector similarity search
        Note right of PgVector: SELECT chunk_id, chunk_text,<br/>doc_id, metadata,<br/>embedding <=> query_vector<br/>AS distance<br/>FROM chunks<br/>WHERE status = 'indexed'<br/>[AND doc_id = ...]<br/>ORDER BY distance<br/>LIMIT top_k
        
        PgVector-->>Datahub: Return top_k chunks
    end
    
    %% === PHASE 4: OPTIONAL RAG ===
    rect rgb(255, 240, 255)
        Note over Datahub, LLM: PHASE 4: RAG
        
        alt Generate Answer (RAG Mode)
            Datahub->>Datahub: Build RAG prompt
            Note right of Datahub: System: "Answer using context"<br/>Context: [retrieved chunks]<br/>Query: [user question]
            
            Datahub->>LLM: Generate answer
            
            LLM-->>Datahub: Return AI response
            
            Datahub-->>User: Response with answer + sources
            
        else Search Only Mode
            Datahub-->>User: Return chunks directly
        end
    end