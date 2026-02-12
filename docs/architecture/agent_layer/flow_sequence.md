sequenceDiagram
    autonumber
    
    actor User
    participant Chatbox
    participant Orchestrator as Agent Orchestrator
    participant Redis as Redis (Broker + PubSub)
    participant Worker as Agent Worker
    participant DB as PgVector
    participant LLM as LLM Service
    participant Tools as Tool Execution

    %% -- ESTABLISH SSE CONNECTION --
    User->>Chatbox: Send Message
    Chatbox->>Orchestrator: POST /chat/stream (sessionId, message)
    
    Note over Orchestrator: Generate unique requestId
    rect rgb(255, 240, 245)
    Note over Orchestrator, DB: CONFIGURATION RETRIEVAL PHASE
    Orchestrator->>+DB: Fetch Flows of Agent
    DB-->>-Orchestrator: Return Agent Flow Config
    end
    Orchestrator->>Redis: SUBSCRIBE to channel: response:{requestId}
    Note over Orchestrator, User: SSE Connection Opened (Keep-Alive)
    Orchestrator-->>Chatbox: SSE: event=connected
    Chatbox-->>User: Show "Thinking..." status
    
    %% -- PUBLISH WORK EVENT --
    Orchestrator->>Redis: PUBLISH agent-tasks queue
    Note right of Redis: Event: {requestId, sessionId, message, userId}
    
    Redis->>Worker: Consumer picks up task
    activate Worker
    
    Worker->>DB: Get Config & Conversation History
    DB-->>Worker: Return Context
    
    %% -- AGENT EXECUTION LOOP --
    loop Agent Execution Loop
        Note over Worker, LLM: Build payload (System + History + Tools)
        Worker->>LLM: Invoke Stream API
        activate LLM
        
        %% === STREAMING PHASE ===
        rect rgb(224, 255, 255)
        Note over Worker, Chatbox: STREAMING PHASE
        loop Streaming Tokens
            LLM-->>Worker: Token Chunk
            Worker->>Redis: PUBLISH response:{requestId}
            Note right of Redis: {type: "token", content: "...", requestId}
            
            Redis-->>Orchestrator: Subscribed channel receives chunk
            Orchestrator-->>Chatbox: SSE: data={token}
            Chatbox-->>User: Render Token (Real-time)
            
            Worker->>Worker: Accumulate in buffer
        end
        end
        
        deactivate LLM
        
        alt Stop Reason: Tool Use
            %% === TOOL PHASE ===
            rect rgb(255, 248, 220)
            Note over Worker, Tools: TOOL EXECUTION PHASE
            
            Worker->>Redis: PUBLISH response:{requestId}
            Note right of Redis: {type: "status", message: "Using tools..."}
            Redis-->>Orchestrator: Status event
            Orchestrator-->>Chatbox: SSE: event=tool_use
            Chatbox-->>User: Show tool spinner
            
            Worker->>Tools: Execute tools (parallel)
            activate Tools
            Tools-->>Worker: Tool results
            deactivate Tools
            
            Worker->>Redis: PUBLISH response:{requestId}
            Note right of Redis: {type: "tool_result", tools: [...]}
            Redis-->>Orchestrator: Tool results
            Orchestrator-->>Chatbox: SSE: data={tool_results}
            
            Worker->>Worker: Append tool results to context
            end
            
            Note right of Worker: Continue loop with updated context
            
        else Stop Reason: End Turn
            %% === COMPLETION PHASE ===
            rect rgb(220, 255, 220)
            Note over Worker, Chatbox: COMPLETION PHASE
            
            Worker->>DB: Save conversation turn
            
            Worker->>Redis: PUBLISH response:{requestId}
            Note right of Redis: {type: "done", requestId, finalContent}
            
            Redis-->>Orchestrator: Done event received
            Orchestrator-->>Chatbox: SSE: event=done
            Chatbox-->>User: Show "Complete" + Stop spinner
            
            Note over Orchestrator: Close SSE connection
            Orchestrator->>Redis: UNSUBSCRIBE response:{requestId}
            Orchestrator-->>Chatbox: Close SSE stream
            
            Worker->>Redis: ACK task completion
            Note right of Worker: Exit loop
            end
        end
    end
    deactivate Worker
    
    Note over Chatbox, User: Connection closed, ready for next message