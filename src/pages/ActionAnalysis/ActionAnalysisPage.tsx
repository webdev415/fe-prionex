import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { ACTION_ANALYSIS_TABS, type ActionAnalysisTabId } from './types'
import { CallsTab } from './components/CallsTab'
import { InteractionHistoryTab } from './components/InteractionHistoryTab'

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

  const setActiveTab = (tab: ActionAnalysisTabId) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-dark-500 text-2xl font-light">
          {t('pages.actionAnalysis.title', 'Action Analysis')}
        </h1>
        <p className="mt-1 text-sm font-light text-gray-600">
          {t(
            'pages.actionAnalysis.subtitle',
            'Call monitoring and interaction history for the trainer team.'
          )}
        </p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6" role="tablist">
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
        </nav>
      </div>

      <div>
        {activeTab === 'calls' ? <CallsTab /> : <InteractionHistoryTab />}
      </div>
    </div>
  )
}

export default ActionAnalysisPage
