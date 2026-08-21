// Quality service types (KAN-410). Mirror the Pydantic schemas in
// api-prionex/services/quality/app/schemas/.

/**
 * The only two scales the API accepts. `binary_critical` from the pipeline's
 * rubric.json is NOT one of them: it is stored as `binary` plus the separate
 * `critical` flag on the criterion.
 */
export type CriterionScale = 'binary' | '0-5'

export const CRITERION_SCALES: CriterionScale[] = ['binary', '0-5']

/**
 * Tolerant reader for a stored `scale`. Neither database holds anything but
 * `binary` / `0-5` today, so this is a guard for data written by something
 * other than this UI: `binary_critical` degrades to the yes/no control it
 * really is, and anything unrecognised falls back to the 0..5 band.
 *
 * Without it an unknown value would silently miss the `=== 'binary'` branch
 * and render six buttons where the criterion wants two — a mis-render nobody
 * would notice.
 */
export function normalizeCriterionScale(scale: string | null | undefined): CriterionScale {
  if (scale === 'binary' || scale === 'binary_critical') return 'binary'
  return '0-5'
}

export interface Criterion {
  key: string
  name: string
  scale: CriterionScale
  weight: number
  /** AI rubrics carry an instruction for the model; manual templates don't. */
  description?: string | null
  /**
   * Caps the whole call at 40 points when the criterion fails. Losing it on a
   * round-trip silently turns a blocking rule into an ordinary one and
   * inflates every later score — the template PUT replaces `sections` whole,
   * so anything the editor drops is deleted from the rubric.
   */
  critical?: boolean | null
  /**
   * Wording from the trainer's checklist; the pipeline feeds it to the model.
   * Free prose, and long — the collections checklist runs past 600 characters
   * of numbered lines here, so the newlines are content, not formatting.
   */
  examples?: string | null
  /**
   * The checklist's own points, before weights were normalised to Σ=100. Not
   * rendered anywhere; carried through saves so the rubric stays reconcilable
   * against the source sheet.
   */
  raw_points?: number | null
}

export interface Section {
  key: string
  name: string
  criteria: Criterion[]
}

export type ScorecardType = 'client' | 'third_party'

/**
 * What a template is for: the trainer's manual scorecard, or the Call QA
 * rubric the brain scores calls against. Optional on the wire — templates
 * created before the split answer without the field and read as 'manual'.
 */
export type TemplatePurpose = 'manual' | 'ai'

/**
 * Which outbound line a rubric is written for. The stored value spells grey
 * the British way — `grey`, matching `call_records.telephony_type` and every
 * other telephony surface in this app; `gray` is not a value the data ever
 * carries.
 *
 * NULL on the wire means «any line»: the rubric applies to white and grey
 * alike. Absent (undefined) means a backend that predates the split — read
 * identically to NULL, which is what keeps this UI working before the field
 * is deployed.
 */
export type RubricTelephonyType = 'white' | 'grey'

export const RUBRIC_TELEPHONY_TYPES: RubricTelephonyType[] = ['white', 'grey']

/**
 * Tolerant reader for a stored line. Anything the UI doesn't offer —
 * `unknown` from the call records' own vocabulary, a future line, or the
 * field simply missing — reads as «any line» rather than blanking the row.
 */
export function normalizeRubricTelephonyType(
  value: string | null | undefined
): RubricTelephonyType | null {
  return value === 'white' || value === 'grey' ? value : null
}

export interface ScorecardTemplate {
  id: number
  project_id: number
  name: string
  description: string | null
  call_type: 'inbound' | 'outbound' | null
  purpose?: TemplatePurpose | null
  department_id: number | null
  // KAN-504: 'client' | 'third_party' for the two typed templates; null for
  // the legacy "Default Scorecard".
  scorecard_type: ScorecardType | null
  /**
   * The outbound line this rubric grades. Optional on the wire: templates
   * answered by a backend without the split carry no field at all, and the
   * UI must read that as «any line» rather than break.
   */
  telephony_type?: string | null
  /**
   * The unfinished-dialogue grading scale (bands of the final score with the
   * wording for each). Shape read through `lib/rubricGrading` — the field is
   * being added server-side as this ships, so nothing else reads it raw.
   */
  grading_rules?: unknown
  sections: Section[]
  is_archived: boolean
  created_by: number
  created_at: string
  updated_at: string
}

/** Body of POST /api/v1/quality/templates. */
export interface TemplateCreatePayload {
  name: string
  description?: string | null
  call_type?: 'inbound' | 'outbound' | null
  purpose?: TemplatePurpose
  department_id?: number | null
  scorecard_type?: ScorecardType | null
  /**
   * The line. Present only when it should be written: the update route reads
   * an absent key as «leave it alone» and an explicit null as «clear it».
   */
  telephony_type?: RubricTelephonyType | null
  /** The grading scale, in the shape `lib/rubricGrading` serializes. */
  grading_rules?: unknown
  sections: Section[]
}

/** Body of PUT /api/v1/quality/templates/{id} (full replace of the editable set). */
/**
 * Body of PUT /api/v1/quality/templates/{id}. `purpose` is immutable after
 * creation — a value differing from the stored one answers 409, so it is
 * left out here rather than echoed back.
 */
export type TemplateUpdatePayload = Partial<Omit<TemplateCreatePayload, 'purpose'>>

/** Filter set of GET /api/v1/quality/templates. */
/**
 * Filter set of GET /api/v1/quality/templates. `purpose` defaults to
 * 'manual' server-side, which is what keeps AI rubrics out of the trainers'
 * template picker — always pass it explicitly when you want rubrics.
 */
export interface TemplateListFilters {
  include_archived?: boolean
  purpose?: TemplatePurpose | 'all'
}

// ----- Call QA listening rules: the critical-blocker dictionary -----

/**
 * Blocker categories, verbatim from the pipeline's `red_flags.py`. OPEN set
 * on read (tolerant reader — an unknown category renders as its raw key);
 * closed on write, since the editor only offers what the brain understands.
 */
export const BLOCKER_CATEGORIES = [
  'profanity',
  'threat',
  'third_party_disclosure',
  'misleading_legal',
  'pressure',
  'insult',
  'data_violation',
  'script_critical',
] as const
export type BlockerCategory = (typeof BLOCKER_CATEGORIES)[number]

export const BLOCKER_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
export type BlockerSeverity = (typeof BLOCKER_SEVERITIES)[number]

export const BLOCKER_LANGS = ['uk', 'ru'] as const
export type BlockerLang = (typeof BLOCKER_LANGS)[number]

export interface QaBlocker {
  /** uuid — quality_db.blocker_dictionary.id. */
  id: string
  phrase: string
  category: string
  severity: string
  lang: string
  is_active: boolean
  // Always present in the response; `updated_at` is not nullable there.
  created_by: number | null
  created_at: string
  updated_at: string
}

/**
 * POST body. No `is_active`: a freshly added phrase is always active.
 * `phrase` is 2..200 chars; a duplicate within the same language answers 409.
 */
export interface QaBlockerCreatePayload {
  phrase: string
  category: BlockerCategory
  severity: BlockerSeverity
  lang: BlockerLang
}

/** PUT body — every field optional; this is also how a phrase is reactivated. */
export interface QaBlockerUpdatePayload {
  phrase?: string
  category?: BlockerCategory
  severity?: BlockerSeverity
  lang?: BlockerLang
  is_active?: boolean
}

/**
 * Query of GET /api/v1/quality/qa-rules/blockers.
 *
 * `is_active` is a tri-state that OVERRIDES the legacy `include_inactive`:
 * unset + `include_inactive: true` returns both states, `true`/`false`
 * filters hard. `category`/`severity`/`lang` are validated server-side
 * against the same literals as the write path — an unknown value answers
 * 422 rather than an empty list, so only send values from the constants.
 */
export interface QaBlockerListFilters {
  include_inactive?: boolean
  is_active?: boolean
  category?: BlockerCategory
  severity?: BlockerSeverity
  lang?: BlockerLang
}

// Filled-in value for a single criterion. `value` is integer 0..5 for the
// '0-5' scale and boolean for 'binary'. The backend cross-checks the type
// against the template snapshot.
export interface ScoreEntry {
  value: number | boolean | null
  comment?: string | null
}

export type ScoresPayload = Record<string, ScoreEntry>

export type ScorecardStatus = 'draft' | 'completed' | 'sent'

export interface Scorecard {
  id: number
  call_id: string
  operator_id: number
  trainer_id: number
  project_id: number
  template_id: number
  template_snapshot: {
    id: number
    name: string
    description: string | null
    call_type: string | null
    department_id: number | null
    // KAN-504: frozen scorecard type (optional — legacy snapshots predate it).
    scorecard_type?: ScorecardType | null
    sections: Section[]
  }
  scores: ScoresPayload
  overall_comment: string | null
  weighted_score: number | null
  status: ScorecardStatus
  created_at: string
  completed_at: string | null
  sent_at: string | null
  // Denormalized call attributes (KAN-827): call date, talk time (seconds),
  // dialing type (white/grey/unknown). Nullable until backfilled.
  call_started_at: string | null
  call_talk_duration: number | null
  call_telephony_type: string | null
}

export interface ScorecardHistoryItem {
  id: number
  trainer_id: number
  weighted_score: number | null
  status: ScorecardStatus
  created_at: string
  completed_at: string | null
  sent_at: string | null
}

/** Bulk call → evaluation status (Dialogue Evaluation list badge). Only calls
 *  that have ≥1 scorecard are returned; a missing call_id = "not evaluated". */
export interface CallScorecardStatus {
  call_id: string
  count: number
  latest_status: ScorecardStatus
  latest_score: number | null
}

export interface ScorecardListFilters {
  operator_id?: number[]
  trainer_id?: number[]
  status?: ScorecardStatus[]
  period?: string
  from_date?: string
  to_date?: string
  // KAN-827 Dialogue Evaluation filters (call attributes).
  telephony_type?: string
  call_from?: string
  call_to?: string
  min_talk_duration?: number
  page?: number
  page_size?: number
}

export interface ScorecardCreatePayload {
  call_id: string
  operator_id: number
  template_id: number
  scores?: ScoresPayload
  overall_comment?: string | null
  status?: 'draft' | 'completed'
}

export interface ScorecardUpdatePayload {
  scores?: ScoresPayload
  overall_comment?: string | null
  status?: ScorecardStatus
}

// ---- Score aggregation by period (KAN-504) ----

export type AggregateGroupBy = 'operator' | 'team' | 'all'

export interface AggregateRow {
  // operator_id (group_by=operator), team/group id (group_by=team), or null
  // (group_by=all).
  entity_id: number | null
  entity_name: string
  avg_client: number | null
  avg_third_party: number | null
  calls_scored: number
  trend_vs_prior: number | null
}

export interface AggregateResponse {
  group_by: AggregateGroupBy
  period_from: string
  period_to: string
  rows: AggregateRow[]
}

export interface AggregateFilters {
  period?: string
  from_date?: string
  to_date?: string
  group_by?: AggregateGroupBy
  operator_id?: number[]
}

// ---- Script Stage Funnel ----

export type FunnelBand = 'green' | 'yellow' | 'red'

export interface StageDto {
  key: string
  label_en: string
  label_uk: string
  order: number
  expected: number
  actual: number
  drop_pct: number
  band: FunnelBand
}

export interface PainPointDto {
  stage: string
  label_en: string
  label_uk: string
  drop_pct: number
  band: FunnelBand
  // Critical only — operators whose personal drop exceeds the red threshold.
  operators_below: number | null
  recommendation: string
}

export interface PainPoints {
  critical: PainPointDto[]
  warning: PainPointDto[]
  stable: PainPointDto[]
}

export interface StageFunnelResponse {
  period_from: string
  period_to: string
  // Denominator — scored calls counted into the funnel (surfaced in the UI).
  evaluated_calls: number
  stages: StageDto[]
  pain_points: PainPoints
}

// Which date the funnel window applies to: 'evaluation' (when the call was
// scored, default) or 'call' (when the call was made).
export type FunnelDateType = 'evaluation' | 'call'

export interface StageFunnelFilters {
  period?: string
  from_date?: string
  to_date?: string
  date_type?: FunnelDateType
  operator_ids?: number[]
  department_ids?: number[]
}

export interface Pagination {
  page: number
  page_size: number
  total: number
  total_pages: number
}

export interface PageResponse<T> {
  data: T[]
  pagination: Pagination
}

// ---- Markers (KAN-410, Feature 2.2) ----

export type MarkerType =
  | 'error'
  | 'good_moment'
  | 'script_violation'
  | 'stop_word'
  | 'unmotivated_pause'
  | 'note'

export type MarkerStatus = 'draft' | 'sent'

export const MARKER_TYPES: MarkerType[] = [
  'error',
  'good_moment',
  'script_violation',
  'stop_word',
  'unmotivated_pause',
  'note',
]

// Default color palette for marker dots. KAN-412 will let admins reshape
// this; v1 ships a fixed scheme so the timeline is readable from day one.
// Values reference theme CSS vars (remapped per data-theme in themes.css)
// rather than hardcoded light-mode hex, so dots stay visible in dark themes.
export const MARKER_COLORS: Record<MarkerType, string> = {
  error: 'var(--color-error-500)',
  good_moment: 'var(--color-success-500)',
  script_violation: 'var(--color-orange-500)',
  stop_word: 'var(--color-purple-500)',
  unmotivated_pause: 'var(--color-warning-500)',
  note: 'var(--color-information-500)',
}

export interface CallMarker {
  id: number
  call_id: string
  operator_id: number
  trainer_id: number
  project_id: number
  timestamp_ms: number
  marker_type: MarkerType
  comment: string | null
  status: MarkerStatus
  added_to_library: boolean
  created_at: string
  updated_at: string
}

export interface MarkerCreatePayload {
  timestamp_ms: number
  marker_type: MarkerType
  comment?: string | null
  operator_id: number
}

export interface MarkerUpdatePayload {
  timestamp_ms?: number
  marker_type?: MarkerType
  comment?: string | null
  status?: MarkerStatus
}

export interface MarkerListFilters {
  operator_id?: number[]
  trainer_id?: number[]
  marker_type?: MarkerType[]
  status?: MarkerStatus[]
  period?: string
  from_date?: string
  to_date?: string
  page?: number
  page_size?: number
}

// ---- Feedback (KAN-410, Feature 2.3) ----

export type FeedbackType = 'praise' | 'note' | 'correction_task'
export type FeedbackStatus = 'unread' | 'read' | 'completed'

export const FEEDBACK_TYPES: FeedbackType[] = ['praise', 'note', 'correction_task']

export interface FeedbackReply {
  id: number
  feedback_id: number
  author_id: number
  author_role: 'trainer' | 'operator'
  text: string
  created_at: string
}

export interface Feedback {
  id: number
  call_id: string
  operator_id: number
  trainer_id: number
  project_id: number
  feedback_type: FeedbackType
  text: string
  timestamp_ms: number | null
  status: FeedbackStatus
  deadline: string | null
  created_at: string
  read_at: string | null
  completed_at: string | null
  replies: FeedbackReply[]
}

export interface FeedbackCreatePayload {
  call_id: string
  operator_id: number
  feedback_type: FeedbackType
  text: string
  timestamp_ms?: number | null
  deadline?: string | null
}

export interface FeedbackListFilters {
  operator_id?: number[]
  trainer_id?: number[]
  feedback_type?: FeedbackType[]
  status?: FeedbackStatus[]
  call_id?: string
  period?: string
  from_date?: string
  to_date?: string
  page?: number
  page_size?: number
}

// ---- Score Dynamics (KAN-410, Feature 2.4) ----

export type DynamicsGranularity = 'day' | 'week' | 'month'

export interface DynamicsPoint {
  bucket_start: string
  avg_score: number | null
  scorecard_count: number
  scorecard_ids: number[]
}

export interface SectionBreakdownPoint {
  bucket_start: string
  section_key: string
  avg_score: number | null
  scorecard_count: number
}

export interface TeamBenchmarkPoint {
  bucket_start: string
  team_avg_score: number | null
  operator_count: number
}

export interface DynamicsResponse {
  operator_id: number
  period_from: string
  period_to: string
  granularity: DynamicsGranularity
  points: DynamicsPoint[]
  by_section: SectionBreakdownPoint[]
  team_benchmark: TeamBenchmarkPoint[]
  period_avg: number | null
  period_min: number | null
  period_max: number | null
  scorecard_count: number
}

export interface DynamicsFilters {
  operator_id: number
  granularity?: DynamicsGranularity
  period?: string
  from_date?: string
  to_date?: string
}

export type DynamicsAlertType = 'score_drop' | 'consistent_growth'

export interface ScoreDynamicsAlert {
  id: number
  operator_id: number
  project_id: number
  alert_type: DynamicsAlertType
  prior_period_avg: number
  current_period_avg: number
  delta_pct: number
  triggered_at: string
  notified_trainer_ids: number[]
}

export interface AlertsResponse {
  alerts: ScoreDynamicsAlert[]
  total: number
}

// ---------------------------------------------------------------------------
// Call QA transcripts (Ф1 — CALL_QA_PIPELINE_SPEC §5.5 / CALL_QA_INTEGRATION §3.1)
//
// TOLERANT READER contract: the brain evolves additively — unknown fields must
// be ignored, and `scenes[].key` / utterance `flags[].type` / review enums are
// OPEN sets (render a fallback label for unknown values, never crash).
// ---------------------------------------------------------------------------

/** Utterance flag — the brain may send bare strings or `{type}` objects. */
export type TranscriptUtteranceFlag = string | { type?: string; [key: string]: unknown }

/**
 * v7 inline reaction (`bc`) — a short interjection of the OTHER side inside
 * this turn. The brain sends `{t, role, text}` objects; older exports used
 * `[t, role, text]` tuples — the reader accepts both.
 */
export type TranscriptBackchannel =
  | { t?: number; role?: string; text?: string; [key: string]: unknown }
  | [number, string, string]

/** v7 QA tag `[kind, label]` — kind is an OPEN set (good|warn|crit|info|…). */
export type TranscriptQaTag = Array<string | undefined | null>

/**
 * v7 in-turn hesitation — a deterministic pause of the SPEAKER inside their
 * own turn (derived from word timecodes): `t` — where it happened (seconds),
 * `gap` — its length (seconds). `{t, gap}` objects are current; `[t, gap]`
 * tuples are tolerated like `bc`.
 */
export type TranscriptHesitation =
  | { t?: number; gap?: number; [key: string]: unknown }
  | [number, number]

export interface TranscriptUtterance {
  /** Utterance index — present in the Ф1 format, absent in v7 turns. */
  i?: number
  /** start / end, seconds (float) */
  t0: number
  t1: number
  /** 'operator' | 'client' | 'other' — open enum, treat unknown as 'other'. */
  role?: string
  text: string
  lang?: string
  conf?: number
  flags?: TranscriptUtteranceFlag[]
  /** v7: turn duration, seconds. Its presence is the v7 format marker. */
  dur?: number
  /** v7: the other side's short reactions inside this turn. */
  bc?: TranscriptBackchannel[]
  /** v7: silence (both channels) before this turn, seconds. */
  pause_before?: number
  /** v7: QA tag `[kind, label]`. */
  tag?: TranscriptQaTag
  /** v7: hesitation pauses of the speaker inside this turn. */
  hes?: TranscriptHesitation[]
  /** Phase 2: 12B audio read of this turn (optional layer). */
  audio?: UtteranceAudio | null
}

/** v7 call-level stats (`metrics.stats`) — every field optional (tolerant). */
export interface TranscriptStats {
  op_talk_s?: number
  cl_talk_s?: number
  silence_total_s?: number
  max_silence_s?: number
  overlap_total_s?: number
  n_turns?: number
  /** Operator's share of talk time, percent 0..100. */
  op_share?: number
  /** Hesitation counts per side (deterministic, from word timecodes). */
  op_hes?: number
  cl_hes?: number
  [key: string]: unknown
}

export interface TranscriptScene {
  /** greeting | identification | … — OPEN enum (§5.4), unknown keys allowed. */
  key: string
  from_utt: number
  to_utt: number
}

// ---- Audio layer (phase 2, conclusion_spec §A) — every block optional. ----
// 12B listens to the recording in ~10s windows and retells tone/emotions as
// TEXT with an H/M/L reliability mark; nothing here is ASR ground truth.

/** Per-utterance audio read of the speaker (12B). All fields optional. */
export interface AudioSpeakerState {
  /** 'neg' | 'neutral' | 'pos' — open set, unknown → neutral. */
  polarity?: string
  emotion?: string
  /** Emotional intensity 0..3 (utterance scale). */
  arousal?: number
  /** 'перебивання' | 'крик' | 'плач' | 'довга пауза' | … — OPEN set. */
  events?: string[]
  /** 0..1 — drives marker opacity. */
  confidence?: number
  /** 'H' | 'M' | 'L' — M/L render dimmed with an «approximate» note. */
  reliability?: string
  acoustic?: string
  [key: string]: unknown
}

export interface UtteranceAudio {
  window_ids?: number[]
  speaker_state?: AudioSpeakerState | null
  [key: string]: unknown
}

/** Raw 12B timeline window (kept for tooltips/debug; UI works off dynamics). */
export interface AudioWindow {
  id?: number
  t0?: number
  t1?: number
  no_speech?: boolean
  speakers?: Record<
    string,
    {
      polarity?: string
      tone?: string
      emotion?: string
      arousal?: number
      confidence?: number
      [key: string]: unknown
    }
  > | null
  events?: string[]
  reliability?: Record<string, string> | null
  [key: string]: unknown
}

export interface EmotionPathPoint {
  t?: number
  polarity?: string
  arousal?: number
  [key: string]: unknown
}

export interface EmotionDynamicsClient {
  start?: { polarity?: string; emotion?: string; win?: number } | null
  end?: { polarity?: string; emotion?: string; win?: number } | null
  /** 'improved' | 'degraded' | 'stable' — open set. */
  trend?: string
  peak_stress?: { t?: number; win?: number; arousal?: number } | null
  /** RAW window points — smoothing happens on the FE (CEO decision). */
  path?: EmotionPathPoint[] | null
  scores?: {
    start_arousal?: number
    peak_arousal?: number
    peak_t?: number
    final_arousal?: number
    trend?: string
    [key: string]: unknown
  } | null
  [key: string]: unknown
}

export interface EmotionDynamicsOperator {
  tone_baseline?: string
  tone_peaks?: Array<{ t?: number; tone?: string; arousal?: number }> | null
  trend?: string
  /** 0–5 scales. */
  scores?: { irritation_avg?: number; empathy_avg?: number; [key: string]: unknown } | null
  [key: string]: unknown
}

/** Turn where the words read one way but the audio sounds another. */
export interface DivergenceCandidate {
  /** Utterance index (position in `utterances`). */
  utt?: number
  text_reads?: string
  audio_reads?: string
  reliability?: string
  [key: string]: unknown
}

export interface EmotionDynamics {
  client?: EmotionDynamicsClient | null
  operator?: EmotionDynamicsOperator | null
  divergence_candidates?: DivergenceCandidate[] | null
  [key: string]: unknown
}

export interface CallTranscript {
  language?: string | null
  duration_s?: number | null
  summary?: string | null
  utterances: TranscriptUtterance[]
  scenes?: TranscriptScene[] | null
  /**
   * v7 puts call-level stats under `metrics.stats` (second v7 marker).
   * `metrics` is also the PRIMARY home of the audio layer — metrics travels
   * brain→CRM verbatim, so the layer needs no api-prionex changes.
   */
  metrics?: {
    stats?: TranscriptStats | null
    audio_engine?: string | null
    audio_layer_version?: string | null
    audio_windows?: AudioWindow[] | null
    emotion_dynamics?: EmotionDynamics | null
    [key: string]: unknown
  } | null
  agent_extension?: string | null
  client_id?: number | null
  direction?: string | null
  answered_at?: string | null
  /** FALLBACK location of the audio layer; the primary home is `metrics.*`. */
  audio_engine?: string | null
  audio_layer_version?: string | null
  audio_windows?: AudioWindow[] | null
  emotion_dynamics?: EmotionDynamics | null
}

export interface ReviewRedFlag {
  type?: string
  severity?: string
  utt?: number
  quote?: string
  explanation?: string
}

export interface ReviewPromise {
  amount?: number | null
  currency?: string | null
  date?: string | null
  confidence?: number | null
  quote?: string | null
}

// ---- 31B conclusion (step B) — «звідки такий бал» for the call card. ----
// Ships inside `review.conclusion`; older reviews have none. Every field is
// optional and every enum is OPEN — the block renders per available part.

export interface ConclusionOverall {
  /** 'green' | 'yellow' | 'red' — open set, unknown → neutral grey. */
  grade?: string
  /** 0..100, same scale as `weighted_score`. */
  score?: number
  one_liner?: string
  [key: string]: unknown
}

export interface ConclusionOperatorAssessment {
  score?: number
  /** Rubric score before the 31B adjustment. */
  rubric_score_input?: number
  adjustment?: number
  adjustment_reason?: string
  strengths?: string[]
  weaknesses?: string[]
  justification?: string
  [key: string]: unknown
}

export interface ConclusionClientDynamics {
  emotional_path?: string
  start?: string
  end?: string
  trend?: string
  driver?: string
  peak_stress?: string
  [key: string]: unknown
}

export interface ConclusionDivergence {
  who?: string
  /** Utterance index (position in `utterances`). */
  utt?: number
  said?: string
  sounded?: string
  reliability?: string
  interpretation?: string
  [key: string]: unknown
}

export interface ConclusionToneVsWords {
  consistent?: boolean
  divergences?: ConclusionDivergence[] | null
  note?: string
  [key: string]: unknown
}

export interface ConclusionRecommendation {
  text?: string
  /** Anchor like `utt 12` — rendered clickable when it points at a turn. */
  evidence?: string
  /** 'high' | 'normal' — open set. */
  priority?: string
  [key: string]: unknown
}

export interface ConclusionConfidence {
  overall?: number
  /** 'no_audio_layer' | 'fallback_26b' | … — open set. */
  limited_by?: string[] | null
  [key: string]: unknown
}

export interface ReviewConclusion {
  call_summary?: string
  overall?: ConclusionOverall | null
  operator_assessment?: ConclusionOperatorAssessment | null
  client_dynamics?: ConclusionClientDynamics | null
  tone_vs_words?: ConclusionToneVsWords | null
  key_findings?: string[] | null
  recommendations?: Array<ConclusionRecommendation | string> | null
  confidence?: ConclusionConfidence | null
  model?: string
  conclusion_prompt_version?: string
  [key: string]: unknown
}

/** Проход 2 (Ф2) — null during Ф1; every field optional (tolerant reader). */
export interface CallAiReview {
  model?: string | null
  prompt_version?: string | null
  rubric_version?: string | null
  scores?: Record<
    string,
    { value?: number | boolean | null; quote?: string | null; comment?: string | null }
  >
  weighted_score?: number | null
  red_flags?: ReviewRedFlag[]
  fraud?: Array<{ type?: string; confidence?: number; explanation?: string }>
  mood?: {
    operator?: Record<string, unknown>
    client?: Record<string, unknown>
  } | null
  extracted?: { promise?: ReviewPromise | null; [key: string]: unknown } | null
  summary?: string | null
  recommendations?: string[] | null
  /** 31B conclusion (step B) — absent/null on older reviews. */
  conclusion?: ReviewConclusion | null
}

export interface CallTranscriptDto {
  transcript: CallTranscript
  review: CallAiReview | null
}

/**
 * Normalised query result: the endpoint answers
 *   200 {transcript, review}  → ready
 *   202 {status}              → processing (pending / failed) — not ready yet
 *   404                       → the brain has not seen this call — not ready
 *   403                       → viewer lacks `view_transcripts`
 */
export type TranscriptQueryResult =
  | { state: 'ready'; transcript: CallTranscript; review: CallAiReview | null }
  | { state: 'not_ready'; status?: string }
