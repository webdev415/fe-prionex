import type { KanbanTaskType } from '../../kanban/kanbanData'

export type DeadlineFilter = 'this_week' | 'this_month'

export const LAWYERS = ['All Lawyers', 'V. Doroshenko', 'L. Kostenko', 'S. Melnychenko']

export const TASK_TYPES = [
  'All Types',
  'Complaint',
  'NBU inquiry',
  'Court claim',
  'Attorney request',
  'Inquiry',
]

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
  complaint: 'complaint',
  nbu_inquiry: 'NBU',
  court_claim: 'court',
  attorney_request: 'attorney req.',
  inquiry: 'inquiry',
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
