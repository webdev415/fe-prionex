/**
 * ScoresTab — the Scores top-level tab on Action Analysis (KAN-410).
 *
 * Hosts 4 sub-tabs (scorecards / markers / feedback / dynamics) gated by
 * their matching `view_*` sub-permission. URL: `?tab=scores&sub=…`. The
 * page-level `ScopeSelector` (KAN-506) renders above the sub-tabs so a
 * trainer's "My / Department / All" scope applies uniformly across all
 * four review surfaces.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { PERMISSIONS } from '@/constants/permissions'
import { useAuthStore } from '@/stores/authStore'
import { ScopeSelector } from '../ScopeSelector'
import { ACTION_ANALYSIS_SCORES_SUB_TABS, type ActionAnalysisScoresSubTabId } from '../../types'
import { ScorecardsSubTab } from './ScorecardsSubTab'
import { MarkersSubTab } from './MarkersSubTab'
import { FeedbackSubTab } from './FeedbackSubTab'
import { DynamicsSubTab } from './DynamicsSubTab'

const SUB_TAB_META: Record<
  ActionAnalysisScoresSubTabId,
  { key: string; fallback: string; permission?: string }
> = {
  scorecards: {
    key: 'pages.actionAnalysis.scoresSubTabs.scorecards',
    fallback: 'Scorecards',
    permission: PERMISSIONS.ACTION_ANALYSIS.VIEW_SCORECARD,
  },
  markers: {
    key: 'pages.actionAnalysis.scoresSubTabs.markers',
    fallback: 'Markers',
    permission: PERMISSIONS.ACTION_ANALYSIS.VIEW_MARKERS,
  },
  feedback: {
    key: 'pages.actionAnalysis.scoresSubTabs.feedback',
    fallback: 'Feedback',
    permission: PERMISSIONS.ACTION_ANALYSIS.VIEW_FEEDBACK,
  },
  dynamics: {
    key: 'pages.actionAnalysis.scoresSubTabs.dynamics',
    fallback: 'Score Dynamics',
    permission: PERMISSIONS.ACTION_ANALYSIS.VIEW_SCORE_DYNAMICS,
  },
}

function isScoresSubTab(value: string | null): value is ActionAnalysisScoresSubTabId {
  return value !== null && (ACTION_ANALYSIS_SCORES_SUB_TABS as string[]).includes(value)
}

export function ScoresTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()
  const userPermissions = useAuthStore((s) => s.user?.permissions ?? [])

  const rawSub = searchParams.get('sub')
  const activeSubTab: ActionAnalysisScoresSubTabId = isScoresSubTab(rawSub) ? rawSub : 'scorecards'

  const setActiveSubTab = (sub: ActionAnalysisScoresSubTabId) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'scores')
    next.set('sub', sub)
    setSearchParams(next, { replace: true })
  }

  const visibleSubTabs = useMemo(() => {
    return ACTION_ANALYSIS_SCORES_SUB_TABS.filter((sub) => {
      const meta = SUB_TAB_META[sub]
      if (!meta.permission) return true
      return userPermissions.includes(meta.permission)
    })
  }, [userPermissions])

  if (visibleSubTabs.length === 0) {
    return (
      <div className="bg-card/50 text-muted-foreground rounded-xl p-12 text-center text-sm shadow-sm">
        {t(
          'pages.actionAnalysis.errors.noScoresPermission',
          'You do not have permission to view any quality scoring data.'
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {visibleSubTabs.map((sub) => {
          const meta = SUB_TAB_META[sub]
          const isActive = activeSubTab === sub
          return (
            <button
              key={sub}
              type="button"
              onClick={() => setActiveSubTab(sub)}
              className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-primary-500 border-primary-500 text-primary-foreground'
                  : 'hover:border-primary-300 border-border bg-card text-foreground'
              }`}
            >
              {t(meta.key, meta.fallback)}
            </button>
          )
        })}
      </div>

      <ScopeSelector />

      <div>
        {activeSubTab === 'scorecards' && <ScorecardsSubTab />}
        {activeSubTab === 'markers' && <MarkersSubTab />}
        {activeSubTab === 'feedback' && <FeedbackSubTab />}
        {activeSubTab === 'dynamics' && <DynamicsSubTab />}
      </div>
    </div>
  )
}
