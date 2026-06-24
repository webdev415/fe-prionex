/**
 * Render coverage for TimeAtWorkSubTab (KAN-731 Block 3).
 *
 * Focus: BE `ScreenTimeOperatorDto` rows render with the right metric
 * formatting and the `highlight` field drives the time-to-card pill tone.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { active_project_id: number } }) => unknown) =>
    selector({ user: { active_project_id: 1 } }),
}))

const operatorsMock = vi.hoisted(() => ({
  data: [{ id: 7, full_name: 'Carol Cline', department_name: 'Hard Collection' }],
}))
vi.mock('@/features/users/hooks', () => ({
  useOperators: () => operatorsMock,
}))

const screenTimeMock = vi.hoisted(() => ({
  data: {
    period_from: '2026-06-11T00:00:00Z',
    period_to: '2026-06-11T23:59:59Z',
    benchmark_metric: 'time_to_card_open_ms',
    operators: [
      {
        operator_id: 7,
        time_to_card_open_ms: 25_000, // 25s → "25s"
        time_per_tab_ms: { credits: 60_000, status: 30_000 }, // sum=90_000 → "1min 30s"
        time_to_form_submit_ms: 37_000, // "37s"
        idle_total_ms: 58 * 60 * 1000, // 58 min → "58 min"
        after_call_processing_ms: 45_000, // "45s"
        team_avg_time_to_card_open_ms: 20_000,
        deviation_pct: 25,
        highlight: 'green',
        sample_size: 18,
      },
    ],
  },
  isLoading: false,
  isError: false,
}))
vi.mock('@/features/operatorAnalytics/hooks/useScreenTime', () => ({
  useScreenTime: () => screenTimeMock,
}))

import { TimeAtWorkSubTab } from '../TimeAtWorkSubTab'

describe('TimeAtWorkSubTab', () => {
  it('formats sub-minute durations with the `s` suffix', () => {
    render(<TimeAtWorkSubTab />)
    expect(screen.getAllByText('25s').length).toBeGreaterThan(0) // time to card
    expect(screen.getAllByText('37s').length).toBeGreaterThan(0) // fill forms
    expect(screen.getAllByText('45s').length).toBeGreaterThan(0) // after call
  })

  it('formats over-minute durations as `Xmin Ys`', () => {
    render(<TimeAtWorkSubTab />)
    // Incl. Credits sums the per-tab dict (60s + 30s = 90s).
    expect(screen.getAllByText('1min 30s').length).toBeGreaterThan(0)
  })

  it('formats idle time in minutes', () => {
    render(<TimeAtWorkSubTab />)
    expect(screen.getAllByText('58 min').length).toBeGreaterThan(0)
  })

  it('resolves operator and department from the operators list', () => {
    render(<TimeAtWorkSubTab />)
    expect(screen.getByText('Carol Cline')).toBeInTheDocument()
    // Dept name appears twice: once in the row's sub-label and once as a
    // dropdown <option>. Both are correct — we just need to find at least one.
    expect(screen.getAllByText('Hard Collection').length).toBeGreaterThanOrEqual(1)
  })

  it('applies the green tone when BE highlight === "green"', () => {
    render(<TimeAtWorkSubTab />)
    // The first pill in the timeToCard column carries the highlight class.
    const greenPills = document.querySelectorAll('.bg-\\[\\#ECFDF5\\]')
    expect(greenPills.length).toBeGreaterThan(0)
  })

  it('renders the calls count from sample_size', () => {
    render(<TimeAtWorkSubTab />)
    expect(screen.getByText('18')).toBeInTheDocument()
  })
})
