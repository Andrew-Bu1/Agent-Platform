import { createContext, useContext, useReducer } from 'react'

// tool.type: 'api' | 'code'
// api tools have: baseUrl, authType ('none'|'api-key'|'bearer'|'basic'), apiKey, apiDefinition (OpenAPI YAML/JSON)
// code tools have: language ('python'), code (string)

const SEED = [
  {
    id: '1',
    name: 'Web Search',
    description: 'Search the web using the Brave Search API and return organic results.',
    icon: '🔍',
    color: 'bg-blue-500',
    enabled: true,
    type: 'api',
    baseUrl: 'https://api.search.brave.com/res/v1',
    authType: 'api-key',
    authHeader: 'X-Subscription-Token',
    apiKey: '',
    apiDefinition: `openapi: 3.0.0
info:
  title: Brave Search API
  version: "1.0"
paths:
  /web/search:
    get:
      operationId: webSearch
      summary: Perform a web search
      parameters:
        - name: q
          in: query
          required: true
          schema:
            type: string
          description: Search query string
        - name: count
          in: query
          schema:
            type: integer
            default: 10
          description: Number of results to return
      responses:
        "200":
          description: Search results
`,
  },
  {
    id: '2',
    name: 'HTTP Request',
    description: 'Make arbitrary HTTP requests to any endpoint with configurable method, headers, and body.',
    icon: '🌐',
    color: 'bg-violet-500',
    enabled: true,
    type: 'api',
    baseUrl: '',
    authType: 'bearer',
    authHeader: 'Authorization',
    apiKey: '',
    apiDefinition: `openapi: 3.0.0
info:
  title: Generic HTTP Request
  version: "1.0"
paths:
  /{path}:
    get:
      operationId: httpGet
      summary: Send a GET request
      parameters:
        - name: path
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Response from the endpoint
`,
  },
  {
    id: '3',
    name: 'Data Parser',
    description: 'Parse and transform data in CSV, JSON, or plain text formats using Python.',
    icon: '📊',
    color: 'bg-emerald-500',
    enabled: true,
    type: 'code',
    language: 'python',
    code: `import json
import csv
import io

def run(input: dict) -> dict:
    """
    Parse and transform data from various formats.

    Args:
        input: {
            "format": "json" | "csv" | "text",
            "data": str   # raw data string
        }

    Returns:
        { "result": list | dict, "row_count": int }
    """
    fmt = input.get("format", "json")
    data = input.get("data", "")

    if fmt == "json":
        result = json.loads(data)
        return {"result": result, "row_count": len(result) if isinstance(result, list) else 1}

    elif fmt == "csv":
        reader = csv.DictReader(io.StringIO(data))
        rows = list(reader)
        return {"result": rows, "row_count": len(rows)}

    else:
        lines = [l for l in data.splitlines() if l.strip()]
        return {"result": lines, "row_count": len(lines)}
`,
  },
  {
    id: '4',
    name: 'Code Executor',
    description: 'Execute arbitrary Python code snippets in a sandboxed environment and return stdout/stderr.',
    icon: '⚡',
    color: 'bg-orange-500',
    enabled: false,
    type: 'code',
    language: 'python',
    code: `import subprocess
import sys

def run(input: dict) -> dict:
    """
    Execute a Python code snippet.

    Args:
        input: {
            "code": str,      # Python source to execute
            "timeout": int    # seconds (default 10)
        }

    Returns:
        { "stdout": str, "stderr": str, "exit_code": int }
    """
    code = input.get("code", "")
    timeout = input.get("timeout", 10)

    result = subprocess.run(
        [sys.executable, "-c", code],
        capture_output=True,
        text=True,
        timeout=timeout,
    )

    return {
        "stdout": result.stdout,
        "stderr": result.stderr,
        "exit_code": result.returncode,
    }
`,
  },
]

// ── Reducer ────────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {
    case 'ADD':
      return [...state, { ...action.payload, id: String(Date.now()) }]
    case 'UPDATE':
      return state.map((t) => (t.id === action.payload.id ? action.payload : t))
    case 'REMOVE':
      return state.filter((t) => t.id !== action.id)
    case 'TOGGLE':
      return state.map((t) => (t.id === action.id ? { ...t, enabled: !t.enabled } : t))
    default:
      return state
  }
}

// ── Context ────────────────────────────────────────────────────────────────────
const ToolsContext = createContext(null)

export function ToolsProvider({ children }) {
  const [tools, dispatch] = useReducer(reducer, SEED)
  return (
    <ToolsContext.Provider value={{
      tools,
      add:    (payload) => dispatch({ type: 'ADD', payload }),
      update: (payload) => dispatch({ type: 'UPDATE', payload }),
      remove: (id)      => dispatch({ type: 'REMOVE', id }),
      toggle: (id)      => dispatch({ type: 'TOGGLE', id }),
    }}>
      {children}
    </ToolsContext.Provider>
  )
}

export const useTools = () => useContext(ToolsContext)
