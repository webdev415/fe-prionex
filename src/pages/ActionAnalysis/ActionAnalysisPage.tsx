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
import { TimelineTab } from './components/TimelineTab'
import { ScreenTimeTab } from './components/ScreenTimeTab'
import { HeatmapTab } from './components/HeatmapTab'
import { ScriptAnalyticsTab } from './components/ScriptAnalyticsTab'
import { readCallsUrlState, toCallMonitoringQuery } from './lib/callsUrlState'
import {
  readInteractionBarState,
  resolveInteractionUsers,
  toInteractionMonitoringQuery,
} from './lib/interactionsUrlState'

const TOP_TAB_LABEL_KEYS: Record<ActionAnalysisTopTabId, { key: string; fallback: string }> = {
  calls: { key: 'pages.actionAnalysis.topTabs.calls', fallback: 'Calls' },
  scores: { key: 'pages.actionAnalysis.topTabs.scores', fallback: 'Scores' },
  training: { key: 'pages.actionAnalysis.topTabs.training', fallback: 'Training' },
  settings: { key: 'pages.actionAnalysis.topTabs.settings', fallback: 'Settings' },
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

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)

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
      const resolved = resolveInteractionUsers(s, operators)
      return resolved.kind !== 'empty'
    }
    return false
  }, [activeTopTab, activeSubTab, searchParams, operators])

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
        const payload = toInteractionMonitoringQuery(state, operators)
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
    return ACTION_ANALYSIS_CALLS_SUB_TABS.filter((sub) => {
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
              'Operator analytics and quality monitoring for the trainer team.'
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

      <div className="border-b border-gray-200">
        <div className="-mb-px flex flex-wrap gap-6" role="tablist">
          {ACTION_ANALYSIS_TOP_TABS.map((tab) => {
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

          <div>
            {activeSubTab === 'list' && <CallsTab />}
            {activeSubTab === 'interactions' && <InteractionHistoryTab />}
            {activeSubTab === 'ta-history' && <TaHistoryTab />}
            {activeSubTab === 'timeline' && <TimelineTab />}
            {activeSubTab === 'screen-time' && <ScreenTimeTab />}
            {activeSubTab === 'heatmap' && <HeatmapTab />}
            {activeSubTab === 'script-analytics' && <ScriptAnalyticsTab />}
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
    </div>
  )
}

export default ActionAnalysisPage
