import type { OperatorPresenceStatus, ScoreBand } from '../../mocks/trainerWorkplaceMocks'

export const TEAM_SCORE_TEXT: Record<ScoreBand, string> = {
  green: '#22C55E',
  amber: '#A16207',
  red: '#EF4444',
}

export const TEAM_SCORE_RING: Record<ScoreBand, string> = {
  green: '#22C55E',
  amber: '#CA8A04',
  red: '#EF4444',
}

export const PRESENCE_TEXT: Record<OperatorPresenceStatus, string> = {
  online: '#15803D',
  offline: '#6B7280',
  busy: '#A16207',
  on_call: '#2563EB',
}

export const PRESENCE_DOT: Record<OperatorPresenceStatus, string> = {
  online: '#22C55E',
  offline: '#A1A1A1',
  busy: '#EAB308',
  on_call: '#3B82F6',
}

export function operatorPresence(operator: {
  presenceStatus?: OperatorPresenceStatus
  online: boolean
}): OperatorPresenceStatus {
  if (operator.presenceStatus) return operator.presenceStatus
  return operator.online ? 'online' : 'offline'
}
