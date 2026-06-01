import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import {
  ACTION_ANALYSIS_SCOPES,
  readScope,
  writeScope,
  type ActionAnalysisScope,
} from '../lib/scope'

const SCOPE_LABEL_KEY: Record<ActionAnalysisScope, { key: string; fallback: string }> = {
  my: { key: 'pages.training.scope.my', fallback: 'My actions' },
  group: { key: 'pages.training.scope.group', fallback: 'Group actions' },
  department: {
    key: 'pages.training.scope.department',
    fallback: 'Department actions',
  },
  all: { key: 'pages.training.scope.all', fallback: 'All actions' },
}

/**
 * Page-level scope selector (KAN-506). Lives on ActionAnalysisPage just
 * below the sub-tab strip. Renders four segmented pills; clicking writes
 * `?scope=â€¦` and lets every Calls sub-tab pick up the new value via
 * `useScopedUserIds`. The "Group" pill is disabled until the Group entity
 * ships (see KAN-506 Â§1.4).
 */
export function ScopeSelector() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()
  const active = readScope(searchParams)

  const handleClick = (next: ActionAnalysisScope) => {
    if (next === active) return
    setSearchParams(writeScope(searchParams, next), { replace: true })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-gray-600">
        {t('pages.training.scope.label', 'View scope')}
      </span>
      <div
        className="inline-flex flex-wrap items-center gap-2 rounded-full bg-white/50 p-1 shadow-sm"
        role="tablist"
        aria-label={t('pages.training.scope.label', 'View scope')}
      >
        {ACTION_ANALYSIS_SCOPES.map((scope) => {
          const isActive = scope === active
          const disabled = scope === 'group'
          const { key, fallback } = SCOPE_LABEL_KEY[scope]
          const label = t(key, fallback)
          return (
            <button
              key={scope}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={disabled}
              onClick={() => handleClick(scope)}
              title={
                disabled ? t('pages.training.scope.groupComingSoon', 'Coming soon') : undefined
              }
              className={[
                'rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-transparent text-gray-700 hover:bg-gray-100',
                disabled ? 'cursor-not-allowed opacity-50 hover:bg-transparent' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {label}
              {disabled ? (
                <span className="ml-1 text-[10px] text-gray-500">
                  ({t('pages.training.scope.groupComingSoon', 'Coming soon')})
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ScopeSelector
