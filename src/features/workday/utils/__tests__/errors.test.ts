import { describe, expect, it } from 'vitest'
import { ERROR_MOCKS, httpError } from '../../__tests__/contractMocks'
import { classifyWorkdayFailure, retryAfterSeconds } from '../errors'

describe('classifyWorkdayFailure (contract error mocks)', () => {
  it('reads a code-less 404 (flag off / route not deployed) as «not available»', () => {
    expect(classifyWorkdayFailure(httpError(ERROR_MOCKS.flagOff))).toEqual({ kind: 'notAvailable' })
    // A 404 with no body at all (a proxy, or a backend without the route).
    const bare = Object.assign(new Error('HTTP 404'), {
      isAxiosError: true,
      response: { status: 404, data: undefined, headers: {} },
    })
    expect(classifyWorkdayFailure(bare)).toEqual({ kind: 'notAvailable' })
  })

  it('tells the operator-not-found 404 apart by its code', () => {
    expect(classifyWorkdayFailure(httpError(ERROR_MOCKS.operatorNotFound))).toEqual({
      kind: 'operatorNotFound',
    })
  })

  it('lists the stale days of WORKDAY_MONTH_NOT_READY', () => {
    expect(classifyWorkdayFailure(httpError(ERROR_MOCKS.monthNotReady))).toEqual({
      kind: 'monthNotReady',
      month: '2026-09',
      staleDays: ['2026-09-08', '2026-09-09', '2026-09-10', '2026-09-21', '2026-09-22'],
      retryAfterSeconds: 900,
    })
  })

  it.each([
    ['liveBusy', 'WORKDAY_LIVE_BUSY', 20],
    ['liveDeadline', 'WORKDAY_LIVE_DEADLINE', 35],
    ['sourceUnavailable', 'WORKDAY_SOURCE_UNAVAILABLE', 60],
  ] as const)('reads %s as «retry later» with its seconds', (mock, code, seconds) => {
    expect(classifyWorkdayFailure(httpError(ERROR_MOCKS[mock]))).toEqual({
      kind: 'retryLater',
      code,
      retryAfterSeconds: seconds,
    })
  })

  it('takes the seconds from params even when the browser cannot see Retry-After', () => {
    const error = httpError(ERROR_MOCKS.liveBusy, { withHeaders: false })
    expect(retryAfterSeconds(error)).toBe(20)
  })

  it('falls back to the Retry-After header when params carry no seconds', () => {
    const error = httpError({
      status: 503,
      headers: { 'Retry-After': '45' },
      body: { detail: 'Service Unavailable' },
    })
    expect(retryAfterSeconds(error)).toBe(45)
    expect(classifyWorkdayFailure(error)).toEqual({
      kind: 'retryLater',
      code: null,
      retryAfterSeconds: 45,
    })
  })

  it('leaves 400s and the rest to the shared ladder', () => {
    expect(classifyWorkdayFailure(httpError(ERROR_MOCKS.beforeHistory))).toEqual({ kind: 'other' })
    expect(classifyWorkdayFailure(httpError(ERROR_MOCKS.unknownTimezone))).toEqual({
      kind: 'other',
    })
    expect(classifyWorkdayFailure(new Error('boom'))).toEqual({ kind: 'other' })
  })
})
