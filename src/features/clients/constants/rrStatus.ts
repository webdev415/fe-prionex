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
    badgeClass: 'bg-slate-100 text-slate-700',
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

export const RR_STATUS_FILTER_OPTIONS: number[] = [
  RR_STATUS.Draft,
  RR_STATUS.Connected,
  RR_STATUS.Violated,
  RR_STATUS.Cancelled,
  RR_STATUS.Completed,
  RR_STATUS.CompletedEarly,
]

export function rrBadgeClass(statusId?: number | null): string {
  if (statusId == null) return UNKNOWN_BADGE_CLASS
  return rrStatusMeta[statusId]?.badgeClass ?? UNKNOWN_BADGE_CLASS
}
