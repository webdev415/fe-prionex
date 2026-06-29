/**
 * Render coverage for ScriptAnalyticsSubTab (KAN-731 Block 4).
 *
 * Focus: the auto-flag rule → severity/label mapping, the keyword-based
 * distribution bucketing across multilingual `result_name` keys, and the
 * flags-per-operator count.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (
    selector: (state: { user: { active_project_id: number; full_name: string } }) => unknown
  ) => selector({ user: { active_project_id: 1, full_name: 'Trainer Tina' } }),
}))

const operatorsMock = vi.hoisted(() => ({
  data: [
    { id: 1, full_name: 'Olena Kovalenko', department_name: 'Hard Collection' },
    { id: 2, full_name: 'Bohdan Melnyk', department_name: 'Soft Collection' },
  ],
}))
vi.mock('@/features/users/hooks', () => ({
  useOperators: () => operatorsMock,
}))

// Distribution uses multilingual keys to exercise the bucketing — "Promise to
// Pay" (en, promises), "Відмова" (uk, refusals), "Missed call" (en, missed),
// "Will pass info" (en, willPass).
const scriptMock = vi.hoisted(() => ({
  data: {
    period_from: '2026-06-11T00:00:00Z',
    period_to: '2026-06-11T23:59:59Z',
    team_distribution: {},
    operators: [
      {
        operator_id: 1,
        distribution: {
          'Promise to Pay': 4,
          Відмова: 1,
          'Missed call': 2,
          'Will pass info': 3,
        },
        contact_type_split: {},
        no_result_pct: 0,
        fast_result_pct: 0,
        total_interactions: 10,
      },
    ],
    flags: [
      {
        operator_id: 1,
        rule: 'no_answer_streak',
        value: 6,
        threshold: 5,
        triggered_at: '2026-06-11T08:30:00Z',
        detail: 'Six consecutive missed calls',
      },
      {
        operator_id: 1,
        rule: 'fast_result',
        value: 7,
        threshold: 10,
        triggered_at: '2026-06-11T09:15:00Z',
        detail: null,
      },
    ],
  },
  isLoading: false,
  isError: false,
}))
vi.mock('@/features/operatorAnalytics/hooks/useScriptAnalytics', () => ({
  useScriptAnalytics: () => scriptMock,
}))

import { ScriptAnalyticsSubTab } from '../ScriptAnalyticsSubTab'

describe('ScriptAnalyticsSubTab', () => {
  it('renders one alert row per BE flag', () => {
    render(<ScriptAnalyticsSubTab />)
    // "2" appears in the card count badge AND in the "2 flag" pill — we
    // care that at least one is there; the description below uniquely
    // identifies the alert row.
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Six consecutive missed calls')).toBeInTheDocument()
  })

  it('maps no_answer_streak to the critical severity label key', () => {
    render(<ScriptAnalyticsSubTab />)
    expect(
      screen.getByText('pages.training.script.alerts.rules.noAnswerStreak')
    ).toBeInTheDocument()
  })

  it('maps fast_result to the warn severity label key', () => {
    render(<ScriptAnalyticsSubTab />)
    expect(screen.getByText('pages.training.script.alerts.rules.fastResult')).toBeInTheDocument()
  })

  it('buckets multilingual result_name keys into the four fixed UI columns', () => {
    render(<ScriptAnalyticsSubTab />)
    // Olena's name appears in both the alert row and the distribution row.
    expect(screen.getAllByText('Olena Kovalenko').length).toBeGreaterThanOrEqual(1)
    // The distribution row totals: total=10, promises=4 (40%), refusals=1
    // (10%), missed=2 (20%), willPass=3 (30%).
    expect(screen.getByText('40%')).toBeInTheDocument()
    expect(screen.getByText('10%')).toBeInTheDocument()
    expect(screen.getByText('20%')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
  })

  it('shows the per-operator flags count next to the distribution row', () => {
    render(<ScriptAnalyticsSubTab />)
    // "2 flag" pill in the Flags column (both flags are on operator 1).
    expect(screen.getByText('2 flag')).toBeInTheDocument()
  })

  // The coach footer JSX was removed from the component during review; the
  // trainerName lookup is still wired in for the next iteration. No test
  // covers that footer until it's re-rendered.
})
