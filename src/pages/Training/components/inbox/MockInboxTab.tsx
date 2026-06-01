import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import {
  MOCK_INBOX_ROWS,
  MOCK_INBOX_STATE_COUNTS,
  type InboxAssignmentState,
  type MockInboxRow,
} from '../../mocks/trainerWorkplaceMocks'
import { MockInboxListView } from './MockInboxListView'
import { MockInboxKanbanView } from './MockInboxKanbanView'
import { MockInboxGridView } from './MockInboxGridView'
import { MockOperatorDetailPanel } from './MockOperatorDetailPanel'
import { MockWorkspaceBanner } from '../chrome/MockWorkspaceBanner'

/**
 * Boilerplate Inbox top-tab (mock data). Replaces the "coming soon"
 * placeholder while KAN-413's real coaching hooks land. Mirrors the
 * Figma frames:
 *   • Inbox View A — list + right-side detail panel
 *   • Kanban View — 5 state columns
 *   • Grid View — operator tiles
 */
type ViewMode = 'inbox' | 'kanban' | 'grid'

const VIEW_MODES: { id: ViewMode; key: string; fallback: string; icon: typeof Icons.Menu11 }[] = [
  { id: 'inbox', key: 'pages.training.inbox.viewMode.inbox', fallback: 'Inbox', icon: Icons.Mail },
  {
    id: 'kanban',
    key: 'pages.training.inbox.viewMode.kanban',
    fallback: 'Kanban',
    icon: Icons.Menu11,
  },
  { id: 'grid', key: 'pages.training.inbox.viewMode.grid', fallback: 'Grid', icon: Icons.Pivot },
]

const SCOPE_CHIPS: { id: string; key: string; fallback: string }[] = [
  { id: 'my', key: 'pages.training.inbox.scope.my', fallback: 'My' },
  { id: 'group', key: 'pages.training.inbox.scope.group', fallback: 'Group' },
  { id: 'department', key: 'pages.training.inbox.scope.department', fallback: 'Department' },
  { id: 'all', key: 'pages.training.inbox.scope.all', fallback: 'All' },
]

const STATE_FILTER_LABELS: Record<InboxAssignmentState, string> = {
  wait: 'Wait',
  in_progress: 'In progress',
  awaiting_training: 'Awaiting training',
  scheduled: 'Scheduled',
  closed: 'Closed',
}

const STATE_FILTER_TONES: Record<InboxAssignmentState, string> = {
  wait: 'bg-amber-50 text-amber-700',
  in_progress: 'bg-blue-50 text-blue-700',
  awaiting_training: 'bg-violet-50 text-violet-700',
  scheduled: 'bg-indigo-50 text-indigo-700',
  closed: 'bg-gray-100 text-gray-600',
}

export function MockInboxTab() {
  const { t } = useTranslation('common')
  const [view, setView] = useState<ViewMode>('inbox')
  const [scope, setScope] = useState<string>('my')
  const [stateFilter, setStateFilter] = useState<InboxAssignmentState | 'all'>('all')
  const [selectedOperatorId, setSelectedOperatorId] = useState<number>(
    MOCK_INBOX_ROWS[1]?.operatorId ?? 0
  )

  const filteredRows: MockInboxRow[] =
    stateFilter === 'all' ? MOCK_INBOX_ROWS : MOCK_INBOX_ROWS.filter((r) => r.state === stateFilter)

  return (
    <div className="flex min-h-[calc(100vh-220px)] flex-col gap-3 pb-16">
      {/* Sub-strip — scope chips on left, view-mode toggle on right
          (matches Figma Inbox View A frame). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {SCOPE_CHIPS.map((s) => {
            const isActive = s.id === scope
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setScope(s.id)}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 border-primary-300 text-primary-700'
                    : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                {t(s.key, s.fallback)}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-sm">
          {VIEW_MODES.map((vm) => {
            const VmIcon = vm.icon
            const isActive = view === vm.id
            return (
              <button
                key={vm.id}
                type="button"
                onClick={() => setView(vm.id)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  isActive ? 'bg-primary-500 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <VmIcon size={12} className={isActive ? 'text-white' : 'text-gray-500'} />
                {t(vm.key, vm.fallback)}
              </button>
            )
          })}
        </div>
      </div>

      {/* State filter chips — active chips show an "X" to clear, matching the
          Figma "All my departments x" / "Average x" pattern. */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setStateFilter('all')}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
            stateFilter === 'all'
              ? 'border-primary-400 bg-primary-50 text-primary-700'
              : 'border-gray-200 bg-white text-gray-700'
          }`}
        >
          {t('pages.training.inbox.filters.all', 'All states')}
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] ${
              stateFilter === 'all'
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {MOCK_INBOX_ROWS.length}
          </span>
          {stateFilter === 'all' ? <Icons.Close size={10} className="text-primary-600" /> : null}
        </button>
        {(Object.keys(STATE_FILTER_LABELS) as InboxAssignmentState[]).map((s) => {
          const isActive = stateFilter === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStateFilter(isActive ? 'all' : s)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'border-primary-400 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              {STATE_FILTER_LABELS[s]}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                  isActive ? 'bg-primary-100 text-primary-700' : STATE_FILTER_TONES[s]
                }`}
              >
                {MOCK_INBOX_STATE_COUNTS[s]}
              </span>
              {isActive ? <Icons.Close size={10} className="text-primary-600" /> : null}
            </button>
          )
        })}
      </div>

      {/* Body */}
      {view === 'inbox' ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(360px,_440px)_1fr]">
          <MockInboxListView
            rows={filteredRows}
            selectedOperatorId={selectedOperatorId}
            onSelect={setSelectedOperatorId}
          />
          <MockOperatorDetailPanel
            operator={MOCK_INBOX_ROWS.find((r) => r.operatorId === selectedOperatorId) ?? null}
          />
        </div>
      ) : view === 'kanban' ? (
        <MockInboxKanbanView rows={filteredRows} onSelect={setSelectedOperatorId} />
      ) : (
        <MockInboxGridView rows={filteredRows} onSelect={setSelectedOperatorId} />
      )}

      <div className="mt-auto">
        <MockWorkspaceBanner />
      </div>
    </div>
  )
}

export default MockInboxTab
