/**
 * The divergence badge: it appears only once there are two scores to compare,
 * and it never shouts — a trainer disagreeing with the AI is normal work.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScoreDivergenceBadge } from '../ScoreDivergenceBadge'

describe('ScoreDivergenceBadge', () => {
  it('shows both scores and the signed gap', () => {
    render(<ScoreDivergenceBadge aiScore100={0} trainerScore100={45} threshold={10} />)
    const badge = screen.getByTestId('score-divergence-badge')
    expect(badge).toHaveTextContent('0')
    expect(badge).toHaveTextContent('45')
    expect(badge.dataset.delta).toBe('45')
    expect(screen.getByTestId('score-divergence-delta')).toHaveTextContent('(+45)')
  })

  it('renders nothing without a trainer score', () => {
    // A draft the trainer has not scored yet: one number is not a comparison.
    render(<ScoreDivergenceBadge aiScore100={70} trainerScore100={null} threshold={10} />)
    expect(screen.queryByTestId('score-divergence-badge')).not.toBeInTheDocument()
  })

  it('renders nothing without an AI score', () => {
    render(<ScoreDivergenceBadge aiScore100={null} trainerScore100={45} threshold={10} />)
    expect(screen.queryByTestId('score-divergence-badge')).not.toBeInTheDocument()
  })

  it('marks a negative gap when the trainer scored below the AI', () => {
    render(<ScoreDivergenceBadge aiScore100={90} trainerScore100={40} threshold={10} />)
    expect(screen.getByTestId('score-divergence-badge').dataset.delta).toBe('-50')
    expect(screen.getByTestId('score-divergence-delta')).toHaveTextContent('(-50)')
  })

  it('drops the delta chip when the two agree exactly', () => {
    render(<ScoreDivergenceBadge aiScore100={60} trainerScore100={60} threshold={10} />)
    expect(screen.getByTestId('score-divergence-badge')).toBeInTheDocument()
    expect(screen.queryByTestId('score-divergence-delta')).not.toBeInTheDocument()
  })

  it('grows more prominent as the gap widens, without an alarm colour', () => {
    const { rerender } = render(
      <ScoreDivergenceBadge aiScore100={50} trainerScore100={55} threshold={10} />
    )
    const quiet = screen.getByTestId('score-divergence-badge').className

    rerender(<ScoreDivergenceBadge aiScore100={50} trainerScore100={65} threshold={10} />)
    const noticed = screen.getByTestId('score-divergence-badge').className

    rerender(<ScoreDivergenceBadge aiScore100={50} trainerScore100={95} threshold={10} />)
    const loud = screen.getByTestId('score-divergence-badge').className

    expect(quiet).not.toBe(noticed)
    expect(noticed).not.toBe(loud)
    // No red/error tone at any step — divergence is a normal outcome here.
    for (const cls of [quiet, noticed, loud]) {
      expect(cls).not.toMatch(/error|red/)
    }
  })
})
