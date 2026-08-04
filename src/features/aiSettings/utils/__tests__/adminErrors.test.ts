/**
 * classifyAssistantAdminError tests — the three FastAPI error-body shapes
 * the CRM backends emit, plus the status → kind mapping the UI branches on.
 *
 * Worth its own file because the bridge endpoint is still being built: if
 * it settles on a different body shape, this is where that shows up as a
 * failing test rather than as a blank error line in production.
 */
import { describe, expect, it } from 'vitest'

import { classifyAssistantAdminError } from '../adminErrors'

function httpError(status: number, data?: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status, data } })
}

describe('classifyAssistantAdminError', () => {
  it('maps statuses to kinds', () => {
    expect(classifyAssistantAdminError(httpError(403)).kind).toBe('forbidden')
    expect(classifyAssistantAdminError(httpError(404)).kind).toBe('notFound')
    expect(classifyAssistantAdminError(httpError(502)).kind).toBe('unavailable')
    expect(classifyAssistantAdminError(httpError(503)).kind).toBe('unavailable')
    expect(classifyAssistantAdminError(httpError(500)).kind).toBe('unknown')
    expect(classifyAssistantAdminError(new Error('network down')).kind).toBe('unknown')
  })

  it('reads a plain string detail off a 422', () => {
    expect(
      classifyAssistantAdminError(httpError(422, { detail: 'Занадто довгий шаблон' }))
    ).toEqual({ kind: 'validation', message: 'Занадто довгий шаблон' })
  })

  it('joins a Pydantic detail array', () => {
    const result = classifyAssistantAdminError(
      httpError(422, {
        detail: [
          { loc: ['body', 'text'], msg: 'field required' },
          { loc: ['body', 'tone'], msg: 'unknown tone' },
        ],
      })
    )
    expect(result).toEqual({ kind: 'validation', message: 'field required; unknown tone' })
  })

  it('reads the message off a structured detail object', () => {
    const result = classifyAssistantAdminError(
      httpError(422, { detail: { code: 'append_too_long', message: 'Ліміт 2000 символів' } })
    )
    expect(result).toEqual({ kind: 'validation', message: 'Ліміт 2000 символів' })
  })

  it('leaves the message empty when the body carries only a code', () => {
    // A slug like "append_too_long" is not something to print at an admin;
    // the caller falls back to a localized string when message is absent.
    const result = classifyAssistantAdminError(httpError(422, { detail: { code: 'too_long' } }))
    expect(result).toEqual({ kind: 'validation', message: undefined })
  })

  it('ignores a whitespace-only detail', () => {
    expect(classifyAssistantAdminError(httpError(422, { detail: '   ' })).message).toBeUndefined()
  })
})
