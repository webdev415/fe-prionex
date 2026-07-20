/**
 * KAN-827 — tests for the merged Dialogue Evaluation list. Default is the
 * call-first queue; the evaluation-status filter (Draft/Completed/Sent)
 * switches to the scorecard-record source. Data hooks are mocked; the i18n
 * mock in src/test/setup.ts returns the key, so we assert against keys.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Scorecard } from '@/features/quality'
import type { OperatorUser } from '@/features/users/api/usersApi'
import { useScorecards } from '@/features/quality'
import { useCallMonitoring } from '@/features/training'
import { useOperators } from '@/features/users/hooks'
import { useScopedUserIds } from '../../../lib/scope'
import { DialogsListTab } from '../DialogsListTab'

vi.mock('@/features/quality', () => ({
  useScorecards: vi.fn(),
  useDeleteScorecard: () => ({ mutate: vi.fn() }),
  useScorecardStatusByCalls: () => ({ data: [] }),
}))
vi.mock('@/features/training', () => ({ useCallMonitoring: vi.fn() }))
vi.mock('@/features/quality/coaching/hooks', () => ({ useMyOperators: () => ({ data: [] }) }))
vi.mock('@/features/users/hooks', () => ({ useOperators: vi.fn() }))
vi.mock('@/features/calls/hooks/useCall', () => ({ useCallsBatch: () => ({ data: [] }) }))
vi.mock('@/features/clients/hooks/useClients', () => ({ useClientNames: () => new Map() }))
vi.mock('@/components/ui/useConfirm', () => ({
  useConfirm: () => ({ confirm: vi.fn().mockResolvedValue(true), confirmDialog: null }),
}))
vi.mock('../../../lib/scope', () => ({ useScopedUserIds: vi.fn() }))
vi.mock('../CallReviewPanel', () => ({ CallReviewPanel: () => null }))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { active_project_id: 3 } }),
}))

const mockUseScorecards = vi.mocked(useScorecards)
const mockUseCallMonitoring = vi.mocked(useCallMonitoring)
const mockUseOperators = vi.mocked(useOperators)
const mockUseScopedUserIds = vi.mocked(useScopedUserIds)

const OPERATORS = [
  { id: 41, full_name: 'Kateryna Antonova', asterisk_extension: '101' },
  { id: 42, full_name: 'Oleh Bondar', asterisk_extension: '102' },
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
    call_started_at: null,
    call_talk_duration: null,
    call_telephony_type: null,
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
function setCalls(result: Partial<ReturnType<typeof useCallMonitoring>>) {
  mockUseCallMonitoring.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...result,
  } as ReturnType<typeof useCallMonitoring>)
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
  setCalls({})
  setScorecards({})
})

/** Render + switch to the Completed status → the scorecard-record source. */
function renderScorecards() {
  const result = render(<DialogsListTab />)
  fireEvent.click(screen.getByText('pages.training.scorecard.status.completed'))
  return result
}

describe('DialogsListTab (merged Dialogue Evaluation list)', () => {
  it('shows call-first rows by default', () => {
    setCalls({
      data: {
        calls: [
          {
            call_id: 'c1',
            agent_extension: '101',
            customer_number: '380501112233',
            initiated_at: '2026-05-15T09:30:00',
            talk_duration: 75,
            has_recording: true,
            telephony_type: 'white',
            client_id: null,
          },
        ],
        summary: {},
        total: 1,
        limit: 50,
        offset: 0,
      },
    } as unknown as ReturnType<typeof useCallMonitoring>)
    render(<DialogsListTab />)
    expect(screen.getByText('Kateryna Antonova')).toBeInTheDocument()
    // The call row rendered (phone is unique to the row).
    expect(screen.getByText('380501112233')).toBeInTheDocument()
    // No scorecard → the "Not evaluated" badge (also the filter chip → ≥2).
    expect(
      screen.getAllByText('pages.training.dialogue.dialogs.notEvaluated').length
    ).toBeGreaterThan(1)
  })

  it('renders the scorecard loading state', () => {
    setScorecards({ isLoading: true })
    renderScorecards()
    expect(screen.getByText('common.loading')).toBeInTheDocument()
  })

  it('renders the scorecard error state', () => {
    setScorecards({ isError: true })
    renderScorecards()
    expect(screen.getByText('pages.training.dialogue.dialogs.loadError')).toBeInTheDocument()
  })

  it('renders the empty state when there are no scorecards', () => {
    setScorecards({
      data: { data: [], pagination: { page: 1, page_size: 50, total: 0, total_pages: 0 } },
    })
    renderScorecards()
    expect(screen.getByText('pages.training.dialogue.dialogs.empty')).toBeInTheDocument()
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
    render(<DialogsListTab />)
    expect(screen.getByText('pages.training.errors.emptyScopeResolution')).toBeInTheDocument()
  })

  it('renders scorecard rows and filters by the Low category chip', () => {
    setScorecards({
      data: {
        data: [
          makeScorecard(1, 41, 4.5), // ×20 → 90 → High (>=80)
          makeScorecard(2, 42, 2.5), // ×20 → 50 → Low (<60)
        ],
        pagination: { page: 1, page_size: 50, total: 2, total_pages: 1 },
      },
    })
    renderScorecards()

    expect(screen.getAllByText('Kateryna Antonova').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Oleh Bondar').length).toBeGreaterThan(0)

    // Switch to the Low chip → only the <60 scorecard remains.
    fireEvent.click(screen.getByText(/pages\.training\.dialogue\.chips\.low/))
    expect(screen.queryByText('Kateryna Antonova')).not.toBeInTheDocument()
    expect(screen.getAllByText('Oleh Bondar').length).toBeGreaterThan(0)
  })
})
