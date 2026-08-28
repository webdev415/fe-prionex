import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button, buttonVariants } from '@/components/ui/Button'
import type { CardNeighbours } from '@/features/employeeCard/types.card'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

export interface CardNavigationProps {
  listQuery: string
  neighbours?: CardNeighbours
}

/**
 * The way back to the list, carrying whatever it was filtered by.
 *
 * Separate from the pagination beside it because they sit in different
 * columns: this one belongs over the profile panel, and walking the list
 * belongs over the sections being walked.
 */
export function BackToList({ listQuery }: { listQuery: string }) {
  const { t } = useTranslation()

  return (
    <Link
      to={`/dashboard/team-management/users${listQuery ? `?${listQuery}` : ''}`}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
    >
      <Icons.ArrowLeft size={16} strokeWidth={1.8} />
      {t('pages.employeeCard.backToList')}
    </Link>
  )
}

/**
 * The two employees either side of this one, and where this one sits.
 *
 * Both moves carry the list's query with them, so walking the list from a
 * card keeps whatever was filtered rather than dropping back to everybody.
 *
 * The position is a snapshot the server recomputes each move: somebody
 * deactivated while the card is open shifts every index after them, and a
 * frozen number would go quietly wrong instead.
 *
 * Outlined rather than filled: ``secondary`` paints near-black on a dark
 * theme, so the one that could be clicked read as plain text while the
 * disabled one - painted in muted grey - was the only one that looked like a
 * button at all, exactly backwards.
 *
 * The link takes ``buttonVariants`` directly rather than going through
 * ``Button asChild``. Button always wraps its children in a fragment, so the
 * single child Radix's Slot finds is that fragment rather than the link, and a
 * fragment silently drops the className it is cloned with - the link comes out
 * with no styling at all. Not something to fix from here: Button is shared.
 */
export function CardNavigation({ listQuery, neighbours }: CardNavigationProps) {
  const { t } = useTranslation()
  const suffix = listQuery ? `?${listQuery}` : ''

  const step = (userId: number | null | undefined, label: string, icon: 'left' | 'right') => {
    const arrow =
      icon === 'left' ? (
        <Icons.ArrowLeft size={16} strokeWidth={1.8} />
      ) : (
        <Icons.ArrowRight size={16} strokeWidth={1.8} />
      )

    const inner = (
      <>
        {icon === 'left' && arrow}
        {label}
        {icon === 'right' && arrow}
      </>
    )

    const shape = cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-2 rounded-full px-4')

    return userId ? (
      <Link to={`/dashboard/team-management/users/${userId}${suffix}`} className={shape}>
        {inner}
      </Link>
    ) : (
      <Button variant="outline" size="sm" disabled className="gap-2 rounded-full px-4">
        {inner}
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {step(neighbours?.previous_user_id, t('pages.employeeCard.previousEmployee'), 'left')}

      {neighbours?.position ? (
        // The wording is the translation's, not a format built here: Ukrainian
        // does not put the two numbers together the way English does.
        <span className="bg-muted/60 text-muted-foreground rounded-full px-3 py-1 text-xs font-medium tabular-nums">
          {t('pages.employeeCard.position', {
            position: neighbours.position,
            total: neighbours.total,
          })}
        </span>
      ) : null}

      {step(neighbours?.next_user_id, t('pages.employeeCard.nextEmployee'), 'right')}
    </div>
  )
}
