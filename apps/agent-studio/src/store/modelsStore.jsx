import { createContext, useContext, useReducer } from 'react'

// ── Seed data ─────────────────────────────────────────────────────────────────
const seed = [
  {
    id: '1',
    type: 'llm',
    name: 'GPT-4o',
    provider: 'openai',
    modelId: 'gpt-4o',
    apiKey: 'sk-••••••••••••••••',
    baseUrl: '',
    contextWindow: 128000,
    maxTokens: 4096,
    temperature: 0.7,
    enabled: true,
  },
  {
    id: '2',
    type: 'llm',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet-20241022',
    apiKey: 'sk-ant-••••••••••••',
    baseUrl: '',
    contextWindow: 200000,
    maxTokens: 8192,
    temperature: 0.7,
    enabled: true,
  },
  {
    id: '3',
    type: 'llm',
    name: 'DeepSeek Chat',
    provider: 'deepseek',
    modelId: 'deepseek-chat',
    apiKey: '••••••••••••',
    baseUrl: 'https://api.deepseek.com',
    contextWindow: 64000,
    maxTokens: 4096,
    temperature: 0.7,
    enabled: true,
  },
  {
    id: '4',
    type: 'embedding',
    name: 'text-embedding-3-large',
    provider: 'openai',
    modelId: 'text-embedding-3-large',
    apiKey: 'sk-••••••••••••••••',
    baseUrl: '',
    dimensions: 3072,
    enabled: true,
  },
  {
    id: '5',
    type: 'embedding',
    name: 'text-embedding-3-small',
    provider: 'openai',
    modelId: 'text-embedding-3-small',
    apiKey: 'sk-••••••••••••••••',
    baseUrl: '',
    dimensions: 1536,
    enabled: false,
  },
  {
    id: '6',
    type: 'rerank',
    name: 'Cohere Rerank v3',
    provider: 'cohere',
    modelId: 'rerank-english-v3.0',
    apiKey: '••••••••••••',
    baseUrl: '',
    enabled: true,
  },
]

function reducer(state, action) {
  switch (action.type) {
    case 'ADD':
      return [...state, { ...action.payload, id: String(Date.now()) }]
    case 'UPDATE':
      return state.map((m) => (m.id === action.payload.id ? { ...m, ...action.payload } : m))
    case 'DELETE':
      return state.filter((m) => m.id !== action.id)
    case 'TOGGLE':
      return state.map((m) => (m.id === action.id ? { ...m, enabled: !m.enabled } : m))
    default:
      return state
  }
}

const ModelsContext = createContext(null)

export function ModelsProvider({ children }) {
  const [models, dispatch] = useReducer(reducer, seed)

  const add = (model) => dispatch({ type: 'ADD', payload: model })
  const update = (model) => dispatch({ type: 'UPDATE', payload: model })
  const remove = (id) => dispatch({ type: 'DELETE', id })
  const toggle = (id) => dispatch({ type: 'TOGGLE', id })

  return (
    <ModelsContext.Provider value={{ models, add, update, remove, toggle }}>
      {children}
    </ModelsContext.Provider>
  )
}

export const useModels = () => useContext(ModelsContext)
