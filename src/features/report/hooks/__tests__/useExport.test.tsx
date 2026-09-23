/**
 * Dashboard export request params — board #1338 (D14, FE part), contract C4.
 *
 * The export used to send only `period`, so the backend re-derived "today" on
 * its own clock and the file could cover a different window than the screen.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../../api/reportApi', () => ({
  reportApi: {
    exportDashboard: vi.fn(),
  },
}))

import {
  buildDashboardExportFilename,
  buildDashboardExportParams,
  useExportDashboard,
} from '../useExport'
import { reportApi } from '../../api/reportApi'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('buildDashboardExportParams (D14 #1338)', () => {
  it('sends period, the explicit window and its time zone', () => {
    expect(
      buildDashboardExportParams({
        projectId: 3,
        format: 'csv',
        period: 'today',
        startDate: '2026-09-21',
        endDate: '2026-09-21',
        timezone: 'Europe/Kyiv',
      })
    ).toEqual({
      project_id: 3,
      format: 'csv',
      period: 'today',
      start_date: '2026-09-21',
      end_date: '2026-09-21',
      timezone: 'Europe/Kyiv',
    })
  })

  it('maps the period to the backend spelling', () => {
    expect(
      buildDashboardExportParams({
        projectId: 1,
        format: 'pdf',
        period: 'thisMonth',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      }).period
    ).toBe('this_month')
  })

  it('leaves out a missing time zone instead of sending a blank one', () => {
    const params = buildDashboardExportParams({
      projectId: 1,
      format: 'csv',
      period: 'today',
      startDate: '2026-09-21',
      endDate: '2026-09-21',
      timezone: null,
    })

    expect(params).not.toHaveProperty('timezone')
    expect(params.start_date).toBe('2026-09-21')
  })

  it('keeps the old period-only request when no window is given', () => {
    expect(buildDashboardExportParams({ projectId: 1, format: 'csv' })).toEqual({
      project_id: 1,
      format: 'csv',
      period: 'today',
    })
  })
})

describe('buildDashboardExportFilename (D14 #1338)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('dates a one-day export by that day, not by the UTC clock', () => {
    // 21.09 21:30 UTC is 22.09 00:30 in Kyiv: «today» on screen is 22.09.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-21T21:30:00Z'))

    expect(
      buildDashboardExportFilename({
        format: 'csv',
        period: 'today',
        startDate: '2026-09-22',
        endDate: '2026-09-22',
      })
    ).toBe('dashboard_today_2026-09-22.csv')
  })

  it('names a range by both ends', () => {
    expect(
      buildDashboardExportFilename({
        format: 'pdf',
        period: 'thisWeek',
        startDate: '2026-09-21',
        endDate: '2026-09-27',
      })
    ).toBe('dashboard_thisWeek_2026-09-21_2026-09-27.pdf')
  })

  it('falls back to the current date when no window is given', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-21T10:00:00Z'))

    expect(buildDashboardExportFilename({ format: 'csv' })).toBe('dashboard_today_2026-09-21.csv')
  })
})

describe('useExportDashboard (D14 #1338)', () => {
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  beforeEach(() => {
    vi.clearAllMocks()
    URL.createObjectURL = vi.fn(() => 'blob:dashboard-export')
    URL.revokeObjectURL = vi.fn()
    // jsdom does not implement navigation; the download click is not under test.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.mocked(reportApi.exportDashboard).mockResolvedValue(new Blob(['a,b\n1,2']))
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    vi.restoreAllMocks()
  })

  it('requests /export/dashboard with period + start_date + end_date + timezone', async () => {
    const { result } = renderHook(() => useExportDashboard(), { wrapper: createWrapper() })

    result.current.mutate({
      projectId: 7,
      format: 'csv',
      period: 'thisWeek',
      startDate: '2026-09-21',
      endDate: '2026-09-27',
      timezone: 'Europe/Kyiv',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual({
      filename: 'dashboard_thisWeek_2026-09-21_2026-09-27.csv',
    })
    expect(reportApi.exportDashboard).toHaveBeenCalledTimes(1)
    expect(reportApi.exportDashboard).toHaveBeenCalledWith({
      project_id: 7,
      format: 'csv',
      period: 'this_week',
      start_date: '2026-09-21',
      end_date: '2026-09-27',
      timezone: 'Europe/Kyiv',
    })
  })
})
