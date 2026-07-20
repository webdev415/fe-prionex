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

import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { QueueListTab } from './tabs/QueueListTab'
import { QueueNumbersTab } from './tabs/QueueNumbersTab'

type TabId = 'queue-numbers' | 'add-from-crm' | 'analysis' | 'queue-list'

const TABS: { id: TabId; labelKey: string; fallback: string }[] = [
  { id: 'queue-numbers', labelKey: 'dialer.tabs.queueNumbers', fallback: 'Queue of Numbers' },
  { id: 'add-from-crm', labelKey: 'dialer.tabs.addFromCrm', fallback: 'Add from CRM' },
  { id: 'analysis', labelKey: 'dialer.tabs.analysis', fallback: 'Analysis' },
  { id: 'queue-list', labelKey: 'dialer.tabs.queueList', fallback: 'Queue List' },
]

function TabPlaceholder({ label }: { label: string }) {
  const { t } = useTranslation('common')
  return (
    <div className="border-border text-muted-foreground rounded-xl border bg-white p-10 text-center text-sm">
      {t('dialer.comingSoon', '{{section}} — coming soon', { section: label })}
    </div>
  )
}

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

      {/* Tab content (remaining placeholders filled in later slices) */}
      {activeTab === 'queue-numbers' && <QueueNumbersTab />}
      {activeTab === 'add-from-crm' && (
        <TabPlaceholder label={t('dialer.tabs.addFromCrm', 'Add from CRM')} />
      )}
      {activeTab === 'analysis' && <TabPlaceholder label={t('dialer.tabs.analysis', 'Analysis')} />}
      {activeTab === 'queue-list' && <QueueListTab />}
    </div>
  )
}

export default SupervisorDialerView
