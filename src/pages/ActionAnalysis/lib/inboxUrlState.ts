import type { CallMonitoringPeriod } from '@/features/actionAnalysis'
import { ACTION_ANALYSIS_INBOX_VIEW_MODES, type ActionAnalysisInboxViewMode } from '../types'

const DEFAULT_VIEW_MODE: ActionAnalysisInboxViewMode = 'inbox'
const DEFAULT_PERIOD: CallMonitoringPeriod = 'last_7d'

const INBOX_PERIODS: readonly CallMonitoringPeriod[] = [
  'today',
  'yesterday',
  'last_7d',
  'last_30d',
  'custom',
]

const KANBAN_STATES = ['wait', 'in_progress', 'awaiting_training', 'scheduled', 'closed'] as const

export type InboxKanbanState = (typeof KANBAN_STATES)[number]

/** URL-shareable state for the Inbox tab.
 *
 * `view` is the 3-way mode toggle. Kanban / Grid are accepted on read even
 * before the components ship (steps 7/8) so URLs from early QA round-trip.
 *
 * `operatorId` drives the right-side detail panel. Cleared when the user
 * clicks away from the focused row.
 *
 * `states` is the Kanban-column filter, multi-select. Empty array = no filter.
 */
export interface InboxBarState {
  view: ActionAnalysisInboxViewMode
  period: CallMonitoringPeriod
  customFromDate?: string
  customToDate?: string
  operatorId?: number
  states: InboxKanbanState[]
}

export function readInboxState(params: URLSearchParams): InboxBarState {
  const rawView = params.get('view')
  const view: ActionAnalysisInboxViewMode = (ACTION_ANALYSIS_INBOX_VIEW_MODES as string[]).includes(
    rawView ?? ''
  )
    ? (rawView as ActionAnalysisInboxViewMode)
    : DEFAULT_VIEW_MODE

  const rawPeriod = params.get('period')
  const period: CallMonitoringPeriod = (INBOX_PERIODS as string[]).includes(rawPeriod ?? '')
    ? (rawPeriod as CallMonitoringPeriod)
    : DEFAULT_PERIOD

  const customFromDate = params.get('from') || undefined
  const customToDate = params.get('to') || undefined

  const rawOperator = params.get('operator_id')
  const parsedOperator = rawOperator ? Number.parseInt(rawOperator, 10) : NaN
  const operatorId =
    Number.isFinite(parsedOperator) && parsedOperator > 0 ? parsedOperator : undefined

  const stateValues = params.getAll('state')
  const states = stateValues.filter((s): s is InboxKanbanState =>
    (KANBAN_STATES as readonly string[]).includes(s)
  )

  return {
    view,
    period,
    customFromDate,
    customToDate,
    operatorId,
    states,
  }
}

export function writeInboxState(
  current: URLSearchParams,
  patch: Partial<InboxBarState>
): URLSearchParams {
  const next = new URLSearchParams(current)
  const state = { ...readInboxState(current), ...patch }

  if (state.view === DEFAULT_VIEW_MODE) {
    next.delete('view')
  } else {
    next.set('view', state.view)
  }

  if (state.period === DEFAULT_PERIOD) {
    next.delete('period')
  } else {
    next.set('period', state.period)
  }

  if (state.period === 'custom' && state.customFromDate && state.customToDate) {
    next.set('from', state.customFromDate)
    next.set('to', state.customToDate)
  } else {
    next.delete('from')
    next.delete('to')
  }

  if (state.operatorId) {
    next.set('operator_id', String(state.operatorId))
  } else {
    next.delete('operator_id')
  }

  next.delete('state')
  for (const s of state.states) {
    next.append('state', s)
  }

  return next
}

export { KANBAN_STATES }
