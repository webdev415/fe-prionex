/**
 * transcriptAudio helper tests — significant-state derivation from the 12B
 * speaker state (business style: only raised voice / crying surface), FE
 * smoothing of the raw emotion path (MA-3, peaks preserved), divergence
 * normalisation, ambient annotation of silence gaps and score/trend
 * formatting. Pure functions.
 */
import { describe, expect, it } from 'vitest'
import type { AudioWindow, CallTranscript, EmotionDynamics } from '../../types'
import {
  buildDynamicsSegments,
  deriveSignificantStates,
  directionalTrendGlyph,
  divergencesByUtt,
  dynamicsScaleMax,
  formatScore,
  getAudioWindows,
  getEmotionDynamics,
  isApproximateReliability,
  isEnvironmentEvent,
  normalizeDivergences,
  normalizePolarity,
  normalizeTrend,
  pauseEnvironmentLabels,
  speakerStateOf,
} from '../transcriptAudio'

describe('getEmotionDynamics', () => {
  const dyn = { client: { trend: 'improved' } } as unknown as EmotionDynamics

  it('prefers the primary home metrics.emotion_dynamics over the top level', () => {
    const other = { client: { trend: 'degraded' } } as unknown as EmotionDynamics
    const transcript = {
      utterances: [],
      metrics: { emotion_dynamics: dyn },
      emotion_dynamics: other,
    } as CallTranscript
    expect(getEmotionDynamics(transcript)).toBe(dyn)
  })

  it('falls back to the top-level field, tolerating malformed primaries', () => {
    expect(getEmotionDynamics({ utterances: [], emotion_dynamics: dyn } as CallTranscript)).toBe(
      dyn
    )
    expect(
      getEmotionDynamics({
        utterances: [],
        metrics: { emotion_dynamics: ['not', 'an', 'object'] },
        emotion_dynamics: dyn,
      } as unknown as CallTranscript)
    ).toBe(dyn)
    expect(getEmotionDynamics({ utterances: [] } as unknown as CallTranscript)).toBeNull()
    expect(getEmotionDynamics(null)).toBeNull()
  })
})

describe('normalizePolarity', () => {
  it('keeps neg/pos, everything else collapses to neutral', () => {
    expect(normalizePolarity('neg')).toBe('neg')
    expect(normalizePolarity('pos')).toBe('pos')
    expect(normalizePolarity('neutral')).toBe('neutral')
    expect(normalizePolarity('weird')).toBe('neutral')
    expect(normalizePolarity(undefined)).toBe('neutral')
  })
})

describe('deriveSignificantStates', () => {
  it('derives «підвищений голос» from arousal ≥ 2 and «плач» from events', () => {
    expect(deriveSignificantStates({ arousal: 2 })).toEqual(['raisedVoice'])
    expect(deriveSignificantStates({ arousal: 3, events: ['плач'] })).toEqual([
      'raisedVoice',
      'crying',
    ])
    expect(deriveSignificantStates({ arousal: 0, events: ['схлипування'] })).toEqual(['crying'])
  })

  it('hears crying in the emotion wording too', () => {
    expect(deriveSignificantStates({ arousal: 1, emotion: 'плаче, ридання' })).toEqual(['crying'])
  })

  it('keeps every other 12B event out of the UI (business style)', () => {
    expect(
      deriveSignificantStates({
        arousal: 1,
        events: ['розтягнуті звуки (а-а)', 'невпевнена мова', 'перебивання', 'дивний шум'],
      })
    ).toEqual([])
  })

  it('is calm on low arousal, missing fields and garbage', () => {
    expect(deriveSignificantStates({ arousal: 1, emotion: 'спокій' })).toEqual([])
    expect(deriveSignificantStates({})).toEqual([])
    expect(deriveSignificantStates(null)).toEqual([])
    expect(deriveSignificantStates(undefined)).toEqual([])
    expect(deriveSignificantStates({ events: [null, 42, ''] as unknown as string[] })).toEqual([])
  })
})

describe('isApproximateReliability', () => {
  it('marks M/L reliability as approximate, H/unknown as firm', () => {
    expect(isApproximateReliability('M')).toBe(true)
    expect(isApproximateReliability('L')).toBe(true)
    expect(isApproximateReliability('H')).toBe(false)
    expect(isApproximateReliability(undefined)).toBe(false)
  })
})

describe('buildDynamicsSegments', () => {
  it('smooths arousal with a centered MA-3 while keeping raw values', () => {
    const segments = buildDynamicsSegments(
      [
        { t: 0, polarity: 'neutral', arousal: 1 },
        { t: 10, polarity: 'neg', arousal: 3 },
        { t: 20, polarity: 'pos', arousal: 1 },
      ],
      30
    )
    expect(segments).toHaveLength(3)
    expect(segments.map((s) => s.rawArousal)).toEqual([1, 3, 1])
    expect(segments[0].smoothArousal).toBeCloseTo(2) // mean(1,3)
    expect(segments[1].smoothArousal).toBeCloseTo(5 / 3) // mean(1,3,1)
    expect(segments[2].smoothArousal).toBeCloseTo(2) // mean(3,1)
    expect(segments.map((s) => s.polarity)).toEqual(['neutral', 'neg', 'pos'])
  })

  it('marks raw peaks (arousal ≥ 3) so smoothing cannot hide a shout', () => {
    const segments = buildDynamicsSegments(
      [
        { t: 0, arousal: 0 },
        { t: 10, arousal: 3 },
        { t: 20, arousal: 0 },
      ],
      30
    )
    expect(segments.map((s) => s.isPeak)).toEqual([false, true, false])
  })

  it('sorts by time and closes the last window at the call end', () => {
    const segments = buildDynamicsSegments(
      [
        { t: 20, arousal: 1 },
        { t: 0, arousal: 1 },
      ],
      35
    )
    expect(segments.map((s) => s.t)).toEqual([0, 20])
    expect(segments[0].tEnd).toBe(20)
    expect(segments[1].tEnd).toBe(35)
  })

  it('falls back to a ~10s window without duration and survives garbage', () => {
    const segments = buildDynamicsSegments([{ t: 5, arousal: 2 }])
    expect(segments[0].tEnd).toBe(15)
    expect(buildDynamicsSegments(null)).toEqual([])
    expect(buildDynamicsSegments([null, 'x'] as unknown as [])).toEqual([])
  })
})

describe('dynamicsScaleMax', () => {
  it('never drops below the peak threshold and follows higher raw values', () => {
    expect(dynamicsScaleMax([])).toBe(3)
    const segments = buildDynamicsSegments([{ t: 0, arousal: 5 }], 10)
    expect(dynamicsScaleMax(segments)).toBe(5)
  })
})

describe('getAudioWindows', () => {
  const windows: AudioWindow[] = [{ id: 0, t0: 0, t1: 10, events: ['музика'] }]

  it('prefers metrics.audio_windows over the top-level fallback', () => {
    const other: AudioWindow[] = [{ id: 9, t0: 90, t1: 100 }]
    expect(
      getAudioWindows({
        utterances: [],
        metrics: { audio_windows: windows },
        audio_windows: other,
      })
    ).toEqual(windows)
  })

  it('falls back to the top level and drops non-object entries', () => {
    expect(getAudioWindows({ utterances: [], audio_windows: windows })).toEqual(windows)
    expect(
      getAudioWindows({
        utterances: [],
        metrics: { audio_windows: 'nope' },
        audio_windows: [null, 42, ...windows] as unknown as AudioWindow[],
      } as unknown as CallTranscript)
    ).toEqual(windows)
    expect(getAudioWindows({ utterances: [] })).toEqual([])
    expect(getAudioWindows(null)).toEqual([])
  })
})

describe('pauseEnvironmentLabels', () => {
  const windows: AudioWindow[] = [
    { id: 0, t0: 0, t1: 10, events: ['музика', 'розтягнуті звуки (а-а)'] },
    { id: 1, t0: 10, t1: 20, events: ['фоновий шум', 'перебивання'] },
    { id: 2, t0: 20, t1: 30, events: ['сирена'] },
  ]

  it('collects whitelist ambient events from overlapping windows only', () => {
    // Gap 8..12 overlaps windows 0 and 1 but not 2.
    expect(pauseEnvironmentLabels(windows, 8, 12)).toEqual(['музика', 'фоновий шум'])
    expect(pauseEnvironmentLabels(windows, 25, 28)).toEqual(['сирена'])
    expect(pauseEnvironmentLabels(windows, 40, 50)).toEqual([])
  })

  it('never lets speech-manner events annotate a pause', () => {
    const manners: AudioWindow[] = [
      {
        t0: 0,
        t1: 10,
        events: ['розтягнуті звуки (а-а)', 'невпевнена мова', 'перебивання', 'крик', 'плач'],
      },
    ]
    expect(pauseEnvironmentLabels(manners, 0, 10)).toEqual([])
  })

  it('dedupes case-insensitively and keeps the original wording', () => {
    const dupes: AudioWindow[] = [
      { t0: 0, t1: 5, events: ['Музика'] },
      { t0: 5, t1: 10, events: ['музика', 'дитина на фоні', 'кашель'] },
    ]
    expect(pauseEnvironmentLabels(dupes, 0, 10)).toEqual(['Музика', 'дитина на фоні', 'кашель'])
  })

  it('survives malformed windows and degenerate intervals', () => {
    const hostile = [
      { events: ['музика'] }, // no timestamps
      { t0: 'x', t1: 5, events: ['музика'] },
      { t0: 0, t1: 10, events: 'nope' },
      { t0: 0, t1: 10, events: [null, 42, ''] },
    ] as unknown as AudioWindow[]
    expect(pauseEnvironmentLabels(hostile, 0, 10)).toEqual([])
    expect(pauseEnvironmentLabels(windows, 12, 8)).toEqual([]) // inverted
    expect(pauseEnvironmentLabels(windows, Number.NaN, 10)).toEqual([])
  })

  it('isEnvironmentEvent matches the ambient whitelist stems only', () => {
    expect(isEnvironmentEvent('музика')).toBe(true)
    expect(isEnvironmentEvent('шум')).toBe(true)
    expect(isEnvironmentEvent('дитина на фоні')).toBe(true)
    expect(isEnvironmentEvent('невпевнена мова')).toBe(false)
    expect(isEnvironmentEvent('крик')).toBe(false)
  })
})

describe('trend / score formatting', () => {
  it('normalizeTrend keeps the evaluative dialect, unknown → other', () => {
    expect(normalizeTrend('improved')).toEqual({ kind: 'improved', raw: 'improved' })
    expect(normalizeTrend('degraded')?.kind).toBe('degraded')
    expect(normalizeTrend('stable')?.kind).toBe('stable')
    expect(normalizeTrend('stable_pressured')).toEqual({
      kind: 'other',
      raw: 'stable_pressured',
    })
    expect(normalizeTrend('')).toBeNull()
    expect(normalizeTrend(42)).toBeNull()
  })

  it('directionalTrendGlyph speaks up/down/stable, unknown falls back to raw', () => {
    expect(directionalTrendGlyph('down')).toBe('↓')
    expect(directionalTrendGlyph('up')).toBe('↑')
    expect(directionalTrendGlyph('stable')).toBe('→')
    expect(directionalTrendGlyph('improved')).toBe('improved')
    expect(directionalTrendGlyph(undefined)).toBeNull()
  })

  it('formatScore renders integers bare and fractions with one decimal', () => {
    expect(formatScore(4)).toBe('4')
    expect(formatScore(1.9)).toBe('1.9')
    expect(formatScore(2.25)).toBe('2.3')
    expect(formatScore(Number.NaN)).toBe('0')
  })
})

describe('divergences', () => {
  const dynamics: EmotionDynamics = {
    divergence_candidates: [
      { utt: 40, text_reads: 'згода', audio_reads: 'покірно, під тиском', reliability: 'M' },
      { utt: 40, text_reads: 'дубль', audio_reads: 'дубль' },
      { utt: -1, text_reads: 'сміття', audio_reads: 'сміття' },
      { text_reads: 'без utt', audio_reads: 'без utt' },
      { utt: 7 }, // both reads empty → dropped
      null as unknown as { utt: number },
    ],
  }

  it('normalises valid candidates and drops the rest', () => {
    const list = normalizeDivergences(dynamics)
    expect(list).toEqual([
      { utt: 40, textReads: 'згода', audioReads: 'покірно, під тиском', reliability: 'M' },
      { utt: 40, textReads: 'дубль', audioReads: 'дубль', reliability: undefined },
    ])
    expect(normalizeDivergences(null)).toEqual([])
    expect(
      normalizeDivergences({ divergence_candidates: 'nope' } as unknown as EmotionDynamics)
    ).toEqual([])
  })

  it('divergencesByUtt keeps the first candidate per utterance', () => {
    const map = divergencesByUtt(dynamics)
    expect(map.size).toBe(1)
    expect(map.get(40)?.textReads).toBe('згода')
  })
})

describe('speakerStateOf', () => {
  it('returns the state only when it is an object', () => {
    expect(
      speakerStateOf({ t0: 0, t1: 1, text: 'x', audio: { speaker_state: { arousal: 2 } } })
    ).toEqual({ arousal: 2 })
    expect(speakerStateOf({ t0: 0, t1: 1, text: 'x' })).toBeNull()
    expect(speakerStateOf({ t0: 0, t1: 1, text: 'x', audio: 'nope' as never })).toBeNull()
    expect(speakerStateOf(null)).toBeNull()
  })
})
