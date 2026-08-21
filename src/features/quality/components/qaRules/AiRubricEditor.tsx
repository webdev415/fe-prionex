/**
 * AiRubricEditor — the sections → criteria editor for one AI rubric
 * (`purpose='ai'` scorecard template).
 *
 * The header carries the slice the rubric applies to (interlocutor type +
 * department + outbound line; department NULL = universal fallback, line
 * NULL = any line). The body is a list of sections, each a list of criteria
 * (name, weight, scale, and the two prose fields — the AI instruction and the
 * speech examples).
 *
 * Sections are an accordion: a boевая rubric runs to 13+ criteria, which as
 * a flat list is two screens of inputs with no way to see how the 100 points
 * are split. Collapsed headers carry the criterion count and the section's
 * weight subtotal, so that split is readable without scrolling.
 *
 * quality-service enforces «criteria weights sum to exactly 100» for AI
 * rubrics — the footer shows the running total and Save stays disabled
 * until it lands on 100, so the rule is visible before the request.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'

import {
  gradingScaleIssues,
  nextFreeScore,
  readIncompleteDialogScale,
  writeIncompleteDialogScale,
  type GradingLevel,
  type IncompleteDialogScale,
} from '../../lib/rubricGrading'
import {
  isRubricWeightValid,
  makeUniqueKey,
  RUBRIC_TOTAL_WEIGHT,
  sumCriteriaWeights,
  sumSectionWeights,
} from '../../lib/rubricWeights'
import type {
  Criterion,
  CriterionScale,
  RubricTelephonyType,
  ScorecardTemplate,
  ScorecardType,
  Section,
  TemplateCreatePayload,
} from '../../types'
import { normalizeRubricTelephonyType } from '../../types'
import {
  CRITERION_SCALE_OPTIONS,
  QA_INPUT_CLS,
  QA_TEXTAREA_CLS,
  RUBRIC_TELEPHONY_OPTIONS,
  scaleKey,
  telephonyKey,
} from './qaRuleOptions'

export interface DepartmentOption {
  id: number
  name: string
}

export interface AiRubricEditorProps {
  /** Existing rubric to edit; undefined → a blank new one. */
  rubric?: ScorecardTemplate
  departments: DepartmentOption[]
  /**
   * Every rubric the section knows about — used only to name the rubric that
   * already owns the slice being edited (quality-service keeps at most one
   * active rubric per (department, interlocutor) and refuses the second).
   */
  siblings?: ScorecardTemplate[]
  saving?: boolean
  onSave: (payload: TemplateCreatePayload) => Promise<void> | void
  onCancel?: () => void
}

function cloneSections(sections: Section[] | undefined): Section[] {
  return (sections ?? []).map((section) => ({
    key: section.key,
    name: section.name,
    criteria: (section.criteria ?? []).map((criterion) => ({
      // Spread first: the template PUT replaces `sections` whole, so a field
      // this editor does not render is deleted from the rubric the moment a
      // trainer saves an unrelated weight change. `raw_points` is the last
      // such field — the checklist's own points, before the weights were
      // normalised to Σ=100, kept so a rubric can be reconciled against the
      // source sheet.
      ...criterion,
      key: criterion.key,
      name: criterion.name,
      // Seeded rubrics may omit `scale` — the pipeline's default is the 0..5 band.
      scale: (criterion.scale ?? '0-5') as CriterionScale,
      weight: Number(criterion.weight) || 0,
      description: criterion.description ?? '',
      examples: criterion.examples ?? '',
    })),
  }))
}

/**
 * Fold key for the grading scale. It shares the sections' open/closed map, so
 * it must not collide with a real section key — `makeUniqueKey` strips
 * everything outside [a-z0-9_], which leaves the colon unreachable.
 */
const GRADING_SECTION_KEY = 'grading:scale'

function collectKeys(sections: Section[]): Set<string> {
  const keys = new Set<string>()
  for (const section of sections) {
    keys.add(section.key)
    for (const criterion of section.criteria) keys.add(criterion.key)
  }
  return keys
}

/**
 * A textarea that takes the height of its content.
 *
 * The trainers' checklist puts prose in `description` and `examples` — one
 * examples value runs past 600 characters over several numbered lines. In a
 * one-line input that text is invisible; in a fixed box it becomes a scroll
 * inside a scroll. So the field grows and the criterion card grows with it.
 */
function AutoTextarea({
  value,
  onChange,
  rows = 3,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    // jsdom reports 0 here; leaving the inline height unset there keeps the
    // `rows` fallback rather than collapsing the box to nothing.
    if (!el || el.scrollHeight <= 0) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return <textarea ref={ref} rows={rows} value={value} onChange={onChange} {...rest} />
}

export function AiRubricEditor({
  rubric,
  departments,
  siblings = [],
  saving = false,
  onSave,
  onCancel,
}: AiRubricEditorProps) {
  const { t } = useTranslation('common')

  const [name, setName] = useState(rubric?.name ?? '')
  const [description, setDescription] = useState(rubric?.description ?? '')
  const [scorecardType, setScorecardType] = useState<ScorecardType>(
    rubric?.scorecard_type ?? 'client'
  )
  const [departmentId, setDepartmentId] = useState<number | ''>(rubric?.department_id ?? '')
  // '' is «any line» — the rubric grades white and grey alike. A backend that
  // predates the split sends no field at all, which reads the same way.
  const lineAsLoaded = normalizeRubricTelephonyType(rubric?.telephony_type)
  const [telephonyType, setTelephonyType] = useState<RubricTelephonyType | ''>(
    () => lineAsLoaded ?? ''
  )
  const [sections, setSections] = useState<Section[]>(() => cloneSections(rubric?.sections))
  /**
   * The unfinished-dialogue scale, or null when the rubric carries none. Null
   * stays null: a card without a scale renders no section at all rather than
   * an empty stub, which would read as «there is a scale here and nobody
   * filled it in».
   */
  const gradingAsLoaded = readIncompleteDialogScale(rubric?.grading_rules)
  const [grading, setGrading] = useState<IncompleteDialogScale | null>(() => {
    const loaded = readIncompleteDialogScale(rubric?.grading_rules)
    return loaded && { ...loaded, levels: loaded.levels.map((level) => ({ ...level })) }
  })
  /**
   * Which sections are unfolded. Keyed by section key (not index) so that
   * removing a section doesn't hand its open state to its neighbour.
   *
   * The first section starts open and the rest folded: an all-folded editor
   * reads as an empty rubric, while one open section shows what a criterion
   * row actually looks like and still fits the whole outline on one screen.
   */
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => ({
    ...Object.fromEntries(cloneSections(rubric?.sections).map((s, i) => [s.key, i === 0])),
    // The scale sits below the criteria and is read far less often than they
    // are, so it starts folded even when it is the only thing besides them.
    [GRADING_SECTION_KEY]: false,
  }))
  const isSectionOpen = (key: string) => openSections[key] !== false
  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: prev[key] === false }))
  const setAllSections = (open: boolean) =>
    setOpenSections((prev) => ({
      ...prev,
      ...Object.fromEntries(sections.map((s) => [s.key, open])),
      [GRADING_SECTION_KEY]: open,
    }))

  // The slice, spelled out: who the call is with and which department it
  // belongs to. Follows the selects live, so the header always describes the
  // rubric that would be saved — not the one that was loaded.
  const departmentLabel =
    departmentId === ''
      ? t('pages.qaRules.rubrics.universal', 'Universal (fallback)')
      : (departments.find((d) => d.id === departmentId)?.name ?? `ID ${departmentId}`)
  const typeLabel =
    scorecardType === 'third_party'
      ? t('pages.qaRules.rubrics.typeThirdParty', 'Third party')
      : t('pages.qaRules.rubrics.typeClient', 'Debtor')
  const telephonyLabel =
    telephonyType === ''
      ? t('pages.qaRules.rubrics.telephonyAny', 'Any line')
      : t(telephonyKey(telephonyType), telephonyType)

  // Another *active* rubric on the same slice → saving this one is refused
  // server-side. Say so before the request instead of after the toast.
  const sliceOwner = useMemo(() => {
    const target = departmentId === '' ? null : Number(departmentId)
    const line = telephonyType === '' ? null : telephonyType
    return siblings.find(
      (r) =>
        r.id !== rubric?.id &&
        !r.is_archived &&
        (r.scorecard_type ?? 'client') === scorecardType &&
        (r.department_id ?? null) === target &&
        // The line is part of the slice: a white and a grey rubric for the
        // same department are the point of the split, not a conflict.
        normalizeRubricTelephonyType(r.telephony_type) === line
    )
  }, [siblings, rubric?.id, scorecardType, departmentId, telephonyType])

  const gradingOpen = isSectionOpen(GRADING_SECTION_KEY)
  const gradingIssues = useMemo(
    () => (grading ? gradingScaleIssues(grading, telephonyType === '' ? null : telephonyType) : []),
    [grading, telephonyType]
  )

  const totalWeight = useMemo(() => sumCriteriaWeights(sections), [sections])
  const weightValid = isRubricWeightValid(sections)
  const nameValid = name.trim().length > 0
  const hasCriteria = sections.some((s) => s.criteria.length > 0)
  // Every grading issue is a 422 server-side (or worse: a top band below 100
  // marks down every cut-short call in silence), so they block Save the same
  // way the weight rule does.
  const canSave = nameValid && weightValid && hasCriteria && gradingIssues.length === 0 && !saving

  const patchSection = (index: number, patch: Partial<Section>) => {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  const patchCriterion = (
    sectionIndex: number,
    criterionIndex: number,
    patch: Partial<Criterion>
  ) => {
    setSections((prev) =>
      prev.map((section, i) =>
        i !== sectionIndex
          ? section
          : {
              ...section,
              criteria: section.criteria.map((criterion, j) =>
                j === criterionIndex ? { ...criterion, ...patch } : criterion
              ),
            }
      )
    )
  }

  const patchGrading = (patch: Partial<IncompleteDialogScale>) => {
    setGrading((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  const patchGradingLevel = (index: number, patch: Partial<GradingLevel>) => {
    setGrading((prev) =>
      prev
        ? {
            ...prev,
            levels: prev.levels.map((level, i) => (i === index ? { ...level, ...patch } : level)),
          }
        : prev
    )
  }

  const addGradingLevel = () => {
    setGrading((prev) =>
      prev
        ? {
            ...prev,
            levels: [...prev.levels, { score: nextFreeScore(prev.levels), description: '' }],
          }
        : prev
    )
  }

  const sortGradingLevels = () => {
    setGrading((prev) =>
      prev ? { ...prev, levels: [...prev.levels].sort((a, b) => a.score - b.score) } : prev
    )
  }

  const removeGradingLevel = (index: number) => {
    setGrading((prev) =>
      prev ? { ...prev, levels: prev.levels.filter((_, i) => i !== index) } : prev
    )
  }

  /**
   * Adding and removing the whole scale. The server has an explicit «null
   * removes it» path, and a Remove without an Add would be one-way — a
   * trainer could drop the scale off a card and never put it back, which is
   * exactly the kind of dead end this epic exists to end.
   */
  const addGradingScale = () => {
    setGrading({
      title: '',
      source: null,
      telephony_type: null,
      levels: [{ score: 100, description: '' }],
    })
    setOpenSections((prev) => ({ ...prev, [GRADING_SECTION_KEY]: true }))
  }

  const addSection = () => {
    setSections((prev) => [
      ...prev,
      {
        key: makeUniqueKey('', collectKeys(prev), `section_${prev.length + 1}`),
        name: '',
        criteria: [],
      },
    ])
  }

  const removeSection = (index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index))
  }

  const addCriterion = (sectionIndex: number) => {
    setSections((prev) =>
      prev.map((section, i) =>
        i !== sectionIndex
          ? section
          : {
              ...section,
              criteria: [
                ...section.criteria,
                {
                  key: makeUniqueKey(
                    '',
                    collectKeys(prev),
                    `${section.key}_c${section.criteria.length + 1}`
                  ),
                  name: '',
                  scale: '0-5' as CriterionScale,
                  weight: 0,
                  description: '',
                },
              ],
            }
      )
    )
  }

  const removeCriterion = (sectionIndex: number, criterionIndex: number) => {
    setSections((prev) =>
      prev.map((section, i) =>
        i !== sectionIndex
          ? section
          : { ...section, criteria: section.criteria.filter((_, j) => j !== criterionIndex) }
      )
    )
  }

  const handleSave = async () => {
    if (!canSave) return
    // Keys are the join between a scorecard's stored scores and its template;
    // a blank one would collide, so fall back to a positional key on save.
    const taken = new Set<string>()
    const normalized: Section[] = sections.map((section, si) => {
      const sectionKey = makeUniqueKey(section.key || section.name, taken, `section_${si + 1}`)
      taken.add(sectionKey)
      return {
        key: sectionKey,
        name: section.name.trim(),
        criteria: section.criteria.map((criterion, ci) => {
          const criterionKey = makeUniqueKey(
            criterion.key || criterion.name,
            taken,
            `${sectionKey}_c${ci + 1}`
          )
          taken.add(criterionKey)
          return {
            // Carry the untouched fields through: `sections` is replaced whole
            // by the PUT, so a criterion rebuilt only from the inputs this form
            // renders would silently drop `raw_points`.
            ...criterion,
            key: criterionKey,
            name: criterion.name.trim(),
            scale: criterion.scale,
            weight: Number(criterion.weight) || 0,
            // `trim` only clips the outer whitespace — the newlines inside a
            // multi-line instruction or a numbered example list are content
            // and must survive the round-trip.
            description: criterion.description?.trim() || null,
            examples: criterion.examples?.trim() || null,
          }
        }),
      }
    })

    const line = telephonyType === '' ? null : telephonyType

    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        purpose: 'ai',
        scorecard_type: scorecardType,
        department_id: departmentId === '' ? null : Number(departmentId),
        // The update route reads «key absent» and «key present, value null»
        // differently: absent leaves the line alone, explicit null clears it
        // back to «any line». So an untouched line is left out of the payload
        // entirely — sending null there would silently unpin the rubric.
        // A new rubric has nothing to leave alone, so it always carries one.
        ...(rubric && line === lineAsLoaded ? {} : { telephony_type: line }),
        // Same «absent ≠ null» rule as the line. The key is written only when
        // the scale actually changed hands: an explicit null removes it, an
        // object replaces it whole (the route does no partial merge), and a
        // card that never had one and still has none says nothing at all.
        ...(rubric && grading == null && gradingAsLoaded == null
          ? {}
          : { grading_rules: writeIncompleteDialogScale(rubric?.grading_rules, grading) }),
        sections: normalized,
      })
    } catch {
      toast.error(t('pages.qaRules.saveError', 'Could not save the change'))
    }
  }

  return (
    <div
      className="flex flex-col gap-4 rounded-xl border border-[#EBECE8] bg-white p-4"
      data-testid="ai-rubric-editor"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-[#EBECE8] pb-3">
        <span className="text-xs font-medium text-[#05040D]">
          {rubric ? rubric.name : t('pages.qaRules.rubrics.create', 'New rubric')}
        </span>
        <span
          data-testid="rubric-slice"
          className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-[11px] text-[#4B5563]"
        >
          {t('pages.qaRules.rubrics.slice', 'Applies to')}: {typeLabel} · {departmentLabel} ·{' '}
          {telephonyLabel}
        </span>
        {rubric ? (
          <span
            data-testid="rubric-status"
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              rubric.is_archived ? 'bg-[#F3F4F6] text-[#6B7280]' : 'bg-[#DCFCE7] text-[#15803D]'
            }`}
          >
            {rubric.is_archived
              ? t('pages.qaRules.rubrics.statusArchived', 'Archived')
              : t('pages.qaRules.rubrics.statusActive', 'Active')}
          </span>
        ) : null}
      </div>

      {sliceOwner ? (
        <p data-testid="rubric-slice-conflict" className="text-[11px] text-[#B45309]">
          {t('pages.qaRules.rubrics.sliceTaken', {
            defaultValue: 'Another rubric is already active for this slice: {{name}}',
            name: sliceOwner.name,
          })}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-[#6B7280]">
            {t('pages.qaRules.rubrics.name', 'Rubric name')}
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${QA_INPUT_CLS} w-full`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-[#6B7280]">
            {t('pages.qaRules.rubrics.scorecardType', 'Interlocutor')}
          </span>
          <select
            value={scorecardType}
            onChange={(e) => setScorecardType(e.target.value as ScorecardType)}
            className={QA_INPUT_CLS}
          >
            <option value="client">{t('pages.qaRules.rubrics.typeClient', 'Debtor')}</option>
            <option value="third_party">
              {t('pages.qaRules.rubrics.typeThirdParty', 'Third party')}
            </option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-[#6B7280]">
            {t('pages.qaRules.rubrics.department', 'Department')}
          </span>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value === '' ? '' : Number(e.target.value))}
            className={QA_INPUT_CLS}
          >
            <option value="">{t('pages.qaRules.rubrics.universal', 'Universal (fallback)')}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-[#6B7280]">
            {t('pages.qaRules.rubrics.telephonyType', 'Telephony type')}
          </span>
          <select
            aria-label={t('pages.qaRules.rubrics.telephonyType', 'Telephony type')}
            value={telephonyType}
            onChange={(e) => setTelephonyType(e.target.value as RubricTelephonyType | '')}
            className={QA_INPUT_CLS}
          >
            <option value="">{t('pages.qaRules.rubrics.telephonyAny', 'Any line')}</option>
            {RUBRIC_TELEPHONY_OPTIONS.map((line) => (
              <option key={line} value={line}>
                {t(telephonyKey(line), line)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-[#6B7280]">
            {t('pages.qaRules.rubrics.description', 'Description')}
          </span>
          <input
            value={description ?? ''}
            onChange={(e) => setDescription(e.target.value)}
            className={`${QA_INPUT_CLS} w-full`}
          />
        </label>
      </div>

      {/* An empty «AI instruction» is the rubric's quietest failure mode: the
        criterion still scores, the model just invents what it means. Say so
        once, above the sections, instead of per row. */}
      <p data-testid="rubric-instruction-hint" className="text-[11px] text-[#6B7280]">
        {t(
          'pages.qaRules.rubrics.instructionHint',
          'The AI instruction is what the model grades the criterion by. Left empty, it judges from the criterion name alone and interprets it however it likes.'
        )}
      </p>

      {/* Counts the grading scale too: with one section plus a scale there are
        still two foldable blocks, and «fold all» has something to do. */}
      {sections.length + (grading ? 1 : 0) > 1 ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAllSections(true)}
            data-testid="rubric-expand-all"
            className="rounded-md border border-[#EDEDED] px-2 py-1 text-[11px] text-[#4B5563] hover:bg-[#F7F7F7]"
          >
            {t('pages.qaRules.rubrics.expandAll', 'Unfold all')}
          </button>
          <button
            type="button"
            onClick={() => setAllSections(false)}
            data-testid="rubric-collapse-all"
            className="rounded-md border border-[#EDEDED] px-2 py-1 text-[11px] text-[#4B5563] hover:bg-[#F7F7F7]"
          >
            {t('pages.qaRules.rubrics.collapseAll', 'Fold all')}
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {sections.map((section, sectionIndex) => {
          const sectionOpen = isSectionOpen(section.key)
          const sectionWeight = sumSectionWeights(section)
          const withoutInstruction = section.criteria.filter(
            (criterion) => !(criterion.description ?? '').trim()
          ).length
          return (
            <div key={section.key} className="rounded-lg border border-[#EFEFEF] p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSection(section.key)}
                  aria-expanded={sectionOpen}
                  aria-label={t('pages.qaRules.rubrics.toggleSection', 'Fold / unfold section')}
                  data-testid={`rubric-section-toggle-${section.key}`}
                  className="flex items-center gap-2 rounded-md border border-[#EDEDED] px-2 py-1 text-[11px] whitespace-nowrap text-[#4B5563] hover:bg-[#F7F7F7]"
                >
                  <Icons.ArrowDown
                    size={12}
                    className={
                      sectionOpen ? 'rotate-180 transition-transform' : 'transition-transform'
                    }
                  />
                  <span data-testid={`rubric-section-meta-${section.key}`} className="tabular-nums">
                    {t('pages.qaRules.rubrics.criteriaCount', 'Criteria')}:{' '}
                    {section.criteria.length} · {t('pages.qaRules.rubrics.weightTotal', 'Weights')}:{' '}
                    {sectionWeight}
                  </span>
                </button>
                <input
                  aria-label={t('pages.qaRules.rubrics.sectionName', 'Section name')}
                  value={section.name}
                  onChange={(e) => patchSection(sectionIndex, { name: e.target.value })}
                  placeholder={t('pages.qaRules.rubrics.sectionName', 'Section name')}
                  className={`${QA_INPUT_CLS} min-w-[160px] flex-1`}
                />
                {withoutInstruction > 0 ? (
                  <span
                    data-testid={`rubric-section-missing-${section.key}`}
                    title={t(
                      'pages.qaRules.rubrics.instructionHint',
                      'The AI instruction is what the model grades the criterion by. Left empty, it judges from the criterion name alone and interprets it however it likes.'
                    )}
                    className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-[#B45309]"
                  >
                    {t('pages.qaRules.rubrics.missingInstruction', {
                      defaultValue: 'No AI instruction: {{n}}',
                      n: withoutInstruction,
                    })}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeSection(sectionIndex)}
                  className="rounded-md border border-[#FECACA] px-2 py-1 text-[11px] text-[#B91C1C] hover:bg-[#FEF2F2]"
                >
                  {t('pages.qaRules.rubrics.removeSection', 'Remove section')}
                </button>
              </div>

              {sectionOpen ? (
                <div className="flex flex-col gap-2">
                  {section.criteria.map((criterion, criterionIndex) => (
                    <div
                      key={criterion.key}
                      data-testid={`rubric-criterion-${criterion.key}`}
                      // A card, not a row: the instruction and the speech
                      // examples are paragraphs from the trainers' checklist,
                      // and a horizontal track cannot hold them. Settings stay
                      // on one line at the top; the prose reads underneath.
                      className="flex flex-col gap-2 rounded-md bg-[#FAFAFA] p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          aria-label={t('pages.qaRules.rubrics.criterionName', 'Criterion')}
                          value={criterion.name}
                          onChange={(e) =>
                            patchCriterion(sectionIndex, criterionIndex, { name: e.target.value })
                          }
                          placeholder={t('pages.qaRules.rubrics.criterionName', 'Criterion')}
                          className={`${QA_INPUT_CLS} min-w-[180px] flex-1`}
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          aria-label={t('pages.qaRules.rubrics.weight', 'Weight')}
                          value={criterion.weight}
                          onChange={(e) =>
                            patchCriterion(sectionIndex, criterionIndex, {
                              weight: Number(e.target.value) || 0,
                            })
                          }
                          className={`${QA_INPUT_CLS} w-[90px]`}
                        />
                        <select
                          aria-label={t('pages.qaRules.rubrics.scale', 'Scale')}
                          value={criterion.scale}
                          onChange={(e) =>
                            patchCriterion(sectionIndex, criterionIndex, {
                              scale: e.target.value as CriterionScale,
                            })
                          }
                          className={`${QA_INPUT_CLS} w-[140px]`}
                        >
                          {CRITERION_SCALE_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {t(scaleKey(s), s)}
                            </option>
                          ))}
                        </select>
                        {/* Critical is a flag beside the scale, not a scale of
                        its own — that is how the API models it, and the
                        pipeline caps the whole call at 40 points when such a
                        criterion fails. Without this control a trainer had no
                        way to mark a blocking rule at all. */}
                        <label className="flex items-center gap-2 text-xs whitespace-nowrap text-[#4B5563]">
                          <input
                            type="checkbox"
                            checked={criterion.critical === true}
                            onChange={(e) =>
                              patchCriterion(sectionIndex, criterionIndex, {
                                critical: e.target.checked ? true : null,
                              })
                            }
                          />
                          {t('pages.qaRules.rubrics.critical', 'Critical')}
                        </label>
                        <button
                          type="button"
                          onClick={() => removeCriterion(sectionIndex, criterionIndex)}
                          aria-label={t(
                            'pages.qaRules.rubrics.removeCriterion',
                            'Remove criterion'
                          )}
                          className="rounded-md border border-[#EDEDED] px-2 py-1 text-[11px] text-[#4B5563] hover:bg-[#F7F7F7]"
                        >
                          ×
                        </button>
                      </div>

                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] text-[#6B7280]">
                          {t('pages.qaRules.rubrics.criterionDescription', 'Instruction')}
                        </span>
                        <AutoTextarea
                          value={criterion.description ?? ''}
                          onChange={(e) =>
                            patchCriterion(sectionIndex, criterionIndex, {
                              description: e.target.value,
                            })
                          }
                          placeholder={t(
                            'pages.qaRules.rubrics.criterionDescriptionPlaceholder',
                            'e.g. count it when the operator names themselves, the company and the reason for the call in the first 15 seconds'
                          )}
                          className={QA_TEXTAREA_CLS}
                        />
                      </label>

                      {/* Speech examples were carried through saves but never
                        shown — a trainer could not read, let alone edit, the
                        wording the model is fed. */}
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] text-[#6B7280]">
                          {t('pages.qaRules.rubrics.criterionExamples', 'Speech examples')}
                        </span>
                        <AutoTextarea
                          value={criterion.examples ?? ''}
                          onChange={(e) =>
                            patchCriterion(sectionIndex, criterionIndex, {
                              examples: e.target.value,
                            })
                          }
                          placeholder={t(
                            'pages.qaRules.rubrics.criterionExamplesPlaceholder',
                            'Wording the model should recognise. One example per line.'
                          )}
                          className={QA_TEXTAREA_CLS}
                        />
                      </label>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addCriterion(sectionIndex)}
                    className="self-start rounded-md border border-[#EDEDED] px-2 py-1 text-[11px] text-[#4B5563] hover:bg-[#F7F7F7]"
                  >
                    + {t('pages.qaRules.rubrics.addCriterion', 'Add criterion')}
                  </button>
                </div>
              ) : null}
            </div>
          )
        })}

        <Button
          size="sm"
          variant="cancel"
          leftIcon={<Icons.Add size={14} />}
          onClick={addSection}
          className="self-start"
        >
          {t('pages.qaRules.rubrics.addSection', 'Add section')}
        </Button>

        {/* The unfinished-dialogue scale. Not criteria — bands of the final
          score for a call that was cut short — so it sits below them, folding
          the same way. A rubric that carries no scale gets no section, only
          the action that creates one: an empty stub would read as «there is
          one and nobody filled it in». */}
        {grading == null ? (
          <Button
            size="sm"
            variant="cancel"
            leftIcon={<Icons.Add size={14} />}
            onClick={addGradingScale}
            data-testid="rubric-grading-add"
            className="self-start"
          >
            {t('pages.qaRules.rubrics.grading.add', 'Add an unfinished dialogue scale')}
          </Button>
        ) : (
          <div
            data-testid="rubric-grading-section"
            className="rounded-lg border border-[#EFEFEF] p-3"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => toggleSection(GRADING_SECTION_KEY)}
                aria-expanded={gradingOpen}
                aria-label={t('pages.qaRules.rubrics.toggleSection', 'Fold / unfold section')}
                data-testid="rubric-grading-toggle"
                className="flex items-center gap-2 rounded-md border border-[#EDEDED] px-2 py-1 text-[11px] whitespace-nowrap text-[#4B5563] hover:bg-[#F7F7F7]"
              >
                <Icons.ArrowDown
                  size={12}
                  className={
                    gradingOpen ? 'rotate-180 transition-transform' : 'transition-transform'
                  }
                />
                <span className="tabular-nums">
                  {t('pages.qaRules.rubrics.grading.levels', 'Levels')}: {grading.levels.length}
                </span>
              </button>
              <span className="text-xs font-medium text-[#05040D]">
                {t('pages.qaRules.rubrics.grading.title', 'Unfinished dialogue scale')}
              </span>
              {/* The scale's own line, on the header rather than only in the
                folded body: which calls a scale applies to is the first thing
                a trainer needs, and the card beside it may well say another. */}
              <span
                data-testid="rubric-grading-slice"
                className="flex-1 rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-[11px] text-[#4B5563] sm:flex-none"
              >
                {t('pages.qaRules.rubrics.slice', 'Applies to')}:{' '}
                {grading.telephony_type == null
                  ? t('pages.qaRules.rubrics.telephonyAny', 'Any line')
                  : t(telephonyKey(grading.telephony_type), grading.telephony_type)}
              </span>
              <span className="flex-1" />
              {gradingIssues.length > 0 ? (
                <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-medium text-[#B91C1C]">
                  {t('pages.qaRules.rubrics.grading.blocked', 'Fix before saving')}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setGrading(null)}
                data-testid="rubric-grading-remove"
                className="rounded-md border border-[#FECACA] px-2 py-1 text-[11px] text-[#B91C1C] hover:bg-[#FEF2F2]"
              >
                {t('pages.qaRules.rubrics.grading.remove', 'Remove scale')}
              </button>
            </div>

            {gradingOpen ? (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-[#6B7280]">
                  {t(
                    'pages.qaRules.rubrics.grading.hint',
                    'Bands of the final score for a call the client cut short. The wording tells the model which band a call lands in, and the top band must be 100.'
                  )}
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-[#6B7280]">
                      {t('pages.qaRules.rubrics.grading.heading', 'Scale heading')}
                    </span>
                    <input
                      value={grading.title}
                      onChange={(e) => patchGrading({ title: e.target.value })}
                      placeholder={t('pages.qaRules.rubrics.grading.heading', 'Scale heading')}
                      className={`${QA_INPUT_CLS} w-full`}
                    />
                  </label>
                  {/* The scale carries its own line: the card may judge both
                    lines by one set of criteria while the scale applies to
                    white calls only. */}
                  <label className="flex flex-col gap-1">
                    {/* Named for the scale, not just «Тип телефонії»: the card
                      has a line of its own two fields up, and two controls
                      with one label is how a trainer sets the wrong one. */}
                    <span className="text-[11px] text-[#6B7280]">
                      {t('pages.qaRules.rubrics.grading.line', 'Scale telephony type')}
                    </span>
                    <select
                      aria-label={t('pages.qaRules.rubrics.grading.line', 'Scale telephony type')}
                      value={grading.telephony_type ?? ''}
                      onChange={(e) =>
                        patchGrading({
                          telephony_type:
                            e.target.value === '' ? null : (e.target.value as RubricTelephonyType),
                        })
                      }
                      className={QA_INPUT_CLS}
                    >
                      <option value="">
                        {t('pages.qaRules.rubrics.telephonyAny', 'Any line')}
                      </option>
                      {RUBRIC_TELEPHONY_OPTIONS.map((line) => (
                        <option key={line} value={line}>
                          {t(telephonyKey(line), line)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Where the rule came from. Provenance, not a field to retype
                  — it rides to the model as the rule's origin. */}
                {grading.source ? (
                  <p data-testid="rubric-grading-source" className="text-[11px] text-[#9CA3AF]">
                    {t('pages.qaRules.rubrics.grading.source', 'Source')}: {grading.source}
                  </p>
                ) : null}

                {grading.levels.map((level, index) => (
                  <div
                    key={index}
                    data-testid={`rubric-grading-level-${index}`}
                    className="flex flex-col gap-2 rounded-md bg-[#FAFAFA] p-3 sm:flex-row sm:items-start"
                  >
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] text-[#6B7280]">
                        {t('pages.qaRules.rubrics.grading.score', 'Score')}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={level.score}
                        onChange={(e) =>
                          patchGradingLevel(index, { score: Number(e.target.value) || 0 })
                        }
                        // Reordered on blur, not on every keystroke: the server
                        // returns the bands ascending, so the rows should read
                        // that way — but re-sorting mid-edit would pull the
                        // field out from under the trainer typing in it.
                        onBlur={sortGradingLevels}
                        className={`${QA_INPUT_CLS} w-[90px]`}
                      />
                    </label>
                    <label className="flex flex-1 flex-col gap-1">
                      <span className="text-[11px] text-[#6B7280]">
                        {t('pages.qaRules.rubrics.grading.description', 'When it applies')}
                      </span>
                      <AutoTextarea
                        value={level.description}
                        onChange={(e) => patchGradingLevel(index, { description: e.target.value })}
                        placeholder={t(
                          'pages.qaRules.rubrics.grading.descriptionPlaceholder',
                          'What puts a call in this band'
                        )}
                        className={QA_TEXTAREA_CLS}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeGradingLevel(index)}
                      aria-label={t('pages.qaRules.rubrics.grading.removeLevel', 'Remove level')}
                      className="self-start rounded-md border border-[#EDEDED] px-2 py-1 text-[11px] text-[#4B5563] hover:bg-[#F7F7F7] sm:mt-5"
                    >
                      ×
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addGradingLevel}
                  data-testid="rubric-grading-add-level"
                  className="self-start rounded-md border border-[#EDEDED] px-2 py-1 text-[11px] text-[#4B5563] hover:bg-[#F7F7F7]"
                >
                  + {t('pages.qaRules.rubrics.grading.addLevel', 'Add level')}
                </button>

                {gradingIssues.length > 0 ? (
                  <ul
                    data-testid="rubric-grading-issues"
                    className="list-disc space-y-0.5 pl-5 text-[11px] text-[#B91C1C]"
                  >
                    {gradingIssues.map((issue) => (
                      <li key={issue}>{t(issue, issue)}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EBECE8] pt-3">
        <span
          data-testid="rubric-weight-total"
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            weightValid ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEE2E2] text-[#B91C1C]'
          }`}
        >
          {t('pages.qaRules.rubrics.weightTotal', 'Weights')}: {totalWeight} / {RUBRIC_TOTAL_WEIGHT}
        </span>
        <div className="flex items-center gap-2">
          {!weightValid ? (
            <span className="text-[11px] text-[#B91C1C]">
              {t('pages.qaRules.rubrics.weightError', 'Weights must add up to 100')}
            </span>
          ) : null}
          {onCancel ? (
            <Button size="sm" variant="cancel" onClick={onCancel}>
              {t('actions.cancel', 'Cancel')}
            </Button>
          ) : null}
          <Button size="sm" variant="primary" disabled={!canSave} onClick={handleSave}>
            {t('actions.save', 'Save')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AiRubricEditor
