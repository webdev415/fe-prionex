import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useOperators } from '@/features/users/hooks'
import { useInboxQueue, useTakeCharge, useTeamEvents } from '@/features/quality/coaching/hooks'
import { OperatorDetailPanel } from '@/features/quality/coaching/components/OperatorDetailPanel'
import { useAuthStore } from '@/stores/authStore'
import { Icons } from '@/lib/icons'
import { PERMISSIONS } from '@/constants/permissions'
import { useScopedUserIds } from '../../lib/scope'
import { readInboxState, writeInboxState } from '../../lib/inboxUrlState'
import { deriveInboxRows } from '../../lib/inboxRowAdapter'
import { type InboxPriority } from '../../mocks/trainerWorkplaceMocks'
import { InboxEventFeed } from './InboxEventFeed'
import { OperatorListView } from './OperatorListView'
import { OperatorKanbanView } from './OperatorKanbanView'
import { OperatorGridView } from './OperatorGridView'

/**
 * Inbox top-tab container (KAN-413, plan §3.5).
 *
 * Layout mirrors Figma `Inbox View A/B` — priority chip strip + segmented
 * view-mode toggle on top, main + 360px right detail panel grid below, and
 * a list/detail grid. Data comes from
 * `GET /api/v1/quality/coaching/queue`; the adapter in
 * [`inboxRowAdapter`](../../lib/inboxRowAdapter.ts) maps the BE rows onto the
 * Figma-faithful row shape consumed by the view components.
 */
export interface InboxTabProps {
  onOpenRateDialogue?: () => void
  onOpenScheduleOneOnOne?: () => void
  onOpenAssignTask?: () => void
  onOpenAssignMaterial?: () => void
}

type ViewMode = 'inbox' | 'kanban' | 'grid'

const VIEW_MODES: {
  id: ViewMode
  key: string
  fallback: string
  icon: typeof Icons.Mail
}[] = [
  { id: 'inbox', key: 'pages.training.inbox.viewMode.inbox', fallback: 'Inbox', icon: Icons.Mail },
  {
    id: 'kanban',
    key: 'pages.training.inbox.viewMode.kanban',
    fallback: 'Kanban',
    icon: Icons.Menu11,
  },
  { id: 'grid', key: 'pages.training.inbox.viewMode.grid', fallback: 'Grid', icon: Icons.Pivot },
]

const PRIORITY_CHIPS: { id: InboxPriority | 'all'; key: string; fallback: string }[] = [
  { id: 'all', key: 'pages.training.inbox.priority.all', fallback: 'All priorities' },
  { id: 'critical', key: 'pages.training.inbox.priority.critical', fallback: 'Critical' },
  { id: 'average', key: 'pages.training.inbox.priority.average', fallback: 'Average' },
  { id: 'low', key: 'pages.training.inbox.priority.low', fallback: 'Low' },
]

const BODY_LAYOUT = 'grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]'

export function InboxTab({
  onOpenRateDialogue,
  onOpenScheduleOneOnOne,
  onOpenAssignTask,
  onOpenAssignMaterial,
}: InboxTabProps = {}) {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()
  const userPermissions = useAuthStore((s) => s.user?.permissions ?? [])
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)

  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)

  const inboxState = readInboxState(searchParams)
  const scoped = useScopedUserIds(operators)

  // Scope-selector role-gating: users without select_inbox_scope are pinned
  // to 'my' scope regardless of any ?scope= URL param.
  const canSelectScope = userPermissions.includes(PERMISSIONS.TRAINING.SELECT_INBOX_SCOPE)
  const currentUserId = useAuthStore((s) => (s.user?.id ? Number(s.user.id) : null))

  // The BE /queue endpoint treats absent/empty user_ids as an EMPTY scope
  // (returns an empty page — see coaching.py get_queue), NOT as "all operators
  // in scope". So a "no filter" scope (scope=all, or the group placeholder,
  // both of which resolve `scoped.userIds` to undefined) must be expanded here
  // to the concrete in-scope operator id list, otherwise the queue comes back
  // empty and the panel shows "No operators in the current scope".
  const effectiveUserIds = useMemo<number[] | undefined>(() => {
    if (!canSelectScope) {
      return currentUserId != null ? [currentUserId] : []
    }
    if (scoped.userIds === undefined) {
      return operators.map((o) => o.id)
    }
    return scoped.userIds
  }, [canSelectScope, currentUserId, scoped.userIds, operators])

  // ?priority= chip state — defaults to 'all' and round-trips through the
  // URL so deep links survive a reload.
  const priorityParam = searchParams.get('priority')
  const priority: InboxPriority | 'all' =
    priorityParam === 'critical' ||
    priorityParam === 'average' ||
    priorityParam === 'low' ||
    priorityParam === 'all'
      ? (priorityParam as InboxPriority | 'all')
      : 'all'

  const setPriority = (next: InboxPriority | 'all') => {
    const params = new URLSearchParams(searchParams)
    if (next === 'all') params.delete('priority')
    else params.set('priority', next)
    setSearchParams(params, { replace: true })
  }

  // Memoized so the queryKey doesn't re-hash on every render. `enabled`
  // is true when user_ids is undefined (scope=all → BE returns the full
  // scope) OR when user_ids is non-empty (some explicit scope produced
  // hits). An explicit empty array short-circuits to disabled.
  const queueFilters = useMemo(
    () => ({
      user_ids: effectiveUserIds,
      state: inboxState.states.length > 0 ? inboxState.states : undefined,
      period: inboxState.period,
      from_date: inboxState.customFromDate,
      to_date: inboxState.customToDate,
      page: 1,
      page_size: 100,
    }),
    [
      effectiveUserIds,
      inboxState.states,
      inboxState.period,
      inboxState.customFromDate,
      inboxState.customToDate,
    ]
  )
  const { data: queue, isLoading } = useInboxQueue(
    queueFilters,
    effectiveUserIds === undefined || effectiveUserIds.length > 0
  )

  const derivedRows = useMemo(
    () => deriveInboxRows(t, queue?.data ?? [], operators),
    [queue, operators, t]
  )

  const filteredRows = useMemo(() => {
    if (priority === 'all') return derivedRows
    return derivedRows.filter((r) => r.priority === priority)
  }, [derivedRows, priority])

  // Operator-id → assignment.id resolver so the Kanban view can call the
  // transition endpoint without re-fetching.
  const assignmentIdByOperator = useMemo(() => {
    const map = new Map<number, number | null>()
    for (const row of queue?.data ?? []) {
      map.set(row.operator_id, row.assignment?.id ?? null)
    }
    return map
  }, [queue])

  const priorityCounts = useMemo(() => {
    const counts: Record<InboxPriority | 'all', number> = {
      all: derivedRows.length,
      critical: 0,
      average: 0,
      low: 0,
    }
    for (const row of derivedRows) {
      counts[row.priority] += 1
    }
    return counts
  }, [derivedRows])

  const setViewMode = (next: ViewMode) => {
    setSearchParams(writeInboxState(searchParams, { view: next }), { replace: true })
  }

  const handleSelectOperator = (operatorId: number) => {
    setSearchParams(writeInboxState(searchParams, { operatorId }), { replace: true })
  }

  const selectedRow = useMemo(
    () => filteredRows.find((r) => r.operatorId === inboxState.operatorId) ?? filteredRows[0],
    [filteredRows, inboxState.operatorId]
  )
  // OperatorUser carries fields the queue payload doesn't (group_name,
  // hired_at) — the panel needs them for the subtitle / Experience card.
  const selectedOperatorUser = useMemo(
    () => (selectedRow ? operators.find((o) => o.id === selectedRow.operatorId) : undefined),
    [operators, selectedRow]
  )

  // Details / Event Feed tab strip inside the right-side panel. Local
  // state — not URL-shareable for now since the feed is a side surface.
  const [detailTab, setDetailTab] = useState<'details' | 'feed'>('details')

  // Headline count badge next to the "Event Feed" tab. Same scope as the
  // inbox queue so the trainer sees activity from their operators only.
  const teamEventsFilters = useMemo(
    () => ({ user_ids: effectiveUserIds, hours: 24, limit: 20 }),
    [effectiveUserIds]
  )
  const { data: teamEventsData } = useTeamEvents(
    teamEventsFilters,
    effectiveUserIds === undefined || effectiveUserIds.length > 0
  )
  const teamEventsCount = teamEventsData?.data.length ?? 0

  // Trainer permissions — drive the disabled state on the panel buttons.
  const takeChargeMutation = useTakeCharge()
  const canTakeCharge = userPermissions.includes(PERMISSIONS.TRAINING.MANAGE_COACHING_ASSIGNMENTS)

  const handleTakeCharge = async () => {
    if (!selectedRow) return
    if (!canTakeCharge) {
      toast.error(
        t(
          'pages.training.inbox.takeCharge.forbidden',
          'You do not have permission to take charge of operators.'
        )
      )
      return
    }
    try {
      await takeChargeMutation.mutateAsync({ operator_id: selectedRow.operatorId })
      toast.success(
        t('pages.training.inbox.takeCharge.success', 'You are now coaching this operator.')
      )
    } catch (err) {
      const detail =
        err instanceof Error
          ? err.message
          : t('pages.training.inbox.takeCharge.errors.generic', 'Could not take charge.')
      toast.error(detail)
    }
  }

  return (
    <div className="relative flex min-h-[calc(100vh-220px)] flex-col gap-3 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {PRIORITY_CHIPS.map((chip) => {
            const isActive = priority === chip.id
            const count = priorityCounts[chip.id]
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setPriority(chip.id)}
                className={`flex items-center gap-1 rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                  isActive ? 'bg-[#204E4D] text-white' : 'bg-white text-[#05040D] hover:bg-gray-50'
                }`}
              >
                {t(chip.key, chip.fallback)}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    isActive ? 'bg-[#BBFB5B] text-[#05040D]' : 'bg-[#EDEDED] text-[#05040D]'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-white bg-white p-1 shadow-sm">
            {VIEW_MODES.map((vm) => {
              const VmIcon = vm.icon
              const isActive = inboxState.view === vm.id
              return (
                <button
                  key={vm.id}
                  type="button"
                  onClick={() => setViewMode(vm.id)}
                  className={`flex items-center gap-2 rounded-md px-7 py-2 text-xs font-medium transition-colors ${
                    isActive ? 'bg-[#204E4D] text-white' : 'text-[#05040D] hover:bg-gray-50'
                  }`}
                >
                  <VmIcon size={14} className={isActive ? 'text-white' : 'text-gray-500'} />
                  {t(vm.key, vm.fallback)}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className={BODY_LAYOUT}>
        {effectiveUserIds !== undefined && effectiveUserIds.length === 0 ? (
          <div className="rounded-xl border border-[#EBECE8] bg-white p-6 text-center text-xs text-gray-500">
            {t('pages.training.inbox.list.emptyScope', 'No operators in the current scope.')}
          </div>
        ) : inboxState.view === 'kanban' ? (
          <OperatorKanbanView
            rows={filteredRows}
            assignmentIdByOperator={assignmentIdByOperator}
            selectedOperatorId={selectedRow?.operatorId}
            onSelect={handleSelectOperator}
            isLoading={isLoading}
          />
        ) : inboxState.view === 'grid' ? (
          <OperatorGridView
            rows={filteredRows}
            selectedOperatorId={selectedRow?.operatorId}
            onSelect={handleSelectOperator}
            isLoading={isLoading}
          />
        ) : (
          <OperatorListView
            rows={filteredRows}
            selectedOperatorId={selectedRow?.operatorId ?? 0}
            onSelect={handleSelectOperator}
            isLoading={isLoading}
          />
        )}

        <OperatorDetailPanel
          operatorId={selectedRow?.operatorId}
          operatorName={selectedRow?.name}
          avatarColor={selectedRow?.avatarColor}
          initials={selectedRow?.initials}
          online={selectedRow?.online}
          extension={selectedRow?.extension}
          department={selectedRow?.department}
          groupName={selectedOperatorUser?.group_name ?? undefined}
          segment={selectedRow?.segment}
          hiredAt={selectedOperatorUser?.hired_at ?? undefined}
          dailyPlanPct={selectedRow?.dailyPlanPct}
          dailyPlanDone={selectedRow?.dailyPlanDone}
          dailyPlanTotal={selectedRow?.dailyPlanTotal}
          period={inboxState.period}
          fromDate={inboxState.customFromDate}
          toDate={inboxState.customToDate}
          showTabs
          activeTab={detailTab}
          onTabChange={setDetailTab}
          eventFeedCount={teamEventsCount}
          feedSlot={<InboxEventFeed userIds={effectiveUserIds} />}
          onListenRealtime={() =>
            toast.info(t('pages.training.inbox.quickActions.comingSoon', 'Coming soon'))
          }
          onListen={() =>
            toast.info(t('pages.training.inbox.quickActions.comingSoon', 'Coming soon'))
          }
          onRate={
            onOpenRateDialogue ??
            (() => toast.info(t('pages.training.inbox.quickActions.comingSoon', 'Coming soon')))
          }
          onAssignCourse={
            onOpenAssignMaterial ??
            (() => toast.info(t('pages.training.inbox.quickActions.comingSoon', 'Coming soon')))
          }
          onAssignDrill={
            onOpenAssignMaterial ??
            (() => toast.info(t('pages.training.inbox.quickActions.comingSoon', 'Coming soon')))
          }
          onPlanOneOnOne={
            onOpenScheduleOneOnOne ??
            (() => toast.info(t('pages.training.inbox.quickActions.comingSoon', 'Coming soon')))
          }
          onLeaveComment={() =>
            toast.info(t('pages.training.inbox.quickActions.comingSoon', 'Coming soon'))
          }
          onAssignTask={
            onOpenAssignTask ??
            (() => toast.info(t('pages.training.inbox.quickActions.comingSoon', 'Coming soon')))
          }
          onTakeCharge={handleTakeCharge}
        />
      </div>
    </div>
  )
}

export default InboxTab
