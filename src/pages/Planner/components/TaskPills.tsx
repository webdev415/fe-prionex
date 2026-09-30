/**
 * Due and SLA pills of a task (planner story 5.1, AC1; UX-DR8, DESIGN.md
 * «Пилюля срока / SLA»). The server has already decided the state —
 * `due_state`, `sla_state`, the SLA moment and the remaining working time; the
 * pill only draws it: an icon, a word and the role colour of `plannerTones`,
 * never colour alone. The SLA tooltip explains the calculation («SLA 48 год за
 * типом «Разова», календарний час, залишилось 5 год») on hover and on keyboard
 * focus, so such a pill is a tab stop. A pill whose tooltip would only repeat
 * its own text (every due pill) has no tooltip and takes no tab stop.
 *
 * A card carries no `sla_remaining_seconds` (only the task does): there the
 * running pill shows the SLA moment instead. The client never subtracts dates
 * to get a remainder — a weekday norm does not count nights and weekends.
 *
 * A moment (a due time, the SLA deadline, the breach) is said on the board's
 * clock or not at all — never in the browser's zone: while the board loads,
 * and when it cannot be read, the pill keeps its word and waits for the time.
 */
import { useTranslation } from 'react-i18next'
import type { IconType } from 'react-icons'
import { MdErrorOutline, MdEvent, MdPauseCircleOutline, MdSchedule, MdTimer } from 'react-icons/md'
import { formatDateTime, formatNumber } from '@/lib/localeFormat'
import { cn } from '@/lib/utils'
import { usePlannerBoard } from '@/api/planner/plannerQueries'
import type { PlannerSlaState, PlannerTask, PlannerTaskCard } from '@/api/planner/plannerApi'
import { formatDueDate, formatPlannerDuration, usableTimeZone } from '../plannerFormat'
import { toneClass, type PlannerTone } from '../plannerTones'
import { PlannerTooltip } from './PlannerTooltip'
import { useCardTabIndex } from './cardFocus'

interface PillProps {
  tone: PlannerTone
  icon: IconType
  /** The state in words; `srOnly` when the value alone reads well (a plain due date). */
  word: string
  srOnly?: boolean
  value?: string
  /** What the pill does not say itself; none — no tooltip and no tab stop. */
  hint?: string
  className?: string
}

const PILL_CLASS =
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums'

function Pill({ tone, icon: Icon, word, srOnly, value, hint, className }: PillProps) {
  // Inside a kanban card: reached with ← →, not with Tab (story 5.3).
  const cardTabIndex = useCardTabIndex()
  const face = (
    <>
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className={srOnly ? 'sr-only' : undefined}>{word}</span>
      {value && !srOnly && <span aria-hidden="true">·</span>}
      {value && <span>{value}</span>}
    </>
  )
  if (!hint) return <span className={cn(PILL_CLASS, toneClass(tone), className)}>{face}</span>
  return (
    <PlannerTooltip label={hint} contentClassName="max-w-xs">
      <span
        // The explanation must open on keyboard focus as on hover (WCAG
        // 1.4.13), so the pill takes a tab stop; it has no action. Inside a
        // kanban card it is reached with ← → instead of Tab (5.3).
        tabIndex={cardTabIndex ?? 0}
        className={cn(
          PILL_CLASS,
          'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
          toneClass(tone),
          className
        )}
      >
        {face}
      </span>
    </PlannerTooltip>
  )
}

type DueFields = Pick<PlannerTaskCard, 'due_date' | 'due_at' | 'due_state'> & {
  board?: Pick<PlannerTaskCard['board'], 'code'>
}

interface DuePillProps {
  task: DueFields
  /**
   * The board's IANA zone (`Board.tzid`). A due MOMENT is shown on the board's
   * clock, not the browser's. When the caller does not know it, the pill reads
   * it from the task's board (the cached `GET /boards/{code}` the status chip
   * uses); only a `due_at` needs it, a date has no time of day. Until the
   * zone is known the pill shows its word without the time.
   */
  timeZone?: string
  className?: string
}

export function DuePill({ task, timeZone, className }: DuePillProps) {
  const { t, i18n } = useTranslation('planner')
  const language = i18n.language ?? 'uk'
  const given = usableTimeZone(timeZone)
  const needsZone = !task.due_date && Boolean(task.due_at) && !given
  const board = usePlannerBoard(task.board?.code, needsZone, { poll: false })
  const zone = given ?? usableTimeZone(board.data?.tzid)
  if (task.due_state === 'none' || (!task.due_date && !task.due_at)) {
    return <span className={cn('text-muted-foreground text-xs', className)}>{t('task.noDue')}</span>
  }
  // A date has no time of day; a moment waits for the board's zone.
  const value = task.due_date
    ? formatDueDate(task.due_date, language)
    : task.due_at && zone
      ? formatDateTime(task.due_at, language, zone)
      : undefined
  if (task.due_state === 'overdue') {
    return (
      <Pill
        tone="overdue"
        icon={MdErrorOutline}
        word={t('task.dueState.overdue')}
        value={value}
        className={className}
      />
    )
  }
  if (task.due_state === 'soon') {
    return (
      <Pill
        tone="soon"
        icon={MdSchedule}
        word={t('task.dueState.soon')}
        value={value}
        className={className}
      />
    )
  }
  return (
    <Pill
      tone="normal"
      icon={MdEvent}
      word={t('task.due')}
      srOnly={Boolean(value)}
      value={value}
      className={className}
    />
  )
}

type SlaFields = Pick<PlannerTaskCard, 'sla_state' | 'sla_deadline_at' | 'type' | 'board'> &
  Partial<Pick<PlannerTask, 'sla_remaining_seconds' | 'sla_breached_at'>>

/** The states this build draws; the board is read only for them. */
const SLA_STATES: ReadonlySet<PlannerSlaState> = new Set(['running', 'soon', 'paused', 'breached'])

/**
 * Nothing for `off` (no norm, closed task, a status that stops the clock), for
 * a state this build does not know, and for a card of a planner older than
 * 0.23.0 (no `sla_state` at all) — and then the board is not read either.
 */
export function SlaPill({ task, className }: { task: SlaFields; className?: string }) {
  const { t, i18n } = useTranslation('planner')
  const language = i18n.language ?? 'uk'
  const shown = SLA_STATES.has(task.sla_state)
  const board = usePlannerBoard(task.board.code, shown, { poll: false })
  if (!shown) return null

  const config = board.data
  const zone = usableTimeZone(config?.tzid)
  const at = (iso: string | null | undefined) =>
    iso && zone ? formatDateTime(iso, language, zone) : undefined

  // The norm of the task's type explains the number: «SLA 48 год за типом «Разова», календарний час».
  // It is the type's norm as the board is configured now: the contract gives a
  // task no copy of its own norm, and a norm edit applies to new tasks only.
  const norm = config?.config.task_types.find((type) => type.id === task.type?.id)?.sla
  // The remainder speaks the norm's unit, on the pill and in the hint alike.
  // Until the board answers it waits, so «2 дн» never turns into «50 год» in
  // front of the reader; a board that cannot be read brings no norm, and the
  // remainder keeps the plain scale.
  const remaining =
    typeof task.sla_remaining_seconds === 'number' && (config || board.isError)
      ? formatPlannerDuration(task.sla_remaining_seconds, t, language, norm?.unit)
      : undefined
  const left = remaining && t('pill.slaLeft', { value: remaining })
  const deadline = at(task.sla_deadline_at)
  const until = deadline && t('pill.slaUntil', { value: deadline })
  const explained =
    norm && task.type
      ? [
          t('pill.slaNorm', {
            norm: t(norm.unit === 'hours' ? 'duration.hours' : 'duration.days', {
              value: formatNumber(norm.value, language),
            }),
            type: task.type.name,
          }),
          t(norm.calendar === 'weekdays' ? 'pill.slaWeekdays' : 'pill.slaCalendar'),
        ]
      : []
  // Nothing to explain beyond the pill's own text — no tooltip.
  const hint = (...parts: (string | false | undefined)[]) =>
    [...explained, ...parts].filter(Boolean).join(', ') || undefined

  switch (task.sla_state) {
    case 'breached': {
      const breachedAt = at(task.sla_breached_at)
      return (
        <Pill
          tone="overdue"
          icon={MdErrorOutline}
          word={t('pill.slaBreached')}
          hint={hint(breachedAt && t('pill.slaBreachedAt', { value: breachedAt }))}
          className={className}
        />
      )
    }
    case 'paused':
      return (
        <Pill
          tone="paused"
          icon={MdPauseCircleOutline}
          word={t('pill.slaPaused')}
          value={remaining}
          hint={hint(t('pill.slaPausedHint'), left)}
          className={className}
        />
      )
    case 'soon':
      return (
        <Pill
          tone="soon"
          icon={MdSchedule}
          word={t('pill.slaSoon')}
          value={remaining ?? until}
          hint={hint(left, until)}
          className={className}
        />
      )
    case 'running':
      return (
        <Pill
          tone="normal"
          icon={MdTimer}
          word={t('pill.sla')}
          value={remaining ?? until}
          hint={hint(left, until)}
          className={className}
        />
      )
    default:
      return null
  }
}
