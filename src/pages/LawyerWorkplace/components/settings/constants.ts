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

export const DOCUMENT_PRESET_TYPE_OPTIONS = [
  {
    id: 'outgoing' as const,
    labelKey: 'pages.lawyerWorkplace.settings.templates.documentTypes.outgoing',
    fallback: 'Outgoing (ВИХ)',
    badge: 'ВИХ',
  },
  {
    id: 'nbu_response' as const,
    labelKey: 'pages.lawyerWorkplace.settings.templates.documentTypes.nbu',
    fallback: 'NBU reply (НБУ)',
    badge: 'НБУ',
  },
]

export const LETTER_TYPE_COLOR_OPTIONS: LetterTypeColorOption[] = [
  {
    id: 'teal',
    dotClass: 'bg-[#0D9488]',
    bgClass: 'bg-[#CCFBF1]',
    textClass: 'text-[#0F766E]',
    ringClass: 'ring-[#0D9488]',
  },
  {
    id: 'cyan',
    dotClass: 'bg-[#0891B2]',
    bgClass: 'bg-[#CFFAFE]',
    textClass: 'text-[#0E7490]',
    ringClass: 'ring-[#0891B2]',
  },
  {
    id: 'blue',
    dotClass: 'bg-[#2563EB]',
    bgClass: 'bg-[#DBEAFE]',
    textClass: 'text-[#1D4ED8]',
    ringClass: 'ring-[#2563EB]',
  },
  {
    id: 'indigo',
    dotClass: 'bg-[#4F46E5]',
    bgClass: 'bg-[#E0E7FF]',
    textClass: 'text-[#4338CA]',
    ringClass: 'ring-[#4F46E5]',
  },
  {
    id: 'purple',
    dotClass: 'bg-[#7C3AED]',
    bgClass: 'bg-[#EDE9FE]',
    textClass: 'text-[#6D28D9]',
    ringClass: 'ring-[#7C3AED]',
  },
  {
    id: 'violet',
    dotClass: 'bg-[#8B5CF6]',
    bgClass: 'bg-[#EDE9FE]',
    textClass: 'text-[#7C3AED]',
    ringClass: 'ring-[#8B5CF6]',
  },
  {
    id: 'magenta',
    dotClass: 'bg-[#C026D3]',
    bgClass: 'bg-[#FAE8FF]',
    textClass: 'text-[#A21CAF]',
    ringClass: 'ring-[#C026D3]',
  },
  {
    id: 'pink',
    dotClass: 'bg-[#DB2777]',
    bgClass: 'bg-[#FCE7F3]',
    textClass: 'text-[#BE185D]',
    ringClass: 'ring-[#DB2777]',
  },
  {
    id: 'red',
    dotClass: 'bg-[#DC2626]',
    bgClass: 'bg-[#FEE2E2]',
    textClass: 'text-[#B91C1C]',
    ringClass: 'ring-[#DC2626]',
  },
  {
    id: 'orangeRed',
    dotClass: 'bg-[#EA580C]',
    bgClass: 'bg-[#FFEDD5]',
    textClass: 'text-[#C2410C]',
    ringClass: 'ring-[#EA580C]',
  },
  {
    id: 'orange',
    dotClass: 'bg-[#F97316]',
    bgClass: 'bg-[#FFEDD5]',
    textClass: 'text-[#EA580C]',
    ringClass: 'ring-[#F97316]',
  },
  {
    id: 'green',
    dotClass: 'bg-[#16A34A]',
    bgClass: 'bg-success-100',
    textClass: 'text-success-700',
    ringClass: 'ring-[#16A34A]',
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
    inactiveClass: 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50',
  },
  {
    id: 'backup',
    labelKey: 'pages.lawyerWorkplace.settings.letterTypes.roles.backup',
    fallback: 'BACKUP',
    activeClass: 'bg-white text-dark-500 border-gray-300',
    inactiveClass: 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50',
  },
  {
    id: 'secondary',
    labelKey: 'pages.lawyerWorkplace.settings.letterTypes.roles.secondary',
    fallback: 'SECONDARY',
    activeClass: 'bg-secondary-100 text-secondary-800 border-secondary-200',
    inactiveClass: 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50',
  },
  {
    id: 'off',
    labelKey: 'pages.lawyerWorkplace.settings.letterTypes.roles.off',
    fallback: 'OFF',
    activeClass: 'bg-white text-gray-400 border-gray-200',
    inactiveClass: 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50',
  },
]

export const ADD_LAWYER_OPTIONS = [
  {
    id: 'vd',
    nameKey: 'pages.lawyerWorkplace.settings.lawyers.people.doroshenko',
    nameFallback: 'Volodymyr Doroshenko',
  },
  {
    id: 'lk',
    nameKey: 'pages.lawyerWorkplace.settings.lawyers.people.kostenko',
    nameFallback: 'Larysa Kostenko',
  },
  {
    id: 'sm',
    nameKey: 'pages.lawyerWorkplace.settings.lawyers.people.melnychenko',
    nameFallback: 'Serhii Melnychenko',
  },
  {
    id: 'ak',
    nameKey: 'pages.lawyerWorkplace.settings.lawyers.people.kovalchuk',
    nameFallback: 'Anna Kovalchuk',
  },
  {
    id: 'oh',
    nameKey: 'pages.lawyerWorkplace.settings.lawyers.people.hrytsenko',
    nameFallback: 'Olena Hrytsenko',
  },
  {
    id: 'pb',
    nameKey: 'pages.lawyerWorkplace.settings.lawyers.people.bondarenko',
    nameFallback: 'Pavlo Bondarenko',
  },
]
