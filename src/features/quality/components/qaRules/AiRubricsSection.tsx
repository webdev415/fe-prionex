/**
 * AiRubricsSection — the AI rubrics the brain scores calls against
 * (`purpose='ai'` scorecard templates).
 *
 * List on the left of the slice filters (interlocutor type, department,
 * active/archived), editor below. Archiving is what deactivates a rubric —
 * activity is «not archived», and quality-service keeps at most one active
 * rubric per (department, interlocutor) slice, so un-archiving can be
 * refused server-side; the error surfaces as a toast.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/useConfirm'
import { Icons } from '@/lib/icons'
import { useAuthStore } from '@/stores/authStore'
import { useDepartments } from '@/features/departments'

import {
  useArchiveQaRubric,
  useCreateQaRubric,
  useQaRubrics,
  useUnarchiveQaRubric,
  useUpdateQaRubric,
} from '../../hooks/useQaRules'
import { conflictDetail, isConflict } from '../../lib/qaRuleErrors'
import { sumCriteriaWeights } from '../../lib/rubricWeights'
import type {
  ScorecardTemplate,
  ScorecardType,
  TemplateCreatePayload,
  TemplateUpdatePayload,
} from '../../types'
import { AiRubricEditor, type DepartmentOption } from './AiRubricEditor'
import { QA_INPUT_CLS } from './qaRuleOptions'

type TypeFilter = '' | ScorecardType
type StatusFilter = 'active' | 'archived' | 'all'

const TH = 'px-3 py-2 text-left text-[11px] font-medium text-[#6B7280]'
const TD = 'px-3 py-2 align-middle text-xs text-[#05040D]'

export function AiRubricsSection() {
  const { t } = useTranslation('common')
  const { confirm, confirmDialog } = useConfirm()

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const departmentsQuery = useDepartments({
    project_id: activeProjectId ? Number(activeProjectId) : undefined,
    is_active: true,
    page_size: 200,
  })
  const departments = useMemo<DepartmentOption[]>(
    () =>
      (departmentsQuery.data?.departments ?? []).map((d) => ({
        id: d.id,
        name: d.name,
      })),
    [departmentsQuery.data]
  )
  const departmentName = (id: number | null) =>
    id == null
      ? t('pages.qaRules.rubrics.universal', 'Universal (fallback)')
      : (departments.find((d) => d.id === id)?.name ?? `ID ${id}`)

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('')
  const [departmentFilter, setDepartmentFilter] = useState<number | 'all' | 'universal'>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [editing, setEditing] = useState<{ mode: 'create' } | { mode: 'edit'; id: number } | null>(
    null
  )

  const { data: rubrics = [], isLoading, isError } = useQaRubrics(statusFilter !== 'active')

  const createMutation = useCreateQaRubric()
  const updateMutation = useUpdateQaRubric()
  const archiveMutation = useArchiveQaRubric()
  const unarchiveMutation = useUnarchiveQaRubric()

  const visible = useMemo(() => {
    return rubrics.filter((rubric) => {
      if (statusFilter === 'active' && rubric.is_archived) return false
      if (statusFilter === 'archived' && !rubric.is_archived) return false
      if (typeFilter && (rubric.scorecard_type ?? 'client') !== typeFilter) return false
      if (departmentFilter === 'universal' && rubric.department_id != null) return false
      if (typeof departmentFilter === 'number' && rubric.department_id !== departmentFilter)
        return false
      return true
    })
  }, [rubrics, statusFilter, typeFilter, departmentFilter])

  const editingRubric: ScorecardTemplate | undefined =
    editing?.mode === 'edit' ? rubrics.find((r) => r.id === editing.id) : undefined

  /**
   * quality-service keeps at most one live rubric per
   * (department, interlocutor) slice and answers 409 naming the conflict —
   * relayed verbatim, since "archive that one first" is only actionable if
   * the trainer knows which one.
   */
  const reportError = (error: unknown) => {
    if (isConflict(error)) {
      // NB: `sliceTaken` interpolates {{name}} and belongs to the editor's
      // warning, which knows the owner. Here the name only exists inside the
      // server's detail, so the nameless variant is the fallback.
      toast.error(
        conflictDetail(error) ??
          t('pages.qaRules.rubrics.sliceTakenGeneric', 'This slice already has a live rubric')
      )
      return
    }
    toast.error(t('pages.qaRules.saveError', 'Could not save the change'))
  }

  const handleSave = async (payload: TemplateCreatePayload) => {
    try {
      if (editing?.mode === 'edit') {
        // `purpose` is immutable server-side; echoing it back is pointless
        // and answers 409 the moment it ever disagrees with the stored value.
        const updatable: TemplateUpdatePayload = {
          name: payload.name,
          description: payload.description,
          scorecard_type: payload.scorecard_type,
          department_id: payload.department_id,
          sections: payload.sections,
        }
        await updateMutation.mutateAsync({ id: editing.id, payload: updatable })
      } else {
        await createMutation.mutateAsync(payload)
      }
      setEditing(null)
      toast.success(t('pages.qaRules.rubrics.saved', 'Rubric saved'))
    } catch (error) {
      reportError(error)
    }
  }

  const handleArchiveToggle = async (rubric: ScorecardTemplate) => {
    const archiving = !rubric.is_archived
    const ok = await confirm({
      title: archiving
        ? t('pages.qaRules.rubrics.archiveTitle', 'Archive rubric?')
        : t('pages.qaRules.rubrics.unarchiveTitle', 'Restore rubric?'),
      message: rubric.name,
      confirmLabel: archiving
        ? t('pages.qaRules.rubrics.archive', 'Archive')
        : t('pages.qaRules.rubrics.unarchive', 'Restore'),
      tone: archiving ? 'danger' : 'default',
    })
    if (!ok) return
    try {
      if (archiving) await archiveMutation.mutateAsync(rubric.id)
      else await unarchiveMutation.mutateAsync(rubric.id)
      if (editing?.mode === 'edit' && editing.id === rubric.id) setEditing(null)
    } catch (error) {
      reportError(error)
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="flex flex-col gap-3" data-testid="ai-rubrics-section">
      {confirmDialog}

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={t('pages.qaRules.rubrics.scorecardType', 'Interlocutor')}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          className={QA_INPUT_CLS}
        >
          <option value="">{t('pages.qaRules.rubrics.allTypes', 'All interlocutors')}</option>
          <option value="client">{t('pages.qaRules.rubrics.typeClient', 'Debtor')}</option>
          <option value="third_party">
            {t('pages.qaRules.rubrics.typeThirdParty', 'Third party')}
          </option>
        </select>
        <select
          aria-label={t('pages.qaRules.rubrics.department', 'Department')}
          value={String(departmentFilter)}
          onChange={(e) => {
            const raw = e.target.value
            setDepartmentFilter(raw === 'all' || raw === 'universal' ? raw : Number(raw))
          }}
          className={QA_INPUT_CLS}
        >
          <option value="all">
            {t('pages.qaRules.rubrics.allDepartments', 'All departments')}
          </option>
          <option value="universal">
            {t('pages.qaRules.rubrics.universal', 'Universal (fallback)')}
          </option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          aria-label={t('pages.qaRules.rubrics.status', 'Status')}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className={QA_INPUT_CLS}
        >
          <option value="active">{t('pages.qaRules.rubrics.statusActive', 'Active')}</option>
          <option value="archived">{t('pages.qaRules.rubrics.statusArchived', 'Archived')}</option>
          <option value="all">{t('pages.qaRules.rubrics.statusAll', 'All')}</option>
        </select>
        <Button
          size="sm"
          variant="primary"
          leftIcon={<Icons.Add size={14} />}
          onClick={() => setEditing({ mode: 'create' })}
        >
          {t('pages.qaRules.rubrics.create', 'New rubric')}
        </Button>
      </div>

      {isError ? (
        <div className="rounded-lg bg-white p-6 text-center text-xs text-red-500 shadow-sm">
          {t('pages.qaRules.rubrics.loadError', 'Failed to load AI rubrics.')}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-[#EBECE8] bg-white">
        <table className="w-full min-w-[720px] border-collapse">
          <thead className="border-b border-[#EBECE8] bg-[#FAFAFA]">
            <tr>
              <th className={TH}>{t('pages.qaRules.rubrics.name', 'Rubric name')}</th>
              <th className={TH}>{t('pages.qaRules.rubrics.scorecardType', 'Interlocutor')}</th>
              <th className={TH}>{t('pages.qaRules.rubrics.department', 'Department')}</th>
              <th className={TH}>{t('pages.qaRules.rubrics.weightTotal', 'Weights')}</th>
              <th className={TH}>{t('pages.qaRules.rubrics.status', 'Status')}</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className={`${TD} text-center text-[#6B7280]`} colSpan={6}>
                  {t('common.loading', 'Loading…')}
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td className={`${TD} text-center text-[#6B7280]`} colSpan={6}>
                  {t('pages.qaRules.rubrics.empty', 'No AI rubrics for this slice.')}
                </td>
              </tr>
            ) : (
              visible.map((rubric) => (
                <tr key={rubric.id} className="border-b border-[#F1F1F1]">
                  <td className={TD}>{rubric.name}</td>
                  <td className={TD}>
                    {rubric.scorecard_type === 'third_party'
                      ? t('pages.qaRules.rubrics.typeThirdParty', 'Third party')
                      : t('pages.qaRules.rubrics.typeClient', 'Debtor')}
                  </td>
                  <td className={TD}>{departmentName(rubric.department_id)}</td>
                  <td className={`${TD} tabular-nums`}>{sumCriteriaWeights(rubric.sections)}</td>
                  <td className={TD}>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        rubric.is_archived
                          ? 'bg-[#F3F4F6] text-[#6B7280]'
                          : 'bg-[#DCFCE7] text-[#15803D]'
                      }`}
                    >
                      {rubric.is_archived
                        ? t('pages.qaRules.rubrics.statusArchived', 'Archived')
                        : t('pages.qaRules.rubrics.statusActive', 'Active')}
                    </span>
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={rubric.is_archived}
                        onClick={() => setEditing({ mode: 'edit', id: rubric.id })}
                        className="rounded-md border border-[#EDEDED] px-2 py-1 text-[11px] text-[#4B5563] hover:bg-[#F7F7F7] disabled:opacity-40"
                      >
                        {t('actions.edit', 'Edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchiveToggle(rubric)}
                        className="rounded-md border border-[#EDEDED] px-2 py-1 text-[11px] text-[#4B5563] hover:bg-[#F7F7F7]"
                      >
                        {rubric.is_archived
                          ? t('pages.qaRules.rubrics.unarchive', 'Restore')
                          : t('pages.qaRules.rubrics.archive', 'Archive')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing ? (
        <AiRubricEditor
          // Remount on target change so the editor's local draft is rebuilt.
          key={editing.mode === 'edit' ? editing.id : 'new'}
          rubric={editingRubric}
          departments={departments}
          siblings={rubrics}
          saving={saving}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}

export default AiRubricsSection
