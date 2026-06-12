// ─── Types ───────────────────────────────────────────────────────────────────

export type KanbanColumnId = 'unclassified' | 'in_progress' | 'overdue' | 'ready'

export type KanbanTaskType =
  | 'unclassified'
  | 'type_pending'
  | 'complaint'
  | 'nbu_inquiry'
  | 'court_claim'
  | 'attorney_request'
  | 'inquiry'

export interface KanbanTask {
  id: string
  type: KanbanTaskType
  title: string
  clientCode: string | null
  clientName: string | null
  /** ISO date: when the task response is / was due */
  deadline: string | null
  /** ISO date: when the task was closed (READY column) */
  closedAt: string | null
  /** Two-letter initials, e.g. "VD" */
  assigneeInitials: string
  /** Display name after initials, e.g. "Doroshenko" */
  assigneeName: string
  columnId: KanbanColumnId
}

export interface KanbanColumnDef {
  id: KanbanColumnId
  /** i18n key */
  labelKey: string
  dotClass: string
  tasks: KanbanTask[]
  /** Count of tasks completed/added today (shown as "4 · today") */
  todayCount?: number
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Returns an ISO string N calendar days offset from now at midnight. */
function rel(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// ─── Mock tasks ───────────────────────────────────────────────────────────────

export const MOCK_KANBAN_TASKS: KanbanTask[] = [
  // ── UNCLASSIFIED ────────────────────────────────────────────────────────────
  {
    id: 'TASK-2784',
    type: 'unclassified',
    title: 'Clarify inquiry type',
    clientCode: 'CL-04812',
    clientName: 'V. Oliinyk',
    deadline: null,
    closedAt: null,
    assigneeInitials: 'ON',
    assigneeName: 'manager',
    columnId: 'unclassified',
  },
  {
    id: 'TASK-2789',
    type: 'unclassified',
    title: 'PrivatBank request — attachment with no body',
    clientCode: null,
    clientName: null,
    deadline: null,
    closedAt: null,
    assigneeInitials: 'ON',
    assigneeName: 'manager',
    columnId: 'unclassified',
  },
  {
    id: 'TASK-2791',
    type: 'type_pending',
    title: 'Letter in Russian — needs translation',
    clientCode: 'CL-13802',
    clientName: 'A. Morozov',
    deadline: null,
    closedAt: null,
    assigneeInitials: 'ON',
    assigneeName: 'manager',
    columnId: 'unclassified',
  },

  // ── IN PROGRESS ─────────────────────────────────────────────────────────────
  {
    id: 'TASK-2811',
    type: 'complaint',
    title: 'Reply to complaint — interest charges',
    clientCode: 'CL-08114',
    clientName: 'I. Petrenko',
    deadline: rel(+8),
    closedAt: null,
    assigneeInitials: 'VD',
    assigneeName: 'Doroshenko',
    columnId: 'in_progress',
  },
  {
    id: 'TASK-2806',
    type: 'nbu_inquiry',
    title: 'NBU inquiry — O. Kovalenko',
    clientCode: 'CL-12409',
    clientName: 'O. Kovalenko',
    deadline: rel(+4),
    closedAt: null,
    assigneeInitials: 'LK',
    assigneeName: 'Kostenko',
    columnId: 'in_progress',
  },
  {
    id: 'TASK-2802',
    type: 'court_claim',
    title: 'Statement of defense — case №761/15842/26',
    clientCode: 'CL-09908',
    clientName: 'V. Khomenko',
    deadline: rel(+21),
    closedAt: null,
    assigneeInitials: 'SM',
    assigneeName: 'Melnychenko',
    columnId: 'in_progress',
  },
  {
    id: 'TASK-2799',
    type: 'attorney_request',
    title: 'Attorney request — document copies',
    clientCode: 'CL-06441',
    clientName: 'P. Melnyk',
    deadline: rel(+13),
    closedAt: null,
    assigneeInitials: 'VD',
    assigneeName: 'Doroshenko',
    columnId: 'in_progress',
  },
  {
    id: 'TASK-2794',
    type: 'inquiry',
    title: 'Restructuring inquiry — response draft',
    clientCode: 'CL-04412',
    clientName: 'T. Romaniuk',
    deadline: rel(+13),
    closedAt: null,
    assigneeInitials: 'VD',
    assigneeName: 'Doroshenko',
    columnId: 'in_progress',
  },
  {
    id: 'TASK-2788',
    type: 'court_claim',
    title: 'Court hearing preparation — case №910/4872/26',
    clientCode: null,
    clientName: null,
    deadline: rel(+16),
    closedAt: null,
    assigneeInitials: 'SM',
    assigneeName: 'Melnychenko',
    columnId: 'in_progress',
  },
  {
    id: 'TASK-2781',
    type: 'nbu_inquiry',
    title: 'NBU compliance documents — Q2 review',
    clientCode: null,
    clientName: null,
    deadline: rel(+19),
    closedAt: null,
    assigneeInitials: 'LK',
    assigneeName: 'Kostenko',
    columnId: 'in_progress',
  },
  {
    id: 'TASK-2776',
    type: 'complaint',
    title: 'Penalty recalculation — client dispute',
    clientCode: 'CL-03305',
    clientName: 'M. Bondarenko',
    deadline: rel(+23),
    closedAt: null,
    assigneeInitials: 'VD',
    assigneeName: 'Doroshenko',
    columnId: 'in_progress',
  },
  {
    id: 'TASK-2770',
    type: 'court_claim',
    title: 'Enforcement order response',
    clientCode: 'CL-07832',
    clientName: 'M. Pylypenko',
    deadline: rel(+18),
    closedAt: null,
    assigneeInitials: 'SM',
    assigneeName: 'Melnychenko',
    columnId: 'in_progress',
  },
  {
    id: 'TASK-2765',
    type: 'attorney_request',
    title: 'Power of attorney — document verification',
    clientCode: 'CL-08801',
    clientName: 'R. Kuzyk',
    deadline: rel(+26),
    closedAt: null,
    assigneeInitials: 'LK',
    assigneeName: 'Kostenko',
    columnId: 'in_progress',
  },

  // ── OVERDUE ─────────────────────────────────────────────────────────────────
  {
    id: 'TASK-2701',
    type: 'complaint',
    title: 'Reply to complaint — dated 04/12',
    clientCode: 'CL-07740',
    clientName: 'S. Lytvyn',
    deadline: rel(-31),
    closedAt: null,
    assigneeInitials: 'VD',
    assigneeName: 'Doroshenko',
    columnId: 'overdue',
  },
  {
    id: 'TASK-2698',
    type: 'nbu_inquiry',
    title: 'Written explanations to NBU',
    clientCode: 'CL-09112',
    clientName: 'R. Shevchuk',
    deadline: rel(-29),
    closedAt: null,
    assigneeInitials: 'LK',
    assigneeName: 'Kostenko',
    columnId: 'overdue',
  },

  // ── READY ────────────────────────────────────────────────────────────────────
  {
    id: 'TASK-2755',
    type: 'attorney_request',
    title: 'Attorney request — closed',
    clientCode: 'CL-08812',
    clientName: 'M. Syrota',
    deadline: null,
    closedAt: rel(-25),
    assigneeInitials: 'VD',
    assigneeName: 'Doroshenko',
    columnId: 'ready',
  },
  {
    id: 'TASK-2748',
    type: 'complaint',
    title: 'Complaint — recalculation completed',
    clientCode: 'CL-06440',
    clientName: 'A. Havryliuk',
    deadline: null,
    closedAt: rel(-26),
    assigneeInitials: 'VD',
    assigneeName: 'Doroshenko',
    columnId: 'ready',
  },
  {
    id: 'TASK-2742',
    type: 'nbu_inquiry',
    title: 'NBU inquiry response',
    clientCode: 'CL-11014',
    clientName: 'B. Hryhorenko',
    deadline: null,
    closedAt: rel(-26),
    assigneeInitials: 'LK',
    assigneeName: 'Kostenko',
    columnId: 'ready',
  },
  {
    id: 'TASK-2733',
    type: 'inquiry',
    title: 'Repayment certificate issued',
    clientCode: 'CL-02901',
    clientName: 'O. Babenko',
    deadline: null,
    closedAt: rel(-26),
    assigneeInitials: 'SM',
    assigneeName: 'Melnychenko',
    columnId: 'ready',
  },
]

// ─── Column definitions ───────────────────────────────────────────────────────

export const KANBAN_COLUMNS: KanbanColumnDef[] = [
  {
    id: 'unclassified',
    labelKey: 'pages.lawyerWorkplace.kanban.columns.unclassified',
    dotClass: 'bg-gray-600',
    tasks: MOCK_KANBAN_TASKS.filter((t) => t.columnId === 'unclassified'),
  },
  {
    id: 'in_progress',
    labelKey: 'pages.lawyerWorkplace.kanban.columns.inProgress',
    dotClass: 'bg-information-500',
    tasks: MOCK_KANBAN_TASKS.filter((t) => t.columnId === 'in_progress'),
  },
  {
    id: 'overdue',
    labelKey: 'pages.lawyerWorkplace.kanban.columns.overdue',
    dotClass: 'bg-error-500',
    tasks: MOCK_KANBAN_TASKS.filter((t) => t.columnId === 'overdue'),
  },
  {
    id: 'ready',
    labelKey: 'pages.lawyerWorkplace.kanban.columns.ready',
    dotClass: 'bg-success-500',
    tasks: MOCK_KANBAN_TASKS.filter((t) => t.columnId === 'ready'),
    todayCount: 4,
  },
]
