/**
 * ScorecardPanel — side panel rendered next to the CallRecordingModal (KAN-410, Feature 2.1).
 *
 * Renders the active scorecard template with collapsible sections, per-criterion
 * inputs (binary toggle or 0..5 buttons), comment fields, and a status indicator.
 * Autosaves drafts via `useScorecardDraft`; trainer-controlled buttons flip
 * status (draft -> completed -> sent).
 *
 * The panel is mounted inside the `CallReviewLayout` wrapper (Action Analysis
 * flow only); operator-side call sites that open the modal don't pass a
 * `scorecardPanel` prop and get the legacy single-panel layout unchanged.
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
import { computeWeightedScorePreview } from '../lib/scoringPreview'
import type { Criterion, Section } from '../types'

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
  const autoDraftId = historyQuery.data?.find((h) => h.status === 'draft')?.id ?? null
  const activeScorecardId = pinnedScorecardId ?? manuallySelectedId ?? autoDraftId ?? null
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
    })
  }

  const handleStartNew = async () => {
    if (!selectedTemplateId) return
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
    return (
      <aside className="flex h-full flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-dark-500 text-lg font-medium">
          {t('pages.training.scorecard.title', 'Quality evaluation')}
        </h2>

        {historyQuery.data && historyQuery.data.length > 0 ? (
          <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            <div className="mb-2 font-medium">
              {t('pages.training.scorecard.history', 'Previous scorecards on this call')}
            </div>
            <ul className="space-y-1">
              {historyQuery.data.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setManuallySelectedId(row.id)}
                    className="text-primary-600 hover:underline"
                  >
                    {new Date(row.created_at).toLocaleString()} —{' '}
                    {t(`pages.training.scorecard.status.${row.status}`, row.status)}
                    {row.weighted_score != null ? ` (${row.weighted_score})` : ''}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <label className="text-sm font-medium text-gray-700">
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
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
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
          className="self-start text-xs text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline"
        >
          {showTemplateOverride
            ? t('pages.training.scorecard.hideTemplatePicker', 'Hide template list')
            : t('pages.training.scorecard.chooseTemplate', 'Choose a specific template')}
        </button>
        {showTemplateOverride ? (
          <select
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
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

        <Button
          variant="primary"
          size="md"
          onClick={handleStartNew}
          disabled={!selectedTemplateId || createMutation.isPending}
          className="rounded-full"
        >
          {t('pages.training.scorecard.startEvaluation', 'Start evaluation')}
        </Button>
      </aside>
    )
  }

  if (activeQuery.isLoading) {
    return (
      <aside className="flex h-full items-center justify-center rounded-xl bg-white p-4 shadow-sm">
        <Icons.Spinner className="h-5 w-5" />
      </aside>
    )
  }

  if (!activeScorecard) {
    return (
      <aside className="rounded-xl bg-white p-4 text-sm text-red-600 shadow-sm">
        {t('pages.training.errors.loadScorecardFailed', 'Failed to load scorecard')}
      </aside>
    )
  }

  return (
    <aside className="flex h-full flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
      <header className="flex items-center justify-between">
        <h2 className="text-dark-500 text-lg font-medium">
          {activeScorecard.template_snapshot.name}
        </h2>
        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
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
          className="self-start text-xs text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline"
        >
          {t('pages.training.scorecard.changeType', '← Change scorecard type')}
        </button>
      ) : null}

      {!isOriginatingTrainer && status !== 'sent' ? (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
          <Icons.Lock size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            {t(
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
        <span className="flex flex-shrink-0 items-center gap-2 text-xs font-medium">
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

        <label className="mt-3 block text-sm font-medium text-gray-700">
          {t('pages.training.scorecard.perCallComment', 'Overall comment')}
        </label>
        <textarea
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          rows={3}
          value={draft.overallComment}
          onChange={(e) => draft.setOverallComment(e.target.value)}
          disabled={!canEdit}
        />
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
              {t('pages.training.scorecard.saveDraft', 'Save draft')}
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleMarkCompleted}
              disabled={updateMutation.isPending || !isComplete}
              title={
                isComplete
                  ? undefined
                  : t('pages.training.scorecard.completeIncomplete', 'Score every criterion first')
              }
              className="rounded-full"
            >
              {t('pages.training.scorecard.markCompleted', 'Mark completed')}
            </Button>
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
    <section className="mt-3 rounded-lg border border-gray-100">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-gray-700"
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
      <p className="mb-1 text-xs text-gray-500">
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
            className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-2"
          >
            <span className="flex items-center gap-2 text-sm text-gray-700">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-600">
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
                    : 'border-gray-200 bg-white text-gray-700'
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
                    ? 'border-red-500 bg-red-500 text-white'
                    : 'border-gray-200 bg-white text-gray-700'
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
  const isBinary = criterion.scale === 'binary'
  const needsScore = !disabled && Number(criterion.weight) > 0 && entry?.value == null
  return (
    <div
      className={`rounded-md px-3 py-2 ${
        needsScore ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-gray-50'
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm text-gray-700">
          {criterion.name}
          {criterion.weight > 0 ? (
            <span className="ml-1.5 text-xs text-gray-400">
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
        className="mt-2 w-full rounded-md border border-gray-200 px-2 py-1 text-xs"
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
            : 'border-gray-200 bg-white text-gray-700'
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
            ? 'border-red-500 bg-red-500 text-white'
            : 'border-gray-200 bg-white text-gray-700'
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
    bar: 'bg-red-500/50',
  },
  {
    value: 1,
    labelKey: 'pages.training.dialogue.ratings.poor',
    fallback: 'Poor',
    bar: 'bg-red-400/40',
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
    bar: 'bg-blue-500/50',
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
              selected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'
            }`}
          >
            <span className={`mb-1 h-1.5 w-full rounded-full ${lvl.bar}`} />
            <span className="text-[10px] leading-tight font-medium text-gray-700">
              {t(lvl.labelKey, lvl.fallback)}
            </span>
            {weight > 0 ? <span className="text-[9px] text-gray-400">+{points}</span> : null}
          </button>
        )
      })}
    </div>
  )
}
