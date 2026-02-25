import { createContext, useContext, useReducer } from 'react'

const SEED = [
  {
    id: '1',
    name: 'Support Agent',
    description: 'Handles customer support inquiries using the knowledge base and escalation workflows.',
    avatar: 'S',
    color: 'bg-blue-500',
    enabled: true,
    systemPrompt: `You are a helpful customer support agent for Agent Flow. Your role is to:
- Answer questions clearly and concisely
- Reference the knowledge base when needed
- Escalate complex issues to a human agent
- Always maintain a professional and empathetic tone

If you cannot answer a question, say so honestly and offer to escalate.`,
    llmConfig: {
      modelId: '1',
      temperature: 0.5,
      maxTokens: 2048,
      topP: 1,
      streaming: true,
      presencePenalty: 0,
      frequencyPenalty: 0,
    },
    userPromptContext: [],
    tools: [],
  },
  {
    id: '2',
    name: 'Research Agent',
    description: 'Deep-dives into topics, synthesizes information from multiple sources and produces structured reports.',
    avatar: 'R',
    color: 'bg-violet-500',
    enabled: true,
    systemPrompt: `You are an expert research analyst. Your role is to:
- Gather information from multiple sources
- Synthesize findings into clear, structured reports
- Cite sources accurately
- Highlight key insights and recommendations

Always clarify ambiguous research requests before proceeding.`,
    llmConfig: {
      modelId: '2',
      temperature: 0.3,
      maxTokens: 8192,
      topP: 0.9,
      streaming: true,
      presencePenalty: 0,
      frequencyPenalty: 0,
    },
    userPromptContext: [],
    tools: [],
  },
  {
    id: '3',
    name: 'Sales Agent',
    description: 'Qualifies leads, answers product questions, and guides prospects through the sales funnel.',
    avatar: 'S',
    color: 'bg-emerald-500',
    enabled: true,
    systemPrompt: `You are a knowledgeable and persuasive sales assistant for Agent Flow. Your role is to:
- Qualify inbound leads with discovery questions
- Explain product features and benefits clearly
- Handle objections with empathy and facts
- Guide qualified prospects toward booking a demo

Never make promises that cannot be kept. Focus on value, not pressure.`,
    llmConfig: {
      modelId: '3',
      temperature: 0.7,
      maxTokens: 1024,
      topP: 1,
      streaming: true,
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
    },
    userPromptContext: [],
    tools: [],
  },
  {
    id: '4',
    name: 'Code Reviewer',
    description: 'Reviews pull requests, identifies bugs, enforces best practices and suggests improvements.',
    avatar: 'C',
    color: 'bg-orange-500',
    enabled: false,
    systemPrompt: `You are an expert software engineer conducting code reviews. Your role is to:
- Identify bugs, security vulnerabilities, and performance issues
- Enforce coding standards and best practices
- Suggest clean, idiomatic improvements with examples
- Be constructive and educational in your feedback

Focus on the most impactful issues first. Use inline code examples when helpful.`,
    llmConfig: {
      modelId: '1',
      temperature: 0.2,
      maxTokens: 4096,
      topP: 0.95,
      streaming: false,
      presencePenalty: 0,
      frequencyPenalty: 0,
    },
    userPromptContext: [],
    tools: [],
  },
]

function reducer(state, action) {
  switch (action.type) {
    case 'ADD':
      return [...state, { ...action.payload, id: String(Date.now()) }]
    case 'UPDATE':
      return state.map((a) => (a.id === action.payload.id ? { ...a, ...action.payload } : a))
    case 'DELETE':
      return state.filter((a) => a.id !== action.id)
    case 'TOGGLE':
      return state.map((a) => (a.id === action.id ? { ...a, enabled: !a.enabled } : a))
    default:
      return state
  }
}

const AgentsContext = createContext(null)

export function AgentsProvider({ children }) {
  const [agents, dispatch] = useReducer(reducer, SEED)
  const add = (agent) => dispatch({ type: 'ADD', payload: agent })
  const update = (agent) => dispatch({ type: 'UPDATE', payload: agent })
  const remove = (id) => dispatch({ type: 'DELETE', id })
  const toggle = (id) => dispatch({ type: 'TOGGLE', id })
  return (
    <AgentsContext.Provider value={{ agents, add, update, remove, toggle }}>
      {children}
    </AgentsContext.Provider>
  )
}

export const useAgents = () => useContext(AgentsContext)
