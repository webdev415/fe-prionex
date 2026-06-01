import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import {
  MOCK_INBOX_PRIORITY_COUNTS,
  MOCK_INBOX_ROWS,
  MOCK_INBOX_TEAM_EVENTS,
  type InboxPriority,
  type MockInboxRow,
} from '../../mocks/trainerWorkplaceMocks'
import { MockInboxListView } from './MockInboxListView'
import { MockInboxKanbanView } from './MockInboxKanbanView'
import { MockInboxGridView } from './MockInboxGridView'
import { MockOperatorDetailPanel } from './MockOperatorDetailPanel'
import { MockWorkspaceBanner } from '../chrome/MockWorkspaceBanner'

type ViewMode = 'inbox' | 'kanban' | 'grid'

const VIEW_MODES: {
  id: ViewMode
  key: string
  fallback: string
  icon: typeof Icons.Mail
}[] = [
  { id: 'inbox', key: 'pages.training.inbox.viewMode.inbox', fallback: 'Inbox', icon: Icons.Mail },
  {
    id: 'kanban',
    key: 'pages.training.inbox.viewMode.kanban',
    fallback: 'Kanban',
    icon: Icons.Menu11,
  },
  { id: 'grid', key: 'pages.training.inbox.viewMode.grid', fallback: 'Grid', icon: Icons.Pivot },
]

const PRIORITY_CHIPS: { id: InboxPriority | 'all'; key: string; fallback: string }[] = [
  { id: 'all', key: 'pages.training.inbox.priority.all', fallback: 'All priorities' },
  { id: 'average', key: 'pages.training.inbox.priority.average', fallback: 'Average' },
  { id: 'low', key: 'pages.training.inbox.priority.low', fallback: 'Low' },
]

/** Main + Details/Event Feed sidebar — Figma Details-RightView 360px panel. */
const BODY_LAYOUT = 'grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]'

export function MockInboxTab() {
  const { t } = useTranslation('common')
  const [view, setView] = useState<ViewMode>('inbox')
  const [priority, setPriority] = useState<InboxPriority | 'all'>('all')
  const [selectedOperatorId, setSelectedOperatorId] = useState<number>(1)
  const [detailTab, setDetailTab] = useState<'details' | 'feed'>('details')

  const filteredRows: MockInboxRow[] = useMemo(() => {
    if (priority === 'all') return MOCK_INBOX_ROWS
    return MOCK_INBOX_ROWS.filter((r) => r.priority === priority)
  }, [priority])

  const selectedOperator =
    MOCK_INBOX_ROWS.find((r) => r.operatorId === selectedOperatorId) ?? filteredRows[0] ?? null

  return (
    <div className="relative flex min-h-[calc(100vh-220px)] flex-col gap-3 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {PRIORITY_CHIPS.map((chip) => {
            const isActive = priority === chip.id
            const count = MOCK_INBOX_PRIORITY_COUNTS[chip.id]
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setPriority(chip.id)}
                className={`flex items-center gap-1 rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                  isActive ? 'bg-[#204E4D] text-white' : 'bg-white text-[#05040D] hover:bg-gray-50'
                }`}
              >
                {t(chip.key, chip.fallback)}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                    isActive ? 'bg-[#BBFB5B] text-[#05040D]' : 'bg-[#EDEDED] text-[#05040D]'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center rounded-lg border border-white bg-white p-1 shadow-sm">
          {VIEW_MODES.map((vm) => {
            const VmIcon = vm.icon
            const isActive = view === vm.id
            return (
              <button
                key={vm.id}
                type="button"
                onClick={() => setView(vm.id)}
                className={`flex items-center gap-2 rounded-md px-7 py-2 text-xs font-medium transition-colors ${
                  isActive ? 'bg-[#204E4D] text-white' : 'text-[#05040D] hover:bg-gray-50'
                }`}
              >
                <VmIcon size={14} className={isActive ? 'text-white' : 'text-gray-500'} />
                {t(vm.key, vm.fallback)}
              </button>
            )
          })}
        </div>
      </div>

      <div className={BODY_LAYOUT}>
        {view === 'inbox' ? (
          <MockInboxListView
            rows={filteredRows}
            selectedOperatorId={selectedOperator?.operatorId ?? 0}
            onSelect={setSelectedOperatorId}
          />
        ) : view === 'kanban' ? (
          <MockInboxKanbanView
            rows={filteredRows}
            selectedOperatorId={selectedOperator?.operatorId}
            onSelect={setSelectedOperatorId}
          />
        ) : (
          <MockInboxGridView
            rows={filteredRows}
            selectedOperatorId={selectedOperator?.operatorId}
            onSelect={setSelectedOperatorId}
          />
        )}

        <MockOperatorDetailPanel
          operator={selectedOperator}
          showTabs
          activeTab={detailTab}
          onTabChange={setDetailTab}
          eventFeedCount={MOCK_INBOX_TEAM_EVENTS.length}
        />
      </div>

      <div className="pointer-events-none fixed right-0 bottom-4 left-0 z-20 flex justify-center px-4 lg:left-[var(--sidebar-width,0px)]">
        <div className="pointer-events-auto w-full max-w-[1110px]">
          <MockWorkspaceBanner />
        </div>
      </div>
    </div>
  )
}

export default MockInboxTab
