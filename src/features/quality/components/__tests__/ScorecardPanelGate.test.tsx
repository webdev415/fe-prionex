/**
 * The assignment gate: when `canEdit` is false the panel must not offer a
 * create action, otherwise the backend rejects it with a 403.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScorecardPanel } from '../ScorecardPanel'

const history: { data: unknown[] } = { data: [] }
const activeScorecard: { data: unknown; isLoading: boolean } = { data: undefined, isLoading: false }

vi.mock('../../hooks/useScorecards', () => ({
  useScorecard: () => activeScorecard,
  useScorecardHistoryForCall: () => history,
  useCreateScorecard: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSendScorecard: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateScorecard: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('../../hooks/useTemplates', () => ({
  useTemplates: () => ({
    data: [{ id: 1, name: 'Client v1', scorecard_type: 'client', sections: [] }],
    isLoading: false,
  }),
}))
vi.mock('../../hooks/useScorecardDraft', () => ({
  useScorecardDraft: () => ({
    scores: {},
    overallComment: '',
    disputeReason: '',
    isDirty: false,
    isSaving: false,
    setScore: vi.fn(),
    setOverallComment: vi.fn(),
    setDisputeReason: vi.fn(),
    flush: vi.fn(),
    reset: vi.fn(),
  }),
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { id: 7 } }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  history.data = []
  activeScorecard.data = undefined
  activeScorecard.isLoading = false
})

/** A completed card already on the call, with a one-criterion snapshot. */
function existingCompleted() {
  history.data = [{ id: 9, status: 'completed', created_at: '2026-07-22T21:30:00Z' }]
  activeScorecard.data = {
    id: 9,
    call_id: 'c1',
    operator_id: 41,
    trainer_id: 99,
    status: 'completed',
    weighted_score: 4,
    overall_comment: null,
    scores: { g: { value: 4 } },
    template_snapshot: {
      name: 'Client v1',
      sections: [
        { key: 's', name: 'S', criteria: [{ key: 'g', name: 'G', scale: '0-5', weight: 10 }] },
      ],
    },
  }
}

describe('ScorecardPanel assignment gate', () => {
  it('hides the create action and explains why when not assigned', () => {
    render(<ScorecardPanel callId="c1" operatorId={41} canEdit={false} />)
    expect(screen.getByText('pages.training.scorecard.notAssigned')).toBeInTheDocument()
    expect(screen.queryByText('pages.training.scorecard.startEvaluation')).not.toBeInTheDocument()
  })

  it('offers the create action when assigned and the call has no scorecard', () => {
    render(<ScorecardPanel callId="c1" operatorId={41} canEdit />)
    expect(screen.getByText('pages.training.scorecard.startEvaluation')).toBeInTheDocument()
    expect(screen.queryByText('pages.training.scorecard.notAssigned')).not.toBeInTheDocument()
  })

  it('opens an existing completed scorecard instead of offering to create one', () => {
    existingCompleted()
    render(<ScorecardPanel callId="c1" operatorId={41} canEdit />)
    // The editor is shown (template name in the header), not the create picker.
    expect(screen.getByText('Client v1')).toBeInTheDocument()
    expect(screen.queryByText('pages.training.scorecard.startEvaluation')).not.toBeInTheDocument()
  })

  it('shows Send but not Mark completed on an already-completed scorecard', () => {
    existingCompleted()
    render(<ScorecardPanel callId="c1" operatorId={41} canEdit />)
    expect(screen.getByText('pages.training.scorecard.sendToOperator')).toBeInTheDocument()
    expect(screen.queryByText('pages.training.scorecard.markCompleted')).not.toBeInTheDocument()
    expect(screen.getByText('pages.training.scorecard.saveChanges')).toBeInTheDocument()
  })
})
