/**
 * CallTranscriptPanel tests (Ф1 — Call QA).
 *
 * Hook + permission are mocked (pattern: DialogueEvaluationTab.test.tsx); the
 * i18n mock in src/test/setup.ts returns the key, so assertions use keys.
 * Fixture data is synthetic (§5.5 canonical shape, no real PII).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { CallAiReview, CallTranscript, TranscriptUtterance } from '../../types'
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

// ---- v7 format (FORMAT_SPEC): turns with dur/bc/pause_before/tag + stats ----

const V7_TRANSCRIPT: CallTranscript = {
  language: 'uk',
  duration_s: 380,
  answered_at: '2026-07-07T10:00:19Z',
  agent_extension: '2102',
  direction: 'outbound',
  utterances: [
    { t0: 1, t1: 2, dur: 1, role: 'client', text: 'Слухаю.', bc: [] },
    {
      t0: 10,
      t1: 20,
      dur: 10,
      role: 'operator',
      // 10 words → the reaction at t=15 (middle) lands after word 5.
      text: 'w1 w2 w3 w4 w5 w6 w7 w8 w9 w10',
      bc: [{ t: 15, role: 'client', text: 'Ага.' }],
      pause_before: 1.6,
    },
    {
      t0: 19.5, // starts 0.5s before the previous turn ends → overlap
      t1: 25,
      dur: 5.5,
      role: 'client',
      text: 'Перебиваю відповідь.',
      tag: ['crit', 'тиск / звинувачення'],
    },
    { t0: 26, t1: 27, dur: 1, role: 'operator', text: 'Добре.', tag: ['mystery', 'нове діло'] },
  ],
  scenes: null,
  metrics: {
    stats: {
      op_talk_s: 204.8,
      cl_talk_s: 164.8,
      silence_total_s: 42.5,
      max_silence_s: 10,
      overlap_total_s: 34.3,
      n_turns: 49,
      op_share: 55,
    },
  },
}

describe('CallTranscriptPanel — v7 format', () => {
  it('renders the two-sided v7 feed instead of scene sections', () => {
    setHook({ transcript: V7_TRANSCRIPT })
    render(<CallTranscriptPanel callId="c1" />)

    expect(screen.getByTestId('transcript-v7-feed')).toBeInTheDocument()
    expect(screen.queryByTestId('transcript-scene-0')).not.toBeInTheDocument()

    // Sides: client — left (self-start), operator — right (self-end).
    expect(screen.getByTestId('transcript-v7-turn-0').className).toContain('self-start')
    expect(screen.getByTestId('transcript-v7-turn-1').className).toContain('self-end')
    expect(screen.getByText('Слухаю.')).toBeInTheDocument()
  })

  it('keeps the legacy renderer for Ф1 transcripts (regression)', () => {
    setHook({ transcript: TRANSCRIPT })
    render(<CallTranscriptPanel callId="c1" />)
    expect(screen.queryByTestId('transcript-v7-feed')).not.toBeInTheDocument()
    expect(screen.getByTestId('transcript-scene-0')).toBeInTheDocument()
  })

  it('renders the stats header: call meta, talk balance and metric chips', () => {
    setHook({ transcript: V7_TRANSCRIPT })
    render(<CallTranscriptPanel callId="c1" />)

    const stats = screen.getByTestId('transcript-v7-stats')
    expect(stats).toHaveTextContent('07.07.2026') // answered_at date
    expect(stats).toHaveTextContent('6:20') // duration_s = 380
    expect(stats).toHaveTextContent('2102') // agent_extension
    expect(screen.getByTestId('transcript-v7-balance-op')).toHaveStyle({ width: '55%' })
    expect(screen.getByTestId('transcript-v7-chip-silence')).toHaveTextContent(
      'pages.training.transcript.v7.silenceMax'
    )
    expect(screen.getByTestId('transcript-v7-chip-overlap')).toHaveTextContent(
      'pages.training.transcript.v7.overlapTotal'
    )
    expect(screen.getByTestId('transcript-v7-chip-turns')).toHaveTextContent(
      'pages.training.transcript.v7.turns'
    )
  })

  it('shows a centered silence chip before turns with pause_before', () => {
    setHook({ transcript: V7_TRANSCRIPT })
    render(<CallTranscriptPanel callId="c1" />)
    expect(screen.getByTestId('transcript-v7-pause-1')).toHaveTextContent(
      'pages.training.transcript.v7.pause'
    )
    expect(screen.queryByTestId('transcript-v7-pause-0')).not.toBeInTheDocument()
  })

  it('marks overlapping turns with the «одночасно» badge', () => {
    setHook({ transcript: V7_TRANSCRIPT })
    render(<CallTranscriptPanel callId="c1" />)
    expect(screen.getByTestId('transcript-v7-overlap-2')).toHaveTextContent(
      'pages.training.transcript.v7.overlap'
    )
    expect(screen.queryByTestId('transcript-v7-overlap-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('transcript-v7-overlap-3')).not.toBeInTheDocument()
  })

  it('weaves the other side’s reaction into the bubble text at its time position', () => {
    setHook({ transcript: V7_TRANSCRIPT })
    render(<CallTranscriptPanel callId="c1" />)

    const chip = screen.getByTestId('transcript-v7-bc-1-0')
    expect(chip).toHaveTextContent('Ага.')
    expect(chip).toHaveTextContent('0:15') // reaction mini-timecode

    // t=15 is the middle of the 10..20 turn → between word 5 and word 6.
    const content = screen.getByTestId('transcript-v7-turn-1').textContent ?? ''
    expect(content.indexOf('Ага.')).toBeGreaterThan(content.indexOf('w5'))
    expect(content.indexOf('w6')).toBeGreaterThan(content.indexOf('Ага.'))
  })

  it('renders QA tag badges with semantic tones (unknown kind → grey)', () => {
    setHook({ transcript: V7_TRANSCRIPT })
    render(<CallTranscriptPanel callId="c1" />)

    const crit = screen.getByTestId('transcript-v7-tag-2')
    expect(crit).toHaveTextContent('тиск / звинувачення')
    expect(crit.className).toContain('text-[#c8492f]')

    const unknown = screen.getByTestId('transcript-v7-tag-3')
    expect(unknown).toHaveTextContent('нове діло')
    expect(unknown.className).toContain('text-[#5b6472]') // info fallback
  })

  it('lists tagged turns as key moments and seeks on click', () => {
    const onSeek = vi.fn()
    setHook({ transcript: V7_TRANSCRIPT })
    render(<CallTranscriptPanel callId="c1" onSeek={onSeek} />)

    const digest = screen.getByTestId('transcript-v7-keymoments')
    expect(digest).toHaveTextContent('тиск / звинувачення')
    expect(digest).toHaveTextContent('нове діло')

    fireEvent.click(screen.getByTestId('transcript-v7-moment-2'))
    expect(onSeek).toHaveBeenCalledWith(19500)
  })

  it('seeks the player from the turn timecode (t0 seconds → ms)', () => {
    const onSeek = vi.fn()
    setHook({ transcript: V7_TRANSCRIPT })
    render(<CallTranscriptPanel callId="c1" onSeek={onSeek} />)
    fireEvent.click(screen.getByTestId('transcript-v7-seek-1'))
    expect(onSeek).toHaveBeenCalledWith(10000)
  })

  it('detects v7 by metrics.stats alone and accepts tuple reactions', () => {
    setHook({
      transcript: {
        utterances: [
          { t0: 0, t1: 4, role: 'operator', text: 'a b c d', bc: [[2, 'client', 'угу']] },
        ],
        metrics: { stats: { op_share: 70 } },
      },
    })
    render(<CallTranscriptPanel callId="c1" />)
    expect(screen.getByTestId('transcript-v7-feed')).toBeInTheDocument()
    expect(screen.getByTestId('transcript-v7-bc-0-0')).toHaveTextContent('угу')
  })

  it('tolerates malformed v7 bits: unknown role, garbage tag/bc, extra fields', () => {
    const hostile = {
      t0: 0,
      t1: 1,
      dur: 1,
      role: 'martian',
      text: 'дивна роль',
      tag: 'oops',
      bc: 'nope',
      brand_new_field: { nested: true },
    } as unknown as TranscriptUtterance
    setHook({ transcript: { utterances: [hostile] } })
    render(<CallTranscriptPanel callId="c1" />)

    expect(screen.getByTestId('transcript-v7-feed')).toBeInTheDocument()
    expect(screen.getByText('дивна роль')).toBeInTheDocument()
    expect(screen.getByText('pages.training.transcript.roles.other')).toBeInTheDocument()
    expect(screen.queryByTestId('transcript-v7-tag-0')).not.toBeInTheDocument()
  })
})
