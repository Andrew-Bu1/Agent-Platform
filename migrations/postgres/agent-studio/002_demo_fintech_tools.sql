-- Demo Seed: FinAI Assistant — Tools
--
-- Six tools used by the fintech multi-agent demo flow.
-- UUIDs are fixed for idempotency (ON CONFLICT DO NOTHING).
--
-- Tenant / workspace context comes from the platform seed:
--   tenant_id    = 00000000-0000-0000-0003-000000000001
--   workspace_id = 00000000-0000-0000-0005-000000000001
--   created_by   = 00000000-0000-0000-0002-000000000001 (platform_admin)

DO $$
DECLARE
    t_id  uuid := '00000000-0000-0000-0003-000000000001';
    ws_id uuid := '00000000-0000-0000-0005-000000000001';
    u_id  uuid := '00000000-0000-0000-0002-000000000001';
BEGIN

-- ── 1. get_stock_price ──────────────────────────────────────────────────────
INSERT INTO tools (
    id, tenant_id, workspace_id,
    name, description, tool_type,
    input_schema, output_schema, config_json, approval_policy_json,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0010-000000000001', t_id, ws_id,
    'get_stock_price',
    'Fetches real-time stock price, volume, and 52-week range for a given ticker symbol.',
    'http',
    '{
        "type": "object",
        "required": ["ticker"],
        "properties": {
            "ticker": {
                "type": "string",
                "description": "Stock ticker symbol (e.g. AAPL, MSFT, TSLA)"
            },
            "exchange": {
                "type": "string",
                "description": "Exchange code (default: NASDAQ)",
                "default": "NASDAQ"
            }
        }
    }',
    '{
        "type": "object",
        "properties": {
            "ticker":       {"type": "string"},
            "price":        {"type": "number"},
            "change_pct":   {"type": "number"},
            "volume":       {"type": "integer"},
            "week_52_high": {"type": "number"},
            "week_52_low":  {"type": "number"},
            "timestamp":    {"type": "string", "format": "date-time"}
        }
    }',
    '{
        "url":     "https://api.marketdata.app/v1/stocks/quotes/{{ticker}}/",
        "method":  "GET",
        "headers": {"Accept": "application/json"},
        "timeout_ms": 5000
    }',
    '{"require_approval": false}',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 2. get_market_news ──────────────────────────────────────────────────────
INSERT INTO tools (
    id, tenant_id, workspace_id,
    name, description, tool_type,
    input_schema, output_schema, config_json, approval_policy_json,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0010-000000000002', t_id, ws_id,
    'get_market_news',
    'Returns the latest financial news articles for a company or sector.',
    'http',
    '{
        "type": "object",
        "required": ["query"],
        "properties": {
            "query": {
                "type": "string",
                "description": "Company name, ticker, or sector keyword"
            },
            "limit": {
                "type": "integer",
                "description": "Max number of articles to return (1-20)",
                "default": 5,
                "minimum": 1,
                "maximum": 20
            }
        }
    }',
    '{
        "type": "object",
        "properties": {
            "articles": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title":       {"type": "string"},
                        "source":      {"type": "string"},
                        "url":         {"type": "string"},
                        "published_at":{"type": "string", "format": "date-time"},
                        "sentiment":   {"type": "string", "enum": ["positive","neutral","negative"]}
                    }
                }
            }
        }
    }',
    '{
        "url":    "https://newsapi.org/v2/everything",
        "method": "GET",
        "headers": {"Accept": "application/json"},
        "params": {"apiKey": "{{NEWS_API_KEY}}", "q": "{{query}}", "pageSize": "{{limit}}"},
        "timeout_ms": 8000
    }',
    '{"require_approval": false}',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 3. search_financial_data ─────────────────────────────────────────────────
INSERT INTO tools (
    id, tenant_id, workspace_id,
    name, description, tool_type,
    input_schema, output_schema, config_json, approval_policy_json,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0010-000000000003', t_id, ws_id,
    'search_financial_data',
    'Searches for historical price data, financial statements, and fundamental metrics.',
    'http',
    '{
        "type": "object",
        "required": ["ticker", "data_type"],
        "properties": {
            "ticker": {
                "type": "string",
                "description": "Stock ticker symbol"
            },
            "data_type": {
                "type": "string",
                "enum": ["historical_prices", "income_statement", "balance_sheet", "cash_flow", "ratios"],
                "description": "Type of financial data to retrieve"
            },
            "period": {
                "type": "string",
                "enum": ["1m", "3m", "6m", "1y", "3y", "5y"],
                "default": "1y",
                "description": "Time period for historical data"
            }
        }
    }',
    '{
        "type": "object",
        "properties": {
            "ticker":    {"type": "string"},
            "data_type": {"type": "string"},
            "period":    {"type": "string"},
            "data":      {"type": "array", "items": {"type": "object"}}
        }
    }',
    '{
        "url":    "https://financialmodelingprep.com/api/v3/",
        "method": "GET",
        "headers": {"Accept": "application/json"},
        "timeout_ms": 10000
    }',
    '{"require_approval": false}',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 4. calculate_returns ────────────────────────────────────────────────────
INSERT INTO tools (
    id, tenant_id, workspace_id,
    name, description, tool_type,
    input_schema, output_schema, config_json, approval_policy_json,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0010-000000000004', t_id, ws_id,
    'calculate_returns',
    'Calculates investment returns including total return, CAGR, Sharpe ratio, and max drawdown from a price series.',
    'code',
    '{
        "type": "object",
        "required": ["prices"],
        "properties": {
            "prices": {
                "type": "array",
                "items": {"type": "number"},
                "description": "Chronological list of closing prices"
            },
            "risk_free_rate": {
                "type": "number",
                "default": 0.05,
                "description": "Annual risk-free rate (default 5%)"
            },
            "annualize": {
                "type": "boolean",
                "default": true
            }
        }
    }',
    '{
        "type": "object",
        "properties": {
            "total_return_pct": {"type": "number"},
            "cagr_pct":         {"type": "number"},
            "sharpe_ratio":     {"type": "number"},
            "max_drawdown_pct": {"type": "number"},
            "volatility_pct":   {"type": "number"},
            "period_days":      {"type": "integer"}
        }
    }',
    '{
        "runtime": "python3",
        "code": "import numpy as np\n\ndef run(prices, risk_free_rate=0.05, annualize=True):\n    prices = np.array(prices)\n    returns = np.diff(prices) / prices[:-1]\n    total_return = (prices[-1] - prices[0]) / prices[0]\n    n_days = len(prices) - 1\n    cagr = (1 + total_return) ** (365 / n_days) - 1 if annualize else total_return\n    daily_rf = risk_free_rate / 252\n    excess = returns - daily_rf\n    sharpe = (excess.mean() / excess.std()) * np.sqrt(252) if excess.std() > 0 else 0\n    cumulative = np.cumprod(1 + returns)\n    running_max = np.maximum.accumulate(cumulative)\n    drawdown = (cumulative - running_max) / running_max\n    return {\n        \"total_return_pct\": round(total_return * 100, 2),\n        \"cagr_pct\":         round(cagr * 100, 2),\n        \"sharpe_ratio\":     round(sharpe, 3),\n        \"max_drawdown_pct\": round(drawdown.min() * 100, 2),\n        \"volatility_pct\":   round(returns.std() * np.sqrt(252) * 100, 2),\n        \"period_days\":      n_days\n    }\n"
    }',
    '{"require_approval": false}',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 5. risk_calculator ──────────────────────────────────────────────────────
INSERT INTO tools (
    id, tenant_id, workspace_id,
    name, description, tool_type,
    input_schema, output_schema, config_json, approval_policy_json,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0010-000000000005', t_id, ws_id,
    'risk_calculator',
    'Computes portfolio risk metrics: Value-at-Risk (VaR), Beta vs market index, and correlation matrix.',
    'code',
    '{
        "type": "object",
        "required": ["portfolio_returns"],
        "properties": {
            "portfolio_returns": {
                "type": "array",
                "items": {"type": "number"},
                "description": "Daily portfolio return series"
            },
            "benchmark_returns": {
                "type": "array",
                "items": {"type": "number"},
                "description": "Daily benchmark return series (e.g. S&P 500). Required for Beta."
            },
            "confidence_level": {
                "type": "number",
                "default": 0.95,
                "description": "VaR confidence level (0.90–0.99)"
            }
        }
    }',
    '{
        "type": "object",
        "properties": {
            "var_1d_pct":       {"type": "number", "description": "1-day VaR at given confidence"},
            "var_10d_pct":      {"type": "number", "description": "10-day VaR"},
            "beta":             {"type": "number", "description": "Portfolio beta vs benchmark"},
            "correlation":      {"type": "number", "description": "Correlation with benchmark"}
        }
    }',
    '{
        "runtime": "python3",
        "code": "import numpy as np\n\ndef run(portfolio_returns, benchmark_returns=None, confidence_level=0.95):\n    pr = np.array(portfolio_returns)\n    var_1d = float(np.percentile(pr, (1 - confidence_level) * 100))\n    var_10d = var_1d * np.sqrt(10)\n    result = {\"var_1d_pct\": round(var_1d * 100, 3), \"var_10d_pct\": round(var_10d * 100, 3), \"beta\": None, \"correlation\": None}\n    if benchmark_returns is not None:\n        br = np.array(benchmark_returns)\n        cov = np.cov(pr, br)\n        result[\"beta\"] = round(cov[0,1] / cov[1,1], 3) if cov[1,1] != 0 else 0\n        result[\"correlation\"] = round(np.corrcoef(pr, br)[0,1], 3)\n    return result\n"
    }',
    '{"require_approval": false}',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;


-- ── 6. generate_chart_data ──────────────────────────────────────────────────
INSERT INTO tools (
    id, tenant_id, workspace_id,
    name, description, tool_type,
    input_schema, output_schema, config_json, approval_policy_json,
    status, created_by_user_id, updated_by_user_id,
    created_at, updated_at
) VALUES (
    '00000000-0000-0000-0010-000000000006', t_id, ws_id,
    'generate_chart_data',
    'Generates chart-ready data structures (line, candlestick, bar) for frontend rendering.',
    'code',
    '{
        "type": "object",
        "required": ["chart_type", "data"],
        "properties": {
            "chart_type": {
                "type": "string",
                "enum": ["line", "bar", "candlestick", "area"],
                "description": "Type of chart to generate"
            },
            "data": {
                "type": "array",
                "items": {"type": "object"},
                "description": "Raw data points with date and value fields"
            },
            "title": {"type": "string"},
            "x_label": {"type": "string", "default": "Date"},
            "y_label": {"type": "string", "default": "Value"}
        }
    }',
    '{
        "type": "object",
        "properties": {
            "chart_type": {"type": "string"},
            "title":      {"type": "string"},
            "series":     {"type": "array"},
            "x_axis":     {"type": "object"},
            "y_axis":     {"type": "object"},
            "metadata":   {"type": "object"}
        }
    }',
    '{
        "runtime": "python3",
        "code": "def run(chart_type, data, title=\"\", x_label=\"Date\", y_label=\"Value\"):\n    series = [{\"x\": d.get(\"date\", d.get(\"x\", i)), \"y\": d.get(\"value\", d.get(\"y\", 0))} for i, d in enumerate(data)]\n    return {\"chart_type\": chart_type, \"title\": title, \"series\": series, \"x_axis\": {\"label\": x_label}, \"y_axis\": {\"label\": y_label}, \"metadata\": {\"points\": len(series)}}\n"
    }',
    '{"require_approval": false}',
    'active', u_id, u_id, NOW(), NOW()
) ON CONFLICT (id) DO NOTHING;

END $$;
