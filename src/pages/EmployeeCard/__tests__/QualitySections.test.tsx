/**
 * Feedback and grades, which the card does not own.
 *
 * Both read the quality service directly. The card is assembled from the auth
 * service's own tables and these two are fetched separately, so that an outage
 * over there costs two panels rather than the whole page - which only holds if
 * each section says what happened to it instead of failing silently or taking
 * the card down with it.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Feedback, Scorecard } from '@/features/quality/types'

const quality = vi.hoisted(() => ({
  feedback: { data: undefined as unknown, isLoading: false, isError: false },
  scorecards: { data: undefined as unknown, isLoading: false, isError: false },
  askedFeedback: undefined as unknown,
  askedScorecards: undefined as unknown,
}))

vi.mock('@/features/quality/hooks/useFeedback', () => ({
  useFeedback: (filters: unknown) => {
    quality.askedFeedback = filters
    return quality.feedback
  },
}))

vi.mock('@/features/quality/hooks/useScorecards', () => ({
  useScorecards: (filters: unknown) => {
    quality.askedScorecards = filters
    return quality.scorecards
  },
}))

const { FeedbackSection } = await import('../components/FeedbackSection')
const { GradesSection } = await import('../components/GradesSection')

function feedback(overrides: Partial<Feedback> = {}): Feedback {
  return {
    id: 31,
    call_id: 'call-1',
    operator_id: 7,
    trainer_id: 2,
    project_id: 3,
    feedback_type: 'praise',
    text: 'Handled the objection calmly.',
    timestamp_ms: null,
    status: 'read',
    deadline: null,
    created_at: '2026-05-04T10:00:00Z',
    read_at: null,
    completed_at: null,
    replies: [],
    ...overrides,
  } as Feedback
}

function scorecard(overrides: Partial<Scorecard> = {}): Scorecard {
  return {
    id: 11,
    call_id: 'call-1',
    operator_id: 7,
    trainer_id: 2,
    project_id: 3,
    template_id: 1,
    template_snapshot: { id: 1, name: 'Collections QA', description: null, sections: [] },
    scores: {},
    overall_comment: null,
    weighted_score: 4.35,
    trainer_score_100: 87,
    status: 'completed',
    created_at: '2026-05-04T10:00:00Z',
    completed_at: '2026-05-05T10:00:00Z',
    sent_at: null,
    call_started_at: null,
    call_talk_duration: null,
    call_telephony_type: null,
    ...overrides,
  } as unknown as Scorecard
}

const page = <T,>(rows: T[]) => ({
  data: rows,
  pagination: { total: rows.length, page: 1, page_size: 25 },
})

beforeEach(() => {
  quality.feedback = { data: page([]), isLoading: false, isError: false }
  quality.scorecards = { data: page([]), isLoading: false, isError: false }
  quality.askedFeedback = undefined
  quality.askedScorecards = undefined
})

describe('FeedbackSection', () => {
  /*
   * The employee is the card's, never something the reader chooses. A section
   * that could be pointed elsewhere would be a second, unaudited way to read
   * the whole feedback table.
   */
  it('asks only for the employee whose card this is', () => {
    render(<FeedbackSection employeeId={7} />)

    expect(quality.askedFeedback).toEqual({ operator_id: [7] })
  })

  it('shows what was said, of what kind, and where it got to', () => {
    quality.feedback = { data: page([feedback()]), isLoading: false, isError: false }
    render(<FeedbackSection employeeId={7} />)

    expect(screen.getByText('Handled the objection calmly.')).toBeInTheDocument()
    expect(screen.getByText('pages.employeeCard.feedback.types.praise')).toBeInTheDocument()
    expect(screen.getByText('pages.employeeCard.feedback.statuses.read')).toBeInTheDocument()
  })

  it('puts the most recent first, because that is what somebody opens it to read', () => {
    quality.feedback = {
      data: page([
        feedback({ id: 1, text: 'Older', created_at: '2026-01-01T10:00:00Z' }),
        feedback({ id: 2, text: 'Newer', created_at: '2026-06-01T10:00:00Z' }),
      ]),
      isLoading: false,
      isError: false,
    }
    render(<FeedbackSection employeeId={7} />)

    const said = screen.getAllByText(/Older|Newer/).map((node) => node.textContent)
    expect(said).toEqual(['Newer', 'Older'])
  })

  it('says nothing was recorded rather than showing an empty box', () => {
    render(<FeedbackSection employeeId={7} />)

    expect(screen.getByText('pages.employeeCard.feedback.none')).toBeInTheDocument()
  })

  /*
   * "Nothing recorded" and "we could not ask" call for different next steps,
   * and an empty box cannot tell them apart.
   */
  it('says it could not be loaded, and that the rest of the card still stands', () => {
    quality.feedback = { data: undefined, isLoading: false, isError: true }
    render(<FeedbackSection employeeId={7} />)

    expect(screen.getByRole('alert')).toHaveTextContent('pages.employeeCard.quality.unavailable')
    expect(screen.queryByText('pages.employeeCard.feedback.none')).toBeNull()
  })

  it('announces the wait once rather than reading empty boxes aloud', () => {
    quality.feedback = { data: undefined, isLoading: true, isError: false }
    render(<FeedbackSection employeeId={7} />)

    expect(screen.getByText('common.loading')).toBeInTheDocument()
    expect(screen.queryByText('pages.employeeCard.feedback.none')).toBeNull()
  })
})

describe('GradesSection', () => {
  it('asks only for the employee whose card this is', () => {
    render(<GradesSection employeeId={7} />)

    expect(quality.askedScorecards).toEqual({ operator_id: [7] })
  })

  /*
   * The API serves the 0-100 figure ready-made. Multiplying the raw weighted
   * score here would be a second place for the conversion to go wrong.
   */
  it('shows the score on the axis the API already put it on', () => {
    quality.scorecards = { data: page([scorecard()]), isLoading: false, isError: false }
    render(<GradesSection employeeId={7} />)

    expect(screen.getByText('87/100')).toBeInTheDocument()
    expect(screen.getByText('Collections QA')).toBeInTheDocument()
  })

  it('says an unscored assessment is unscored rather than printing a zero', () => {
    quality.scorecards = {
      data: page([scorecard({ trainer_score_100: null, status: 'draft' })]),
      isLoading: false,
      isError: false,
    }
    render(<GradesSection employeeId={7} />)

    expect(screen.getByText('pages.employeeCard.grades.notScored')).toBeInTheDocument()
    expect(screen.queryByText('0/100')).toBeNull()
  })

  /*
   * An objection is the reason a reader stops on a row: the number beside it
   * is contested rather than settled.
   */
  it('marks a disputed assessment', () => {
    quality.scorecards = {
      data: page([scorecard({ is_disputed: true })]),
      isLoading: false,
      isError: false,
    }
    render(<GradesSection employeeId={7} />)

    expect(screen.getByText('pages.employeeCard.grades.disputed')).toBeInTheDocument()
  })

  it('leaves an ordinary assessment unmarked', () => {
    quality.scorecards = { data: page([scorecard()]), isLoading: false, isError: false }
    render(<GradesSection employeeId={7} />)

    expect(screen.queryByText('pages.employeeCard.grades.disputed')).toBeNull()
  })

  it('says nothing was recorded rather than showing an empty box', () => {
    render(<GradesSection employeeId={7} />)

    expect(screen.getByText('pages.employeeCard.grades.none')).toBeInTheDocument()
  })

  it('says it could not be loaded', () => {
    quality.scorecards = { data: undefined, isLoading: false, isError: true }
    render(<GradesSection employeeId={7} />)

    expect(screen.getByRole('alert')).toHaveTextContent('pages.employeeCard.quality.unavailable')
  })

  /* No pencil: these are written where they are given, in the quality
     workspace, and the card has no endpoint to change them. */
  it('offers nothing to edit', () => {
    quality.scorecards = { data: page([scorecard()]), isLoading: false, isError: false }
    render(<GradesSection employeeId={7} />)

    expect(screen.queryByRole('button')).toBeNull()
  })
})
