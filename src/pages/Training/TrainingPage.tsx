import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { useExportCalls, useExportInteractions } from '@/features/training'
import { PERMISSIONS } from '@/constants/permissions'
import {
  TRAINING_TOP_TABS,
  ACTION_ANALYSIS_CALLS_SUB_TABS,
  type TrainingTopTabId,
  type ActionAnalysisCallsSubTabId,
} from './types'
import { CallsTab } from './components/CallsTab'
import { InteractionHistoryTab } from './components/InteractionHistoryTab'
import { TaHistoryTab } from './components/TaHistoryTab'
import { TaskHistoryTab } from './components/TaskHistoryTab'
import { PaymentHistoryTab } from './components/PaymentHistoryTab'
import { TimelineTab } from './components/TimelineTab'
import { ScreenTimeTab } from './components/ScreenTimeTab'
import { HeatmapTab } from './components/HeatmapTab'
import { ScopeSelector } from './components/ScopeSelector'
import { TrainerHeaderStrip } from './components/chrome/TrainerHeaderStrip'
import { QuickActionOverlay } from './components/chrome/QuickActionOverlay'
import { CoachWorkspaceBanner } from './components/chrome/CoachWorkspaceBanner'
import { PendingFeatureDialog } from './components/inbox/PendingFeatureDialog'
import { CreateCorrectionTaskDialog } from './components/inbox/CreateCorrectionTaskDialog'
import { ScheduleOneOnOneDialog } from './components/inbox/ScheduleOneOnOneDialog'
import { RateDialogueDialog } from './components/inbox/RateDialogueDialog'
import { InboxTab } from './components/inbox/InboxTab'
import { TeamTab } from './components/team/TeamTab'
import { ActionAnalysisInnerTab } from './components/analytics/ActionAnalysisInnerTab'
import { DialogueEvaluationTab } from './components/dialogue/DialogueEvaluationTab'
import { TrainingsAndSessionsTab } from './components/training/TrainingsAndSessionsTab'
import { TasksTab } from './components/tasks/TasksTab'
import { readCallsUrlState, toCallMonitoringQuery } from './lib/callsUrlState'
import {
  readInteractionBarState,
  resolveInteractionUsers,
  toInteractionMonitoringQuery,
} from './lib/interactionsUrlState'
import { readInboxState } from './lib/inboxUrlState'
import { useScopedUserIds } from './lib/scope'
import type { HeaderKpisFilters } from '@/features/quality/coaching/types'

/**
 * TrainingPage — Trainer Workplace shell (renamed from ActionAnalysisPage).
 *
 * After the redesign (this round, plan §1 + §2.1), the page is a 6-top-tab
 * router: Inbox / Team / Action Analysis / Dialogue Evaluation /
 * Trainings and Sessions / Tasks. Sub-tabs are owned per top-tab.
 *
 * Sub-tab content is currently wired against mock data — backend hooks land
 * with each KAN-498..504 ticket.
 */
const TOP_TAB_LABEL_KEYS: Record<TrainingTopTabId, { key: string; fallback: string }> = {
  inbox: { key: 'pages.training.topTabs.inbox', fallback: 'Inbox' },
  team: { key: 'pages.training.topTabs.team', fallback: 'Team' },
  'action-analysis': {
    key: 'pages.training.topTabs.actionAnalysis',
    fallback: 'Action Analysis',
  },
  'dialogue-evaluation': {
    key: 'pages.training.topTabs.dialogueEvaluation',
    fallback: 'Dialogue Evaluation',
  },
  'trainings-and-sessions': {
    key: 'pages.training.topTabs.trainingsAndSessions',
    fallback: 'Trainings and Sessions',
  },
  tasks: { key: 'pages.training.topTabs.tasks', fallback: 'Tasks' },
  // Legacy IDs — kept for the read-shim path below.
  calls: { key: 'pages.training.topTabs.calls', fallback: 'Calls' },
  scores: { key: 'pages.training.topTabs.scores', fallback: 'Scores' },
  training: { key: 'pages.training.topTabs.training', fallback: 'Training' },
  settings: { key: 'pages.training.topTabs.settings', fallback: 'Settings' },
}

const TOP_TAB_ICONS: Record<
  TrainingTopTabId,
  (props: { size?: number; className?: string }) => ReactElement
> = {
  inbox: Icons.Mail,
  team: Icons.UserMultiple02,
  'action-analysis': Icons.PieChart02,
  'dialogue-evaluation': Icons.ChatFeedback01,
  'trainings-and-sessions': Icons.Brochure,
  tasks: Icons.CheckmarkSquare03,
  calls: Icons.Phone,
  scores: Icons.ChartRing,
  training: Icons.Brochure,
  settings: Icons.Settings,
}

// Visible tab order — drives the strip render.
const VISIBLE_TOP_TABS: TrainingTopTabId[] = [
  'inbox',
  'team',
  'action-analysis',
  'dialogue-evaluation',
  'trainings-and-sessions',
  'tasks',
]

// Legacy sub-tab labels for the (still wired) ?tab=calls branch.
const LEGACY_CALLS_SUB_TAB_LABELS: Record<
  ActionAnalysisCallsSubTabId,
  { key: string; fallback: string; permission?: string }
> = {
  list: { key: 'pages.training.subTabs.list', fallback: 'Call List' },
  interactions: {
    key: 'pages.training.subTabs.interactions',
    fallback: 'Interaction History',
  },
  'ta-history': {
    key: 'pages.training.subTabs.taHistory',
    fallback: 'TA History',
    permission: PERMISSIONS.TRAINING.VIEW_TA_HISTORY,
  },
  'task-history': {
    key: 'pages.training.subTabs.taskHistory',
    fallback: 'Task History',
    permission: PERMISSIONS.TRAINING.VIEW_TASK_HISTORY,
  },
  'payment-history': {
    key: 'pages.training.subTabs.paymentHistory',
    fallback: 'Payment History',
    permission: PERMISSIONS.TRAINING.VIEW_PAYMENT_HISTORY,
  },
  timeline: {
    key: 'pages.training.subTabs.timeline',
    fallback: 'Timeline',
    permission: PERMISSIONS.TRAINING.VIEW_CLICK_TRACKING,
  },
  'screen-time': {
    key: 'pages.training.subTabs.screenTime',
    fallback: 'Screen Time',
    permission: PERMISSIONS.TRAINING.VIEW_SCREEN_TIME,
  },
  heatmap: {
    key: 'pages.training.subTabs.heatmap',
    fallback: 'Heatmap',
    permission: PERMISSIONS.TRAINING.VIEW_ACTIVITY_HEATMAP,
  },
  'script-analytics': {
    key: 'pages.training.subTabs.scriptAnalytics',
    fallback: 'Script Analytics',
    permission: PERMISSIONS.TRAINING.VIEW_SCRIPT_ANALYTICS,
  },
}

function isTopTab(value: string | null): value is TrainingTopTabId {
  return value !== null && (TRAINING_TOP_TABS as string[]).includes(value)
}

function isLegacyCallsSubTab(value: string | null): value is ActionAnalysisCallsSubTabId {
  return value !== null && (ACTION_ANALYSIS_CALLS_SUB_TABS as string[]).includes(value)
}

// URL read-shims per plan §2.8 — translate legacy bookmarks to the new
// top-tab grammar.
const LEGACY_TAB_SHIMS: Record<string, { tab: TrainingTopTabId; sub?: string }> = {
  calls: { tab: 'action-analysis', sub: 'interactions' },
  scores: { tab: 'dialogue-evaluation' },
  training: { tab: 'trainings-and-sessions' },
  interactions: { tab: 'action-analysis', sub: 'interactions' },
}

export function TrainingPage() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()
  const userPermissions = useAuthStore((s) => s.user?.permissions ?? [])

  const rawTab = searchParams.get('tab')
  const rawSub = searchParams.get('sub')

  // Read-shims: rewrite legacy ?tab=... to the new grammar. Runs once on
  // mount per URL change.
  useEffect(() => {
    if (rawTab && LEGACY_TAB_SHIMS[rawTab]) {
      const shim = LEGACY_TAB_SHIMS[rawTab]
      const next = new URLSearchParams(searchParams)
      next.set('tab', shim.tab)
      if (shim.sub) {
        next.set('sub', shim.sub)
      }
      setSearchParams(next, { replace: true })
    }
  }, [rawTab, searchParams, setSearchParams])

  const activeTopTab: TrainingTopTabId = isTopTab(rawTab) ? rawTab : 'inbox'

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)

  const scoped = useScopedUserIds(operators)

  const exportCallsMutation = useExportCalls()
  const exportInteractionsMutation = useExportInteractions()

  const setActiveTopTab = (tab: TrainingTopTabId) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    next.delete('sub')
    setSearchParams(next, { replace: true })
  }

  const visibleTopTabs = useMemo(() => VISIBLE_TOP_TABS, [])

  // â”€â”€â”€ Legacy ?tab=calls path — kept alive so existing CallsTab still works
  // until Phase B fully drops the calls top-tab. Read-shim above redirects
  // most users, but trainers who deep-link to ?tab=calls&sub=list still hit
  // the original surface.
  const legacySubTab: ActionAnalysisCallsSubTabId = isLegacyCallsSubTab(rawSub) ? rawSub : 'list'

  const exportReadyForCallsListOrInteractions = useMemo(() => {
    if (activeTopTab !== 'calls') return false
    if (legacySubTab === 'list') {
      const s = readCallsUrlState(searchParams)
      return s.period !== 'custom' || !!(s.customFromDate && s.customToDate)
    }
    if (legacySubTab === 'interactions') {
      const s = readInteractionBarState(searchParams)
      const usable = s.period !== 'custom' || !!(s.customFromDate && s.customToDate)
      if (!usable) return false
      const resolved = resolveInteractionUsers(s, operators, scoped.userIds)
      return resolved.kind !== 'empty'
    }
    return false
  }, [activeTopTab, legacySubTab, searchParams, operators, scoped.userIds])

  const isExportingListOrInteractions =
    legacySubTab === 'list'
      ? exportCallsMutation.isPending
      : legacySubTab === 'interactions'
        ? exportInteractionsMutation.isPending
        : false

  const handleLegacyCallsExport = async () => {
    try {
      if (legacySubTab === 'list') {
        const state = readCallsUrlState(searchParams)
        const payload = { ...toCallMonitoringQuery(state), sort: 'date_desc' as const }
        await exportCallsMutation.mutateAsync(payload)
      } else if (legacySubTab === 'interactions') {
        const state = readInteractionBarState(searchParams)
        const payload = toInteractionMonitoringQuery(state, operators, scoped.userIds)
        await exportInteractionsMutation.mutateAsync(payload)
      }
    } catch (err) {
      console.error('Export failed:', err)
      toast.error(t('pages.training.errors.exportFailed', 'Export failed'))
    }
  }

  const [quickActionDialog, setQuickActionDialog] = useState<
    'assign' | 'oneOnOne' | 'material' | 'rate' | null
  >(null)

  // Matches `writeInboxState` (`?operator_id=`); the camelCase variant was
  // a hold-over from the mock surface.
  const inboxOperatorId = useMemo(() => {
    const raw = searchParams.get('operator_id')
    if (!raw) return undefined
    const id = Number(raw)
    return Number.isFinite(id) ? id : undefined
  }, [searchParams])

  // Header KPI strip filters — shared across every top-tab so the same
  // period / scope drives the global trainer numbers. Users without
  // `select_inbox_scope` are pinned to their own ids (mirrors InboxTab §3.5).
  const inboxUrlState = useMemo(() => readInboxState(searchParams), [searchParams])
  const currentUserId = useAuthStore((s) => (s.user?.id ? Number(s.user.id) : null))
  const canSelectInboxScope = userPermissions.includes(PERMISSIONS.TRAINING.SELECT_INBOX_SCOPE)
  const headerScopedUserIds = useMemo<number[] | undefined>(() => {
    if (!canSelectInboxScope) {
      return currentUserId != null ? [currentUserId] : []
    }
    return scoped.userIds
  }, [canSelectInboxScope, currentUserId, scoped.userIds])

  const headerKpisFilters: HeaderKpisFilters = {
    user_ids: headerScopedUserIds,
    period: inboxUrlState.period,
    from_date: inboxUrlState.customFromDate,
    to_date: inboxUrlState.customToDate,
  }
  const canViewInbox = userPermissions.includes(PERMISSIONS.TRAINING.VIEW_INBOX)

  const setLegacySubTab = (sub: ActionAnalysisCallsSubTabId) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'calls')
    next.set('sub', sub)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header strip — shared across every top-tab */}
      <TrainerHeaderStrip filters={headerKpisFilters} enabled={canViewInbox} />

      {/* Top-tab strip + Quick Action (Figma tab row) */}
      <div className="border-b border-gray-200">
        <div className="-mb-px flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1" role="tablist">
            {visibleTopTabs.map((tab) => {
              const { key, fallback } = TOP_TAB_LABEL_KEYS[tab]
              const TabIcon = TOP_TAB_ICONS[tab]
              const isActive = activeTopTab === tab
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTopTab(tab)}
                  className={`flex items-center gap-2 border-b-2 px-3 py-3 text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-[#204E4D] text-[#204E4D]'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <TabIcon size={14} className={isActive ? 'text-[#204E4D]' : 'text-gray-500'} />
                  {t(key, fallback)}
                </button>
              )
            })}
          </div>
          <QuickActionOverlay
            onAssignTask={() => setQuickActionDialog('assign')}
            onScheduleOneOnOne={() => setQuickActionDialog('oneOnOne')}
            onAssignMaterial={() => setQuickActionDialog('material')}
            onRateDialogue={() => setQuickActionDialog('rate')}
          />
        </div>
      </div>

      {/* KAN-411 Feature 3.1 — Quick Action #1 ("Assign task") is now
          functional via task-service's correction-task endpoints. */}
      <CreateCorrectionTaskDialog
        open={quickActionDialog === 'assign'}
        onClose={() => setQuickActionDialog(null)}
        operatorId={inboxOperatorId}
      />
      <PendingFeatureDialog
        open={quickActionDialog === 'material'}
        onClose={() => setQuickActionDialog(null)}
        titleKey="pages.training.inbox.quickActions.assignCourse"
        titleFallback="Assign course / drill"
        descriptionKey="pages.training.inbox.pendingFeature.assignCourseDescription"
        descriptionFallback="Assign training material or a drill exercise to an operator."
        dependsOnIssue="KAN-416"
      />
      <ScheduleOneOnOneDialog
        open={quickActionDialog === 'oneOnOne'}
        onClose={() => setQuickActionDialog(null)}
        operatorId={inboxOperatorId}
      />
      <RateDialogueDialog
        open={quickActionDialog === 'rate'}
        onClose={() => setQuickActionDialog(null)}
        operatorId={inboxOperatorId}
      />

      {/* Top-tab body */}
      {activeTopTab === 'inbox' ? (
        <InboxTab
          onOpenRateDialogue={() => setQuickActionDialog('rate')}
          onOpenScheduleOneOnOne={() => setQuickActionDialog('oneOnOne')}
          onOpenAssignTask={() => setQuickActionDialog('assign')}
        />
      ) : activeTopTab === 'team' ? (
        <TeamTab
          onOpenRateDialogue={() => setQuickActionDialog('rate')}
          onOpenScheduleOneOnOne={() => setQuickActionDialog('oneOnOne')}
          onOpenAssignTask={() => setQuickActionDialog('assign')}
        />
      ) : activeTopTab === 'action-analysis' ? (
        <ActionAnalysisInnerTab />
      ) : activeTopTab === 'dialogue-evaluation' ? (
        <DialogueEvaluationTab />
      ) : activeTopTab === 'trainings-and-sessions' ? (
        <TrainingsAndSessionsTab />
      ) : activeTopTab === 'tasks' ? (
        <TasksTab onAssignTask={() => setQuickActionDialog('assign')} />
      ) : activeTopTab === 'calls' ? (
        <LegacyCallsBranch
          subTab={legacySubTab}
          setSubTab={setLegacySubTab}
          userPermissions={userPermissions}
          onExport={handleLegacyCallsExport}
          isExporting={isExportingListOrInteractions}
          canExport={exportReadyForCallsListOrInteractions}
        />
      ) : (
        <div className="rounded-xl bg-white/50 p-12 text-center text-sm text-gray-500 shadow-sm">
          {t(
            'pages.training.topTabsComingSoon',
            'This section will be enabled in a follow-up release.'
          )}
        </div>
      )}

      {/* Bottom-pinned Coach's Workspace banner — shared across every top-tab. */}
      <div className="pointer-events-none fixed right-0 bottom-4 left-0 z-20 flex justify-center px-4 lg:left-[var(--sidebar-width,0px)]">
        <div className="pointer-events-auto w-full max-w-[1110px]">
          <CoachWorkspaceBanner />
        </div>
      </div>
    </div>
  )
}

/**
 * Legacy ?tab=calls branch. Kept until Phase B drops it entirely — the
 * read-shim handles new users, but deep-linked bookmarks still render here.
 */
function LegacyCallsBranch({
  subTab,
  setSubTab,
  userPermissions,
  onExport,
  isExporting,
  canExport,
}: {
  subTab: ActionAnalysisCallsSubTabId
  setSubTab: (sub: ActionAnalysisCallsSubTabId) => void
  userPermissions: string[]
  onExport: () => void
  isExporting: boolean
  canExport: boolean
}) {
  const { t } = useTranslation('common')

  const visibleSubTabs = useMemo(() => {
    return ACTION_ANALYSIS_CALLS_SUB_TABS.filter((sub) => {
      const meta = LEGACY_CALLS_SUB_TAB_LABELS[sub]
      if (!meta.permission) return true
      return userPermissions.includes(meta.permission)
    })
  }, [userPermissions])

  const exportVisible = subTab === 'list' || subTab === 'interactions'

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {visibleSubTabs.map((sub) => {
            const meta = LEGACY_CALLS_SUB_TAB_LABELS[sub]
            const isActive = subTab === sub
            return (
              <button
                key={sub}
                type="button"
                onClick={() => setSubTab(sub)}
                className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-500 border-primary-500 text-white'
                    : 'hover:border-primary-300 border-gray-200 bg-white text-gray-700'
                }`}
              >
                {t(meta.key, meta.fallback)}
              </button>
            )
          })}
        </div>
        {exportVisible ? (
          <Button
            variant="primary"
            size="md"
            onClick={onExport}
            disabled={!canExport || isExporting}
            leftIcon={<Icons.Download size={14} className="text-white" />}
            className="h-[36px] rounded-full text-xs"
          >
            {isExporting
              ? t('pages.training.actions.exporting', 'Exporting…')
              : t('pages.training.actions.exportExcel', 'Export to Excel')}
          </Button>
        ) : null}
      </div>

      <ScopeSelector />

      <div>
        {subTab === 'list' && <CallsTab />}
        {subTab === 'interactions' && <InteractionHistoryTab />}
        {subTab === 'ta-history' && <TaHistoryTab />}
        {subTab === 'task-history' && <TaskHistoryTab />}
        {subTab === 'payment-history' && <PaymentHistoryTab />}
        {subTab === 'timeline' && <TimelineTab />}
        {subTab === 'screen-time' && <ScreenTimeTab />}
        {subTab === 'heatmap' && <HeatmapTab />}
      </div>
    </>
  )
}

export default TrainingPage
