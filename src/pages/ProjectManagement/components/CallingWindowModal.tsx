/**
 * Calling window settings for one project (KAN-1107).
 *
 * A separate modal rather than a section of EditProjectModal: this decides
 * whether placing a call is legal, and folding it into the general project
 * form would mean every edit of a project name touches a compliance control.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Checkbox } from '@/components/ui/Checkbox'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { HolidayCalendarPanel } from './HolidayCalendarPanel'
import {
  useCallingWindow,
  useHolidayCountries,
  useSetCallingWindow,
  useSubdivisions,
} from '@/features/projects/hooks/useCallingWindow'
import type { CallingWindowConfig, CallingWindowInput, IsoWeekday } from '@/features/projects/types'

interface CallingWindowModalProps {
  projectId: number | null
  projectName?: string
  open: boolean
  onClose: () => void
}

const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7]
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

/** Zones offered up front. Any IANA name is accepted; these just save typing. */
const COMMON_ZONES = [
  'Europe/Madrid',
  'Atlantic/Canary',
  'Europe/Kyiv',
  'Europe/Warsaw',
  'Europe/London',
  'UTC',
]

export function CallingWindowModal({
  projectId,
  projectName,
  open,
  onClose,
}: CallingWindowModalProps) {
  const { t } = useTranslation('common')
  const { data: current, isLoading } = useCallingWindow(open ? projectId : null)
  const [view, setView] = useState<'window' | 'holidays'>('window')

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <ModalHeader
        title={
          t('pages.projects.callingWindow.title', 'Calling window') +
          (projectName ? ` — ${projectName}` : '')
        }
        onClose={onClose}
      />
      {isLoading || !current ? (
        <ModalContent>
          <p className="text-muted-foreground text-sm">{t('status.loading', 'Loading…')}</p>
        </ModalContent>
      ) : (
        <>
          {/* One modal with two views rather than a second modal opened from
              the first: the window and its holiday calendar are one setting,
              and nesting modals to edit halves of it reads as two features. */}
          <div className="flex gap-2 px-6 pt-2" role="tablist">
            <Button
              variant={view === 'window' ? 'primary' : 'secondary'}
              size="sm"
              role="tab"
              aria-selected={view === 'window'}
              onClick={() => setView('window')}
            >
              {t('pages.projects.callingWindow.tabWindow', 'Window')}
            </Button>
            <Button
              variant={view === 'holidays' ? 'primary' : 'secondary'}
              size="sm"
              role="tab"
              aria-selected={view === 'holidays'}
              onClick={() => setView('holidays')}
            >
              {t('pages.projects.callingWindow.tabHolidays', 'Holidays')}
            </Button>
          </div>

          {view === 'window' ? (
            /* Mounted only once the window has loaded, so the form initialises
               from props instead of syncing server data in with an effect. */
            <CallingWindowForm
              key={projectId ?? 'none'}
              projectId={projectId as number}
              initial={current}
              onClose={onClose}
            />
          ) : (
            <HolidayCalendarPanel
              projectId={projectId as number}
              country={current.holiday_country}
              onClose={onClose}
            />
          )}
        </>
      )}
    </Modal>
  )
}

interface CallingWindowFormProps {
  projectId: number
  initial: CallingWindowConfig
  onClose: () => void
}

function CallingWindowForm({ projectId, initial, onClose }: CallingWindowFormProps) {
  const { t } = useTranslation('common')
  const save = useSetCallingWindow(projectId)
  const { data: countries = [] } = useHolidayCountries(true)

  const [enabled, setEnabled] = useState(initial.enabled)
  const [start, setStart] = useState(initial.start ?? '')
  const [end, setEnd] = useState(initial.end ?? '')
  const [weekdays, setWeekdays] = useState<IsoWeekday[]>(initial.weekdays ?? [])
  const [timezone, setTimezone] = useState(initial.timezone ?? '')
  const [country, setCountry] = useState(initial.holiday_country ?? '')
  const [subdivision, setSubdivision] = useState(initial.holiday_subdivision ?? '')

  const { data: subdivisions = [] } = useSubdivisions(country || null)

  const errors = useMemo(() => {
    const found: string[] = []
    if (!enabled) return found
    if (!HHMM.test(start))
      found.push(t('pages.projects.callingWindow.errors.start', 'Start must be HH:MM'))
    if (!HHMM.test(end))
      found.push(t('pages.projects.callingWindow.errors.end', 'End must be HH:MM'))
    if (HHMM.test(start) && start === end)
      found.push(t('pages.projects.callingWindow.errors.same', 'Start and end cannot be equal'))
    if (!timezone.trim())
      found.push(
        t('pages.projects.callingWindow.errors.timezone', 'A fallback timezone is required')
      )
    return found
  }, [enabled, start, end, timezone, t])

  const toggleWeekday = (day: IsoWeekday) =>
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    )

  const handleSave = () => {
    if (errors.length > 0) return
    const payload: CallingWindowInput = {
      enabled,
      start: enabled ? start : null,
      end: enabled ? end : null,
      // An empty selection means "every day", which the API expects as null.
      // Sending [] would be rejected: a window callable on no day is a
      // configuration mistake, not a window.
      weekdays: enabled && weekdays.length > 0 ? weekdays : null,
      timezone: enabled ? timezone.trim() : null,
      holiday_country: country || null,
      holiday_subdivision: subdivision || null,
    }
    save.mutate(payload, {
      onSuccess: () => {
        toast.success(t('pages.projects.callingWindow.saved', 'Calling window saved'))
        onClose()
      },
      onError: () =>
        toast.error(
          t('pages.projects.callingWindow.saveFailed', 'Could not save the calling window')
        ),
    })
  }

  const dayLabel = (day: IsoWeekday) => t(`pages.projects.callingWindow.days.${day}`, String(day))

  return (
    <>
      <ModalContent>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>{t('pages.projects.callingWindow.enable', 'Enforce a calling window')}</Label>
              <p className="text-muted-foreground text-xs">
                {t(
                  'pages.projects.callingWindow.enableHint',
                  'Calls outside the window are refused by the system. Operators cannot override it.'
                )}
              </p>
            </div>
            <ToggleSwitch
              checked={enabled}
              onChange={setEnabled}
              ariaLabel={t('pages.projects.callingWindow.enable', 'Enforce a calling window')}
            />
          </div>

          {enabled && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="cw-start">
                    {t('pages.projects.callingWindow.start', 'Opens')}
                  </Label>
                  <Input
                    id="cw-start"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    placeholder="09:00"
                  />
                </div>
                <div>
                  <Label htmlFor="cw-end">{t('pages.projects.callingWindow.end', 'Closes')}</Label>
                  <Input
                    id="cw-end"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    placeholder="20:45"
                  />
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t(
                      'pages.projects.callingWindow.endHint',
                      'Exclusive — set it short of the legal limit so no call is still running at the cut-off.'
                    )}
                  </p>
                </div>
              </div>

              <div>
                <Label>{t('pages.projects.callingWindow.weekdays', 'Allowed days')}</Label>
                <div className="mt-1 flex flex-wrap gap-3">
                  {WEEKDAYS.map((day) => (
                    <label key={day} className="flex items-center gap-1.5 text-sm">
                      <Checkbox
                        checked={weekdays.includes(day)}
                        onCheckedChange={() => toggleWeekday(day)}
                        aria-label={dayLabel(day)}
                      />
                      {dayLabel(day)}
                    </label>
                  ))}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {t(
                    'pages.projects.callingWindow.weekdaysHint',
                    'Select none to allow every day.'
                  )}
                </p>
              </div>

              <div>
                <Label htmlFor="cw-tz">
                  {t('pages.projects.callingWindow.timezone', 'Fallback timezone')}
                </Label>
                <Input
                  id="cw-tz"
                  list="cw-zones"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="Europe/Madrid"
                />
                <datalist id="cw-zones">
                  {COMMON_ZONES.map((zone) => (
                    <option key={zone} value={zone} />
                  ))}
                </datalist>
                <p className="text-muted-foreground mt-1 text-xs">
                  {t(
                    'pages.projects.callingWindow.timezoneHint',
                    "Used when the debtor's own timezone cannot be determined."
                  )}
                </p>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('pages.projects.callingWindow.country', 'Holiday calendar')}</Label>
              <SearchableSelect
                options={countries.map((c) => ({ id: c.code, name: c.name }))}
                value={country}
                onValueChange={(next) => {
                  setCountry(next)
                  setSubdivision('')
                }}
                placeholder={t(
                  'pages.projects.callingWindow.countryPlaceholder',
                  'Select a country'
                )}
              />
            </div>
            {subdivisions.length > 0 && (
              <div>
                <Label>{t('pages.projects.callingWindow.subdivision', 'Region (optional)')}</Label>
                <SearchableSelect
                  options={subdivisions.map((code) => ({ id: code, name: code }))}
                  value={subdivision}
                  onValueChange={setSubdivision}
                  placeholder={t(
                    'pages.projects.callingWindow.subdivisionPlaceholder',
                    'National only'
                  )}
                />
              </div>
            )}
          </div>

          {enabled && !country && (
            <Alert variant="warning">
              {t(
                'pages.projects.callingWindow.noCountry',
                'Without a holiday calendar, calls are refused on every day of a year that has no calendar generated.'
              )}
            </Alert>
          )}

          {errors.length > 0 && (
            <Alert variant="error">
              <ul className="list-inside list-disc text-sm">
                {errors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </Alert>
          )}
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={save.isPending}>
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={save.isPending || errors.length > 0}
        >
          {save.isPending ? t('status.saving', 'Saving…') : t('actions.save', 'Save')}
        </Button>
      </ModalFooter>
    </>
  )
}
