/**
 * CallTranscriptPanel tests (Ф1 — Call QA).
 *
 * Hook + permission are mocked (pattern: DialogueEvaluationTab.test.tsx); the
 * i18n mock in src/test/setup.ts returns the key, so assertions use keys.
 * Fixture data is synthetic (§5.5 canonical shape, no real PII).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { CallAiReview, CallTranscript } from '../../types'
import { useCallTranscript } from '../../hooks/useCallTranscript'
import { useHasPermission } from '@/hooks'
import { CallTranscriptPanel } from '../CallTranscriptPanel'

vi.mock('../../hooks/useCallTranscript', () => ({ useCallTranscript: vi.fn() }))
vi.mock('@/hooks', () => ({ useHasPermission: vi.fn() }))

const mockUseCallTranscript = vi.mocked(useCallTranscript)
const mockUseHasPermission = vi.mocked(useHasPermission)

const TRANSCRIPT: CallTranscript = {
  language: 'uk',
  duration_s: 70,
  summary: 'Тестове резюме розмови.',
  utterances: [
    {
      i: 0,
      t0: 0.4,
      t1: 3.1,
      role: 'operator',
      text: 'Доброго дня, компанія Тест.',
      lang: 'uk',
      conf: 0.93,
      flags: [],
    },
    { i: 1, t0: 3.4, t1: 4.0, role: 'client', text: 'Слухаю вас.', lang: 'uk', conf: 0.88 },
    {
      i: 2,
      t0: 65.2,
      t1: 66.9,
      role: 'alien_role', // open enum → rendered as "other"
      text: 'Сторонній звук.',
      flags: ['profanity'],
    },
  ],
  scenes: [
    { key: 'greeting', from_utt: 0, to_utt: 1 },
    { key: 'weird_scene', from_utt: 2, to_utt: 2 }, // unknown key → raw fallback
  ],
}

const REVIEW: CallAiReview = {
  weighted_score: 85.2,
  red_flags: [{ type: 'threat', severity: 'high', utt: 2 }],
  fraud: [{ type: 'no_identification', confidence: 1 }],
  mood: { operator: { irritation: 2, fatigue: 0 } },
  extracted: { promise: { amount: 2500, currency: 'UAH', date: '2026-07-15', quote: 'заплачу' } },
  recommendations: ['Порада перша.'],
}

type HookResult = ReturnType<typeof useCallTranscript>

function setHook(overrides: Partial<HookResult>) {
  mockUseCallTranscript.mockReturnValue({
    transcript: undefined,
    review: null,
    isLoading: false,
    notReady: false,
    forbidden: false,
    isHardError: false,
    ...overrides,
  } as HookResult)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseHasPermission.mockReturnValue(true)
  setHook({})
})

describe('CallTranscriptPanel', () => {
  it('renders nothing without callId', () => {
    const { container } = render(<CallTranscriptPanel callId={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the skeleton while loading', () => {
    setHook({ isLoading: true })
    render(<CallTranscriptPanel callId="c1" />)
    expect(screen.getByTestId('transcript-skeleton')).toBeInTheDocument()
  })

  it('renders the not-ready state (today’s call before the nightly run)', () => {
    setHook({ notReady: true })
    render(<CallTranscriptPanel callId="c1" />)
    expect(screen.getByText('pages.training.transcript.notReady')).toBeInTheDocument()
  })

  it('renders the error state on hard failures', () => {
    setHook({ isHardError: true })
    render(<CallTranscriptPanel callId="c1" />)
    expect(screen.getByText('pages.training.transcript.error')).toBeInTheDocument()
  })

  it('renders no-access when the server returns 403', () => {
    setHook({ forbidden: true })
    render(<CallTranscriptPanel callId="c1" />)
    expect(screen.getByText('pages.training.transcript.noAccess')).toBeInTheDocument()
  })

  it('short-circuits to no-access without the view_transcripts permission', () => {
    mockUseHasPermission.mockReturnValue(false)
    render(<CallTranscriptPanel callId="c1" active />)
    expect(screen.getByText('pages.training.transcript.noAccess')).toBeInTheDocument()
    // The fetch must stay disabled (2nd hook argument) for a guaranteed 403.
    expect(mockUseCallTranscript).toHaveBeenCalledWith('c1', false)
  })

  it('renders summary, scene sections and role-labelled utterances', () => {
    setHook({ transcript: TRANSCRIPT })
    render(<CallTranscriptPanel callId="c1" />)

    expect(screen.getByTestId('transcript-summary')).toHaveTextContent('Тестове резюме розмови.')
    // Known scene → i18n key; unknown scene key → rendered as-is (open enum).
    expect(screen.getByText('pages.training.scenes.greeting')).toBeInTheDocument()
    expect(screen.getByText('weird_scene')).toBeInTheDocument()

    expect(screen.getByText('Доброго дня, компанія Тест.')).toBeInTheDocument()
    expect(screen.getByText('Слухаю вас.')).toBeInTheDocument()
    expect(screen.getByText('pages.training.transcript.roles.operator')).toBeInTheDocument()
    expect(screen.getByText('pages.training.transcript.roles.client')).toBeInTheDocument()
    // Unknown role falls back to "other".
    expect(screen.getByText('pages.training.transcript.roles.other')).toBeInTheDocument()
  })

  it('marks flagged utterances and shows the flag label', () => {
    setHook({ transcript: TRANSCRIPT })
    render(<CallTranscriptPanel callId="c1" />)
    expect(screen.getByTestId('transcript-utt-flags-2')).toHaveTextContent('profanity')
  })

  it('seeks the player from the utterance timecode (t0 seconds → ms)', () => {
    const onSeek = vi.fn()
    setHook({ transcript: TRANSCRIPT })
    render(<CallTranscriptPanel callId="c1" onSeek={onSeek} />)

    fireEvent.click(screen.getByTestId('transcript-seek-0'))
    expect(onSeek).toHaveBeenCalledWith(400)

    fireEvent.click(screen.getByTestId('transcript-seek-2'))
    expect(onSeek).toHaveBeenCalledWith(65200)
  })

  it('collapses a scene section on header click', () => {
    setHook({ transcript: TRANSCRIPT })
    render(<CallTranscriptPanel callId="c1" />)
    expect(screen.getByText('Доброго дня, компанія Тест.')).toBeInTheDocument()
    fireEvent.click(screen.getByText('pages.training.scenes.greeting'))
    expect(screen.queryByText('Доброго дня, компанія Тест.')).not.toBeInTheDocument()
  })

  it('hides review pills and footer while review is null (Ф1)', () => {
    setHook({ transcript: TRANSCRIPT, review: null })
    render(<CallTranscriptPanel callId="c1" />)
    expect(screen.queryByTestId('transcript-score-pill')).not.toBeInTheDocument()
    expect(screen.queryByTestId('transcript-flags-pill')).not.toBeInTheDocument()
    expect(screen.queryByTestId('transcript-fraud-pill')).not.toBeInTheDocument()
    expect(screen.queryByTestId('transcript-promise')).not.toBeInTheDocument()
    expect(screen.queryByTestId('transcript-recommendations')).not.toBeInTheDocument()
  })

  it('renders review pills, promise and recommendations when review arrives (Ф2)', () => {
    setHook({ transcript: TRANSCRIPT, review: REVIEW })
    render(<CallTranscriptPanel callId="c1" />)

    expect(screen.getByTestId('transcript-score-pill')).toHaveTextContent('AI 85/100')
    expect(screen.getByTestId('transcript-flags-pill')).toHaveTextContent(
      'pages.training.transcript.redFlags'
    )
    expect(screen.getByTestId('transcript-fraud-pill')).toBeInTheDocument()
    expect(screen.getByTestId('transcript-mood-pill')).toBeInTheDocument()
    expect(screen.getByTestId('transcript-promise')).toHaveTextContent('2500 UAH')
    expect(screen.getByTestId('transcript-promise')).toHaveTextContent('2026-07-15')
    expect(screen.getByTestId('transcript-recommendations')).toHaveTextContent('Порада перша.')
  })

  it('renders a flat dialogue when the transcript has no scenes', () => {
    setHook({ transcript: { ...TRANSCRIPT, scenes: [] } })
    render(<CallTranscriptPanel callId="c1" />)
    expect(screen.getByText('Доброго дня, компанія Тест.')).toBeInTheDocument()
    expect(screen.queryByTestId('transcript-scene-0')).not.toBeInTheDocument()
  })
})
