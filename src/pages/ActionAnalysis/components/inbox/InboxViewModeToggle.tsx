import { useTranslation } from 'react-i18next'
import { ACTION_ANALYSIS_INBOX_VIEW_MODES, type ActionAnalysisInboxViewMode } from '../../types'

const VIEW_MODE_LABEL: Record<ActionAnalysisInboxViewMode, { key: string; fallback: string }> = {
  inbox: { key: 'pages.actionAnalysis.inbox.viewModes.inbox', fallback: 'Inbox' },
  kanban: { key: 'pages.actionAnalysis.inbox.viewModes.kanban', fallback: 'Kanban' },
  grid: { key: 'pages.actionAnalysis.inbox.viewModes.grid', fallback: 'Grid' },
}

/**
 * Three-way Inbox / Kanban / Grid toggle (KAN-413, plan §3.5).
 *
 * Kanban + Grid are disabled in step 4 — their components land in steps 7
 * and 8. The disabled buttons still render so the user sees the full layout
 * preview from day one (matches the Figma chrome).
 */
export interface InboxViewModeToggleProps {
  value: ActionAnalysisInboxViewMode
  onChange: (next: ActionAnalysisInboxViewMode) => void
}

export function InboxViewModeToggle({ value, onChange }: InboxViewModeToggleProps) {
  const { t } = useTranslation('common')

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full bg-white/60 p-1 shadow-sm"
      role="tablist"
      aria-label={t('pages.actionAnalysis.inbox.viewModes.label', 'View mode')}
    >
      {ACTION_ANALYSIS_INBOX_VIEW_MODES.map((mode) => {
        const isActive = mode === value
        const disabled = mode !== 'inbox' // Kanban + Grid land in steps 7-8.
        const { key, fallback } = VIEW_MODE_LABEL[mode]
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => onChange(mode)}
            title={
              disabled
                ? t('pages.actionAnalysis.inbox.viewModes.comingSoon', 'Coming soon')
                : undefined
            }
            className={[
              'rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
              isActive
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-transparent text-gray-700 hover:bg-gray-100',
              disabled ? 'cursor-not-allowed opacity-50' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {t(key, fallback)}
            {disabled ? (
              <span className="ml-1 text-[10px] text-gray-500">
                ({t('pages.actionAnalysis.inbox.viewModes.comingSoonShort', 'soon')})
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
