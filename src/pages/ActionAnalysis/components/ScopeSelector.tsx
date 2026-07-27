import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import {
  ACTION_ANALYSIS_SCOPES,
  clampScopeToCeiling,
  isScopeWithinCeiling,
  readScope,
  writeScope,
  type ActionAnalysisScope,
} from '../lib/scope'

const SCOPE_LABEL_KEY: Record<ActionAnalysisScope, { key: string; fallback: string }> = {
  my: { key: 'pages.actionAnalysis.scope.my', fallback: 'My actions' },
  group: { key: 'pages.actionAnalysis.scope.group', fallback: 'Group actions' },
  department: {
    key: 'pages.actionAnalysis.scope.department',
    fallback: 'Department actions',
  },
  all: { key: 'pages.actionAnalysis.scope.all', fallback: 'All actions' },
}

interface ScopeSelectorProps {
  /**
   * The active tab's role access ceiling. Scopes broader than this
   * are disabled, and a URL scope exceeding it is auto-clamped. Defaults to
   * `all` (no restriction) when the role has no configured level for the tab.
   */
  ceiling?: ActionAnalysisScope
}

/**
 * Page-level scope selector. Lives on ActionAnalysisPage
 * just below the sub-tab strip. Renders four segmented pills; clicking writes
 * `?scope=…` and every Calls sub-tab picks up the new value via
 * `useScopedUserIds`. Pills broader than the active tab's role `ceiling` are
 * disabled and the URL scope is clamped into range.
 */
export function ScopeSelector({ ceiling = 'all' }: ScopeSelectorProps) {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()
  const active = readScope(searchParams)

  // Keep the URL scope within the active tab's ceiling (e.g. after switching to
  // a more-restricted tab). The backend clamps regardless; this keeps the UI
  // honest and the highlighted pill valid.
  useEffect(() => {
    const clamped = clampScopeToCeiling(active, ceiling)
    if (clamped !== active) {
      setSearchParams(writeScope(searchParams, clamped), { replace: true })
    }
  }, [active, ceiling, searchParams, setSearchParams])

  const handleClick = (next: ActionAnalysisScope) => {
    if (next === active) return
    if (!isScopeWithinCeiling(next, ceiling)) return
    setSearchParams(writeScope(searchParams, next), { replace: true })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs font-medium">
        {t('pages.actionAnalysis.scope.label', 'View scope')}
      </span>
      <div
        className="bg-card/50 inline-flex flex-wrap items-center gap-2 rounded-full p-1 shadow-sm"
        role="tablist"
        aria-label={t('pages.actionAnalysis.scope.label', 'View scope')}
      >
        {ACTION_ANALYSIS_SCOPES.map((scope) => {
          const isActive = scope === active
          const disabled = !isScopeWithinCeiling(scope, ceiling)
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
                disabled
                  ? t('pages.actionAnalysis.scope.aboveCeiling', 'Not permitted by your role')
                  : undefined
              }
              className={[
                'rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
                isActive
                  ? 'bg-primary-500 text-primary-foreground shadow-sm'
                  : 'text-foreground hover:bg-muted bg-transparent',
                disabled ? 'cursor-not-allowed opacity-50 hover:bg-transparent' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ScopeSelector
