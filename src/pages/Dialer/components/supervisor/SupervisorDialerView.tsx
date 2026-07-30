/**
 * Supervisor dialer admin (KAN-379).
 *
 * Four tabs (design: supervisor-01..07):
 *   - Queue of Numbers  → CSV upload + queue status
 *   - Add from CRM       → filter clients and bulk-add to a queue
 *   - Analysis           → live per-operator + SIM statistics
 *   - Queue List         → queue (campaign/preset) CRUD
 *
 * Tab selection is persisted in the URL `?tab=` param, mirroring
 * TAManagementPage. Tab bodies are placeholders in this wiring slice and are
 * filled in the subsequent supervisor slices.
 */

import { type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { Icons } from '@/lib/icons'

import { AddFromCrmTab } from './tabs/AddFromCrmTab'
import { AnalysisTab } from './tabs/AnalysisTab'
import { QueueListTab } from './tabs/QueueListTab'
import { QueueNumbersTab } from './tabs/QueueNumbersTab'

type TabId = 'queue-numbers' | 'add-from-crm' | 'analysis' | 'queue-list'

type TabIcon = ComponentType<{ size?: number; className?: string; strokeWidth?: number }>

const TABS: { id: TabId; labelKey: string; fallback: string; Icon: TabIcon }[] = [
  {
    id: 'queue-numbers',
    labelKey: 'dialer.tabs.queueNumbers',
    fallback: 'Queue of Numbers',
    Icon: Icons.DialpadSquare,
  },
  {
    id: 'add-from-crm',
    labelKey: 'dialer.tabs.addFromCrm',
    fallback: 'Add from CRM',
    Icon: Icons.AddMale,
  },
  { id: 'analysis', labelKey: 'dialer.tabs.analysis', fallback: 'Analysis', Icon: Icons.Profile02 },
  {
    id: 'queue-list',
    labelKey: 'dialer.tabs.queueList',
    fallback: 'Queue List',
    Icon: Icons.RightToLeftListNumber,
  },
]

export function SupervisorDialerView() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as TabId) ?? 'queue-numbers'

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
              className={`flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-700'
                  : 'text-muted-foreground hover:text-foreground hover:border-border border-transparent'
              }`}
            >
              <tab.Icon size={18} strokeWidth={2} />
              {t(tab.labelKey, { defaultValue: tab.fallback })}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content (remaining placeholders filled in later slices) */}
      {activeTab === 'queue-numbers' && <QueueNumbersTab />}
      {activeTab === 'add-from-crm' && <AddFromCrmTab />}
      {activeTab === 'analysis' && <AnalysisTab />}
      {activeTab === 'queue-list' && <QueueListTab />}
    </div>
  )
}

export default SupervisorDialerView
