-- Demo Seed: FinAI Assistant — Agents
--
-- Seven agents for the fintech multi-agent demo flow.
--
-- Role map:
--   intent_router          → routes user query to the right team
--   report_supervisor      → supervisor of the Report & Chart team (agent_team)
--     ↳ market_analyst     → member: fetches stock data + news
--     ↳ chart_generator    → member: generates chart visualizations
--   analysis_supervisor    → supervisor of the Financial Analysis team (agent_team)
--     ↳ quant_analyst      → member: calculates returns, Sharpe, CAGR
--     ↳ data_aggregator    → member: fetches + organises raw financial data

DO $$
DECLARE
    t_id  uuid := '00000000-0000-0000-0003-000000000001';
    ws_id uuid := '00000000-0000-0000-0005-000000000001';
    u_id  uuid := '00000000-0000-0000-0002-000000000001';

    -- Tool IDs (from 002_demo_fintech_tools.sql)
    tool_stock    uuid := '00000000-0000-0000-0010-000000000001';
    tool_news     uuid := '00000000-0000-0000-0010-000000000002';
    tool_fin_data uuid := '00000000-0000-0000-0010-000000000003';
    tool_returns  uuid := '00000000-0000-0000-0010-000000000004';
    tool_risk     uuid := '00000000-0000-0000-0010-000000000005';
    tool_chart    uuid := '00000000-0000-0000-0010-000000000006';
BEGIN

-- ── 1. Intent Router ────────────────────────────────────────────────────────
-- Classifies the user's request and outputs { "route": "report" | "analysis" }
INSERT INTO agents (
    id, tenant_id, workspace_id,
    name, description, agent_kind,
    definition_json, tool_ids, model_id,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0011-000000000001', t_id, ws_id,
    'intent_router',
    'Classifies the user financial query and routes it to the appropriate team.',
    'react',
    '{
        "systemPrompt": "You are a financial query router. Analyse the user''s request and decide which team should handle it:\n\n- \"report\": the user wants a market overview, news summary, price chart, or visual report.\n- \"analysis\": the user wants quantitative analysis, return calculations, risk metrics, or portfolio statistics.\n\nRespond ONLY with a JSON object in this exact format:\n{\"route\": \"report\"} or {\"route\": \"analysis\"}\n\nDo not add any other text.",
        "maxIterations": 1
    }',
    ARRAY[]::uuid[],
    'claude-3-5-sonnet',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 2. Report Supervisor ────────────────────────────────────────────────────
-- Supervisor for the Report & Chart agent_team.
-- Delegates to market_analyst and chart_generator based on the sub-task.
INSERT INTO agents (
    id, tenant_id, workspace_id,
    name, description, agent_kind,
    definition_json, tool_ids, model_id,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0011-000000000002', t_id, ws_id,
    'report_supervisor',
    'Supervisor that orchestrates the market analyst and chart generator to produce a full financial report.',
    'react',
    '{
        "systemPrompt": "You are the Report Team Supervisor for a financial AI platform.\n\nYour team members:\n- market_analyst: fetches real-time stock prices and latest news articles.\n- chart_generator: produces chart data structures from time-series data.\n\nWorkflow:\n1. Delegate to market_analyst first to gather price and news data.\n2. Once data is ready, delegate to chart_generator to create a price chart.\n3. Compile a final Markdown report with key metrics, news highlights, and chart reference.\n\nAlways produce a complete, structured report at the end.",
        "memberAgentIds": [
            "00000000-0000-0000-0011-000000000003",
            "00000000-0000-0000-0011-000000000004"
        ],
        "exitAgentId": null,
        "maxIterations": 10
    }',
    ARRAY[]::uuid[],
    'claude-3-5-sonnet',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 3. Market Analyst ────────────────────────────────────────────────────────
-- Member of Report team. Uses get_stock_price + get_market_news.
INSERT INTO agents (
    id, tenant_id, workspace_id,
    name, description, agent_kind,
    definition_json, tool_ids, model_id,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0011-000000000003', t_id, ws_id,
    'market_analyst',
    'Fetches live stock prices and recent news for a given ticker, then summarises key findings.',
    'react',
    '{
        "systemPrompt": "You are a Market Analyst AI. When given a stock ticker or company name:\n1. Use get_stock_price to fetch the current price and metrics.\n2. Use get_market_news to find the 5 most recent relevant news articles.\n3. Summarise the price action and news sentiment in 3-5 bullet points.\n4. Return a structured JSON with keys: ticker, current_price, change_pct, news_summary, price_series_for_chart.",
        "maxIterations": 5
    }',
    ARRAY[tool_stock, tool_news],
    'claude-3-5-sonnet',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 4. Chart Generator ───────────────────────────────────────────────────────
-- Member of Report team. Takes price data and produces chart JSON.
INSERT INTO agents (
    id, tenant_id, workspace_id,
    name, description, agent_kind,
    definition_json, tool_ids, model_id,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0011-000000000004', t_id, ws_id,
    'chart_generator',
    'Converts financial time-series data into chart-ready structures for UI rendering.',
    'react',
    '{
        "systemPrompt": "You are a Chart Generator AI. When given price or financial time-series data:\n1. Use generate_chart_data to create a line chart for price history.\n2. If volume data is available, also generate a bar chart for volume.\n3. Return the chart data structures with clear titles and axis labels.\nAlways format dates as ISO 8601 and ensure the series is chronologically ordered.",
        "maxIterations": 3
    }',
    ARRAY[tool_chart],
    'claude-3-5-sonnet',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 5. Analysis Supervisor ───────────────────────────────────────────────────
-- Supervisor for the Financial Analysis agent_team.
INSERT INTO agents (
    id, tenant_id, workspace_id,
    name, description, agent_kind,
    definition_json, tool_ids, model_id,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0011-000000000005', t_id, ws_id,
    'analysis_supervisor',
    'Supervisor that coordinates the quant analyst and data aggregator to produce a quantitative financial analysis.',
    'react',
    '{
        "systemPrompt": "You are the Financial Analysis Team Supervisor.\n\nYour team members:\n- data_aggregator: retrieves historical price data and fundamental financial statements.\n- quant_analyst: computes return metrics (CAGR, Sharpe ratio) and risk metrics (VaR, Beta).\n\nWorkflow:\n1. Delegate to data_aggregator to collect the necessary historical data.\n2. Delegate to quant_analyst to run the calculations.\n3. Synthesise the findings into a clear quantitative analysis report with:\n   - Return metrics table\n   - Risk assessment\n   - Investment summary (2-3 sentences)\n\nBe precise with numbers. Always include units.",
        "memberAgentIds": [
            "00000000-0000-0000-0011-000000000006",
            "00000000-0000-0000-0011-000000000007"
        ],
        "exitAgentId": null,
        "maxIterations": 10
    }',
    ARRAY[]::uuid[],
    'claude-3-5-sonnet',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 6. Quantitative Analyst ──────────────────────────────────────────────────
-- Member of Analysis team. Runs return + risk calculations.
INSERT INTO agents (
    id, tenant_id, workspace_id,
    name, description, agent_kind,
    definition_json, tool_ids, model_id,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0011-000000000006', t_id, ws_id,
    'quant_analyst',
    'Calculates CAGR, Sharpe ratio, maximum drawdown, VaR, and Beta from historical price series.',
    'react',
    '{
        "systemPrompt": "You are a Quantitative Analyst AI. When given a price series and optionally a benchmark series:\n1. Use calculate_returns to compute total return, CAGR, Sharpe ratio, and max drawdown.\n2. Use risk_calculator to compute 1-day and 10-day VaR and Beta (if benchmark is available).\n3. Present results in a formatted table. Flag any concerning risk metrics (e.g. Sharpe < 0.5, max drawdown > 20%).",
        "maxIterations": 4
    }',
    ARRAY[tool_returns, tool_risk],
    'claude-3-5-sonnet',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 7. Data Aggregator ───────────────────────────────────────────────────────
-- Member of Analysis team. Pulls raw financial data for processing.
INSERT INTO agents (
    id, tenant_id, workspace_id,
    name, description, agent_kind,
    definition_json, tool_ids, model_id,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0011-000000000007', t_id, ws_id,
    'data_aggregator',
    'Retrieves 1-year historical prices and financial statements for quantitative analysis.',
    'react',
    '{
        "systemPrompt": "You are a Financial Data Aggregator AI. When given a stock ticker:\n1. Use search_financial_data with data_type=historical_prices and period=1y to get the price history.\n2. Optionally fetch income_statement for fundamental context.\n3. Return a clean JSON object with: ticker, price_series (array of closing prices, oldest first), dates (matching array of date strings), and any fundamental metrics available.",
        "maxIterations": 4
    }',
    ARRAY[tool_fin_data],
    'claude-3-5-sonnet',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

END $$;
