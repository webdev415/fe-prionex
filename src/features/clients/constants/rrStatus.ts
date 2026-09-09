export const RR_STATUS = {
  Connected: 1,
  Violated: 2,
  Cancelled: 3,
  Completed: 4,
  CompletedEarly: 5,
  Draft: 6,
} as const

export type RRStatusId = (typeof RR_STATUS)[keyof typeof RR_STATUS]

export interface RRStatusMeta {
  labelKey: string
  fallbackLabel: string
  badgeClass: string
}

const UNKNOWN_BADGE_CLASS = 'bg-gray-100 text-gray-600'

export const rrStatusMeta: Record<number, RRStatusMeta> = {
  [RR_STATUS.Draft]: {
    labelKey: 'pages.clients.rrStatus.draft',
    fallbackLabel: 'Draft',
    badgeClass: 'bg-gray-200 text-gray-700',
  },
  [RR_STATUS.Connected]: {
    labelKey: 'pages.clients.rrStatus.connected',
    fallbackLabel: 'Connected',
    badgeClass: 'bg-blue-100 text-blue-800',
  },
  [RR_STATUS.Violated]: {
    labelKey: 'pages.clients.rrStatus.violated',
    fallbackLabel: 'Violated',
    badgeClass: 'bg-amber-100 text-amber-800',
  },
  [RR_STATUS.Cancelled]: {
    labelKey: 'pages.clients.rrStatus.cancelled',
    fallbackLabel: 'Cancelled',
    badgeClass: 'bg-red-100 text-red-800',
  },
  [RR_STATUS.Completed]: {
    labelKey: 'pages.clients.rrStatus.completed',
    fallbackLabel: 'Completed',
    badgeClass: 'bg-green-100 text-green-800',
  },
  [RR_STATUS.CompletedEarly]: {
    labelKey: 'pages.clients.rrStatus.completedEarly',
    fallbackLabel: 'Completed early',
    badgeClass: 'bg-emerald-100 text-emerald-800',
  },
}

/**
 * "Without RR" — clients with no restructuring record at all (KAN-1054).
 *
 * Deliberately NOT a member of `RR_STATUS`: there is no row 0 in
 * `restructuring_statuses`, and nothing will ever carry it as a value. It is a
 * filter option only, riding in the same `rr_status_in` list so it keeps the
 * multi-select's OR semantics for free — "0,1" reads as "no RR at all, or an
 * RR that is Connected".
 */
export const RR_WITHOUT = 0

/**
 * Labels for the filter checkboxes.
 *
 * Separate from `rrStatusMeta` on purpose. That map feeds `rrBadgeClass`, which
 * paints the badge on the client card and the loan card — putting a
 * pseudo-status in there would make "Without RR" renderable as though a record
 * could be in that state. Filter options and real statuses are different sets
 * that happen to overlap.
 */
export const rrFilterMeta: Record<number, { labelKey: string; fallbackLabel: string }> = {
  ...rrStatusMeta,
  [RR_WITHOUT]: {
    labelKey: 'pages.clients.rrStatus.withoutRr',
    fallbackLabel: 'Without RR',
  },
}

/** Checkbox order in the client-list filter. "Without RR" sits last. */
export const RR_STATUS_FILTER_OPTIONS: number[] = [
  RR_STATUS.Draft,
  RR_STATUS.Connected,
  RR_STATUS.Violated,
  RR_STATUS.Cancelled,
  RR_STATUS.Completed,
  RR_STATUS.CompletedEarly,
  RR_WITHOUT,
]

export function rrBadgeClass(statusId?: number | null): string {
  if (statusId == null) return UNKNOWN_BADGE_CLASS
  return rrStatusMeta[statusId]?.badgeClass ?? UNKNOWN_BADGE_CLASS
}
