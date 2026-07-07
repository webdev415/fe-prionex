/**
 * CallTranscriptPanel — AI transcript of one call (Ф1 scenes / v7 turns).
 *
 * One shared component for both flows (client card modal now; Training →
 * Оцінка діалогів joins in Ф2). Renders the nightly-brain transcript:
 * summary header, collapsible scene sections, chat-layout utterances with
 * seek-to-timestamp buttons wired to the existing CallPlayer handle.
 *
 * v7 (FORMAT_SPEC): transcripts whose turns carry `dur` (or that ship
 * `metrics.stats`) render through TranscriptV7View — stats header, key
 * moments, two-sided feed with pauses/overlaps/inline reactions/QA tags.
 * Ф1-format transcripts keep the legacy scene renderer below unchanged.
 *
 * Ф1 reality: `review` is null (Проход 2 ships in Ф2) — every review-derived
 * pill/footer renders only when the data is present, so the panel degrades
 * to summary + dialogue.
 *
 * TOLERANT READER (CALL_QA_INTEGRATION.md §3.1): `scenes[].key`, utterance
 * `flags[].type` and review enums are OPEN sets — unknown values get a
 * fallback label and must never crash the panel.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useHasPermission } from '@/hooks'
import { PERMISSIONS } from '@/constants/permissions'
import { Icons } from '@/lib/icons'
import { useCallTranscript } from '../hooks/useCallTranscript'
import { isV7Transcript } from '../lib/transcriptV7'
import { TranscriptV7View } from './TranscriptV7View'
import type {
  CallAiReview,
  TranscriptScene,
  TranscriptUtterance,
  TranscriptUtteranceFlag,
} from '../types'

export interface CallTranscriptPanelProps {
  callId?: string | null
  /** Fetch gate — pass the modal `open` flag so closed modals fetch nothing. */
  active?: boolean
  /** Seek the call player, milliseconds (CallPlayer/CallRecordingModal handle). */
  onSeek?: (ms: number) => void
  className?: string
}

/** Scene keys with dedicated i18n labels (§5.4). Open set — others fall back. */
const KNOWN_SCENES = new Set([
  'greeting',
  'identification',
  'debt_discussion',
  'objection_handling',
  'negotiation',
  'promise',
  'escalation',
  'closing',
  'other',
])

function formatTimecode(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const mm = Math.floor(total / 60)
  const ss = String(total % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function flagLabel(flag: TranscriptUtteranceFlag): string {
  if (typeof flag === 'string') return flag
  return flag?.type ?? 'flag'
}

interface SceneGroup {
  /** null → utterances not covered by any scene (rendered as «Інше»). */
  sceneKey: string | null
  utterances: TranscriptUtterance[]
}

/**
 * Group utterances into ordered scene sections. Scene ranges reference
 * utterance indices (`from_utt`..`to_utt`); anything not covered lands in a
 * `null` gap group so no replica is ever dropped.
 */
function groupUtterances(
  utterances: TranscriptUtterance[],
  scenes: TranscriptScene[] | null | undefined
): SceneGroup[] {
  const list = scenes ?? []
  const groups: SceneGroup[] = []
  let current: SceneGroup | null = null

  utterances.forEach((utt, index) => {
    const idx = typeof utt.i === 'number' ? utt.i : index
    const scene = list.find((s) => idx >= s.from_utt && idx <= s.to_utt)
    const key = scene ? scene.key : null
    if (!current || current.sceneKey !== key) {
      current = { sceneKey: key, utterances: [] }
      groups.push(current)
    }
    current.utterances.push(utt)
  })

  return groups
}

function ScorePill({ score }: { score: number }) {
  // Thresholds mirror scorecard categories: green ≥80 / yellow ≥60 / red <60.
  const tone =
    score >= 80
      ? 'bg-green-100 text-green-800'
      : score >= 60
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-red-100 text-red-700'
  return (
    <span
      data-testid="transcript-score-pill"
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}
    >
      AI {Math.round(score)}/100
    </span>
  )
}

function ReviewPills({ review }: { review: CallAiReview }) {
  const { t } = useTranslation('common')
  const redFlags = review.red_flags ?? []
  const fraud = review.fraud ?? []
  const moodOperator = review.mood?.operator ?? null
  const moodEntries = moodOperator
    ? Object.entries(moodOperator).filter(([, v]) => typeof v === 'number')
    : []

  return (
    <>
      {typeof review.weighted_score === 'number' ? (
        <ScorePill score={review.weighted_score} />
      ) : null}
      {redFlags.length > 0 ? (
        <span
          data-testid="transcript-flags-pill"
          className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700"
          title={redFlags.map((f) => f.type ?? 'flag').join(', ')}
        >
          {t('pages.training.transcript.redFlags')}: {redFlags.length}
        </span>
      ) : null}
      {fraud.length > 0 ? (
        <span
          data-testid="transcript-fraud-pill"
          className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800"
          title={fraud.map((f) => f.type ?? 'fraud').join(', ')}
        >
          {t('pages.training.transcript.fraudSuspicion')}
        </span>
      ) : null}
      {moodEntries.length > 0 ? (
        <span
          data-testid="transcript-mood-pill"
          className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
          title={moodEntries.map(([k, v]) => `${k}: ${String(v)}/5`).join(', ')}
        >
          {t('pages.training.transcript.moodOperator')}
        </span>
      ) : null}
    </>
  )
}

function UtteranceRow({
  utt,
  onSeek,
}: {
  utt: TranscriptUtterance
  onSeek?: (ms: number) => void
}) {
  const { t } = useTranslation('common')
  const role = utt.role === 'operator' || utt.role === 'client' ? utt.role : 'other'
  const flags = utt.flags ?? []
  const hasFlags = flags.length > 0

  const bubbleTone =
    role === 'operator'
      ? 'bg-[#204E4D] text-white'
      : role === 'client'
        ? 'bg-gray-100 text-dark-500'
        : 'bg-transparent text-gray-500 italic text-center'

  const alignment =
    role === 'operator' ? 'justify-end' : role === 'client' ? 'justify-start' : 'justify-center'

  return (
    <div data-testid={`transcript-utt-${utt.i}`} className={`flex ${alignment}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-snug ${bubbleTone} ${
          hasFlags ? 'ring-2 ring-red-400' : ''
        }`}
      >
        <div className="mb-0.5 flex items-center gap-2 text-[11px] opacity-70">
          <span>{t(`pages.training.transcript.roles.${role}`)}</span>
          <button
            type="button"
            data-testid={`transcript-seek-${utt.i}`}
            className="font-mono underline decoration-dotted underline-offset-2 hover:opacity-100"
            onClick={() => onSeek?.(Math.round(utt.t0 * 1000))}
            title={t('pages.training.transcript.seekTo')}
          >
            {formatTimecode(utt.t0)}
          </button>
          {typeof utt.conf === 'number' && utt.conf < 0.6 ? (
            <span className="opacity-60">~{Math.round(utt.conf * 100)}%</span>
          ) : null}
        </div>
        <div>{utt.text}</div>
        {hasFlags ? (
          <div
            data-testid={`transcript-utt-flags-${utt.i}`}
            className="mt-1 flex flex-wrap gap-1"
            title={flags.map(flagLabel).join(', ')}
          >
            {flags.map((flag, i) => (
              <span
                key={i}
                className="rounded bg-red-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white"
              >
                {flagLabel(flag)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function CallTranscriptPanel({
  callId,
  active = true,
  onSeek,
  className,
}: CallTranscriptPanelProps) {
  const { t } = useTranslation('common')
  const canView = useHasPermission(PERMISSIONS.TRAINING.VIEW_TRANSCRIPTS)
  const { transcript, review, isLoading, notReady, forbidden, isHardError } = useCallTranscript(
    callId,
    active && canView && !!callId
  )
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({})

  // v7 turns render through TranscriptV7View; scene grouping is Ф1-only.
  const v7 = useMemo(() => isV7Transcript(transcript), [transcript])
  const groups = useMemo(
    () =>
      transcript && !v7 ? groupUtterances(transcript.utterances ?? [], transcript.scenes) : [],
    [transcript, v7]
  )

  if (!callId) return null

  // Server enforces RBAC too — this early-out just avoids a guaranteed 403.
  if (!canView || forbidden) {
    return (
      <div
        data-testid="transcript-no-access"
        className={`rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500 ${className ?? ''}`}
      >
        {t('pages.training.transcript.noAccess')}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        data-testid="transcript-skeleton"
        className={`animate-pulse space-y-2 ${className ?? ''}`}
      >
        <div className="h-4 w-2/3 rounded bg-gray-200" />
        <div className="h-16 rounded bg-gray-100" />
        <div className="h-16 rounded bg-gray-100" />
      </div>
    )
  }

  if (notReady) {
    return (
      <div
        data-testid="transcript-not-ready"
        className={`rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500 ${className ?? ''}`}
      >
        {t('pages.training.transcript.notReady')}
      </div>
    )
  }

  if (isHardError || !transcript) {
    return (
      <div
        data-testid="transcript-error"
        className={`rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-600 ${className ?? ''}`}
      >
        {t('pages.training.transcript.error')}
      </div>
    )
  }

  return (
    <div
      data-testid="transcript-panel"
      className={`flex flex-col gap-3 text-left ${className ?? ''}`}
    >
      {/* Header: summary + pills */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-dark-500 text-sm font-medium">
            {t('pages.training.transcript.title')}
          </h3>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {transcript.language ? (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 uppercase">
                {transcript.language}
              </span>
            ) : null}
            {review ? <ReviewPills review={review} /> : null}
          </div>
        </div>
        {transcript.summary ? (
          <p data-testid="transcript-summary" className="text-sm leading-snug text-gray-700">
            {transcript.summary}
          </p>
        ) : null}
      </div>

      {/* Dialogue: v7 detailed feed, or Ф1 scene sections */}
      {v7 ? (
        <TranscriptV7View transcript={transcript} onSeek={onSeek} />
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((group, index) => {
            const sceneKey = group.sceneKey
            const isPromise = sceneKey === 'promise'
            const isCollapsed = collapsed[index] === true
            const label =
              sceneKey == null
                ? t('pages.training.scenes.other')
                : KNOWN_SCENES.has(sceneKey)
                  ? t(`pages.training.scenes.${sceneKey}`)
                  : sceneKey // open enum — unknown keys render as-is

            const body = (
              <div className="flex flex-col gap-1.5 px-3 pb-3">
                {group.utterances.map((utt) => (
                  <UtteranceRow key={utt.i} utt={utt} onSeek={onSeek} />
                ))}
              </div>
            )

            // No scenes at all → flat dialogue without section chrome.
            if (sceneKey == null && (transcript.scenes ?? []).length === 0) {
              return (
                <div key={index} className="flex flex-col gap-1.5">
                  {group.utterances.map((utt) => (
                    <UtteranceRow key={utt.i} utt={utt} onSeek={onSeek} />
                  ))}
                </div>
              )
            }

            return (
              <section
                key={index}
                data-testid={`transcript-scene-${index}`}
                className={`rounded-lg border ${
                  isPromise ? 'border-[#BBFB5B] bg-[#BBFB5B]/10' : 'border-gray-200 bg-white'
                }`}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left"
                  onClick={() => setCollapsed((prev) => ({ ...prev, [index]: !isCollapsed }))}
                  aria-expanded={!isCollapsed}
                >
                  <span className="text-dark-500 text-xs font-semibold tracking-wide uppercase">
                    {label}
                  </span>
                  <Icons.ArrowDown
                    size={14}
                    className={`text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                  />
                </button>
                {isCollapsed ? null : body}
              </section>
            )
          })}
        </div>
      )}

      {/* Footer: promise + recommendations (review-only, Ф2 data) */}
      {review?.extracted?.promise &&
      (review.extracted.promise.amount != null || review.extracted.promise.date) ? (
        <div
          data-testid="transcript-promise"
          className="rounded-lg border border-[#BBFB5B] bg-[#BBFB5B]/15 p-3 text-sm"
        >
          <div className="text-dark-500 font-medium">
            {t('pages.training.transcript.promiseTitle')}
          </div>
          <div className="text-gray-700">
            {review.extracted.promise.amount != null
              ? `${review.extracted.promise.amount} ${review.extracted.promise.currency ?? ''}`.trim()
              : null}
            {review.extracted.promise.amount != null && review.extracted.promise.date
              ? ' — '
              : null}
            {review.extracted.promise.date ?? null}
          </div>
          {review.extracted.promise.quote ? (
            <div className="mt-1 text-xs text-gray-500">«{review.extracted.promise.quote}»</div>
          ) : null}
        </div>
      ) : null}

      {review?.recommendations && review.recommendations.length > 0 ? (
        <div data-testid="transcript-recommendations" className="flex flex-col gap-1">
          <div className="text-dark-500 text-xs font-semibold tracking-wide uppercase">
            {t('pages.training.transcript.recommendations')}
          </div>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-gray-700">
            {review.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export default CallTranscriptPanel
