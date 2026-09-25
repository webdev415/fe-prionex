import { describe, expect, it } from 'vitest'

import type { AssistantConversationDetail } from '../api'
import {
  feedbackFromConversation,
  feedbackRequestBody,
  isFeedbackFieldLocked,
  mergeFeedback,
  withSavedFeedback,
  type MessageFeedbackState,
} from '../feedbackHydration'

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

  it('a saved value this page does not know LOCKS its pair instead of showing it unrated', () => {
    const result = feedbackFromConversation(
      detail([msg(2, 'assistant', { rating: 'meh', comprehension: null })])
    )
    expect(result).toEqual({ 2: { unrecognised: { rating: true } } })
    const state: MessageFeedbackState = result[2] ?? {}
    // Кнопки 👍/👎 не подсвечены, но заперты — клик не затрёт сохранённое.
    expect(state.rating).toBeUndefined()
    expect(isFeedbackFieldLocked(state, 'rating')).toBe(true)
    // Незанятая пара остаётся свободной.
    expect(isFeedbackFieldLocked(state, 'comprehension')).toBe(false)
  })

  it('a non-string value (numeric code) also counts as a saved mark', () => {
    expect(
      feedbackFromConversation(
        detail([msg(2, 'assistant', { rating: 'useful', comprehension: 1 })])
      )
    ).toEqual({ 2: { rating: 'useful', unrecognised: { comprehension: true } } })
  })

  it.each([
    ['an array', [{ rating: 'useful' }]],
    ['a string', 'useful'],
    ['a number', 5],
  ])('ignores a non-object feedback (%s) without throwing', (_label, feedback) => {
    expect(feedbackFromConversation(detail([msg(2, 'assistant', feedback)]))).toEqual({})
  })

  it('does not read inherited keys as known values', () => {
    expect(
      feedbackFromConversation(
        detail([msg(2, 'assistant', { rating: 'toString', comprehension: null })])
      )
    ).toEqual({ 2: { unrecognised: { rating: true } } })
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

  it('keeps the server lock of an unrecognised value next to a local click', () => {
    expect(
      mergeFeedback({ 2: { unrecognised: { rating: true } } }, { 2: { comprehension: 'clear' } })[2]
    ).toEqual({ comprehension: 'clear', unrecognised: { rating: true } })
  })

  it('a known value replaces the unrecognised lock of the same field', () => {
    expect(
      mergeFeedback({ 2: { unrecognised: { rating: true } } }, { 2: { rating: 'useful' } })[2]
    ).toEqual({ rating: 'useful' })
  })
})

describe('feedbackRequestBody', () => {
  it('sends both known fields, so a second pair never erases the first', () => {
    expect(feedbackRequestBody(102, { rating: 'useful', comprehension: 'unclear' })).toEqual({
      message_id: 102,
      rating: 'useful',
      comprehension: 'unclear',
    })
  })

  it('omits (never nulls) a field the page does not know — the server keeps it', () => {
    const body = feedbackRequestBody(102, {
      comprehension: 'clear',
      unrecognised: { rating: true },
    })
    expect(body).toStrictEqual({ message_id: 102, comprehension: 'clear' })
    expect('rating' in body).toBe(false)
  })
})

describe('withSavedFeedback', () => {
  it('writes the sent fields into the cached message and keeps the omitted one', () => {
    const cached = detail([
      msg(1, 'user'),
      msg(2, 'assistant', { rating: 'useful', comprehension: null }),
    ])
    const patched = withSavedFeedback(cached, { message_id: 2, comprehension: 'unclear' })
    expect(patched?.messages[1]?.feedback).toEqual({ rating: 'useful', comprehension: 'unclear' })
    // Исходный снимок не мутирован.
    expect(cached.messages[1]?.feedback).toEqual({ rating: 'useful', comprehension: null })
  })

  it('fills a message that had no feedback yet', () => {
    const patched = withSavedFeedback(detail([msg(2, 'assistant', null)]), {
      message_id: 2,
      rating: 'not_useful',
    })
    expect(patched?.messages[0]?.feedback).toEqual({ rating: 'not_useful' })
  })

  it('returns the same object for a conversation without that message', () => {
    const other = detail([msg(5, 'assistant')])
    expect(withSavedFeedback(other, { message_id: 2, rating: 'useful' })).toBe(other)
    expect(withSavedFeedback(undefined, { message_id: 2, rating: 'useful' })).toBeUndefined()
  })
})
