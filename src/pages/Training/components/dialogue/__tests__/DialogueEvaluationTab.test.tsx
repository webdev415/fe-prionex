/**
 * KAN-827 — smoke test for the Dialogue Evaluation tab shell. The tab now only
 * owns the Dialogs / Averages toggle; the list itself lives in DialogsListTab
 * (tested separately). Both views are stubbed here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { OperatorUser } from '@/features/users/api/usersApi'
import { useOperators } from '@/features/users/hooks'
import { useScopedUserIds } from '../../../lib/scope'
import { DialogueEvaluationTab } from '../DialogueEvaluationTab'

vi.mock('@/features/users/hooks', () => ({ useOperators: vi.fn() }))
vi.mock('../../../lib/scope', () => ({ useScopedUserIds: vi.fn() }))
vi.mock('../DialogsListTab', () => ({ DialogsListTab: () => <div>dialogs-list</div> }))
vi.mock('../AvgScoreByTypeView', () => ({ AvgScoreByTypeView: () => <div>averages-view</div> }))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { active_project_id: 3 } }),
}))

const mockUseOperators = vi.mocked(useOperators)
const mockUseScopedUserIds = vi.mocked(useScopedUserIds)

beforeEach(() => {
  vi.clearAllMocks()
  mockUseOperators.mockReturnValue({ data: [] as OperatorUser[] } as ReturnType<
    typeof useOperators
  >)
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
  it('shows the Dialogs list by default', () => {
    render(<DialogueEvaluationTab />)
    expect(screen.getByText('dialogs-list')).toBeInTheDocument()
    expect(screen.queryByText('averages-view')).not.toBeInTheDocument()
  })

  it('switches to the Averages view', () => {
    render(<DialogueEvaluationTab />)
    fireEvent.click(screen.getByText('pages.training.dialogue.view.averages'))
    expect(screen.getByText('averages-view')).toBeInTheDocument()
    expect(screen.queryByText('dialogs-list')).not.toBeInTheDocument()
  })
})
