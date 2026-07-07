/**
 * Pure helpers for the phase-2 audio layer (conclusion_spec §A + CEO
 * decisions in phase2_decisions.md): per-turn marker derivation, polarity
 * normalisation, FE-side smoothing of the client emotion path (moving
 * average over 3 windows — the brain ships the RAW path), and divergence
 * («тон vs слова») lookups.
 *
 * TOLERANT READER: the whole layer is optional and comes from a 12B model
 * retelling audio as text — every helper accepts partial/hostile shapes and
 * returns empty results instead of throwing. Events and trends are OPEN sets.
 */
import type {
  AudioSpeakerState,
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

/** Utterance-level marker threshold: arousal ≥ 2 → 🔊 (spec §A). */
export const RAISED_VOICE_AROUSAL = 2

/** FE smoothing window (centered moving average), CEO decision. */
export const SMOOTH_WINDOW = 3

export type AudioMarkerKind =
  | 'raisedVoice'
  | 'pressure'
  | 'crying'
  | 'interruption'
  | 'longPause'
  | 'other'

export const AUDIO_MARKER_ICONS: Record<Exclude<AudioMarkerKind, 'other'>, string> = {
  raisedVoice: '🔊',
  pressure: '⚡',
  crying: '😢',
  interruption: '✂️',
  longPause: '⏸',
}

export interface AudioMarker {
  kind: AudioMarkerKind
  /** null for `other` — unknown events render as plain text chips. */
  icon: string | null
  /** Original event wording (kept for tooltips); '' for derived markers. */
  label: string
}

// Substring anchors over the ukrainian event/emotion wording (open set —
// the 12B phrases freely, so we match stems rather than exact strings).
const RAISED_VOICE_ANCHORS = ['крик', 'підвищ', 'голос']
const PRESSURE_ANCHORS = ['тиск', 'тисн', 'роздрат', 'агрес', 'звинувач', 'напад']
const CRYING_ANCHORS = ['плач', 'схлип', 'ридан']
const INTERRUPTION_ANCHORS = ['перебив']
const PAUSE_ANCHORS = ['пауза', 'мовчан']

export function classifyAudioEvent(event: string): AudioMarkerKind {
  const needle = event.toLowerCase()
  if (INTERRUPTION_ANCHORS.some((a) => needle.includes(a))) return 'interruption'
  if (CRYING_ANCHORS.some((a) => needle.includes(a))) return 'crying'
  if (RAISED_VOICE_ANCHORS.some((a) => needle.includes(a))) return 'raisedVoice'
  if (PRESSURE_ANCHORS.some((a) => needle.includes(a))) return 'pressure'
  if (PAUSE_ANCHORS.some((a) => needle.includes(a))) return 'longPause'
  return 'other'
}

/**
 * Markers for one turn: 🔊 from arousal ≥ 2, ⚡ from a pressure-flavoured
 * emotion, plus one marker per event (known kinds get icons, unknown events
 * stay as text). Deduplicated by kind (by label for `other`).
 */
export function deriveAudioMarkers(state: AudioSpeakerState | null | undefined): AudioMarker[] {
  if (!state || typeof state !== 'object') return []
  const markers: AudioMarker[] = []
  const seen = new Set<string>()
  const push = (kind: AudioMarkerKind, label = '') => {
    const key = kind === 'other' ? `other:${label}` : kind
    if (seen.has(key)) return
    seen.add(key)
    markers.push({ kind, icon: kind === 'other' ? null : AUDIO_MARKER_ICONS[kind], label })
  }

  if (typeof state.arousal === 'number' && state.arousal >= RAISED_VOICE_AROUSAL) {
    push('raisedVoice')
  }
  if (typeof state.emotion === 'string') {
    const emotion = state.emotion.toLowerCase()
    if (PRESSURE_ANCHORS.some((a) => emotion.includes(a))) push('pressure')
  }
  if (Array.isArray(state.events)) {
    for (const event of state.events) {
      if (typeof event !== 'string' || !event) continue
      push(classifyAudioEvent(event), event)
    }
  }
  return markers
}

/** Marker opacity = 12B confidence, floored so markers never vanish. */
export function markerOpacity(confidence: unknown): number {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return 1
  return Math.min(1, Math.max(0.35, confidence))
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

// ---- Divergences («тон vs слова») ----

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
