/**
 * TranscriptV7View — detailed two-sided rendering of the v7 turn format
 * (FORMAT_SPEC approved by CEO): stats header with talk balance, key-moments
 * digest for the supervisor, and a client-left / operator-right feed with
 * silence chips, overlap badges, QA tag badges and the other side's inline
 * reactions woven into the bubble text at their proportional time position.
 *
 * Phase 2 adds the optional 12B AUDIO LAYER on top (conclusion_spec §A),
 * BUSINESS STYLE per the CEO pass of 2026-07: strictly no emoji anywhere.
 * Per turn only two significant states earn a thin text badge next to the
 * timecode («підвищений голос», «плач») — the rest of the 12B event stream
 * (drawn-out sounds, hesitant speech, interruptions…) stays in the payload
 * without UI. Polarity bubble borders, the client dynamics strip (smoothed
 * on the FE, raw values in tooltips, peak dots), start→end chips,
 * «тон ≠ слова» text badges and numeric operator/client scores (now with
 * hesitation counters) stay. Deterministic in-turn hesitations (`hes`) render
 * INSIDE the bubble text as grey italic remarks at their time position, and
 * silence chips get ambient-sound annotations («тиша 16.7 с · музика») from
 * the overlapping 10s windows. Everything is driven by data presence —
 * without the layer the panel renders exactly as before.
 *
 * Light theme only — matches the rest of the quality feature (the CRM has no
 * theme toggle; sporadic `dark:` variants elsewhere are not wired here).
 *
 * TOLERANT READER: tag kinds are an open set (unknown → grey), `bc`/`hes`
 * accept object and tuple encodings, missing stats hide their chips — never
 * crash. The audio layer is a 12B model's read of the sound, not ground
 * truth: M/L reliability carries an «за аудіо, орієнтовно» tooltip note.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { DATETIME_DISPLAY_FORMAT } from '@/lib/dateUtils'
import type { CallTranscript, EmotionDynamics, TranscriptStats } from '../types'
import {
  buildV7Rows,
  extractKeyMoments,
  formatClock,
  formatSeconds1,
  getV7Stats,
  type KeyMoment,
  type QaTagKind,
  type V7Row,
} from '../lib/transcriptV7'
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
  normalizePolarity,
  normalizeTrend,
  pauseEnvironmentLabels,
  speakerStateOf,
  type AudioPolarity,
  type NormalizedDivergence,
  type TrendKind,
} from '../lib/transcriptAudio'

export interface TranscriptV7ViewProps {
  transcript: CallTranscript
  /** Seek the call player, milliseconds (same contract as the Ф1 panel). */
  onSeek?: (ms: number) => void
}

// Role palette from the approved visual reference (call_transcript.html):
// operator — cold blue, client — warm amber; unknown roles → neutral grey.
const ROLE_STYLES = {
  operator: {
    side: 'items-end self-end',
    who: 'text-[#2555d6]',
    bubble: 'rounded-br-sm border-[#c8d8fb] bg-[#eaf0fe]',
    bcChip: 'bg-[#2555d6]/10 text-[#2555d6]',
  },
  client: {
    side: 'items-start self-start',
    who: 'text-[#a8631a]',
    bubble: 'rounded-bl-sm border-[#eed6b6] bg-[#fbf1e4]',
    bcChip: 'bg-[#a8631a]/10 text-[#a8631a]',
  },
  other: {
    side: 'items-start self-start',
    who: 'text-gray-500',
    bubble: 'border-gray-200 bg-gray-50',
    bcChip: 'bg-gray-500/10 text-gray-600',
  },
} as const

const TAG_TONES: Record<QaTagKind, string> = {
  good: 'bg-[#1f9d61]/10 text-[#1f9d61]',
  warn: 'bg-[#c78a12]/10 text-[#c78a12]',
  crit: 'bg-[#c8492f]/10 text-[#c8492f]',
  info: 'bg-[#5b6472]/10 text-[#5b6472]',
}

// Emotion polarity palette (audio_layer.html reference).
const POLARITY_HEX: Record<AudioPolarity, string> = {
  neg: '#d1495b',
  pos: '#3aa66b',
  neutral: '#8792a6',
}

// Left bubble border by polarity; neutral keeps the bubble untouched.
const POLARITY_BORDER: Record<AudioPolarity, string> = {
  neg: 'border-l-[3px] border-l-[#d1495b]',
  pos: 'border-l-[3px] border-l-[#3aa66b]',
  neutral: '',
}

const TREND_ARROWS: Record<TrendKind, { glyph: string; tone: string }> = {
  improved: { glyph: '↑', tone: 'text-[#3aa66b]' },
  degraded: { glyph: '↓', tone: 'text-[#d1495b]' },
  stable: { glyph: '→', tone: 'text-gray-500' },
  other: { glyph: '', tone: 'text-gray-500' },
}

function TrendArrow({ trend, testId }: { trend: string | undefined; testId?: string }) {
  const normalized = normalizeTrend(trend)
  if (!normalized) return null
  const arrow = TREND_ARROWS[normalized.kind]
  return (
    <span data-testid={testId} className={`font-bold ${arrow.tone}`}>
      {arrow.glyph || normalized.raw}
    </span>
  )
}

function roleKeyOf(role: string | undefined): keyof typeof ROLE_STYLES {
  return role === 'operator' || role === 'client' ? role : 'other'
}

function QaTagBadge({ kind, label, testId }: { kind: QaTagKind; label: string; testId?: string }) {
  return (
    <span
      data-testid={testId}
      className={`rounded px-1.5 py-px text-[10px] font-bold whitespace-nowrap ${TAG_TONES[kind]}`}
    >
      {label}
    </span>
  )
}

function V7StatsHeader({
  transcript,
  stats,
  dynamics,
}: {
  transcript: CallTranscript
  stats: TranscriptStats | null
  dynamics: EmotionDynamics | null
}) {
  const { t } = useTranslation('common')

  const answered = transcript.answered_at ? new Date(transcript.answered_at) : null
  const answeredLabel =
    answered && !Number.isNaN(answered.getTime()) ? format(answered, DATETIME_DISPLAY_FORMAT) : null
  const durationLabel =
    typeof transcript.duration_s === 'number' && Number.isFinite(transcript.duration_s)
      ? formatClock(transcript.duration_s)
      : null
  const direction = transcript.direction
  const directionLabel =
    direction === 'inbound' || direction === 'outbound'
      ? t(`pages.training.transcript.v7.direction.${direction}`)
      : (direction ?? null) // open set — unknown directions render as-is

  const share =
    typeof stats?.op_share === 'number' && Number.isFinite(stats.op_share)
      ? Math.min(100, Math.max(0, Math.round(stats.op_share)))
      : null
  const opTalk = typeof stats?.op_talk_s === 'number' ? formatClock(stats.op_talk_s) : null
  const clTalk = typeof stats?.cl_talk_s === 'number' ? formatClock(stats.cl_talk_s) : null

  const silenceTotal = typeof stats?.silence_total_s === 'number' ? stats.silence_total_s : null
  const silenceMax = typeof stats?.max_silence_s === 'number' ? stats.max_silence_s : null
  const overlapTotal = typeof stats?.overlap_total_s === 'number' ? stats.overlap_total_s : null
  const nTurns = typeof stats?.n_turns === 'number' ? stats.n_turns : null

  // Hesitation counters (deterministic, from word timecodes) — text only.
  const opHes =
    typeof stats?.op_hes === 'number' && Number.isFinite(stats.op_hes) && stats.op_hes >= 0
      ? stats.op_hes
      : null
  const clHes =
    typeof stats?.cl_hes === 'number' && Number.isFinite(stats.cl_hes) && stats.cl_hes >= 0
      ? stats.cl_hes
      : null

  // Audio-layer numeric scores (phase 2) — chip renders per available part.
  const opScores = dynamics?.operator?.scores ?? null
  const toneBaseline =
    typeof dynamics?.operator?.tone_baseline === 'string' ? dynamics.operator.tone_baseline : null
  const irritation = typeof opScores?.irritation_avg === 'number' ? opScores.irritation_avg : null
  const empathy = typeof opScores?.empathy_avg === 'number' ? opScores.empathy_avg : null
  const operatorAudioParts = [
    toneBaseline ? `${t('pages.training.transcript.v7.audio.tone')} ${toneBaseline}` : null,
    irritation != null
      ? `${t('pages.training.transcript.v7.audio.irritation')} ${formatScore(irritation)}/5`
      : null,
    empathy != null
      ? `${t('pages.training.transcript.v7.audio.empathy')} ${formatScore(empathy)}/5`
      : null,
  ].filter((part): part is string => part != null)
  const operatorScoreParts = [
    ...operatorAudioParts,
    opHes != null ? t('pages.training.transcript.v7.hesitations', { value: opHes }) : null,
  ].filter((part): part is string => part != null)

  const clScores = dynamics?.client?.scores ?? null
  const startArousal = typeof clScores?.start_arousal === 'number' ? clScores.start_arousal : null
  const peakArousal = typeof clScores?.peak_arousal === 'number' ? clScores.peak_arousal : null
  const peakT = typeof clScores?.peak_t === 'number' ? clScores.peak_t : null
  const finalArousal = typeof clScores?.final_arousal === 'number' ? clScores.final_arousal : null
  const clientScoreParts = [
    startArousal != null ? formatScore(startArousal) : null,
    peakArousal != null
      ? `${t('pages.training.transcript.v7.audio.peak')} ${formatScore(peakArousal)}${
          peakT != null ? ` (${formatClock(peakT)})` : ''
        }`
      : null,
    finalArousal != null ? formatScore(finalArousal) : null,
  ].filter((part): part is string => part != null)
  const clientTrend = typeof clScores?.trend === 'string' ? clScores.trend : undefined

  const hasMeta = answeredLabel || durationLabel || transcript.agent_extension || directionLabel
  const hasChips =
    silenceTotal != null ||
    overlapTotal != null ||
    nTurns != null ||
    operatorScoreParts.length > 0 ||
    clientScoreParts.length > 0 ||
    clHes != null
  if (!hasMeta && share == null && !hasChips) return null

  return (
    <div
      data-testid="transcript-v7-stats"
      className="rounded-lg border border-gray-200 bg-white text-left"
    >
      {hasMeta ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs text-gray-600">
          {answeredLabel ? <span className="font-mono tabular-nums">{answeredLabel}</span> : null}
          {durationLabel ? (
            <span>
              <span className="text-gray-400">{t('pages.training.transcript.v7.duration')} </span>
              <span className="font-mono tabular-nums">{durationLabel}</span>
            </span>
          ) : null}
          {transcript.agent_extension ? (
            <span>
              <span className="text-gray-400">
                {t('pages.training.transcript.roles.operator')}{' '}
              </span>
              <span className="font-medium text-[#2555d6]">{transcript.agent_extension}</span>
            </span>
          ) : null}
          {directionLabel ? <span>{directionLabel}</span> : null}
        </div>
      ) : null}

      {share != null ? (
        <div className="border-t border-gray-100 px-3 py-2">
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold tabular-nums">
            <span className="text-[#2555d6]">
              {t('pages.training.transcript.v7.operatorShare', { share })}
              {opTalk ? ` · ${opTalk}` : ''}
            </span>
            <span className="text-[#a8631a]">
              {clTalk ? `${clTalk} · ` : ''}
              {t('pages.training.transcript.v7.clientShare', { share: 100 - share })}
            </span>
          </div>
          <div
            data-testid="transcript-v7-balance"
            className="flex h-2 overflow-hidden rounded-full bg-[#fbf1e4]"
          >
            <div
              data-testid="transcript-v7-balance-op"
              className="bg-[#2555d6]"
              style={{ width: `${share}%` }}
            />
            <div className="flex-1 bg-[#a8631a]" />
          </div>
        </div>
      ) : null}

      {hasChips ? (
        <div className="flex flex-wrap gap-1.5 border-t border-gray-100 px-3 py-2">
          {silenceTotal != null ? (
            <span
              data-testid="transcript-v7-chip-silence"
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 tabular-nums"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#c78a12]" />
              {silenceMax != null
                ? t('pages.training.transcript.v7.silenceMax', {
                    total: formatSeconds1(silenceTotal),
                    max: formatSeconds1(silenceMax),
                  })
                : t('pages.training.transcript.v7.silence', {
                    total: formatSeconds1(silenceTotal),
                  })}
            </span>
          ) : null}
          {overlapTotal != null ? (
            <span
              data-testid="transcript-v7-chip-overlap"
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 tabular-nums"
            >
              <span className="h-1.5 w-1.5 rounded-[2px] bg-[#c8492f]" />
              {t('pages.training.transcript.v7.overlapTotal', {
                total: formatSeconds1(overlapTotal),
              })}
            </span>
          ) : null}
          {nTurns != null ? (
            <span
              data-testid="transcript-v7-chip-turns"
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 tabular-nums"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
              {t('pages.training.transcript.v7.turns', { count: nTurns })}
            </span>
          ) : null}
          {operatorScoreParts.length > 0 ? (
            <span
              data-testid="transcript-v7-chip-operator-audio"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#c8d8fb] bg-[#eaf0fe]/60 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 tabular-nums"
              // Hesitation counters are deterministic — the «by audio» note
              // only applies when 12B-derived parts are present.
              title={
                operatorAudioParts.length > 0
                  ? t('pages.training.transcript.v7.audio.approx')
                  : undefined
              }
            >
              <span className="font-semibold text-[#2555d6]">
                {t('pages.training.transcript.roles.operator')}
              </span>
              {operatorScoreParts.join(' · ')}
            </span>
          ) : null}
          {clientScoreParts.length > 0 || clHes != null ? (
            <span
              data-testid="transcript-v7-chip-client-audio"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#eed6b6] bg-[#fbf1e4]/60 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 tabular-nums"
              title={
                clientScoreParts.length > 0 || clientTrend
                  ? t('pages.training.transcript.v7.audio.approx')
                  : undefined
              }
            >
              <span className="font-semibold text-[#a8631a]">
                {t('pages.training.transcript.roles.client')}
              </span>
              {clientScoreParts.length > 0 ? clientScoreParts.join(' → ') : null}
              {clientTrend ? (
                <span data-testid="transcript-v7-client-trend">
                  {t('pages.training.transcript.v7.audio.trend')}{' '}
                  {directionalTrendGlyph(clientTrend)}
                </span>
              ) : null}
              {clHes != null ? (
                <span data-testid="transcript-v7-client-hes">
                  {t('pages.training.transcript.v7.hesitations', { value: clHes })}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Client emotion dynamics (phase 2): start→end chips with the trend arrow and
 * a clickable strip over the RAW 12B path — bar heights use the FE-smoothed
 * arousal (moving average over 3 windows), tooltips show raw + smoothed, and
 * raw-arousal peaks keep a visible dot so smoothing never hides a shout.
 */
function V7AudioDynamics({
  dynamics,
  durationS,
  onSeek,
}: {
  dynamics: EmotionDynamics | null
  durationS?: number | null
  onSeek?: (ms: number) => void
}) {
  const { t } = useTranslation('common')
  const client = dynamics?.client ?? null
  const segments = useMemo(
    () => buildDynamicsSegments(client?.path, durationS),
    [client, durationS]
  )

  const startEmotion = typeof client?.start?.emotion === 'string' ? client.start.emotion : null
  const endEmotion = typeof client?.end?.emotion === 'string' ? client.end.emotion : null
  const trend = normalizeTrend(client?.trend)

  if (segments.length === 0 && !startEmotion && !endEmotion && !trend) return null

  const scaleMax = dynamicsScaleMax(segments)
  const totalSpan = segments.length
    ? Math.max(segments[segments.length - 1].tEnd - segments[0].t, 1)
    : 1

  return (
    <div
      data-testid="transcript-v7-audio-dynamics"
      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-left"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
          {t('pages.training.transcript.v7.audio.dynamicsTitle')}
        </span>
        {startEmotion || endEmotion || trend ? (
          <span
            data-testid="transcript-v7-audio-startend"
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600"
          >
            {startEmotion ? (
              <>
                <span className="text-gray-400">
                  {t('pages.training.transcript.v7.audio.start')}:
                </span>{' '}
                {startEmotion}
              </>
            ) : null}
            {startEmotion && endEmotion ? <span className="text-gray-400">→</span> : null}
            {endEmotion ? (
              <>
                <span className="text-gray-400">
                  {t('pages.training.transcript.v7.audio.end')}:
                </span>{' '}
                {endEmotion}
              </>
            ) : null}
            {trend ? <TrendArrow trend={trend.raw} testId="transcript-v7-audio-trend" /> : null}
          </span>
        ) : null}
      </div>

      {segments.length > 0 ? (
        <div
          data-testid="transcript-v7-audio-strip"
          className="mt-2 flex h-10 items-end gap-px overflow-hidden rounded border-b border-gray-200"
          title={t('pages.training.transcript.v7.audio.approx')}
        >
          {segments.map((segment) => (
            <button
              key={segment.index}
              type="button"
              data-testid={`transcript-v7-audio-seg-${segment.index}`}
              className="relative flex h-full min-w-[6px] items-end hover:opacity-80"
              style={{ flexGrow: Math.max(segment.tEnd - segment.t, 1) / totalSpan }}
              onClick={() => onSeek?.(Math.round(segment.t * 1000))}
              title={t('pages.training.transcript.v7.audio.windowTooltip', {
                from: formatClock(segment.t),
                to: formatClock(segment.tEnd),
                raw: formatScore(segment.rawArousal),
                smooth: segment.smoothArousal.toFixed(1),
              })}
            >
              {segment.isPeak ? (
                <span
                  data-testid={`transcript-v7-audio-peak-${segment.index}`}
                  className="absolute top-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#d1495b]"
                />
              ) : null}
              <span
                className="w-full rounded-t-sm"
                style={{
                  // Keep even calm windows visible (8% floor).
                  height: `${Math.max(8, (segment.smoothArousal / scaleMax) * 100)}%`,
                  backgroundColor: POLARITY_HEX[segment.polarity],
                }}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Divergence pinned to a rendered turn (t0 resolved via the utt index). */
interface DivergenceMoment extends NormalizedDivergence {
  t0: number
}

function V7KeyMoments({
  moments,
  divergences,
  onSeek,
}: {
  moments: KeyMoment[]
  divergences: DivergenceMoment[]
  onSeek?: (ms: number) => void
}) {
  const { t } = useTranslation('common')
  const entries = useMemo(
    () =>
      [
        ...moments.map((moment) => ({ kind: 'tag' as const, t0: moment.t0, moment })),
        ...divergences.map((divergence) => ({
          kind: 'divergence' as const,
          t0: divergence.t0,
          divergence,
        })),
      ].sort((a, b) => a.t0 - b.t0),
    [moments, divergences]
  )
  if (entries.length === 0) return null
  return (
    <div
      data-testid="transcript-v7-keymoments"
      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-left"
    >
      <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
        {t('pages.training.transcript.v7.keyMoments')}
      </div>
      <ul className="flex flex-col gap-0.5">
        {entries.map((entry) => (
          <li
            key={entry.kind === 'tag' ? `tag-${entry.moment.index}` : `div-${entry.divergence.utt}`}
          >
            <button
              type="button"
              data-testid={
                entry.kind === 'tag'
                  ? `transcript-v7-moment-${entry.moment.index}`
                  : `transcript-v7-moment-div-${entry.divergence.utt}`
              }
              className="flex w-full items-baseline gap-2 rounded px-1 py-0.5 text-left text-sm hover:bg-gray-50"
              onClick={() => onSeek?.(Math.round(entry.t0 * 1000))}
              title={t('pages.training.transcript.seekTo')}
            >
              <span className="font-mono text-[11px] text-gray-400 tabular-nums">
                {formatClock(entry.t0)}
              </span>
              {entry.kind === 'tag' ? (
                <>
                  <QaTagBadge kind={entry.moment.tag.kind} label={entry.moment.tag.label} />
                  <span className="min-w-0 truncate text-gray-700">«{entry.moment.quote}»</span>
                </>
              ) : (
                <>
                  <QaTagBadge
                    kind="warn"
                    label={t('pages.training.transcript.v7.audio.toneVsWords')}
                  />
                  <span className="min-w-0 truncate text-gray-700">
                    {t('pages.training.transcript.v7.audio.said')}: {entry.divergence.textReads} ·{' '}
                    {t('pages.training.transcript.v7.audio.sounded')}: {entry.divergence.audioReads}
                  </span>
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function V7TurnRow({
  row,
  divergence,
  onSeek,
}: {
  row: V7Row
  divergence?: NormalizedDivergence
  onSeek?: (ms: number) => void
}) {
  const { t } = useTranslation('common')
  const roleKey = roleKeyOf(row.turn.role)
  const styles = ROLE_STYLES[roleKey]

  // Phase-2 audio layer for this turn (optional): significant-state text
  // badges + polarity border. No event chips, no icons (business style).
  const audioState = speakerStateOf(row.turn)
  const significantStates = useMemo(() => deriveSignificantStates(audioState), [audioState])
  const approximate = isApproximateReliability(audioState?.reliability)
  const approxNote = t('pages.training.transcript.v7.audio.approx')
  const polarityBorder = audioState ? POLARITY_BORDER[normalizePolarity(audioState.polarity)] : ''

  return (
    <div
      data-testid={`transcript-v7-turn-${row.index}`}
      className={`flex max-w-[80%] flex-col ${styles.side}`}
    >
      <div className="mb-0.5 flex flex-wrap items-center gap-1.5 px-1 text-[11px]">
        <span className={`font-semibold ${styles.who}`}>
          {t(`pages.training.transcript.roles.${roleKey}`)}
        </span>
        <button
          type="button"
          data-testid={`transcript-v7-seek-${row.index}`}
          className="font-mono text-gray-400 tabular-nums underline decoration-dotted underline-offset-2 hover:text-gray-600"
          onClick={() => onSeek?.(Math.round(row.t0 * 1000))}
          title={t('pages.training.transcript.seekTo')}
        >
          {formatClock(row.t0)}–{formatClock(row.t1)}
        </button>
        {row.overlap ? (
          <span
            data-testid={`transcript-v7-overlap-${row.index}`}
            className="rounded bg-[#c8492f]/10 px-1.5 py-px text-[10px] font-bold whitespace-nowrap text-[#c8492f]"
          >
            {t('pages.training.transcript.v7.overlap')}
          </span>
        ) : null}
        {row.tag ? (
          <QaTagBadge
            kind={row.tag.kind}
            label={row.tag.label}
            testId={`transcript-v7-tag-${row.index}`}
          />
        ) : null}
        {significantStates.map((state) => (
          <span
            key={state}
            data-testid={`transcript-v7-audio-state-${row.index}-${state}`}
            className="text-[10px] font-medium whitespace-nowrap text-gray-400"
            title={approximate ? approxNote : undefined}
          >
            {t(`pages.training.transcript.v7.audio.states.${state}`)}
          </span>
        ))}
        {divergence ? (
          <span
            data-testid={`transcript-v7-divergence-${row.index}`}
            className="rounded bg-[#c78a12]/10 px-1.5 py-px text-[10px] font-bold whitespace-nowrap text-[#c78a12]"
            title={`${t('pages.training.transcript.v7.audio.said')}: ${divergence.textReads} · ${t(
              'pages.training.transcript.v7.audio.sounded'
            )}: ${divergence.audioReads}${
              isApproximateReliability(divergence.reliability) ? ` · ${approxNote}` : ''
            }`}
          >
            {t('pages.training.transcript.v7.audio.toneVsWords')}
          </span>
        ) : null}
      </div>
      <div
        className={`text-dark-500 rounded-xl border px-3 py-2 text-sm leading-relaxed ${styles.bubble} ${polarityBorder}`}
      >
        {row.segments.map((segment, i) => {
          if (segment.kind === 'text') {
            return <span key={i}>{segment.text} </span>
          }
          if (segment.kind === 'hes') {
            // Speaker's own pause — a grey italic remark, never breaks the phrase.
            return (
              <span
                key={i}
                data-testid={`transcript-v7-hes-${row.index}-${segment.ordinal}`}
                className="mr-1 text-xs whitespace-nowrap text-gray-400 italic"
              >
                {t('pages.training.transcript.v7.inlinePause', {
                  seconds: formatSeconds1(segment.gap),
                })}
              </span>
            )
          }
          return (
            <span
              key={i}
              data-testid={`transcript-v7-bc-${row.index}-${segment.ordinal}`}
              className={`mx-0.5 inline-block rounded px-1 text-xs font-medium whitespace-nowrap italic ${
                ROLE_STYLES[roleKeyOf(segment.bc.role)].bcChip
              }`}
            >
              <span className="mr-0.5 font-mono text-[9px] not-italic opacity-70">
                {formatClock(segment.bc.t)}
              </span>
              {segment.bc.text}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function TranscriptV7View({ transcript, onSeek }: TranscriptV7ViewProps) {
  const { t } = useTranslation('common')
  const rows = useMemo(() => buildV7Rows(transcript.utterances), [transcript])
  const moments = useMemo(() => extractKeyMoments(rows), [rows])
  const stats = getV7Stats(transcript)

  // Phase-2 audio layer (all optional): dynamics + «тон ≠ слова» lookups +
  // 10s windows for ambient annotation of silence chips.
  // Primary home is metrics.*; top-level is the fallback.
  const dynamics = getEmotionDynamics(transcript)
  const audioWindows = useMemo(() => getAudioWindows(transcript), [transcript])
  const divergenceMap = useMemo(() => divergencesByUtt(dynamics), [dynamics])
  const divergenceMoments = useMemo(
    () =>
      [...divergenceMap.values()]
        .filter((d) => rows[d.utt] != null) // utt must point at a rendered turn
        .map((d) => ({ ...d, t0: rows[d.utt].t0 })),
    [divergenceMap, rows]
  )

  return (
    <div className="flex flex-col gap-2">
      <V7StatsHeader transcript={transcript} stats={stats} dynamics={dynamics} />
      <V7AudioDynamics dynamics={dynamics} durationS={transcript.duration_s} onSeek={onSeek} />
      <V7KeyMoments moments={moments} divergences={divergenceMoments} onSeek={onSeek} />
      <div data-testid="transcript-v7-feed" className="flex flex-col gap-2">
        {rows.map((row) => {
          // pause_before IS the silence interval before the turn — annotate
          // it with ambient sounds from the 12B windows it overlaps.
          const pauseEnvironment =
            row.pauseBefore != null
              ? pauseEnvironmentLabels(audioWindows, row.t0 - row.pauseBefore, row.t0)
              : []
          return (
            <div key={row.index} className="contents">
              {row.pauseBefore != null ? (
                <div
                  data-testid={`transcript-v7-pause-${row.index}`}
                  className="self-center rounded-full border border-dashed border-[#c78a12]/45 bg-[#c78a12]/10 px-3 py-0.5 text-[11px] font-semibold text-[#c78a12] tabular-nums"
                >
                  {t('pages.training.transcript.v7.pause', {
                    seconds: formatSeconds1(row.pauseBefore),
                  })}
                  {pauseEnvironment.length > 0 ? ` · ${pauseEnvironment.join(' · ')}` : ''}
                </div>
              ) : null}
              <V7TurnRow row={row} divergence={divergenceMap.get(row.index)} onSeek={onSeek} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TranscriptV7View
