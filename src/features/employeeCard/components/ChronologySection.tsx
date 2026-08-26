import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { useEmployeeEvents } from '../hooks/useEmployeeEvents'
import { chronologyLabel, groupByYear } from '../lib/chronologyLabels'
import type { EventCategory } from '../types'

type ChronologyFilter = 'all' | EventCategory

const FILTERS: ChronologyFilter[] = ['all', 'personnel', 'evaluation', 'training']

export interface ChronologySectionProps {
  userId: number
}

/**
 * The card's history, one page at a time.
 *
 * Rows are read from a single timeline the services write into, so the
 * ordering here is the server's and never has to be reconciled between
 * sources on the client.
 */
export function ChronologySection({ userId }: ChronologySectionProps) {
  const { t, i18n } = useTranslation()
  const [filter, setFilter] = useState<ChronologyFilter>('all')

  const query = useMemo(
    () => (filter === 'all' ? {} : { category: filter as EventCategory }),
    [filter]
  )
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useEmployeeEvents(userId, query)

  const events = useMemo(() => data?.pages.flatMap((page) => page.events) ?? [], [data])
  const years = useMemo(() => groupByYear(events), [events])

  const day = (value: string) =>
    new Date(value).toLocaleDateString(i18n.language, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })

  return (
    <section aria-labelledby="chronology-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="chronology-heading" className="text-foreground text-lg font-semibold">
          {t('pages.employeeCard.chronology.title')}
        </h2>
        <div className="max-w-full overflow-x-auto">
          <SegmentedTabs
            items={FILTERS.map((id) => ({
              id,
              label: t(`pages.employeeCard.chronology.filters.${id}`),
            }))}
            value={filter}
            onChange={setFilter}
            activation="manual"
            ariaLabel={t('pages.employeeCard.chronology.filterLabel')}
          />
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground">{t('common.loading')}</p>}

      {isError && (
        <p role="alert" className="text-destructive">
          {t('pages.employeeCard.chronology.failed')}
        </p>
      )}

      {!isLoading && !isError && events.length === 0 && (
        <p className="text-muted-foreground">{t('pages.employeeCard.chronology.empty')}</p>
      )}

      {years.map((group) => (
        <div key={group.year} className="space-y-2">
          <h3 className="text-muted-foreground text-sm font-medium">{group.year}</h3>
          <ol className="space-y-2">
            {group.events.map((event) => (
              <li
                key={event.id}
                className="border-border bg-muted/40 flex flex-wrap items-baseline gap-3 rounded-lg border px-4 py-3"
              >
                <span className="text-muted-foreground text-sm tabular-nums">
                  {day(event.occurred_at)}
                </span>
                <span className="text-foreground">{chronologyLabel(event, t)}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}

      {hasNextPage && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {t('pages.employeeCard.chronology.loadMore')}
        </Button>
      )}
    </section>
  )
}
