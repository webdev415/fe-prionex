import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useUnreviewedFlagsCount } from '@/features/training'
import { ACTION_ANALYSIS_SUB_TABS, type ActionAnalysisSubTabId } from '../../types'
import { AutoFlagsSubTab } from './AutoFlagsSubTab'
import { MockInteractionsTab } from './MockInteractionsTab'
import { WeeklyTasksSubTab } from './WeeklyTasksSubTab'
import { PromisesAndCallbacksSubTab } from './PromisesAndCallbacksSubTab'
import { SuccessfulClosuresSubTab } from './SuccessfulClosuresSubTab'
import { LeaksSubTab } from './LeaksSubTab'
import { ThirdPartiesSubTab } from './ThirdPartiesSubTab'
import { ScriptAnalyticsRedesignSubTab } from './ScriptAnalyticsRedesignSubTab'
import { TrainingSegmentedStrip } from '../chrome/TrainingSegmentedStrip'
import { InteractionsKpiStrip } from './InteractionsKpiStrip'
import { MockTimeAtWorkSubTab } from './MockTimeAtWorkSubTab'
import { MockHeatMapSubTab } from './MockHeatMapSubTab'

/**
 * Action Analysis inner orchestrator (KAN-415). Hosts the 9-sub-tab strip and
 * dispatches to each sub-tab body. Order from plan §3.3:
 *   Interactions / Weekly Tasks / Promises / Closures / Leaks / Third
 *   Parties / Heat Map / Time at Work / Script Analytics.
 */
const SUB_TAB_LABELS: Record<ActionAnalysisSubTabId, { key: string; fallback: string }> = {
  interactions: {
    key: 'pages.training.analyticsSubTabs.interactions',
    fallback: 'Interactions',
  },
  'weekly-tasks': {
    key: 'pages.training.analyticsSubTabs.weeklyTasks',
    fallback: 'Weekly Tasks',
  },
  'promises-and-callbacks': {
    key: 'pages.training.analyticsSubTabs.promises',
    fallback: 'Promises and Callbacks',
  },
  'successful-closures': {
    key: 'pages.training.analyticsSubTabs.closures',
    fallback: 'Successful Closures',
  },
  leaks: { key: 'pages.training.analyticsSubTabs.leaks', fallback: 'Leaks' },
  'third-parties': {
    key: 'pages.training.analyticsSubTabs.thirdParties',
    fallback: 'Third Parties',
  },
  heatmap: { key: 'pages.training.analyticsSubTabs.heatmap', fallback: 'Heat Map' },
  'time-at-work': {
    key: 'pages.training.analyticsSubTabs.timeAtWork',
    fallback: 'Time at Work',
  },
  'script-analytics': {
    key: 'pages.training.analyticsSubTabs.scriptAnalytics',
    fallback: 'Script Analytics',
  },
  'auto-flags': {
    key: 'pages.training.analyticsSubTabs.autoFlags',
    fallback: 'Auto-flags',
  },
}

function isSubTab(value: string | null): value is ActionAnalysisSubTabId {
  return value !== null && (ACTION_ANALYSIS_SUB_TABS as string[]).includes(value)
}

export function ActionAnalysisInnerTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()

  const rawSub = searchParams.get('sub')
  const activeSubTab: ActionAnalysisSubTabId = isSubTab(rawSub) ? rawSub : 'interactions'

  const setActiveSubTab = (sub: ActionAnalysisSubTabId) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'action-analysis')
    next.set('sub', sub)
    setSearchParams(next, { replace: true })
  }

  // KAN-411 Feature 3.3 — pending auto-flag count drives the chip badge
  // for the Auto-flags sub-tab. Hook polls every 60s per plan §4.3 (the
  // sidebar-badge equivalent is deferred — Sidebar doesn't expose a
  // badge slot today, and decorating it would touch unrelated layout).
  const { data: pendingFlagCount } = useUnreviewedFlagsCount()

  const subTabs = useMemo(
    () =>
      ACTION_ANALYSIS_SUB_TABS.map((sub) => {
        const meta = SUB_TAB_LABELS[sub]
        return {
          id: sub,
          label: t(meta.key, meta.fallback),
          count:
            sub === 'auto-flags' && pendingFlagCount && pendingFlagCount > 0
              ? pendingFlagCount
              : undefined,
        }
      }),
    [t, pendingFlagCount]
  )

  return (
    <div className="flex flex-col gap-4">
      <TrainingSegmentedStrip
        items={subTabs}
        activeId={activeSubTab}
        onChange={(id) => setActiveSubTab(id as ActionAnalysisSubTabId)}
      />

      <div>
        {activeSubTab === 'interactions' && (
          <div className="flex flex-col gap-4">
            <InteractionsKpiStrip />
            <MockInteractionsTab />
          </div>
        )}
        {activeSubTab === 'weekly-tasks' && <WeeklyTasksSubTab />}
        {activeSubTab === 'promises-and-callbacks' && <PromisesAndCallbacksSubTab />}
        {activeSubTab === 'successful-closures' && <SuccessfulClosuresSubTab />}
        {activeSubTab === 'leaks' && <LeaksSubTab />}
        {activeSubTab === 'third-parties' && <ThirdPartiesSubTab />}
        {activeSubTab === 'heatmap' && <MockHeatMapSubTab />}
        {activeSubTab === 'time-at-work' && <MockTimeAtWorkSubTab />}
        {activeSubTab === 'script-analytics' && <ScriptAnalyticsRedesignSubTab />}
        {activeSubTab === 'auto-flags' && <AutoFlagsSubTab />}
      </div>
    </div>
  )
}

export default ActionAnalysisInnerTab
