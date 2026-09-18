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
 * Step B: `review.conclusion` (the 31B «Заключення AI») renders as a
 * collapsible block under the dialogue via TranscriptConclusion — absent on
 * older reviews, strictly optional.
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
import { useCallQaSettings } from '../hooks/useCallQaSettings'
import { useCallTranscript } from '../hooks/useCallTranscript'
import { isV7Transcript } from '../lib/transcriptV7'
import { TranscriptV7View } from './TranscriptV7View'
import { TranscriptConclusion } from './TranscriptConclusion'
import type {
  CallAiReview,
  TranscriptScene,
  TranscriptUtterance,
  TranscriptUtteranceFlag,
} from '../types'
import { piiProps } from '@/lib/openreplay/pii'

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
      ? 'bg-success-50 text-success-700'
      : score >= 60
        ? 'bg-warning-50 text-warning-700'
        : 'bg-error-50 text-error-700'
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
          className="bg-error-50 text-error-700 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
          title={redFlags.map((f) => f.type ?? 'flag').join(', ')}
        >
          {t('pages.training.transcript.redFlags')}: {redFlags.length}
        </span>
      ) : null}
      {fraud.length > 0 ? (
        <span
          data-testid="transcript-fraud-pill"
          className="bg-warning-100 text-warning-800 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
          title={fraud.map((f) => f.type ?? 'fraud').join(', ')}
        >
          {t('pages.training.transcript.fraudSuspicion')}
        </span>
      ) : null}
      {moodEntries.length > 0 ? (
        <span
          data-testid="transcript-mood-pill"
          className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
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
      ? 'bg-secondary text-secondary-foreground'
      : role === 'client'
        ? 'bg-muted text-dark-500'
        : 'bg-transparent text-muted-foreground italic text-center'

  const alignment =
    role === 'operator' ? 'justify-end' : role === 'client' ? 'justify-start' : 'justify-center'

  return (
    <div data-testid={`transcript-utt-${utt.i}`} className={`flex ${alignment}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-snug ${bubbleTone} ${
          hasFlags ? 'ring-error-400 ring-2' : ''
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
        {/* A call transcript is the client speaking — names, addresses and
            everything else, verbatim. Same class as a rendered letter. */}
        <div {...piiProps}>{utt.text}</div>
        {hasFlags ? (
          <div
            data-testid={`transcript-utt-flags-${utt.i}`}
            className="mt-1 flex flex-wrap gap-1"
            title={flags.map(flagLabel).join(', ')}
          >
            {flags.map((flag, i) => (
              <span
                key={i}
                className="bg-error-500/90 rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
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
  // Global admin switch (fail-closed): until settings confirm Call QA is ON,
  // the transcript fetch stays disabled and the panel renders nothing.
  const { data: qaSettings } = useCallQaSettings()
  const qaEnabled = qaSettings?.transcripts_enabled === true
  const { transcript, review, isLoading, notReady, forbidden, disabledByAdmin, isHardError } =
    useCallTranscript(callId, active && canView && qaEnabled && !!callId)
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({})

  // v7 turns render through TranscriptV7View; scene grouping is Ф1-only.
  const v7 = useMemo(() => isV7Transcript(transcript), [transcript])
  const groups = useMemo(
    () =>
      transcript && !v7 ? groupUtterances(transcript.utterances ?? [], transcript.scenes) : [],
    [transcript, v7]
  )

  if (!callId) return null

  // Kill-switch OFF, still loading, or failed to load — no panel, no
  // skeleton, no fetch. The disabledByAdmin arm covers the race where the
  // cached settings said ON but the transcript endpoint already answers
  // 403 call_qa_disabled.
  if (!qaEnabled || disabledByAdmin) return null

  // Server enforces RBAC too — this early-out just avoids a guaranteed 403.
  if (!canView || forbidden) {
    return (
      <div
        data-testid="transcript-no-access"
        className={`border-border bg-muted text-muted-foreground rounded-lg border p-4 text-center text-sm ${className ?? ''}`}
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
        <div className="bg-muted h-4 w-2/3 rounded" />
        <div className="bg-muted h-16 rounded" />
        <div className="bg-muted h-16 rounded" />
      </div>
    )
  }

  if (notReady) {
    return (
      <div
        data-testid="transcript-not-ready"
        className={`border-border bg-muted text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm ${className ?? ''}`}
      >
        {t('pages.training.transcript.notReady')}
      </div>
    )
  }

  if (isHardError || !transcript) {
    return (
      <div
        data-testid="transcript-error"
        className={`border-error-200 bg-error-50 text-error-600 rounded-lg border p-4 text-center text-sm ${className ?? ''}`}
      >
        {t('pages.training.transcript.error')}
      </div>
    )
  }

  // Promise footer: only a real amount (a finite number > 0) is worth showing.
  // A 0 / null / malformed amount renders date + quote alone, never «0 UAH».
  const promise = review?.extracted?.promise ?? null
  const promiseAmount =
    promise &&
    typeof promise.amount === 'number' &&
    Number.isFinite(promise.amount) &&
    promise.amount > 0
      ? promise.amount
      : null

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
              <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium uppercase">
                {transcript.language}
              </span>
            ) : null}
            {review ? <ReviewPills review={review} /> : null}
          </div>
        </div>
        {transcript.summary ? (
          <p data-testid="transcript-summary" className="text-foreground text-sm leading-snug">
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
                  isPromise ? 'border-primary-300 bg-primary-300/10' : 'border-border bg-card'
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
                    className={`text-muted-foreground transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
                  />
                </button>
                {isCollapsed ? null : body}
              </section>
            )
          })}
        </div>
      )}

      {/* 31B conclusion (step B): «звідки такий бал» — renders only when
          review.conclusion carries something; older reviews show nothing. */}
      <TranscriptConclusion
        review={review}
        utterances={transcript.utterances ?? []}
        onSeek={onSeek}
      />

      {/* Footer: promise + recommendations (review-only, Ф2 data).
          Amount renders only when it's a real positive number — 0/null means
          «сума не прозвучала» (CEO 08.07: «0 UAH» в обіцянці показывать нельзя;
          мозг с prompt 1.1 шлёт null, но старые ревью несут 0). */}
      {promise && (promiseAmount != null || promise.date) ? (
        <div
          data-testid="transcript-promise"
          className="border-primary-300 bg-primary-300/15 rounded-lg border p-3 text-sm"
        >
          <div className="text-dark-500 font-medium">
            {t('pages.training.transcript.promiseTitle')}
          </div>
          <div className="text-foreground">
            {promiseAmount != null ? `${promiseAmount} ${promise.currency ?? ''}`.trim() : null}
            {promiseAmount != null && promise.date ? ' — ' : null}
            {promise.date ?? null}
          </div>
          {promise.quote ? (
            <div className="text-muted-foreground mt-1 text-xs">«{promise.quote}»</div>
          ) : null}
        </div>
      ) : null}

      {review?.recommendations && review.recommendations.length > 0 ? (
        <div data-testid="transcript-recommendations" className="flex flex-col gap-1">
          <div className="text-dark-500 text-xs font-semibold tracking-wide uppercase">
            {t('pages.training.transcript.recommendations')}
          </div>
          <ul className="text-foreground list-disc space-y-0.5 pl-5 text-sm">
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
