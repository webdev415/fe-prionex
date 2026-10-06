/**
 * The four workday requests through the REAL api client: the adapter is
 * swapped, the interceptors (auth, transient retry) are the production ones.
 * What is pinned: the paths and params of the contract, and that a 503 is
 * answered by ONE request — the client's transient retry would otherwise
 * re-send it twice, which the contract forbids for WORKDAY_MONTH_NOT_READY.
 */
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { api } from '@/lib/api'
import { ERROR_MOCKS, mockWorkday } from '../../__tests__/contractMocks'
import {
  getWorkdayBreaks,
  getWorkdayReport,
  getWorkmonthDays,
  getWorkmonthReport,
} from '../workdayApi'

const originalAdapter = api.defaults.adapter

afterEach(() => {
  api.defaults.adapter = originalAdapter
})

function recordingAdapter(seen: InternalAxiosRequestConfig[]): AxiosAdapter {
  return (config) => {
    seen.push(config)
    return Promise.resolve({
      data: mockWorkday(),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    })
  }
}

describe('workdayApi', () => {
  it('calls the four contract routes with their params', async () => {
    const seen: InternalAxiosRequestConfig[] = []
    api.defaults.adapter = recordingAdapter(seen)

    await getWorkdayReport({
      project_id: 1,
      day: '2026-09-17',
      calls: 'cumulative',
      timezone: 'Europe/Kyiv',
    })
    await getWorkdayBreaks(90002, { project_id: 1, day: '2026-09-17' })
    await getWorkmonthReport({ project_id: 1, month: '2026-10' })
    await getWorkmonthDays(90002, { project_id: 1, month: '2026-10' })

    expect(seen.map((config) => config.url)).toEqual([
      '/api/v1/clients/reports/workday',
      '/api/v1/clients/reports/workday/90002/breaks',
      '/api/v1/clients/reports/workmonth',
      '/api/v1/clients/reports/workmonth/90002/days',
    ])
    expect(seen[0].params).toEqual({
      project_id: 1,
      day: '2026-09-17',
      calls: 'cumulative',
      timezone: 'Europe/Kyiv',
    })
    expect(seen[3].params).toEqual({ project_id: 1, month: '2026-10' })
  })

  it.each([
    [
      'WORKDAY_MONTH_NOT_READY on the month',
      () => getWorkmonthReport({ project_id: 1, month: '2026-09' }),
      ERROR_MOCKS.monthNotReady,
    ],
    [
      'WORKDAY_LIVE_BUSY on the day',
      () => getWorkdayReport({ project_id: 1, day: '2026-10-06' }),
      ERROR_MOCKS.liveBusy,
    ],
  ])('sends a 503 (%s) exactly once — no transient retry', async (_case, request, mock) => {
    let attempts = 0
    api.defaults.adapter = (config) => {
      attempts += 1
      return Promise.reject(
        Object.assign(new Error('HTTP 503'), {
          isAxiosError: true,
          config,
          response: { status: 503, data: mock.body, headers: mock.headers, config },
        })
      )
    }

    await expect(request()).rejects.toMatchObject({ response: { status: 503 } })
    expect(attempts).toBe(1)
  })
})
