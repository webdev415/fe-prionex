/**
 * Pure helpers for the phase-2 audio layer (conclusion_spec §A + CEO
 * decisions in phase2_decisions.md, business-style pass 2026-07): per-turn
 * significant-state derivation (only «підвищений голос» / «плач» surface in
 * the UI — the rest of the 12B event stream stays in the payload), polarity
 * normalisation, FE-side smoothing of the client emotion path (moving
 * average over 3 windows — the brain ships the RAW path), divergence
 * («тон ≠ слова») lookups, and ambient-sound annotation of silence chips
 * from the 10s audio windows.
 *
 * TOLERANT READER: the whole layer is optional and comes from a 12B model
 * retelling audio as text — every helper accepts partial/hostile shapes and
 * returns empty results instead of throwing. Events and trends are OPEN sets.
 */
import type {
  AudioSpeakerState,
  AudioWindow,
  CallTranscript,
  DivergenceCandidate,
  EmotionDynamics,
  EmotionPathPoint,
  TranscriptUtterance,
} from '../types'

export type AudioPolarity = 'neg' | 'neutral' | 'pos'

export function normalizePolarity(polarity: unknown): AudioPolarity {
  return polarity === 'neg' || polarity === 'pos' ? polarity : 'neutral'
}

/**
 * Emotion dynamics selector. PRIMARY home is `transcript.metrics.emotion_dynamics`
 * (metrics travels brain→CRM verbatim — the layer needs no api-prionex
 * changes); the top-level `transcript.emotion_dynamics` stays as a tolerant
 * FALLBACK. A malformed primary falls through to the fallback.
 */
export function getEmotionDynamics(
  transcript: CallTranscript | null | undefined
): EmotionDynamics | null {
  const candidates = [transcript?.metrics?.emotion_dynamics, transcript?.emotion_dynamics]
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate
    }
  }
  return null
}

/** Raw windows with arousal ≥ this stay visually marked as peaks (no
 * smoothing them away — CEO decision: «пики НЕ сглаживать в ноль»). */
export const PEAK_AROUSAL = 3

/** Utterance-level threshold: arousal ≥ 2 → «підвищений голос» (spec §A). */
export const RAISED_VOICE_AROUSAL = 2

/** FE smoothing window (centered moving average), CEO decision. */
export const SMOOTH_WINDOW = 3

/**
 * The only per-turn states significant enough for the meta line (CEO
 * business-style decision): raised voice and crying. Everything else the
 * 12B hears per turn (drawn-out sounds, hesitant speech, interruptions,
 * unknown events) stays in the payload without UI.
 */
export type SignificantTurnState = 'raisedVoice' | 'crying'

// Substring anchors over the ukrainian event/emotion wording (open set —
// the 12B phrases freely, so we match stems rather than exact strings).
const CRYING_ANCHORS = ['плач', 'схлип', 'ридан']

/**
 * Significant states for one turn: «підвищений голос» from arousal ≥ 2,
 * «плач» from a crying-flavoured event or emotion. Rendered as thin text
 * badges next to the timecode — never as icons, never as an event chip row.
 */
export function deriveSignificantStates(
  state: AudioSpeakerState | null | undefined
): SignificantTurnState[] {
  if (!state || typeof state !== 'object') return []
  const states: SignificantTurnState[] = []
  if (typeof state.arousal === 'number' && state.arousal >= RAISED_VOICE_AROUSAL) {
    states.push('raisedVoice')
  }
  const wordings = [
    typeof state.emotion === 'string' ? state.emotion : '',
    ...(Array.isArray(state.events) ? state.events : []),
  ]
  const crying = wordings.some((wording) => {
    if (typeof wording !== 'string' || !wording) return false
    const needle = wording.toLowerCase()
    return CRYING_ANCHORS.some((anchor) => needle.includes(anchor))
  })
  if (crying) states.push('crying')
  return states
}

/** M/L reliability → dimmed + «за аудіо, орієнтовно» note (H/unknown → firm). */
export function isApproximateReliability(reliability: unknown): boolean {
  return reliability === 'M' || reliability === 'L'
}

// ---- Client dynamics strip ----

export interface DynamicsSegment {
  index: number
  /** Window start/end, seconds (end = next point start, or call end). */
  t: number
  tEnd: number
  polarity: AudioPolarity
  rawArousal: number
  /** Centered moving average over SMOOTH_WINDOW raw windows. */
  smoothArousal: number
  /** Raw arousal ≥ PEAK_AROUSAL — gets a visible peak dot. */
  isPeak: boolean
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/**
 * RAW path points → renderable strip segments: sorted by time, arousal
 * smoothed on the FE (raw values preserved for tooltips and peak dots).
 */
export function buildDynamicsSegments(
  path: EmotionPathPoint[] | null | undefined,
  durationS?: number | null
): DynamicsSegment[] {
  const points = (Array.isArray(path) ? path : [])
    .filter((p): p is EmotionPathPoint => !!p && typeof p === 'object')
    .map((p) => ({
      t: finiteOr(p.t, 0),
      polarity: normalizePolarity(p.polarity),
      rawArousal: Math.max(0, finiteOr(p.arousal, 0)),
    }))
    .sort((a, b) => a.t - b.t)
  if (points.length === 0) return []

  const half = Math.floor(SMOOTH_WINDOW / 2)
  const callEnd =
    typeof durationS === 'number' && Number.isFinite(durationS)
      ? Math.max(durationS, points[points.length - 1].t)
      : points[points.length - 1].t + 10 // window step fallback (~10s)

  return points.map((point, index) => {
    const from = Math.max(0, index - half)
    const to = Math.min(points.length - 1, index + half)
    let sum = 0
    for (let i = from; i <= to; i += 1) sum += points[i].rawArousal
    const smooth = sum / (to - from + 1)
    return {
      index,
      t: point.t,
      tEnd: index < points.length - 1 ? points[index + 1].t : Math.max(callEnd, point.t),
      polarity: point.polarity,
      rawArousal: point.rawArousal,
      smoothArousal: smooth,
      isPeak: point.rawArousal >= PEAK_AROUSAL,
    }
  })
}

/** Arousal scale ceiling for bar heights (≥3 so peaks don't clip the axis). */
export function dynamicsScaleMax(segments: DynamicsSegment[]): number {
  let max = PEAK_AROUSAL
  for (const s of segments) max = Math.max(max, s.rawArousal, s.smoothArousal)
  return max
}

// ---- Trend / scores ----

export type TrendKind = 'improved' | 'degraded' | 'stable' | 'other'

export function normalizeTrend(trend: unknown): { kind: TrendKind; raw: string } | null {
  if (typeof trend !== 'string' || !trend) return null
  const kind: TrendKind =
    trend === 'improved' || trend === 'degraded' || trend === 'stable' ? trend : 'other'
  return { kind, raw: trend }
}

/** 0–5 style score for chips: integers bare («4»), fractions 1 decimal («1.9»). */
export function formatScore(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/**
 * Directional arousal trend for the client score chip («тренд ↓» = arousal
 * went down). `scores.trend` speaks the up/down/stable dialect — evaluative
 * values (improved/degraded) and anything unknown fall back to the raw text
 * rather than getting a possibly wrong arrow.
 */
export function directionalTrendGlyph(trend: unknown): string | null {
  if (typeof trend !== 'string' || !trend) return null
  if (trend === 'down') return '↓'
  if (trend === 'up') return '↑'
  if (trend === 'stable') return '→'
  return trend
}

// ---- Ambient-sound annotation of silence chips ----

/**
 * 10s audio windows selector — same dual-home pattern as the dynamics:
 * `metrics.audio_windows` is primary, top-level is the tolerant fallback.
 * Non-object entries are dropped.
 */
export function getAudioWindows(transcript: CallTranscript | null | undefined): AudioWindow[] {
  const candidates = [transcript?.metrics?.audio_windows, transcript?.audio_windows]
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue
    const windows = candidate.filter(
      (w): w is AudioWindow => !!w && typeof w === 'object' && !Array.isArray(w)
    )
    if (windows.length > 0) return windows
  }
  return []
}

// Environment whitelist (CEO decision): only ambient sounds annotate a
// silence chip — музика / (фоновий) шум / дитина на фоні / сирена / кашель.
// Speech-manner events (розтягнуті звуки, невпевнена мова, перебивання,
// крик, плач) must never leak in; the anchors are chosen not to match them.
const PAUSE_ENV_ANCHORS = ['музик', 'шум', 'дитин', 'сирен', 'кашель', 'кашл']

export function isEnvironmentEvent(event: string): boolean {
  const needle = event.toLowerCase()
  return PAUSE_ENV_ANCHORS.some((anchor) => needle.includes(anchor))
}

/**
 * Ambient events from windows overlapping the [from, to] silence interval —
 * whitelist-filtered, deduped case-insensitively, original 12B wording kept
 * for display (`тиша 16.7 с · музика`).
 */
export function pauseEnvironmentLabels(windows: AudioWindow[], from: number, to: number): string[] {
  if (!Number.isFinite(from) || !Number.isFinite(to) || !(to > from)) return []
  const labels: string[] = []
  const seen = new Set<string>()
  for (const window of windows) {
    const t0 = window.t0
    const t1 = window.t1
    if (typeof t0 !== 'number' || !Number.isFinite(t0)) continue
    if (typeof t1 !== 'number' || !Number.isFinite(t1)) continue
    if (t1 <= from || t0 >= to) continue // no overlap with the silence gap
    if (!Array.isArray(window.events)) continue
    for (const event of window.events) {
      if (typeof event !== 'string' || !event || !isEnvironmentEvent(event)) continue
      const key = event.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      labels.push(event)
    }
  }
  return labels
}

// ---- Divergences («тон ≠ слова») ----

export interface NormalizedDivergence {
  utt: number
  textReads: string
  audioReads: string
  reliability?: string
}

export function normalizeDivergences(
  dynamics: EmotionDynamics | null | undefined
): NormalizedDivergence[] {
  const list = dynamics?.divergence_candidates
  if (!Array.isArray(list)) return []
  const result: NormalizedDivergence[] = []
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue
    const { utt, text_reads, audio_reads, reliability } = entry as DivergenceCandidate
    if (typeof utt !== 'number' || !Number.isInteger(utt) || utt < 0) continue
    const textReads = typeof text_reads === 'string' ? text_reads : ''
    const audioReads = typeof audio_reads === 'string' ? audio_reads : ''
    if (!textReads && !audioReads) continue
    result.push({
      utt,
      textReads,
      audioReads,
      reliability: typeof reliability === 'string' ? reliability : undefined,
    })
  }
  return result
}

export function divergencesByUtt(
  dynamics: EmotionDynamics | null | undefined
): Map<number, NormalizedDivergence> {
  const map = new Map<number, NormalizedDivergence>()
  for (const d of normalizeDivergences(dynamics)) {
    if (!map.has(d.utt)) map.set(d.utt, d)
  }
  return map
}

/** Utterance-level audio state, or null when the layer/state is absent. */
export function speakerStateOf(
  turn: TranscriptUtterance | null | undefined
): AudioSpeakerState | null {
  const state = turn?.audio?.speaker_state
  if (!state || typeof state !== 'object') return null
  return state
}
