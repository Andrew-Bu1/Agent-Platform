-- Demo Seed: E-Commerce Complaint Resolution — Tools
--
-- Six tools used by the e-commerce multi-agent demo flow.
-- UUIDs are fixed for idempotency (ON CONFLICT DO NOTHING).
--
-- Tenant / workspace context:
--   tenant_id    = 00000000-0000-0000-0003-000000000003  (demo-ecom, seeded in V10)
--   workspace_id = 00000000-0000-0000-0005-000000000003
--   created_by   = 00000000-0000-0000-0002-000000000003

DO $$
DECLARE
    t_id  uuid := 'b2c496ab-e57a-4065-800a-62022ec8d2d3';
    ws_id uuid := 'b70393eb-8f36-4267-ac6b-7821b23eef3e';
    u_id  uuid := '818c9fe6-5068-417f-bcf0-05d344b36adb';
BEGIN

-- ── 1. search_order_history ──────────────────────────────────────────────────
INSERT INTO tools (
    id, tenant_id, workspace_id,
    name, description, tool_type,
    input_schema, output_schema, config_json, approval_policy_json,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0040-000000000001', t_id, ws_id,
    'search_order_history',
    'Retrieves order history and current order status for a given customer or order ID.',
    'http',
    '{
        "type": "object",
        "properties": {
            "order_id":    {"type": "string", "description": "Order ID (e.g. ORD-123456)"},
            "customer_id": {"type": "string", "description": "Customer account ID"},
            "email":       {"type": "string", "format": "email", "description": "Customer email"}
        }
    }',
    '{
        "type": "object",
        "properties": {
            "order_id":       {"type": "string"},
            "status":         {"type": "string", "enum": ["pending","shipped","delivered","returned","cancelled"]},
            "placed_at":      {"type": "string", "format": "date-time"},
            "shipped_at":     {"type": "string", "format": "date-time"},
            "delivered_at":   {"type": "string", "format": "date-time"},
            "items":          {"type": "array", "items": {"type": "object"}},
            "total_amount":   {"type": "number"},
            "shipping_addr":  {"type": "string"},
            "carrier":        {"type": "string"},
            "tracking_no":    {"type": "string"}
        }
    }',
    '{
        "url":    "https://api.internal/orders/search",
        "method": "GET",
        "headers": {
            "Accept":        "application/json",
            "Authorization": "Bearer {{ORDER_API_KEY}}"
        },
        "timeout_ms": 5000
    }',
    '{"require_approval": false}',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 2. check_return_policy ───────────────────────────────────────────────────
INSERT INTO tools (
    id, tenant_id, workspace_id,
    name, description, tool_type,
    input_schema, output_schema, config_json, approval_policy_json,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0040-000000000002', t_id, ws_id,
    'check_return_policy',
    'Looks up the return and refund policy for a product category via the knowledge base.',
    'http',
    '{
        "type": "object",
        "required": ["product_category"],
        "properties": {
            "product_category": {
                "type": "string",
                "description": "Product category (e.g. electronics, apparel, furniture)"
            },
            "complaint_type": {
                "type": "string",
                "enum": ["refund","damaged","wrong_item","late_delivery","other"],
                "description": "Type of complaint to check policy for"
            }
        }
    }',
    '{
        "type": "object",
        "properties": {
            "return_window_days":    {"type": "integer"},
            "refund_eligible":       {"type": "boolean"},
            "refund_method":         {"type": "string", "enum": ["original_payment","store_credit","exchange"]},
            "conditions":            {"type": "array", "items": {"type": "string"}},
            "exceptions":            {"type": "array", "items": {"type": "string"}},
            "policy_snippet":        {"type": "string"}
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


-- ── 3. analyze_sentiment ─────────────────────────────────────────────────────
INSERT INTO tools (
    id, tenant_id, workspace_id,
    name, description, tool_type,
    input_schema, output_schema, config_json, approval_policy_json,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0040-000000000003', t_id, ws_id,
    'analyze_sentiment',
    'Analyses the sentiment and urgency level of customer complaint text.',
    'code',
    '{
        "type": "object",
        "required": ["text"],
        "properties": {
            "text": {
                "type": "string",
                "description": "Customer complaint text to analyse"
            }
        }
    }',
    '{
        "type": "object",
        "properties": {
            "sentiment":       {"type": "string", "enum": ["positive","neutral","negative","very_negative"]},
            "sentiment_score": {"type": "number", "description": "-1.0 (very negative) to 1.0 (very positive)"},
            "urgency":         {"type": "string", "enum": ["low","medium","high","critical"]},
            "urgency_score":   {"type": "number", "description": "0-100"},
            "anger_detected":  {"type": "boolean"},
            "keywords":        {"type": "array", "items": {"type": "string"}}
        }
    }',
    '{
        "runtime": "python3",
        "code": "import re\n\nNEGATIVE_WORDS = [\"terrible\",\"awful\",\"horrible\",\"worst\",\"broken\",\"damaged\",\"fraud\",\"scam\",\"refund\",\"never again\",\"ridiculous\",\"disgusting\",\"unacceptable\"]\nURGENT_WORDS   = [\"urgent\",\"immediately\",\"asap\",\"lawyer\",\"sue\",\"police\",\"media\",\"viral\",\"report\",\"escalate\",\"emergency\"]\n\ndef run(text):\n    lower = text.lower()\n    neg_count = sum(1 for w in NEGATIVE_WORDS if w in lower)\n    urg_count = sum(1 for w in URGENT_WORDS if w in lower)\n    sentiment_score = round(max(-1.0, -0.15 * neg_count), 2)\n    urgency_score   = min(100, urg_count * 25 + neg_count * 5)\n    sentiment = \"very_negative\" if sentiment_score < -0.6 else \"negative\" if sentiment_score < -0.2 else \"neutral\" if sentiment_score < 0.1 else \"positive\"\n    urgency = \"critical\" if urgency_score >= 75 else \"high\" if urgency_score >= 50 else \"medium\" if urgency_score >= 25 else \"low\"\n    anger = any(w in lower for w in [\"furious\",\"outraged\",\"angry\",\"disgusted\",\"unacceptable\",\"sue\",\"lawyer\"])\n    keywords = [w for w in NEGATIVE_WORDS + URGENT_WORDS if w in lower]\n    return {\"sentiment\": sentiment, \"sentiment_score\": sentiment_score, \"urgency\": urgency, \"urgency_score\": urgency_score, \"anger_detected\": anger, \"keywords\": keywords[:10]}\n"
    }',
    '{"require_approval": false}',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 4. calculate_refund ──────────────────────────────────────────────────────
INSERT INTO tools (
    id, tenant_id, workspace_id,
    name, description, tool_type,
    input_schema, output_schema, config_json, approval_policy_json,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0040-000000000004', t_id, ws_id,
    'calculate_refund',
    'Calculates refund eligibility and amount based on order details, complaint type, and policy.',
    'code',
    '{
        "type": "object",
        "required": ["order_amount", "complaint_type", "days_since_delivery"],
        "properties": {
            "order_amount":         {"type": "number",  "description": "Total order value in USD"},
            "complaint_type":       {"type": "string",  "enum": ["refund","damaged","wrong_item","late_delivery","other"]},
            "days_since_delivery":  {"type": "integer", "description": "Days since the order was delivered"},
            "return_window_days":   {"type": "integer", "default": 30},
            "item_condition":       {"type": "string",  "enum": ["unopened","opened","damaged","missing_parts"], "default": "opened"}
        }
    }',
    '{
        "type": "object",
        "properties": {
            "eligible":         {"type": "boolean"},
            "refund_amount":    {"type": "number"},
            "refund_pct":       {"type": "number"},
            "refund_type":      {"type": "string"},
            "reason":           {"type": "string"}
        }
    }',
    '{
        "runtime": "python3",
        "code": "def run(order_amount, complaint_type, days_since_delivery, return_window_days=30, item_condition=\"opened\"):\n    within_window = days_since_delivery <= return_window_days\n    full_refund_types = {\"damaged\", \"wrong_item\"}\n    if complaint_type in full_refund_types:\n        eligible, pct, rtype = True, 100, \"full_refund\"\n        reason = f\"{complaint_type.replace('_', ' ').title()} qualifies for full refund regardless of window.\"\n    elif not within_window:\n        eligible, pct, rtype = False, 0, \"none\"\n        reason = f\"Return window of {return_window_days} days exceeded ({days_since_delivery} days since delivery).\"\n    elif item_condition == \"unopened\":\n        eligible, pct, rtype = True, 100, \"full_refund\"\n        reason = \"Unopened item within return window — full refund.\"\n    elif item_condition == \"opened\":\n        eligible, pct, rtype = True, 75, \"partial_refund\"\n        reason = \"Opened item within return window — 75% refund.\"\n    else:\n        eligible, pct, rtype = True, 50, \"partial_refund\"\n        reason = \"Damaged/incomplete item — 50% partial refund.\"\n    return {\"eligible\": eligible, \"refund_amount\": round(order_amount * pct / 100, 2), \"refund_pct\": pct, \"refund_type\": rtype, \"reason\": reason}\n"
    }',
    '{"require_approval": false}',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 5. send_customer_notification ───────────────────────────────────────────
INSERT INTO tools (
    id, tenant_id, workspace_id,
    name, description, tool_type,
    input_schema, output_schema, config_json, approval_policy_json,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0040-000000000005', t_id, ws_id,
    'send_customer_notification',
    'Sends an email or SMS notification to the customer with complaint resolution details.',
    'http',
    '{
        "type": "object",
        "required": ["customer_email", "subject", "body"],
        "properties": {
            "customer_email": {"type": "string", "format": "email"},
            "subject":        {"type": "string"},
            "body":           {"type": "string"},
            "channel":        {"type": "string", "enum": ["email","sms"], "default": "email"},
            "order_id":       {"type": "string"}
        }
    }',
    '{
        "type": "object",
        "properties": {
            "message_id": {"type": "string"},
            "sent_at":    {"type": "string", "format": "date-time"},
            "status":     {"type": "string"}
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


-- ── 6. search_product_knowledge ──────────────────────────────────────────────
INSERT INTO tools (
    id, tenant_id, workspace_id,
    name, description, tool_type,
    input_schema, output_schema, config_json, approval_policy_json,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0040-000000000006', t_id, ws_id,
    'search_product_knowledge',
    'Searches the product catalog knowledge base for product details, specs, and known issues.',
    'http',
    '{
        "type": "object",
        "required": ["query"],
        "properties": {
            "query": {
                "type": "string",
                "description": "Product name, SKU, or description of the issue"
            },
            "top_k": {
                "type": "integer",
                "default": 5,
                "description": "Maximum number of results to return"
            }
        }
    }',
    '{
        "type": "object",
        "properties": {
            "results": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "product_name": {"type": "string"},
                        "sku":          {"type": "string"},
                        "description":  {"type": "string"},
                        "known_issues": {"type": "array", "items": {"type": "string"}},
                        "score":        {"type": "number"}
                    }
                }
            }
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

END $$;
