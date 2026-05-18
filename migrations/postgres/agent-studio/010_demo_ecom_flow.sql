-- Demo Seed: E-Commerce Complaint Resolution — Flow + Published Version
--
-- Creates the "E-Com Complaint Resolver" flow with a published graph version.
--
-- Graph topology (canvas layout):
--
--                       start (400, 50)
--                          |
--               complaint_classifier (400, 200)     ← agent: outputs {route, complaint_type, …}
--                          |
--                      parallel (400, 370)           ← fans out to 3 investigation branches
--                /          |           \
--   order_history_analyst  policy_compliance  sentiment_analyzer
--       (150, 540)            (400, 540)          (650, 540)
--                \          |           /
--                      aggregator (400, 710)         ← waits for all 3 branches
--                          |
--              resolution_recommender (400, 880)     ← agent: outputs {route:"high"|"low", …}
--                          |
--                    severity_router (400, 1050)     ← router node
--                   /                  \
--            [high]                        [low]
--         human_review (250, 1220)    auto_resolver (580, 1220)
--              |
--    escalation_handler (250, 1390)
--                   \                  /
--                         end (400, 1560)
--
-- Node data uses camelCase (agentId) to match CanvasNodeData serialisation.

DO $$
DECLARE
    t_id    uuid := 'b2c496ab-e57a-4065-800a-62022ec8d2d3';
    ws_id   uuid := 'b70393eb-8f36-4267-ac6b-7821b23eef3e';
    u_id    uuid := '818c9fe6-5068-417f-bcf0-05d344b36adb';
    flow_id uuid := '00000000-0000-0000-0042-000000000001';
    ver_id  uuid := '00000000-0000-0000-0042-000000000002';
BEGIN

-- ── Flow record ──────────────────────────────────────────────────────────────
INSERT INTO flows (
    id, tenant_id, workspace_id,
    name, description,
    status, current_version_id,
    created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    flow_id, t_id, ws_id,
    'E-Com Complaint Resolver',
    'Multi-agent customer complaint pipeline: classifies the complaint, runs parallel investigation '
    '(order history, policy check, sentiment), aggregates findings, then routes high-severity cases '
    'to human review and auto-resolves low-severity cases.',
    'active', ver_id,
    u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── Flow version (published) ─────────────────────────────────────────────────
INSERT INTO flow_versions (
    id, tenant_id, workspace_id,
    flow_id, version,
    graph_json, settings_json,
    status, created_by_user_id,
    created_at
) VALUES (
    ver_id, t_id, ws_id,
    flow_id, 1,
    '{
        "entry_node_id": "start",
        "nodes": {
            "start": {
                "type":     "start",
                "label":    "Start",
                "data":     {},
                "position": {"x": 400, "y": 50}
            },
            "complaint_classifier": {
                "type":  "agent",
                "label": "Complaint Classifier",
                "data":  {
                    "agentId":       "00000000-0000-0000-0041-000000000001",
                    "description":   "Classifies complaint type and extracts order/customer identifiers",
                    "maxIterations": 1
                },
                "position": {"x": 400, "y": 200}
            },
            "parallel_investigation": {
                "type":  "parallel",
                "label": "Parallel Investigation",
                "data":  {
                    "description": "Simultaneously investigates order history, policy compliance, and customer sentiment"
                },
                "position": {"x": 400, "y": 370}
            },
            "order_history_analyst": {
                "type":  "agent",
                "label": "Order History Analyst",
                "data":  {
                    "agentId":       "00000000-0000-0000-0041-000000000002",
                    "description":   "Retrieves order data and checks delivery discrepancies",
                    "maxIterations": 3
                },
                "position": {"x": 150, "y": 540}
            },
            "policy_compliance_agent": {
                "type":  "agent",
                "label": "Policy Compliance",
                "data":  {
                    "agentId":       "00000000-0000-0000-0041-000000000003",
                    "description":   "Checks return policy eligibility and calculates refund amount",
                    "maxIterations": 4
                },
                "position": {"x": 400, "y": 540}
            },
            "sentiment_analyzer": {
                "type":  "agent",
                "label": "Sentiment Analyzer",
                "data":  {
                    "agentId":       "00000000-0000-0000-0041-000000000004",
                    "description":   "Scores urgency, anger, churn risk, and escalation signals",
                    "maxIterations": 2
                },
                "position": {"x": 650, "y": 540}
            },
            "aggregator": {
                "type":  "aggregator",
                "label": "Aggregator",
                "data":  {
                    "description": "Collects results from order, policy, and sentiment branches"
                },
                "position": {"x": 400, "y": 710}
            },
            "resolution_recommender": {
                "type":  "agent",
                "label": "Resolution Recommender",
                "data":  {
                    "agentId":       "00000000-0000-0000-0041-000000000005",
                    "description":   "Synthesises investigation into a resolution plan and severity decision",
                    "maxIterations": 1
                },
                "position": {"x": 400, "y": 880}
            },
            "severity_router": {
                "type":  "router",
                "label": "Severity Router",
                "data":  {
                    "description": "Routes high-severity cases to human review; auto-resolves low-severity",
                    "routes": [
                        {"label": "high", "handle": "high"},
                        {"label": "low",  "handle": "low"}
                    ]
                },
                "position": {"x": 400, "y": 1050}
            },
            "human_review": {
                "type":  "human_review",
                "label": "Senior Agent Review",
                "data":  {
                    "description":    "High-severity complaint — senior support agent reviews and approves resolution",
                    "reviewer_role":  "senior_support",
                    "timeout_hours":  24,
                    "prompt_template": "Complaint flagged HIGH severity. Refund: ${refund_amount}. Urgency: {urgency_score}/100. Priority flags: {priority_flags}. Approve resolution or escalate further?"
                },
                "position": {"x": 220, "y": 1220}
            },
            "escalation_handler": {
                "type":  "agent",
                "label": "Escalation Handler",
                "data":  {
                    "agentId":       "00000000-0000-0000-0041-000000000006",
                    "description":   "Sends holding email to customer and escalation brief to support team",
                    "maxIterations": 4
                },
                "position": {"x": 220, "y": 1390}
            },
            "auto_resolver": {
                "type":  "agent",
                "label": "Auto Resolver",
                "data":  {
                    "agentId":       "00000000-0000-0000-0041-000000000007",
                    "description":   "Issues refund/replacement and sends resolution email to customer",
                    "maxIterations": 3
                },
                "position": {"x": 600, "y": 1220}
            },
            "end": {
                "type":     "end",
                "label":    "End",
                "data":     {},
                "position": {"x": 400, "y": 1560}
            }
        },
        "edges": [
            {"id": "e-start-classifier",      "source": "start",                  "target": "complaint_classifier"},
            {"id": "e-classifier-parallel",   "source": "complaint_classifier",   "target": "parallel_investigation"},
            {"id": "e-parallel-order",        "source": "parallel_investigation", "target": "order_history_analyst"},
            {"id": "e-parallel-policy",       "source": "parallel_investigation", "target": "policy_compliance_agent"},
            {"id": "e-parallel-sentiment",    "source": "parallel_investigation", "target": "sentiment_analyzer"},
            {"id": "e-order-agg",             "source": "order_history_analyst",  "target": "aggregator"},
            {"id": "e-policy-agg",            "source": "policy_compliance_agent","target": "aggregator"},
            {"id": "e-sentiment-agg",         "source": "sentiment_analyzer",     "target": "aggregator"},
            {"id": "e-agg-recommender",       "source": "aggregator",             "target": "resolution_recommender"},
            {"id": "e-recommender-router",    "source": "resolution_recommender", "target": "severity_router"},
            {
                "id": "e-router-high", "source": "severity_router", "target": "human_review",
                "label": "high", "sourceHandle": "high"
            },
            {
                "id": "e-router-low",  "source": "severity_router", "target": "auto_resolver",
                "label": "low",  "sourceHandle": "low"
            },
            {"id": "e-review-escalate",  "source": "human_review",       "target": "escalation_handler"},
            {"id": "e-escalate-end",     "source": "escalation_handler",  "target": "end"},
            {"id": "e-resolver-end",     "source": "auto_resolver",       "target": "end"}
        ]
    }',
    '{
        "timeout_seconds": 300,
        "retry_on_failure": false,
        "description": "Routes high-urgency complaints to human review and auto-resolves routine cases."
    }',
    'published', u_id, NOW()
) ON CONFLICT (id) DO NOTHING;

END $$;
