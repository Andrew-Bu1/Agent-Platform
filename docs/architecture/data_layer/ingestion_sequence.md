sequenceDiagram
    autonumber
    
    actor User
    participant Datahub as Datahub 
    participant MinIO as MinIO (Object Storage)
    participant Redis as Redis (Broker)
    participant DataWorker as Data Worker
    participant Model as Embedding Model
    participant PgVector as PgVector (Vector DB)
    
    %% === PHASE 1: UPLOAD ===
    rect rgb(255, 245, 230)
        Note over User, Redis: PHASE 1: FILE UPLOAD
        User->>Datahub: POST /upload (file, strategy, metadata)
        
        par Parallel Operations
            Datahub->>MinIO: Stream Upload File
            MinIO-->>Datahub: Return file_id, path
            
            Datahub->>PgVector: INSERT INTO documents
            Note right of PgVector: Store: doc_id, file_id,<br/>status='pending',<br/>chunk_strategy, metadata
            PgVector-->>Datahub: Return doc_id
        end
        
        Datahub->>Redis: PUBLISH chunk-jobs queue
        
        Datahub-->>User: 202 Accepted
        Note right of User: Response:<br/>{doc_id, status: 'processing'}
    end
    
    %% === PHASE 2: CHUNKING ===
    rect rgb(240, 248, 255)
        Note over Redis, DataWorker:PHASE 2: CHUNKING
        
        Redis->>DataWorker: Consume chunk-jobs
        activate DataWorker
        
        DataWorker->>MinIO: GET file by file_id
        MinIO-->>DataWorker: Return file content
        
        DataWorker->>DataWorker: Parse document (PDF/DOCX/TXT)
        
        alt Strategy: Semantic Chunking
            DataWorker->>Model: Analyze semantic breakpoints
            Model-->>DataWorker: Return breakpoint indices
            DataWorker->>DataWorker: Split at breakpoints
            
        else Strategy: Recursive Splitting
            DataWorker->>DataWorker: Split by paragraph/sentences
            DataWorker->>DataWorker: Apply overlap window
            
        else Strategy: Fixed Size
            DataWorker->>DataWorker: Split by token/character count
            DataWorker->>DataWorker: Apply overlap
        end
        
        Note over DataWorker: Chunks created:<br/>[chunk_0, chunk_1, ..., chunk_N]
        
        DataWorker->>PgVector: INSERT INTO chunks (batch)
        PgVector-->>DataWorker: Return status
        
        loop For Each Chunk
            DataWorker->>Redis: PUBLISH embed-jobs queue
        end
        
        DataWorker->>PgVector: UPDATE documents
        Note right of PgVector: SET status='chunked',<br/>chunk_count=N
        
        DataWorker->>Redis: PUBLISH chunk-complete event
        Note right of Redis: {doc_id, chunk_count}
        
        deactivate DataWorker
    end
    
    %% === PHASE 3: EMBEDDING ===
    rect rgb(230, 255, 230)
        Note over Redis, PgVector: PHASE 3: EMBEDDING & INDEXING
        
        Redis->>DataWorker: Consume embed-jobs (parallel)
        activate DataWorker
        
        Note over DataWorker: Multiple workers process<br/>chunks concurrently
        
        par Parallel Embedding
            DataWorker->>Model: Generate embedding(chunk_text)
            Model-->>DataWorker: Return vector[1536]
        end
        
        DataWorker->>PgVector: UPDATE chunks
        Note right of PgVector: SET embedding = vector,<br/>status='indexed',<br/>indexed_at = NOW()
        
        DataWorker->>Redis: ACK job completion
        
        deactivate DataWorker
        
        Note over Redis, PgVector: Monitor: When all chunks indexed
        
        Redis->>PgVector: Check completion
        PgVector-->>Redis: All chunks status='indexed'
        
        Redis->>PgVector: UPDATE documents
        Note right of PgVector: SET status='ready',<br/>indexed_at=NOW()
        
        Redis->>Datahub: PUBLISH doc-ready event
        Note right of Redis: {doc_id, status: 'ready'}
        
    end