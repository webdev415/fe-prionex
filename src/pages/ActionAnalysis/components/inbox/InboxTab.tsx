import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useOperators } from '@/features/users/hooks'
import { useInboxQueue } from '@/features/quality/coaching/hooks'
import { OperatorDetailPanel } from '@/features/quality/coaching/components/OperatorDetailPanel'
import { useAuthStore } from '@/stores/authStore'
import { useScopedUserIds } from '../../lib/scope'
import { readInboxState, writeInboxState } from '../../lib/inboxUrlState'
import { ScopeSelector } from '../ScopeSelector'
import { InboxViewModeToggle } from './InboxViewModeToggle'
import { OperatorListView } from './OperatorListView'
import { OperatorKanbanView } from './OperatorKanbanView'
import { OperatorGridView } from './OperatorGridView'
import { PERMISSIONS } from '@/constants/permissions'

/**
 * Inbox top-tab container (KAN-413, plan §3.5).
 *
 * Hosts the view-mode toggle, scope selector (role-gated), the operator
 * list, and the right-side detail panel. Header KPI strip + Quick Action
 * overlay live on ActionAnalysisPage so they're shared across every top
 * tab in the Trainer Workplace.
 *
 * `onOpenRateDialogue` is wired up to the OperatorDetailPanel "Listen to the
 * call" button. The picker dialog itself lives at page level so the Header
 * Quick Action and this button share state.
 */
export interface InboxTabProps {
  onOpenRateDialogue?: () => void
  onOpenScheduleOneOnOne?: () => void
  onOpenAssignTask?: () => void
}

export function InboxTab({
  onOpenRateDialogue,
  onOpenScheduleOneOnOne,
  onOpenAssignTask,
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
  const canSelectScope = userPermissions.includes(PERMISSIONS.ACTION_ANALYSIS.SELECT_INBOX_SCOPE)

  const currentUserId = useAuthStore((s) => (s.user?.id ? Number(s.user.id) : null))

  const effectiveUserIds = useMemo<number[]>(() => {
    if (!canSelectScope) {
      return currentUserId != null ? [currentUserId] : []
    }
    if (scoped.userIds === undefined) {
      return operators.map((o) => o.id)
    }
    return scoped.userIds
  }, [canSelectScope, currentUserId, scoped.userIds, operators])

  const { data: queue, isLoading } = useInboxQueue(
    {
      user_ids: effectiveUserIds,
      state: inboxState.states.length > 0 ? inboxState.states : undefined,
      period: inboxState.period,
      from_date: inboxState.customFromDate,
      to_date: inboxState.customToDate,
      page: 1,
      page_size: 100,
    },
    effectiveUserIds.length > 0
  )

  const rows = queue?.data ?? []

  const handleSelectOperator = (operatorId: number) => {
    setSearchParams(writeInboxState(searchParams, { operatorId }), {
      replace: true,
    })
  }

  const handleViewModeChange = (next: typeof inboxState.view) => {
    setSearchParams(writeInboxState(searchParams, { view: next }), {
      replace: true,
    })
  }

  const selectedOperatorName = useMemo(() => {
    if (!inboxState.operatorId) return undefined
    return operators.find((o) => o.id === inboxState.operatorId)?.full_name
  }, [inboxState.operatorId, operators])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <InboxViewModeToggle value={inboxState.view} onChange={handleViewModeChange} />
        {canSelectScope ? <ScopeSelector /> : null}
      </div>

      <div
        className={
          inboxState.view === 'kanban' || inboxState.view === 'grid'
            ? 'grid grid-cols-1 gap-3 xl:grid-cols-[1fr_minmax(320px,_400px)]'
            : 'grid grid-cols-1 gap-3 lg:grid-cols-[minmax(320px,_400px)_1fr]'
        }
      >
        <div>
          {effectiveUserIds.length === 0 ? (
            <div className="rounded-2xl bg-white/60 p-6 text-center text-sm text-gray-500">
              {t(
                'pages.actionAnalysis.inbox.list.emptyScope',
                'No operators in the current scope.'
              )}
            </div>
          ) : inboxState.view === 'kanban' ? (
            <OperatorKanbanView
              rows={rows}
              operators={operators}
              selectedOperatorId={inboxState.operatorId}
              onSelect={handleSelectOperator}
              isLoading={isLoading}
            />
          ) : inboxState.view === 'grid' ? (
            <OperatorGridView
              rows={rows}
              operators={operators}
              selectedOperatorId={inboxState.operatorId}
              onSelect={handleSelectOperator}
              isLoading={isLoading}
            />
          ) : (
            <OperatorListView
              rows={rows}
              operators={operators}
              selectedOperatorId={inboxState.operatorId}
              onSelect={handleSelectOperator}
              isLoading={isLoading}
            />
          )}
        </div>

        <div className="min-h-[400px]">
          <OperatorDetailPanel
            operatorId={inboxState.operatorId}
            operatorName={selectedOperatorName}
            period={inboxState.period}
            fromDate={inboxState.customFromDate}
            toDate={inboxState.customToDate}
            onListen={
              onOpenRateDialogue ??
              (() =>
                toast.info(t('pages.actionAnalysis.inbox.quickActions.comingSoon', 'Coming soon')))
            }
            onPlanOneOnOne={
              onOpenScheduleOneOnOne ??
              (() =>
                toast.info(t('pages.actionAnalysis.inbox.quickActions.comingSoon', 'Coming soon')))
            }
            onAssignTask={
              onOpenAssignTask ??
              (() =>
                toast.info(t('pages.actionAnalysis.inbox.quickActions.comingSoon', 'Coming soon')))
            }
          />
        </div>
      </div>
    </div>
  )
}

export default InboxTab
