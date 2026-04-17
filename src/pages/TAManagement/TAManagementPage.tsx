/**
 * TA Management hub page.
 *
 * Single tabbed page combining all TA-related admin sections:
 *   - Target Actions (KAN-317)
 *   - TA Chains      (KAN-318)
 *   - Dictionary     (KAN-327)
 *   - Chain Builder
 *
 * Tab selection is persisted in the URL `?tab=` query param.
 */

import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { TargetActionsPage } from '@/pages/TargetActions'
import { TAChainsPage } from '@/pages/TAChains'
import { TADictionaryPage } from '@/pages/TADictionary'
import { ChainBuilderPage } from '@/pages/ChainBuilder'

type TabId = 'target-actions' | 'ta-chains' | 'dictionary' | 'chain-builder'

const TABS: { id: TabId; labelKey: string; fallback: string }[] = [
  {
    id: 'target-actions',
    labelKey: 'pages.taManagement.tabs.targetActions',
    fallback: 'Target Actions',
  },
  { id: 'ta-chains', labelKey: 'pages.taManagement.tabs.taChains', fallback: 'TA Chains' },
  { id: 'dictionary', labelKey: 'pages.taManagement.tabs.dictionary', fallback: 'Dictionary' },
  {
    id: 'chain-builder',
    labelKey: 'pages.taManagement.tabs.chainBuilder',
    fallback: 'Chain Builder',
  },
]

export function TAManagementPage() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as TabId) ?? 'target-actions'

  const setTab = (id: TabId) => {
    setSearchParams({ tab: id }, { replace: true })
  }

  return (
    <div className="flex w-full flex-col">
      {/* Tab bar */}
      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {t(tab.labelKey, tab.fallback)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'target-actions' && <TargetActionsPage />}
      {activeTab === 'ta-chains' && <TAChainsPage />}
      {activeTab === 'dictionary' && <TADictionaryPage />}
      {activeTab === 'chain-builder' && <ChainBuilderPage />}
    </div>
  )
}

export default TAManagementPage
