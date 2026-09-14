import type { TFunction } from 'i18next'
import type { ActivityCallRef } from './ClientActivityLogTab'

/** What the call-recording modal renders: display strings, already formatted. */
export interface CallRecordingModalData {
  type: string
  clientName: string
  date: string
  time: string
  operator: string
  duration: string
  phone: string
  call_id?: string
  direction?: string | null
  telephony_type?: string | null
}

/**
 * The call-recording modal's data for a call the activity feed offered.
 *
 * The feed is a merged list, not a call log, so a row carries only what the
 * feed needs; this fills the modal from that and from the client on screen.
 */
export function activityCallToRecordingModal(
  call: ActivityCallRef,
  context: {
    t: TFunction
    locale: string
    timezone?: string | null
    clientName?: string | null
    phone?: string | null
  }
): CallRecordingModalData {
  const { t, locale, timezone } = context
  const when = new Date(call.ts)
  const valid = !Number.isNaN(when.getTime())
  // Profile timezone, as in the Activity row this was opened from; the
  // browser's would show the modal a different time than the row.
  const inProfileZone = (fmt: (options: Intl.DateTimeFormatOptions) => string) => {
    try {
      return fmt({ timeZone: timezone || undefined })
    } catch {
      return fmt({})
    }
  }
  return {
    type:
      call.direction === 'inbound'
        ? t('pages.clients.modals.callLogCard.callTypes.incoming')
        : t('pages.clients.modals.callLogCard.callTypes.outgoing'),
    clientName: context.clientName ?? '',
    date: valid ? inProfileZone((o) => when.toLocaleDateString(locale, o)) : '',
    time: valid ? inProfileZone((o) => when.toLocaleTimeString(locale, o)) : '',
    operator: call.operatorName ?? '',
    // The modal takes a display string, not seconds -- every other call site
    // hands it one already formatted.
    duration:
      call.talkDurationSeconds != null
        ? `${Math.floor(call.talkDurationSeconds / 60)}:${String(
            call.talkDurationSeconds % 60
          ).padStart(2, '0')}`
        : '',
    phone: context.phone ?? '',
    call_id: call.callId,
    direction: call.direction,
  }
}
