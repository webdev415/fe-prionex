import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MdOutlineDashboard,
  MdOutlineSettings,
  MdOutlinePersonOff,
  MdOutlineHistory,
  MdInfoOutline,
} from 'react-icons/md'
import { OverviewTab } from './components/OverviewTab'
import { SettingsTab } from './components/SettingsTab'
import { OptOutTab } from './components/OptOutTab'
import { AuditLogTab } from './components/AuditLogTab'
import { useOptOutClients } from './api'

type TabKey = 'overview' | 'settings' | 'optout' | 'audit'

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Overview', icon: <MdOutlineDashboard size={16} /> },
  { key: 'settings', label: 'Settings', icon: <MdOutlineSettings size={16} /> },
  { key: 'optout', label: 'Opt-out clients', icon: <MdOutlinePersonOff size={16} /> },
  { key: 'audit', label: 'Audit log', icon: <MdOutlineHistory size={16} /> },
]

/**
 * UBKI Integration admin page (Settings → Integrations → UBKI).
 *
 * Frontend-first: Overview is built against real + mock data; the other tabs
 * are scaffolded here and filled in follow-up increments. Route + permission
 * live in src/routes/index.tsx.
 */
export function UbkiIntegrationPage() {
  const { t } = useTranslation('common')
  const [tab, setTab] = useState<TabKey>('overview')
  // Real opt-out count for the tab badge.
  const { data: optOut } = useOptOutClients()
  const optOutCount = optOut?.length ?? 0

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="border-success-200 bg-success-50 text-success-700 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
          <span className="bg-success-500 h-1.5 w-1.5 rounded-full" />
          {t('pages.ubkiIntegration.page.status.active', 'Active')}
        </span>
        <h1 className="text-foreground text-xl font-semibold">
          {t('pages.ubkiIntegration.page.title', 'UBKI Integration')}
        </h1>
        <MdInfoOutline size={18} className="text-muted-foreground" />
      </div>

      {/* Tab bar */}
      <div className="border-border flex items-center gap-6 border-b">
        {TABS.map((item) => {
          const active = tab === item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                active
                  ? 'border-primary-500 text-foreground'
                  : 'hover:text-foreground text-muted-foreground border-transparent'
              }`}
            >
              {item.icon}
              {t(`pages.ubkiIntegration.page.tabs.${item.key}`, item.label)}
              {item.key === 'optout' && optOutCount > 0 && (
                <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-xs font-medium">
                  {optOutCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab />}
      {tab === 'settings' && <SettingsTab />}
      {tab === 'optout' && <OptOutTab />}
      {tab === 'audit' && <AuditLogTab />}
    </div>
  )
}

export default UbkiIntegrationPage
