-- Demo Seed: HR Talent Acquisition — Tools
--
-- Six tools used by the HR multi-agent demo flow.
-- UUIDs are fixed for idempotency (ON CONFLICT DO NOTHING).
--
-- Tenant / workspace context:
--   tenant_id    = 00000000-0000-0000-0003-000000000002  (demo-hr, seeded in V10)
--   workspace_id = 00000000-0000-0000-0005-000000000002
--   created_by   = 00000000-0000-0000-0002-000000000002

DO $$
DECLARE
    t_id  uuid := '0e5cc1dd-108f-4c2a-b29a-386d799546ae';
    ws_id uuid := 'd1153e82-359a-4e9f-ab8d-cec7d1e3c144';
    u_id  uuid := '818c9fe6-5068-417f-bcf0-05d344b36adb';
BEGIN

-- ── 1. parse_resume ─────────────────────────────────────────────────────────
INSERT INTO tools (
    id, tenant_id, workspace_id,
    name, description, tool_type,
    input_schema, output_schema, config_json, approval_policy_json,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0030-000000000001', t_id, ws_id,
    'parse_resume',
    'Parses plain-text CV/resume into a structured JSON object with contact info, skills, education, and work history.',
    'code',
    '{
        "type": "object",
        "required": ["resume_text"],
        "properties": {
            "resume_text": {
                "type": "string",
                "description": "Raw plain-text content of the CV"
            }
        }
    }',
    '{
        "type": "object",
        "properties": {
            "name":           {"type": "string"},
            "email":          {"type": "string"},
            "phone":          {"type": "string"},
            "skills":         {"type": "array", "items": {"type": "string"}},
            "years_experience": {"type": "number"},
            "education":      {"type": "array", "items": {"type": "object"}},
            "work_history":   {"type": "array", "items": {"type": "object"}},
            "summary":        {"type": "string"}
        }
    }',
    '{
        "runtime": "python3",
        "code": "import re\n\ndef run(resume_text):\n    lines = resume_text.strip().split(\"\\n\")\n    name = lines[0].strip() if lines else \"Unknown\"\n    email_match = re.search(r\"[\\w.+-]+@[\\w-]+\\.[\\w.]+\", resume_text)\n    phone_match = re.search(r\"[\\+]?[\\d\\s\\-\\(\\)]{7,15}\", resume_text)\n    skills_section = re.search(r\"(?i)skills?:?(.+?)(?=\\n[A-Z]|$)\", resume_text, re.DOTALL)\n    skills = [s.strip() for s in skills_section.group(1).split(\",\")] if skills_section else []\n    exp_match = re.search(r\"(\\d+)\\+?\\s*years?\", resume_text, re.IGNORECASE)\n    years_exp = int(exp_match.group(1)) if exp_match else 0\n    return {\n        \"name\": name,\n        \"email\": email_match.group(0) if email_match else \"\",\n        \"phone\": phone_match.group(0).strip() if phone_match else \"\",\n        \"skills\": skills[:20],\n        \"years_experience\": years_exp,\n        \"education\": [],\n        \"work_history\": [],\n        \"summary\": resume_text[:300]\n    }\n"
    }',
    '{"require_approval": false}',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 2. search_job_requirements ───────────────────────────────────────────────
INSERT INTO tools (
    id, tenant_id, workspace_id,
    name, description, tool_type,
    input_schema, output_schema, config_json, approval_policy_json,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0030-000000000002', t_id, ws_id,
    'search_job_requirements',
    'Searches the HR knowledge base for job description and required competencies for a given role.',
    'http',
    '{
        "type": "object",
        "required": ["role_title"],
        "properties": {
            "role_title": {
                "type": "string",
                "description": "Job title to search for (e.g. Senior Software Engineer)"
            },
            "department": {
                "type": "string",
                "description": "Department or team (optional)"
            }
        }
    }',
    '{
        "type": "object",
        "properties": {
            "role_title":           {"type": "string"},
            "required_skills":      {"type": "array", "items": {"type": "string"}},
            "preferred_skills":     {"type": "array", "items": {"type": "string"}},
            "min_years_experience": {"type": "number"},
            "education_required":   {"type": "string"},
            "responsibilities":     {"type": "array", "items": {"type": "string"}}
        }
    }',
    '{
        "url":    "http://datahub-service/v1/search",
        "method": "POST",
        "headers": {"Content-Type": "application/json"},
        "timeout_ms": 8000
    }',
    '{"require_approval": false}',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 3. score_skills_match ────────────────────────────────────────────────────
INSERT INTO tools (
    id, tenant_id, workspace_id,
    name, description, tool_type,
    input_schema, output_schema, config_json, approval_policy_json,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0030-000000000003', t_id, ws_id,
    'score_skills_match',
    'Calculates a 0-100 skills match score between candidate skills and job requirements.',
    'code',
    '{
        "type": "object",
        "required": ["candidate_skills", "required_skills"],
        "properties": {
            "candidate_skills": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Skills listed on the candidate CV"
            },
            "required_skills": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Skills required for the role"
            },
            "preferred_skills": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Nice-to-have skills (weighted lower)"
            }
        }
    }',
    '{
        "type": "object",
        "properties": {
            "score":           {"type": "number", "description": "0-100 match score"},
            "matched":         {"type": "array",  "items": {"type": "string"}},
            "missing":         {"type": "array",  "items": {"type": "string"}},
            "bonus_matched":   {"type": "array",  "items": {"type": "string"}},
            "grade":           {"type": "string", "enum": ["A","B","C","D","F"]}
        }
    }',
    '{
        "runtime": "python3",
        "code": "def run(candidate_skills, required_skills, preferred_skills=None):\n    preferred_skills = preferred_skills or []\n    cset = set(s.lower() for s in candidate_skills)\n    rset = set(s.lower() for s in required_skills)\n    pset = set(s.lower() for s in preferred_skills)\n    matched = [s for s in required_skills if s.lower() in cset]\n    missing = [s for s in required_skills if s.lower() not in cset]\n    bonus  = [s for s in preferred_skills if s.lower() in cset]\n    base_score  = (len(matched) / len(required_skills) * 80) if required_skills else 0\n    bonus_score = (len(bonus)   / len(preferred_skills) * 20) if preferred_skills else 0\n    score = round(min(base_score + bonus_score, 100), 1)\n    grade = \"A\" if score >= 85 else \"B\" if score >= 70 else \"C\" if score >= 55 else \"D\" if score >= 40 else \"F\"\n    return {\"score\": score, \"matched\": matched, \"missing\": missing, \"bonus_matched\": bonus, \"grade\": grade}\n"
    }',
    '{"require_approval": false}',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 4. evaluate_experience ───────────────────────────────────────────────────
INSERT INTO tools (
    id, tenant_id, workspace_id,
    name, description, tool_type,
    input_schema, output_schema, config_json, approval_policy_json,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0030-000000000004', t_id, ws_id,
    'evaluate_experience',
    'Scores candidate experience (0-100) based on years, role relevance, and seniority level alignment.',
    'code',
    '{
        "type": "object",
        "required": ["candidate_years", "required_min_years"],
        "properties": {
            "candidate_years":      {"type": "number", "description": "Total years of relevant experience"},
            "required_min_years":   {"type": "number", "description": "Minimum years required by the role"},
            "previous_role_titles": {"type": "array", "items": {"type": "string"}},
            "target_seniority":     {"type": "string", "enum": ["junior","mid","senior","staff","principal","director"]}
        }
    }',
    '{
        "type": "object",
        "properties": {
            "score":            {"type": "number"},
            "seniority_match":  {"type": "boolean"},
            "years_gap":        {"type": "number"},
            "recommendation":   {"type": "string"}
        }
    }',
    '{
        "runtime": "python3",
        "code": "def run(candidate_years, required_min_years, previous_role_titles=None, target_seniority=\"mid\"):\n    seniority_map = {\"junior\": (0,2), \"mid\": (2,5), \"senior\": (5,10), \"staff\": (8,15), \"principal\": (12,20), \"director\": (10,25)}\n    lo, hi = seniority_map.get(target_seniority, (2,5))\n    years_gap = max(0, required_min_years - candidate_years)\n    meets_min = candidate_years >= required_min_years\n    seniority_match = lo <= candidate_years <= hi + 5\n    base_score = min(candidate_years / max(required_min_years, 1) * 70, 70) if meets_min else candidate_years / max(required_min_years, 1) * 50\n    seniority_bonus = 30 if seniority_match else 10\n    score = round(min(base_score + seniority_bonus, 100), 1)\n    rec = \"Strong match\" if score >= 80 else \"Acceptable\" if score >= 60 else \"Below requirement\"\n    return {\"score\": score, \"seniority_match\": seniority_match, \"years_gap\": years_gap, \"recommendation\": rec}\n"
    }',
    '{"require_approval": false}',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 5. send_hr_notification ──────────────────────────────────────────────────
INSERT INTO tools (
    id, tenant_id, workspace_id,
    name, description, tool_type,
    input_schema, output_schema, config_json, approval_policy_json,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0030-000000000005', t_id, ws_id,
    'send_hr_notification',
    'Sends an email or Slack notification to the HR team or directly to the candidate.',
    'http',
    '{
        "type": "object",
        "required": ["recipient_email", "subject", "body"],
        "properties": {
            "recipient_email": {"type": "string", "format": "email"},
            "subject":         {"type": "string"},
            "body":            {"type": "string"},
            "channel":         {"type": "string", "enum": ["email","slack"], "default": "email"},
            "cc":              {"type": "array", "items": {"type": "string", "format": "email"}}
        }
    }',
    '{
        "type": "object",
        "properties": {
            "message_id": {"type": "string"},
            "sent_at":    {"type": "string", "format": "date-time"},
            "status":     {"type": "string", "enum": ["sent","queued","failed"]}
        }
    }',
    '{
        "url":    "https://api.sendgrid.com/v3/mail/send",
        "method": "POST",
        "headers": {
            "Authorization": "Bearer {{SENDGRID_API_KEY}}",
            "Content-Type":  "application/json"
        },
        "timeout_ms": 5000
    }',
    '{"require_approval": false}',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 6. generate_offer_letter ─────────────────────────────────────────────────
INSERT INTO tools (
    id, tenant_id, workspace_id,
    name, description, tool_type,
    input_schema, output_schema, config_json, approval_policy_json,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0030-000000000006', t_id, ws_id,
    'generate_offer_letter',
    'Generates a structured employment offer letter with compensation, start date, and role details.',
    'code',
    '{
        "type": "object",
        "required": ["candidate_name", "role_title", "salary", "start_date"],
        "properties": {
            "candidate_name":  {"type": "string"},
            "role_title":      {"type": "string"},
            "department":      {"type": "string"},
            "salary":          {"type": "number", "description": "Annual gross salary in USD"},
            "start_date":      {"type": "string", "format": "date"},
            "equity_options":  {"type": "integer", "description": "Number of stock options granted"},
            "probation_months":{"type": "integer", "default": 3}
        }
    }',
    '{
        "type": "object",
        "properties": {
            "letter_text":  {"type": "string"},
            "offer_summary":{"type": "object"}
        }
    }',
    '{
        "runtime": "python3",
        "code": "from datetime import datetime\n\ndef run(candidate_name, role_title, salary, start_date, department=\"Engineering\", equity_options=0, probation_months=3):\n    equity_clause = f\"\\nEquity: {equity_options:,} stock options vesting over 4 years with a 1-year cliff.\" if equity_options else \"\"\n    letter = f\"\"\"Dear {candidate_name},\\n\\nWe are delighted to offer you the position of {role_title} at our company, within the {department} department.\\n\\nStart Date: {start_date}\\nAnnual Salary: ${salary:,.0f}\\nProbation Period: {probation_months} months{equity_clause}\\n\\nThis offer is contingent upon successful background verification. Please confirm your acceptance within 5 business days.\\n\\nWelcome to the team!\\n\\nHR Team\"\"\"\n    return {\"letter_text\": letter, \"offer_summary\": {\"candidate\": candidate_name, \"role\": role_title, \"salary_usd\": salary, \"start_date\": start_date}}\n"
    }',
    '{"require_approval": true, "approver_role": "hr_manager"}',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

END $$;
