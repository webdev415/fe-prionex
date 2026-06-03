// Training page top-tab union (formerly ActionAnalysisTopTabId, renamed
// when the page itself was renamed from Action Analysis → Training).
// One of these top-tabs is still called "Action Analysis" — the type that
// describes its sub-tabs (`ActionAnalysisSubTabId` below) keeps the
// `ActionAnalysis*` prefix because it's namespaced to that inner tab, not
// to the page.
//
// Legacy IDs (`calls`, `scores`, `training`, `settings`) remain in the
// union so existing URL-shims keep type-checking until Phase B drops them.
export type TrainingTopTabId =
  | 'inbox'
  | 'team'
  | 'action-analysis'
  | 'dialogue-evaluation'
  | 'trainings-and-sessions'
  | 'tasks'
  // Legacy — kept for read-shims and prod-hide gates.
  | 'calls'
  | 'scores'
  | 'training'
  | 'settings'

// Sub-tabs of the "Action Analysis" inner top-tab (left→right order from
// plan §3.3). Naming reflects the inner tab, not the Training page.
export type ActionAnalysisSubTabId =
  | 'interactions'
  | 'weekly-tasks'
  | 'promises-and-callbacks'
  | 'successful-closures'
  | 'leaks'
  | 'third-parties'
  | 'heatmap'
  | 'time-at-work'
  | 'script-analytics'

// Legacy `calls` sub-tab union. Kept so the existing CallsTab branches still
// compile while the prod-hide URL grammar is in place.
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

// KAN-410 — Scores top-tab sub-tabs (legacy; relocated under Dialogue
// Evaluation by KAN-504).
export type ActionAnalysisScoresSubTabId = 'scorecards' | 'markers' | 'feedback' | 'dynamics'

// KAN-413 — Inbox view modes. Inbox is shipped step 4; Kanban (step 7) and
// Grid (step 8) follow. Lives at page level since the Inbox top-tab owns it.
export type TrainingInboxViewMode = 'inbox' | 'kanban' | 'grid'

// KAN-498 / KAN-499 — Trainings and Sessions top-tab sub-tabs. KAN-416's
// expanded surface (group trainings / drills / calendar / tests) is part of
// the Figma source, so the boilerplate ships it with mock data even though
// backend lands in a later round.
export type TrainingsAndSessionsSubTabId =
  | 'courses'
  | 'group-trainings'
  | 'drills'
  | 'calendar'
  | 'tests'
  | 'assignments'
  | 'materials'

// KAN-504 — Dialogue Evaluation view modes (live as a single ?view= state,
// per plan §3.9 — these are view filters, not real sub-tabs).
export type DialogueEvaluationViewMode =
  | 'scorecard'
  | 'calendar'
  | 'drafts'
  | 'average-score'
  | 'coach-notes'
  | 'closed'

// Tasks top-tab time-bucket chips (Figma source: All / Today / Tomorrow /
// Week). Drives the chip row above the Kanban board.
export type TasksSubTabId = 'all' | 'today' | 'tomorrow' | 'this_week'

export const TRAINING_TOP_TABS: TrainingTopTabId[] = [
  'inbox',
  'team',
  'action-analysis',
  'dialogue-evaluation',
  'trainings-and-sessions',
  'tasks',
]

export const ACTION_ANALYSIS_SUB_TABS: ActionAnalysisSubTabId[] = [
  'interactions',
  'weekly-tasks',
  'promises-and-callbacks',
  'successful-closures',
  'leaks',
  'third-parties',
  'heatmap',
  'time-at-work',
  'script-analytics',
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

export const TRAINING_INBOX_VIEW_MODES: TrainingInboxViewMode[] = ['inbox', 'kanban', 'grid']

export const TRAININGS_AND_SESSIONS_SUB_TABS: TrainingsAndSessionsSubTabId[] = [
  'courses',
  'group-trainings',
  'drills',
  'calendar',
  'tests',
  'assignments',
  'materials',
]

export const DIALOGUE_EVALUATION_VIEW_MODES: DialogueEvaluationViewMode[] = [
  'scorecard',
  'calendar',
  'drafts',
  'average-score',
  'coach-notes',
  'closed',
]

export const TASKS_SUB_TABS: TasksSubTabId[] = ['all', 'today', 'tomorrow', 'this_week']

// Legacy 1-level tab id, retained for the URL-compat shim.
export type ActionAnalysisTabId = 'calls' | 'interactions'
export const ACTION_ANALYSIS_TABS: ActionAnalysisTabId[] = ['calls', 'interactions']
