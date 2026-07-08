/**
 * CallTranscriptPanel tests (Ф1 — Call QA).
 *
 * Hook + permission are mocked (pattern: DialogueEvaluationTab.test.tsx); the
 * i18n mock in src/test/setup.ts returns the key, so assertions use keys.
 * Fixture data is synthetic (§5.5 canonical shape, no real PII).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type {
  CallAiReview,
  CallTranscript,
  ReviewConclusion,
  TranscriptUtterance,
} from '../../types'
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

  it('hides the zero promise amount: 0/null means «сума не прозвучала» (CEO 08.07)', () => {
    const review = {
      ...REVIEW,
      extracted: {
        promise: { amount: 0, currency: 'UAH', date: '2026-08-27', quote: 'до 27 числа включно' },
      },
    } as unknown as typeof REVIEW
    setHook({ transcript: TRANSCRIPT, review })
    render(<CallTranscriptPanel callId="c1" />)

    const promise = screen.getByTestId('transcript-promise')
    expect(promise).toHaveTextContent('2026-08-27')
    expect(promise).toHaveTextContent('до 27 числа включно')
    expect(promise.textContent).not.toContain('0 UAH')
    expect(promise.textContent ?? '').not.toMatch(/(^|[^\d.,:])0([^\d.,:]|$)/)
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

  it('weaves hesitation pauses into the bubble text at their time position', () => {
    const withHes: CallTranscript = {
      ...V7_TRANSCRIPT,
      utterances: V7_TRANSCRIPT.utterances.map((utt, i) =>
        i === 1 ? { ...utt, hes: [{ t: 12, gap: 1.2 }] } : utt
      ),
    }
    setHook({ transcript: withHes })
    render(<CallTranscriptPanel callId="c1" />)

    const remark = screen.getByTestId('transcript-v7-hes-1-0')
    expect(remark).toHaveTextContent('pages.training.transcript.v7.inlinePause')

    // t=12 → 20% into the 10..20 turn → after word 2 of 10; the bc reaction
    // at t=15 still lands after word 5 — both streams share one timeline.
    const content = screen.getByTestId('transcript-v7-turn-1').textContent ?? ''
    const remarkAt = content.indexOf('pages.training.transcript.v7.inlinePause')
    expect(remarkAt).toBeGreaterThan(content.indexOf('w2'))
    expect(content.indexOf('w3')).toBeGreaterThan(remarkAt)
    expect(content.indexOf('Ага.')).toBeGreaterThan(content.indexOf('w5'))
  })

  it('keeps a dictated number whole: drops the pause, slides the reaction after it', () => {
    // «Диктую 45 71 39 дякую» with a pause between «45»/«71» and a reaction
    // between «71»/«39» — dictation pace, so the pause is suppressed and the
    // reaction slides past the whole number instead of splitting the digits.
    const dictation: CallTranscript = {
      ...V7_TRANSCRIPT,
      utterances: V7_TRANSCRIPT.utterances.map((utt, i) =>
        i === 1
          ? {
              ...utt,
              text: 'Диктую 45 71 39 дякую',
              hes: [{ t: 14, gap: 1.4 }],
              bc: [{ t: 16, role: 'client', text: 'записую' }],
            }
          : utt
      ),
    }
    setHook({ transcript: dictation })
    render(<CallTranscriptPanel callId="c1" />)

    // Pause between digits is suppressed — no inline remark on this turn.
    expect(screen.queryByTestId('transcript-v7-hes-1-0')).not.toBeInTheDocument()

    // Reaction is kept, slid to after the whole number.
    expect(screen.getByTestId('transcript-v7-bc-1-0')).toHaveTextContent('записую')

    const content = screen.getByTestId('transcript-v7-turn-1').textContent ?? ''
    expect(content).toContain('45 71 39') // digits stay contiguous
    expect(content).not.toContain('pages.training.transcript.v7.inlinePause')
    expect(content.indexOf('записую')).toBeGreaterThan(content.indexOf('39'))
  })

  it('annotates the silence chip with ambient sounds from overlapping windows', () => {
    const withWindows: CallTranscript = {
      ...V7_TRANSCRIPT,
      metrics: {
        ...V7_TRANSCRIPT.metrics,
        // The pause before turn 1 is 8.4..10s — window 0 overlaps it.
        audio_windows: [
          { id: 0, t0: 0, t1: 10, events: ['музика', 'розтягнуті звуки (а-а)'] },
          { id: 1, t0: 10, t1: 20, events: ['сирена'] },
        ],
      },
    }
    setHook({ transcript: withWindows })
    render(<CallTranscriptPanel callId="c1" />)

    const pause = screen.getByTestId('transcript-v7-pause-1')
    expect(pause).toHaveTextContent('музика')
    // Speech-manner events never annotate a pause; window 1 starts at the
    // turn start and does not overlap the gap.
    expect(pause.textContent).not.toContain('розтягнуті')
    expect(pause.textContent).not.toContain('сирена')
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

// ---- Phase 2: 12B audio layer on top of v7 (conclusion_spec §A) ----

const AUDIO_DYNAMICS: NonNullable<CallTranscript['emotion_dynamics']> = {
  client: {
    start: { polarity: 'neutral', emotion: 'розгубленість', win: 0 },
    end: { polarity: 'pos', emotion: 'полегшення', win: 13 },
    trend: 'improved',
    peak_stress: { t: 10, win: 1, arousal: 3 },
    path: [
      { t: 0, polarity: 'neutral', arousal: 1 },
      { t: 10, polarity: 'neg', arousal: 3 },
      { t: 20, polarity: 'pos', arousal: 1 },
    ],
    scores: {
      start_arousal: 1.9,
      peak_arousal: 4,
      peak_t: 258,
      final_arousal: 1.2,
      trend: 'down',
    },
  },
  operator: {
    tone_baseline: 'діловий',
    tone_peaks: [{ t: 227.8, tone: 'тиснучий', arousal: 2 }],
    trend: 'stable_pressured',
    scores: { irritation_avg: 2.3, empathy_avg: 0.8 },
  },
  divergence_candidates: [
    { utt: 2, text_reads: 'згода', audio_reads: 'покірно, під тиском', reliability: 'M' },
    { utt: 99, text_reads: 'поза межами', audio_reads: 'ігнорується' },
  ],
}

const AUDIO_TRANSCRIPT: CallTranscript = {
  ...V7_TRANSCRIPT,
  utterances: V7_TRANSCRIPT.utterances.map((utt, i) => {
    if (i === 0) {
      // Client turn: neg polarity, high arousal, known event, M reliability.
      return {
        ...utt,
        audio: {
          window_ids: [0],
          speaker_state: {
            polarity: 'neg',
            emotion: 'роздратування',
            arousal: 3,
            events: ['перебивання'],
            confidence: 0.68,
            reliability: 'M',
            acoustic: 'швидкий темп, підвищена гучність',
          },
        },
      }
    }
    if (i === 1) {
      // Operator turn: pos polarity, calm, unknown event → text chip, H firm.
      return {
        ...utt,
        audio: {
          speaker_state: {
            polarity: 'pos',
            emotion: 'спокій',
            arousal: 0,
            events: ['дивний шум'],
            confidence: 0.9,
            reliability: 'H',
          },
        },
      }
    }
    return utt // turns 2..3 carry no audio layer
  }),
  // PRIMARY home of the audio layer — metrics.* (travels brain→CRM verbatim).
  metrics: {
    ...V7_TRANSCRIPT.metrics,
    audio_engine: 'gemma-4-12b-audio',
    audio_layer_version: '1.0',
    emotion_dynamics: AUDIO_DYNAMICS,
  },
}

describe('CallTranscriptPanel — v7 audio layer (phase 2, business style)', () => {
  it('renders only significant-state text badges: raised voice, no event chips', () => {
    setHook({ transcript: AUDIO_TRANSCRIPT })
    render(<CallTranscriptPanel callId="c1" />)

    // Turn 0: arousal 3 → thin «підвищений голос» badge; the «перебивання»
    // event stays in the payload without UI. M reliability → approx tooltip.
    const raised = screen.getByTestId('transcript-v7-audio-state-0-raisedVoice')
    expect(raised).toHaveTextContent('pages.training.transcript.v7.audio.states.raisedVoice')
    expect(raised).toHaveAttribute('title', 'pages.training.transcript.v7.audio.approx')
    expect(screen.queryByTestId('transcript-v7-audio-state-0-crying')).not.toBeInTheDocument()

    // Turn 1: calm (arousal 0) → no badges; its unknown event «дивний шум»
    // must not surface anywhere (the event chip row is gone).
    expect(screen.queryByTestId('transcript-v7-audio-state-1-raisedVoice')).not.toBeInTheDocument()
    expect(screen.queryByText('дивний шум')).not.toBeInTheDocument()

    // Turns without the layer render no badges either.
    expect(screen.queryByTestId('transcript-v7-audio-state-2-raisedVoice')).not.toBeInTheDocument()
  })

  it('renders the «плач» badge from a crying event, without the approx tooltip on H', () => {
    const crying: CallTranscript = {
      ...V7_TRANSCRIPT,
      utterances: V7_TRANSCRIPT.utterances.map((utt, i) =>
        i === 0
          ? {
              ...utt,
              audio: {
                speaker_state: {
                  polarity: 'neg',
                  emotion: 'відчай',
                  arousal: 1,
                  events: ['плач'],
                  reliability: 'H',
                },
              },
            }
          : utt
      ),
    }
    setHook({ transcript: crying })
    render(<CallTranscriptPanel callId="c1" />)

    const badge = screen.getByTestId('transcript-v7-audio-state-0-crying')
    expect(badge).toHaveTextContent('pages.training.transcript.v7.audio.states.crying')
    expect(badge).not.toHaveAttribute('title')
    expect(screen.queryByTestId('transcript-v7-audio-state-0-raisedVoice')).not.toBeInTheDocument()
  })

  it('renders no emoji anywhere in the business-style panel', () => {
    const withEverything: CallTranscript = {
      ...AUDIO_TRANSCRIPT,
      metrics: {
        ...AUDIO_TRANSCRIPT.metrics,
        stats: { ...V7_TRANSCRIPT.metrics?.stats, op_hes: 3, cl_hes: 5 },
        audio_windows: [{ id: 0, t0: 0, t1: 10, events: ['музика'] }],
      },
    }
    setHook({ transcript: withEverything })
    const { container } = render(<CallTranscriptPanel callId="c1" />)
    // Base code points — «✂» also matches the «✂️» emoji presentation.
    expect(container.textContent).not.toMatch(/🔊|⚡|✂|😢|⏸|⤭|⚠/u)
  })

  it('paints the bubble left border by polarity (neg red / pos green / none without audio)', () => {
    setHook({ transcript: AUDIO_TRANSCRIPT })
    render(<CallTranscriptPanel callId="c1" />)

    const negBubble = screen.getByText('Слухаю.').closest('div')
    expect(negBubble?.className).toContain('border-l-[#d1495b]')
    const posBubble = screen.getByText(/w1 w2 w3 w4 w5/).closest('div')
    expect(posBubble?.className).toContain('border-l-[#3aa66b]')
    const plainBubble = screen.getByText('Перебиваю відповідь.').closest('div')
    expect(plainBubble?.className).not.toContain('border-l-[#d1495b]')
    expect(plainBubble?.className).not.toContain('border-l-[#3aa66b]')
  })

  it('renders the client dynamics strip: smoothed bars, raw+smoothed tooltip, peak dot, seek', () => {
    const onSeek = vi.fn()
    setHook({ transcript: AUDIO_TRANSCRIPT })
    render(<CallTranscriptPanel callId="c1" onSeek={onSeek} />)

    expect(screen.getByTestId('transcript-v7-audio-dynamics')).toBeInTheDocument()
    const strip = screen.getByTestId('transcript-v7-audio-strip')
    expect(strip.querySelectorAll('button')).toHaveLength(3)

    // Peak dot only on the raw arousal-3 window (smoothing must not hide it).
    expect(screen.getByTestId('transcript-v7-audio-peak-1')).toBeInTheDocument()
    expect(screen.queryByTestId('transcript-v7-audio-peak-0')).not.toBeInTheDocument()

    // Tooltip carries raw + smoothed values via the i18n params.
    expect(screen.getByTestId('transcript-v7-audio-seg-1')).toHaveAttribute(
      'title',
      expect.stringContaining('pages.training.transcript.v7.audio.windowTooltip')
    )

    fireEvent.click(screen.getByTestId('transcript-v7-audio-seg-1'))
    expect(onSeek).toHaveBeenCalledWith(10000)
  })

  it('reads the audio layer from the top-level fallback when metrics has none', () => {
    setHook({
      transcript: {
        ...AUDIO_TRANSCRIPT,
        metrics: V7_TRANSCRIPT.metrics, // no audio keys in the primary home
        emotion_dynamics: AUDIO_DYNAMICS,
      },
    })
    render(<CallTranscriptPanel callId="c1" />)

    expect(screen.getByTestId('transcript-v7-audio-dynamics')).toBeInTheDocument()
  })

  it('shows start → end dynamics chips with the semantic trend arrow', () => {
    setHook({ transcript: AUDIO_TRANSCRIPT })
    render(<CallTranscriptPanel callId="c1" />)

    const chips = screen.getByTestId('transcript-v7-audio-startend')
    expect(chips).toHaveTextContent('розгубленість')
    expect(chips).toHaveTextContent('полегшення')
    const trend = screen.getByTestId('transcript-v7-audio-trend')
    expect(trend).toHaveTextContent('↑') // improved
    expect(trend.className).toContain('text-[#3aa66b]')
  })

  it('marks «тон ≠ слова» turns with a text badge and lists them among key moments', () => {
    const onSeek = vi.fn()
    setHook({ transcript: AUDIO_TRANSCRIPT })
    render(<CallTranscriptPanel callId="c1" onSeek={onSeek} />)

    const badge = screen.getByTestId('transcript-v7-divergence-2')
    expect(badge).toHaveTextContent('pages.training.transcript.v7.audio.toneVsWords')
    expect(badge.textContent).not.toContain('⚠')
    expect(badge.title).toContain('згода')
    expect(badge.title).toContain('покірно, під тиском')

    const digestRow = screen.getByTestId('transcript-v7-moment-div-2')
    expect(digestRow).toHaveTextContent('згода')
    fireEvent.click(digestRow)
    expect(onSeek).toHaveBeenCalledWith(19500) // turn 2 starts at 19.5s

    // utt=99 points past the feed → no digest row, nothing crashes.
    expect(screen.queryByTestId('transcript-v7-moment-div-99')).not.toBeInTheDocument()
  })

  it('adds numeric operator/client emotion scores to the stats header', () => {
    setHook({ transcript: AUDIO_TRANSCRIPT })
    render(<CallTranscriptPanel callId="c1" />)

    const operator = screen.getByTestId('transcript-v7-chip-operator-audio')
    expect(operator).toHaveTextContent('діловий')
    expect(operator).toHaveTextContent('2.3/5')
    expect(operator).toHaveTextContent('0.8/5')

    const client = screen.getByTestId('transcript-v7-chip-client-audio')
    expect(client).toHaveTextContent('1.9')
    expect(client).toHaveTextContent('4 (4:18)') // peak with m:ss timecode
    expect(client).toHaveTextContent('1.2')
    expect(screen.getByTestId('transcript-v7-client-trend')).toHaveTextContent('↓')
  })

  it('adds hesitation counters to the operator and client chips', () => {
    const withHesStats: CallTranscript = {
      ...AUDIO_TRANSCRIPT,
      metrics: {
        ...AUDIO_TRANSCRIPT.metrics,
        stats: { ...V7_TRANSCRIPT.metrics?.stats, op_hes: 3, cl_hes: 5 },
      },
    }
    setHook({ transcript: withHesStats })
    render(<CallTranscriptPanel callId="c1" />)

    expect(screen.getByTestId('transcript-v7-chip-operator-audio')).toHaveTextContent(
      'pages.training.transcript.v7.hesitations'
    )
    expect(screen.getByTestId('transcript-v7-client-hes')).toHaveTextContent(
      'pages.training.transcript.v7.hesitations'
    )
  })

  it('renders hesitation counters without the 12B layer (deterministic stats)', () => {
    setHook({
      transcript: {
        ...V7_TRANSCRIPT,
        metrics: { stats: { ...V7_TRANSCRIPT.metrics?.stats, op_hes: 2, cl_hes: 0 } },
      },
    })
    render(<CallTranscriptPanel callId="c1" />)

    const operator = screen.getByTestId('transcript-v7-chip-operator-audio')
    expect(operator).toHaveTextContent('pages.training.transcript.v7.hesitations')
    // Counters are deterministic — no «by audio, approximate» tooltip.
    expect(operator).not.toHaveAttribute('title')
    expect(screen.getByTestId('transcript-v7-client-hes')).toBeInTheDocument()
  })

  it('renders nothing audio-related without the layer (regression)', () => {
    setHook({ transcript: V7_TRANSCRIPT })
    render(<CallTranscriptPanel callId="c1" />)

    expect(screen.queryByTestId('transcript-v7-audio-dynamics')).not.toBeInTheDocument()
    expect(screen.queryByTestId('transcript-v7-audio-strip')).not.toBeInTheDocument()
    expect(screen.queryByTestId('transcript-v7-chip-operator-audio')).not.toBeInTheDocument()
    expect(screen.queryByTestId('transcript-v7-chip-client-audio')).not.toBeInTheDocument()
    expect(screen.queryByTestId('transcript-v7-audio-state-0-raisedVoice')).not.toBeInTheDocument()
    expect(screen.queryByTestId('transcript-v7-hes-1-0')).not.toBeInTheDocument()
    expect(screen.queryByTestId('transcript-v7-divergence-2')).not.toBeInTheDocument()
  })

  it('tolerates a malformed audio layer without crashing or rendering it', () => {
    const broken = {
      ...V7_TRANSCRIPT,
      audio_engine: 'gemma-4-12b-audio',
      utterances: V7_TRANSCRIPT.utterances.map((utt, i) =>
        i === 0 ? ({ ...utt, audio: 'nope' } as unknown as TranscriptUtterance) : utt
      ),
      emotion_dynamics: {
        client: { path: 'garbage', scores: 'none' },
        operator: 'broken',
        divergence_candidates: [{ utt: 'x' }, 42, null],
      } as unknown as CallTranscript['emotion_dynamics'],
    }
    setHook({ transcript: broken })
    render(<CallTranscriptPanel callId="c1" />)

    expect(screen.getByTestId('transcript-v7-feed')).toBeInTheDocument()
    expect(screen.queryByTestId('transcript-v7-audio-dynamics')).not.toBeInTheDocument()
    expect(screen.queryByTestId('transcript-v7-audio-state-0-raisedVoice')).not.toBeInTheDocument()
    expect(screen.queryByTestId('transcript-v7-chip-operator-audio')).not.toBeInTheDocument()
  })
})

// ---- Step B: 31B conclusion block («Заключення AI») under the dialogue ----

const CONCLUSION: ReviewConclusion = {
  call_summary: 'Розмова про борг.',
  overall: { grade: 'yellow', score: 35.0, one_liner: 'Тиск без ідентифікації.' },
  operator_assessment: {
    score: 35,
    rubric_score_input: 40,
    adjustment: -5,
    adjustment_reason: 'тон жорсткіший за слова',
    strengths: ['чітка вимога суми'],
    weaknesses: ['без привітання', 'погроза виїздом'],
    justification: 'Оператор не ідентифікував боржника.',
  },
  client_dynamics: { trend: 'improved' },
  tone_vs_words: {
    consistent: false,
    divergences: [
      {
        who: 'client',
        utt: 2,
        said: 'згода',
        sounded: 'покірно, під тиском',
        reliability: 'M',
        interpretation: 'згода не добровільна',
      },
    ],
  },
  // utt 3 resolves to a rendered turn; utt 99 points past the feed.
  key_findings: ['Погроза виїздом (utt 3)', 'Поза лентою (utt 99)'],
  recommendations: [
    { text: 'Пройти модуль ідентифікації', evidence: 'utt 1', priority: 'high' },
    { text: 'Стежити за тоном', priority: 'normal' },
  ],
  confidence: { overall: 0.95, limited_by: ['no_audio_layer'] },
  model: 'gemma-31b',
  conclusion_prompt_version: '1.0',
}

describe('CallTranscriptPanel — 31B conclusion block (step B)', () => {
  it('renders the full conclusion: grade, calc line, columns, findings, tone, recommendations, meta', () => {
    setHook({ transcript: V7_TRANSCRIPT, review: { conclusion: CONCLUSION } })
    const { container } = render(<CallTranscriptPanel callId="c1" />)

    const block = screen.getByTestId('transcript-conclusion')
    expect(block).toHaveTextContent('pages.training.transcript.v7.conclusion.title')

    // Header: yellow grade badge with the score, one-liner in the body.
    const grade = screen.getByTestId('transcript-conclusion-grade')
    expect(grade).toHaveTextContent('35/100')
    expect(grade.className).toContain('bg-yellow-100')
    expect(screen.getByTestId('transcript-conclusion-oneliner')).toHaveTextContent(
      'Тиск без ідентифікації.'
    )

    // «Чому такий бал»: calc line with the adjustment reason + justification.
    const calc = screen.getByTestId('transcript-conclusion-calc')
    expect(calc).toHaveTextContent('pages.training.transcript.v7.conclusion.calc')
    expect(calc).toHaveTextContent('тон жорсткіший за слова')
    expect(screen.getByTestId('transcript-conclusion-justification')).toHaveTextContent(
      'Оператор не ідентифікував боржника.'
    )

    // Strengths / weaknesses columns.
    expect(screen.getByTestId('transcript-conclusion-strengths')).toHaveTextContent(
      'чітка вимога суми'
    )
    const weaknesses = screen.getByTestId('transcript-conclusion-weaknesses')
    expect(weaknesses).toHaveTextContent('без привітання')
    expect(weaknesses).toHaveTextContent('погроза виїздом')

    // Key findings + tone ≠ words subsection.
    expect(screen.getByTestId('transcript-conclusion-findings')).toHaveTextContent(
      'Погроза виїздом'
    )
    const tone = screen.getByTestId('transcript-conclusion-tone')
    expect(tone).toHaveTextContent('«згода»')
    expect(tone).toHaveTextContent('«покірно, під тиском»')
    expect(tone).toHaveTextContent('згода не добровільна')

    // Recommendations with priority labels and evidence.
    const recommendations = screen.getByTestId('transcript-conclusion-recommendations')
    expect(recommendations).toHaveTextContent(
      'pages.training.transcript.v7.conclusion.priority.high'
    )
    expect(recommendations).toHaveTextContent('Пройти модуль ідентифікації')
    expect(recommendations).toHaveTextContent('Стежити за тоном')

    // Muted meta line + limitations note.
    const meta = screen.getByTestId('transcript-conclusion-meta')
    expect(meta).toHaveTextContent('gemma-31b')
    expect(meta).toHaveTextContent('v1.0')
    expect(screen.getByTestId('transcript-conclusion-limitations')).toHaveTextContent(
      'pages.training.transcript.v7.conclusion.limitedBy'
    )

    // Business style: no emoji anywhere.
    expect(container.textContent).not.toMatch(/🔊|⚡|✂|😢|⏸|⤭|⚠/u)
  })

  it('seeks the player from utt references in findings, evidence and divergences', () => {
    const onSeek = vi.fn()
    setHook({ transcript: V7_TRANSCRIPT, review: { conclusion: CONCLUSION } })
    render(<CallTranscriptPanel callId="c1" onSeek={onSeek} />)

    // Finding «utt 3» → turn 3 starts at 26s.
    fireEvent.click(screen.getByTestId('transcript-conclusion-utt-3'))
    expect(onSeek).toHaveBeenCalledWith(26000)

    // Recommendation evidence «utt 1» → turn 1 starts at 10s.
    fireEvent.click(screen.getByTestId('transcript-conclusion-utt-1'))
    expect(onSeek).toHaveBeenCalledWith(10000)

    // Divergence anchor «utt 2» → turn 2 starts at 19.5s.
    fireEvent.click(screen.getByTestId('transcript-conclusion-utt-2'))
    expect(onSeek).toHaveBeenCalledWith(19500)
  })

  it('keeps out-of-range utt references as plain text', () => {
    setHook({ transcript: V7_TRANSCRIPT, review: { conclusion: CONCLUSION } })
    render(<CallTranscriptPanel callId="c1" />)

    expect(screen.queryByTestId('transcript-conclusion-utt-99')).not.toBeInTheDocument()
    expect(screen.getByTestId('transcript-conclusion-findings')).toHaveTextContent('utt 99')
  })

  it('renders partial conclusions per available part', () => {
    setHook({
      transcript: V7_TRANSCRIPT,
      review: { conclusion: { overall: { grade: 'red' } } },
    })
    render(<CallTranscriptPanel callId="c1" />)

    const grade = screen.getByTestId('transcript-conclusion-grade')
    expect(grade).toHaveTextContent('red') // no score → raw grade word
    expect(grade.className).toContain('bg-red-100')
    expect(screen.queryByTestId('transcript-conclusion-calc')).not.toBeInTheDocument()
    expect(screen.queryByTestId('transcript-conclusion-strengths')).not.toBeInTheDocument()
    expect(screen.queryByTestId('transcript-conclusion-tone')).not.toBeInTheDocument()
    expect(screen.queryByTestId('transcript-conclusion-meta')).not.toBeInTheDocument()
  })

  it('collapses and expands the block on header click', () => {
    setHook({ transcript: V7_TRANSCRIPT, review: { conclusion: CONCLUSION } })
    render(<CallTranscriptPanel callId="c1" />)

    expect(screen.getByTestId('transcript-conclusion-oneliner')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('transcript-conclusion-toggle'))
    expect(screen.queryByTestId('transcript-conclusion-oneliner')).not.toBeInTheDocument()
    // The grade badge stays visible in the collapsed header.
    expect(screen.getByTestId('transcript-conclusion-grade')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('transcript-conclusion-toggle'))
    expect(screen.getByTestId('transcript-conclusion-oneliner')).toBeInTheDocument()
  })

  it('renders the block for legacy Ф1 transcripts too', () => {
    setHook({ transcript: TRANSCRIPT, review: { conclusion: CONCLUSION } })
    render(<CallTranscriptPanel callId="c1" />)

    expect(screen.getByTestId('transcript-scene-0')).toBeInTheDocument()
    expect(screen.getByTestId('transcript-conclusion')).toBeInTheDocument()
  })

  it('renders no block without a conclusion (older reviews / Ф1) — regression', () => {
    setHook({ transcript: V7_TRANSCRIPT, review: REVIEW })
    render(<CallTranscriptPanel callId="c1" />)
    expect(screen.queryByTestId('transcript-conclusion')).not.toBeInTheDocument()

    setHook({ transcript: V7_TRANSCRIPT, review: null })
    render(<CallTranscriptPanel callId="c1" />)
    expect(screen.queryByTestId('transcript-conclusion')).not.toBeInTheDocument()
  })

  it('tolerates a malformed conclusion without crashing or rendering it', () => {
    setHook({
      transcript: V7_TRANSCRIPT,
      review: { conclusion: 'broken' } as unknown as CallAiReview,
    })
    render(<CallTranscriptPanel callId="c1" />)

    expect(screen.getByTestId('transcript-v7-feed')).toBeInTheDocument()
    expect(screen.queryByTestId('transcript-conclusion')).not.toBeInTheDocument()
  })
})
