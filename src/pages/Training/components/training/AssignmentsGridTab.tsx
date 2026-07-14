import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useHasPermission } from '@/hooks'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import {
  useTrainingAssignments,
  useUpdateAssignmentDeadline,
} from '@/features/training/hooks/useTrainingAssignments'
import type { AssignmentRow, AssignmentStatus } from '@/features/training/types/trainingAssignments'
import { TrainingFilterChips, TrainingSearchBar } from './TrainingToolbar'

const PAGE_SIZE = 100

const STATUS_BADGE: Record<AssignmentStatus, { label: string; tone: string; bg: string }> = {
  done: { label: 'Done', tone: 'text-[#15803D]', bg: 'bg-[#DCFCE7]' },
  in_progress: { label: 'In Progress', tone: 'text-[#B45309]', bg: 'bg-[#FEF3C7]' },
  overdue: { label: 'Overdue', tone: 'text-[#B91C1C]', bg: 'bg-[#FEE2E2]' },
}

interface Row extends AssignmentRow {
  id: number
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

/** A picker date (YYYY-MM-DD) → end-of-day ISO, so the backend's `datetime` param parses. */
function dateToDeadlineIso(date: string): string {
  return new Date(`${date}T23:59:59`).toISOString()
}

function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

export function AssignmentsGridTab() {
  const { t } = useTranslation('common')
  const canView = useHasPermission('view_courses')
  const canManage = useHasPermission('manage_courses')
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)

  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const [deadlineTarget, setDeadlineTarget] = useState<AssignmentRow | null>(null)
  const [detailsTarget, setDetailsTarget] = useState<AssignmentRow | null>(null)

  const filters = useMemo(
    () => ({
      status: statusFilter === 'all' ? undefined : statusFilter,
      q: query || undefined,
      limit: PAGE_SIZE,
      offset: 0,
    }),
    [statusFilter, query]
  )

  const { data, isLoading, isError } = useTrainingAssignments(filters, canView)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null, {
    includeInactive: true,
  })

  const operatorMap = useMemo(() => {
    const map = new Map<number, (typeof operators)[number]>()
    operators.forEach((o) => map.set(o.id, o))
    return map
  }, [operators])

  const rows = useMemo<Row[]>(
    () => (data?.rows ?? []).map((r) => ({ ...r, id: r.enrollment_id })),
    [data?.rows]
  )
  const kpis = data?.kpis ?? { total_active: 0, completed: 0, overdue: 0 }

  const statusChips = useMemo(
    () => [
      { id: 'all', label: t('pages.training.assignments.filters.all', 'All') },
      { id: 'in_progress', label: STATUS_BADGE.in_progress.label },
      { id: 'overdue', label: STATUS_BADGE.overdue.label },
      { id: 'done', label: STATUS_BADGE.done.label },
    ],
    [t]
  )

  const columns = useMemo<Column<Row>[]>(
    () => [
      {
        key: 'operator',
        header: t('pages.training.assignments.columns.operator', 'Operator'),
        render: (r) => {
          const op = operatorMap.get(r.operator_id)
          const name = op
            ? `${op.first_name ?? ''} ${op.last_name ?? ''}`.trim() || `#${r.operator_id}`
            : `#${r.operator_id}`
          const team = op?.department_name
          const ext = op?.asterisk_extension
          return (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-[#05040D]">{name}</span>
              <span className="text-[10px] text-[#6B7280]">
                {[team, ext ? `ext. ${ext}` : null].filter(Boolean).join(' · ') || '—'}
              </span>
            </div>
          )
        },
      },
      {
        key: 'course',
        header: t('pages.training.assignments.columns.course', 'Course'),
        render: (r) => (
          <div className="flex flex-col">
            <span className="text-sm text-[#05040D]">{r.course_title}</span>
            <span className="text-[10px] text-[#6B7280]">
              {[
                r.duration_minutes ? `${r.duration_minutes} min` : null,
                `${r.lesson_count} ${t('pages.training.assignments.modules', 'modules')}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
        ),
      },
      {
        key: 'category',
        header: t('pages.training.assignments.columns.category', 'Category'),
        render: (r) =>
          r.category ? (
            <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-medium text-[#374151]">
              {r.category}
            </span>
          ) : (
            <span className="text-[10px] text-[#9CA3AF]">—</span>
          ),
      },
      {
        key: 'progress',
        header: t('pages.training.assignments.columns.progress', 'Progress'),
        render: (r) => (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#F1F1EE]">
              <div
                className="h-full rounded-full bg-[#BBFB5B]"
                style={{ width: `${r.progress_pct}%` }}
              />
            </div>
            <span className="text-[10px] text-[#6B7280]">{r.progress_pct}%</span>
          </div>
        ),
      },
      {
        key: 'deadline',
        header: t('pages.training.assignments.columns.deadline', 'Deadline'),
        render: (r) => <span className="text-xs text-[#374151]">{formatDate(r.deadline)}</span>,
      },
      {
        key: 'status',
        header: t('pages.training.assignments.columns.status', 'Status'),
        render: (r) => {
          const badge = STATUS_BADGE[r.status]
          return (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.bg} ${badge.tone}`}
            >
              {badge.label}
            </span>
          )
        },
      },
      {
        key: 'actions',
        header: t('pages.training.assignments.columns.actions', 'Actions'),
        align: 'right',
        render: (r) => (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDetailsTarget(r)}
              className="text-xs text-[#204E4D] hover:underline"
            >
              {t('actions.details', 'Details')}
            </button>
            {canManage && (
              <button
                type="button"
                onClick={() => setDeadlineTarget(r)}
                className="text-xs text-[#6B7280] hover:underline"
              >
                {t('pages.training.assignments.changeDeadline', 'Deadline')}
              </button>
            )}
          </div>
        ),
      },
    ],
    [t, operatorMap, canManage]
  )

  if (!canView) {
    return (
      <div className="rounded-xl border border-dashed border-[#EBECE8] bg-white p-8 text-center text-xs text-[#6B7280]">
        {t('pages.training.assignments.noAccess', 'You do not have access to assignments.')}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          label={t('pages.training.assignments.kpi.active', 'Active assignments')}
          value={kpis.total_active}
        />
        <KpiCard
          label={t('pages.training.assignments.kpi.completed', 'Completed')}
          value={kpis.completed}
        />
        <KpiCard
          label={t('pages.training.assignments.kpi.overdue', 'Overdue')}
          value={kpis.overdue}
          danger={kpis.overdue > 0}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <TrainingSearchBar
          value={query}
          onChange={setQuery}
          placeholder={t('pages.training.assignments.searchPlaceholder', 'Search by course...')}
        />
        <TrainingFilterChips
          items={statusChips}
          activeId={statusFilter}
          onChange={(id) => setStatusFilter(id as AssignmentStatus | 'all')}
        />
      </div>

      {isError ? (
        <div className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-4 text-xs text-[#B91C1C]">
          {t('pages.training.assignments.loadError', 'Failed to load assignments.')}
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          emptyMessage={
            isLoading
              ? t('pages.training.assignments.loading', 'Loading assignments...')
              : t('pages.training.assignments.empty', 'No assignments yet.')
          }
        />
      )}

      <ChangeDeadlineDialog target={deadlineTarget} onClose={() => setDeadlineTarget(null)} />
      <AssignmentDetailsDialog
        target={detailsTarget}
        operatorName={
          detailsTarget
            ? (() => {
                const op = operatorMap.get(detailsTarget.operator_id)
                return op
                  ? `${op.first_name ?? ''} ${op.last_name ?? ''}`.trim() ||
                      `#${detailsTarget.operator_id}`
                  : `#${detailsTarget.operator_id}`
              })()
            : ''
        }
        onClose={() => setDetailsTarget(null)}
      />
    </div>
  )
}

function KpiCard({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-[#EBECE8] bg-white p-4">
      <div className="text-xs text-[#6B7280]">{label}</div>
      <div className={`text-2xl font-semibold ${danger ? 'text-[#B91C1C]' : 'text-[#05040D]'}`}>
        {value}
      </div>
    </div>
  )
}

function ChangeDeadlineDialog({
  target,
  onClose,
}: {
  target: AssignmentRow | null
  onClose: () => void
}) {
  const { t } = useTranslation('common')
  const mutation = useUpdateAssignmentDeadline()
  const [date, setDate] = useState('')

  const [trackedId, setTrackedId] = useState<number | null>(null)
  if (target && target.enrollment_id !== trackedId) {
    setTrackedId(target.enrollment_id)
    setDate(isoToDateInput(target.deadline))
  }

  const handleSave = async () => {
    if (!target) return
    try {
      await mutation.mutateAsync({
        enrollmentId: target.enrollment_id,
        deadline: date ? dateToDeadlineIso(date) : null,
      })
      toast.success(t('pages.training.assignments.deadlineSaved', 'Deadline updated.'))
      onClose()
    } catch {
      toast.error(t('pages.training.assignments.deadlineError', 'Could not update the deadline.'))
    }
  }

  return (
    <Modal open={target != null} onClose={onClose} maxWidth="sm">
      <ModalHeader title={t('pages.training.assignments.changeDeadlineTitle', 'Change deadline')} />
      <ModalContent>
        <div className="flex flex-col gap-1">
          <label htmlFor="assignment-deadline" className="text-xs font-medium text-gray-600">
            {t('pages.training.assignments.columns.deadline', 'Deadline')}
          </label>
          <Input
            id="assignment-deadline"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-[40px] text-sm"
          />
          <span className="text-[10px] text-[#6B7280]">
            {t('pages.training.assignments.deadlineHint', 'Leave empty to clear the deadline.')}
          </span>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button
          variant="cancel"
          size="md"
          onClick={onClose}
          disabled={mutation.isPending}
          className="rounded-full"
        >
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={handleSave}
          disabled={mutation.isPending}
          className="rounded-full"
        >
          {t('actions.save', 'Save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

function AssignmentDetailsDialog({
  target,
  operatorName,
  onClose,
}: {
  target: AssignmentRow | null
  operatorName: string
  onClose: () => void
}) {
  const { t } = useTranslation('common')
  return (
    <Modal open={target != null} onClose={onClose} maxWidth="md">
      <ModalHeader title={t('pages.training.assignments.detailsTitle', 'Assignment details')} />
      <ModalContent>
        {target && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Detail
              label={t('pages.training.assignments.columns.operator', 'Operator')}
              value={operatorName}
            />
            <Detail
              label={t('pages.training.assignments.columns.course', 'Course')}
              value={target.course_title}
            />
            <Detail
              label={t('pages.training.assignments.columns.category', 'Category')}
              value={target.category ?? '—'}
            />
            <Detail
              label={t('pages.training.assignments.modulesLabel', 'Modules')}
              value={String(target.lesson_count)}
            />
            <Detail
              label={t('pages.training.assignments.columns.progress', 'Progress')}
              value={`${target.progress_pct}%`}
            />
            <Detail
              label={t('pages.training.assignments.columns.status', 'Status')}
              value={STATUS_BADGE[target.status].label}
            />
            <Detail
              label={t('pages.training.assignments.columns.deadline', 'Deadline')}
              value={formatDate(target.deadline)}
            />
            <Detail
              label={t('pages.training.assignments.assignedAt', 'Assigned')}
              value={formatDate(target.assigned_at)}
            />
          </dl>
        )}
      </ModalContent>
      <ModalFooter>
        <Button variant="cancel" size="md" onClick={onClose} className="rounded-full">
          {t('actions.close', 'Close')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] tracking-wide text-[#9CA3AF] uppercase">{label}</dt>
      <dd className="text-[#05040D]">{value}</dd>
    </div>
  )
}

export default AssignmentsGridTab
