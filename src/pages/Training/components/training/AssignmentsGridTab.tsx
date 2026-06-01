import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import {
  MOCK_ASSIGNMENT_KPIS,
  MOCK_ASSIGNMENTS,
  type AssignmentStatus,
  type MockAssignment,
} from '../../mocks/trainerWorkplaceMocks'

/**
 * Assignments Grid sub-tab (KAN-498). KPI strip on top, then table of
 * `operator Ã— course` with progress bar, deadline, status badge.
 */
const STATUS_BADGE: Record<AssignmentStatus, { label: string; tone: string }> = {
  not_started: { label: 'Not started', tone: 'bg-gray-100 text-gray-700' },
  in_progress: { label: 'In progress', tone: 'bg-blue-100 text-blue-700' },
  done: { label: 'Done', tone: 'bg-emerald-100 text-emerald-700' },
  overdue: { label: 'Overdue', tone: 'bg-red-100 text-red-700' },
}

export function AssignmentsGridTab() {
  const { t } = useTranslation('common')
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | 'all'>('all')

  const filtered = MOCK_ASSIGNMENTS.filter(
    (a) => statusFilter === 'all' || a.status === statusFilter
  )

  const kpi = MOCK_ASSIGNMENT_KPIS

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiTile
          label={t('pages.training.training.assignments.kpis.totalActive', 'Total active')}
          value={kpi.totalActive}
          tone="text-dark-500"
        />
        <KpiTile
          label={t('pages.training.training.assignments.kpis.completed', 'Completed')}
          value={`${kpi.completed} of ${kpi.completedOfTotal}`}
          tone="text-emerald-600"
        />
        <KpiTile
          label={t('pages.training.training.assignments.kpis.overdue', 'Overdue')}
          value={kpi.overdue}
          tone="text-red-600"
        />
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'not_started', 'in_progress', 'done', 'overdue'] as const).map((s) => {
          const isActive = s === statusFilter
          const label =
            s === 'all'
              ? t('pages.training.training.assignments.statusAll', 'All assignments')
              : STATUS_BADGE[s].label
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Assignments table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-left text-[10px] text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3">
                {t('pages.training.training.assignments.cols.operator', 'Operator')}
              </th>
              <th className="px-4 py-3">
                {t('pages.training.training.assignments.cols.course', 'Course')}
              </th>
              <th className="px-4 py-3">
                {t('pages.training.training.assignments.cols.category', 'Category')}
              </th>
              <th className="px-4 py-3">
                {t('pages.training.training.assignments.cols.progress', 'Progress')}
              </th>
              <th className="px-4 py-3">
                {t('pages.training.training.assignments.cols.deadline', 'Deadline')}
              </th>
              <th className="px-4 py-3">
                {t('pages.training.training.assignments.cols.status', 'Status')}
              </th>
              <th className="px-4 py-3 text-right">
                {t('pages.training.training.assignments.cols.actions', 'Actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <AssignmentRow key={a.id} assignment={a} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KpiTile({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <span className="text-[11px] text-gray-500">{label}</span>
      <span className={`text-2xl font-semibold ${tone}`}>{value}</span>
    </div>
  )
}

function AssignmentRow({ assignment }: { assignment: MockAssignment }) {
  const { t } = useTranslation('common')
  const status = STATUS_BADGE[assignment.status]
  return (
    <tr className="border-t border-gray-100">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-gray-700"
            style={{ backgroundColor: assignment.operator.avatarColor }}
          >
            {assignment.operator.initials}
          </div>
          <div className="flex flex-col">
            <span className="text-dark-500 text-xs font-medium">{assignment.operator.name}</span>
            <span className="text-[10px] text-gray-500">
              {assignment.operator.team} · ext. {assignment.operator.extension}
            </span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="text-dark-500 text-xs font-medium">{assignment.courseTitle}</span>
          <span className="text-[10px] text-gray-500">
            {Math.floor(assignment.courseDurationMinutes / 60)}h{' '}
            {assignment.courseDurationMinutes % 60}m · {assignment.courseModules} modules
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="bg-primary-50 text-primary-700 rounded-full px-2 py-0.5 text-[10px] font-medium">
          {assignment.courseCategory}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
            <div
              className="bg-primary-500 h-full rounded-full"
              style={{ width: `${assignment.progressPct}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-gray-600">{assignment.progressPct}%</span>
        </div>
      </td>
      <td className="px-4 py-3 text-gray-600">{assignment.deadlineLabel}</td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${status.tone}`}>
          {status.label}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 rounded-full px-2 text-[10px]"
            leftIcon={<Icons.View size={12} />}
          >
            {t('pages.training.training.assignments.viewDetails', 'View')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 rounded-full px-2 text-[10px]"
            leftIcon={<Icons.Calendar size={12} />}
          >
            {t('pages.training.training.assignments.changeDeadline', 'Change')}
          </Button>
        </div>
      </td>
    </tr>
  )
}

export default AssignmentsGridTab
