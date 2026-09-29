/**
 * Avatar of a planner person (planner story 5.1, AC2; DESIGN.md «Аватар
 * исполнителя», UX-DR10).
 *
 * Initials on a disc. An inactive employee (`inactive` — gone from the org
 * mirror or not active) is grey and struck through; somebody who has never
 * opened the planner (`never_logged_in`) is an empty ring. Both states are in
 * the tooltip AND in the accessible name, never in the look alone.
 *
 * The name is personal data and OpenReplay does not mask attributes, so it is
 * never an `aria-label` or `title`: the accessible name is a visually hidden
 * text node and the tooltip is a `PiiTooltip`, both masked. The initials are
 * letters of the name and are masked too. The avatar has no action of its own —
 * a click goes to whatever holds it (the card, the row).
 */
import { useTranslation } from 'react-i18next'
import { PiiTooltip } from '@/components/ui/PiiTooltip'
import { monogramInitials } from '@/lib/avatarMonogram'
import { piiProps } from '@/lib/openreplay/pii'
import { cn } from '@/lib/utils'
import type { PlannerPerson, PlannerTaskPerson } from '@/api/planner/plannerApi'
import { personName } from '../plannerFormat'

export type AvatarPerson = Pick<PlannerTaskPerson, 'user_id' | 'crm_user_id' | 'full_name'> & {
  inactive?: boolean
  never_logged_in?: boolean
  departments?: PlannerPerson['departments']
}

/** «Олена Коваль · Склад · неактивний» — tooltip and accessible name alike. */
function useAvatarLabel(person: AvatarPerson): string {
  const { t } = useTranslation('planner')
  const state = person.inactive
    ? t('task.inactive')
    : person.never_logged_in
      ? t('task.neverLoggedIn')
      : undefined
  return [personName(person), person.departments?.[0]?.name, state].filter(Boolean).join(' · ')
}

interface PersonAvatarProps {
  person: AvatarPerson
  /**
   * The name and the state are already text next to the avatar (a line of the
   * people picker): no second accessible name and no tooltip repeating them.
   */
  decorative?: boolean
}

export function PersonAvatar({ person, decorative = false }: PersonAvatarProps) {
  const label = useAvatarLabel(person)
  const initials = monogramInitials(null, null, person.full_name) || '?'
  const disc = (
    <span
      aria-hidden={decorative || undefined}
      className={cn(
        'relative inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border text-[10px] leading-none font-semibold',
        person.inactive
          ? 'border-border bg-muted text-muted-foreground'
          : person.never_logged_in
            ? 'border-muted-foreground text-muted-foreground bg-transparent'
            : 'border-border bg-muted text-foreground'
      )}
    >
      <span aria-hidden="true" {...piiProps}>
        {initials}
      </span>
      {person.inactive && (
        <span
          aria-hidden="true"
          className="bg-muted-foreground absolute top-1/2 left-0 h-px w-full -rotate-45"
        />
      )}
      {!decorative && (
        <span className="sr-only" {...piiProps}>
          {label}
        </span>
      )}
    </span>
  )
  return decorative ? disc : <PiiTooltip label={label}>{disc}</PiiTooltip>
}

const STACK_SIZE = 3

/**
 * Up to three avatars and «+N» (UX-DR7). No people — «Без виконавця», masked
 * like the names so the markup does not depend on the branch.
 */
export function AvatarStack({ people }: { people: AvatarPerson[] }) {
  const { t } = useTranslation('planner')
  if (people.length === 0) {
    return (
      <span className="text-muted-foreground text-xs" {...piiProps}>
        {t('task.noAssignees')}
      </span>
    )
  }
  const rest = people.length - STACK_SIZE
  return (
    <span className="inline-flex items-center -space-x-1.5">
      {people.slice(0, STACK_SIZE).map((person) => (
        <PersonAvatar key={person.user_id} person={person} />
      ))}
      {rest > 0 && (
        <span className="border-border bg-card text-foreground inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1 text-[10px] font-semibold tabular-nums">
          <span aria-hidden="true">{t('avatar.more', { value: rest })}</span>
          <span className="sr-only">{t('avatar.moreLabel', { value: rest })}</span>
        </span>
      )}
    </span>
  )
}

export default PersonAvatar
