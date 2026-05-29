export type ActionAnalysisTopTabId = 'calls' | 'scores' | 'training' | 'settings'

export type ActionAnalysisCallsSubTabId =
  | 'list'
  | 'interactions'
  | 'ta-history'
  | 'task-history'
  | 'payment-history'
  | 'timeline'
  | 'screen-time'
  | 'heatmap'
  | 'script-analytics'

// KAN-410 — Scores top-tab sub-tabs (review / aggregation surfaces; the
// per-call scorecard fill-in lives on the existing CallRecordingModal,
// not as a sub-tab).
export type ActionAnalysisScoresSubTabId = 'scorecards' | 'markers' | 'feedback' | 'dynamics'

export const ACTION_ANALYSIS_TOP_TABS: ActionAnalysisTopTabId[] = [
  'calls',
  'scores',
  'training',
  'settings',
]

export const ACTION_ANALYSIS_CALLS_SUB_TABS: ActionAnalysisCallsSubTabId[] = [
  'list',
  'interactions',
  'ta-history',
  'task-history',
  'payment-history',
  'timeline',
  'screen-time',
  'heatmap',
  'script-analytics',
]

export const ACTION_ANALYSIS_SCORES_SUB_TABS: ActionAnalysisScoresSubTabId[] = [
  'scorecards',
  'markers',
  'feedback',
  'dynamics',
]

// Legacy 1-level tab id, retained for the URL-compat shim.
export type ActionAnalysisTabId = 'calls' | 'interactions'
export const ACTION_ANALYSIS_TABS: ActionAnalysisTabId[] = ['calls', 'interactions']
