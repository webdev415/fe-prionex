import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { HeaderKpiTile } from '../chrome/HeaderKpiTile'
import { AnalyticsRadioChips } from '../analytics/AnalyticsRadioChips'
import { AnalyticsMockTable } from '../analytics/AnalyticsMockTable'
import {
  ANALYTICS_TABLE_HEAD,
  ANALYTICS_TABLE_ROW,
  ANALYTICS_TABLE_TD,
  ANALYTICS_TABLE_TH,
} from '../analytics/analyticsTableStyles'
import {
  MOCK_ASSIGNMENT_KPIS,
  MOCK_ASSIGNMENTS,
  type AssignmentStatus,
  type MockAssignment,
} from '../../mocks/trainerWorkplaceMocks'
import { PendingFeatureDialog } from '../inbox/PendingFeatureDialog'

const STATUS_BADGE: Record<AssignmentStatus, { label: string; tone: string }> = {
  not_started: { label: 'Not started', tone: 'bg-[#F3F4F6] text-[#4B5563]' },
  in_progress: { label: 'In progress', tone: 'bg-[#EFF6FF] text-[#2563EB]' },
  done: { label: 'Done', tone: 'bg-[#F0FDF4] text-[#15803D]' },
  overdue: { label: 'Overdue', tone: 'bg-[#FEF2F2] text-[#B91C1C]' },
}

export function AssignmentsGridTab() {
  const { t } = useTranslation('common')
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | 'all'>('all')
  const [pendingAction, setPendingAction] = useState<'view' | 'deadline' | null>(null)

  const filtered = MOCK_ASSIGNMENTS.filter(
    (a) => statusFilter === 'all' || a.status === statusFilter
  )

  const kpi = MOCK_ASSIGNMENT_KPIS

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <HeaderKpiTile
          label={t('pages.training.training.assignments.kpis.totalActive', 'Total active')}
          value={String(kpi.totalActive)}
          icon={Icons.Activity01}
          iconColor="text-[#204E4D]"
          iconBg="bg-white"
          accentColor="#204E4D"
        />
        <HeaderKpiTile
          label={t('pages.training.training.assignments.kpis.completed', 'Completed')}
          value={`${kpi.completed} of ${kpi.completedOfTotal}`}
          icon={Icons.Checkmark}
          iconColor="text-[#22C55E]"
          iconBg="bg-white"
          accentColor="#22C55E"
        />
        <HeaderKpiTile
          label={t('pages.training.training.assignments.kpis.overdue', 'Overdue')}
          value={String(kpi.overdue)}
          icon={Icons.Clock01}
          iconColor="text-[#EF4444]"
          iconBg="bg-white"
          accentColor="#EF4444"
        />
      </div>

      <div className="rounded-lg border border-[#EBECE8] bg-white px-4 py-3 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-[#05040D]">
            {t('pages.training.interactions.status.label', 'Status')}
          </span>
          <AnalyticsRadioChips
            items={(['all', 'not_started', 'in_progress', 'done', 'overdue'] as const).map((s) => ({
              id: s,
              label:
                s === 'all'
                  ? t('pages.training.training.assignments.statusAll', 'All assignments')
                  : STATUS_BADGE[s].label,
              active: statusFilter === s,
              onClick: () => setStatusFilter(s),
            }))}
          />
        </div>
      </div>

      <AnalyticsMockTable>
        <thead className={ANALYTICS_TABLE_HEAD}>
          <tr>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.training.assignments.cols.operator', 'Operator')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.training.assignments.cols.course', 'Course')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.training.assignments.cols.category', 'Category')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.training.assignments.cols.progress', 'Progress')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.training.assignments.cols.deadline', 'Deadline')}
            </th>
            <th className={ANALYTICS_TABLE_TH}>
              {t('pages.training.training.assignments.cols.status', 'Status')}
            </th>
            <th className={`${ANALYTICS_TABLE_TH} text-right`}>
              {t('pages.training.training.assignments.cols.actions', 'Actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((a) => (
            <AssignmentRow
              key={a.id}
              assignment={a}
              onView={() => setPendingAction('view')}
              onChangeDeadline={() => setPendingAction('deadline')}
            />
          ))}
        </tbody>
      </AnalyticsMockTable>

      <PendingFeatureDialog
        open={pendingAction === 'view'}
        onClose={() => setPendingAction(null)}
        titleKey="pages.training.training.assignments.viewDetails"
        titleFallback="View assignment"
        descriptionKey="pages.training.training.pending.viewAssignment"
        descriptionFallback="Open operator progress, module breakdown, and completion history."
        dependsOnIssue="KAN-498"
      />
      <PendingFeatureDialog
        open={pendingAction === 'deadline'}
        onClose={() => setPendingAction(null)}
        titleKey="pages.training.training.assignments.changeDeadline"
        titleFallback="Change deadline"
        descriptionKey="pages.training.training.pending.changeDeadline"
        descriptionFallback="Reschedule the assignment deadline for this operator."
        dependsOnIssue="KAN-498"
      />
    </div>
  )
}

function AssignmentRow({
  assignment,
  onView,
  onChangeDeadline,
}: {
  assignment: MockAssignment
  onView: () => void
  onChangeDeadline: () => void
}) {
  const { t } = useTranslation('common')
  const status = STATUS_BADGE[assignment.status]
  return (
    <tr className={ANALYTICS_TABLE_ROW}>
      <td className={ANALYTICS_TABLE_TD}>
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-[#05040D]"
            style={{ backgroundColor: assignment.operator.avatarColor }}
          >
            {assignment.operator.initials}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-[#05040D]">{assignment.operator.name}</span>
            <span className="text-[10px] text-[#6B7280]">
              {assignment.operator.team} · ext. {assignment.operator.extension}
            </span>
          </div>
        </div>
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <div className="flex flex-col">
          <span className="text-xs font-medium text-[#05040D]">{assignment.courseTitle}</span>
          <span className="text-[10px] text-[#6B7280]">
            {Math.floor(assignment.courseDurationMinutes / 60)}h{' '}
            {assignment.courseDurationMinutes % 60}m · {assignment.courseModules} modules
          </span>
        </div>
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <span className="rounded-full bg-[#F0FDF4] px-2 py-0.5 text-[10px] font-medium text-[#204E4D]">
          {assignment.courseCategory}
        </span>
      </td>
      <td className={ANALYTICS_TABLE_TD}>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#EBECE8]">
            <div
              className="h-full rounded-full bg-[#EAB308]"
              style={{ width: `${assignment.progressPct}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-[#545454]">{assignment.progressPct}%</span>
        </div>
      </td>
      <td className={ANALYTICS_TABLE_TD}>{assignment.deadlineLabel}</td>
      <td className={ANALYTICS_TABLE_TD}>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${status.tone}`}>
          {status.label}
        </span>
      </td>
      <td className={`${ANALYTICS_TABLE_TD} text-right`}>
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={onView}
            className="rounded-md border border-[#EDEDED] px-2 py-1 text-[10px] font-medium text-[#05040D] hover:bg-[#F7F7F7]"
          >
            {t('pages.training.training.assignments.viewDetails', 'View')}
          </button>
          <button
            type="button"
            onClick={onChangeDeadline}
            className="rounded-md bg-[#204E4D] px-2 py-1 text-[10px] font-medium text-white hover:bg-[#1a3f3e]"
          >
            {t('pages.training.training.assignments.changeDeadline', 'Change')}
          </button>
        </div>
      </td>
    </tr>
  )
}

export default AssignmentsGridTab
