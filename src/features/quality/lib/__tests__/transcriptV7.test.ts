/**
 * transcriptV7 helper tests — format detection, tolerant normalisation of
 * `bc`/`tag`/`hes`, proportional word-index weaving (reactions + hesitations
 * share one timeline), overlap/pause derivation. Pure functions, no i18n/DOM
 * — values are asserted directly.
 */
import { describe, expect, it } from 'vitest'
import type { CallTranscript, TranscriptUtterance } from '../../types'
import {
  buildBubbleSegments,
  buildV7Rows,
  countSuppressedHesitations,
  extractKeyMoments,
  formatClock,
  formatSeconds1,
  getV7Stats,
  isNumericToken,
  isV7Transcript,
  normalizeBackchannels,
  normalizeHesitations,
  normalizeQaTag,
} from '../transcriptV7'

const LEGACY: CallTranscript = {
  utterances: [{ i: 0, t0: 0.4, t1: 3.1, role: 'operator', text: 'Доброго дня.' }],
  scenes: [{ key: 'greeting', from_utt: 0, to_utt: 0 }],
}

describe('isV7Transcript', () => {
  it('detects v7 by `dur` on the first utterance', () => {
    expect(
      isV7Transcript({ utterances: [{ t0: 1, t1: 2, dur: 1, role: 'client', text: 'Слухаю.' }] })
    ).toBe(true)
  })

  it('detects v7 by `metrics.stats` even without `dur`', () => {
    expect(
      isV7Transcript({
        utterances: [{ t0: 1, t1: 2, role: 'client', text: 'Слухаю.' }],
        metrics: { stats: { op_share: 55 } },
      })
    ).toBe(true)
  })

  it('keeps the legacy Ф1 format on the legacy renderer', () => {
    expect(isV7Transcript(LEGACY)).toBe(false)
  })

  it('is false for missing/empty transcripts and non-stats metrics', () => {
    expect(isV7Transcript(null)).toBe(false)
    expect(isV7Transcript(undefined)).toBe(false)
    expect(isV7Transcript({ utterances: [] })).toBe(false)
    expect(isV7Transcript({ utterances: [], metrics: { other: 1 } })).toBe(false)
  })
})

describe('getV7Stats', () => {
  it('returns stats only when it is a plain object', () => {
    expect(getV7Stats({ utterances: [], metrics: { stats: { op_share: 55 } } })).toEqual({
      op_share: 55,
    })
    expect(getV7Stats({ utterances: [], metrics: null })).toBeNull()
    expect(
      getV7Stats({
        utterances: [],
        metrics: { stats: [1, 2] as unknown as Record<string, unknown> },
      })
    ).toBeNull()
  })
})

describe('normalizeBackchannels', () => {
  it('accepts {t, role, text} objects and sorts by time', () => {
    expect(
      normalizeBackchannels([
        { t: 12.59, role: 'client', text: 'Ага,' },
        { t: 10.18, role: 'client', text: 'Ага.' },
      ])
    ).toEqual([
      { t: 10.18, role: 'client', text: 'Ага.' },
      { t: 12.59, role: 'client', text: 'Ага,' },
    ])
  })

  it('accepts legacy [t, role, text] tuples', () => {
    expect(normalizeBackchannels([[281.67, 'client', 'Я розумію']])).toEqual([
      { t: 281.67, role: 'client', text: 'Я розумію' },
    ])
  })

  it('drops malformed entries and defaults missing roles', () => {
    expect(
      normalizeBackchannels([
        null,
        42,
        {},
        { t: 'x', text: 'y' },
        { t: 1 },
        ['a', 'b', 'c'],
        { t: 2, text: 'ок' },
      ])
    ).toEqual([{ t: 2, role: 'other', text: 'ок' }])
    expect(normalizeBackchannels(undefined)).toEqual([])
    expect(normalizeBackchannels('nope')).toEqual([])
  })
})

describe('normalizeQaTag', () => {
  it('keeps the known kinds', () => {
    expect(normalizeQaTag(['crit', 'тиск / звинувачення'])).toEqual({
      kind: 'crit',
      label: 'тиск / звинувачення',
    })
    expect(normalizeQaTag(['good', 'знижка'])?.kind).toBe('good')
    expect(normalizeQaTag(['warn', 'загроза'])?.kind).toBe('warn')
    expect(normalizeQaTag(['info', 'третя особа'])?.kind).toBe('info')
  })

  it('collapses unknown kinds to info (open set)', () => {
    expect(normalizeQaTag(['mystery', 'щось нове'])).toEqual({ kind: 'info', label: 'щось нове' })
    expect(normalizeQaTag([null, 'без kind'])).toEqual({ kind: 'info', label: 'без kind' })
  })

  it('falls back to the kind as label for 1-element tags, null for garbage', () => {
    expect(normalizeQaTag(['crit'])).toEqual({ kind: 'crit', label: 'crit' })
    expect(normalizeQaTag([])).toBeNull()
    expect(normalizeQaTag(undefined)).toBeNull()
    expect(normalizeQaTag(null)).toBeNull()
  })
})

describe('normalizeHesitations', () => {
  it('accepts {t, gap} objects and sorts by time', () => {
    expect(
      normalizeHesitations([
        { t: 12.5, gap: 1.2 },
        { t: 3.1, gap: 0.8 },
      ])
    ).toEqual([
      { t: 3.1, gap: 0.8 },
      { t: 12.5, gap: 1.2 },
    ])
  })

  it('accepts [t, gap] tuples', () => {
    expect(normalizeHesitations([[7.4, 2.1]])).toEqual([{ t: 7.4, gap: 2.1 }])
  })

  it('drops malformed entries: non-finite times, gaps ≤ 0, garbage', () => {
    expect(
      normalizeHesitations([
        null,
        42,
        {},
        { t: 'x', gap: 1 },
        { t: 1 },
        { t: 1, gap: 0 },
        { t: 1, gap: -2 },
        { t: Number.NaN, gap: 1 },
        { t: 2, gap: 1.5 },
      ])
    ).toEqual([{ t: 2, gap: 1.5 }])
    expect(normalizeHesitations(undefined)).toEqual([])
    expect(normalizeHesitations('nope')).toEqual([])
  })
})

describe('buildBubbleSegments', () => {
  const words10 = 'w1 w2 w3 w4 w5 w6 w7 w8 w9 w10'

  it('returns the plain text as one segment without reactions', () => {
    expect(buildBubbleSegments({ t0: 0, t1: 10, text: 'Слухаю.', bc: [] })).toEqual([
      { kind: 'text', text: 'Слухаю.' },
    ])
    expect(buildBubbleSegments({ t0: 0, t1: 10, text: '', bc: [] })).toEqual([])
  })

  it('inserts a reaction at the word index proportional to its time', () => {
    const segments = buildBubbleSegments({
      t0: 0,
      t1: 10,
      text: words10,
      bc: [{ t: 5, role: 'client', text: 'Ага.' }],
    })
    expect(segments).toEqual([
      { kind: 'text', text: 'w1 w2 w3 w4 w5' },
      { kind: 'bc', bc: { t: 5, role: 'client', text: 'Ага.' }, ordinal: 0 },
      { kind: 'text', text: 'w6 w7 w8 w9 w10' },
    ])
  })

  it('clamps reactions outside the turn to its edges', () => {
    const before = buildBubbleSegments({
      t0: 10,
      t1: 20,
      text: 'a b',
      bc: [{ t: 3, role: 'client', text: 'ранній' }],
    })
    expect(before[0]).toEqual({
      kind: 'bc',
      bc: { t: 3, role: 'client', text: 'ранній' },
      ordinal: 0,
    })

    const after = buildBubbleSegments({
      t0: 10,
      t1: 20,
      text: 'a b',
      bc: [{ t: 99, role: 'client', text: 'пізній' }],
    })
    expect(after[after.length - 1]).toEqual({
      kind: 'bc',
      bc: { t: 99, role: 'client', text: 'пізній' },
      ordinal: 0,
    })
  })

  it('survives a zero/negative span and empty text with reactions', () => {
    expect(
      buildBubbleSegments({ t0: 5, t1: 5, text: 'a b', bc: [{ t: 5, role: 'client', text: 'ок' }] })
    ).not.toHaveLength(0)
    expect(
      buildBubbleSegments({ t0: 0, t1: 10, text: '', bc: [{ t: 5, role: 'client', text: 'ок' }] })
    ).toEqual([{ kind: 'bc', bc: { t: 5, role: 'client', text: 'ок' }, ordinal: 0 }])
  })

  it('keeps two same-position reactions adjacent, in time order', () => {
    const segments = buildBubbleSegments({
      t0: 0,
      t1: 10,
      text: words10,
      bc: [
        { t: 5.01, role: 'operator', text: 'другий' },
        { t: 5.0, role: 'client', text: 'перший' },
      ],
    })
    const chips = segments.filter((s) => s.kind === 'bc')
    expect(chips.map((s) => (s.kind === 'bc' ? s.bc.text : ''))).toEqual(['перший', 'другий'])
  })

  it('inserts a hesitation at the word index proportional to its time', () => {
    const segments = buildBubbleSegments({
      t0: 0,
      t1: 10,
      text: words10,
      hes: [{ t: 2, gap: 1.2 }],
    })
    expect(segments).toEqual([
      { kind: 'text', text: 'w1 w2' },
      { kind: 'hes', t: 2, gap: 1.2, ordinal: 0 },
      { kind: 'text', text: 'w3 w4 w5 w6 w7 w8 w9 w10' },
    ])
  })

  it('sorts reactions and hesitations into one timeline', () => {
    const segments = buildBubbleSegments({
      t0: 0,
      t1: 10,
      text: words10,
      bc: [{ t: 5, role: 'client', text: 'Ага.' }],
      hes: [
        { t: 8, gap: 0.9 },
        { t: 2, gap: 1.2 },
      ],
    })
    expect(segments).toEqual([
      { kind: 'text', text: 'w1 w2' },
      { kind: 'hes', t: 2, gap: 1.2, ordinal: 0 },
      { kind: 'text', text: 'w3 w4 w5' },
      { kind: 'bc', bc: { t: 5, role: 'client', text: 'Ага.' }, ordinal: 0 },
      { kind: 'text', text: 'w6 w7 w8' },
      { kind: 'hes', t: 8, gap: 0.9, ordinal: 1 },
      { kind: 'text', text: 'w9 w10' },
    ])
  })

  it('renders a hesitation-only turn without reactions', () => {
    const segments = buildBubbleSegments({ t0: 0, t1: 10, text: 'a b', hes: [[5, 2.5]] })
    expect(segments).toEqual([
      { kind: 'text', text: 'a' },
      { kind: 'hes', t: 5, gap: 2.5, ordinal: 0 },
      { kind: 'text', text: 'b' },
    ])
  })

  // ---- Dictation guard: keep spoken number sequences intact ----

  it('suppresses a hesitation dictated between two numeric tokens', () => {
    // «45 71 (пауза) 39» — the pause between digits is dictation pace: dropped,
    // the number stays one unbroken text run.
    const segments = buildBubbleSegments({
      t0: 0,
      t1: 10,
      text: 'Записуйте 45 71 39 сума 250',
      hes: [{ t: 5, gap: 1.4 }],
    })
    expect(segments).toEqual([{ kind: 'text', text: 'Записуйте 45 71 39 сума 250' }])
    expect(segments.some((segment) => segment.kind === 'hes')).toBe(false)
  })

  it('slides a reaction inside a numeric run to the end of the run', () => {
    // The chip must not split «45 71 39» — it reads after the whole number.
    const segments = buildBubbleSegments({
      t0: 0,
      t1: 10,
      text: 'Записуйте 45 71 39 сума 250',
      bc: [{ t: 5, role: 'client', text: 'ага' }],
    })
    expect(segments).toEqual([
      { kind: 'text', text: 'Записуйте 45 71 39' },
      { kind: 'bc', bc: { t: 5, role: 'client', text: 'ага' }, ordinal: 0 },
      { kind: 'text', text: 'сума 250' },
    ])
  })

  it('keeps a hesitation at a run boundary (only one side numeric)', () => {
    // rawAt lands between «39» (numeric) and «сума» (word) → shown, not dropped.
    const segments = buildBubbleSegments({
      t0: 0,
      t1: 10,
      text: 'Записуйте 45 71 39 сума 250',
      hes: [{ t: 6.7, gap: 0.8 }],
    })
    expect(segments).toEqual([
      { kind: 'text', text: 'Записуйте 45 71 39' },
      { kind: 'hes', t: 6.7, gap: 0.8, ordinal: 0 },
      { kind: 'text', text: 'сума 250' },
    ])
  })

  it('places a reaction after an all-numeric turn (whole text is a number)', () => {
    const segments = buildBubbleSegments({
      t0: 0,
      t1: 10,
      text: '45 71 39',
      bc: [{ t: 5, role: 'client', text: 'ок' }],
    })
    expect(segments).toEqual([
      { kind: 'text', text: '45 71 39' },
      { kind: 'bc', bc: { t: 5, role: 'client', text: 'ок' }, ordinal: 0 },
    ])
  })

  it('leaves hesitations in ordinary prose untouched (regression)', () => {
    const segments = buildBubbleSegments({
      t0: 0,
      t1: 10,
      text: 'Ваш борг 500 гривень сьогодні',
      hes: [{ t: 2, gap: 1 }],
    })
    expect(segments).toEqual([
      { kind: 'text', text: 'Ваш' },
      { kind: 'hes', t: 2, gap: 1, ordinal: 0 },
      { kind: 'text', text: 'борг 500 гривень сьогодні' },
    ])
  })
})

describe('buildV7Rows', () => {
  const turn = (patch: Partial<TranscriptUtterance>): TranscriptUtterance => ({
    t0: 0,
    t1: 1,
    text: 'x',
    ...patch,
  })

  it('flags overlap when a turn starts >0.3s before the previous end', () => {
    const rows = buildV7Rows([turn({ t0: 10, t1: 20 }), turn({ t0: 19.5, t1: 25 })])
    expect(rows[0].overlap).toBe(false)
    expect(rows[1].overlap).toBe(true)
  })

  it('ignores sub-tolerance overlaps (ASR jitter)', () => {
    const rows = buildV7Rows([turn({ t0: 10, t1: 20 }), turn({ t0: 19.8, t1: 25 })])
    expect(rows[1].overlap).toBe(false)
  })

  it('tracks the furthest end, not just the previous turn (long monologue)', () => {
    const rows = buildV7Rows([
      turn({ t0: 0, t1: 100 }),
      turn({ t0: 40, t1: 45 }),
      turn({ t0: 50, t1: 55 }),
    ])
    expect(rows[1].overlap).toBe(true)
    expect(rows[2].overlap).toBe(true) // 50 < 100 - 0.3 — the monologue still runs
  })

  it('passes pause_before through only when positive', () => {
    const rows = buildV7Rows([
      turn({ pause_before: 1.6 }),
      turn({ t0: 5, t1: 6, pause_before: 0 }),
      turn({ t0: 7, t1: 8 }),
    ])
    expect(rows[0].pauseBefore).toBe(1.6)
    expect(rows[1].pauseBefore).toBeNull()
    expect(rows[2].pauseBefore).toBeNull()
  })

  it('normalises tags and survives missing timestamps', () => {
    const rows = buildV7Rows([
      turn({
        t0: undefined as unknown as number,
        t1: undefined as unknown as number,
        tag: ['crit', 'тиск'],
      }),
    ])
    expect(rows[0].t0).toBe(0)
    expect(rows[0].tag).toEqual({ kind: 'crit', label: 'тиск' })
    expect(buildV7Rows(null)).toEqual([])
  })
})

describe('extractKeyMoments', () => {
  it('collects only tagged turns and truncates quotes to ≤80 chars', () => {
    const long = 'д'.repeat(120)
    const rows = buildV7Rows([
      { t0: 1, t1: 2, text: 'без тега' },
      { t0: 10, t1: 20, text: long, tag: ['crit', 'тиск'] },
      { t0: 30, t1: 40, text: 'коротка', tag: ['good', 'знижка'] },
    ])
    const moments = extractKeyMoments(rows)
    expect(moments).toHaveLength(2)
    expect(moments[0].t0).toBe(10)
    expect(moments[0].quote.length).toBeLessThanOrEqual(80)
    expect(moments[0].quote.endsWith('…')).toBe(true)
    expect(moments[1].quote).toBe('коротка')
  })
})

describe('formatting', () => {
  it('formatClock renders an in-call m:ss clock', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(65)).toBe('1:05')
    expect(formatClock(380.4)).toBe('6:20')
    expect(formatClock(-5)).toBe('0:00')
    expect(formatClock(Number.NaN)).toBe('0:00')
  })

  it('formatSeconds1 renders one decimal', () => {
    expect(formatSeconds1(42.53)).toBe('42.5')
    expect(formatSeconds1(10)).toBe('10.0')
    expect(formatSeconds1(Number.NaN)).toBe('0.0')
  })
})

describe('isNumericToken', () => {
  it('accepts digit words, including trailing punctuation and colons', () => {
    expect(isNumericToken('45')).toBe(true)
    expect(isNumericToken('71,')).toBe(true)
    expect(isNumericToken('250.')).toBe(true)
    expect(isNumericToken('2:47')).toBe(true)
    expect(isNumericToken('(45)')).toBe(true)
  })

  it('rejects words with no digit or with letters', () => {
    expect(isNumericToken('сума')).toBe(false)
    expect(isNumericToken('2:47зараз4')).toBe(false) // mangled ASR token — not a number
    expect(isNumericToken(',')).toBe(false)
    expect(isNumericToken('')).toBe(false)
    expect(isNumericToken('w1')).toBe(false)
  })
})

describe('countSuppressedHesitations', () => {
  it('tallies dictation pauses dropped from the feed, per role', () => {
    const counts = countSuppressedHesitations([
      // operator dictates — the pause between «45» and «71» is suppressed
      { t0: 0, t1: 10, role: 'operator', text: 'Диктую 45 71 далі', hes: [{ t: 5, gap: 1.4 }] },
      // client hesitates in ordinary speech — kept, not counted as suppressed
      { t0: 0, t1: 10, role: 'client', text: 'Я подумаю трохи', hes: [{ t: 5, gap: 1 }] },
    ])
    expect(counts).toEqual({ operator: 1, client: 0, other: 0 })
  })

  it('returns zeros without hesitations or utterances', () => {
    expect(countSuppressedHesitations([])).toEqual({ operator: 0, client: 0, other: 0 })
    expect(countSuppressedHesitations(undefined)).toEqual({ operator: 0, client: 0, other: 0 })
    expect(countSuppressedHesitations([{ t0: 0, t1: 1, role: 'operator', text: '45 71' }])).toEqual(
      { operator: 0, client: 0, other: 0 }
    )
  })
})
