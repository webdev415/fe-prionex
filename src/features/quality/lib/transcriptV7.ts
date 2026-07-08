/**
 * Pure helpers for the v7 transcript format (FORMAT_SPEC, approved by CEO).
 *
 * v7 replaces the Ф1 scene-grouped utterances with self-describing "turns":
 * `{t0, t1, dur, role, text, bc[], pause_before?, tag?, hes?}` plus call-level
 * `metrics.stats`. Detection is structural — `dur` on the first utterance or
 * `metrics.stats` — so Ф1 transcripts keep the legacy renderer untouched.
 *
 * TOLERANT READER: every helper here accepts hostile shapes (tuples instead
 * of objects, missing numbers, unknown tag kinds) and degrades instead of
 * throwing — there are live Ф1 transcripts and the brain evolves additively.
 */
import type {
  CallTranscript,
  TranscriptQaTag,
  TranscriptStats,
  TranscriptUtterance,
} from '../types'

/** ASR word timestamps jitter; ignore sub-300ms "overlaps" (visual reference). */
export const OVERLAP_TOLERANCE_S = 0.3

/** Key-moment quote budget, characters (FORMAT_SPEC rule 9). */
export const KEY_MOMENT_QUOTE_MAX = 80

/** v7 marker: turns carry `dur`, or call-level stats exist (`metrics.stats`). */
export function isV7Transcript(transcript: CallTranscript | null | undefined): boolean {
  if (!transcript) return false
  const first = transcript.utterances?.[0]
  if (first && typeof first.dur === 'number') return true
  return getV7Stats(transcript) != null
}

export function getV7Stats(transcript: CallTranscript | null | undefined): TranscriptStats | null {
  const stats = transcript?.metrics?.stats
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return null
  return stats
}

/** Normalised inline reaction of the other side. */
export interface BackchannelItem {
  t: number
  role: string
  text: string
}

/**
 * Accept both `bc` encodings — `{t, role, text}` objects (current brain) and
 * `[t, role, text]` tuples (FORMAT_SPEC examples) — drop malformed entries,
 * return sorted by time.
 */
export function normalizeBackchannels(bc: unknown): BackchannelItem[] {
  if (!Array.isArray(bc)) return []
  const items: BackchannelItem[] = []
  for (const entry of bc) {
    let t: unknown
    let role: unknown
    let text: unknown
    if (Array.isArray(entry)) {
      ;[t, role, text] = entry
    } else if (entry && typeof entry === 'object') {
      ;({ t, role, text } = entry as { t?: unknown; role?: unknown; text?: unknown })
    }
    if (typeof t === 'number' && Number.isFinite(t) && typeof text === 'string' && text) {
      items.push({ t, role: typeof role === 'string' ? role : 'other', text })
    }
  }
  return items.sort((a, b) => a.t - b.t)
}

/** Normalised in-turn hesitation pause of the speaker. */
export interface HesitationItem {
  t: number
  /** Pause length, seconds. */
  gap: number
}

/**
 * Accept both `hes` encodings — `{t, gap}` objects (current brain) and
 * `[t, gap]` tuples — drop malformed entries (non-finite times, gaps ≤ 0),
 * return sorted by time.
 */
export function normalizeHesitations(hes: unknown): HesitationItem[] {
  if (!Array.isArray(hes)) return []
  const items: HesitationItem[] = []
  for (const entry of hes) {
    let t: unknown
    let gap: unknown
    if (Array.isArray(entry)) {
      ;[t, gap] = entry
    } else if (entry && typeof entry === 'object') {
      ;({ t, gap } = entry as { t?: unknown; gap?: unknown })
    }
    if (
      typeof t === 'number' &&
      Number.isFinite(t) &&
      typeof gap === 'number' &&
      Number.isFinite(gap) &&
      gap > 0
    ) {
      items.push({ t, gap })
    }
  }
  return items.sort((a, b) => a.t - b.t)
}

export type QaTagKind = 'good' | 'warn' | 'crit' | 'info'

export interface QaTag {
  /** Unknown kinds collapse to 'info' (grey) — the set is open. */
  kind: QaTagKind
  label: string
}

export function normalizeQaTag(tag: TranscriptQaTag | undefined | null): QaTag | null {
  if (!Array.isArray(tag) || tag.length === 0) return null
  const rawKind = typeof tag[0] === 'string' ? tag[0] : ''
  const label = typeof tag[1] === 'string' && tag[1] ? tag[1] : rawKind
  if (!label) return null
  const kind: QaTagKind =
    rawKind === 'good' || rawKind === 'warn' || rawKind === 'crit' || rawKind === 'info'
      ? rawKind
      : 'info'
  return { kind, label }
}

export type BubbleSegment =
  | { kind: 'text'; text: string }
  /** `ordinal` — 0-based index of the reaction within its turn (stable testids). */
  | { kind: 'bc'; bc: BackchannelItem; ordinal: number }
  /** In-turn hesitation pause, rendered as a grey italic remark in the text. */
  | { kind: 'hes'; t: number; gap: number; ordinal: number }

/**
 * Weave the other side's reactions AND the speaker's own hesitation pauses
 * into the turn text at a WORD index proportional to their time inside the
 * turn (FORMAT_SPEC rule 6) — the main phrase is never split mid-word, both
 * streams sort into one timeline, reactions read as inline chips and
 * hesitations as inline remarks.
 */
export function buildBubbleSegments(turn: {
  t0?: number
  t1?: number
  text?: string
  bc?: unknown
  hes?: unknown
}): BubbleSegment[] {
  const text = typeof turn.text === 'string' ? turn.text : ''
  const reactions = normalizeBackchannels(turn.bc)
  const hesitations = normalizeHesitations(turn.hes)
  if (reactions.length === 0 && hesitations.length === 0) {
    return text ? [{ kind: 'text', text }] : []
  }

  const t0 = typeof turn.t0 === 'number' && Number.isFinite(turn.t0) ? turn.t0 : 0
  const t1 = typeof turn.t1 === 'number' && Number.isFinite(turn.t1) ? turn.t1 : t0
  const span = Math.max(t1 - t0, 0.1)
  const words = text ? text.split(' ') : []

  // One inline timeline: both lists are pre-sorted, the merge sort is stable,
  // so same-time entries keep reactions before hesitations.
  const inline: Array<{ t: number; segment: Exclude<BubbleSegment, { kind: 'text' }> }> = [
    ...reactions.map((bc, ordinal) => ({ t: bc.t, segment: { kind: 'bc' as const, bc, ordinal } })),
    ...hesitations.map((hes, ordinal) => ({
      t: hes.t,
      segment: { kind: 'hes' as const, t: hes.t, gap: hes.gap, ordinal },
    })),
  ].sort((a, b) => a.t - b.t)

  const segments: BubbleSegment[] = []
  let cursor = 0
  for (const entry of inline) {
    const proportional = Math.round(((entry.t - t0) / span) * words.length)
    const at = Math.max(cursor, Math.min(words.length, Math.max(0, proportional)))
    if (at > cursor) {
      segments.push({ kind: 'text', text: words.slice(cursor, at).join(' ') })
      cursor = at
    }
    segments.push(entry.segment)
  }
  if (cursor < words.length) {
    segments.push({ kind: 'text', text: words.slice(cursor).join(' ') })
  }
  return segments
}

/** One renderable feed row: turn + everything derived from its neighbours. */
export interface V7Row {
  index: number
  turn: TranscriptUtterance
  t0: number
  t1: number
  /** Turn starts before the furthest end of the previous rows → «одночасно». */
  overlap: boolean
  /** Silence (both channels) before this turn, seconds — or null. */
  pauseBefore: number | null
  tag: QaTag | null
  segments: BubbleSegment[]
}

export function buildV7Rows(utterances: TranscriptUtterance[] | null | undefined): V7Row[] {
  const list = Array.isArray(utterances) ? utterances : []
  let prevEnd: number | null = null
  return list.map((turn, index) => {
    const t0 = typeof turn.t0 === 'number' && Number.isFinite(turn.t0) ? turn.t0 : 0
    const t1 = typeof turn.t1 === 'number' && Number.isFinite(turn.t1) ? turn.t1 : t0
    const overlap = prevEnd != null && t0 < prevEnd - OVERLAP_TOLERANCE_S
    prevEnd = prevEnd == null ? t1 : Math.max(prevEnd, t1)
    const pauseBefore =
      typeof turn.pause_before === 'number' &&
      Number.isFinite(turn.pause_before) &&
      turn.pause_before > 0
        ? turn.pause_before
        : null
    return {
      index,
      turn,
      t0,
      t1,
      overlap,
      pauseBefore,
      tag: normalizeQaTag(turn.tag),
      segments: buildBubbleSegments(turn),
    }
  })
}

export interface KeyMoment {
  index: number
  t0: number
  tag: QaTag
  quote: string
}

/** Tagged turns → supervisor digest (timecode + kind badge + short quote). */
export function extractKeyMoments(rows: V7Row[]): KeyMoment[] {
  const moments: KeyMoment[] = []
  for (const row of rows) {
    if (!row.tag) continue
    const text = typeof row.turn.text === 'string' ? row.turn.text : ''
    const quote =
      text.length > KEY_MOMENT_QUOTE_MAX
        ? `${text.slice(0, KEY_MOMENT_QUOTE_MAX - 1).trimEnd()}…`
        : text
    moments.push({ index: row.index, t0: row.t0, tag: row.tag, quote })
  }
  return moments
}

/** Seconds → `m:ss` (in-call clock, from 0:00). */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  const mm = Math.floor(total / 60)
  const ss = String(total % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

/** Seconds → one-decimal string for chips («42.5», «1.6»). */
export function formatSeconds1(seconds: number): string {
  return (Number.isFinite(seconds) ? seconds : 0).toFixed(1)
}
