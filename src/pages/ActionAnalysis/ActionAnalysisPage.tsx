import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { useExportCalls, useExportInteractions } from '@/features/actionAnalysis'
import { ACTION_ANALYSIS_TABS, type ActionAnalysisTabId } from './types'
import { CallsTab } from './components/CallsTab'
import { InteractionHistoryTab } from './components/InteractionHistoryTab'
import { readCallsUrlState, toCallMonitoringQuery } from './lib/callsUrlState'
import {
  readInteractionBarState,
  resolveInteractionUsers,
  toInteractionMonitoringQuery,
} from './lib/interactionsUrlState'

const TAB_LABEL_KEYS: Record<ActionAnalysisTabId, { key: string; fallback: string }> = {
  calls: { key: 'pages.actionAnalysis.tabs.calls', fallback: 'Calls' },
  interactions: {
    key: 'pages.actionAnalysis.tabs.interactions',
    fallback: 'Interaction History',
  },
}

function isTab(value: string | null): value is ActionAnalysisTabId {
  return value !== null && (ACTION_ANALYSIS_TABS as string[]).includes(value)
}

export function ActionAnalysisPage() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const activeTab: ActionAnalysisTabId = isTab(rawTab) ? rawTab : 'calls'

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)

  const exportCallsMutation = useExportCalls()
  const exportInteractionsMutation = useExportInteractions()

  // Whether the active tab's filters yield a usable export request.
  const exportReady = useMemo(() => {
    if (activeTab === 'calls') {
      const s = readCallsUrlState(searchParams)
      return s.period !== 'custom' || !!(s.customFromDate && s.customToDate)
    }
    const s = readInteractionBarState(searchParams)
    const usable = s.period !== 'custom' || !!(s.customFromDate && s.customToDate)
    if (!usable) return false
    const resolved = resolveInteractionUsers(s, operators)
    return resolved.kind !== 'empty'
  }, [activeTab, searchParams, operators])

  const isExporting =
    activeTab === 'calls' ? exportCallsMutation.isPending : exportInteractionsMutation.isPending

  const setActiveTab = (tab: ActionAnalysisTabId) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  const handleExport = async () => {
    try {
      if (activeTab === 'calls') {
        const state = readCallsUrlState(searchParams)
        const payload = { ...toCallMonitoringQuery(state), sort: 'date_desc' as const }
        await exportCallsMutation.mutateAsync(payload)
      } else {
        const state = readInteractionBarState(searchParams)
        const payload = toInteractionMonitoringQuery(state, operators)
        await exportInteractionsMutation.mutateAsync(payload)
      }
    } catch (err) {
      console.error('Export failed:', err)
      toast.error(t('pages.actionAnalysis.errors.exportFailed', 'Export failed'))
    }
  }

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
        <Button
          variant="primary"
          size="md"
          onClick={handleExport}
          disabled={!exportReady || isExporting}
          leftIcon={<Icons.Download size={16} className="text-dark-500" />}
          className="h-[45px] w-full rounded-full text-xs sm:w-auto"
        >
          {isExporting
            ? t('pages.actionAnalysis.actions.exporting', 'Exporting…')
            : t('pages.actionAnalysis.actions.exportExcel', 'Export to Excel')}
        </Button>
      </div>

      <div className="border-b border-gray-200">
        <div className="-mb-px flex gap-6" role="tablist">
          {ACTION_ANALYSIS_TABS.map((tab) => {
            const { key, fallback } = TAB_LABEL_KEYS[tab]
            const isActive = activeTab === tab
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab)}
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

      <div>{activeTab === 'calls' ? <CallsTab /> : <InteractionHistoryTab />}</div>
    </div>
  )
}

export default ActionAnalysisPage
