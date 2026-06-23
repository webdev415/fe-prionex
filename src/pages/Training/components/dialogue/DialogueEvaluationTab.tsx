import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useScorecards } from '@/features/quality'
import { useOperators } from '@/features/users/hooks'
import { useAuthStore } from '@/stores/authStore'
import { buildDialogueRows } from '../../lib/dialogueScorecardAdapter'
import { useScopedUserIds } from '../../lib/scope'
import { TrainingSegmentedStrip } from '../chrome/TrainingSegmentedStrip'
import { PendingFeatureDialog } from '../inbox/PendingFeatureDialog'
import { EmployeeMultiSelect } from './EmployeeMultiSelect'
import { ScorecardListView } from './ScorecardListView'
import { ScorecardDetailPanel } from './ScorecardDetailPanel'

type CategoryChip = 'all' | 'new' | 'average' | 'risk'

const DEFAULT_PAGE_SIZE = 50

export function DialogueEvaluationTab() {
  const { t } = useTranslation('common')
  const [activeCategory, setActiveCategory] = useState<CategoryChip>('all')
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([])

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)
  const scoped = useScopedUserIds(operators)

  const filters = useMemo(
    () => ({
      operator_id: selectedEmployeeIds.length > 0 ? selectedEmployeeIds : scoped.userIds,
      page: 1,
      page_size: DEFAULT_PAGE_SIZE,
    }),
    [selectedEmployeeIds, scoped.userIds]
  )

  const { data, isLoading, isError } = useScorecards(filters, !scoped.isEmptyResolution)

  const rows = useMemo(
    () => buildDialogueRows(data?.data ?? [], operators),
    [data?.data, operators]
  )

  const categoryCounts = useMemo(
    () => ({
      all: rows.length,
      new: rows.filter((r) => r.category === 'New').length,
      average: rows.filter((r) => r.category === 'Average').length,
      risk: rows.filter((r) => r.category === 'Risk').length,
    }),
    [rows]
  )

  const categoryChips = useMemo(
    () =>
      (
        [
          { id: 'all' as const, label: t('pages.training.dialogue.chips.all', 'All scores') },
          { id: 'new' as const, label: t('pages.training.dialogue.chips.new', 'New') },
          { id: 'average' as const, label: t('pages.training.dialogue.chips.average', 'Average') },
          { id: 'risk' as const, label: t('pages.training.dialogue.chips.risk', 'Risk') },
        ] as const
      ).map((c) => ({
        id: c.id,
        label: c.label,
        count: categoryCounts[c.id],
      })),
    [t, categoryCounts]
  )

  const filteredRows = useMemo(
    () =>
      rows.filter((r) => {
        if (activeCategory === 'all') return true
        if (activeCategory === 'new') return r.category === 'New'
        if (activeCategory === 'average') return r.category === 'Average'
        if (activeCategory === 'risk') return r.category === 'Risk'
        return true
      }),
    [rows, activeCategory]
  )

  // Derive the effective selection during render (no setState-in-effect):
  // honour the user's pick while it's still visible, else fall back to the
  // first row in the active filter.
  const effectiveSelectedId =
    selectedRowId != null && filteredRows.some((r) => r.id === selectedRowId)
      ? selectedRowId
      : (filteredRows[0]?.id ?? null)

  const selectedRow = useMemo(
    () => rows.find((r) => r.id === effectiveSelectedId),
    [rows, effectiveSelectedId]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TrainingSegmentedStrip
          items={categoryChips}
          activeId={activeCategory}
          onChange={(id) => setActiveCategory(id as CategoryChip)}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScheduleOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[#BBFB5B] px-4 text-xs font-medium text-[#05040D] transition-colors hover:bg-[#a8e848]"
          >
            <Icons.Add size={14} />
            {t('pages.training.dialogue.scheduleSession', 'Schedule a session')}
          </button>
          <EmployeeMultiSelect
            value={selectedEmployeeIds}
            onChange={setSelectedEmployeeIds}
            operators={operators}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_400px]">
        {scoped.isEmptyResolution ? (
          <div className="rounded-xl bg-white/50 p-12 text-center text-sm text-gray-500 shadow-sm">
            {t(
              'pages.training.errors.emptyScopeResolution',
              'The selected scope returned no operators.'
            )}
          </div>
        ) : isLoading ? (
          <div className="rounded-xl bg-white p-12 text-center text-sm text-[#6B7280] shadow-sm">
            {t('common.loading', 'Loading…')}
          </div>
        ) : isError ? (
          <div className="rounded-xl bg-white p-12 text-center text-sm text-red-500 shadow-sm">
            {t('pages.training.errors.loadScorecardsFailed', 'Failed to load scorecards')}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center text-sm text-[#6B7280] shadow-sm">
            {t('pages.training.scorecardsEmpty', 'No scorecards in scope.')}
          </div>
        ) : (
          <ScorecardListView
            rows={filteredRows}
            selectedId={effectiveSelectedId}
            onSelect={setSelectedRowId}
          />
        )}
        <ScorecardDetailPanel row={selectedRow} />
      </div>

      <PendingFeatureDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        titleKey="pages.training.dialogue.scheduleSession"
        titleFallback="Schedule a session"
        descriptionKey="pages.training.dialogue.pending.scheduleSession"
        descriptionFallback="Plan a dialogue evaluation or coaching session with an operator."
        dependsOnIssue="KAN-504"
      />
    </div>
  )
}

export default DialogueEvaluationTab
