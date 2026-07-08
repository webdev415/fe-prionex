import { useState } from 'react'
import {
  MdOutlineDashboard,
  MdOutlineSettings,
  MdOutlinePersonOff,
  MdOutlineHistory,
  MdInfoOutline,
} from 'react-icons/md'
import { MOCK_KPIS } from './mockData'
import { OverviewTab } from './components/OverviewTab'
import { SettingsTab } from './components/SettingsTab'
import { OptOutTab } from './components/OptOutTab'
import { AuditLogTab } from './components/AuditLogTab'

type TabKey = 'overview' | 'settings' | 'optout' | 'audit'

const TABS: { key: TabKey; label: string; icon: React.ReactNode; badge?: number }[] = [
  { key: 'overview', label: 'Overview', icon: <MdOutlineDashboard size={16} /> },
  { key: 'settings', label: 'Settings', icon: <MdOutlineSettings size={16} /> },
  {
    key: 'optout',
    label: 'Opt-out clients',
    icon: <MdOutlinePersonOff size={16} />,
    badge: MOCK_KPIS.optOut,
  },
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
  const [tab, setTab] = useState<TabKey>('overview')

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="border-success-200 bg-success-50 text-success-700 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium">
          <span className="bg-success-500 h-1.5 w-1.5 rounded-full" />
          Active
        </span>
        <h1 className="text-dark-500 text-xl font-semibold">UBKI Integration</h1>
        <MdInfoOutline size={18} className="text-gray-500" />
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-6 border-b border-gray-200">
        {TABS.map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                active
                  ? 'border-primary-500 text-dark-500'
                  : 'hover:text-dark-500 border-transparent text-gray-500'
              }`}
            >
              {t.icon}
              {t.label}
              {t.badge != null && (
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                  {t.badge}
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
