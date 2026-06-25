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
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
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

interface ScorecardPanelProps {
  callId: string
  operatorId: number
  /** When set, the panel opens that scorecard rather than the latest draft. */
  scorecardId?: number | null
  /** Callback after the trainer presses "Send to operator". */
  onSent?: (scorecardId: number) => void
  /** Emits the unsaved-changes state so the parent can warn on close. */
  onDirtyChange?: (dirty: boolean) => void
}

export function ScorecardPanel({
  callId,
  operatorId,
  scorecardId: pinnedScorecardId,
  onSent,
  onDirtyChange,
}: ScorecardPanelProps) {
  const { t } = useTranslation('common')
  const templatesQuery = useTemplates(false)
  const historyQuery = useScorecardHistoryForCall(callId)

  // `manuallySelectedId` is what the user clicks (template start, history row).
  // The effective active id is derived during render from three sources in
  // priority order: the pinned prop, an explicit user click, then the first
  // outstanding draft on this call. No effects, no cascading renders.
  const [manuallySelectedId, setManuallySelectedId] = useState<number | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  // The Client/Third-Party buttons already pick the template, so the raw
  // template dropdown is collapsed behind a disclosure (legacy/advanced).
  const [showTemplateOverride, setShowTemplateOverride] = useState(false)
  // Lets the trainer return to the type picker from a draft (KAN-504 UX).
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
    // KAN-504 UX: no per-change autosave. Selecting a criterion value only
    // updates local state — persistence happens on explicit "Save draft" /
    // "Mark completed". This stops the PUT + refetch cascade that fired on
    // every selection. Closing with unsaved changes warns instead of saving
    // silently, so we opt out of the on-unmount flush.
    enabled: false,
    flushOnUnmount: false,
  })

  // Surface the unsaved-changes state so the modal can warn before closing.
  useEffect(() => {
    onDirtyChange?.(draft.isDirty)
  }, [draft.isDirty, onDirtyChange])

  const livePreview = useMemo(
    () => computeWeightedScorePreview(sections, draft.scores),
    [sections, draft.scores]
  )

  // KAN-504: the two typed templates, surfaced as an explicit Client /
  // Third Party selector in the picker. Selecting a type loads its template.
  const typedTemplates = useMemo(
    () => ({
      client: templatesQuery.data?.find((tpl) => tpl.scorecard_type === 'client') ?? null,
      third_party: templatesQuery.data?.find((tpl) => tpl.scorecard_type === 'third_party') ?? null,
    }),
    [templatesQuery.data]
  )

  // Edit-lock (KAN-504 decision 1.4): a draft opens editable; Save draft /
  // Mark completed locks it to read-only; Edit re-opens a draft. Completed
  // and sent scorecards are locked permanently (no Edit).
  const [locked, setLocked] = useState(false)
  const status = activeScorecard?.status ?? 'draft'
  const canEdit = status === 'draft' && !locked

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
    await draft.flush()
    await updateMutation.mutateAsync({
      scorecardId: activeScorecardId,
      payload: { status: 'completed' },
    })
  }

  const handleSend = async () => {
    if (!activeScorecardId) return
    const sent = await sendMutation.mutateAsync(activeScorecardId)
    onSent?.(sent.id)
  }

  // ---- Render branches ----

  // No scorecard yet (or the trainer chose to switch type) → show the picker.
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

      <div className="bg-primary-50 text-primary-700 flex items-center justify-between gap-2 rounded-lg p-3 text-sm">
        <span>
          {t('pages.training.scorecard.computedScore', 'Score')}:{' '}
          <span className="text-lg font-semibold">
            {livePreview != null ? `${Math.round(livePreview * 20)} / 100` : '—'}
          </span>
        </span>
        {canEdit && draft.isDirty ? (
          <span className="flex-shrink-0 text-xs font-medium text-amber-600">
            ● {t('pages.training.scorecard.unsaved', 'Unsaved changes')}
          </span>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto">
        {sections.map((section) => (
          <SectionEditor
            key={section.key}
            section={section}
            scores={draft.scores}
            disabled={!canEdit}
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
              disabled={updateMutation.isPending}
              className="rounded-full"
            >
              {t('pages.training.scorecard.markCompleted', 'Mark completed')}
            </Button>
          </>
        ) : null}

        {status === 'draft' && locked ? (
          <Button
            variant="primary"
            size="md"
            onClick={() => setLocked(false)}
            className="rounded-full"
          >
            {t('pages.training.scorecard.edit', 'Edit')}
          </Button>
        ) : null}

        {status === 'completed' ? (
          <Button
            variant="primary"
            size="md"
            onClick={handleSend}
            disabled={sendMutation.isPending}
            className="rounded-full"
          >
            {t('pages.training.scorecard.sendToOperator', 'Send to operator')}
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
  onChange: (criterionKey: string, value: number | boolean | null, comment?: string | null) => void
}

function SectionEditor({ section, scores, disabled, onChange }: SectionEditorProps) {
  const [collapsed, setCollapsed] = useState(false)
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
        <div className="space-y-3 px-3 py-3">
          {section.criteria.map((criterion) => (
            <CriterionRow
              key={criterion.key}
              criterion={criterion}
              entry={scores[criterion.key]}
              disabled={disabled}
              onChange={onChange}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}

interface CriterionRowProps {
  criterion: Criterion
  entry?: { value: number | boolean | null; comment?: string | null }
  disabled: boolean
  onChange: (criterionKey: string, value: number | boolean | null, comment?: string | null) => void
}

function CriterionRow({ criterion, entry, disabled, onChange }: CriterionRowProps) {
  const isBinary = criterion.scale === 'binary'
  return (
    <div className="rounded-md bg-gray-50 px-3 py-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm text-gray-700">
          {criterion.name}
          {criterion.weight > 0 ? (
            <span className="ml-1.5 text-xs text-gray-400">· {criterion.weight} pts</span>
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
          disabled={disabled}
          onChange={(v) => onChange(criterion.key, v)}
        />
      ) : null}
      <input
        type="text"
        placeholder="Comment (optional)"
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
  return (
    <div className="flex gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(value === true ? null : true)}
        aria-label="Yes"
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
        aria-label="No"
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

// KAN-504 redesign: the 0-5 scale is presented as 6 labeled levels (the 4
// from the design + Poor/Good). Values map straight onto the existing 0-5
// axis, so scoring is unchanged. Per-value points = round(value × weight / 5)
// (the criterion's contribution to the /100 score; templates sum to 100).
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
  disabled,
  onChange,
}: {
  value: number | null
  weight: number
  disabled: boolean
  onChange: (next: number | null) => void
}) {
  const { t } = useTranslation('common')
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
      {LEVEL_6.map((lvl) => {
        const selected = value === lvl.value
        const points = Math.round((lvl.value * weight) / 5)
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
