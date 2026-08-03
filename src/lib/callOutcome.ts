export type OutcomePalette = 'success' | 'error' | 'warning' | 'gray'

export interface CallOutcomeRender {
  /** i18n key under the `common` namespace; empty string for unknown statuses. */
  labelKey: string
  /** Plain-language fallback passed to `t(...)` as the defaultValue. */
  fallback: string
  palette: OutcomePalette
}

/** Normalize status for switch matching (calls use spaces; messaging uses underscores). */
function normalizeOutcomeStatus(status: string | null | undefined): string {
  return (status ?? '').trim().toUpperCase().replace(/\s+/g, '_')
}

export function classifyCallOutcome(status: string | null | undefined): CallOutcomeRender {
  const s = normalizeOutcomeStatus(status)
  switch (s) {
    case 'COMPLETED':
    case 'ANSWERED':
      return {
        labelKey: 'pages.clients.statuses.answered',
        fallback: 'Answered',
        palette: 'success',
      }
    case 'NO_ANSWER':
      return {
        labelKey: 'pages.clients.statuses.noAnswer',
        fallback: 'No answer',
        palette: 'error',
      }
    // Inbound-only, and deliberately distinct: nobody picked up, versus the
    // operator actively declining. call-service writes both.
    case 'MISSED':
      return {
        labelKey: 'pages.clients.statuses.missed',
        fallback: 'Missed',
        palette: 'error',
      }
    case 'REJECTED':
      return {
        labelKey: 'pages.clients.statuses.rejected',
        fallback: 'Rejected',
        palette: 'warning',
      }
    case 'BUSY':
      return {
        labelKey: 'pages.clients.statuses.busy',
        fallback: 'Busy',
        palette: 'gray',
      }
    case 'CANCEL':
    case 'CANCELLED':
      return {
        labelKey: 'pages.clients.statuses.cancel',
        fallback: 'Cancelled',
        palette: 'warning',
      }
    case 'UNAVAILABLE':
      return {
        labelKey: 'pages.clients.statuses.unavailable',
        fallback: 'Unavailable',
        palette: 'error',
      }
    case 'CONGESTION':
      return {
        labelKey: 'pages.clients.statuses.congestion',
        fallback: 'Congestion',
        palette: 'warning',
      }
    case 'FAILED':
      return {
        labelKey: 'pages.clients.statuses.failed',
        fallback: 'Failed',
        palette: 'error',
      }
    case 'DELIVERED':
      return {
        labelKey: 'pages.clients.statuses.delivered',
        fallback: 'Delivered',
        palette: 'success',
      }
    case 'SENT':
      return {
        labelKey: 'pages.clients.statuses.sent',
        fallback: 'Sent',
        palette: 'warning',
      }
    case 'SKIPPED':
      return {
        labelKey: 'pages.clients.statuses.skipped',
        fallback: 'Skipped',
        palette: 'gray',
      }
    case 'BOUNCED':
      return {
        labelKey: 'pages.clients.statuses.bounced',
        fallback: 'Bounced',
        palette: 'error',
      }
    case 'QUEUED':
      return {
        labelKey: 'pages.messagingCampaigns.status.queued',
        fallback: 'Queued',
        palette: 'warning',
      }
    case 'SENDING':
      return {
        labelKey: 'pages.messagingCampaigns.status.sending',
        fallback: 'Sending',
        palette: 'warning',
      }
    case 'PARTIALLY_FAILED':
      return {
        labelKey: 'pages.messagingCampaigns.status.partially_failed',
        fallback: 'Partially failed',
        palette: 'warning',
      }
    case 'PENDING':
    case 'INITIATED':
    case 'RINGING':
      return {
        labelKey: 'pages.clients.statuses.pending',
        fallback: 'Pending',
        palette: 'warning',
      }
    default:
      return { labelKey: '', fallback: status ?? '', palette: 'gray' }
  }
}

const NON_ANSWERED_OUTCOMES = new Set([
  'NO_ANSWER',
  'NO ANSWER',
  'MISSED',
  'REJECTED',
  'BUSY',
  'CANCEL',
  'UNAVAILABLE',
  'CONGESTION',
  'FAILED',
])

export function isNonAnsweredOutcome(status: string | null | undefined): boolean {
  if (!status) return false
  return NON_ANSWERED_OUTCOMES.has(status.toUpperCase())
}

// Literal Tailwind class strings — spelled out so the purger keeps them.
export const OUTCOME_PALETTE_CLASSES: Record<
  OutcomePalette,
  { dot: string; ring: string; text: string; pill: string }
> = {
  success: {
    dot: 'bg-success-500',
    ring: 'bg-success-200',
    text: 'text-success-500',
    pill: 'bg-success-50 text-success-700',
  },
  error: {
    dot: 'bg-error-500',
    ring: 'bg-error-200',
    text: 'text-error-500',
    pill: 'bg-error-50 text-error-700',
  },
  warning: {
    dot: 'bg-warning-500',
    ring: 'bg-warning-200',
    text: 'text-warning-500',
    pill: 'bg-warning-50 text-warning-700',
  },
  gray: {
    dot: 'bg-gray-500',
    ring: 'bg-gray-200',
    text: 'text-gray-500',
    pill: 'bg-gray-100 text-gray-700',
  },
}
