/**
 * TranscriptV7View — detailed two-sided rendering of the v7 turn format
 * (FORMAT_SPEC approved by CEO): stats header with talk balance, key-moments
 * digest for the supervisor, and a client-left / operator-right feed with
 * silence chips, overlap badges, QA tag badges and the other side's inline
 * reactions woven into the bubble text at their proportional time position.
 *
 * Light theme only — matches the rest of the quality feature (the CRM has no
 * theme toggle; sporadic `dark:` variants elsewhere are not wired here).
 *
 * TOLERANT READER: tag kinds are an open set (unknown → grey), `bc` accepts
 * object and tuple encodings, missing stats hide their chips — never crash.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { DATETIME_DISPLAY_FORMAT } from '@/lib/dateUtils'
import type { CallTranscript, TranscriptStats } from '../types'
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
}: {
  transcript: CallTranscript
  stats: TranscriptStats | null
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

  const hasMeta = answeredLabel || durationLabel || transcript.agent_extension || directionLabel
  const hasChips = silenceTotal != null || overlapTotal != null || nTurns != null
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
        </div>
      ) : null}
    </div>
  )
}

function V7KeyMoments({
  moments,
  onSeek,
}: {
  moments: KeyMoment[]
  onSeek?: (ms: number) => void
}) {
  const { t } = useTranslation('common')
  if (moments.length === 0) return null
  return (
    <div
      data-testid="transcript-v7-keymoments"
      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-left"
    >
      <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
        {t('pages.training.transcript.v7.keyMoments')}
      </div>
      <ul className="flex flex-col gap-0.5">
        {moments.map((moment) => (
          <li key={moment.index}>
            <button
              type="button"
              data-testid={`transcript-v7-moment-${moment.index}`}
              className="flex w-full items-baseline gap-2 rounded px-1 py-0.5 text-left text-sm hover:bg-gray-50"
              onClick={() => onSeek?.(Math.round(moment.t0 * 1000))}
              title={t('pages.training.transcript.seekTo')}
            >
              <span className="font-mono text-[11px] text-gray-400 tabular-nums">
                {formatClock(moment.t0)}
              </span>
              <QaTagBadge kind={moment.tag.kind} label={moment.tag.label} />
              <span className="min-w-0 truncate text-gray-700">«{moment.quote}»</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function V7TurnRow({ row, onSeek }: { row: V7Row; onSeek?: (ms: number) => void }) {
  const { t } = useTranslation('common')
  const roleKey = roleKeyOf(row.turn.role)
  const styles = ROLE_STYLES[roleKey]

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
            ⤭ {t('pages.training.transcript.v7.overlap')}
          </span>
        ) : null}
        {row.tag ? (
          <QaTagBadge
            kind={row.tag.kind}
            label={row.tag.label}
            testId={`transcript-v7-tag-${row.index}`}
          />
        ) : null}
      </div>
      <div
        className={`text-dark-500 rounded-xl border px-3 py-2 text-sm leading-relaxed ${styles.bubble}`}
      >
        {row.segments.map((segment, i) => {
          if (segment.kind === 'text') {
            return <span key={i}>{segment.text} </span>
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

  return (
    <div className="flex flex-col gap-2">
      <V7StatsHeader transcript={transcript} stats={stats} />
      <V7KeyMoments moments={moments} onSeek={onSeek} />
      <div data-testid="transcript-v7-feed" className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.index} className="contents">
            {row.pauseBefore != null ? (
              <div
                data-testid={`transcript-v7-pause-${row.index}`}
                className="self-center rounded-full border border-dashed border-[#c78a12]/45 bg-[#c78a12]/10 px-3 py-0.5 text-[11px] font-semibold text-[#c78a12] tabular-nums"
              >
                ⏸{' '}
                {t('pages.training.transcript.v7.pause', {
                  seconds: formatSeconds1(row.pauseBefore),
                })}
              </div>
            ) : null}
            <V7TurnRow row={row} onSeek={onSeek} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default TranscriptV7View
