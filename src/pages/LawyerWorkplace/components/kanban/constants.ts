import type { KanbanColumnDef, KanbanTaskType, KanbanTaskPriority } from '../../kanban/kanbanData'

export type { KanbanTaskPriority }

export type DeadlineFilter = 'this_week' | 'this_month'

export type LawyerFilterId = 'all' | 'doroshenko' | 'kostenko' | 'melnychenko'

export type TypeFilterId =
  | 'all'
  | 'complaint'
  | 'nbu_inquiry'
  | 'court_claim'
  | 'attorney_request'
  | 'inquiry'

export interface KanbanFilterOption<T extends string = string> {
  id: T
  key: string
  fallback: string
}

export interface LawyerFilterOption extends KanbanFilterOption<LawyerFilterId> {
  assigneeName?: string
}

export interface TypeFilterOption extends KanbanFilterOption<TypeFilterId> {
  taskType?: KanbanTaskType
}

export const LAWYER_FILTER_OPTIONS: LawyerFilterOption[] = [
  {
    id: 'all',
    key: 'pages.lawyerWorkplace.kanban.filters.allLawyers',
    fallback: 'All Lawyers',
  },
  {
    id: 'doroshenko',
    key: 'pages.lawyerWorkplace.kanban.filters.lawyers.doroshenko',
    fallback: 'Doroshenko',
    assigneeName: 'Doroshenko',
  },
  {
    id: 'kostenko',
    key: 'pages.lawyerWorkplace.kanban.filters.lawyers.kostenko',
    fallback: 'Kostenko',
    assigneeName: 'Kostenko',
  },
  {
    id: 'melnychenko',
    key: 'pages.lawyerWorkplace.kanban.filters.lawyers.melnychenko',
    fallback: 'Melnychenko',
    assigneeName: 'Melnychenko',
  },
]

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
    taskType: 'complaint',
  },
  {
    id: 'nbu_inquiry',
    key: 'pages.lawyerWorkplace.parameters.types.nbuInquiry',
    fallback: 'NBU inquiry',
    taskType: 'nbu_inquiry',
  },
  {
    id: 'court_claim',
    key: 'pages.lawyerWorkplace.parameters.types.courtClaim',
    fallback: 'Court claim',
    taskType: 'court_claim',
  },
  {
    id: 'attorney_request',
    key: 'pages.lawyerWorkplace.parameters.types.attorneyRequest',
    fallback: 'Attorney request',
    taskType: 'attorney_request',
  },
  {
    id: 'inquiry',
    key: 'pages.lawyerWorkplace.parameters.types.inquiry',
    fallback: 'Inquiry',
    taskType: 'inquiry',
  },
]

/** Build filtered columns from base columns applying lawyer + type filters */
export function applyKanbanFilters(
  columns: KanbanColumnDef[],
  lawyerFilter: LawyerFilterId,
  typeFilter: TypeFilterId
): KanbanColumnDef[] {
  const lawyerOption = LAWYER_FILTER_OPTIONS.find((option) => option.id === lawyerFilter)
  const typeOption = TYPE_FILTER_OPTIONS.find((option) => option.id === typeFilter)

  return columns.map((col) => ({
    ...col,
    tasks: col.tasks.filter((task) => {
      const lawyerMatch = lawyerFilter === 'all' || task.assigneeName === lawyerOption?.assigneeName
      const typeMatch = typeFilter === 'all' || task.type === typeOption?.taskType
      return lawyerMatch && typeMatch
    }),
  }))
}

export const GRID_TEMPLATE = 'repeat(4, minmax(240px, 1fr))'
export const GRID_MIN_WIDTH = 'min-w-[960px]'

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

export const ASSIGNEE_COLOURS: Record<string, string> = {
  VD: 'bg-secondary-100 text-secondary-800',
  LK: 'bg-[#EDE9FE] text-[#6D28D9]',
  SM: 'bg-blue-100 text-blue-700',
  ON: 'bg-gray-200 text-gray-500',
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

export const CREATE_TASK_LAWYER_OPTIONS = [
  {
    id: 'demchuk',
    key: 'pages.lawyerWorkplace.kanban.createTask.lawyers.demchuk',
    fallback: 'Yulia Demchuk',
  },
  {
    id: 'doroshenko',
    key: 'pages.lawyerWorkplace.kanban.createTask.lawyers.doroshenko',
    fallback: 'V. Doroshenko',
  },
  {
    id: 'kostenko',
    key: 'pages.lawyerWorkplace.kanban.createTask.lawyers.kostenko',
    fallback: 'L. Kostenko',
  },
  {
    id: 'melnychenko',
    key: 'pages.lawyerWorkplace.kanban.createTask.lawyers.melnychenko',
    fallback: 'S. Melnychenko',
  },
] as const

export type CreateTaskLawyerId = (typeof CREATE_TASK_LAWYER_OPTIONS)[number]['id']

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

export const KANBAN_ASSIGNEE_OPTIONS = [
  {
    initials: 'VD',
    nameKey: 'pages.lawyerWorkplace.kanban.assignees.doroshenko',
    fallback: 'Doroshenko',
    assigneeName: 'Doroshenko',
  },
  {
    initials: 'LK',
    nameKey: 'pages.lawyerWorkplace.kanban.assignees.kostenko',
    fallback: 'Kostenko',
    assigneeName: 'Kostenko',
  },
  {
    initials: 'SM',
    nameKey: 'pages.lawyerWorkplace.kanban.assignees.melnychenko',
    fallback: 'Melnychenko',
    assigneeName: 'Melnychenko',
  },
  {
    initials: 'ON',
    nameKey: 'pages.lawyerWorkplace.kanban.assignees.manager',
    fallback: 'manager',
    assigneeName: 'manager',
  },
] as const

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
