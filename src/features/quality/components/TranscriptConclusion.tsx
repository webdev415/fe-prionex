/**
 * TranscriptConclusion — the 31B «Заключення AI» block under the dialogue
 * feed (step B): answers the CEO's «звідки такий бал» right in the call
 * card. Collapsible section styled like the Ф1 scene sections.
 *
 * BUSINESS STYLE (per the #708 pass): no emoji, text badges only. Contents,
 * each part optional: grade badge + score + one-liner, «чому такий бал»
 * (justification + рубрика → корекція → бал line), strengths/weaknesses
 * columns, key findings, «тон ≠ слова» divergences (only when the call is
 * flagged inconsistent), prioritised recommendations, and a muted meta line
 * (confidence · model · prompt version + limitations).
 *
 * Free 31B text may anchor claims as «utt N» — those render as seek buttons
 * when N points at a rendered utterance, and stay plain text otherwise.
 *
 * TOLERANT READER: older reviews carry no conclusion → the block renders
 * nothing; malformed shapes never crash (normalisation in
 * lib/transcriptConclusion.ts).
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import type { CallAiReview, TranscriptUtterance } from '../types'
import { formatScore } from '../lib/transcriptAudio'
import {
  formatAdjustment,
  formatConfidence,
  KNOWN_LIMITATIONS,
  normalizeConclusion,
  splitUttReferences,
} from '../lib/transcriptConclusion'

export interface TranscriptConclusionProps {
  review: CallAiReview | null | undefined
  /** Rendered feed — `utt N` references resolve to these turns' t0. */
  utterances: TranscriptUtterance[]
  /** Seek the call player, milliseconds (same contract as the panel). */
  onSeek?: (ms: number) => void
}

// Same semantic tones as ScorePill; unknown grades stay neutral grey.
const GRADE_TONES: Record<string, string> = {
  green: 'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red: 'bg-red-100 text-red-700',
}

function gradeTone(grade: string | null, score: number | null): string {
  if (grade && GRADE_TONES[grade]) return GRADE_TONES[grade]
  if (score != null) {
    // ScorePill thresholds: green ≥80 / yellow ≥60 / red <60.
    return score >= 80 ? GRADE_TONES.green : score >= 60 ? GRADE_TONES.yellow : GRADE_TONES.red
  }
  return 'bg-gray-100 text-gray-700'
}

/** Free text with `utt N` anchors turned into player-seek buttons. */
function UttText({
  text,
  utterances,
  onSeek,
}: {
  text: string
  utterances: TranscriptUtterance[]
  onSeek?: (ms: number) => void
}) {
  const { t } = useTranslation('common')
  const segments = useMemo(() => splitUttReferences(text), [text])
  return (
    <>
      {segments.map((segment, i) => {
        if (segment.kind === 'text') return <span key={i}>{segment.text}</span>
        const target = utterances[segment.utt]
        const t0 = typeof target?.t0 === 'number' && Number.isFinite(target.t0) ? target.t0 : null
        if (t0 == null) {
          // Reference outside the rendered feed — keep it as plain text.
          return <span key={i}>{segment.label}</span>
        }
        return (
          <button
            key={i}
            type="button"
            data-testid={`transcript-conclusion-utt-${segment.utt}`}
            className="font-mono text-gray-500 tabular-nums underline decoration-dotted underline-offset-2 hover:text-gray-700"
            onClick={() => onSeek?.(Math.round(t0 * 1000))}
            title={t('pages.training.transcript.seekTo')}
          >
            {segment.label}
          </button>
        )
      })}
    </>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
      {children}
    </div>
  )
}

export function TranscriptConclusion({ review, utterances, onSeek }: TranscriptConclusionProps) {
  const { t } = useTranslation('common')
  const [collapsed, setCollapsed] = useState(false)
  const conclusion = useMemo(() => normalizeConclusion(review), [review])
  if (!conclusion) return null

  const showCalc =
    conclusion.rubricScoreInput != null &&
    conclusion.adjustment != null &&
    conclusion.assessmentScore != null
  const showWhy = conclusion.justification != null || showCalc
  const priorityLabel = (priority: string): string =>
    priority === 'high' || priority === 'normal'
      ? t(`pages.training.transcript.v7.conclusion.priority.${priority}`)
      : priority // open set — unknown priorities render as-is
  const metaParts = [
    conclusion.confidenceOverall != null
      ? t('pages.training.transcript.v7.conclusion.confidence', {
          value: formatConfidence(conclusion.confidenceOverall),
        })
      : null,
    conclusion.model,
    conclusion.promptVersion != null ? `v${conclusion.promptVersion}` : null,
  ].filter((part): part is string => part != null)

  return (
    <section
      data-testid="transcript-conclusion"
      className="rounded-lg border border-gray-200 bg-white text-left"
    >
      <button
        type="button"
        data-testid="transcript-conclusion-toggle"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-expanded={!collapsed}
      >
        <span className="text-dark-500 text-xs font-semibold tracking-wide uppercase">
          {t('pages.training.transcript.v7.conclusion.title')}
        </span>
        <span className="flex items-center gap-2">
          {conclusion.grade != null || conclusion.score != null ? (
            <span
              data-testid="transcript-conclusion-grade"
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${gradeTone(
                conclusion.grade,
                conclusion.score
              )}`}
            >
              {conclusion.score != null ? `${formatScore(conclusion.score)}/100` : conclusion.grade}
            </span>
          ) : null}
          <Icons.ArrowDown
            size={14}
            className={`text-gray-400 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          />
        </span>
      </button>

      {collapsed ? null : (
        <div className="flex flex-col gap-3 px-3 pb-3">
          {conclusion.oneLiner ? (
            <p
              data-testid="transcript-conclusion-oneliner"
              className="text-dark-500 text-sm leading-snug font-medium"
            >
              {conclusion.oneLiner}
            </p>
          ) : null}

          {showWhy ? (
            <div className="flex flex-col gap-1">
              <SectionTitle>{t('pages.training.transcript.v7.conclusion.whyTitle')}</SectionTitle>
              {showCalc ? (
                <div
                  data-testid="transcript-conclusion-calc"
                  className="text-xs font-medium text-gray-600 tabular-nums"
                >
                  {t('pages.training.transcript.v7.conclusion.calc', {
                    rubric: formatScore(conclusion.rubricScoreInput as number),
                    adjustment: formatAdjustment(conclusion.adjustment as number),
                    score: formatScore(conclusion.assessmentScore as number),
                  })}
                  {conclusion.adjustment !== 0 && conclusion.adjustmentReason ? (
                    <span className="font-normal text-gray-500">
                      {' '}
                      — {conclusion.adjustmentReason}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {conclusion.justification ? (
                <p
                  data-testid="transcript-conclusion-justification"
                  className="text-sm leading-snug text-gray-700"
                >
                  {conclusion.justification}
                </p>
              ) : null}
            </div>
          ) : null}

          {conclusion.strengths.length > 0 || conclusion.weaknesses.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {conclusion.strengths.length > 0 ? (
                <div data-testid="transcript-conclusion-strengths" className="flex flex-col gap-1">
                  <SectionTitle>
                    {t('pages.training.transcript.v7.conclusion.strengths')}
                  </SectionTitle>
                  <ul className="list-disc space-y-0.5 pl-5 text-sm text-gray-700">
                    {conclusion.strengths.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {conclusion.weaknesses.length > 0 ? (
                <div data-testid="transcript-conclusion-weaknesses" className="flex flex-col gap-1">
                  <SectionTitle>
                    {t('pages.training.transcript.v7.conclusion.weaknesses')}
                  </SectionTitle>
                  <ul className="list-disc space-y-0.5 pl-5 text-sm text-gray-700">
                    {conclusion.weaknesses.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {conclusion.keyFindings.length > 0 ? (
            <div data-testid="transcript-conclusion-findings" className="flex flex-col gap-1">
              <SectionTitle>
                {t('pages.training.transcript.v7.conclusion.keyFindings')}
              </SectionTitle>
              <ul className="list-disc space-y-0.5 pl-5 text-sm text-gray-700">
                {conclusion.keyFindings.map((finding, i) => (
                  <li key={i}>
                    <UttText text={finding} utterances={utterances} onSeek={onSeek} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {conclusion.divergences.length > 0 ? (
            <div data-testid="transcript-conclusion-tone" className="flex flex-col gap-1">
              <SectionTitle>{t('pages.training.transcript.v7.audio.toneVsWords')}</SectionTitle>
              <ul className="flex flex-col gap-0.5 text-sm text-gray-700">
                {conclusion.divergences.map((divergence, i) => (
                  <li key={i} data-testid={`transcript-conclusion-divergence-${i}`}>
                    {divergence.utt != null ? (
                      <>
                        <UttText
                          text={`utt ${divergence.utt}`}
                          utterances={utterances}
                          onSeek={onSeek}
                        />
                        {': '}
                      </>
                    ) : null}
                    {t('pages.training.transcript.v7.conclusion.said')} «{divergence.said}» —{' '}
                    {t('pages.training.transcript.v7.conclusion.sounded')} «{divergence.sounded}»
                    {divergence.interpretation ? (
                      <span className="text-gray-500"> · {divergence.interpretation}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {conclusion.recommendations.length > 0 ? (
            <div
              data-testid="transcript-conclusion-recommendations"
              className="flex flex-col gap-1"
            >
              <SectionTitle>{t('pages.training.transcript.recommendations')}</SectionTitle>
              <ul className="list-disc space-y-0.5 pl-5 text-sm text-gray-700">
                {conclusion.recommendations.map((rec, i) => (
                  <li key={i} data-testid={`transcript-conclusion-rec-${i}`}>
                    {rec.priority ? (
                      <span
                        className={`mr-1.5 text-[10px] font-semibold uppercase ${
                          rec.priority === 'high' ? 'text-[#c8492f]' : 'text-gray-400'
                        }`}
                      >
                        {priorityLabel(rec.priority)}
                      </span>
                    ) : null}
                    {rec.text}
                    {rec.evidence ? (
                      <span className="text-gray-500">
                        {' '}
                        (<UttText text={rec.evidence} utterances={utterances} onSeek={onSeek} />)
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {metaParts.length > 0 || conclusion.limitedBy.length > 0 ? (
            <div
              data-testid="transcript-conclusion-meta"
              className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-400"
            >
              {metaParts.length > 0 ? <span>{metaParts.join(' · ')}</span> : null}
              {conclusion.limitedBy.length > 0 ? (
                <span data-testid="transcript-conclusion-limitations">
                  {t('pages.training.transcript.v7.conclusion.limitedBy', {
                    list: conclusion.limitedBy
                      .map((limitation) =>
                        KNOWN_LIMITATIONS.has(limitation)
                          ? t(`pages.training.transcript.v7.conclusion.limitations.${limitation}`)
                          : limitation
                      )
                      .join(', '),
                  })}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}

export default TranscriptConclusion
