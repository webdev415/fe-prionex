import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import type { CardNeighbours } from '@/features/employeeCard/types.card'

export interface CardNavigationProps {
  listQuery: string
  neighbours?: CardNeighbours
}

/**
 * Back to the list, and the two employees either side of this one.
 *
 * Both moves carry the list's query with them, so walking the list from a
 * card keeps whatever was filtered rather than dropping back to everybody.
 *
 * The position is a snapshot the server recomputes each move: somebody
 * deactivated while the card is open shifts every index after them, and a
 * frozen number would go quietly wrong instead.
 */
export function CardNavigation({ listQuery, neighbours }: CardNavigationProps) {
  const { t } = useTranslation()
  const suffix = listQuery ? `?${listQuery}` : ''

  const step = (userId: number | null | undefined, label: string) =>
    userId ? (
      <Button asChild variant="secondary" size="sm">
        <Link to={`/dashboard/team-management/users/${userId}${suffix}`}>{label}</Link>
      </Button>
    ) : (
      <Button variant="secondary" size="sm" disabled>
        {label}
      </Button>
    )

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link
        to={`/dashboard/team-management/users${suffix}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
      >
        {t('pages.employeeCard.backToList')}
      </Link>

      <div className="flex items-center gap-3">
        {step(neighbours?.previous_user_id, t('pages.employeeCard.previousEmployee'))}

        {neighbours?.position ? (
          <span className="text-muted-foreground text-sm tabular-nums">
            {t('pages.employeeCard.position', {
              position: neighbours.position,
              total: neighbours.total,
            })}
          </span>
        ) : null}

        {step(neighbours?.next_user_id, t('pages.employeeCard.nextEmployee'))}
      </div>
    </div>
  )
}
