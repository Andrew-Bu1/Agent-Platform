-- Seed: Platform feature registry
--
-- These are the canonical feature keys that other services gate on.
-- Features are enabled per-tenant via feature_entitlement records.
--
-- Key convention: <service>.<capability>

INSERT INTO features (id, key, name, description, created_at) VALUES
    ('00000000-0000-0000-0010-000000000001', 'agent_studio.flows',
     'Flow Builder',
     'Create, edit, and run multi-agent flows in Agent Studio.',
     NOW()),
    ('00000000-0000-0000-0010-000000000002', 'agent_studio.agents',
     'Agent Management',
     'Create and manage AI agents in Agent Studio.',
     NOW()),
    ('00000000-0000-0000-0010-000000000003', 'agent_studio.tools',
     'Tool Management',
     'Create and manage tools (HTTP and code) in Agent Studio.',
     NOW()),
    ('00000000-0000-0000-0010-000000000004', 'datahub.datasources',
     'DataHub Datasources',
     'Create and manage datasources in DataHub.',
     NOW()),
    ('00000000-0000-0000-0010-000000000005', 'datahub.ingestion',
     'DataHub Ingestion',
     'Trigger document ingestion and embedding pipelines.',
     NOW()),
    ('00000000-0000-0000-0010-000000000006', 'datahub.search',
     'DataHub Semantic Search',
     'Run semantic vector search over ingested knowledge.',
     NOW()),
    ('00000000-0000-0000-0010-000000000007', 'aihub.chat',
     'AIHub Chat Completions',
     'Call LLM chat completions via AIHub.',
     NOW()),
    ('00000000-0000-0000-0010-000000000008', 'aihub.embedding',
     'AIHub Embeddings',
     'Generate text embeddings via AIHub.',
     NOW())
ON CONFLICT (key) DO NOTHING;
