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

// Legacy 1-level tab id, retained for the URL-compat shim.
export type ActionAnalysisTabId = 'calls' | 'interactions'
export const ACTION_ANALYSIS_TABS: ActionAnalysisTabId[] = ['calls', 'interactions']
