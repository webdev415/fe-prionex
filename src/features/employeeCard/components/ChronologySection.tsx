import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { DateSelect } from '@/components/ui/DateSelect'
import '@/components/ui/DateSelect.theme.css'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { cn } from '@/lib/utils'
import { useEmployeeEvents } from '../hooks/useEmployeeEvents'
import { formatPickerDateAsYMD, parsePickerYMD } from '@/lib/dateUtils'
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
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  /*
   * Which years are folded away, rather than which are open: a year the
   * reader has not touched should be open, and remembering the closed ones
   * means a year arriving from a later page opens with the rest.
   */
  const [periodOpen, setPeriodOpen] = useState(false)
  const periodRef = useRef<HTMLDivElement>(null)

  /*
   * The picker's own calendar renders inside this panel rather than in a
   * portal, so a click on a day counts as inside and the panel survives it.
   * Closing on any outside click would otherwise shut the panel the moment
   * somebody picked a date.
   */
  useEffect(() => {
    if (!periodOpen) return

    const onPointerDown = (fired: PointerEvent) => {
      if (!periodRef.current?.contains(fired.target as Node)) setPeriodOpen(false)
    }
    const onEscape = (fired: KeyboardEvent) => {
      if (fired.key === 'Escape') setPeriodOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onEscape)
    }
  }, [periodOpen])

  const [collapsed, setCollapsed] = useState<string[]>([])
  const toggleYear = (year: string) =>
    setCollapsed((years) =>
      years.includes(year) ? years.filter((one) => one !== year) : [...years, year]
    )

  /*
   * The bounds go to the server rather than filtering what has already been
   * fetched: the history is paged, so trimming it here would narrow one page
   * and leave the rest of the period unread behind a "show earlier" button.
   *
   * The end of the day, not its start. A reader picking today means events
   * that happened today, and midnight would exclude every one of them.
   */
  const query = useMemo(
    () => ({
      ...(filter === 'all' ? {} : { category: filter as EventCategory }),
      ...(from ? { occurred_from: `${from}T00:00:00` } : {}),
      ...(to ? { occurred_to: `${to}T23:59:59` } : {}),
    }),
    [filter, from, to]
  )
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useEmployeeEvents(userId, query)

  const events = useMemo(() => data?.pages.flatMap((page) => page.events) ?? [], [data])
  const years = useMemo(() => groupByYear(events), [events])

  /** What the closed control says once a period has been chosen. */
  const period = useMemo(() => {
    const show = (value: string) => parsePickerYMD(value)?.toLocaleDateString(i18n.language) ?? ''
    if (from && to) return `${show(from)} — ${show(to)}`
    if (from) return `${t('pages.employeeCard.chronology.from')} ${show(from)}`
    if (to) return `${t('pages.employeeCard.chronology.to')} ${show(to)}`
    return ''
  }, [from, to, i18n.language, t])

  const day = (value: string) =>
    new Date(value).toLocaleDateString(i18n.language, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })

  return (
    <section aria-labelledby="chronology-heading" className="space-y-4">
      {/* Ruled off like every other section's heading, so this one does not
          read as a different kind of block from the ones above it. */}
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <h2 id="chronology-heading" className="text-foreground text-lg font-semibold">
          {t('pages.employeeCard.chronology.title')}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {/*
            Separate pills rather than one joined bar: the component's own
            wrapper paints a card behind the group, which the design does not
            have. Turning that off here keeps the keyboard behaviour the
            component brings - roving focus, arrow keys - without forking it.
          */}
          <SegmentedTabs
            className="w-auto gap-2 bg-transparent p-0 shadow-none"
            items={FILTERS.map((id) => ({
              id,
              label: t(`pages.employeeCard.chronology.filters.${id}`),
              className: 'border-border rounded-full border px-4',
            }))}
            value={filter}
            onChange={setFilter}
            activation="manual"
            ariaLabel={t('pages.employeeCard.chronology.filterLabel')}
          />

          {/*
            One control that opens onto two dates, as the design draws it. The
            two fields were sitting in the header taking a third of its width
            for something most readers never set.
          */}
          <div ref={periodRef} className="relative">
            <button
              type="button"
              aria-expanded={periodOpen}
              aria-haspopup="dialog"
              onClick={() => setPeriodOpen((open) => !open)}
              className="border-border text-foreground hover:bg-muted flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors"
            >
              <Icons.Calendar03 size={16} strokeWidth={1.6} className="text-muted-foreground" />
              <span className={period ? '' : 'text-muted-foreground'}>
                {period || t('pages.employeeCard.chronology.selectPeriod')}
              </span>
              <Icons.ArrowDown size={14} strokeWidth={1.8} className="text-muted-foreground" />
            </button>

            {periodOpen && (
              <div
                role="dialog"
                aria-label={t('pages.employeeCard.chronology.selectPeriod')}
                className="border-border bg-card absolute right-0 z-20 mt-2 w-64 space-y-3 rounded-xl border p-4 shadow-lg"
              >
                <DateSelect
                  label={t('pages.employeeCard.chronology.from')}
                  value={parsePickerYMD(from)}
                  onChange={({ value }) => setFrom(value ? formatPickerDateAsYMD(value) : '')}
                  max={parsePickerYMD(to) ?? new Date()}
                  format="dd.MM.yyyy"
                  allowManualInput
                  placeholder={t('pages.employeeCard.chronology.from')}
                />
                <DateSelect
                  label={t('pages.employeeCard.chronology.to')}
                  value={parsePickerYMD(to)}
                  onChange={({ value }) => setTo(value ? formatPickerDateAsYMD(value) : '')}
                  min={parsePickerYMD(from) ?? undefined}
                  max={new Date()}
                  format="dd.MM.yyyy"
                  allowManualInput
                  placeholder={t('pages.employeeCard.chronology.to')}
                />
                {period && (
                  <Button
                    type="button"
                    variant="cancel"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setFrom('')
                      setTo('')
                    }}
                  >
                    {t('pages.employeeCard.chronology.clearPeriod')}
                  </Button>
                )}
              </div>
            )}
          </div>
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

      {/*
        A rail down the left with the years marked on it, as the design draws
        it. The line is what makes a list of dated rows read as one history
        rather than as several stacks that happen to sit above each other.

        It is drawn as its own element rather than as a border on the wrapper,
        so it can start and stop at the markers. A border runs the full height
        of the box, which left a stub of line poking up above the first year
        with nothing at its end.
      */}
      {years.length > 0 && (
        <div className="relative space-y-6 pl-6">
          <span
            aria-hidden="true"
            className="border-border/70 absolute top-3 bottom-3 left-0 border-l border-dashed"
          />

          {years.map((group) => {
            const isOpen = !collapsed.includes(group.year)
            const panelId = `chronology-${group.year}`

            return (
              // Each year is its own positioning context: with one on the
              // wrapper instead, every marker would stack at its top-left
              // corner rather than sitting beside the year it belongs to.
              <div key={group.year} className="relative space-y-2">
                <h3>
                  {/*
                    A year folds away. Somebody looking for one period should
                    not have to scroll past every other, and the marker on the
                    rail is where the design puts the control.
                  */}
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggleYear(group.year)}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'border-primary-500 absolute top-1.5 -left-6 size-3 -translate-x-1/2 rounded-full border-2 transition-colors',
                        isOpen ? 'bg-primary-500' : 'bg-background'
                      )}
                    />
                    <span className="bg-muted text-foreground rounded-full px-3 py-1 text-xs font-medium tabular-nums">
                      {group.year}
                    </span>
                  </button>
                </h3>

                {isOpen && (
                  <ol id={panelId} className="space-y-2">
                    {group.events.map((event) => (
                      <li
                        key={event.id}
                        className="border-border bg-muted/40 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3"
                      >
                        <span className="bg-background text-muted-foreground shrink-0 rounded-md px-2 py-0.5 text-xs tabular-nums">
                          {day(event.occurred_at)}
                        </span>
                        <span className="text-foreground text-sm">{chronologyLabel(event, t)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )
          })}
        </div>
      )}

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
