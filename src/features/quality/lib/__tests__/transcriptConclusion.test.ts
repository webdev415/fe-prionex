/**
 * transcriptConclusion helper tests — tolerant normalisation of the 31B
 * `review.conclusion` into the view model, `utt N` reference splitting and
 * adjustment formatting. Pure functions, no i18n/DOM.
 */
import { describe, expect, it } from 'vitest'
import type { CallAiReview, ReviewConclusion } from '../../types'
import {
  formatAdjustment,
  formatConfidence,
  getConclusion,
  normalizeConclusion,
  normalizeConclusionRecommendations,
  splitUttReferences,
} from '../transcriptConclusion'

const FULL_CONCLUSION: ReviewConclusion = {
  call_summary: 'Розмова про борг.',
  overall: { grade: 'yellow', score: 35.0, one_liner: 'Тиск без ідентифікації.' },
  operator_assessment: {
    score: 35,
    rubric_score_input: 40,
    adjustment: -5,
    adjustment_reason: 'тон жорсткіший за слова',
    strengths: ['чітка вимога'],
    weaknesses: ['без привітання', 'погроза виїздом'],
    justification: 'Оператор не ідентифікував боржника (utt 2).',
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
  key_findings: ['Погроза виїздом (utt 3)', 'Без ідентифікації'],
  recommendations: [
    { text: 'Пройти модуль ідентифікації', evidence: 'utt 1', priority: 'high' },
    { text: 'Стежити за тоном', priority: 'normal' },
  ],
  confidence: { overall: 0.95, limited_by: ['no_audio_layer'] },
  model: 'gemma-31b',
  conclusion_prompt_version: '1.0',
}

function reviewWith(conclusion: unknown): CallAiReview {
  return { conclusion } as CallAiReview
}

describe('getConclusion', () => {
  it('returns the conclusion only when it is a plain object', () => {
    expect(getConclusion(reviewWith(FULL_CONCLUSION))).toBe(FULL_CONCLUSION)
    expect(getConclusion(reviewWith(null))).toBeNull()
    expect(getConclusion(reviewWith('nope'))).toBeNull()
    expect(getConclusion(reviewWith([1, 2]))).toBeNull()
    expect(getConclusion({} as CallAiReview)).toBeNull()
    expect(getConclusion(null)).toBeNull()
  })
})

describe('normalizeConclusion', () => {
  it('maps the full 31B conclusion into the view model', () => {
    const normalized = normalizeConclusion(reviewWith(FULL_CONCLUSION))
    expect(normalized).not.toBeNull()
    expect(normalized?.grade).toBe('yellow')
    expect(normalized?.score).toBe(35)
    expect(normalized?.oneLiner).toBe('Тиск без ідентифікації.')
    expect(normalized?.justification).toContain('utt 2')
    expect(normalized?.rubricScoreInput).toBe(40)
    expect(normalized?.adjustment).toBe(-5)
    expect(normalized?.adjustmentReason).toBe('тон жорсткіший за слова')
    expect(normalized?.assessmentScore).toBe(35)
    expect(normalized?.strengths).toEqual(['чітка вимога'])
    expect(normalized?.weaknesses).toHaveLength(2)
    expect(normalized?.keyFindings).toHaveLength(2)
    expect(normalized?.divergences).toEqual([
      {
        utt: 2,
        said: 'згода',
        sounded: 'покірно, під тиском',
        interpretation: 'згода не добровільна',
        reliability: 'M',
      },
    ])
    expect(normalized?.recommendations).toHaveLength(2)
    expect(normalized?.confidenceOverall).toBe(0.95)
    expect(normalized?.limitedBy).toEqual(['no_audio_layer'])
    expect(normalized?.model).toBe('gemma-31b')
    expect(normalized?.promptVersion).toBe('1.0')
  })

  it('hides tone divergences when the 31B marked the call consistent', () => {
    const consistent = normalizeConclusion(
      reviewWith({
        ...FULL_CONCLUSION,
        tone_vs_words: { ...FULL_CONCLUSION.tone_vs_words, consistent: true },
      })
    )
    expect(consistent?.divergences).toEqual([])

    // Missing `consistent` with shipped divergences still counts as flagged.
    const unflagged = normalizeConclusion(
      reviewWith({
        tone_vs_words: { divergences: [{ utt: 1, said: 'а', sounded: 'б' }] },
      })
    )
    expect(unflagged?.divergences).toHaveLength(1)
  })

  it('falls back to overall.score when the assessment has no score', () => {
    const normalized = normalizeConclusion(
      reviewWith({
        overall: { score: 72 },
        operator_assessment: { rubric_score_input: 70, adjustment: 2 },
      })
    )
    expect(normalized?.assessmentScore).toBe(72)
  })

  it('returns null for absent, malformed or empty conclusions', () => {
    expect(normalizeConclusion(null)).toBeNull()
    expect(normalizeConclusion({} as CallAiReview)).toBeNull()
    expect(normalizeConclusion(reviewWith('broken'))).toBeNull()
    expect(normalizeConclusion(reviewWith({}))).toBeNull()
    expect(
      normalizeConclusion(
        reviewWith({ model: 'gemma-31b', confidence: { overall: 0.9 } }) // meta only
      )
    ).toBeNull()
  })

  it('survives hostile nested shapes without crashing', () => {
    const normalized = normalizeConclusion(
      reviewWith({
        overall: 'nope',
        operator_assessment: { strengths: 'not-a-list', adjustment: 'x' },
        tone_vs_words: { consistent: false, divergences: [null, 42, { utt: -1 }] },
        key_findings: [null, 42, 'валідний висновок'],
        recommendations: 'none',
        confidence: { overall: 'high', limited_by: [null, 'no_audio_layer'] },
      })
    )
    expect(normalized).not.toBeNull()
    expect(normalized?.grade).toBeNull()
    expect(normalized?.strengths).toEqual([])
    expect(normalized?.adjustment).toBeNull()
    expect(normalized?.divergences).toEqual([]) // both reads empty → dropped
    expect(normalized?.keyFindings).toEqual(['валідний висновок'])
    expect(normalized?.recommendations).toEqual([])
    expect(normalized?.confidenceOverall).toBeNull()
    expect(normalized?.limitedBy).toEqual(['no_audio_layer'])
  })
})

describe('normalizeConclusionRecommendations', () => {
  it('accepts objects and bare strings, drops garbage', () => {
    expect(
      normalizeConclusionRecommendations([
        { text: 'Пройти модуль', evidence: 'utt 1', priority: 'high' },
        'Просто порада',
        { text: '' },
        { evidence: 'utt 5' },
        null,
        42,
        '',
      ])
    ).toEqual([
      { text: 'Пройти модуль', evidence: 'utt 1', priority: 'high' },
      { text: 'Просто порада', evidence: null, priority: null },
    ])
    expect(normalizeConclusionRecommendations('nope')).toEqual([])
  })
})

describe('formatAdjustment', () => {
  it('signs positives explicitly and keeps one decimal for fractions', () => {
    expect(formatAdjustment(5)).toBe('+5')
    expect(formatAdjustment(-5)).toBe('-5')
    expect(formatAdjustment(0)).toBe('0')
    expect(formatAdjustment(2.5)).toBe('+2.5')
    expect(formatAdjustment(Number.NaN)).toBe('0')
  })
})

describe('formatConfidence', () => {
  it('renders a 0..1 score as a whole percent', () => {
    expect(formatConfidence(0.95)).toBe('95%')
    expect(formatConfidence(1)).toBe('100%')
    expect(formatConfidence(0)).toBe('0%')
    expect(formatConfidence(0.5)).toBe('50%')
    expect(formatConfidence(0.955)).toBe('96%') // rounds to the nearest percent
  })

  it('leaves out-of-range values as-is (tolerant of a raw 0..100 score)', () => {
    expect(formatConfidence(95)).toBe('95')
    expect(formatConfidence(1.5)).toBe('1.5')
  })
})

describe('splitUttReferences', () => {
  it('splits text around utt references, keeping the original wording', () => {
    expect(splitUttReferences('Погроза виїздом (utt 33) і тиск (utt 7).')).toEqual([
      { kind: 'text', text: 'Погроза виїздом (' },
      { kind: 'utt', utt: 33, label: 'utt 33' },
      { kind: 'text', text: ') і тиск (' },
      { kind: 'utt', utt: 7, label: 'utt 7' },
      { kind: 'text', text: ').' },
    ])
  })

  it('returns plain text unchanged and handles reference-only strings', () => {
    expect(splitUttReferences('Без посилань.')).toEqual([{ kind: 'text', text: 'Без посилань.' }])
    expect(splitUttReferences('utt 1')).toEqual([{ kind: 'utt', utt: 1, label: 'utt 1' }])
    expect(splitUttReferences('')).toEqual([])
  })

  it('does not match utt inside other words', () => {
    expect(splitUttReferences('butt 5 buttons')).toEqual([{ kind: 'text', text: 'butt 5 buttons' }])
  })
})
