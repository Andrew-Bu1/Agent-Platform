-- Demo Seed: HR Talent Acquisition — Agents
--
-- Seven agents for the HR multi-agent demo flow.
--
-- Role map:
--   cv_parser             → extracts structured data from raw resume text
--   skills_extractor      → parallel: matches candidate skills to job requirements
--   experience_scorer     → parallel: scores candidate experience vs. role requirements
--   culture_fit_assessor  → parallel: evaluates cultural fit indicators from CV language
--   candidate_recommender → aggregates parallel results into hire/interview/reject decision
--   offer_drafter         → (approve path) generates the employment offer letter
--   rejection_notifier    → (reject path) composes a professional rejection notification

DO $$
DECLARE
    t_id  uuid := '0e5cc1dd-108f-4c2a-b29a-386d799546ae';
    ws_id uuid := 'd1153e82-359a-4e9f-ab8d-cec7d1e3c144';
    u_id  uuid := '818c9fe6-5068-417f-bcf0-05d344b36adb';

    -- Tool IDs (from 005_demo_hr_tools.sql)
    tool_parse_cv     uuid := '00000000-0000-0000-0030-000000000001';
    tool_search_jd    uuid := '00000000-0000-0000-0030-000000000002';
    tool_score_skills uuid := '00000000-0000-0000-0030-000000000003';
    tool_eval_exp     uuid := '00000000-0000-0000-0030-000000000004';
    tool_notify_hr    uuid := '00000000-0000-0000-0030-000000000005';
    tool_offer_letter uuid := '00000000-0000-0000-0030-000000000006';
BEGIN

-- ── 1. CV Parser ─────────────────────────────────────────────────────────────
INSERT INTO agents (
    id, tenant_id, workspace_id,
    name, description, agent_kind,
    definition_json, tool_ids, model_id,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0031-000000000001', t_id, ws_id,
    'cv_parser',
    'Parses incoming CV text into a structured JSON profile ready for specialist evaluation.',
    'react',
    '{
        "systemPrompt": "You are a CV Parser AI. When given raw resume/CV text:\n1. Use parse_resume to extract structured data (name, email, skills, years_experience, work_history).\n2. Use search_job_requirements with the inferred role title to fetch what the role demands.\n3. Return a single JSON object with keys: candidate_profile (parsed CV data) and job_requirements (fetched requirements).\n\nDo not evaluate or score — only parse and retrieve. Output pure JSON.",
        "maxIterations": 3
    }',
    ARRAY[tool_parse_cv, tool_search_jd],
    'claude-3-5-sonnet',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 2. Skills Extractor ──────────────────────────────────────────────────────
INSERT INTO agents (
    id, tenant_id, workspace_id,
    name, description, agent_kind,
    definition_json, tool_ids, model_id,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0031-000000000002', t_id, ws_id,
    'skills_extractor',
    'Parallel specialist: scores candidate skills against job requirements and identifies gaps.',
    'react',
    '{
        "systemPrompt": "You are a Skills Evaluation Specialist AI. Given a candidate_profile and job_requirements from the input:\n1. Use score_skills_match with the candidate''s skills list, required_skills, and preferred_skills from the job.\n2. Summarise the top 3 matched skills and top 3 missing skills.\n3. Return JSON with keys: skills_score (0-100), grade (A-F), matched, missing, summary.",
        "maxIterations": 3
    }',
    ARRAY[tool_score_skills],
    'claude-3-5-sonnet',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 3. Experience Scorer ─────────────────────────────────────────────────────
INSERT INTO agents (
    id, tenant_id, workspace_id,
    name, description, agent_kind,
    definition_json, tool_ids, model_id,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0031-000000000003', t_id, ws_id,
    'experience_scorer',
    'Parallel specialist: scores candidate experience against role seniority and years requirements.',
    'react',
    '{
        "systemPrompt": "You are an Experience Evaluator AI. Given candidate_profile and job_requirements from the input:\n1. Use evaluate_experience with candidate_years, required_min_years, previous_role_titles, and target_seniority.\n2. Comment on any career progression patterns visible in the work history.\n3. Return JSON with keys: experience_score (0-100), seniority_match (boolean), years_gap, recommendation, notes.",
        "maxIterations": 3
    }',
    ARRAY[tool_eval_exp],
    'claude-3-5-sonnet',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 4. Culture Fit Assessor ──────────────────────────────────────────────────
INSERT INTO agents (
    id, tenant_id, workspace_id,
    name, description, agent_kind,
    definition_json, tool_ids, model_id,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0031-000000000004', t_id, ws_id,
    'culture_fit_assessor',
    'Parallel specialist: evaluates cultural fit indicators from CV language, company tenure, and cross-functional experience.',
    'react',
    '{
        "systemPrompt": "You are a Cultural Fit Assessor AI. Given candidate_profile from the input, analyse the CV text for cultural signals:\n\n- Collaboration indicators: mentions of teamwork, cross-functional projects, mentoring.\n- Growth mindset: certifications, side projects, open-source contributions, continuous learning.\n- Stability vs adaptability: average tenure at previous companies, frequency of role changes.\n- Communication quality: clarity and professionalism of the written summary.\n\nDo NOT use any tools. Return a JSON object with keys:\n- culture_fit_score: integer 0-100\n- collaboration_score: integer 0-100\n- growth_mindset_score: integer 0-100\n- stability_score: integer 0-100\n- red_flags: array of strings (concerns, if any)\n- green_flags: array of strings (positive signals)\n- culture_summary: string (2-3 sentence assessment)",
        "maxIterations": 1
    }',
    ARRAY[]::uuid[],
    'claude-3-5-sonnet',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 5. Candidate Recommender ─────────────────────────────────────────────────
INSERT INTO agents (
    id, tenant_id, workspace_id,
    name, description, agent_kind,
    definition_json, tool_ids, model_id,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0031-000000000005', t_id, ws_id,
    'candidate_recommender',
    'Synthesises parallel evaluation results into a final hire / interview / reject recommendation.',
    'react',
    '{
        "systemPrompt": "You are a Senior HR Decision AI. You receive aggregated results from three specialists:\n- skills_extractor: skills_score, grade, matched, missing\n- experience_scorer: experience_score, seniority_match, recommendation\n- culture_fit_assessor: culture_fit_score, red_flags, green_flags\n\nDecision logic:\n- \"approve\"  → overall_score >= 75 AND no critical red_flags\n- \"interview\" → overall_score 50-74 OR minor red_flags that need clarification\n- \"reject\"    → overall_score < 50 OR critical red_flags (e.g. misrepresentation)\n\nOverall score = (skills_score * 0.4) + (experience_score * 0.35) + (culture_fit_score * 0.25)\n\nRespond ONLY with a JSON object:\n{\n  \"route\": \"approve\" | \"interview\" | \"reject\",\n  \"overall_score\": <number>,\n  \"rationale\": \"<2-3 sentences>\",\n  \"strengths\": [\"...\"],\n  \"concerns\": [\"...\"]\n}",
        "maxIterations": 1
    }',
    ARRAY[]::uuid[],
    'claude-3-5-sonnet',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 6. Offer Drafter ─────────────────────────────────────────────────────────
INSERT INTO agents (
    id, tenant_id, workspace_id,
    name, description, agent_kind,
    definition_json, tool_ids, model_id,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0031-000000000006', t_id, ws_id,
    'offer_drafter',
    'Generates an employment offer letter and notifies the candidate by email.',
    'react',
    '{
        "systemPrompt": "You are an Offer Letter AI. Given the candidate recommendation data:\n1. Use generate_offer_letter with candidate_name, role_title, a salary determined from the role band, and a start_date 2 weeks from today.\n2. Use send_hr_notification to email the generated letter to the candidate and CC the hiring manager.\n3. Return a summary JSON with keys: offer_sent (boolean), candidate_email, salary_offered, start_date.",
        "maxIterations": 4
    }',
    ARRAY[tool_offer_letter, tool_notify_hr],
    'claude-3-5-sonnet',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 7. Rejection Notifier ────────────────────────────────────────────────────
INSERT INTO agents (
    id, tenant_id, workspace_id,
    name, description, agent_kind,
    definition_json, tool_ids, model_id,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0031-000000000007', t_id, ws_id,
    'rejection_notifier',
    'Composes a respectful rejection email and sends it to the candidate.',
    'react',
    '{
        "systemPrompt": "You are a Candidate Communication AI. Given the candidate recommendation data (route=reject):\n1. Compose a professional, empathetic rejection email. Acknowledge their application, briefly note the decision without stating specific scores, and encourage them to apply for future roles.\n2. Use send_hr_notification to send the email to the candidate.\n3. Return JSON: {\"notification_sent\": true, \"candidate_email\": \"...\", \"message_preview\": \"<first 100 chars of body>\"}",
        "maxIterations": 3
    }',
    ARRAY[tool_notify_hr],
    'claude-3-5-sonnet',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

END $$;
