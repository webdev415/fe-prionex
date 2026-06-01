import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { ACTION_ANALYSIS_SUB_TABS, type ActionAnalysisSubTabId } from '../../types'
import { InteractionHistoryTab } from '../InteractionHistoryTab'
import { WeeklyTasksSubTab } from './WeeklyTasksSubTab'
import { PromisesAndCallbacksSubTab } from './PromisesAndCallbacksSubTab'
import { SuccessfulClosuresSubTab } from './SuccessfulClosuresSubTab'
import { LeaksSubTab } from './LeaksSubTab'
import { ThirdPartiesSubTab } from './ThirdPartiesSubTab'
import { ScriptAnalyticsRedesignSubTab } from './ScriptAnalyticsRedesignSubTab'
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

  const subTabs = useMemo(() => ACTION_ANALYSIS_SUB_TABS, [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {subTabs.map((sub) => {
          const meta = SUB_TAB_LABELS[sub]
          const isActive = activeSubTab === sub
          return (
            <button
              key={sub}
              type="button"
              onClick={() => setActiveSubTab(sub)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
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

      <div>
        {activeSubTab === 'interactions' && (
          <div className="flex flex-col gap-4">
            <InteractionsKpiStrip />
            <InteractionHistoryTab />
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
      </div>
    </div>
  )
}

export default ActionAnalysisInnerTab
