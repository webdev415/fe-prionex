/**
 * KAN-737 — smoke tests for the Dialogue Evaluation tab wired to live data.
 * The data hooks are mocked; we assert the loading / error / empty / rows
 * branches and the category-chip filtering. The i18n mock in
 * src/test/setup.ts returns the key, so we assert against keys/fallbacks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Scorecard } from '@/features/quality'
import type { OperatorUser } from '@/features/users/api/usersApi'
import { useScorecards } from '@/features/quality'
import { useOperators } from '@/features/users/hooks'
import { useScopedUserIds } from '../../../lib/scope'
import { DialogueEvaluationTab } from '../DialogueEvaluationTab'

vi.mock('@/features/quality', () => ({ useScorecards: vi.fn() }))
vi.mock('@/features/users/hooks', () => ({ useOperators: vi.fn() }))
vi.mock('../../../lib/scope', () => ({ useScopedUserIds: vi.fn() }))
// The interactive review panel pulls in the player + query-backed scorecard
// editor; stub it so this list-focused test needs no QueryClientProvider.
vi.mock('../CallReviewPanel', () => ({ CallReviewPanel: () => null }))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { active_project_id: 3 } }),
}))

const mockUseScorecards = vi.mocked(useScorecards)
const mockUseOperators = vi.mocked(useOperators)
const mockUseScopedUserIds = vi.mocked(useScopedUserIds)

const OPERATORS = [
  { id: 41, full_name: 'Kateryna Antonova' },
  { id: 42, full_name: 'Oleh Bondar' },
] as unknown as OperatorUser[]

function makeScorecard(id: number, operatorId: number, weighted: number | null): Scorecard {
  return {
    id,
    call_id: `call-${id}`,
    operator_id: operatorId,
    trainer_id: 7,
    project_id: 3,
    template_id: 2,
    template_snapshot: {
      id: 2,
      name: 'Outbound v1',
      description: null,
      call_type: 'outbound',
      department_id: null,
      sections: [
        {
          key: 'intro',
          name: 'Intro',
          criteria: [{ key: 'greeting', name: 'Greeting', scale: '0-5', weight: 10 }],
        },
      ],
    },
    scores: { greeting: { value: 4 } },
    overall_comment: null,
    weighted_score: weighted,
    status: 'completed',
    created_at: '2026-05-15T09:30:00',
    completed_at: '2026-05-15T09:40:00',
    sent_at: null,
  }
}

function setScorecards(result: Partial<ReturnType<typeof useScorecards>>) {
  mockUseScorecards.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...result,
  } as ReturnType<typeof useScorecards>)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseOperators.mockReturnValue({ data: OPERATORS } as ReturnType<typeof useOperators>)
  mockUseScopedUserIds.mockReturnValue({
    scope: 'all',
    userIds: undefined,
    employeePickerDisabled: false,
    departmentPickerDisabled: false,
    disabledLabelKey: 'pages.training.scope.all',
    isEmptyResolution: false,
  })
})

describe('DialogueEvaluationTab', () => {
  it('renders the loading state', () => {
    setScorecards({ isLoading: true })
    render(<DialogueEvaluationTab />)
    expect(screen.getByText('common.loading')).toBeInTheDocument()
  })

  it('renders the error state', () => {
    setScorecards({ isError: true })
    render(<DialogueEvaluationTab />)
    expect(screen.getByText('pages.training.errors.loadScorecardsFailed')).toBeInTheDocument()
  })

  it('renders the empty state when there are no scorecards', () => {
    setScorecards({
      data: { data: [], pagination: { page: 1, page_size: 50, total: 0, total_pages: 0 } },
    })
    render(<DialogueEvaluationTab />)
    expect(screen.getByText('pages.training.scorecardsEmpty')).toBeInTheDocument()
  })

  it('renders the empty-scope state', () => {
    mockUseScopedUserIds.mockReturnValue({
      scope: 'department',
      userIds: [],
      employeePickerDisabled: true,
      departmentPickerDisabled: true,
      disabledLabelKey: 'pages.training.scope.department',
      isEmptyResolution: true,
    })
    setScorecards({
      data: { data: [], pagination: { page: 1, page_size: 50, total: 0, total_pages: 0 } },
    })
    render(<DialogueEvaluationTab />)
    expect(screen.getByText('pages.training.errors.emptyScopeResolution')).toBeInTheDocument()
  })

  it('renders rows and filters by the Low category chip', () => {
    setScorecards({
      data: {
        data: [
          makeScorecard(1, 41, 4.5), // ×20 → 90 → High (>=80)
          makeScorecard(2, 42, 2.5), // ×20 → 50 → Low (<60)
        ],
        pagination: { page: 1, page_size: 50, total: 2, total_pages: 1 },
      },
    })
    render(<DialogueEvaluationTab />)

    // Both operators show under "All calls" (the name also repeats in the
    // detail-panel header for the auto-selected row, hence getAllByText).
    expect(screen.getAllByText('Kateryna Antonova').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Oleh Bondar').length).toBeGreaterThan(0)

    // Switch to the Low chip → only the <60 scorecard remains.
    fireEvent.click(screen.getByText('pages.training.dialogue.chips.low'))
    expect(screen.queryByText('Kateryna Antonova')).not.toBeInTheDocument()
    expect(screen.getAllByText('Oleh Bondar').length).toBeGreaterThan(0)
  })
})
