// KAN-413 prepends 'inbox' to the top-tab strip. Existing tabs unchanged
// during Phase A of the redesign rollout; the rename + reshuffle to
// {inbox, team, action-analysis, dialogue-evaluation, training-and-sessions,
// tasks} lands in KAN-415 (Phase B). Read-shims for ?tab=calls etc. continue
// to work until then.
export type ActionAnalysisTopTabId = 'inbox' | 'calls' | 'scores' | 'training' | 'settings'

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

// KAN-413 — Inbox view modes. Inbox is shipped step 4; Kanban (step 7) and
// Grid (step 8) follow.
export type ActionAnalysisInboxViewMode = 'inbox' | 'kanban' | 'grid'

export const ACTION_ANALYSIS_TOP_TABS: ActionAnalysisTopTabId[] = [
  'inbox',
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

export const ACTION_ANALYSIS_INBOX_VIEW_MODES: ActionAnalysisInboxViewMode[] = [
  'inbox',
  'kanban',
  'grid',
]

// Legacy 1-level tab id, retained for the URL-compat shim.
export type ActionAnalysisTabId = 'calls' | 'interactions'
export const ACTION_ANALYSIS_TABS: ActionAnalysisTabId[] = ['calls', 'interactions']
