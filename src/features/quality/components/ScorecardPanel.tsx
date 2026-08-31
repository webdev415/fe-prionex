/**
 * ScorecardPanel — the scorecard editor for one call.
 *
 * A call has at most one scorecard, so an existing card is always opened
 * (whatever its status) and the create picker only appears when there is none,
 * or when the trainer explicitly switches the scorecard type (which clears the
 * scores). Renders the template with collapsible sections, per-criterion inputs
 * (binary toggle or 0..5 buttons), comment fields and a status indicator.
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'
import { useScorecardDraft } from '../hooks/useScorecardDraft'
import {
  useScorecard,
  useScorecardHistoryForCall,
  useCreateScorecard,
  useSendScorecard,
  useUpdateScorecard,
} from '../hooks/useScorecards'
import { useTemplates } from '../hooks/useTemplates'
import { isDisputeReasonRequested, resolveDisputeThreshold } from '../lib/dispute'
import { computeWeightedScorePreview } from '../lib/scoringPreview'
import { normalizeCriterionScale } from '../types'
import type { Criterion, Section } from '../types'
import { ScoreDivergenceBadge } from './ScoreDivergenceBadge'

const SCRIPT_STAGES_SECTION_KEY = 'script_stages'

interface ScorecardPanelProps {
  callId: string
  operatorId: number
  /** When set, the panel opens that scorecard rather than the latest draft. */
  scorecardId?: number | null
  /** Assignment-based write gate. When provided it fully governs edit rights at
   *  any status (the trainer may edit + re-send). When omitted, the legacy
   *  originating-trainer + draft-only gate applies. */
  canEdit?: boolean
  /** Callback after the trainer presses "Send to operator". */
  onSent?: (scorecardId: number) => void
  /** Emits the unsaved-changes state so the parent can warn on close. */
  onDirtyChange?: (dirty: boolean) => void
}

export function ScorecardPanel({
  callId,
  operatorId,
  scorecardId: pinnedScorecardId,
  canEdit: canEditProp,
  onSent,
  onDirtyChange,
}: ScorecardPanelProps) {
  const { t } = useTranslation('common')
  const templatesQuery = useTemplates(false)
  const historyQuery = useScorecardHistoryForCall(callId)

  const [manuallySelectedId, setManuallySelectedId] = useState<number | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [showTemplateOverride, setShowTemplateOverride] = useState(false)
  const [forcePicker, setForcePicker] = useState(false)
  const existingScorecardId = historyQuery.data?.[0]?.id ?? null
  const activeScorecardId = pinnedScorecardId ?? manuallySelectedId ?? existingScorecardId ?? null
  const isChangingType = forcePicker && existingScorecardId != null
  const activeQuery = useScorecard(activeScorecardId, activeScorecardId != null)
  const createMutation = useCreateScorecard()
  const updateMutation = useUpdateScorecard()
  const sendMutation = useSendScorecard()

  const activeScorecard = activeQuery.data
  const sections: Section[] = useMemo(() => {
    if (activeScorecard?.template_snapshot.sections) {
      return activeScorecard.template_snapshot.sections
    }
    const picked = templatesQuery.data?.find((tpl) => tpl.id === selectedTemplateId)
    return picked?.sections ?? []
  }, [activeScorecard, templatesQuery.data, selectedTemplateId])

  const totalWeight = useMemo(
    () =>
      sections.reduce(
        (sum, s) =>
          sum + s.criteria.reduce((a, c) => a + (Number(c.weight) > 0 ? Number(c.weight) : 0), 0),
        0
      ),
    [sections]
  )

  const draftState = useMemo(() => {
    if (!activeScorecard) return null
    return {
      scores: activeScorecard.scores,
      overall_comment: activeScorecard.overall_comment ?? '',
      dispute_reason: activeScorecard.dispute_reason ?? '',
    }
  }, [activeScorecard])

  const draft = useScorecardDraft({
    scorecardId: activeScorecardId,
    initial: draftState,
    enabled: false,
    flushOnUnmount: false,
  })

  useEffect(() => {
    onDirtyChange?.(draft.isDirty)
  }, [draft.isDirty, onDirtyChange])

  const livePreview = useMemo(
    () => computeWeightedScorePreview(sections, draft.scores),
    [sections, draft.scores]
  )

  // Both scores on the 0-100 display axis. The trainer's side prefers the live
  // preview over the API's `trainer_score_100` so the comparison tracks what
  // they are typing; the served number is the fallback for when the template
  // sections haven't loaded and nothing can be previewed yet.
  const trainerScore100 =
    livePreview != null ? livePreview * 20 : (activeScorecard?.trainer_score_100 ?? null)
  const aiScore100 = activeScorecard?.ai_weighted_score ?? null
  const disputeThreshold = resolveDisputeThreshold(activeScorecard)
  // Below the threshold this is two readers rounding the same checklist
  // differently — not worth a field. Kept visible once written, whatever the
  // current gap, so an existing objection can never be stranded off-screen.
  const showDisputeReason =
    isDisputeReasonRequested(aiScore100, trainerScore100, disputeThreshold) ||
    draft.disputeReason.trim().length > 0

  const { requiredCount, scoredCount } = useMemo(() => {
    let req = 0
    let scored = 0
    for (const section of sections) {
      for (const c of section.criteria) {
        if (Number(c.weight) > 0) {
          req += 1
          if (draft.scores[c.key]?.value != null) scored += 1
        }
      }
    }
    return { requiredCount: req, scoredCount: scored }
  }, [sections, draft.scores])
  const isComplete = requiredCount > 0 && scoredCount === requiredCount
  const typedTemplates = useMemo(
    () => ({
      client: templatesQuery.data?.find((tpl) => tpl.scorecard_type === 'client') ?? null,
      third_party: templatesQuery.data?.find((tpl) => tpl.scorecard_type === 'third_party') ?? null,
    }),
    [templatesQuery.data]
  )

  const [locked, setLocked] = useState(false)
  const status = activeScorecard?.status ?? 'draft'
  const currentUserId = useAuthStore((s) => s.user?.id)
  const isOriginatingTrainer =
    activeScorecard != null &&
    currentUserId != null &&
    Number(currentUserId) === activeScorecard.trainer_id
  // Assignment-based gate (new model) governs editing at any status; the backend
  // enforces the same rule with a 403. Legacy callers fall back to
  // originating-trainer + draft-only.
  const canEdit =
    canEditProp != null
      ? canEditProp && !locked
      : status === 'draft' && !locked && isOriginatingTrainer

  const handleSaveDraft = async () => {
    await draft.flush()
    setLocked(true)
  }

  const handleClear = () => {
    if (!activeScorecard) return
    draft.reset({
      scores: activeScorecard.scores,
      overall_comment: activeScorecard.overall_comment ?? '',
      dispute_reason: activeScorecard.dispute_reason ?? '',
    })
  }

  const handleStartNew = async () => {
    if (!selectedTemplateId || canEditProp === false) return
    const created = await createMutation.mutateAsync({
      call_id: callId,
      operator_id: operatorId,
      template_id: selectedTemplateId,
      status: 'draft',
    })
    setManuallySelectedId(created.id)
    setForcePicker(false)
  }

  const handleMarkCompleted = async () => {
    if (!activeScorecardId) return
    try {
      await draft.flush()
      await updateMutation.mutateAsync({
        scorecardId: activeScorecardId,
        payload: { status: 'completed' },
      })
    } catch {
      toast.error(
        t('pages.training.scorecard.completeIncomplete', 'Score every criterion before completing.')
      )
    }
  }

  const handleSend = async () => {
    if (!activeScorecardId) return
    const sent = await sendMutation.mutateAsync(activeScorecardId)
    onSent?.(sent.id)
  }

  // ---- Render branches ----
  if (!activeScorecardId || forcePicker) {
    // Never offer a create action the caller isn't allowed to perform — the
    // backend rejects it with a 403.
    if (canEditProp === false) {
      return (
        <aside className="bg-card flex h-full flex-col gap-3 rounded-xl p-4 shadow-sm">
          <h2 className="text-dark-500 text-lg font-medium">
            {t('pages.training.scorecard.title', 'Quality evaluation')}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t(
              'pages.training.scorecard.notAssigned',
              'This operator is not assigned to you, so you cannot score this call.'
            )}
          </p>
        </aside>
      )
    }

    return (
      <aside className="bg-card flex h-full flex-col gap-3 rounded-xl p-4 shadow-sm">
        <h2 className="text-dark-500 text-lg font-medium">
          {t('pages.training.scorecard.title', 'Quality evaluation')}
        </h2>

        {isChangingType ? (
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
            {t(
              'pages.training.scorecard.changeTypeWarning',
              'Changing the type replaces the criteria — the current scores will be cleared.'
            )}
          </div>
        ) : null}

        <label className="text-foreground text-sm font-medium">
          {t('pages.training.scorecard.scorecardType', 'Scorecard type')}
        </label>
        <div className="flex gap-2">
          {(['client', 'third_party'] as const).map((type) => {
            const tpl = typedTemplates[type]
            const selected = tpl != null && selectedTemplateId === tpl.id
            return (
              <button
                key={type}
                type="button"
                disabled={!tpl}
                onClick={() => tpl && setSelectedTemplateId(tpl.id)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  selected
                    ? 'border-primary-500 bg-primary-500 text-white'
                    : 'border-border bg-card text-foreground hover:border-muted-foreground/40'
                }`}
              >
                {type === 'client'
                  ? t('pages.training.scorecard.type.client', 'Client Dialogue')
                  : t('pages.training.scorecard.type.thirdParty', 'Third Party Dialogue')}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowTemplateOverride((v) => !v)}
          className="text-muted-foreground hover:text-foreground self-start text-xs underline-offset-2 hover:underline"
        >
          {showTemplateOverride
            ? t('pages.training.scorecard.hideTemplatePicker', 'Hide template list')
            : t('pages.training.scorecard.chooseTemplate', 'Choose a specific template')}
        </button>
        {showTemplateOverride ? (
          <select
            className="border-border rounded-lg border px-3 py-2 text-sm"
            value={selectedTemplateId ?? ''}
            onChange={(e) => setSelectedTemplateId(e.target.value ? Number(e.target.value) : null)}
            disabled={templatesQuery.isLoading}
          >
            <option value="">
              {t('pages.training.scorecard.selectTemplate', 'Select a template…')}
            </option>
            {templatesQuery.data?.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </select>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {isChangingType ? (
            <Button
              variant="cancel"
              size="md"
              onClick={() => setForcePicker(false)}
              className="rounded-full"
            >
              {t('common.cancel', 'Cancel')}
            </Button>
          ) : null}
          <Button
            variant="primary"
            size="md"
            onClick={handleStartNew}
            disabled={!selectedTemplateId || createMutation.isPending}
            className="rounded-full"
          >
            {isChangingType
              ? t('pages.training.scorecard.changeTypeConfirm', 'Change type')
              : t('pages.training.scorecard.startEvaluation', 'Start evaluation')}
          </Button>
        </div>
      </aside>
    )
  }

  if (activeQuery.isLoading) {
    return (
      <aside className="bg-card flex h-full items-center justify-center rounded-xl p-4 shadow-sm">
        <Icons.Spinner className="h-5 w-5" />
      </aside>
    )
  }

  if (!activeScorecard) {
    return (
      <aside className="bg-card text-error-600 rounded-xl p-4 text-sm shadow-sm">
        {t('pages.training.errors.loadScorecardFailed', 'Failed to load scorecard')}
      </aside>
    )
  }

  return (
    <aside className="bg-card flex h-full flex-col gap-3 rounded-xl p-4 shadow-sm">
      <header className="flex items-center justify-between">
        <h2 className="text-dark-500 text-lg font-medium">
          {activeScorecard.template_snapshot.name}
        </h2>
        <span className="bg-muted text-foreground rounded-full px-2 py-1 text-xs font-medium">
          {t(`pages.training.scorecard.status.${status}`, status)}
        </span>
      </header>

      {canEdit ? (
        <button
          type="button"
          onClick={() => {
            setForcePicker(true)
            setSelectedTemplateId(null)
            setShowTemplateOverride(false)
          }}
          className="text-muted-foreground hover:text-foreground self-start text-xs underline-offset-2 hover:underline"
        >
          {t('pages.training.scorecard.changeType', '← Change scorecard type')}
        </button>
      ) : null}

      {(canEditProp != null ? !canEditProp : !isOriginatingTrainer && status !== 'sent') ? (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
          <Icons.Lock size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            {canEditProp != null
              ? t(
                  'pages.training.scorecard.notAssigned',
                  'This operator is not assigned to you, so you cannot score this call.'
                )
              : t(
                  'pages.training.scorecard.readOnlyNotOwner',
                  'Read-only — only the trainer who created this scorecard can edit it.'
                )}
          </span>
        </div>
      ) : null}

      <div className="bg-primary-50 text-primary-700 flex items-center justify-between gap-2 rounded-lg p-3 text-sm">
        <span>
          {t('pages.training.scorecard.computedScore', 'Score')}:{' '}
          <span className="text-lg font-semibold">
            {livePreview != null ? `${Math.round(livePreview * 20)} / 100` : '—'}
          </span>
        </span>
        <span className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2 text-xs font-medium">
          <ScoreDivergenceBadge
            aiScore100={aiScore100}
            trainerScore100={trainerScore100}
            threshold={disputeThreshold}
          />
          {canEdit ? (
            <span className={isComplete ? 'text-primary-600' : 'text-amber-600'}>
              {t('pages.training.scorecard.scoredCount', '{{scored}}/{{total}} scored', {
                scored: scoredCount,
                total: requiredCount,
              })}
            </span>
          ) : null}
          {canEdit && draft.isDirty ? (
            <span className="text-amber-600">
              ● {t('pages.training.scorecard.unsaved', 'Unsaved changes')}
            </span>
          ) : null}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sections.map((section) => (
          <SectionEditor
            key={section.key}
            section={section}
            scores={draft.scores}
            disabled={!canEdit}
            totalWeight={totalWeight}
            onChange={draft.setScore}
          />
        ))}

        <label
          htmlFor="scorecard-overall-comment"
          className="text-foreground mt-3 block text-sm font-medium"
        >
          {t('pages.training.scorecard.perCallComment', 'Overall comment')}
        </label>
        <textarea
          id="scorecard-overall-comment"
          className="border-border w-full rounded-lg border px-3 py-2 text-sm"
          rows={3}
          value={draft.overallComment}
          onChange={(e) => draft.setOverallComment(e.target.value)}
          disabled={!canEdit}
        />

        {showDisputeReason ? (
          <div data-testid="dispute-reason-field" className="mt-3">
            <label
              htmlFor="scorecard-dispute-reason"
              className="text-foreground block text-sm font-medium"
            >
              {t('pages.training.scorecard.disputeReason', 'Why you disagree with the AI')}
            </label>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {t('pages.training.scorecard.disputeReasonHint', {
                defaultValue:
                  'Optional. Your score stands either way — filling this in records it as an objection to the AI review.',
              })}
            </p>
            <textarea
              id="scorecard-dispute-reason"
              className="border-border mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              rows={3}
              value={draft.disputeReason}
              onChange={(e) => draft.setDisputeReason(e.target.value)}
              disabled={!canEdit}
            />
          </div>
        ) : null}
      </div>

      <footer className="flex flex-wrap gap-2">
        {canEdit ? (
          <>
            {draft.isDirty ? (
              <Button variant="cancel" size="md" onClick={handleClear} className="rounded-full">
                {t('pages.training.scorecard.clear', 'Clear')}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="md"
              onClick={handleSaveDraft}
              disabled={!draft.isDirty || draft.isSaving}
              className="rounded-full"
            >
              {status === 'draft'
                ? t('pages.training.scorecard.saveDraft', 'Save draft')
                : t('pages.training.scorecard.saveChanges', 'Save changes')}
            </Button>
            {status === 'draft' ? (
              <Button
                variant="primary"
                size="md"
                onClick={handleMarkCompleted}
                disabled={updateMutation.isPending || !isComplete}
                title={
                  isComplete
                    ? undefined
                    : t(
                        'pages.training.scorecard.completeIncomplete',
                        'Score every criterion first'
                      )
                }
                className="rounded-full"
              >
                {t('pages.training.scorecard.markCompleted', 'Mark completed')}
              </Button>
            ) : null}
          </>
        ) : null}

        {(
          canEditProp != null
            ? canEditProp && locked
            : status === 'draft' && locked && isOriginatingTrainer
        ) ? (
          <Button
            variant="primary"
            size="md"
            onClick={() => setLocked(false)}
            className="rounded-full"
          >
            {t('pages.training.scorecard.edit', 'Edit')}
          </Button>
        ) : null}

        {(
          canEditProp != null
            ? canEditProp && (status === 'completed' || status === 'sent')
            : status === 'completed' && isOriginatingTrainer
        ) ? (
          <Button
            variant="primary"
            size="md"
            onClick={handleSend}
            disabled={sendMutation.isPending}
            className="rounded-full"
          >
            {status === 'sent'
              ? t('pages.training.scorecard.resend', 'Re-send')
              : t('pages.training.scorecard.sendToOperator', 'Send to operator')}
          </Button>
        ) : null}
      </footer>
    </aside>
  )
}

interface SectionEditorProps {
  section: Section
  scores: Record<string, { value: number | boolean | null; comment?: string | null }>
  disabled: boolean
  totalWeight: number
  onChange: (criterionKey: string, value: number | boolean | null, comment?: string | null) => void
}

function SectionEditor({ section, scores, disabled, totalWeight, onChange }: SectionEditorProps) {
  const [collapsed, setCollapsed] = useState(false)
  const isStages = section.key === SCRIPT_STAGES_SECTION_KEY
  return (
    <section className="border-border mt-3 rounded-lg border">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="text-foreground flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
      >
        <span>{section.name}</span>
        <Icons.ArrowDown
          size={16}
          className={`transition-transform ${collapsed ? '-rotate-90' : ''}`}
        />
      </button>
      {!collapsed ? (
        isStages ? (
          <StageChecklist
            section={section}
            scores={scores}
            disabled={disabled}
            onChange={onChange}
          />
        ) : (
          <div className="space-y-3 px-3 py-3">
            {section.criteria.map((criterion) => (
              <CriterionRow
                key={criterion.key}
                criterion={criterion}
                entry={scores[criterion.key]}
                disabled={disabled}
                totalWeight={totalWeight}
                onChange={onChange}
              />
            ))}
          </div>
        )
      ) : null}
    </section>
  )
}

interface StageChecklistProps {
  section: Section
  scores: Record<string, { value: number | boolean | null; comment?: string | null }>
  disabled: boolean
  onChange: (criterionKey: string, value: number | boolean | null, comment?: string | null) => void
}

export function StageChecklist({ section, scores, disabled, onChange }: StageChecklistProps) {
  const { t } = useTranslation('common')
  const criteria = section.criteria

  const mark = (index: number, reached: boolean) => {
    const current = scores[criteria[index].key]?.value
    const next = reached ? (current === true ? null : true) : current === false ? null : false
    onChange(criteria[index].key, next)
  }

  return (
    <div className="space-y-1.5 px-3 py-3">
      <p className="text-muted-foreground mb-1 text-xs">
        {t(
          'pages.training.scorecard.stages.hint',
          'Mark which script stages the call reached. Each stage is independent.'
        )}
      </p>
      {criteria.map((criterion, index) => {
        const value = (scores[criterion.key]?.value as boolean | null | undefined) ?? null
        return (
          <div
            key={criterion.key}
            className="bg-muted flex items-center justify-between gap-2 rounded-md px-3 py-2"
          >
            <span className="text-foreground flex items-center gap-2 text-sm">
              <span className="bg-muted text-muted-foreground flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
                {index + 1}
              </span>
              {criterion.name}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={disabled}
                onClick={() => mark(index, true)}
                aria-pressed={value === true}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
                  value === true
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-border bg-card text-foreground'
                }`}
              >
                {t('pages.training.scorecard.stages.reached', 'Reached')}
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => mark(index, false)}
                aria-pressed={value === false}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
                  value === false
                    ? 'border-error-500 bg-error-500 text-white'
                    : 'border-border bg-card text-foreground'
                }`}
              >
                {t('pages.training.scorecard.stages.notReached', 'Not reached')}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

interface CriterionRowProps {
  criterion: Criterion
  entry?: { value: number | boolean | null; comment?: string | null }
  disabled: boolean
  totalWeight: number
  onChange: (criterionKey: string, value: number | boolean | null, comment?: string | null) => void
}

function CriterionRow({ criterion, entry, disabled, totalWeight, onChange }: CriterionRowProps) {
  const { t } = useTranslation('common')
  // Normalised on read: a scale written by something other than this UI
  // must degrade to a real control, not fall through to the 0..5 band.
  const isBinary = normalizeCriterionScale(criterion.scale) === 'binary'
  const needsScore = !disabled && Number(criterion.weight) > 0 && entry?.value == null
  return (
    <div
      className={`rounded-md px-3 py-2 ${
        needsScore ? 'bg-warning-50 ring-warning-200 ring-1' : 'bg-muted'
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-foreground text-sm">
          {criterion.name}
          {criterion.weight > 0 ? (
            <span className="text-muted-foreground ml-1.5 text-xs">
              · {criterion.weight} {t('pages.training.scorecard.pts', 'pts')}
            </span>
          ) : null}
          {needsScore ? (
            <span className="ml-1.5 text-xs font-medium text-amber-600">
              · {t('pages.training.scorecard.notScored', 'not scored')}
            </span>
          ) : null}
        </span>
        {isBinary ? (
          <BinaryInput
            value={(entry?.value as boolean | null) ?? null}
            disabled={disabled}
            onChange={(v) => onChange(criterion.key, v)}
          />
        ) : null}
      </div>
      {!isBinary ? (
        <Level6Input
          value={(entry?.value as number | null) ?? null}
          weight={Number(criterion.weight) || 0}
          totalWeight={totalWeight}
          disabled={disabled}
          onChange={(v) => onChange(criterion.key, v)}
        />
      ) : null}
      <input
        type="text"
        placeholder={t('pages.training.scorecard.commentOptional', 'Comment (optional)')}
        defaultValue={entry?.comment ?? ''}
        disabled={disabled}
        onBlur={(e) => onChange(criterion.key, entry?.value ?? null, e.target.value)}
        className="border-border mt-2 w-full rounded-md border px-2 py-1 text-xs"
      />
    </div>
  )
}

function BinaryInput({
  value,
  disabled,
  onChange,
}: {
  value: boolean | null
  disabled: boolean
  onChange: (next: boolean | null) => void
}) {
  const { t } = useTranslation('common')
  return (
    <div className="flex gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(value === true ? null : true)}
        aria-label={t('common.yes', 'Yes')}
        aria-pressed={value === true}
        className={`rounded-full border px-3 py-1 text-xs font-medium ${
          value === true
            ? 'bg-primary-500 border-primary-500 text-white'
            : 'border-border bg-card text-foreground'
        }`}
      >
        ✓
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(value === false ? null : false)}
        aria-label={t('common.no', 'No')}
        aria-pressed={value === false}
        className={`rounded-full border px-3 py-1 text-xs font-medium ${
          value === false
            ? 'border-error-500 bg-error-500 text-white'
            : 'border-border bg-card text-foreground'
        }`}
      >
        ✗
      </button>
    </div>
  )
}

const LEVEL_6: { value: number; labelKey: string; fallback: string; bar: string }[] = [
  {
    value: 0,
    labelKey: 'pages.training.dialogue.ratings.notDone',
    fallback: 'Not done',
    bar: 'bg-error-500/50',
  },
  {
    value: 1,
    labelKey: 'pages.training.dialogue.ratings.poor',
    fallback: 'Poor',
    bar: 'bg-error-400/40',
  },
  {
    value: 2,
    labelKey: 'pages.training.dialogue.ratings.weak',
    fallback: 'Weak',
    bar: 'bg-amber-400/50',
  },
  {
    value: 3,
    labelKey: 'pages.training.dialogue.ratings.normal',
    fallback: 'Normal',
    bar: 'bg-information-500/50',
  },
  {
    value: 4,
    labelKey: 'pages.training.dialogue.ratings.good',
    fallback: 'Good',
    bar: 'bg-emerald-400/40',
  },
  {
    value: 5,
    labelKey: 'pages.training.dialogue.ratings.excellent',
    fallback: 'Excellent',
    bar: 'bg-emerald-500/50',
  },
]

function Level6Input({
  value,
  weight,
  totalWeight,
  disabled,
  onChange,
}: {
  value: number | null
  weight: number
  totalWeight: number
  disabled: boolean
  onChange: (next: number | null) => void
}) {
  const { t } = useTranslation('common')
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
      {LEVEL_6.map((lvl) => {
        const selected = value === lvl.value
        const points = totalWeight > 0 ? Math.round((lvl.value * weight * 20) / totalWeight) : 0
        return (
          <button
            key={lvl.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(selected ? null : lvl.value)}
            aria-label={t(lvl.labelKey, lvl.fallback)}
            aria-pressed={selected}
            className={`flex min-h-[58px] flex-col rounded-md border px-1.5 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              selected ? 'border-primary-500 bg-primary-50' : 'border-border bg-card'
            }`}
          >
            <span className={`mb-1 h-1.5 w-full rounded-full ${lvl.bar}`} />
            <span className="text-foreground text-[10px] leading-tight font-medium">
              {t(lvl.labelKey, lvl.fallback)}
            </span>
            {weight > 0 ? (
              <span className="text-muted-foreground text-[9px]">+{points}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
