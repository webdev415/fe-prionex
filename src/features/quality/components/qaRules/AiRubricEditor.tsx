/**
 * AiRubricEditor — the sections → criteria editor for one AI rubric
 * (`purpose='ai'` scorecard template).
 *
 * The header carries the slice the rubric applies to (interlocutor type +
 * department; department NULL = universal fallback). The body is a list of
 * sections, each a list of criteria (name, weight, scale, description).
 *
 * quality-service enforces «criteria weights sum to exactly 100» for AI
 * rubrics — the footer shows the running total and Save stays disabled
 * until it lands on 100, so the rule is visible before the request.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'

import {
  isRubricWeightValid,
  makeUniqueKey,
  RUBRIC_TOTAL_WEIGHT,
  sumCriteriaWeights,
} from '../../lib/rubricWeights'
import type {
  Criterion,
  CriterionScale,
  ScorecardTemplate,
  ScorecardType,
  Section,
  TemplateCreatePayload,
} from '../../types'
import { CRITERION_SCALE_OPTIONS, QA_INPUT_CLS, scaleKey } from './qaRuleOptions'

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
      key: criterion.key,
      name: criterion.name,
      // Seeded rubrics may omit `scale` — the pipeline's default is the 0..5 band.
      scale: (criterion.scale ?? '0-5') as CriterionScale,
      weight: Number(criterion.weight) || 0,
      description: criterion.description ?? '',
    })),
  }))
}

function collectKeys(sections: Section[]): Set<string> {
  const keys = new Set<string>()
  for (const section of sections) {
    keys.add(section.key)
    for (const criterion of section.criteria) keys.add(criterion.key)
  }
  return keys
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
  const [sections, setSections] = useState<Section[]>(() => cloneSections(rubric?.sections))

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

  // Another *active* rubric on the same slice → saving this one is refused
  // server-side. Say so before the request instead of after the toast.
  const sliceOwner = useMemo(() => {
    const target = departmentId === '' ? null : Number(departmentId)
    return siblings.find(
      (r) =>
        r.id !== rubric?.id &&
        !r.is_archived &&
        (r.scorecard_type ?? 'client') === scorecardType &&
        (r.department_id ?? null) === target
    )
  }, [siblings, rubric?.id, scorecardType, departmentId])

  const totalWeight = useMemo(() => sumCriteriaWeights(sections), [sections])
  const weightValid = isRubricWeightValid(sections)
  const nameValid = name.trim().length > 0
  const hasCriteria = sections.some((s) => s.criteria.length > 0)
  const canSave = nameValid && weightValid && hasCriteria && !saving

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
            key: criterionKey,
            name: criterion.name.trim(),
            scale: criterion.scale,
            weight: Number(criterion.weight) || 0,
            description: criterion.description?.trim() || null,
          }
        }),
      }
    })

    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        purpose: 'ai',
        scorecard_type: scorecardType,
        department_id: departmentId === '' ? null : Number(departmentId),
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
          {t('pages.qaRules.rubrics.slice', 'Applies to')}: {typeLabel} · {departmentLabel}
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
            {t('pages.qaRules.rubrics.description', 'Description')}
          </span>
          <input
            value={description ?? ''}
            onChange={(e) => setDescription(e.target.value)}
            className={`${QA_INPUT_CLS} w-full`}
          />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        {sections.map((section, sectionIndex) => (
          <div key={section.key} className="rounded-lg border border-[#EFEFEF] p-3">
            <div className="mb-2 flex items-center gap-2">
              <input
                aria-label={t('pages.qaRules.rubrics.sectionName', 'Section name')}
                value={section.name}
                onChange={(e) => patchSection(sectionIndex, { name: e.target.value })}
                placeholder={t('pages.qaRules.rubrics.sectionName', 'Section name')}
                className={`${QA_INPUT_CLS} flex-1`}
              />
              <button
                type="button"
                onClick={() => removeSection(sectionIndex)}
                className="rounded-md border border-[#FECACA] px-2 py-1 text-[11px] text-[#B91C1C] hover:bg-[#FEF2F2]"
              >
                {t('pages.qaRules.rubrics.removeSection', 'Remove section')}
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {section.criteria.map((criterion, criterionIndex) => (
                <div
                  key={criterion.key}
                  className="grid grid-cols-1 gap-2 rounded-md bg-[#FAFAFA] p-2 sm:grid-cols-[1fr_90px_140px_1fr_auto]"
                >
                  <input
                    aria-label={t('pages.qaRules.rubrics.criterionName', 'Criterion')}
                    value={criterion.name}
                    onChange={(e) =>
                      patchCriterion(sectionIndex, criterionIndex, { name: e.target.value })
                    }
                    placeholder={t('pages.qaRules.rubrics.criterionName', 'Criterion')}
                    className={QA_INPUT_CLS}
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
                    className={QA_INPUT_CLS}
                  />
                  <select
                    aria-label={t('pages.qaRules.rubrics.scale', 'Scale')}
                    value={criterion.scale}
                    onChange={(e) =>
                      patchCriterion(sectionIndex, criterionIndex, {
                        scale: e.target.value as CriterionScale,
                      })
                    }
                    className={QA_INPUT_CLS}
                  >
                    {CRITERION_SCALE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {t(scaleKey(s), s)}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={t('pages.qaRules.rubrics.criterionDescription', 'Instruction')}
                    value={criterion.description ?? ''}
                    onChange={(e) =>
                      patchCriterion(sectionIndex, criterionIndex, { description: e.target.value })
                    }
                    placeholder={t('pages.qaRules.rubrics.criterionDescription', 'Instruction')}
                    className={QA_INPUT_CLS}
                  />
                  <button
                    type="button"
                    onClick={() => removeCriterion(sectionIndex, criterionIndex)}
                    aria-label={t('pages.qaRules.rubrics.removeCriterion', 'Remove criterion')}
                    className="rounded-md border border-[#EDEDED] px-2 text-[11px] text-[#4B5563] hover:bg-[#F7F7F7]"
                  >
                    ×
                  </button>
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
          </div>
        ))}

        <Button
          size="sm"
          variant="cancel"
          leftIcon={<Icons.Add size={14} />}
          onClick={addSection}
          className="self-start"
        >
          {t('pages.qaRules.rubrics.addSection', 'Add section')}
        </Button>
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
