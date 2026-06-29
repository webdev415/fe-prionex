/**
 * Render coverage for HeatMapSubTab (KAN-731 Block 2).
 *
 * Focus: BE state → UI state mapping (`active_call` → `call`, `post_call` →
 * `after_call`) and the `offline` synthesis for hours without a bucket.
 * Hooks are stubbed so the test exercises only the component logic.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { active_project_id: number } }) => unknown) =>
    selector({ user: { active_project_id: 1 } }),
}))

const operatorsMock = vi.hoisted(() => ({
  data: [
    { id: 1, full_name: 'Alice Adams', department_name: 'Hard Collection' },
    { id: 2, full_name: 'Bob Brown', department_name: 'Soft Collection' },
  ],
}))
vi.mock('@/features/users/hooks', () => ({
  useOperators: () => operatorsMock,
}))

const heatmapMock = vi.hoisted(() => ({
  data: {
    period_from: '2026-06-11T00:00:00Z',
    period_to: '2026-06-11T23:59:59Z',
    operators: [
      {
        operator_id: 1,
        hours: [
          { hour: '08:00', dominant_state: 'active_call', minute_breakdown: {} },
          { hour: '09:00', dominant_state: 'post_call', minute_breakdown: {} },
          { hour: '10:00', dominant_state: 'idle', minute_breakdown: {} },
        ],
      },
    ],
  },
  isLoading: false,
  isError: false,
}))
vi.mock('@/features/operatorAnalytics/hooks/useHeatmap', () => ({
  useHeatmap: () => heatmapMock,
}))

import { HeatMapSubTab } from '../HeatMapSubTab'

describe('HeatMapSubTab', () => {
  it('renders the legend with all six UI states (including synthesised offline)', () => {
    render(<HeatMapSubTab />)
    expect(screen.getByText('pages.training.heatmap.state.call')).toBeInTheDocument()
    expect(screen.getByText('pages.training.heatmap.state.afterCall')).toBeInTheDocument()
    expect(screen.getByText('pages.training.heatmap.state.waiting')).toBeInTheDocument()
    expect(screen.getByText('pages.training.heatmap.state.idle')).toBeInTheDocument()
    expect(screen.getByText('pages.training.heatmap.state.break')).toBeInTheDocument()
    expect(screen.getByText('pages.training.heatmap.state.offline')).toBeInTheDocument()
  })

  it('maps active_call → call and post_call → after_call in the cell tooltips', () => {
    render(<HeatMapSubTab />)
    // Cells render via <span title=...>. Use querySelector to fish them out.
    const cells = document.querySelectorAll('span[title]')
    const titles = Array.from(cells, (c) => c.getAttribute('title'))
    // Expect at least one cell mapped to call, one to afterCall, one to idle.
    expect(titles.some((t) => t?.includes('pages.training.heatmap.state.call'))).toBe(true)
    expect(titles.some((t) => t?.includes('pages.training.heatmap.state.afterCall'))).toBe(true)
    expect(titles.some((t) => t?.includes('pages.training.heatmap.state.idle'))).toBe(true)
  })

  it('renders the operator name resolved from the operators list (not the raw id)', () => {
    render(<HeatMapSubTab />)
    expect(screen.getByText('Alice Adams')).toBeInTheDocument()
  })

  it('renders departments derived from the active project operators', () => {
    render(<HeatMapSubTab />)
    // The "all departments" option plus the unique dept names from operators.
    const select = document.querySelector('select') as HTMLSelectElement
    const options = Array.from(select.options).map((o) => o.textContent)
    expect(options).toContain('Hard Collection')
    expect(options).toContain('Soft Collection')
  })
})
