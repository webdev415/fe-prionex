/**
 * The project's calling window, shown at the top of the Dialer page.
 *
 * The per-queue "Outside calling hours" status only appears once the window has
 * actually held a queue — which needs a queue that is synced and switched on.
 * Until then the page said nothing, so a supervisor switching a queue on after
 * hours had no way to know why it would not dial. This states the window
 * itself, whatever the queues are doing.
 */

import { useTranslation } from 'react-i18next'

import { Alert } from '@/components/ui/Alert'
import { reasonMessage } from '@/features/calls/hooks/useCallingWindow'
import { useDialerCallingWindow } from '@/features/dialer/hooks/useDialerCallingWindow'
import type { DialerCallingWindow } from '@/features/dialer/types'

import { formatReopening } from './formatReopening'

type TFn = (key: string, fallback: string, vars?: Record<string, unknown>) => string

function hours(w: DialerCallingWindow): string {
  return w.start && w.end ? `${w.start}–${w.end}` : ''
}

function days(w: DialerCallingWindow, t: TFn): string {
  if (!w.weekdays || w.weekdays.length === 0) {
    return t('dialer.callingWindow.everyDay', 'every day')
  }
  return w.weekdays.map((d) => t(`pages.projects.callingWindow.days.${d}`, String(d))).join(', ')
}

export function CallingWindowBanner() {
  const { t, i18n } = useTranslation('common')
  const { data, isError } = useDialerCallingWindow()

  // A failed request says nothing: the server refuses out-of-window calls
  // regardless, and an alarm on every network blip teaches people to ignore it.
  if (isError || !data || data.state === 'disabled') return null

  if (data.state === 'unavailable') {
    return (
      <p className="text-muted-foreground mb-4 text-sm">
        {t('pages.calls.callingWindow.unavailable', 'Calling hours cannot be checked right now')}
      </p>
    )
  }

  const allowed = t('dialer.callingWindow.allowed', 'Allowed: {{hours}}, {{days}} ({{timezone}})', {
    hours: hours(data),
    days: days(data, t as TFn),
    timezone: data.timezone ?? '',
  })

  if (data.state === 'open') {
    return (
      <p className="text-muted-foreground mb-4 text-sm" data-testid="calling-window-open">
        {t('dialer.callingWindow.open', 'Calling hours {{hours}} · {{days}} · open now', {
          hours: hours(data),
          days: days(data, t as TFn),
        })}
      </p>
    )
  }

  const when =
    data.next_open_at && data.timezone
      ? formatReopening(data.next_open_at, data.timezone, i18n?.language ?? 'en')
      : ''

  return (
    <Alert variant="warning" className="mb-4" data-testid="calling-window-closed">
      <div className="flex flex-col gap-1">
        <span className="font-medium">
          {t('dialer.callingWindow.closedTitle', 'Outside calling hours')}
          {' — '}
          {reasonMessage(t as TFn, data.reason ?? null)}
        </span>
        <span>
          {when
            ? t('dialer.callingWindow.resumes', 'Dialling resumes {{when}}.', { when })
            : t(
                'dialer.callingWindow.resumesUnknown',
                'No reopening time can be given — check the project’s holiday calendar.'
              )}
        </span>
        <span className="text-xs opacity-80">{allowed}</span>
      </div>
    </Alert>
  )
}
