import type { OperatorUser } from '@/features/users/api/usersApi'
import type { AssignmentState, QueueOperator, ScoreBand } from '@/features/quality/coaching/types'
import type {
  InboxAssignmentState,
  InboxPriority,
  InboxCardRow,
  MockInboxTrigger,
  MockInboxTriggerTag,
} from '../mocks/trainerWorkplaceMocks'

/**
 * Derive a Figma-faithful UI row from a `QueueOperator` returned by
 * `GET /api/v1/quality/coaching/queue`.
 *
 * Many of the rich fields on `InboxCardRow` (avatar colour, daily-plan
 * progress, online duration, segment, extension, etc.) are not yet returned
 * by the BE — they come from the per-operator detail endpoint and the
 * project context. Until those land we derive what we can from the queue
 * payload + cached operator list, and fall back to neutral placeholders for
 * everything else so the cards still render the way the Figma frames show.
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

/** Same band → priority mapping the priority chip strip filters against. */
function priorityFor(scoreBand: ScoreBand): InboxPriority {
  if (scoreBand === 'red') return 'critical'
  if (scoreBand === 'amber') return 'average'
  return 'low'
}

/**
 * Online detection — operator counts as online if quality activity is
 * within the last 5 minutes. The dot is purely indicative; the source of
 * truth for presence is analytics-service's tracking_events stream.
 */
function isOnline(isoTimestamp: string | null | undefined): boolean {
  if (!isoTimestamp) return false
  const then = new Date(isoTimestamp).getTime()
  if (Number.isNaN(then)) return false
  return Date.now() - then < 5 * 60_000
}

function formatRelative(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return '—'
  const then = new Date(isoTimestamp).getTime()
  if (Number.isNaN(then)) return '—'
  const diffMs = Date.now() - then
  if (diffMs < 0) return 'now'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function formatClock(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return ''
  const d = new Date(isoTimestamp)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/**
 * Trigger-tone heuristic. Trigger codes carry semantic weight on the BE
 * (red/amber depending on the underlying rule), but they're returned as
 * opaque strings. We pattern-match the well-known buckets and default to
 * `amber` so cards stay informative.
 */
function triggerTone(trigger: string): MockInboxTriggerTag['tone'] {
  const t = trigger.toLowerCase()
  if (
    t.includes('conflict') ||
    t.includes('escalation') ||
    t.includes('refusal') ||
    t.includes('critical') ||
    t.includes('overdue')
  ) {
    return 'red'
  }
  if (t.includes('positive') || t.includes('promise') || t.includes('paid')) return 'teal'
  return 'amber'
}

function humanizeTrigger(trigger: string): string {
  return trigger
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

function toInboxAssignmentState(state: AssignmentState | undefined): InboxAssignmentState {
  // Both type aliases share the same five values; `wait` is the entry state
  // the BE auto-creates for operators below the threshold.
  return (state ?? 'wait') as InboxAssignmentState
}

function buildTriggerSummaries(row: QueueOperator): {
  triggers: MockInboxTrigger[]
  triggerTags: MockInboxTriggerTag[]
} {
  const triggers: MockInboxTrigger[] = row.triggers.map((code, idx) => ({
    id: idx + 1,
    code,
    label: humanizeTrigger(code),
    severity:
      triggerTone(code) === 'red' ? 'critical' : triggerTone(code) === 'amber' ? 'warn' : 'info',
    detectedAtLabel: formatRelative(row.last_active_at),
  }))
  const triggerTags: MockInboxTriggerTag[] = row.triggers
    .slice(0, 4)
    .map((code) => ({ label: humanizeTrigger(code), tone: triggerTone(code) }))
  return { triggers, triggerTags }
}

/** Pick a one-line summary suitable for the Inbox-view card. */
function summaryFor(row: QueueOperator): string {
  if (row.triggers.length > 0) {
    return `${humanizeTrigger(row.triggers[0])} · score ${row.composite_score}`
  }
  return `Composite score ${row.composite_score}`
}

function parseHireDate(iso: string | null | undefined): { year: string; date: string } {
  if (!iso) return { year: '', date: '' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { year: '', date: '' }
  return { year: String(d.getFullYear()), date: d.toLocaleDateString() }
}

export function deriveInboxRow(row: QueueOperator, operators: OperatorUser[]): InboxCardRow {
  const operator = operators.find((o) => o.id === row.operator_id)
  const name = operator?.full_name ?? `#${row.operator_id}`
  const departmentName = operator?.department_name ?? '—'
  const extension = operator?.asterisk_extension ?? ''
  const hire = parseHireDate(operator?.hired_at)
  const { triggers, triggerTags } = buildTriggerSummaries(row)
  const online = isOnline(row.last_active_at)
  const lastActiveLabel = online ? 'Online' : `Offline · ${formatRelative(row.last_active_at)} ago`

  return {
    operatorId: row.operator_id,
    name,
    initials: initialsFor(name),
    avatarColor: avatarColorFor(row.operator_id),
    team: departmentName,
    department: departmentName,
    // `segment` was a hardcoded "Hard collection / Standard" string in the
    // mock; the real value is the operator's department name.
    segment: departmentName,
    extension,
    online,
    lastActiveLabel,
    state: toInboxAssignmentState(row.assignment?.state),
    priority: priorityFor(row.score_band ?? 'amber'),
    compositeScore: row.composite_score ?? 0,
    scoreBand: row.score_band ?? 'amber',
    hasScore: row.composite_score !== null && row.composite_score !== undefined,
    scoreDeltaPct: 0,
    triggers,
    triggerTags,
    flagged: row.triggers.length > 0,
    queueEnteredLabel: row.assignment ? formatRelative(row.assignment.updated_at) : '—',
    dailyPlanPct: 0,
    dailyPlanDone: 0,
    dailyPlanTotal: 0,
    onlineDuration: online ? '—' : '0m',
    onlineSince: row.last_active_at ? formatClock(row.last_active_at) : '',
    experienceYear: hire.year,
    experienceDate: hire.date,
    activityMinutes: 0,
    listStatusDot: row.score_band ?? 'amber',
    cardTimestamp: formatRelative(row.last_active_at),
    cardSummary: summaryFor(row),
  }
}

export function deriveInboxRows(rows: QueueOperator[], operators: OperatorUser[]): InboxCardRow[] {
  return rows.map((r) => deriveInboxRow(r, operators))
}
