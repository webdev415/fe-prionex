/**
 * Tests for the call-grain Dialogue Evaluation list: one row per call with the
 * inline scorecard summary (category / rating / comment) + Trainer/Client cols.
 * Data hooks are mocked; the i18n mock returns the key.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { OperatorUser } from '@/features/users/api/usersApi'
import { useCallMonitoring } from '@/features/training'
import { useMyOperators } from '@/features/quality/coaching/hooks'
import { useOperators } from '@/features/users/hooks'
import { useScopedUserIds } from '../../../lib/scope'
import { DialogsListTab } from '../DialogsListTab'

vi.mock('@/features/training', () => ({ useCallMonitoring: vi.fn() }))
vi.mock('@/features/quality/coaching/hooks', () => ({
  useMyOperators: vi.fn(),
  useOperatorTrainers: () => ({
    data: [{ operator_id: 41, trainer_id: 7, trainer_name: 'Trainer Ivan' }],
  }),
}))
vi.mock('@/features/users/hooks', () => ({ useOperators: vi.fn() }))
// The departments directory is `manage_roles`-gated; the tab falls back to the
// roster, which is what these tests exercise.
vi.mock('@/features/departments', () => ({ useDepartments: () => ({ data: undefined }) }))
vi.mock('@/features/clients/hooks/useClients', () => ({
  useClientNames: () => new Map([[99, 'Acme Corp']]),
}))
vi.mock('../../../lib/scope', () => ({ useScopedUserIds: vi.fn() }))
// Stubbed to just the quick-select shortcut, so these tests assert the wiring
// (ids + disabled) rather than the dropdown's own behaviour.
vi.mock('../EmployeeMultiSelect', () => ({
  EmployeeMultiSelect: ({
    onChange,
    quickSelect,
  }: {
    onChange: (next: number[]) => void
    quickSelect?: { label: string; ids: number[]; disabled?: boolean }
  }) => (
    <button
      type="button"
      disabled={quickSelect?.disabled}
      onClick={() => onChange(quickSelect?.ids ?? [])}
    >
      {quickSelect?.label}
    </button>
  ),
}))
vi.mock('../CallReviewPanel', () => ({
  CallReviewPanel: ({ callId }: { callId?: string }) => <div>panel:{callId ?? 'none'}</div>,
}))
// Mutable so a test can grant `manage_qa_rules` and check what the head of
// training sees that an ordinary trainer does not.
const permissions: string[] = []
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ user: { active_project_id: 3, permissions } }),
}))

const mockUseCallMonitoring = vi.mocked(useCallMonitoring)
const mockUseMyOperators = vi.mocked(useMyOperators)
const mockUseOperators = vi.mocked(useOperators)
const mockUseScopedUserIds = vi.mocked(useScopedUserIds)

const OPERATORS = [
  {
    id: 41,
    full_name: 'Kateryna Antonova',
    asterisk_extension: '101',
    department_id: 5,
    department_name: 'Стягнення',
  },
  {
    id: 42,
    full_name: 'Oleh Bondar',
    asterisk_extension: '102',
    department_id: 6,
    department_name: 'Юридичний',
  },
] as unknown as OperatorUser[]

function call(overrides: Record<string, unknown> = {}) {
  return {
    call_id: 'c1',
    agent_extension: '101',
    customer_number: '380501112233',
    direction: 'outbound',
    state: 'COMPLETED',
    outcome: 'answered',
    initiated_at: '2026-05-15T09:30:00Z',
    answered_at: null,
    ended_at: null,
    ring_duration: null,
    talk_duration: 75,
    total_duration: 80,
    client_id: 99,
    campaign_id: null,
    has_recording: true,
    telephony_type: 'white',
    has_scorecard: true,
    scorecard_id: 5,
    scorecard_status: 'completed',
    scorecard_weighted_score: 4.5,
    scorecard_category: 'high',
    scorecard_comment: 'clear pitch',
    ...overrides,
  }
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
  permissions.length = 0
  mockUseMyOperators.mockReturnValue({ data: [41], isLoading: false } as ReturnType<
    typeof useMyOperators
  >)
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

describe('DialogsListTab (call-grain)', () => {
  it('renders a call row with employee, trainer, client, category and rating', () => {
    setCalls({
      data: { calls: [call()], summary: {}, total: 1, limit: 50, offset: 0 } as never,
    })
    render(<DialogsListTab />)
    expect(screen.getByText('Kateryna Antonova')).toBeInTheDocument()
    expect(screen.getByText('Trainer Ivan')).toBeInTheDocument()
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    // category label appears on the chip + the row cell; rating 4.5 × 20 = 90
    expect(screen.getAllByText('pages.training.dialogue.category.high').length).toBeGreaterThan(1)
    expect(screen.getByText('90')).toBeInTheDocument()
    expect(screen.getByText('clear pitch')).toBeInTheDocument()
  })

  it('shows an unscored call with no rating', () => {
    setCalls({
      data: {
        calls: [
          call({
            has_scorecard: false,
            scorecard_id: null,
            scorecard_status: null,
            scorecard_weighted_score: null,
            scorecard_category: null,
            scorecard_comment: null,
          }),
        ],
        summary: {},
        total: 1,
        limit: 50,
        offset: 0,
      } as never,
    })
    render(<DialogsListTab />)
    // chip + row cell both render the label; the row has no rating.
    expect(screen.getAllByText('pages.training.dialogue.category.unscored').length).toBeGreaterThan(
      1
    )
  })

  it('narrows the query to assigned operators when "My employees" is clicked', () => {
    setCalls({ data: { calls: [], summary: {}, total: 0, limit: 50, offset: 0 } as never })
    render(<DialogsListTab />)
    expect(mockUseCallMonitoring.mock.calls.at(-1)?.[0]?.agent_extensions).toEqual(['101', '102'])

    fireEvent.click(screen.getByText('pages.training.dialogue.dialogs.myEmployees'))
    expect(mockUseCallMonitoring.mock.calls.at(-1)?.[0]?.agent_extensions).toEqual(['101'])
  })

  it('narrows the query by full-name search', async () => {
    setCalls({ data: { calls: [], summary: {}, total: 0, limit: 50, offset: 0 } as never })
    render(<DialogsListTab />)
    fireEvent.change(
      screen.getByPlaceholderText('pages.training.dialogue.filters.namePlaceholder'),
      { target: { value: 'Oleh' } }
    )
    await waitFor(() =>
      expect(mockUseCallMonitoring.mock.calls.at(-1)?.[0]?.agent_extensions).toEqual(['102'])
    )
  })

  it('disables "My employees" when the trainer has no operators under control', () => {
    mockUseMyOperators.mockReturnValue({ data: [] as number[], isLoading: false } as ReturnType<
      typeof useMyOperators
    >)
    setCalls({ data: { calls: [], summary: {}, total: 0, limit: 50, offset: 0 } as never })
    render(<DialogsListTab />)

    const button = screen.getByText('pages.training.dialogue.dialogs.myEmployees')
    expect(button).toBeDisabled()
    // Clicking must not silently narrow to an empty selection.
    fireEvent.click(button)
    expect(mockUseCallMonitoring.mock.calls.at(-1)?.[0]?.agent_extensions).toEqual(['101', '102'])
  })

  it('auto-selects the first reviewable dialog so the panel is not empty', () => {
    setCalls({
      data: { calls: [call()], summary: {}, total: 1, limit: 50, offset: 0 } as never,
    })
    render(<DialogsListTab />)
    expect(screen.getByText(/panel:c1/)).toBeInTheDocument()
  })

  it('does not auto-select a call whose operator cannot be resolved', () => {
    setCalls({
      data: {
        calls: [call({ agent_extension: '999' })],
        summary: {},
        total: 1,
        limit: 50,
        offset: 0,
      } as never,
    })
    render(<DialogsListTab />)
    expect(screen.getByText(/panel:none/)).toBeInTheDocument()
  })

  it('renders loading + error + empty states', () => {
    setCalls({ isLoading: true })
    const { rerender } = render(<DialogsListTab />)
    expect(screen.getByText('common.loading')).toBeInTheDocument()

    setCalls({ isError: true })
    rerender(<DialogsListTab />)
    expect(screen.getByText('pages.training.dialogue.dialogs.loadError')).toBeInTheDocument()

    setCalls({ data: { calls: [], summary: {}, total: 0, limit: 50, offset: 0 } as never })
    rerender(<DialogsListTab />)
    expect(screen.getByText('pages.training.dialogue.dialogs.empty')).toBeInTheDocument()
  })
})

describe('DialogsListTab — filter behaviour', () => {
  it('names the missing extensions instead of claiming there are no dialogs', () => {
    // The list is queried by `agent_extensions`; with none there is nothing to
    // ask for, so "no dialogs match the filters" would be a lie.
    mockUseOperators.mockReturnValue({
      data: [{ id: 41, full_name: 'Kateryna Antonova', asterisk_extension: null }],
    } as unknown as ReturnType<typeof useOperators>)
    setCalls({ data: { calls: [], summary: {}, total: 0, limit: 50, offset: 0 } as never })
    render(<DialogsListTab />)

    expect(screen.getByText('pages.training.dialogue.dialogs.noExtensions')).toBeInTheDocument()
    expect(screen.queryByText('pages.training.dialogue.dialogs.empty')).not.toBeInTheDocument()
    // …and the query stays disabled.
    expect(mockUseCallMonitoring.mock.calls.at(-1)?.[1]).toBe(false)
  })

  it('clears the selected dialog when the filters change', async () => {
    setCalls({
      data: { calls: [call()], summary: {}, total: 1, limit: 50, offset: 0 } as never,
    })
    render(<DialogsListTab />)
    expect(screen.getByText(/panel:c1/)).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('pages.training.dialogue.filters.minDuration'), {
      target: { value: '30' },
    })
    // The right panel must not keep showing a call from the previous result set.
    await waitFor(() => expect(screen.getByText(/panel:none/)).toBeInTheDocument())
  })

  it('debounces the min-duration filter instead of querying per keystroke', async () => {
    setCalls({ data: { calls: [], summary: {}, total: 0, limit: 50, offset: 0 } as never })
    render(<DialogsListTab />)
    const input = screen.getByPlaceholderText('pages.training.dialogue.filters.minDuration')

    fireEvent.change(input, { target: { value: '3' } })
    fireEvent.change(input, { target: { value: '30' } })
    // Still the pre-typing query — the debounce hasn't fired yet.
    expect(mockUseCallMonitoring.mock.calls.at(-1)?.[0]?.min_duration).toBeUndefined()

    await waitFor(() => expect(mockUseCallMonitoring.mock.calls.at(-1)?.[0]?.min_duration).toBe(30))
  })
})

describe('DialogsListTab — department filter', () => {
  const openPicker = () =>
    fireEvent.click(screen.getByLabelText('pages.training.dialogue.department.label'))

  beforeEach(() => {
    setCalls({ data: { calls: [], summary: {}, total: 0, limit: 50, offset: 0 } as never })
  })

  it('queries every department until one is picked', () => {
    render(<DialogsListTab />)
    expect(mockUseCallMonitoring.mock.calls.at(-1)?.[0]?.department_ids).toBeUndefined()
  })

  it('sends the picked departments as department_ids and narrows the extensions', () => {
    render(<DialogsListTab />)
    openPicker()
    fireEvent.click(screen.getByText('Стягнення'))

    const filters = mockUseCallMonitoring.mock.calls.at(-1)?.[0]
    // Server-side slice…
    expect(filters?.department_ids).toEqual([5])
    // …and the client-side narrowing that keeps the list right until the
    // backend param ships.
    expect(filters?.agent_extensions).toEqual(['101'])
  })

  it('accumulates a multi-department selection', () => {
    render(<DialogsListTab />)
    openPicker()
    fireEvent.click(screen.getByText('Стягнення'))
    fireEvent.click(screen.getByText('Юридичний'))

    const filters = mockUseCallMonitoring.mock.calls.at(-1)?.[0]
    expect(filters?.department_ids).toEqual([5, 6])
    expect(filters?.agent_extensions).toEqual(['101', '102'])
  })

  it('clears back to "all departments" from the pinned row', () => {
    render(<DialogsListTab />)
    openPicker()
    fireEvent.click(screen.getByText('Стягнення'))
    expect(mockUseCallMonitoring.mock.calls.at(-1)?.[0]?.department_ids).toEqual([5])

    // The list stays open after a pick, so the "all" row is right there.
    fireEvent.click(screen.getByText('pages.training.dialogue.dialogs.allDepartments'))
    expect(mockUseCallMonitoring.mock.calls.at(-1)?.[0]?.department_ids).toBeUndefined()
  })

  it('locks the picker when the page scope already pins the department', () => {
    mockUseScopedUserIds.mockReturnValue({
      scope: 'department',
      userIds: [41],
      employeePickerDisabled: false,
      departmentPickerDisabled: true,
      disabledLabelKey: 'pages.training.scope.department',
      isEmptyResolution: false,
    })
    render(<DialogsListTab />)
    expect(screen.getByLabelText('pages.training.dialogue.department.label')).toBeDisabled()
  })
})

describe('DialogsListTab — disputes', () => {
  it('marks a row whose trainer disagreed with the AI', () => {
    setCalls({
      data: {
        calls: [call({ scorecard_is_disputed: true })],
        summary: {},
        total: 1,
        limit: 50,
        offset: 0,
      } as never,
    })
    render(<DialogsListTab />)
    // The marker sits with the rating, where the disagreement is about.
    expect(screen.getByTestId('dispute-marker')).toBeInTheDocument()
  })

  it('leaves an ordinary scored row unmarked', () => {
    setCalls({
      data: { calls: [call()], summary: {}, total: 1, limit: 50, offset: 0 } as never,
    })
    render(<DialogsListTab />)
    expect(screen.queryByTestId('dispute-marker')).not.toBeInTheDocument()
  })

  it('marks the row for a trainer without the disputes permission', () => {
    // The marker is about their own work, so it is not permission-gated —
    // only the cross-project "all disputes" view is.
    setCalls({
      data: {
        calls: [call({ scorecard_is_disputed: true })],
        summary: {},
        total: 1,
        limit: 50,
        offset: 0,
      } as never,
    })
    render(<DialogsListTab />)
    expect(screen.getByTestId('dispute-marker')).toBeInTheDocument()
    expect(screen.queryByTestId('disputes-only-chip')).not.toBeInTheDocument()
  })

  it('hides the disputes filter without `manage_qa_rules`', () => {
    // The backend answers that filter with a 403 for everyone else; offering
    // the control would only produce a dead end.
    setCalls({ data: { calls: [], summary: {}, total: 0, limit: 50, offset: 0 } as never })
    render(<DialogsListTab />)
    expect(screen.queryByTestId('disputes-only-chip')).not.toBeInTheDocument()
    expect(mockUseCallMonitoring.mock.calls.at(-1)?.[0]?.disputed).toBeUndefined()
  })

  it('offers the disputes filter to the head of training and narrows the query', () => {
    permissions.push('manage_qa_rules')
    setCalls({ data: { calls: [], summary: {}, total: 0, limit: 50, offset: 0 } as never })
    render(<DialogsListTab />)

    // Off by default — the tab still opens on every dialog.
    expect(mockUseCallMonitoring.mock.calls.at(-1)?.[0]?.disputed).toBeUndefined()

    fireEvent.click(screen.getByTestId('disputes-only-chip'))
    expect(mockUseCallMonitoring.mock.calls.at(-1)?.[0]?.disputed).toBe(true)

    fireEvent.click(screen.getByTestId('disputes-only-chip'))
    expect(mockUseCallMonitoring.mock.calls.at(-1)?.[0]?.disputed).toBeUndefined()
  })
})
