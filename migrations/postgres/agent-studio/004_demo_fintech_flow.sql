-- Demo Seed: FinAI Assistant — Flow + Published Version
--
-- Creates the "FinAI Assistant" flow with a published graph version.
--
-- Graph topology (canvas layout):
--
--                        start (400, 50)
--                           |
--                     intent_router (400, 200)   ← agent: outputs {route:"report"|"analysis"}
--                           |
--                     route_decision (400, 370)  ← router node
--                    /                 \
--          [report]                      [analysis]
--      report_team (150, 540)       analysis_team (650, 540)
--              \                           /
--                       end (400, 720)
--
-- Node data uses camelCase field names (agentId, memberAgentIds) to match the
-- frontend CanvasNodeData serialisation and the agent-worker NodeAgentConfig.

DO $$
DECLARE
    t_id     uuid := '00000000-0000-0000-0003-000000000001';
    ws_id    uuid := '00000000-0000-0000-0005-000000000001';
    u_id     uuid := '00000000-0000-0000-0002-000000000001';
    flow_id  uuid := '00000000-0000-0000-0012-000000000001';
    ver_id   uuid := '00000000-0000-0000-0012-000000000002';
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
    'FinAI Assistant',
    'Multi-agent financial assistant that routes user queries to either a Report & Chart team '
    'or a Quantitative Analysis team, powered by Claude.',
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
    -- ── graph_json ────────────────────────────────────────────────────────
    -- Fields: type, label, data (camelCase, matches CanvasNodeData), position {x,y}
    '{
        "entry_node_id": "start",
        "nodes": {
            "start": {
                "type":     "start",
                "label":    "Start",
                "data":     {},
                "position": {"x": 400, "y": 50}
            },
            "intent_router": {
                "type":  "agent",
                "label": "Intent Router",
                "data":  {
                    "agentId":       "00000000-0000-0000-0011-000000000001",
                    "description":   "Classifies the user query and outputs {\"route\":\"report\"} or {\"route\":\"analysis\"}",
                    "maxIterations": 1
                },
                "position": {"x": 400, "y": 200}
            },
            "route_decision": {
                "type":  "router",
                "label": "Route Decision",
                "data":  {
                    "description": "Routes to Report team or Analysis team based on intent_router output",
                    "routes": [
                        {"label": "report",   "handle": "report"},
                        {"label": "analysis", "handle": "analysis"}
                    ]
                },
                "position": {"x": 400, "y": 370}
            },
            "report_team": {
                "type":  "agent_team",
                "label": "Report & Chart Team",
                "data":  {
                    "agentId":         "00000000-0000-0000-0011-000000000002",
                    "description":     "Supervisor-driven team: market_analyst fetches data, chart_generator produces visuals",
                    "memberAgentIds":  [
                        "00000000-0000-0000-0011-000000000003",
                        "00000000-0000-0000-0011-000000000004"
                    ],
                    "maxIterations":   10
                },
                "position": {"x": 150, "y": 540}
            },
            "analysis_team": {
                "type":  "agent_team",
                "label": "Financial Analysis Team",
                "data":  {
                    "agentId":         "00000000-0000-0000-0011-000000000005",
                    "description":     "Supervisor-driven team: data_aggregator collects data, quant_analyst runs metrics",
                    "memberAgentIds":  [
                        "00000000-0000-0000-0011-000000000006",
                        "00000000-0000-0000-0011-000000000007"
                    ],
                    "maxIterations":   10
                },
                "position": {"x": 650, "y": 540}
            },
            "end": {
                "type":     "end",
                "label":    "End",
                "data":     {},
                "position": {"x": 400, "y": 720}
            }
        },
        "edges": [
            {
                "id":     "e-start-router",
                "source": "start",
                "target": "intent_router"
            },
            {
                "id":     "e-router-decision",
                "source": "intent_router",
                "target": "route_decision"
            },
            {
                "id":           "e-decision-report",
                "source":       "route_decision",
                "target":       "report_team",
                "label":        "report",
                "sourceHandle": "report"
            },
            {
                "id":           "e-decision-analysis",
                "source":       "route_decision",
                "target":       "analysis_team",
                "label":        "analysis",
                "sourceHandle": "analysis"
            },
            {
                "id":     "e-report-end",
                "source": "report_team",
                "target": "end"
            },
            {
                "id":     "e-analysis-end",
                "source": "analysis_team",
                "target": "end"
            }
        ]
    }',
    -- ── settings_json ─────────────────────────────────────────────────────
    '{
        "timeout_seconds": 300,
        "retry_on_failure": false,
        "description": "Routes financial queries to the Report team (charts + news) or Analysis team (quant metrics)."
    }',
    'published', u_id, NOW()
) ON CONFLICT (id) DO NOTHING;

END $$;
