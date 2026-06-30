/**
 * Render coverage for ScriptAnalyticsSubTab (Script Stage Funnel).
 *
 * Focus: the funnel renders one bar per stage with the evaluated-call count,
 * the pain-points panel surfaces critical/warning entries, and the empty
 * state shows when no calls have been scored against the stages section.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { StageFunnelResponse } from '@/features/quality'

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { active_project_id: number } }) => unknown) =>
    selector({ user: { active_project_id: 1 } }),
}))

const operatorsMock = vi.hoisted(() => ({
  data: [
    { id: 1, full_name: 'Olena Kovalenko' },
    { id: 2, full_name: 'Bohdan Melnyk' },
  ],
}))
vi.mock('@/features/users/hooks', () => ({
  useOperators: () => operatorsMock,
}))

const funnelMock = vi.hoisted(
  () =>
    ({
      data: undefined as StageFunnelResponse | undefined,
      isLoading: false,
      isError: false,
    }) as { data: StageFunnelResponse | undefined; isLoading: boolean; isError: boolean }
)
vi.mock('@/features/quality', () => ({
  useStageFunnel: () => funnelMock,
}))

import { ScriptAnalyticsSubTab } from '../ScriptAnalyticsSubTab'

function buildFunnel(overrides: Partial<StageFunnelResponse> = {}): StageFunnelResponse {
  return {
    period_from: '2026-06-22T00:00:00Z',
    period_to: '2026-06-29T00:00:00Z',
    evaluated_calls: 100,
    stages: [
      {
        key: 'stage_greeting',
        label_en: 'Greeting',
        label_uk: 'Привітання',
        order: 1,
        expected: 100,
        actual: 98,
        drop_pct: 2,
        band: 'green',
      },
      {
        key: 'stage_need_identification',
        label_en: 'Need Identification',
        label_uk: '',
        order: 2,
        expected: 98,
        actual: 60,
        drop_pct: 38.8,
        band: 'red',
      },
      {
        key: 'stage_solution_presentation',
        label_en: 'Solution Presentation',
        label_uk: '',
        order: 3,
        expected: 60,
        actual: 50,
        drop_pct: 16.7,
        band: 'yellow',
      },
      {
        key: 'stage_objection_handling',
        label_en: 'Objection Handling',
        label_uk: '',
        order: 4,
        expected: 50,
        actual: 48,
        drop_pct: 4,
        band: 'green',
      },
      {
        key: 'stage_closing',
        label_en: 'Closing',
        label_uk: '',
        order: 5,
        expected: 48,
        actual: 47,
        drop_pct: 2.1,
        band: 'green',
      },
      {
        key: 'stage_farewell',
        label_en: 'Farewell',
        label_uk: '',
        order: 6,
        expected: 47,
        actual: 47,
        drop_pct: 0,
        band: 'green',
      },
    ],
    pain_points: {
      critical: [
        {
          stage: 'stage_need_identification',
          label_en: 'Need Identification',
          label_uk: '',
          drop_pct: 38.8,
          band: 'red',
          operators_below: 4,
          recommendation: 'High drop-off at Need Identification.',
        },
      ],
      warning: [
        {
          stage: 'stage_solution_presentation',
          label_en: 'Solution Presentation',
          label_uk: '',
          drop_pct: 16.7,
          band: 'yellow',
          operators_below: null,
          recommendation: 'Elevated drop-off at Solution Presentation.',
        },
      ],
      stable: [],
    },
    ...overrides,
  }
}

// The test i18n mock returns the key for `t(key, fallback)` and ignores
// interpolation options, so assertions target data-derived text (stage
// labels, drop badges, recommendations) — not translated chrome.
describe('ScriptAnalyticsSubTab (Script Stage Funnel)', () => {
  it('renders a bar for each of the six stages', () => {
    funnelMock.data = buildFunnel()
    render(<ScriptAnalyticsSubTab />)
    expect(screen.getByText('Greeting')).toBeInTheDocument()
    expect(screen.getAllByText('Need Identification').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Farewell')).toBeInTheDocument()
  })

  it('shows the server-computed drop badge per stage', () => {
    funnelMock.data = buildFunnel()
    render(<ScriptAnalyticsSubTab />)
    // Need-id drop appears on its funnel bar (and again in the pain badge).
    expect(screen.getAllByText('▼ 38.8%').length).toBeGreaterThanOrEqual(1)
    // Greeting actual count from the data.
    expect(screen.getByText('98')).toBeInTheDocument()
  })

  it('shows the critical pain point recommendation', () => {
    funnelMock.data = buildFunnel()
    render(<ScriptAnalyticsSubTab />)
    expect(screen.getByText('High drop-off at Need Identification.')).toBeInTheDocument()
  })

  it('renders the empty state (no funnel bars) when no calls were scored', () => {
    funnelMock.data = buildFunnel({
      evaluated_calls: 0,
      stages: buildFunnel().stages.map((s) => ({
        ...s,
        expected: 0,
        actual: 0,
        drop_pct: 0,
        band: 'green',
      })),
      pain_points: { critical: [], warning: [], stable: [] },
    })
    render(<ScriptAnalyticsSubTab />)
    // Funnel + pain points are replaced by the empty-state card.
    expect(screen.queryByText('Greeting')).not.toBeInTheDocument()
    expect(screen.queryByText('High drop-off at Need Identification.')).not.toBeInTheDocument()
    // Empty-state title renders (key in the test i18n mock).
    expect(screen.getByText('pages.training.funnel.empty.title')).toBeInTheDocument()
  })
})
