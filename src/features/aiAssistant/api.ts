import { api } from '@/lib/api'

const BASE = '/api/v1/ai-assistant'

export type AssistantResponseMode = 'short' | 'detailed'
export type AssistantOutputFormat = 'text' | 'tableFirst' | 'mixed'

export interface AssistantChatRequest {
  message: string
  conversation_id?: number
  response_mode: AssistantResponseMode
  output_format: AssistantOutputFormat
}

export interface AssistantToolCall {
  tool_name: string
  success: boolean
}

export interface AssistantChatResponse {
  conversation_id: number
  message_id: number
  response: string
  coverage_flag: string | null
  tool_calls: AssistantToolCall[]
}

export interface AssistantConversationSummary {
  id: number
  user_id: number
  project_id: number
  channel: string
  status: string
  created_at: string
  last_message_at: string | null
}

export interface AssistantConversationMessage {
  id: number
  conversation_id: number
  role: 'user' | 'assistant'
  content: string
  model: string | null
  latency_ms: number | null
  tokens: number | null
  created_at: string
}

export interface AssistantConversationDetail extends AssistantConversationSummary {
  messages: AssistantConversationMessage[]
}

export interface AssistantConversationsFilters {
  limit?: number
  offset?: number
}

export type AssistantFeedbackRating = 'useful' | 'not_useful'
export type AssistantFeedbackComprehension = 'clear' | 'unclear'

export interface AssistantFeedbackRequest {
  message_id: number
  rating?: AssistantFeedbackRating
  comprehension?: AssistantFeedbackComprehension
  comment?: string
}

export async function sendChatMessage(
  payload: AssistantChatRequest
): Promise<AssistantChatResponse> {
  const response = await api.post<AssistantChatResponse>(`${BASE}/chat`, payload)
  return response.data
}

export async function getConversations(
  filters: AssistantConversationsFilters = {}
): Promise<AssistantConversationSummary[]> {
  const params = new URLSearchParams()
  if (filters.limit != null) params.set('limit', String(filters.limit))
  if (filters.offset != null) params.set('offset', String(filters.offset))
  const response = await api.get<AssistantConversationSummary[]>(`${BASE}/conversations`, {
    params,
  })
  return response.data
}

export async function getConversation(id: number): Promise<AssistantConversationDetail> {
  const response = await api.get<AssistantConversationDetail>(`${BASE}/conversations/${id}`)
  return response.data
}

export async function sendFeedback(payload: AssistantFeedbackRequest): Promise<void> {
  await api.post(`${BASE}/feedback`, payload)
}
