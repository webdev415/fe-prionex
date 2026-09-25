import { describe, expect, it } from 'vitest'

import type { AssistantConversationDetail } from '../api'
import { feedbackFromConversation, mergeFeedback } from '../feedbackHydration'

const detail = (messages: AssistantConversationDetail['messages']): AssistantConversationDetail =>
  ({
    id: 7,
    channel: 'web',
    status: 'active',
    title: null,
    pinned: false,
    archived: false,
    created_at: '2026-09-25T10:00:00Z',
    last_message_at: '2026-09-25T10:01:00Z',
    messages,
  }) as unknown as AssistantConversationDetail

const msg = (id: number, role: 'user' | 'assistant', feedback?: unknown) =>
  ({
    id,
    conversation_id: 7,
    role,
    content: 'x',
    model: null,
    latency_ms: null,
    tokens: null,
    created_at: '2026-09-25T10:00:00Z',
    ...(feedback === undefined ? {} : { feedback }),
  }) as AssistantConversationDetail['messages'][number]

describe('feedbackFromConversation', () => {
  it('restores saved marks of assistant answers after reload', () => {
    const result = feedbackFromConversation(
      detail([
        msg(1, 'user'),
        msg(2, 'assistant', { rating: 'useful', comprehension: 'clear' }),
        msg(3, 'assistant', { rating: null, comprehension: 'unclear' }),
        msg(4, 'assistant', null),
      ])
    )
    expect(result).toEqual({
      2: { rating: 'useful', comprehension: 'clear' },
      3: { comprehension: 'unclear' },
    })
  })

  it('works with an old backend that sends no feedback field', () => {
    expect(feedbackFromConversation(detail([msg(2, 'assistant')]))).toEqual({})
  })

  it('drops values that have no button', () => {
    expect(
      feedbackFromConversation(
        detail([msg(2, 'assistant', { rating: 'meh', comprehension: null })])
      )
    ).toEqual({})
  })
})

describe('mergeFeedback', () => {
  it('keeps a local click over the server snapshot, field by field', () => {
    const merged = mergeFeedback(
      { 2: { rating: 'useful', comprehension: 'clear' } },
      { 2: { comprehension: 'unclear' } }
    )
    expect(merged[2]).toEqual({ rating: 'useful', comprehension: 'unclear' })
  })

  it('an empty local entry (rolled-back click) does not hide the saved mark', () => {
    expect(mergeFeedback({ 2: { rating: 'not_useful' } }, { 2: {} })[2]?.rating).toBe('not_useful')
  })

  it('keeps local marks of messages the server has not rated yet', () => {
    expect(mergeFeedback({}, { 9: { rating: 'useful' } })).toEqual({ 9: { rating: 'useful' } })
  })
})
