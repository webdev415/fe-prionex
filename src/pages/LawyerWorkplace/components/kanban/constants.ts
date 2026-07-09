import type { KanbanColumnDef, KanbanTaskType, KanbanTaskPriority } from '../../kanban/kanbanData'

export type { KanbanTaskPriority }

export type DeadlineFilter = 'all' | 'this_week' | 'this_month'

export type LawyerFilterId = 'all' | string

export type TypeFilterId = 'all' | string

export interface KanbanFilterOption<T extends string = string> {
  id: T
  key: string
  fallback: string
  /** When set, shown instead of i18n key (e.g. settings display name). */
  label?: string
}

export interface LawyerFilterOption extends KanbanFilterOption<LawyerFilterId> {
  assigneeUserId?: number
  assigneeName?: string
}

export interface TypeFilterOption extends KanbanFilterOption<TypeFilterId> {
  letterTypeId?: string
}

export const ALL_LAWYERS_FILTER: LawyerFilterOption = {
  id: 'all',
  key: 'pages.lawyerWorkplace.kanban.filters.allLawyers',
  fallback: 'All Lawyers',
}

export const TYPE_FILTER_OPTIONS: TypeFilterOption[] = [
  {
    id: 'all',
    key: 'pages.lawyerWorkplace.kanban.filters.allTypes',
    fallback: 'All Types',
  },
  {
    id: 'complaint',
    key: 'pages.lawyerWorkplace.parameters.types.complaint',
    fallback: 'Complaint',
    letterTypeId: 'complaint',
  },
  {
    id: 'nbu_inquiry',
    key: 'pages.lawyerWorkplace.parameters.types.nbuInquiry',
    fallback: 'NBU inquiry',
    letterTypeId: 'nbu_inquiry',
  },
  {
    id: 'court_claim',
    key: 'pages.lawyerWorkplace.parameters.types.courtClaim',
    fallback: 'Court claim',
    letterTypeId: 'court_claim',
  },
  {
    id: 'attorney_request',
    key: 'pages.lawyerWorkplace.parameters.types.attorneyRequest',
    fallback: 'Attorney request',
    letterTypeId: 'attorney_request',
  },
  {
    id: 'inquiry',
    key: 'pages.lawyerWorkplace.parameters.types.inquiry',
    fallback: 'Inquiry',
    letterTypeId: 'inquiry',
  },
]

/** Build filtered columns from base columns applying lawyer + type + deadline filters */
export function applyKanbanFilters(
  columns: KanbanColumnDef[],
  lawyerFilter: LawyerFilterId,
  typeFilter: TypeFilterId,
  lawyerOptions: LawyerFilterOption[],
  typeOptions: TypeFilterOption[],
  deadlineFilter: DeadlineFilter,
  matchesDeadline: (task: KanbanColumnDef['tasks'][number], filter: DeadlineFilter) => boolean
): KanbanColumnDef[] {
  const lawyerOption = lawyerOptions.find((option) => option.id === lawyerFilter)
  const typeOption = typeOptions.find((option) => option.id === typeFilter)

  return columns.map((col) => ({
    ...col,
    tasks: col.tasks.filter((task) => {
      const lawyerMatch =
        lawyerFilter === 'all' ||
        (lawyerOption?.assigneeUserId != null
          ? task.assigneeUserId === lawyerOption.assigneeUserId
          : task.assigneeName === lawyerOption?.assigneeName)
      const typeMatch =
        typeFilter === 'all' ||
        (typeOption?.letterTypeId != null
          ? task.letterTypeId === typeOption.letterTypeId
          : task.letterTypeId === typeFilter)
      const deadlineMatch = matchesDeadline(task, deadlineFilter)
      return lawyerMatch && typeMatch && deadlineMatch
    }),
  }))
}

/** Fixed column width in horizontal-scroll mode (parent uses w-max, not min-w-full). */
export const KANBAN_SCROLL_COLUMN_WIDTH_CLASS = 'w-[280px]'

export const TYPE_COLOURS: Record<KanbanTaskType, string> = {
  unclassified: 'bg-gray-100 text-gray-500',
  type_pending: 'bg-amber-50 text-amber-600 border border-amber-200',
  complaint: 'bg-error-100 text-error-700',
  nbu_inquiry: 'bg-secondary-100 text-secondary-800',
  court_claim: 'bg-warning-100 text-warning-700',
  attorney_request: 'bg-[#EDE9FE] text-[#6D28D9]',
  inquiry: 'bg-success-100 text-success-700',
}

export const TYPE_DOT_COLOURS: Record<KanbanTaskType, string> = {
  unclassified: 'bg-gray-400',
  type_pending: 'bg-amber-400',
  complaint: 'bg-error-500',
  nbu_inquiry: 'bg-secondary-600',
  court_claim: 'bg-warning-500',
  attorney_request: 'bg-[#7C3AED]',
  inquiry: 'bg-success-600',
}

const ASSIGNEE_PALETTE = [
  'bg-secondary-100 text-secondary-800',
  'bg-[#EDE9FE] text-[#6D28D9]',
  'bg-blue-100 text-blue-700',
  'bg-success-100 text-success-700',
  'bg-warning-100 text-warning-700',
  'bg-gray-100 text-gray-600',
] as const

const KNOWN_KANBAN_TYPE_IDS = new Set<string>([
  'complaint',
  'nbu_inquiry',
  'court_claim',
  'attorney_request',
  'inquiry',
])

export function isKnownKanbanLetterTypeId(letterTypeId: string): letterTypeId is KanbanTaskType {
  return KNOWN_KANBAN_TYPE_IDS.has(letterTypeId)
}

export function resolveKanbanBadgeType(letterTypeId: string): KanbanTaskType {
  return isKnownKanbanLetterTypeId(letterTypeId) ? letterTypeId : 'type_pending'
}

export function getAssigneeColour(userId: number | null, initials: string): string {
  const seed =
    userId ?? initials.split('').reduce((total, character) => total + character.charCodeAt(0), 0)
  const index = Math.abs(Number(seed)) % ASSIGNEE_PALETTE.length
  return ASSIGNEE_PALETTE[index] ?? 'bg-gray-100 text-gray-500'
}

export function buildTypeFilterOptions(
  letterTypes: { id: string; name: string }[]
): TypeFilterOption[] {
  const dynamicOptions = letterTypes.map((letterType) => ({
    id: letterType.id,
    key: '',
    fallback: letterType.name,
    label: letterType.name,
    letterTypeId: letterType.id,
  }))

  return [
    {
      id: 'all',
      key: 'pages.lawyerWorkplace.kanban.filters.allTypes',
      fallback: 'All Types',
    },
    ...dynamicOptions,
  ]
}

export const TYPE_I18N_KEYS: Record<KanbanTaskType, string> = {
  unclassified: 'pages.lawyerWorkplace.kanban.types.unclassified',
  type_pending: 'pages.lawyerWorkplace.kanban.types.typePending',
  complaint: 'pages.lawyerWorkplace.parameters.types.complaint',
  nbu_inquiry: 'pages.lawyerWorkplace.parameters.types.nbuInquiry',
  court_claim: 'pages.lawyerWorkplace.parameters.types.courtClaim',
  attorney_request: 'pages.lawyerWorkplace.parameters.types.attorneyRequest',
  inquiry: 'pages.lawyerWorkplace.parameters.types.inquiry',
}

export const TYPE_SHORT_LABELS: Record<KanbanTaskType, string> = {
  unclassified: 'unclassified',
  type_pending: 'type pending',
  complaint: 'Complaint',
  nbu_inquiry: 'NBU inquiry',
  court_claim: 'Court claim',
  attorney_request: 'Attorney request',
  inquiry: 'Inquiry',
}

export const DEADLINE_FILTERS: {
  id: DeadlineFilter
  key: string
  fallback: string
}[] = [
  {
    id: 'all',
    key: 'pages.lawyerWorkplace.kanban.filters.all',
    fallback: 'All tasks',
  },
  {
    id: 'this_week',
    key: 'pages.lawyerWorkplace.kanban.filters.thisWeek',
    fallback: 'Due this week',
  },
  {
    id: 'this_month',
    key: 'pages.lawyerWorkplace.kanban.filters.thisMonth',
    fallback: 'Due this month',
  },
]

export const CREATE_TASK_TYPES: Exclude<KanbanTaskType, 'unclassified' | 'type_pending'>[] = [
  'complaint',
  'nbu_inquiry',
  'court_claim',
  'attorney_request',
  'inquiry',
]

export const CREATE_TASK_PRIORITIES: {
  id: KanbanTaskPriority
  key: string
  fallback: string
  textClass: string
}[] = [
  {
    id: 'highest',
    key: 'pages.lawyerWorkplace.kanban.createTask.priorities.highest',
    fallback: 'Highest',
    textClass: 'text-error-600',
  },
  {
    id: 'high',
    key: 'pages.lawyerWorkplace.kanban.createTask.priorities.high',
    fallback: 'High',
    textClass: 'text-error-600',
  },
  {
    id: 'medium',
    key: 'pages.lawyerWorkplace.kanban.createTask.priorities.medium',
    fallback: 'Medium',
    textClass: 'text-dark-500',
  },
  {
    id: 'low',
    key: 'pages.lawyerWorkplace.kanban.createTask.priorities.low',
    fallback: 'Low',
    textClass: 'text-information-600',
  },
  {
    id: 'lowest',
    key: 'pages.lawyerWorkplace.kanban.createTask.priorities.lowest',
    fallback: 'Lowest',
    textClass: 'text-information-600',
  },
]

export const KANBAN_COLUMN_MOVE_OPTIONS = [
  {
    id: 'not_defined' as const,
    labelKey: 'pages.lawyerWorkplace.kanban.columns.notDefined',
  },
  {
    id: 'in_progress' as const,
    labelKey: 'pages.lawyerWorkplace.kanban.columns.inProgress',
  },
  {
    id: 'overdue' as const,
    labelKey: 'pages.lawyerWorkplace.kanban.columns.overdue',
  },
  {
    id: 'completed' as const,
    labelKey: 'pages.lawyerWorkplace.kanban.columns.completed',
  },
]
