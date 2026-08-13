import type { TFunction } from 'i18next'
import type {
  LetterTypeColorOption,
  LawyerPriorityRole,
  RoutingMatchType,
  SyncInterval,
} from '../../settings/types'

export const SETTINGS_SUB_TABS = [
  {
    id: 'letterTypes' as const,
    labelKey: 'pages.lawyerWorkplace.settings.subTabs.letterTypes',
    fallback: 'Letter types',
  },
  {
    id: 'lawyers' as const,
    labelKey: 'pages.lawyerWorkplace.settings.subTabs.lawyers',
    fallback: 'Lawyers',
  },
  {
    id: 'mailboxes' as const,
    labelKey: 'pages.lawyerWorkplace.settings.subTabs.mailboxes',
    fallback: 'Mailboxes',
  },
  {
    id: 'routing' as const,
    labelKey: 'pages.lawyerWorkplace.settings.subTabs.routing',
    fallback: 'Identification rules',
  },
  {
    id: 'templates' as const,
    labelKey: 'pages.lawyerWorkplace.settings.subTabs.templates',
    fallback: 'Templates',
  },
]

export const SYNC_INTERVAL_OPTIONS: {
  id: SyncInterval
  labelKey: string
  fallback: string
}[] = [
  {
    id: '15m',
    labelKey: 'pages.lawyerWorkplace.settings.mailboxes.sync.intervals.15m',
    fallback: 'Every 15 minutes',
  },
  {
    id: '30m',
    labelKey: 'pages.lawyerWorkplace.settings.mailboxes.sync.intervals.30m',
    fallback: 'Every 30 minutes',
  },
  {
    id: '1h',
    labelKey: 'pages.lawyerWorkplace.settings.mailboxes.sync.intervals.1h',
    fallback: 'Every hour',
  },
  {
    id: '4h',
    labelKey: 'pages.lawyerWorkplace.settings.mailboxes.sync.intervals.4h',
    fallback: 'Every 4 hours',
  },
  {
    id: 'daily',
    labelKey: 'pages.lawyerWorkplace.settings.mailboxes.sync.intervals.daily',
    fallback: 'Daily',
  },
]

export function getSyncIntervalLabel(
  interval: SyncInterval | undefined,
  t: TFunction<'common'>
): string {
  const option =
    SYNC_INTERVAL_OPTIONS.find((item) => item.id === interval) ??
    SYNC_INTERVAL_OPTIONS.find((item) => item.id === '1h')
  return t(option!.labelKey, option!.fallback)
}

export const ROUTING_MATCH_OPTIONS: {
  id: RoutingMatchType
  labelKey: string
  fallback: string
}[] = [
  {
    id: 'default',
    labelKey: 'pages.lawyerWorkplace.settings.mailboxes.routing.matchDefault',
    fallback: 'Default',
  },
  {
    id: 'sender_domain',
    labelKey: 'pages.lawyerWorkplace.settings.mailboxes.routing.matchSenderDomain',
    fallback: 'Sender domain',
  },
  {
    id: 'subject_keyword',
    labelKey: 'pages.lawyerWorkplace.settings.mailboxes.routing.matchSubjectKeyword',
    fallback: 'Subject keyword',
  },
]

// Sentinel value for the letter-type dropdown option that turns a routing rule
// into a 'move_to_working' rule (parks matched letters into «Робочі листи»).
export const MOVE_TO_WORKING_VALUE = '__move_to_working__'

export const LETTER_TYPE_COLOR_OPTIONS: LetterTypeColorOption[] = [
  {
    id: 'teal',
    dotClass: 'bg-teal-600',
    bgClass: 'bg-teal-100',
    textClass: 'text-teal-800',
    ringClass: 'ring-teal-600',
  },
  {
    id: 'cyan',
    dotClass: 'bg-cyan-600',
    bgClass: 'bg-cyan-100',
    textClass: 'text-cyan-800',
    ringClass: 'ring-cyan-600',
  },
  {
    id: 'blue',
    dotClass: 'bg-blue-600',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-800',
    ringClass: 'ring-blue-600',
  },
  {
    id: 'indigo',
    dotClass: 'bg-indigo-600',
    bgClass: 'bg-indigo-100',
    textClass: 'text-indigo-800',
    ringClass: 'ring-indigo-600',
  },
  {
    id: 'purple',
    dotClass: 'bg-violet-600',
    bgClass: 'bg-violet-100',
    textClass: 'text-violet-800',
    ringClass: 'ring-violet-600',
  },
  {
    id: 'violet',
    dotClass: 'bg-violet-500',
    bgClass: 'bg-violet-100',
    textClass: 'text-violet-700',
    ringClass: 'ring-violet-500',
  },
  {
    id: 'magenta',
    dotClass: 'bg-fuchsia-600',
    bgClass: 'bg-fuchsia-100',
    textClass: 'text-fuchsia-800',
    ringClass: 'ring-fuchsia-600',
  },
  {
    id: 'pink',
    dotClass: 'bg-pink-600',
    bgClass: 'bg-pink-100',
    textClass: 'text-pink-800',
    ringClass: 'ring-pink-600',
  },
  {
    id: 'red',
    dotClass: 'bg-error-600',
    bgClass: 'bg-error-50',
    textClass: 'text-error-700',
    ringClass: 'ring-error-600',
  },
  {
    id: 'orangeRed',
    dotClass: 'bg-orange-600',
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-800',
    ringClass: 'ring-orange-600',
  },
  {
    id: 'orange',
    dotClass: 'bg-orange-500',
    bgClass: 'bg-orange-100',
    textClass: 'text-orange-700',
    ringClass: 'ring-orange-500',
  },
  {
    id: 'green',
    dotClass: 'bg-success-600',
    bgClass: 'bg-success-100',
    textClass: 'text-success-700',
    ringClass: 'ring-success-600',
  },
]

export const LETTER_TYPE_COLOR_BY_ID = Object.fromEntries(
  LETTER_TYPE_COLOR_OPTIONS.map((option) => [option.id, option])
) as Record<string, LetterTypeColorOption>

export const PRIORITY_ROLE_OPTIONS: {
  id: LawyerPriorityRole
  labelKey: string
  fallback: string
  activeClass: string
  inactiveClass: string
}[] = [
  {
    id: 'primary',
    labelKey: 'pages.lawyerWorkplace.settings.letterTypes.roles.primary',
    fallback: 'PRIMARY',
    activeClass: 'bg-secondary-800 text-white border-secondary-800',
    inactiveClass: 'border-border bg-card text-muted-foreground hover:bg-muted',
  },
  {
    id: 'backup',
    labelKey: 'pages.lawyerWorkplace.settings.letterTypes.roles.backup',
    fallback: 'BACKUP',
    activeClass: 'bg-card text-foreground border-border',
    inactiveClass: 'border-border bg-card text-muted-foreground hover:bg-muted',
  },
  {
    id: 'secondary',
    labelKey: 'pages.lawyerWorkplace.settings.letterTypes.roles.secondary',
    fallback: 'SECONDARY',
    activeClass: 'bg-secondary-100 text-secondary-800 border-secondary-200',
    inactiveClass: 'border-border bg-card text-muted-foreground hover:bg-muted',
  },
  {
    id: 'off',
    labelKey: 'pages.lawyerWorkplace.settings.letterTypes.roles.off',
    fallback: 'OFF',
    activeClass: 'bg-card text-muted-foreground border-border',
    inactiveClass: 'border-border bg-card text-muted-foreground hover:bg-muted',
  },
]
