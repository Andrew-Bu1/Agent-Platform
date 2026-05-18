-- Demo Seed: HR Talent Acquisition — Flow + Published Version
--
-- Creates the "HR Talent Screener" flow with a published graph version.
--
-- Graph topology (canvas layout):
--
--                         start (400, 50)
--                            |
--                       cv_parser (400, 200)          ← agent: parses CV + fetches JD
--                            |
--                        parallel (400, 370)           ← fans out to 3 specialist agents
--                   /          |          \
--    skills_extractor      experience_scorer    culture_fit_assessor
--       (150, 540)            (400, 540)            (650, 540)
--                   \          |          /
--                       aggregator (400, 710)          ← waits for all 3 branches
--                            |
--                  candidate_recommender (400, 880)    ← agent: outputs {route:"approve"|"interview"|"reject"}
--                            |
--                      hire_router (400, 1050)         ← router node
--                   /         |          \
--           approve       interview       reject
--        offer_drafter  human_review  rejection_notifier
--          (150,1220)    (400,1220)      (650,1220)
--                   \         |          /
--                          end (400, 1450)
--
-- Node data uses camelCase (agentId) to match CanvasNodeData serialisation.

DO $$
DECLARE
    t_id    uuid := '0e5cc1dd-108f-4c2a-b29a-386d799546ae';
    ws_id   uuid := 'd1153e82-359a-4e9f-ab8d-cec7d1e3c144';
    u_id    uuid := '818c9fe6-5068-417f-bcf0-05d344b36adb';
    flow_id uuid := '00000000-0000-0000-0032-000000000001';
    ver_id  uuid := '00000000-0000-0000-0032-000000000002';
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
    'HR Talent Screener',
    'Multi-agent HR pipeline that parses a CV, runs parallel specialist evaluations '
    '(skills, experience, culture fit), aggregates results, and routes to offer / '
    'human interview review / rejection — with human-in-the-loop for borderline candidates.',
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
            "cv_parser": {
                "type":  "agent",
                "label": "CV Parser",
                "data":  {
                    "agentId":       "00000000-0000-0000-0031-000000000001",
                    "description":   "Parses raw CV text and fetches job description requirements",
                    "maxIterations": 3
                },
                "position": {"x": 400, "y": 200}
            },
            "parallel_eval": {
                "type":  "parallel",
                "label": "Parallel Evaluation",
                "data":  {
                    "description": "Runs skills, experience, and culture fit evaluations simultaneously"
                },
                "position": {"x": 400, "y": 370}
            },
            "skills_extractor": {
                "type":  "agent",
                "label": "Skills Extractor",
                "data":  {
                    "agentId":       "00000000-0000-0000-0031-000000000002",
                    "description":   "Scores candidate skills vs. job requirements",
                    "maxIterations": 3
                },
                "position": {"x": 150, "y": 540}
            },
            "experience_scorer": {
                "type":  "agent",
                "label": "Experience Scorer",
                "data":  {
                    "agentId":       "00000000-0000-0000-0031-000000000003",
                    "description":   "Scores candidate experience vs. seniority requirements",
                    "maxIterations": 3
                },
                "position": {"x": 400, "y": 540}
            },
            "culture_fit_assessor": {
                "type":  "agent",
                "label": "Culture Fit Assessor",
                "data":  {
                    "agentId":       "00000000-0000-0000-0031-000000000004",
                    "description":   "Evaluates cultural fit signals from CV language and tenure",
                    "maxIterations": 1
                },
                "position": {"x": 650, "y": 540}
            },
            "aggregator": {
                "type":  "aggregator",
                "label": "Aggregator",
                "data":  {
                    "description": "Collects results from all three parallel evaluation branches"
                },
                "position": {"x": 400, "y": 710}
            },
            "candidate_recommender": {
                "type":  "agent",
                "label": "Candidate Recommender",
                "data":  {
                    "agentId":       "00000000-0000-0000-0031-000000000005",
                    "description":   "Synthesises scores into approve / interview / reject decision",
                    "maxIterations": 1
                },
                "position": {"x": 400, "y": 880}
            },
            "hire_router": {
                "type":  "router",
                "label": "Hire Decision Router",
                "data":  {
                    "description": "Routes based on candidate_recommender output {route}",
                    "routes": [
                        {"label": "approve",   "handle": "approve"},
                        {"label": "interview", "handle": "interview"},
                        {"label": "reject",    "handle": "reject"}
                    ]
                },
                "position": {"x": 400, "y": 1050}
            },
            "offer_drafter": {
                "type":  "agent",
                "label": "Offer Drafter",
                "data":  {
                    "agentId":       "00000000-0000-0000-0031-000000000006",
                    "description":   "Generates offer letter and emails the candidate",
                    "maxIterations": 4
                },
                "position": {"x": 100, "y": 1220}
            },
            "human_review": {
                "type":  "human_review",
                "label": "HR Human Review",
                "data":  {
                    "description":    "Borderline candidate — human recruiter decides: approve or reject",
                    "reviewer_role":  "hr_recruiter",
                    "timeout_hours":  48,
                    "prompt_template":"Candidate scored {overall_score}/100. Review the evaluation and choose: Approve for offer or Reject."
                },
                "position": {"x": 400, "y": 1220}
            },
            "rejection_notifier": {
                "type":  "agent",
                "label": "Rejection Notifier",
                "data":  {
                    "agentId":       "00000000-0000-0000-0031-000000000007",
                    "description":   "Sends a respectful rejection email to the candidate",
                    "maxIterations": 3
                },
                "position": {"x": 700, "y": 1220}
            },
            "end": {
                "type":     "end",
                "label":    "End",
                "data":     {},
                "position": {"x": 400, "y": 1450}
            }
        },
        "edges": [
            {"id": "e-start-parser",       "source": "start",              "target": "cv_parser"},
            {"id": "e-parser-parallel",    "source": "cv_parser",          "target": "parallel_eval"},
            {"id": "e-parallel-skills",    "source": "parallel_eval",      "target": "skills_extractor"},
            {"id": "e-parallel-exp",       "source": "parallel_eval",      "target": "experience_scorer"},
            {"id": "e-parallel-culture",   "source": "parallel_eval",      "target": "culture_fit_assessor"},
            {"id": "e-skills-agg",         "source": "skills_extractor",   "target": "aggregator"},
            {"id": "e-exp-agg",            "source": "experience_scorer",  "target": "aggregator"},
            {"id": "e-culture-agg",        "source": "culture_fit_assessor","target": "aggregator"},
            {"id": "e-agg-recommender",    "source": "aggregator",         "target": "candidate_recommender"},
            {"id": "e-recommender-router", "source": "candidate_recommender","target": "hire_router"},
            {
                "id": "e-router-approve", "source": "hire_router", "target": "offer_drafter",
                "label": "approve", "sourceHandle": "approve"
            },
            {
                "id": "e-router-interview", "source": "hire_router", "target": "human_review",
                "label": "interview", "sourceHandle": "interview"
            },
            {
                "id": "e-router-reject", "source": "hire_router", "target": "rejection_notifier",
                "label": "reject", "sourceHandle": "reject"
            },
            {"id": "e-offer-end",     "source": "offer_drafter",      "target": "end"},
            {"id": "e-review-end",    "source": "human_review",        "target": "end"},
            {"id": "e-rejected-end",  "source": "rejection_notifier",  "target": "end"}
        ]
    }',
    '{
        "timeout_seconds": 600,
        "retry_on_failure": false,
        "description": "End-to-end CV screening with parallel specialist agents and human review for borderline decisions."
    }',
    'published', u_id, NOW()
) ON CONFLICT (id) DO NOTHING;

END $$;
