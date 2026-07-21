/**
 * TA Management hub page.
 *
 * Single tabbed page combining all TA-related admin sections:
 *   - Target Actions (KAN-317)
 *   - TA Chains      (KAN-318)
 *   - Chain Builder
 *   - Quick Picks
 *
 * Tab selection is persisted in the URL `?tab=` query param.
 */

import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { TargetActionsPage } from '@/pages/TargetActions'
import { TAChainsPage } from '@/pages/TAChains'
import { ChainBuilderPage } from '@/pages/ChainBuilder'
import { QuickPicksPage } from '@/pages/QuickPicks'

type TabId = 'target-actions' | 'ta-chains' | 'chain-builder' | 'quick-picks'

const TABS: { id: TabId; labelKey: string; fallback: string }[] = [
  {
    id: 'target-actions',
    labelKey: 'pages.taManagement.tabs.targetActions',
    fallback: 'Target Actions',
  },
  { id: 'ta-chains', labelKey: 'pages.taManagement.tabs.taChains', fallback: 'TA Chains' },
  {
    id: 'chain-builder',
    labelKey: 'pages.taManagement.tabs.chainBuilder',
    fallback: 'Chain Builder',
  },
  {
    id: 'quick-picks',
    labelKey: 'pages.taManagement.tabs.quickPicks',
    fallback: 'Quick Picks',
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
      <div className="border-border mb-4 border-b">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'text-muted-foreground hover:text-foreground hover:border-border border-transparent'
              }`}
            >
              {t(tab.labelKey, { defaultValue: tab.fallback })}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'target-actions' && <TargetActionsPage />}
      {activeTab === 'ta-chains' && <TAChainsPage />}
      {activeTab === 'chain-builder' && <ChainBuilderPage />}
      {activeTab === 'quick-picks' && <QuickPicksPage />}
    </div>
  )
}

export default TAManagementPage
