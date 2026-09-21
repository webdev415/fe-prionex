/**
 * Review and correct a project's holiday calendar for one year (KAN-1107).
 *
 * The computed set is right most of the time and wrong in ways only a person
 * can catch — Ukraine correctly computes to zero holidays under martial law,
 * and will keep computing zero after martial law ends until the package is
 * upgraded. This screen is where that gets caught, so it has to make the
 * difference between "no holidays" and "no calendar" impossible to miss.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/useConfirm'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Icons } from '@/lib/icons'
import {
  useAddHolidayDate,
  useConfirmHolidayCalendar,
  useGenerateHolidayCalendar,
  useHolidayCalendar,
  useRemoveHolidayDate,
} from '@/features/projects/hooks/useCallingWindow'

interface HolidayCalendarPanelProps {
  projectId: number
  /** From the window config; without it the calendar cannot be computed. */
  country: string | null
  onClose: () => void
}

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status
}

export function HolidayCalendarPanel({ projectId, country, onClose }: HolidayCalendarPanelProps) {
  const { t } = useTranslation('common')
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [newDate, setNewDate] = useState('')
  const [newName, setNewName] = useState('')

  const { data: calendar, isLoading, error } = useHolidayCalendar(projectId, year)
  const generate = useGenerateHolidayCalendar(projectId, year)
  const addDate = useAddHolidayDate(projectId, year)
  const removeDate = useRemoveHolidayDate(projectId, year)
  const confirm = useConfirmHolidayCalendar(projectId, year)
  const { confirm: askFirst, confirmDialog } = useConfirm()

  // A 404 means the year has never been generated. Anything else is a real
  // failure and must not be shown as "nothing here yet" — that would invite
  // an admin to generate over a calendar that already exists.
  const notGenerated = statusOf(error) === 404
  const loadFailed = Boolean(error) && !notGenerated

  const busy = generate.isPending || addDate.isPending || removeDate.isPending || confirm.isPending

  const years = useMemo(() => [thisYear, thisYear + 1], [thisYear])

  const handleGenerate = (replace: boolean) =>
    generate.mutate(replace, {
      onSuccess: (result) => {
        if (result.dates.length === 0) {
          toast.warning(
            t(
              'pages.projects.holidayCalendar.computedEmpty',
              'This country has no public holidays recorded for that year. Check before relying on it.'
            )
          )
        }
      },
      onError: () =>
        toast.error(
          t('pages.projects.holidayCalendar.generateFailed', 'Could not generate the calendar')
        ),
    })

  // Behind a confirmation: this re-derives the computed set, so a computed
  // date an admin deliberately removed comes back, and the reviewed mark is
  // cleared — an admin who has just finished checking the year would have to
  // check it again, with no warning that they were about to.
  const handleRegenerate = async () => {
    const ok = await askFirst({
      title: t('pages.projects.holidayCalendar.regenerateTitle', 'Recompute {{year}}?', { year }),
      message: t(
        'pages.projects.holidayCalendar.regenerateConfirm',
        'Computed dates are re-derived from the country calendar, dates you added by hand are kept, and the reviewed mark is cleared.'
      ),
      confirmLabel: t('pages.projects.holidayCalendar.regenerate', 'Recompute from the calendar'),
      tone: 'danger',
    })
    if (ok) handleGenerate(true)
  }

  const handleAdd = () => {
    // Says why instead of returning quietly. The first version silently did
    // nothing when the text did not parse, so a date typed in any other
    // format looked like a dead button.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      toast.error(t('pages.projects.holidayCalendar.badDate', 'Enter the date as YYYY-MM-DD'))
      return
    }
    if (Number(newDate.slice(0, 4)) !== year) {
      toast.error(
        t('pages.projects.holidayCalendar.wrongYear', 'That date is not in {{year}}', { year })
      )
      return
    }
    addDate.mutate(
      { date: newDate, name: newName.trim() || undefined },
      {
        onSuccess: () => {
          setNewDate('')
          setNewName('')
        },
        onError: (error: unknown) => {
          // 409 is the common one — the date is already on the calendar — and
          // "could not add that date" leaves the admin wondering what broke.
          const status = (error as { response?: { status?: number } })?.response?.status
          toast.error(
            status === 409
              ? t(
                  'pages.projects.holidayCalendar.alreadyAdded',
                  'That date is already on the calendar'
                )
              : t('pages.projects.holidayCalendar.addFailed', 'Could not add that date')
          )
        },
      }
    )
  }

  return (
    <>
      <ModalContent>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Label>{t('pages.projects.holidayCalendar.year', 'Year')}</Label>
            {years.map((option) => (
              <Button
                key={option}
                variant={option === year ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setYear(option)}
              >
                {option}
              </Button>
            ))}
          </div>

          {!country && (
            <Alert variant="warning">
              {t(
                'pages.projects.holidayCalendar.noCountry',
                'No country is set, so public holidays are not observed. Choose one on the Window tab to enforce them.'
              )}
            </Alert>
          )}

          {loadFailed && (
            <Alert variant="error">
              {t(
                'pages.projects.holidayCalendar.loadFailed',
                'Could not load the calendar. Try again before generating, so an existing one is not overwritten.'
              )}
            </Alert>
          )}

          {isLoading && (
            <p className="text-muted-foreground text-sm">{t('status.loading', 'Loading…')}</p>
          )}

          {notGenerated && country && (
            <Alert variant="warning">
              <div className="flex flex-col gap-2">
                <span>
                  {t(
                    'pages.projects.holidayCalendar.notGenerated',
                    'No calendar exists for this year. Until one does, every call in that year is refused.'
                  )}
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleGenerate(false)}
                  disabled={busy}
                  className="self-start"
                >
                  {t('pages.projects.holidayCalendar.generate', 'Generate {{year}}', { year })}
                </Button>
              </div>
            </Alert>
          )}

          {calendar && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-muted-foreground text-xs">
                  {calendar.country}
                  {calendar.subdivision ? ` / ${calendar.subdivision}` : ''}
                  {calendar.source_version ? ` · holidays ${calendar.source_version}` : ''}
                </div>
                {calendar.reviewed ? (
                  <span className="text-xs font-medium text-emerald-600">
                    {t('pages.projects.holidayCalendar.reviewed', 'Reviewed')}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-amber-600">
                    {t('pages.projects.holidayCalendar.unreviewed', 'Not yet reviewed')}
                  </span>
                )}
              </div>

              {calendar.dates.length === 0 ? (
                <Alert variant="warning">
                  {t(
                    'pages.projects.holidayCalendar.emptyCalendar',
                    'This calendar has no dates. That is a valid answer for some countries, but confirm it is right — calls will be allowed on every working day of the year.'
                  )}
                </Alert>
              ) : (
                <ul className="divide-border divide-y rounded-md border">
                  {calendar.dates.map((entry) => (
                    <li
                      key={entry.holiday_date}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{entry.holiday_date}</span>
                        <span className="text-muted-foreground">{entry.name}</span>
                        {entry.origin === 'manual' && (
                          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[11px] text-sky-700">
                            {t('pages.projects.holidayCalendar.added', 'added')}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          removeDate.mutate(entry.holiday_date, {
                            onError: () =>
                              toast.error(
                                t(
                                  'pages.projects.holidayCalendar.removeFailed',
                                  'Could not remove that date'
                                )
                              ),
                          })
                        }
                        disabled={busy}
                        aria-label={`${t('actions.delete', 'Remove')} ${entry.holiday_date}`}
                        className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                      >
                        <Icons.Delete size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-end gap-2">
                <div className="w-40">
                  <Label htmlFor="hc-date">
                    {t('pages.projects.holidayCalendar.addDate', 'Add a date')}
                  </Label>
                  <Input
                    id="hc-date"
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    min={`${year}-01-01`}
                    max={`${year}-12-31`}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="hc-name">
                    {t('pages.projects.holidayCalendar.addName', 'Name (optional)')}
                  </Label>
                  <Input
                    id="hc-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <Button variant="secondary" onClick={handleAdd} disabled={busy || !newDate}>
                  {t('actions.add', 'Add')}
                </Button>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleRegenerate}
                disabled={busy}
                className="self-start"
              >
                {t('pages.projects.holidayCalendar.regenerate', 'Recompute from the calendar')}
              </Button>
              <p className="text-muted-foreground text-xs">
                {t(
                  'pages.projects.holidayCalendar.regenerateHint',
                  'Recomputing keeps dates you added and clears the reviewed mark.'
                )}
              </p>
            </>
          )}
        </div>
      </ModalContent>
      {confirmDialog}
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {t('actions.close', 'Close')}
        </Button>
        {calendar && !calendar.reviewed && (
          <Button
            variant="primary"
            onClick={() =>
              confirm.mutate(undefined, {
                onSuccess: () =>
                  toast.success(
                    t('pages.projects.holidayCalendar.confirmed', 'Calendar marked as reviewed')
                  ),
                onError: () =>
                  toast.error(
                    t(
                      'pages.projects.holidayCalendar.confirmFailed',
                      'Could not mark the calendar as reviewed'
                    )
                  ),
              })
            }
            disabled={busy}
          >
            {t('pages.projects.holidayCalendar.confirm', 'Mark as reviewed')}
          </Button>
        )}
      </ModalFooter>
    </>
  )
}
