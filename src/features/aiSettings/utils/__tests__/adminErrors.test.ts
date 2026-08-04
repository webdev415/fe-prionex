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

  it('serializes an unrecognized detail object rather than dropping it', () => {
    // The bridge forwards a brain body it does not recognize verbatim under
    // `detail`; raw JSON is ugly but it is the only diagnostic there is.
    const result = classifyAssistantAdminError(
      httpError(422, { detail: { reason: 'template unparsable', line: 3 } })
    )
    expect(result.kind).toBe('validation')
    expect(result.message).toBe('{"reason":"template unparsable","line":3}')
  })

  it('treats brain_unreachable as unavailable regardless of the status number', () => {
    // The bridge answers 502 today; the code in the body is the stable part
    // of the contract, so a later switch to 503 must not degrade this to
    // "unknown error".
    expect(
      classifyAssistantAdminError(httpError(502, { detail: { code: 'brain_unreachable' } })).kind
    ).toBe('unavailable')
    expect(
      classifyAssistantAdminError(httpError(503, { detail: { code: 'brain_unreachable' } })).kind
    ).toBe('unavailable')
    expect(
      classifyAssistantAdminError(httpError(500, { detail: { code: 'brain_unreachable' } })).kind
    ).toBe('unavailable')
  })

  it('keeps 403 and 404 server prose out of the UI', () => {
    // Both arrive as readable strings, but in the backend's own language —
    // the UI shows its own localized copy instead.
    const forbidden = classifyAssistantAdminError(
      httpError(403, { detail: 'AI settings management is not granted for this role' })
    )
    const missing = classifyAssistantAdminError(
      httpError(404, { detail: 'навык не найден: nosuch' })
    )
    expect(forbidden).toEqual({ kind: 'forbidden' })
    expect(missing).toEqual({ kind: 'notFound' })
  })
})
