import type {
  TeamRosterDepartment,
  TeamRosterOperator,
  TeamRosterResponse,
  TeamRosterTeam,
} from '@/features/quality/coaching/types'
import type {
  TeamDepartmentRow,
  TeamOperatorRow,
  TeamGroupRow,
  OperatorWorkStatus,
  ScoreBand,
} from '../mocks/trainerWorkplaceMocks'

/**
 * Map the BE `TeamRosterResponse` shape to the FE `TeamDepartmentRow[]` shape
 * the existing Figma-faithful card components (`DepartmentCard`,
 * `TeamCard`, `OperatorRow`) consume. The card JSX stays unchanged — only
 * the data source switches.
 *
 * Field gaps the BE doesn't yet surface render as neutral placeholders so
 * cards don't lie:
 *   * `Department.managerName` / `managerInitials` — `—`. Auth-service
 *     `departments` has no manager column yet (KAN-412 will add it).
 *   * `Operator.extension` — `''`. Not part of the roster payload.
 *   * `Operator.dailyPlanPct` — `0`. Task-service per-operator quota
 *     endpoint lands with KAN-411 (revised).
 */

const AVATAR_PALETTE = [
  '#FBCFE8',
  '#FED7AA',
  '#FEF3C7',
  '#D9F99D',
  '#A7F3D0',
  '#BAE6FD',
  '#C7D2FE',
  '#DDD6FE',
  '#FBB6CE',
  '#FBCFE8',
] as const

/** Stable colour pick — same operator always gets the same avatar tint. */
function avatarColorFor(operatorId: number): string {
  const idx = Math.abs(operatorId) % AVATAR_PALETTE.length
  return AVATAR_PALETTE[idx]
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function formatLastActive(isoTimestamp: string | null, online: boolean): string {
  if (online) return 'Online'
  if (!isoTimestamp) return 'Offline'
  const then = new Date(isoTimestamp).getTime()
  if (Number.isNaN(then)) return 'Offline'
  const diffMs = Date.now() - then
  if (diffMs < 0) return 'Offline'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `Offline · ${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Offline · ${hours}h ago`
  const days = Math.floor(hours / 24)
  return `Offline · ${days}d ago`
}

/** Default a missing band off the score so the FE never receives null. */
function bandFor(score: number | null, band: ScoreBand | null): ScoreBand {
  if (band) return band
  if (score == null) return 'red'
  if (score >= 75) return 'green'
  if (score >= 50) return 'amber'
  return 'red'
}

/** Work-status pill (Figma legend: In norm / Behind / In queue).
 *  Derived from assignment state + score band — the BE doesn't model this
 *  concept directly, but the trainer needs the at-a-glance signal:
 *    in_queue  — operator has an active coaching queue assignment OR red band
 *    behind    — amber band
 *    in_norm   — green band or no signal
 */
function deriveWorkStatus(op: TeamRosterOperator): OperatorWorkStatus {
  if (op.assignment_state === 'wait' || op.score_band === 'red') return 'in_queue'
  if (op.score_band === 'amber') return 'behind'
  return 'in_norm'
}

function deriveOperator(
  op: TeamRosterOperator,
  teamName: string,
  departmentName: string
): TeamOperatorRow {
  const online = op.online
  const hasScore = op.composite_score !== null && op.composite_score !== undefined
  return {
    id: op.operator_id,
    name: op.full_name,
    initials: initialsFor(op.full_name),
    avatarColor: avatarColorFor(op.operator_id),
    team: teamName,
    department: departmentName,
    extension: op.asterisk_extension ?? '',
    online,
    score: op.composite_score ?? 0,
    scoreBand: bandFor(op.composite_score, op.score_band),
    hasScore,
    hiredAt: op.hired_at ?? null,
    lastActiveLabel: formatLastActive(op.last_active_at, online),
    presenceStatus: online ? 'online' : 'offline',
    dailyPlanPct: 0,
    workStatus: deriveWorkStatus(op),
  }
}

function deriveTeam(team: TeamRosterTeam, departmentName: string): TeamGroupRow {
  const operators = team.operators.map((op) => deriveOperator(op, team.name, departmentName))
  return {
    id: `group-${team.group_id}`,
    name: team.name,
    teamLeadName: team.team_lead_name ?? '—',
    memberCount: team.member_count,
    averageScore: team.average_score ?? 0,
    scoreBand: bandFor(team.average_score, team.score_band),
    queueCount: team.queue_count,
    operators,
  }
}

function deriveDepartment(dept: TeamRosterDepartment): TeamDepartmentRow {
  const teams = dept.teams.map((team) => deriveTeam(team, dept.name))
  const managerName = dept.manager_name ?? '—'
  const managerInitials = dept.manager_name ? initialsFor(dept.manager_name) : '—'
  return {
    id: `dept-${dept.department_id}`,
    name: dept.name,
    managerName,
    managerInitials,
    memberCount: dept.member_count,
    teamCount: teams.length,
    averageScore: dept.average_score ?? 0,
    scoreBand: bandFor(dept.average_score, dept.score_band),
    queueCount: dept.queue_count,
    teams,
  }
}

export function deriveTeamRoster(roster: TeamRosterResponse): TeamDepartmentRow[] {
  return roster.departments.map(deriveDepartment)
}

/** Department chip strip — `{id, label, count}` derived from the response. */
export function deriveDepartmentChips(
  roster: TeamRosterResponse
): { id: string; label: string; count: number; rawId: number | null }[] {
  return roster.departments.map((d) => ({
    id: `dept-${d.department_id}`,
    label: d.name.split('·')[0]?.trim() ?? d.name,
    count: d.teams.length,
    rawId: d.department_id,
  }))
}
