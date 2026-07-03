// prod-hide: `useState` removed from this import when the Inbox/Quick-Action
// state block was wrapped. Restore by adding `, useState` back.
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { useExportCalls, useExportInteractions } from '@/features/actionAnalysis'
import { PERMISSIONS } from '@/constants/permissions'
import {
  ACTION_ANALYSIS_CALLS_SUB_TABS,
  ACTION_ANALYSIS_TOP_TABS,
  type ActionAnalysisCallsSubTabId,
  type ActionAnalysisTopTabId,
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
// prod-hide START — restore by uncommenting these import lines.
// import { ScriptAnalyticsTab } from './components/ScriptAnalyticsTab'
// import { ScoresTab } from './components/scores/ScoresTab'
// import { InboxTab } from './components/inbox/InboxTab'
// import { RateDialogueDialog } from './components/inbox/RateDialogueDialog'
// import { ScheduleOneOnOneDialog } from './components/inbox/ScheduleOneOnOneDialog'
// import { PendingFeatureDialog } from './components/inbox/PendingFeatureDialog'
// import { HeaderKpiStrip } from './components/chrome/HeaderKpiStrip'
// import { WorkspaceBanner } from './components/chrome/WorkspaceBanner'
// prod-hide END
// prod-hide: readInboxState only used inside the hidden Inbox state block.
// import { readInboxState } from './lib/inboxUrlState'
import { readCallsUrlState, toCallMonitoringQuery } from './lib/callsUrlState'
import {
  readInteractionBarState,
  resolveInteractionUsers,
  toInteractionMonitoringQuery,
} from './lib/interactionsUrlState'
import { resolveTabCeiling, useScopedUserIds } from './lib/scope'

const TOP_TAB_LABEL_KEYS: Record<ActionAnalysisTopTabId, { key: string; fallback: string }> = {
  inbox: { key: 'pages.actionAnalysis.topTabs.inbox', fallback: 'Inbox' },
  calls: { key: 'pages.actionAnalysis.topTabs.calls', fallback: 'Calls' },
  scores: { key: 'pages.actionAnalysis.topTabs.scores', fallback: 'Scores' },
  training: { key: 'pages.actionAnalysis.topTabs.training', fallback: 'Training' },
  settings: { key: 'pages.actionAnalysis.topTabs.settings', fallback: 'Settings' },
}

const TOP_TAB_PERMISSIONS: Partial<Record<ActionAnalysisTopTabId, string>> = {
  inbox: PERMISSIONS.ACTION_ANALYSIS.VIEW_INBOX,
}

const SUB_TAB_LABEL_KEYS: Record<
  ActionAnalysisCallsSubTabId,
  { key: string; fallback: string; permission?: string }
> = {
  list: { key: 'pages.actionAnalysis.subTabs.list', fallback: 'Call List' },
  interactions: {
    key: 'pages.actionAnalysis.subTabs.interactions',
    fallback: 'Interaction History',
  },
  'ta-history': {
    key: 'pages.actionAnalysis.subTabs.taHistory',
    fallback: 'TA History',
    permission: PERMISSIONS.ACTION_ANALYSIS.VIEW_TA_HISTORY,
  },
  'task-history': {
    key: 'pages.actionAnalysis.subTabs.taskHistory',
    fallback: 'Task History',
    permission: PERMISSIONS.ACTION_ANALYSIS.VIEW_TASK_HISTORY,
  },
  'payment-history': {
    key: 'pages.actionAnalysis.subTabs.paymentHistory',
    fallback: 'Payment History',
    permission: PERMISSIONS.ACTION_ANALYSIS.VIEW_PAYMENT_HISTORY,
  },
  timeline: {
    key: 'pages.actionAnalysis.subTabs.timeline',
    fallback: 'Timeline',
    permission: PERMISSIONS.ACTION_ANALYSIS.VIEW_CLICK_TRACKING,
  },
  'screen-time': {
    key: 'pages.actionAnalysis.subTabs.screenTime',
    fallback: 'Screen Time',
    permission: PERMISSIONS.ACTION_ANALYSIS.VIEW_SCREEN_TIME,
  },
  heatmap: {
    key: 'pages.actionAnalysis.subTabs.heatmap',
    fallback: 'Heatmap',
    permission: PERMISSIONS.ACTION_ANALYSIS.VIEW_ACTIVITY_HEATMAP,
  },
  'script-analytics': {
    key: 'pages.actionAnalysis.subTabs.scriptAnalytics',
    fallback: 'Script Analytics',
    permission: PERMISSIONS.ACTION_ANALYSIS.VIEW_SCRIPT_ANALYTICS,
  },
}

function isTopTab(value: string | null): value is ActionAnalysisTopTabId {
  return value !== null && (ACTION_ANALYSIS_TOP_TABS as string[]).includes(value)
}

function isSubTab(value: string | null): value is ActionAnalysisCallsSubTabId {
  return value !== null && (ACTION_ANALYSIS_CALLS_SUB_TABS as string[]).includes(value)
}

// ─────────────────────────────────────────────────────────────
// TEMPORARY PROD HIDE (2026-05-29)
// Surfaces that are NOT in the prod-visible allowlists below are
// commented out in JSX with `/* prod-hide START */ … /* prod-hide END */`
// markers. To restore all hidden surfaces:
//   1. Delete the two arrays below.
//   2. Remove the corresponding `.filter(...)` calls in `visibleTopTabs`
//      and `visibleSubTabs`.
//   3. Drop the prod-hide redirect useEffect.
//   4. Search this file for "prod-hide START" and uncomment those blocks.
//   5. Remove `// eslint-disable-next-line @typescript-eslint/no-unused-vars`
//      on the now-orphaned imports.
// ─────────────────────────────────────────────────────────────
const PROD_VISIBLE_TOP_TABS: ActionAnalysisTopTabId[] = ['calls']
const PROD_VISIBLE_SUB_TABS: ActionAnalysisCallsSubTabId[] = [
  'list',
  'interactions',
  'ta-history',
  'task-history',
  'payment-history',
  'timeline',
  'screen-time',
  'heatmap',
]

export function ActionAnalysisPage() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()
  const userPermissions = useAuthStore((s) => s.user?.permissions ?? [])

  const rawTab = searchParams.get('tab')
  const rawSub = searchParams.get('sub')

  // Legacy URL shim: ?tab=interactions → ?tab=calls&sub=interactions
  useEffect(() => {
    if (rawTab === 'interactions' && !rawSub) {
      const next = new URLSearchParams(searchParams)
      next.set('tab', 'calls')
      next.set('sub', 'interactions')
      setSearchParams(next, { replace: true })
    }
  }, [rawTab, rawSub, searchParams, setSearchParams])

  const activeTopTab: ActionAnalysisTopTabId = isTopTab(rawTab) ? rawTab : 'calls'
  const activeSubTab: ActionAnalysisCallsSubTabId = isSubTab(rawSub) ? rawSub : 'list'

  // prod-hide START — redirect bookmarks that point at hidden tabs/sub-tabs.
  // Restore: delete this useEffect entirely.
  useEffect(() => {
    const topTabHidden = !PROD_VISIBLE_TOP_TABS.includes(activeTopTab)
    const subTabHidden = activeTopTab === 'calls' && !PROD_VISIBLE_SUB_TABS.includes(activeSubTab)
    if (topTabHidden || subTabHidden) {
      const next = new URLSearchParams(searchParams)
      next.set('tab', 'calls')
      next.set('sub', 'list')
      setSearchParams(next, { replace: true })
    }
  }, [activeTopTab, activeSubTab, searchParams, setSearchParams])
  // prod-hide END

  // the active tab's role access ceiling bounds the ScopeSelector.
  const tabAccessLevels = useAuthStore((s) => s.user?.tab_access_levels)
  const scopeCeiling = useMemo(
    () => resolveTabCeiling(activeSubTab, tabAccessLevels),
    [activeSubTab, tabAccessLevels]
  )

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)

  // Page-level scope: drives user_ids[] for every Calls sub-tab and
  // the header-level export so the exported file matches what's on screen.
  const scoped = useScopedUserIds(operators)

  const exportCallsMutation = useExportCalls()
  const exportInteractionsMutation = useExportInteractions()

  const exportReadyForCallsListOrInteractions = useMemo(() => {
    if (activeTopTab !== 'calls') return false
    if (activeSubTab === 'list') {
      const s = readCallsUrlState(searchParams)
      return s.period !== 'custom' || !!(s.customFromDate && s.customToDate)
    }
    if (activeSubTab === 'interactions') {
      const s = readInteractionBarState(searchParams)
      const usable = s.period !== 'custom' || !!(s.customFromDate && s.customToDate)
      if (!usable) return false
      const resolved = resolveInteractionUsers(s, operators, scoped.userIds)
      return resolved.kind !== 'empty'
    }
    return false
  }, [activeTopTab, activeSubTab, searchParams, operators, scoped.userIds])

  const isExportingListOrInteractions =
    activeSubTab === 'list'
      ? exportCallsMutation.isPending
      : activeSubTab === 'interactions'
        ? exportInteractionsMutation.isPending
        : false

  const setActiveTopTab = (tab: ActionAnalysisTopTabId) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    if (tab === 'calls' && !next.get('sub')) {
      next.set('sub', 'list')
    }
    if (tab !== 'calls') {
      next.delete('sub')
    }
    setSearchParams(next, { replace: true })
  }

  // visible top tabs filtered by permission. `inbox` only shows
  // for users with `view_inbox`; existing tabs remain visible to anyone
  // with `view_action_analysis` since their sub-tab gating is unchanged.
  const visibleTopTabs = useMemo(() => {
    return ACTION_ANALYSIS_TOP_TABS.filter((tab) => PROD_VISIBLE_TOP_TABS.includes(tab)).filter(
      (tab) => {
        const required = TOP_TAB_PERMISSIONS[tab]
        if (!required) return true
        return userPermissions.includes(required)
      }
    )
  }, [userPermissions])

  // prod-hide START — KAN-413 page-level state for Inbox/Quick-Action
  // surfaces. Wrapped in a block comment so TypeScript doesn't see the
  // declarations (avoids TS6133). Restore: remove the /* and */ wrappers.
  /*
  const showHeaderChrome = userPermissions.includes(PERMISSIONS.ACTION_ANALYSIS.VIEW_INBOX)
  const inboxBarState = readInboxState(searchParams)

  const [rateDialogueOpen, setRateDialogueOpen] = useState(false)
  const handleOpenRateDialogue = () => {
    if (!inboxBarState.operatorId) {
      toast.info(
        t('pages.actionAnalysis.inbox.rateDialogue.noOperator', 'Select an operator first.')
      )
      return
    }
    setRateDialogueOpen(true)
  }

  const [scheduleOneOnOneOpen, setScheduleOneOnOneOpen] = useState(false)
  const handleOpenScheduleOneOnOne = () => {
    if (!inboxBarState.operatorId) {
      toast.info(
        t(
          'pages.actionAnalysis.inbox.scheduleOneOnOne.errors.noOperator',
          'Select an operator first.'
        )
      )
      return
    }
    setScheduleOneOnOneOpen(true)
  }

  const [pendingFeature, setPendingFeature] = useState<null | 'assignTask' | 'assignMaterial'>(null)
  const handleOpenPendingFeature = (kind: 'assignTask' | 'assignMaterial') => () => {
    if (!inboxBarState.operatorId) {
      toast.info(
        t(
          'pages.actionAnalysis.inbox.scheduleOneOnOne.errors.noOperator',
          'Select an operator first.'
        )
      )
      return
    }
    setPendingFeature(kind)
  }

  const focusedOperatorName = useMemo(() => {
    if (!inboxBarState.operatorId) return undefined
    return operators.find((o) => o.id === inboxBarState.operatorId)?.full_name
  }, [inboxBarState.operatorId, operators])

  const headerKpisFilters = useMemo(
    () => ({
      user_ids: scoped.userIds,
      period: inboxBarState.period,
      from_date: inboxBarState.customFromDate,
      to_date: inboxBarState.customToDate,
    }),
    [scoped.userIds, inboxBarState.period, inboxBarState.customFromDate, inboxBarState.customToDate]
  )
  */
  // prod-hide END
  // prod-hide END

  const setActiveSubTab = (sub: ActionAnalysisCallsSubTabId) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'calls')
    next.set('sub', sub)
    setSearchParams(next, { replace: true })
  }

  const handleHeaderExport = async () => {
    try {
      if (activeSubTab === 'list') {
        const state = readCallsUrlState(searchParams)
        const payload = { ...toCallMonitoringQuery(state), sort: 'date_desc' as const }
        await exportCallsMutation.mutateAsync(payload)
      } else if (activeSubTab === 'interactions') {
        const state = readInteractionBarState(searchParams)
        const payload = toInteractionMonitoringQuery(state, operators, scoped.userIds)
        await exportInteractionsMutation.mutateAsync(payload)
      }
    } catch (err) {
      console.error('Export failed:', err)
      toast.error(t('pages.actionAnalysis.errors.exportFailed', 'Export failed'))
    }
  }

  const headerExportVisible =
    activeTopTab === 'calls' && (activeSubTab === 'list' || activeSubTab === 'interactions')

  const visibleSubTabs = useMemo(() => {
    return ACTION_ANALYSIS_CALLS_SUB_TABS.filter((sub) =>
      PROD_VISIBLE_SUB_TABS.includes(sub)
    ).filter((sub) => {
      const meta = SUB_TAB_LABEL_KEYS[sub]
      if (!meta.permission) return true
      return userPermissions.includes(meta.permission)
    })
  }, [userPermissions])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
            {t('pages.actionAnalysis.title', 'Action Analysis')}
          </h1>
          <p className="mt-1 text-sm font-light text-gray-600">
            {t(
              'pages.actionAnalysis.subtitle',
              'Call monitoring and interaction history for the trainer team.'
            )}
          </p>
        </div>
        {headerExportVisible ? (
          <Button
            variant="primary"
            size="md"
            onClick={handleHeaderExport}
            disabled={!exportReadyForCallsListOrInteractions || isExportingListOrInteractions}
            leftIcon={<Icons.Download size={16} className="text-dark-500" />}
            className="h-[45px] w-full rounded-full text-xs sm:w-auto"
          >
            {isExportingListOrInteractions
              ? t('pages.actionAnalysis.actions.exporting', 'Exporting…')
              : t('pages.actionAnalysis.actions.exportExcel', 'Export to Excel')}
          </Button>
        ) : null}
      </div>

      {/* prod-hide START — Trainer Workplace header KPI strip + Quick Action overlay */}
      {/*
      {showHeaderChrome ? (
        <HeaderKpiStrip
          filters={headerKpisFilters}
          onRateDialogue={handleOpenRateDialogue}
          onScheduleOneOnOne={handleOpenScheduleOneOnOne}
          onAssignTask={handleOpenPendingFeature('assignTask')}
          onAssignMaterial={handleOpenPendingFeature('assignMaterial')}
        />
      ) : null}
      */}
      {/* prod-hide END */}

      <div className="border-b border-gray-200">
        <div className="-mb-px flex flex-wrap gap-6" role="tablist">
          {visibleTopTabs.map((tab) => {
            const { key, fallback } = TOP_TAB_LABEL_KEYS[tab]
            const isActive = activeTopTab === tab
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTopTab(tab)}
                className={`border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {t(key, fallback)}
              </button>
            )
          })}
        </div>
      </div>

      {/* prod-hide START — Inbox + Scores top-tab branches. The redirect
          useEffect above coerces stale ?tab=inbox / ?tab=scores URLs to
          ?tab=calls so these branches never render in prod. */}
      {/*
      activeTopTab === 'inbox' ? (
        <InboxTab
          onOpenRateDialogue={handleOpenRateDialogue}
          onOpenScheduleOneOnOne={handleOpenScheduleOneOnOne}
          onOpenAssignTask={handleOpenPendingFeature('assignTask')}
        />
      ) : activeTopTab === 'scores' ? (
        <ScoresTab />
      ) :
      */}
      {/* prod-hide END */}
      {activeTopTab === 'calls' ? (
        <>
          <div className="flex flex-wrap gap-2">
            {visibleSubTabs.map((sub) => {
              const meta = SUB_TAB_LABEL_KEYS[sub]
              const isActive = activeSubTab === sub
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => setActiveSubTab(sub)}
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

          <ScopeSelector ceiling={scopeCeiling} />

          <div>
            {activeSubTab === 'list' && <CallsTab />}
            {activeSubTab === 'interactions' && <InteractionHistoryTab />}
            {activeSubTab === 'ta-history' && <TaHistoryTab />}
            {activeSubTab === 'task-history' && <TaskHistoryTab />}
            {activeSubTab === 'payment-history' && <PaymentHistoryTab />}
            {activeSubTab === 'timeline' && <TimelineTab />}
            {activeSubTab === 'screen-time' && <ScreenTimeTab />}
            {activeSubTab === 'heatmap' && <HeatmapTab />}
            {/* prod-hide START — Script Analytics sub-tab not on prod whitelist */}
            {/* {activeSubTab === 'script-analytics' && <ScriptAnalyticsTab />} */}
            {/* prod-hide END */}
          </div>
        </>
      ) : (
        <div className="rounded-xl bg-white/50 p-12 text-center text-sm text-gray-500 shadow-sm">
          {t(
            'pages.actionAnalysis.topTabsComingSoon',
            'This section will be enabled in a follow-up release.'
          )}
        </div>
      )}

      {/* prod-hide START — Inbox-related dialogs + bottom workspace banner */}
      {/*
      <RateDialogueDialog
        open={rateDialogueOpen}
        onClose={() => setRateDialogueOpen(false)}
        operatorId={inboxBarState.operatorId}
      />

      <ScheduleOneOnOneDialog
        open={scheduleOneOnOneOpen}
        onClose={() => setScheduleOneOnOneOpen(false)}
        operatorId={inboxBarState.operatorId}
      />

      <PendingFeatureDialog
        open={pendingFeature === 'assignTask'}
        onClose={() => setPendingFeature(null)}
        titleKey="pages.actionAnalysis.inbox.pendingFeature.assignTask.title"
        titleFallback="Assign a correction task"
        descriptionKey="pages.actionAnalysis.inbox.pendingFeature.assignTask.description"
        descriptionFallback="Assigns a coaching task to the operator with a due date and reviewable outcome."
        dependsOnIssue="KAN-411"
        operatorName={focusedOperatorName}
      />

      <PendingFeatureDialog
        open={pendingFeature === 'assignMaterial'}
        onClose={() => setPendingFeature(null)}
        titleKey="pages.actionAnalysis.inbox.pendingFeature.assignMaterial.title"
        titleFallback="Assign a course or drill"
        descriptionKey="pages.actionAnalysis.inbox.pendingFeature.assignMaterial.description"
        descriptionFallback="Pushes training material to the operator and tracks completion on the dashboard."
        dependsOnIssue="KAN-416"
        operatorName={focusedOperatorName}
      />

      {showHeaderChrome ? <WorkspaceBanner /> : null}
      */}
      {/* prod-hide END */}
    </div>
  )
}

export default ActionAnalysisPage
