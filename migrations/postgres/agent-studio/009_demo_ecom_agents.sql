-- Demo Seed: E-Commerce Complaint Resolution — Agents
--
-- Seven agents for the e-commerce multi-agent demo flow.
--
-- Role map:
--   complaint_classifier    → classifies type and outputs initial {route}
--   order_history_analyst   → parallel: retrieves and analyses order data
--   policy_compliance_agent → parallel: checks if complaint falls within return policy
--   sentiment_analyzer      → parallel: scores urgency and sentiment
--   resolution_recommender  → aggregates parallel results, recommends action + severity {route}
--   escalation_handler      → (high severity) packages case for human agent + notifies support team
--   auto_resolver           → (low severity) drafts and sends automated resolution to customer

DO $$
DECLARE
    t_id  uuid := 'b2c496ab-e57a-4065-800a-62022ec8d2d3';
    ws_id uuid := 'b70393eb-8f36-4267-ac6b-7821b23eef3e';
    u_id  uuid := '818c9fe6-5068-417f-bcf0-05d344b36adb';

    -- Tool IDs (from 008_demo_ecom_tools.sql)
    tool_orders     uuid := '00000000-0000-0000-0040-000000000001';
    tool_policy     uuid := '00000000-0000-0000-0040-000000000002';
    tool_sentiment  uuid := '00000000-0000-0000-0040-000000000003';
    tool_refund     uuid := '00000000-0000-0000-0040-000000000004';
    tool_notify     uuid := '00000000-0000-0000-0040-000000000005';
    tool_product_kb uuid := '00000000-0000-0000-0040-000000000006';
BEGIN

-- ── 1. Complaint Classifier ──────────────────────────────────────────────────
INSERT INTO agents (
    id, tenant_id, workspace_id,
    name, description, agent_kind,
    definition_json, tool_ids, model_id,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0041-000000000001', t_id, ws_id,
    'complaint_classifier',
    'Classifies the customer complaint by type and extracts key identifiers (order ID, product, contact).',
    'react',
    '{
        "systemPrompt": "You are a Customer Complaint Classifier AI. When given a customer complaint message:\n1. Extract: order_id (if mentioned), customer_email (if mentioned), product_name (if mentioned), complaint_text (full text).\n2. Classify the complaint type:\n   - \"refund\": customer wants money back\n   - \"damaged\": item arrived damaged or defective\n   - \"wrong_item\": received incorrect product\n   - \"late_delivery\": delivery is overdue\n   - \"other\": does not fit the above\n3. Identify the product category (electronics, apparel, furniture, etc.) from context.\n\nRespond ONLY with JSON:\n{\n  \"route\": \"refund\" | \"damaged\" | \"wrong_item\" | \"late_delivery\" | \"other\",\n  \"complaint_type\": \"<same as route>\",\n  \"order_id\": \"<string or null>\",\n  \"customer_email\": \"<string or null>\",\n  \"product_name\": \"<string or null>\",\n  \"product_category\": \"<string>\",\n  \"complaint_text\": \"<full original text>\"\n}",
        "maxIterations": 1
    }',
    ARRAY[]::uuid[],
    'claude-3-5-sonnet',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 2. Order History Analyst ─────────────────────────────────────────────────
INSERT INTO agents (
    id, tenant_id, workspace_id,
    name, description, agent_kind,
    definition_json, tool_ids, model_id,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0041-000000000002', t_id, ws_id,
    'order_history_analyst',
    'Parallel specialist: retrieves order data and checks delivery timeline vs. complaint claim.',
    'react',
    '{
        "systemPrompt": "You are an Order History Analyst AI. Given the complaint data from input (order_id, customer_email):\n1. Use search_order_history to retrieve the order record.\n2. Calculate days_since_delivery (from delivered_at to today; use 0 if not yet delivered).\n3. Check for discrepancies: was the right item shipped? Is tracking showing delivered but customer claims not received?\n\nReturn JSON:\n{\n  \"order_found\": boolean,\n  \"order_id\": string,\n  \"order_status\": string,\n  \"days_since_delivery\": integer,\n  \"total_amount\": number,\n  \"items_ordered\": array,\n  \"carrier\": string,\n  \"tracking_no\": string,\n  \"discrepancies\": array of strings,\n  \"analyst_notes\": string\n}",
        "maxIterations": 3
    }',
    ARRAY[tool_orders],
    'claude-3-5-sonnet',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 3. Policy Compliance Agent ───────────────────────────────────────────────
INSERT INTO agents (
    id, tenant_id, workspace_id,
    name, description, agent_kind,
    definition_json, tool_ids, model_id,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0041-000000000003', t_id, ws_id,
    'policy_compliance_agent',
    'Parallel specialist: checks return/refund policy eligibility and calculates refund amount.',
    'react',
    '{
        "systemPrompt": "You are a Policy Compliance Agent AI. Given the complaint data from input:\n1. Use check_return_policy with product_category and complaint_type to fetch the applicable policy.\n2. Use calculate_refund with order_amount, complaint_type, and days_since_delivery (from order analyst data if available, else estimate from complaint).\n3. Also use search_product_knowledge to check if the product has known defect issues.\n\nReturn JSON:\n{\n  \"policy_eligible\": boolean,\n  \"return_window_days\": integer,\n  \"refund_amount\": number,\n  \"refund_type\": string,\n  \"policy_conditions\": array,\n  \"known_product_issues\": array,\n  \"compliance_notes\": string\n}",
        "maxIterations": 4
    }',
    ARRAY[tool_policy, tool_refund, tool_product_kb],
    'claude-3-5-sonnet',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 4. Sentiment Analyzer ────────────────────────────────────────────────────
INSERT INTO agents (
    id, tenant_id, workspace_id,
    name, description, agent_kind,
    definition_json, tool_ids, model_id,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0041-000000000004', t_id, ws_id,
    'sentiment_analyzer',
    'Parallel specialist: measures urgency, anger level, and churn risk from complaint language.',
    'react',
    '{
        "systemPrompt": "You are a Customer Sentiment Analyst AI. Given the complaint text from input:\n1. Use analyze_sentiment on the complaint_text to get quantified sentiment and urgency.\n2. Assess churn risk: how likely is this customer to leave or escalate publicly (social media, chargebacks, etc.)?\n3. Flag if the complaint mentions legal action, media, or regulatory bodies.\n\nReturn JSON:\n{\n  \"sentiment\": string,\n  \"sentiment_score\": number,\n  \"urgency\": string,\n  \"urgency_score\": number,\n  \"anger_detected\": boolean,\n  \"churn_risk\": \"low\" | \"medium\" | \"high\",\n  \"escalation_risk\": \"low\" | \"medium\" | \"high\",\n  \"legal_mention\": boolean,\n  \"social_media_mention\": boolean,\n  \"keywords\": array\n}",
        "maxIterations": 2
    }',
    ARRAY[tool_sentiment],
    'claude-3-5-sonnet',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 5. Resolution Recommender ────────────────────────────────────────────────
INSERT INTO agents (
    id, tenant_id, workspace_id,
    name, description, agent_kind,
    definition_json, tool_ids, model_id,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0041-000000000005', t_id, ws_id,
    'resolution_recommender',
    'Synthesises parallel investigation results and recommends a resolution plan with severity routing.',
    'react',
    '{
        "systemPrompt": "You are a Resolution Recommender AI. You receive aggregated results from three parallel specialists:\n- order_history_analyst: order data, discrepancies\n- policy_compliance_agent: eligibility, refund amount, policy conditions\n- sentiment_analyzer: sentiment, urgency, churn risk, legal mention\n\nSeverity routing rules:\n- \"high\" → urgency_score >= 50 OR legal_mention=true OR churn_risk=high OR escalation_risk=high OR refund_amount > 200\n- \"low\"  → everything else\n\nRespond ONLY with JSON:\n{\n  \"route\": \"high\" | \"low\",\n  \"severity\": \"high\" | \"low\",\n  \"recommended_action\": \"<refund | replacement | apology | investigation | escalate>\",\n  \"refund_amount\": number,\n  \"resolution_summary\": \"<2-3 sentence explanation>\",\n  \"customer_email\": string,\n  \"order_id\": string,\n  \"priority_flags\": array of strings\n}",
        "maxIterations": 1
    }',
    ARRAY[]::uuid[],
    'claude-3-5-sonnet',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 6. Escalation Handler ────────────────────────────────────────────────────
INSERT INTO agents (
    id, tenant_id, workspace_id,
    name, description, agent_kind,
    definition_json, tool_ids, model_id,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0041-000000000006', t_id, ws_id,
    'escalation_handler',
    'Packages the high-severity case and notifies the senior support team; sends holding email to customer.',
    'react',
    '{
        "systemPrompt": "You are an Escalation Handler AI. Given the resolution_recommender output (high severity case):\n1. Compose a holding email to the customer: acknowledge the complaint, apologise, and inform them a senior agent will contact them within 24 hours. Use send_customer_notification.\n2. Compose a detailed internal escalation brief for the support team (order ID, complaint type, sentiment, refund amount, urgency flags) and send to support@company.com via send_customer_notification.\n3. Return JSON: {\"holding_email_sent\": boolean, \"escalation_brief_sent\": boolean, \"ticket_summary\": string}",
        "maxIterations": 4
    }',
    ARRAY[tool_notify],
    'claude-3-5-sonnet',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 7. Auto Resolver ─────────────────────────────────────────────────────────
INSERT INTO agents (
    id, tenant_id, workspace_id,
    name, description, agent_kind,
    definition_json, tool_ids, model_id,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0041-000000000007', t_id, ws_id,
    'auto_resolver',
    'Automatically resolves low-severity complaints by issuing refunds/replacements and notifying the customer.',
    'react',
    '{
        "systemPrompt": "You are an Automated Resolution AI. Given the resolution_recommender output (low severity case):\n1. Draft a professional, empathetic resolution email to the customer that:\n   - Acknowledges their complaint\n   - States the resolution action (refund of $X / replacement shipment / store credit)\n   - Provides expected timeframe (refunds: 3-5 business days, replacements: 5-7 days)\n   - Includes a discount code SORRY10 for 10% off their next order as goodwill\n2. Send the email via send_customer_notification.\n3. Return JSON: {\"resolved\": true, \"resolution_action\": string, \"refund_amount\": number, \"notification_sent\": boolean, \"customer_email\": string}",
        "maxIterations": 3
    }',
    ARRAY[tool_notify],
    'claude-3-5-sonnet',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

END $$;
