/**
 * CallReviewPanel — the AI card added to the trainer's review panel.
 *
 * CallTranscriptPanel is reused as-is (it carries its own `view_transcripts`
 * + `transcripts_enabled` gates), so these tests only assert the wiring:
 * the section is expanded by default, folds away on click, and its `onSeek`
 * drives the same CallPlayer handle the marker overlay uses.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { CallReviewPanel } from '../CallReviewPanel'

const seekTo = vi.fn()

vi.mock('@/features/quality', () => ({
  AddMarkerButton: () => <div />,
  LeaveFeedbackButton: () => <div />,
  MarkerOverlay: () => <div />,
  ScorecardPanel: () => <div data-testid="scorecard-panel" />,
  CallTranscriptPanel: ({ callId, onSeek }: { callId?: string; onSeek?: (ms: number) => void }) => (
    <button type="button" data-testid="transcript-panel" onClick={() => onSeek?.(4200)}>
      transcript:{callId}
    </button>
  ),
}))
vi.mock('@/features/quality/hooks/useMarkers', () => ({
  useMarkersForCall: () => ({ data: [], refetch: vi.fn() }),
}))
vi.mock('@/pages/ClientManagement/components/CallPlayer', () => ({
  CallPlayer: Object.assign(
    // forwardRef stand-in: the panel only ever calls seekTo/getCurrentTimeMs.
    (props: { ref?: { current: unknown } }) => {
      if (props.ref) props.ref.current = { seekTo, getCurrentTimeMs: () => 0 }
      return <div data-testid="call-player" />
    },
    { displayName: 'CallPlayer' }
  ),
}))
vi.mock('../../inbox/CreateCorrectionTaskDialog', () => ({
  CreateCorrectionTaskDialog: () => <div />,
}))

describe('CallReviewPanel — transcript section', () => {
  it('renders the transcript panel expanded by default', () => {
    render(<CallReviewPanel callId="c1" operatorId={41} />)
    expect(screen.getByTestId('transcript-panel')).toHaveTextContent('transcript:c1')
  })

  it('folds the section away and back on the toggle', () => {
    render(<CallReviewPanel callId="c1" operatorId={41} />)
    const toggle = screen.getByTestId('call-review-transcript-toggle')

    fireEvent.click(toggle)
    expect(screen.queryByTestId('transcript-panel')).not.toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggle)
    expect(screen.getByTestId('transcript-panel')).toBeInTheDocument()
  })

  it('seeks the call player from a transcript timestamp', () => {
    seekTo.mockClear()
    render(<CallReviewPanel callId="c1" operatorId={41} />)
    fireEvent.click(screen.getByTestId('transcript-panel'))
    expect(seekTo).toHaveBeenCalledWith(4200)
  })

  it('shows nothing to review without a selected call', () => {
    render(<CallReviewPanel />)
    expect(screen.queryByTestId('call-review-transcript-toggle')).not.toBeInTheDocument()
    expect(screen.getByText('pages.training.dialogue.detail.empty')).toBeInTheDocument()
  })
})
