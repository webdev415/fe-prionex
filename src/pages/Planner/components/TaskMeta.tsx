/**
 * Assignee names of a task, as a line of text (planner story 1.10; the task
 * panel). Cards and rows show avatars instead (`PersonAvatar`, story 5.1); the
 * due and SLA pills live in `TaskPills`.
 */
import { useTranslation } from 'react-i18next'
import { piiProps } from '@/lib/openreplay/pii'
import type { PlannerTaskCard } from '@/api/planner/plannerApi'
import { personName } from '../plannerFormat'

type Person = PlannerTaskCard['assignees'][number]

export function AssigneeNames({ people }: { people: Person[] }) {
  const { t } = useTranslation('planner')
  // Both branches are masked for session recording: the names are personal
  // data, and the empty branch shares the element so markup never depends on
  // which branch rendered.
  if (people.length === 0) {
    return (
      <span className="text-muted-foreground text-xs" {...piiProps}>
        {t('task.noAssignees')}
      </span>
    )
  }
  return (
    <span className="text-foreground text-xs" {...piiProps}>
      {people
        .map((person) =>
          person.inactive ? `${personName(person)} (${t('task.inactive')})` : personName(person)
        )
        .join(', ')}
    </span>
  )
}
