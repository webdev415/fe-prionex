/**
 * Training page — «Налаштування» top-tab gate.
 *
 * The tab carries the Call QA listening rules, so it exists only for
 * `manage_qa_rules` holders. Everyone else must see the strip exactly as
 * before, and a deep link to `?tab=settings` must not render the body.
 *
 * Every child tab is stubbed: this test is about the strip and the branch,
 * not about what the tabs fetch.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import { TrainingPage } from '../TrainingPage'

const authState: { user: { permissions: string[]; active_project_id?: number; id?: number } } = {
  user: { permissions: [], active_project_id: 1, id: 7 },
}

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
}))
vi.mock('@/features/users/hooks', () => ({ useOperators: () => ({ data: [] }) }))
// Partial: the page's url-state helpers read real constants from this barrel.
vi.mock('@/features/training', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/training')>()),
  useExportCalls: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useExportInteractions: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('../lib/scope', () => ({ useScopedUserIds: () => ({ userIds: [] }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock('../components/CallsTab', () => ({ CallsTab: () => <div /> }))
vi.mock('../components/InteractionHistoryTab', () => ({ InteractionHistoryTab: () => <div /> }))
vi.mock('../components/TaHistoryTab', () => ({ TaHistoryTab: () => <div /> }))
vi.mock('../components/TaskHistoryTab', () => ({ TaskHistoryTab: () => <div /> }))
vi.mock('../components/PaymentHistoryTab', () => ({ PaymentHistoryTab: () => <div /> }))
vi.mock('../components/TimelineTab', () => ({ TimelineTab: () => <div /> }))
vi.mock('../components/ScreenTimeTab', () => ({ ScreenTimeTab: () => <div /> }))
vi.mock('../components/HeatmapTab', () => ({ HeatmapTab: () => <div /> }))
vi.mock('../components/ScopeSelector', () => ({ ScopeSelector: () => <div /> }))
vi.mock('../components/chrome/TrainerHeaderStrip', () => ({ TrainerHeaderStrip: () => <div /> }))
vi.mock('../components/chrome/QuickActionOverlay', () => ({ QuickActionOverlay: () => <div /> }))
vi.mock('../components/chrome/CoachWorkspaceBanner', () => ({
  CoachWorkspaceBanner: () => <div />,
}))
vi.mock('../components/inbox/CreateCorrectionTaskDialog', () => ({
  CreateCorrectionTaskDialog: () => <div />,
}))
vi.mock('../components/inbox/AssignTrainingDialog', () => ({ AssignTrainingDialog: () => <div /> }))
vi.mock('../components/inbox/ScheduleOneOnOneDialog', () => ({
  ScheduleOneOnOneDialog: () => <div />,
}))
vi.mock('../components/inbox/RateDialogueDialog', () => ({ RateDialogueDialog: () => <div /> }))
vi.mock('../components/inbox/InboxTab', () => ({ InboxTab: () => <div data-testid="inbox-tab" /> }))
vi.mock('../components/team/TeamTab', () => ({ TeamTab: () => <div /> }))
vi.mock('../components/analytics/ActionAnalysisInnerTab', () => ({
  ActionAnalysisInnerTab: () => <div />,
}))
vi.mock('../components/dialogue/DialogueEvaluationTab', () => ({
  DialogueEvaluationTab: () => <div />,
}))
vi.mock('../components/training/TrainingsAndSessionsTab', () => ({
  TrainingsAndSessionsTab: () => <div />,
}))
vi.mock('../components/tasks/TasksTab', () => ({ TasksTab: () => <div /> }))
vi.mock('../components/settings/TrainingSettingsTab', () => ({
  TrainingSettingsTab: () => <div data-testid="training-settings-tab" />,
}))

function renderPage(initialUrl = '/dashboard/training') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialUrl]}>
        <TrainingPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  authState.user = { permissions: [], active_project_id: 1, id: 7 }
})

describe('TrainingPage — settings tab gate', () => {
  it('hides the settings tab without manage_qa_rules', () => {
    renderPage()
    expect(screen.queryByText('pages.training.topTabs.settings')).not.toBeInTheDocument()
  })

  it('shows the settings tab for manage_qa_rules holders', () => {
    authState.user = { permissions: ['manage_qa_rules'], active_project_id: 1, id: 7 }
    renderPage()
    expect(screen.getByText('pages.training.topTabs.settings')).toBeInTheDocument()
  })

  it('renders the settings body on ?tab=settings under the permission', () => {
    authState.user = { permissions: ['manage_qa_rules'], active_project_id: 1, id: 7 }
    renderPage('/dashboard/training?tab=settings')
    expect(screen.getByTestId('training-settings-tab')).toBeInTheDocument()
  })

  it('does not render the settings body on a deep link without the permission', () => {
    renderPage('/dashboard/training?tab=settings')
    expect(screen.queryByTestId('training-settings-tab')).not.toBeInTheDocument()
  })
})
