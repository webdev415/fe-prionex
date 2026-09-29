/**
 * Due and SLA pills of a task (planner story 5.1, AC1; UX-DR8, DESIGN.md
 * «Пилюля срока / SLA»). The server has already decided the state —
 * `due_state`, `sla_state`, the SLA moment and the remaining working time; the
 * pill only draws it: an icon, a word and the role colour of `plannerTones`,
 * never colour alone. The tooltip explains the calculation («SLA 48 год за
 * типом «Разова», календарний час, залишилось 5 год») on hover and on keyboard
 * focus, so every pill is a tab stop.
 *
 * A card carries no `sla_remaining_seconds` (only the task does): there the
 * running pill shows the SLA moment instead. The client never subtracts dates
 * to get a remainder — a weekday norm does not count nights and weekends.
 */
import { useTranslation } from 'react-i18next'
import type { IconType } from 'react-icons'
import { MdErrorOutline, MdEvent, MdPauseCircleOutline, MdSchedule, MdTimer } from 'react-icons/md'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'
import { formatDateTime, formatNumber } from '@/lib/localeFormat'
import { cn } from '@/lib/utils'
import { usePlannerBoard } from '@/api/planner/plannerQueries'
import type { PlannerTask, PlannerTaskCard } from '@/api/planner/plannerApi'
import { formatDueDate, formatPlannerDuration } from '../plannerFormat'
import { toneClass, type PlannerTone } from '../plannerTones'

interface PillProps {
  tone: PlannerTone
  icon: IconType
  /** The state in words; `srOnly` when the value alone reads well (a plain due date). */
  word: string
  srOnly?: boolean
  value?: string
  hint: string
  className?: string
}

function Pill({ tone, icon: Icon, word, srOnly, value, hint, className }: PillProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span
            // The explanation must open on keyboard focus as on hover (WCAG
            // 1.4.13), so the pill takes a tab stop; it has no action.
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            className={cn(
              'focus-visible:ring-ring inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums focus-visible:ring-2 focus-visible:outline-none',
              toneClass(tone),
              className
            )}
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span className={srOnly ? 'sr-only' : undefined}>{word}</span>
            {value && !srOnly && <span aria-hidden="true">·</span>}
            {value && <span>{value}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{hint}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
   * uses); only a `due_at` needs it, a date has no time of day.
   */
  timeZone?: string
  className?: string
}

export function DuePill({ task, timeZone, className }: DuePillProps) {
  const { t, i18n } = useTranslation('planner')
  const language = i18n.language ?? 'uk'
  const needsZone = !task.due_date && Boolean(task.due_at) && !timeZone
  const board = usePlannerBoard(task.board?.code, needsZone, { poll: false })
  const zone = timeZone ?? board.data?.tzid
  const value = task.due_date
    ? formatDueDate(task.due_date, language)
    : task.due_at
      ? formatDateTime(task.due_at, language, zone)
      : null
  if (!value || task.due_state === 'none') {
    return <span className={cn('text-muted-foreground text-xs', className)}>{t('task.noDue')}</span>
  }
  if (task.due_state === 'overdue') {
    return (
      <Pill
        tone="overdue"
        icon={MdErrorOutline}
        word={t('task.dueState.overdue')}
        value={value}
        hint={t('pill.dueOverdueHint', { value })}
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
        hint={t('pill.dueSoonHint', { value })}
        className={className}
      />
    )
  }
  return (
    <Pill
      tone="normal"
      icon={MdEvent}
      word={t('task.due')}
      srOnly
      value={value}
      hint={t('pill.dueHint', { value })}
      className={className}
    />
  )
}

type SlaFields = Pick<PlannerTaskCard, 'sla_state' | 'sla_deadline_at' | 'type' | 'board'> &
  Partial<Pick<PlannerTask, 'sla_remaining_seconds' | 'sla_breached_at'>>

/** Nothing for `off` (no norm, closed task, a status that stops the clock). */
export function SlaPill({ task, className }: { task: SlaFields; className?: string }) {
  const { t, i18n } = useTranslation('planner')
  const language = i18n.language ?? 'uk'
  const shown = task.sla_state !== 'off'
  const board = usePlannerBoard(task.board.code, shown, { poll: false })
  if (!shown) return null

  const zone = board.data?.tzid
  const at = (iso: string) => formatDateTime(iso, language, zone)

  // The norm of the task's type explains the number: «SLA 48 год за типом «Разова», календарний час».
  // It is the type's norm as the board is configured now: the contract gives a
  // task no copy of its own norm, and a norm edit applies to new tasks only.
  const norm = board.data?.config.task_types.find((type) => type.id === task.type?.id)?.sla
  // The remainder speaks the norm's unit, on the pill and in the hint alike.
  const remaining =
    typeof task.sla_remaining_seconds === 'number'
      ? formatPlannerDuration(task.sla_remaining_seconds, t, language, norm?.unit)
      : undefined
  const left = remaining && t('pill.slaLeft', { value: remaining })
  const until = task.sla_deadline_at
    ? t('pill.slaUntil', { value: at(task.sla_deadline_at) })
    : undefined
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
  const hint = (...parts: (string | undefined)[]) =>
    [...explained, ...parts].filter(Boolean).join(', ')

  switch (task.sla_state) {
    case 'breached':
      return (
        <Pill
          tone="overdue"
          icon={MdErrorOutline}
          word={t('pill.slaBreached')}
          hint={hint(
            task.sla_breached_at
              ? t('pill.slaBreachedAt', { value: at(task.sla_breached_at) })
              : t('pill.slaBreached')
          )}
          className={className}
        />
      )
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
      // A state this build does not know yet: say nothing rather than guess.
      return null
  }
}
