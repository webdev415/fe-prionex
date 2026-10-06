/**
 * The trainer's objection to the AI review.
 *
 * Two things are worth guarding here and neither is visible from the rendered
 * result alone: the reason field must stay out of the way until the two scores
 * genuinely diverge (by the threshold the *backend* chose, not a number baked
 * into this component), and clearing it must reach the API as an explicit
 * `null` — otherwise an emptied textarea leaves the old objection standing.
 *
 * These exercise the real `useScorecardDraft`, so the assertions are on the
 * request body the hook builds, not on a stubbed callback.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ScorecardPanel } from '../ScorecardPanel'

const activeScorecard: { data: unknown } = { data: undefined }
const history: { data: unknown[] } = { data: [] }
const updateSpy = vi.fn().mockResolvedValue({ id: 9, status: 'completed' })

vi.mock('../../hooks/useScorecards', () => ({
  useScorecard: () => activeScorecard,
  useScorecardHistoryForCall: () => history,
  useCreateScorecard: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSendScorecard: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateScorecard: () => ({ mutateAsync: updateSpy, isPending: false, error: null }),
}))
vi.mock('../../hooks/useTemplates', () => ({
  useTemplates: () => ({ data: [], isLoading: false }),
}))
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { id: 7 } }),
}))

/**
 * A completed scorecard on one 0-5 criterion. `value: 4` makes the live
 * preview 4/5, i.e. 80 on the 0-100 axis the badge and threshold work in.
 */
function seedScorecard(overrides: Record<string, unknown> = {}) {
  history.data = [
    // trainer_id is the mocked viewer: the panel opens the viewer's own
    // card, and a call can now carry a colleague's alongside it.
    { id: 9, trainer_id: 7, status: 'completed', created_at: '2026-08-20T10:00:00Z' },
  ]
  activeScorecard.data = {
    id: 9,
    call_id: 'c1',
    operator_id: 41,
    trainer_id: 7,
    status: 'completed',
    weighted_score: 4,
    overall_comment: null,
    dispute_reason: null,
    scores: { g: { value: 4 } },
    template_snapshot: {
      name: 'Client v1',
      sections: [
        { key: 's', name: 'S', criteria: [{ key: 'g', name: 'G', scale: '0-5', weight: 10 }] },
      ],
    },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  history.data = []
  activeScorecard.data = undefined
})

describe('ScorecardPanel — divergence badge', () => {
  it('shows the badge once the trainer has a score to set against the AI', () => {
    seedScorecard({ ai_weighted_score: 20 })
    render(<ScorecardPanel callId="c1" operatorId={41} canEdit />)
    const badge = screen.getByTestId('score-divergence-badge')
    expect(badge).toHaveTextContent('20')
    expect(badge).toHaveTextContent('80')
    expect(badge.dataset.delta).toBe('60')
  })

  it('hides the badge when the call has no AI score to compare against', () => {
    seedScorecard({ ai_weighted_score: null })
    render(<ScorecardPanel callId="c1" operatorId={41} canEdit />)
    expect(screen.queryByTestId('score-divergence-badge')).not.toBeInTheDocument()
  })

  it('hides the badge on a scorecard the trainer has not scored yet', () => {
    // No criterion scored → no weighted preview → nothing to compare.
    seedScorecard({ ai_weighted_score: 20, scores: {}, weighted_score: null, status: 'draft' })
    render(<ScorecardPanel callId="c1" operatorId={41} canEdit />)
    expect(screen.queryByTestId('score-divergence-badge')).not.toBeInTheDocument()
  })
})

describe('ScorecardPanel — dispute reason field', () => {
  it('stays hidden while the two scores are close', () => {
    // 80 vs 75 → 5 points apart, under the default threshold of 10.
    seedScorecard({ ai_weighted_score: 75 })
    render(<ScorecardPanel callId="c1" operatorId={41} canEdit />)
    expect(screen.queryByTestId('dispute-reason-field')).not.toBeInTheDocument()
  })

  it('appears once the scores diverge past the threshold', () => {
    seedScorecard({ ai_weighted_score: 20 })
    render(<ScorecardPanel callId="c1" operatorId={41} canEdit />)
    expect(screen.getByTestId('dispute-reason-field')).toBeInTheDocument()
  })

  it('honours the threshold the backend sent over the local default', () => {
    // The same 60-point gap that shows the field above: the backend widening
    // the threshold to 70 must suppress it, proving the number is not baked in.
    seedScorecard({ ai_weighted_score: 20, dispute_threshold: 70 })
    render(<ScorecardPanel callId="c1" operatorId={41} canEdit />)
    expect(screen.queryByTestId('dispute-reason-field')).not.toBeInTheDocument()
  })

  it('keeps an existing objection visible even when the gap narrows', () => {
    // Otherwise re-scoring closer to the AI would strand a written reason
    // off-screen — saved, invisible, and impossible to withdraw.
    seedScorecard({ ai_weighted_score: 75, dispute_reason: 'Client was abusive, AI missed it' })
    render(<ScorecardPanel callId="c1" operatorId={41} canEdit />)
    expect(screen.getByTestId('dispute-reason-field')).toBeInTheDocument()
  })

  it('is read-only for a trainer who may not edit this scorecard', () => {
    seedScorecard({ ai_weighted_score: 20, dispute_reason: 'Disagree' })
    render(<ScorecardPanel callId="c1" operatorId={41} canEdit={false} />)
    expect(screen.getByLabelText('pages.training.scorecard.disputeReason')).toBeDisabled()
  })
})

describe('ScorecardPanel — what the save actually sends', () => {
  it('puts the typed reason in the request body', async () => {
    seedScorecard({ ai_weighted_score: 20 })
    render(<ScorecardPanel callId="c1" operatorId={41} canEdit />)

    fireEvent.change(screen.getByLabelText('pages.training.scorecard.disputeReason'), {
      target: { value: 'AI missed the payment promise at 3:20' },
    })
    fireEvent.click(screen.getByText('pages.training.scorecard.saveChanges'))

    await waitFor(() => expect(updateSpy).toHaveBeenCalled())
    expect(updateSpy).toHaveBeenCalledWith({
      scorecardId: 9,
      payload: expect.objectContaining({
        dispute_reason: 'AI missed the payment promise at 3:20',
      }),
    })
  })

  it('sends an explicit null when the reason is cleared', async () => {
    seedScorecard({ ai_weighted_score: 20, dispute_reason: 'Written earlier' })
    render(<ScorecardPanel callId="c1" operatorId={41} canEdit />)

    const field = screen.getByLabelText('pages.training.scorecard.disputeReason')
    expect(field).toHaveValue('Written earlier')
    fireEvent.change(field, { target: { value: '' } })
    fireEvent.click(screen.getByText('pages.training.scorecard.saveChanges'))

    await waitFor(() => expect(updateSpy).toHaveBeenCalled())
    const payload = updateSpy.mock.calls[0][0].payload as Record<string, unknown>
    // `null`, not `undefined` — an omitted key would leave the stored
    // objection in place behind an empty field.
    expect(payload).toHaveProperty('dispute_reason')
    expect(payload.dispute_reason).toBeNull()
  })

  it('carries the stored reason through a save that only touched the scores', async () => {
    // The trainer re-scores a criterion and saves without opening the reason
    // field: the objection must survive, not be wiped by the write.
    seedScorecard({ ai_weighted_score: 20, dispute_reason: 'Written earlier' })
    render(<ScorecardPanel callId="c1" operatorId={41} canEdit />)

    fireEvent.change(screen.getByLabelText('pages.training.scorecard.perCallComment'), {
      target: { value: 'Follow up next week' },
    })
    fireEvent.click(screen.getByText('pages.training.scorecard.saveChanges'))

    await waitFor(() => expect(updateSpy).toHaveBeenCalled())
    expect(updateSpy).toHaveBeenCalledWith({
      scorecardId: 9,
      payload: expect.objectContaining({
        overall_comment: 'Follow up next week',
        dispute_reason: 'Written earlier',
      }),
    })
  })
})
