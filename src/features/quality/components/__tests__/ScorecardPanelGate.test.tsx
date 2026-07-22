/**
 * The assignment gate: when `canEdit` is false the panel must not offer a
 * create action, otherwise the backend rejects it with a 403.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScorecardPanel } from '../ScorecardPanel'

vi.mock('../../hooks/useScorecards', () => ({
  useScorecard: () => ({ data: undefined, isLoading: false }),
  useScorecardHistoryForCall: () => ({ data: [] }),
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
    isDirty: false,
    isSaving: false,
    flush: vi.fn(),
    reset: vi.fn(),
  }),
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { id: 7 } }),
}))

beforeEach(() => vi.clearAllMocks())

describe('ScorecardPanel assignment gate', () => {
  it('hides the create action and explains why when not assigned', () => {
    render(<ScorecardPanel callId="c1" operatorId={41} canEdit={false} />)
    expect(screen.getByText('pages.training.scorecard.notAssigned')).toBeInTheDocument()
    expect(screen.queryByText('pages.training.scorecard.startEvaluation')).not.toBeInTheDocument()
  })

  it('offers the create action when assigned', () => {
    render(<ScorecardPanel callId="c1" operatorId={41} canEdit />)
    expect(screen.getByText('pages.training.scorecard.startEvaluation')).toBeInTheDocument()
    expect(screen.queryByText('pages.training.scorecard.notAssigned')).not.toBeInTheDocument()
  })
})
