/**
 * Contract-typed fixtures for the planner section tests (schema 0.22.0).
 */
import type {
  PlannerBoard,
  PlannerMeta,
  PlannerTask,
  PlannerTaskCard,
} from '@/api/planner/plannerApi'

export function makeMeta(overrides: Partial<PlannerMeta> = {}): PlannerMeta {
  return {
    mode: 'on',
    available: true,
    versions: { api: '0.22.0', build: 'dev' },
    flags: {},
    org_snapshot_age_minutes: 3,
    ics_feed_available: false,
    ...overrides,
  }
}

const OLENA = {
  user_id: '0190a0a0-0000-5000-8000-000000000001',
  crm_user_id: 41,
  full_name: 'Олена Коваль',
  inactive: false,
}

export function makeCard(overrides: Partial<PlannerTaskCard> = {}): PlannerTaskCard {
  return {
    id: '0190a0a0-0000-7000-8000-000000000002',
    key: 'SKL-2',
    number: 2,
    board: { id: 'b1', code: 'SKL', name: 'Склад' },
    title: 'Перевірити залишки',
    status: { id: 's-todo', name: 'Нова', category: 'todo' },
    assignees: [OLENA],
    due_date: '2026-10-02',
    due_at: null,
    due_deadline_at: '2026-10-02T20:59:59Z',
    due_state: 'ok',
    version: 3,
    allowed_actions: ['edit', 'change_status', 'reorder'],
    type: null,
    priority: null,
    labels: [],
    is_request: false,
    needs_triage: false,
    checklist_progress: null,
    ...overrides,
  }
}

export function makeTask(overrides: Partial<PlannerTask> = {}): PlannerTask {
  const card = makeCard()
  return {
    id: card.id,
    key: card.key,
    number: card.number,
    board: card.board,
    title: card.title,
    description: 'Звірити склад із таблицею',
    status: card.status,
    status_reason: null,
    author: OLENA,
    assignees: card.assignees,
    due_date: card.due_date,
    due_at: null,
    due_deadline_at: card.due_deadline_at,
    due_state: 'ok',
    closed_at: null,
    origin: { kind: 'manual' },
    version: card.version,
    read_via: 'board',
    allowed_actions: card.allowed_actions,
    created_at: '2026-09-28T08:00:00Z',
    updated_at: '2026-09-28T08:00:00Z',
    type: null,
    priority: null,
    labels: [],
    watchers: [],
    fields: [],
    dev_task_url: null,
    checklist: [],
    editable_fields: ['title', 'description'],
    is_request: false,
    author_department_id: null,
    needs_triage: false,
    checklist_progress: null,
    ...overrides,
  }
}

const status = (
  id: string,
  name: string,
  position: number,
  category: 'todo' | 'in_progress' | 'done',
  extra: { requires_reason?: boolean; default?: boolean } = {}
) => ({
  id,
  name,
  position,
  category,
  sla_mode: 'running' as const,
  default: extra.default ?? false,
  notify_author: false,
  requires_reason: extra.requires_reason ?? false,
})

export function makeBoard(overrides: Partial<PlannerBoard> = {}): PlannerBoard {
  return {
    id: 'b1',
    code: 'SKL',
    name: 'Склад',
    kind: 'team',
    tzid: 'Europe/Kyiv',
    version: 5,
    config_schema_version: 1,
    template_code: 'basic',
    config: {
      // Deliberately out of order: the board must sort by `position`.
      statuses: [
        status('s-done', 'Готово', 3, 'done'),
        status('s-todo', 'Нова', 1, 'todo', { default: true }),
        status('s-work', 'В роботі', 2, 'in_progress'),
        status('s-rej', 'Відхилено', 4, 'done', { requires_reason: true }),
      ],
      task_types: [],
      fields: [],
      labels: [],
      priorities: [],
      defaults: {} as PlannerBoard['config']['defaults'],
      policy: {} as PlannerBoard['config']['policy'],
    },
    members: [],
    allowed_actions: ['create_task'],
    created_at: '2026-09-27T08:00:00Z',
    org_snapshot_age_minutes: 3,
    ...overrides,
  }
}
