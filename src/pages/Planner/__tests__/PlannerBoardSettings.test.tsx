/**
 * Board settings — one configuration editor (planner story 5.10) on the real
 * route table (`src/routes/plannerRoutes.tsx`, `…/boards/:code/settings/:section`).
 *
 * The planner is stubbed at the module boundary (`plannerApi`); the archive
 * command of 3.19 is not in contract 0.24.0, so its hook is stubbed too and
 * the fixture decides whether a command exists.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'
import type { AxiosError } from 'axios'
import type {
  PlannerBoard,
  PlannerBoardConfigPreview,
  PlannerBoardMember,
  PlannerPerson,
} from '@/api/planner/plannerApi'

const auth = vi.hoisted(() => ({ permissions: ['planner.access'] as string[] }))
const archiveState = vi.hoisted(() => ({
  command: null as null | {
    openTasks: number
    pending: boolean
    archive: (r: string | null) => void
  },
}))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  const { plannerUseTranslation } = await import('./plannerUkI18n')
  return { ...actual, useTranslation: plannerUseTranslation }
})
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({ user: { id: '7', permissions: auth.permissions } }),
}))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

const api = vi.hoisted(() => ({
  getMeta: vi.fn(),
  listBoards: vi.fn(),
  getBoard: vi.fn(),
  listBoardTasks: vi.fn(),
  previewBoardConfig: vi.fn(),
  putBoardConfig: vi.fn(),
  putBoardMember: vi.fn(),
  deleteBoardMember: vi.fn(),
  getBoardHistory: vi.fn(),
  searchPeople: vi.fn(),
}))
vi.mock('@/api/planner/plannerApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/planner/plannerApi')>()
  return { ...actual, ...api }
})
vi.mock('@/pages/Planner/settings/archiveCommand', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/Planner/settings/archiveCommand')>()
  return { ...actual, useArchiveBoardCommand: () => archiveState.command }
})

import { plannerRoute } from '@/routes/plannerRoutes'
import { makeBoard, makeMeta } from './plannerFixtures'
import {
  locateError,
  locateErrors,
  pluralKey,
  requestBody,
  restoreUsed,
  toConfigInput,
} from '@/pages/Planner/settings/boardSettingsModel'

beforeAll(async () => {
  await import('@/pages/Planner')
}, 120_000)

// ─── fixtures ──────────────────────────────────────────────────────────────

const POLICY = {
  intake_open: true,
  triage_by: 'admins_and_members' as const,
  intake_notify: 'admins' as const,
  member_visibility: 'all' as const,
  group_lanes: false,
  intake_default_type: null,
  confidential: false,
  intake_hint: null,
}

const member = (
  id: string,
  name: string,
  extra: Partial<PlannerBoardMember> = {}
): PlannerBoardMember => ({
  user_id: id,
  crm_user_id: Number(id.replace(/\D/g, '')) || 1,
  full_name: name,
  role: 'board_member',
  source: 'explicit',
  granted_as: null,
  not_in_department: false,
  ...extra,
})

const MANAGER = member('u-1', 'Марина Кравець', {
  role: 'board_admin',
  source: 'department_manager',
})
const STAFF = member('u-2', 'Олег Бондар', { source: 'department' })
const DEPUTY = member('u-3', 'Ірина Шевчук', {
  role: 'board_admin',
  granted_as: 'staff',
  not_in_department: true,
})
const GUEST = member('u-4', 'Петро Гуменюк', { role: 'board_guest' })

const status = (
  id: string,
  name: string,
  position: number,
  category: 'todo' | 'in_progress' | 'done',
  extra: {
    default?: boolean
    requires_reason?: boolean
    sla_mode?: 'running' | 'paused' | 'off'
  } = {}
) => ({
  id,
  name,
  position,
  category,
  sla_mode: extra.sla_mode ?? ('running' as const),
  default: extra.default ?? false,
  notify_author: false,
  requires_reason: extra.requires_reason ?? false,
})

function settingsBoard(overrides: Partial<PlannerBoard> = {}): PlannerBoard {
  return makeBoard({
    kind: 'department',
    version: 5,
    allowed_actions: [
      'create_task',
      'configure',
      'manage_admins',
      'manage_members',
      'archive_board',
    ],
    org_snapshot_age_minutes: 3,
    config: {
      statuses: [
        status('s-done', 'Готово', 3, 'done'),
        status('s-todo', 'Нова', 1, 'todo', { default: true }),
        status('s-work', 'В роботі', 2, 'in_progress'),
        status('s-rej', 'Відхилено', 4, 'done', { requires_reason: true }),
      ],
      task_types: [
        {
          id: 't-once',
          name: 'Разова',
          position: 1,
          default: true,
          sla: { value: 48, unit: 'hours', calendar: 'calendar' },
          initial_status_id: null,
          default_assignee_id: null,
        },
      ],
      fields: [
        {
          id: 'f-channel',
          name: 'Канал',
          type: 'single_select',
          required: false,
          default: null,
          position: 1,
          options: [
            { id: 'o-sms', label: 'SMS', position: 1 },
            { id: 'o-call', label: 'Дзвінок', position: 2 },
          ],
        },
      ],
      labels: [{ id: 'l-urgent', name: 'Терміново', position: 1 }],
      priorities: [
        { id: 'p-low', name: 'Низький', position: 1, default: false },
        { id: 'p-mid', name: 'Середній', position: 2, default: true },
        { id: 'p-high', name: 'Високий', position: 3, default: false },
      ],
      defaults: { assignee_id: null, checklist: ['Перевірити'], description_template: null },
      policy: { value: POLICY, default: POLICY, locked: [] },
    },
    members: [MANAGER, STAFF, DEPUTY, GUEST],
    ...overrides,
  })
}

function preview(overrides: Partial<PlannerBoardConfigPreview> = {}): PlannerBoardConfigPreview {
  const empty = { added: 0, changed: 0, removed: 0 }
  return {
    valid: true,
    errors: [],
    summary: {
      statuses: empty,
      task_types: empty,
      fields: empty,
      labels: empty,
      priorities: empty,
      defaults: empty,
      moved_tasks: [],
    },
    board: null,
    ...overrides,
  }
}

function plannerError(status: number, error: Record<string, unknown>): AxiosError {
  return Object.assign(new Error(String(status)), {
    isAxiosError: true,
    response: { status, data: { error } },
  }) as unknown as AxiosError
}

/** The query client of the last `renderAt` (to refetch the board in a test). */
let lastQueryClient: QueryClient

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  lastQueryClient = queryClient
  const router = createMemoryRouter(
    [{ path: '/dashboard', element: <Outlet />, children: [plannerRoute] }],
    { initialEntries: [path] }
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return router
}

const SETTINGS = '/dashboard/planning/tasks/boards/SKL/settings'

const previewNames = () =>
  within(screen.getByRole('list', { name: 'Попередній перегляд колонок' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent)

const row = (attr: string, id: string) => document.querySelector(`[${attr}="${id}"]`) as HTMLElement

/** The row once the section has rendered it. */
const findRow = (attr: string, id: string) =>
  waitFor(() => {
    const found = row(attr, id)
    if (!found) throw new Error(`no ${attr}=${id}`)
    return found
  })

beforeEach(() => {
  vi.clearAllMocks()
  // A `…Once` answer a failed test left queued must not leak into the next one.
  for (const fn of Object.values(api)) fn.mockReset()
  auth.permissions = ['planner.access']
  archiveState.command = null
  api.getMeta.mockResolvedValue(makeMeta())
  api.listBoards.mockResolvedValue({ items: [] })
  api.getBoard.mockResolvedValue(settingsBoard())
  api.listBoardTasks.mockResolvedValue({ items: [], has_more: false })
  api.previewBoardConfig.mockResolvedValue(preview())
  api.getBoardHistory.mockResolvedValue({ items: [], truncated: false })
  api.searchPeople.mockResolvedValue({ items: [] })
})

// ─── AC1: sections, preview, statuses, fields, labels ──────────────────────

describe('5.10 AC1 — разделы, предпросмотр колонок и правка конфигурации', () => {
  it('слева десять разделов, текущий отмечен; сверху — колонки доски по порядку', async () => {
    renderAt(`${SETTINGS}/statuses`)
    const nav = await screen.findByRole('navigation', { name: 'Розділи налаштувань' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual([
      'Загальне',
      'Статуси',
      'Типи задач і SLA',
      'Поля',
      'Мітки',
      'Пріоритети',
      'Виконавець, чек-лист, опис',
      'Учасники',
      'Доступ',
      'Історія',
    ])
    expect(within(nav).getByRole('link', { name: 'Статуси' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(previewNames()).toEqual(['Новаза замовчуванням', 'В роботі', 'Готово', 'Відхилено'])
  })

  it('неизвестный раздел ведёт на «Загальне»', async () => {
    const router = renderAt(`${SETTINGS}/nope`)
    expect(await screen.findByText('Часовий пояс')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(`${SETTINGS}/general`)
  })

  it('«Вище / Нижче» и перетаскивание меняют порядок статусов и предпросмотр', async () => {
    const user = userEvent.setup()
    renderAt(`${SETTINGS}/statuses`)
    await user.click(await screen.findByRole('button', { name: 'Перемістити «В роботі» вище' }))
    expect(previewNames().slice(0, 2)).toEqual(['В роботі', 'Новаза замовчуванням'])
    expect(screen.getByRole('button', { name: 'Перемістити «В роботі» вище' })).toBeDisabled()

    // Drag «Відхилено» by its grip onto the first row.
    const grip = row('data-status-row', 's-rej').querySelector('[data-drag-handle]') as HTMLElement
    fireEvent.dragStart(grip, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } })
    fireEvent.dragOver(row('data-status-row', 's-work'))
    fireEvent.drop(row('data-status-row', 's-work'))
    expect(previewNames()[0]).toBe('Відхилено')
    expect(await screen.findByText('Є незбережені зміни')).toBeInTheDocument()
  })

  it('появление полосы «Зберегти» объявляется постоянной live-областью', async () => {
    const user = userEvent.setup()
    renderAt(`${SETTINGS}/labels`)
    const announcer = await waitFor(() => {
      const found = document.querySelector('[data-save-announcer]')
      if (!found) throw new Error('no announcer')
      return found as HTMLElement
    })
    // Present before the change (a region born with its text is often not read).
    expect(announcer).toHaveAttribute('aria-live', 'polite')
    expect(announcer).toHaveTextContent('')
    await user.type(await screen.findByDisplayValue('Терміново'), '!')
    expect(announcer).toHaveTextContent('Є незбережені зміни — «Зберегти» внизу сторінки')
  })

  it('после удаления строки фокус идёт на соседнюю «Видалити», у последней — на «+ …»', async () => {
    const user = userEvent.setup()
    renderAt(`${SETTINGS}/statuses`)
    // A status the board has not saved yet holds no tasks — removed at once.
    await user.click(await screen.findByRole('button', { name: '+ Статус' }))
    const added = screen.getAllByRole('button', { name: /^Видалити «/ }).at(-1) as HTMLElement
    await user.click(added)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Видалити «Відхилено»' })).toHaveFocus()
    )

    await user.click(screen.getByRole('link', { name: 'Мітки' }))
    await user.click(await screen.findByRole('button', { name: 'Видалити «Терміново»' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '+ Мітка' })).toHaveFocus())
  })

  it('«Вище / Нижче» с клавиатуры: фокус остаётся на строке, новая позиция объявляется', async () => {
    const user = userEvent.setup()
    renderAt(`${SETTINGS}/statuses`)
    const up = await screen.findByRole('button', { name: 'Перемістити «Відхилено» вище' })
    up.focus()
    await user.keyboard('{Enter}')
    // 4 → 3: «Вище» of the same row still works and keeps the focus.
    expect(previewNames()[2]).toBe('Відхилено')
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Перемістити «Відхилено» вище' })
      )
    )
    expect(screen.getByRole('status')).toHaveTextContent('«Відхилено» — позиція 3 з 4')

    await user.keyboard('{Enter}')
    await user.keyboard('{Enter}')
    // On top «Вище» turns disabled: the focus goes to «Нижче» of the same row.
    expect(previewNames()[0]).toBe('Відхилено')
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Перемістити «Відхилено» нижче' })
      )
    )
    expect(screen.getByRole('status')).toHaveTextContent('«Відхилено» — позиція 1 з 4')

    // «Нижче» moves the row's node; the focus stays on it.
    await user.keyboard('{Enter}')
    expect(previewNames()[1]).toBe('Відхилено')
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Перемістити «Відхилено» нижче' })
      )
    )
  })

  it('пріоритети: «Нижче» с клавиатуры держит фокус на строке', async () => {
    const user = userEvent.setup()
    renderAt(`${SETTINGS}/priorities`)
    const down = await screen.findByRole('button', { name: 'Перемістити «Середній» нижче' })
    down.focus()
    await user.keyboard('{Enter}')
    // Now the last level: «Нижче» is disabled, the focus is on «Вище».
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Перемістити «Середній» вище' })
      )
    )
    expect(screen.getByRole('status')).toHaveTextContent('«Середній» — позиція 3 з 3')
  })

  it('неудачное фоновое обновление доски не стирает черновик: баннер, правки на месте', async () => {
    const user = userEvent.setup()
    renderAt(`${SETTINGS}/labels`)
    await user.type(await screen.findByDisplayValue('Терміново'), '!')
    expect(await screen.findByText('Є незбережені зміни')).toBeInTheDocument()

    api.getBoard.mockRejectedValue(plannerError(503, { code: 'unavailable' }))
    await act(async () => {
      await lastQueryClient.invalidateQueries()
    })
    expect(
      await screen.findByText(/Не вдалося оновити дошку — показано останню завантажену версію/)
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue('Терміново!')).toBeInTheDocument()
    expect(screen.getByText('Є незбережені зміни')).toBeInTheDocument()
    expect(screen.queryByText('Не вдалося завантажити дошку')).not.toBeInTheDocument()
  })

  it('доска не загрузилась вовсе — текст и «Повторити»', async () => {
    const user = userEvent.setup()
    api.getBoard.mockRejectedValueOnce(plannerError(503, { code: 'unavailable' }))
    renderAt(`${SETTINGS}/general`)
    expect(await screen.findByText('Не вдалося завантажити дошку')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Повторити' }))
    expect(await screen.findByText('Часовий пояс')).toBeInTheDocument()
  })

  it('режим SLA `Іде · Пауза · Вимкнено`; смена у сохранённого статуса предупреждает', async () => {
    const user = userEvent.setup()
    renderAt(`${SETTINGS}/statuses`)
    const work = await findRow('data-status-row', 's-work')
    const modes = within(work).getByRole('group', { name: 'Режим SLA' })
    expect(
      within(modes)
        .getAllByRole('radio')
        .map((r) => r.parentElement?.textContent)
    ).toEqual(['Іде', 'Пауза', 'Вимкнено'])
    expect(
      screen.queryByText('Діє з моменту збереження, записується в історію дошки')
    ).not.toBeInTheDocument()
    await user.click(within(modes).getByRole('radio', { name: 'Пауза' }))
    expect(
      within(work).getByText('Діє з моменту збереження, записується в історію дошки')
    ).toBeInTheDocument()
    expect(previewNames()[1]).toBe('В роботіSLA: пауза')
  })

  it('ошибка категории статуса связана с её списком (aria-invalid, aria-describedby)', async () => {
    const user = userEvent.setup()
    api.previewBoardConfig.mockResolvedValue(
      preview({
        valid: false,
        errors: [{ field: 'config.statuses[2].category', reason: 'category_in_use' }],
      })
    )
    renderAt(`${SETTINGS}/statuses`)
    const done = await findRow('data-status-row', 's-done')
    await user.selectOptions(within(done).getByRole('combobox', { name: 'Категорія' }), 'todo')
    await user.click(screen.getByRole('button', { name: 'Зберегти' }))
    const text =
      'У статусі є задачі — категорію не змінити. Створіть новий статус і перенесіть задачі'
    expect(await within(done).findByText(text)).toBeInTheDocument()
    const category = within(done).getByRole('combobox', { name: 'Категорія' })
    expect(category).toHaveAttribute('aria-invalid', 'true')
    expect(category).toHaveAccessibleDescription(text)
    expect(within(done).getByRole('textbox')).toHaveAttribute('aria-invalid', 'false')
  })

  it('«Виконавець, чек-лист, опис»: ошибки связаны со своими полями', async () => {
    const user = userEvent.setup()
    api.previewBoardConfig.mockResolvedValue(
      preview({
        valid: false,
        errors: [
          { field: 'config.defaults.assignee_id', reason: 'not_participant' },
          { field: 'config.defaults.description_template', reason: 'length' },
        ],
      })
    )
    renderAt(`${SETTINGS}/defaults`)
    await user.type(await screen.findByDisplayValue('Перевірити'), '!')
    await user.click(screen.getByRole('button', { name: 'Зберегти' }))
    const assignee = await screen.findByRole('combobox', { name: 'Виконавець за замовчуванням' })
    await waitFor(() => expect(assignee).toHaveAttribute('aria-invalid', 'true'))
    expect(assignee).toHaveAccessibleDescription('Лише учасник дошки')
    const description = screen.getByRole('textbox', { name: 'Зразок опису' })
    expect(description).toHaveAttribute('aria-invalid', 'true')
    expect(description).toHaveAccessibleDescription('Порожнє або задовге значення')
    expect(screen.getByDisplayValue('Перевірити!')).not.toHaveAttribute('aria-describedby')
  })

  it('тип сохранённого поля заблокирован с подсказкой, у нового — выбирается', async () => {
    const user = userEvent.setup()
    renderAt(`${SETTINGS}/fields`)
    const saved = await findRow('data-field-row', 'f-channel')
    const typeSelect = within(saved).getByRole('combobox', { name: 'Тип поля' })
    expect(typeSelect).toBeDisabled()
    expect(typeSelect).toHaveAccessibleDescription('Потрібен інший тип — створіть нове поле')
    await user.click(screen.getByRole('button', { name: '+ Поле' }))
    const selects = screen.getAllByRole('combobox', { name: 'Тип поля' })
    expect(selects[1]).toBeEnabled()
  })

  it('используемое значение списка остаётся: «Використовується в 12 задачах»; неиспользуемое удаляется', async () => {
    const user = userEvent.setup()
    api.previewBoardConfig.mockImplementation(async (_code, _version, body) => {
      const options = body.config.fields[0].options.map((o: { id: string }) => o.id)
      return options.includes('o-sms')
        ? preview()
        : preview({
            valid: false,
            errors: [
              {
                field: 'config.fields[0].options',
                reason: 'option_in_use',
                id: 'o-sms',
                used_count: 12,
              },
            ],
          })
    })
    renderAt(`${SETTINGS}/fields`)
    await user.click(await screen.findByRole('button', { name: 'Видалити «SMS»' }))
    expect(await screen.findByText('Використовується в 12 задачах')).toBeInTheDocument()
    expect(row('data-option-row', 'o-sms')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Видалити «SMS»' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Видалити «Дзвінок»' }))
    await waitFor(() => expect(row('data-option-row', 'o-call')).toBeNull())
    // The value of the check went out under If-Match of the board's version.
    expect(api.previewBoardConfig).toHaveBeenCalledWith('SKL', 5, expect.any(Object))
  })

  it('метки без цвета (U-23)', async () => {
    renderAt(`${SETTINGS}/labels`)
    const label = await findRow('data-label-row', 'l-urgent')
    expect(within(label).getByDisplayValue('Терміново')).toBeInTheDocument()
    expect(screen.getByText('Мітки без кольору')).toBeInTheDocument()
    expect(document.querySelector('input[type="color"]')).toBeNull()
    expect(within(label).getAllByRole('textbox')).toHaveLength(1)
  })

  it('«Доступ» — сводка по политике доски, только чтение', async () => {
    api.getBoard.mockResolvedValue(
      settingsBoard({
        config: {
          ...settingsBoard().config,
          policy: {
            value: {
              ...POLICY,
              member_visibility: 'own_and_intake',
              triage_by: 'admins_only',
              confidential: true,
            },
            default: POLICY,
            locked: [],
          },
        },
      })
    )
    renderAt(`${SETTINGS}/access`)
    expect(await screen.findByText('Свої задачі й нерозібрані заявки')).toBeInTheDocument()
    expect(screen.getByText('Лише адміністратори')).toBeInTheDocument()
    expect(
      screen.getByText(/Конфіденційна дошка — задачі бачать лише учасники/)
    ).toBeInTheDocument()
    expect(screen.getByText('Змінюється в розділі «Політика дошки»')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Зберегти' })).not.toBeInTheDocument()
  })

  it('«Історія» — строки журнала доски: что, кто, что изменено', async () => {
    api.getBoardHistory.mockResolvedValue({
      truncated: true,
      items: [
        {
          id: 'h1',
          at: '2026-09-28T09:00:00Z',
          action: 'config_changed',
          actor: { user_id: 'u-1', crm_user_id: 1, full_name: 'Марина Кравець', inactive: false },
          client: 'crm',
          before: { statuses: [1], labels: [1] },
          after: { statuses: [2], labels: [1] },
        },
        {
          id: 'h2',
          at: '2026-09-29T09:00:00Z',
          action: 'member_changed',
          actor: null,
          client: 'hub-mobile',
          before: { role: 'board_member' },
          after: { role: 'board_admin' },
        },
      ],
    })
    renderAt(`${SETTINGS}/history`)
    const history = await screen.findByRole('region', { name: 'Історія' })
    await within(history).findByText('Змінено учасника')
    const texts = [...history.querySelectorAll('ol > li')].map((item) => item.textContent ?? '')
    expect(texts[0]).toContain('Змінено учасника')
    expect(texts[0]).toContain('Роль: Член → Адмін')
    expect(texts[0]).toContain('Система · HUB на телефоні')
    expect(texts[1]).toContain('Змінено конфігурацію')
    expect(texts[1]).toContain('Марина Кравець · CRM')
    expect(texts[1]).toContain('Розділи: Статуси')
    expect(texts[1]).not.toContain('Мітки')
    expect(screen.getByText('Показано останні 500 записів')).toBeInTheDocument()
  })

  it('«Історія» не загрузилась — текст и «Повторити»', async () => {
    const user = userEvent.setup()
    api.getBoardHistory.mockRejectedValueOnce(plannerError(503, { code: 'unavailable' }))
    renderAt(`${SETTINGS}/history`)
    expect(await screen.findByText('Не вдалося завантажити історію')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Повторити' }))
    expect(await screen.findByText('Змін ще немає')).toBeInTheDocument()
  })
})

// ─── AC2: save with dry_run, leave guard, move tasks ───────────────────────

describe('5.10 AC2 — сохранение через dry_run и If-Match', () => {
  it('сначала dry_run: ошибка встаёт у своей строки, запись не идёт; затем сохранение с If-Match', async () => {
    const user = userEvent.setup()
    api.previewBoardConfig.mockResolvedValueOnce(
      preview({ valid: false, errors: [{ field: 'config.statuses[1].name', reason: 'duplicate' }] })
    )
    const saved = settingsBoard({ version: 6 })
    api.putBoardConfig.mockResolvedValue(saved)
    renderAt(`${SETTINGS}/statuses`)

    const nameInput = within(await findRow('data-status-row', 's-work')).getByRole('textbox', {
      name: 'Назва статусу',
    })
    await user.clear(nameInput)
    await user.type(nameInput, 'Нова')
    expect(screen.getByText('Є незбережені зміни')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Зберегти' }))
    const work = row('data-status-row', 's-work')
    expect(await within(work).findByText('Така назва вже є')).toBeInTheDocument()
    expect(within(work).getByDisplayValue('Нова')).toHaveAttribute('aria-invalid', 'true')
    expect(api.putBoardConfig).not.toHaveBeenCalled()
    // The section in the menu carries the number of its errors.
    expect(screen.getByText('помилок: 1')).toBeInTheDocument()

    await user.clear(within(work).getByDisplayValue('Нова'))
    await user.type(within(work).getByRole('textbox', { name: 'Назва статусу' }), 'У роботі')
    await user.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(api.putBoardConfig).toHaveBeenCalledTimes(1))
    const [code, version, body] = api.putBoardConfig.mock.calls[0]
    expect(code).toBe('SKL')
    expect(version).toBe(5)
    expect(body.config.statuses[1]).toMatchObject({ id: 's-work', name: 'У роботі' })
    expect(body).not.toHaveProperty('move_tasks_to')
    expect(body.config).not.toHaveProperty('policy')
    // dry_run of the same body went first.
    const lastPreview = api.previewBoardConfig.mock.calls.at(-1)
    expect(lastPreview?.[2]).toEqual(body)
    expect(api.previewBoardConfig.mock.invocationCallOrder.at(-1)).toBeLessThan(
      api.putBoardConfig.mock.invocationCallOrder[0]
    )
    expect(toast.success).toHaveBeenCalledWith('Налаштування збережено')
    await waitFor(() => expect(screen.queryByText('Є незбережені зміни')).not.toBeInTheDocument())
  })

  it('уход со страницы с правками спрашивает «Залишити без збереження?»; переход между разделами — нет', async () => {
    const user = userEvent.setup()
    const router = renderAt(`${SETTINGS}/labels`)
    const label = await screen.findByDisplayValue('Терміново')
    await user.type(label, '!')

    await user.click(screen.getByRole('link', { name: 'Пріоритети' }))
    expect(router.state.location.pathname).toBe(`${SETTINGS}/priorities`)
    expect(screen.queryByText('Залишити без збереження?')).not.toBeInTheDocument()
    expect(screen.getByText('Є незбережені зміни')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'До дошки' }))
    expect(await screen.findByText('Залишити без збереження?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Лишитися' }))
    expect(router.state.location.pathname).toBe(`${SETTINGS}/priorities`)

    await user.click(screen.getByRole('link', { name: 'До дошки' }))
    await user.click(await screen.findByRole('button', { name: 'Залишити' }))
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/dashboard/planning/tasks/boards/SKL')
    )
  })

  it('удаление статуса с задачами — «Перенести 12 задач у…», перенос уходит в move_tasks_to', async () => {
    const user = userEvent.setup()
    api.previewBoardConfig.mockImplementation(async (_code, _version, body) => {
      const kept = body.config.statuses.map((s: { id: string }) => s.id)
      return !kept.includes('s-work') && !body.move_tasks_to
        ? preview({
            valid: false,
            errors: [
              { field: 'move_tasks_to', reason: 'status_in_use', id: 's-work', used_count: 12 },
            ],
          })
        : preview()
    })
    api.putBoardConfig.mockResolvedValue(settingsBoard({ version: 6 }))
    renderAt(`${SETTINGS}/statuses`)

    await user.click(await screen.findByRole('button', { name: 'Видалити «В роботі»' }))
    expect(await screen.findByText('Перенести 12 задач у…')).toBeInTheDocument()
    // Targets: the new configuration's statuses without «Потребує причини».
    const dialog = screen.getByRole('dialog')
    const target = within(dialog).getByRole('combobox')
    expect(
      within(target)
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['Нова', 'Готово'])
    await user.selectOptions(target, 's-done')
    await user.click(within(dialog).getByRole('button', { name: 'Перенести й видалити статус' }))
    await waitFor(() => expect(previewNames()).not.toContain('В роботі'))
    // The removed row's place: the focus goes to the next row's «Видалити».
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Видалити «Готово»' })).toHaveFocus()
    )

    await user.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(api.putBoardConfig).toHaveBeenCalled())
    expect(api.putBoardConfig.mock.calls[0][2].move_tasks_to).toEqual({ 's-work': 's-done' })
  })

  it('«Скасувати» переноса, открытого из «Зберегти», возвращает статус в строку с причиной', async () => {
    const user = userEvent.setup()
    // The check at the remove button fails (no connection): the status leaves
    // the draft, and «Зберегти» learns it holds tasks.
    api.previewBoardConfig
      .mockRejectedValueOnce(plannerError(503, { code: 'unavailable' }))
      .mockResolvedValue(
        preview({
          valid: false,
          errors: [
            { field: 'move_tasks_to', reason: 'status_in_use', id: 's-work', used_count: 12 },
          ],
        })
      )
    renderAt(`${SETTINGS}/statuses`)
    await user.click(await screen.findByRole('button', { name: 'Видалити «В роботі»' }))
    await waitFor(() => expect(previewNames()).not.toContain('В роботі'))

    await user.click(screen.getByRole('button', { name: 'Зберегти' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Скасувати' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    const work = await findRow('data-status-row', 's-work')
    expect(previewNames()[1]).toBe('В роботі')
    expect(
      within(work).getByText('У статусі є задачі — оберіть, куди їх перенести')
    ).toBeInTheDocument()
    expect(api.putBoardConfig).not.toHaveBeenCalled()
  })

  it('используемая метка не удаляется: сохранение возвращает её с «Використовується в 3 задачах»', async () => {
    const user = userEvent.setup()
    api.previewBoardConfig.mockResolvedValue(
      preview({
        valid: false,
        errors: [{ field: 'config.labels', reason: 'label_in_use', id: 'l-urgent', used_count: 3 }],
      })
    )
    renderAt(`${SETTINGS}/labels`)
    await user.click(await screen.findByRole('button', { name: 'Видалити «Терміново»' }))
    await waitFor(() => expect(row('data-label-row', 'l-urgent')).toBeNull())
    await user.click(screen.getByRole('button', { name: 'Зберегти' }))
    const label = await findRow('data-label-row', 'l-urgent')
    expect(within(label).getByText('Використовується в 3 задачах')).toBeInTheDocument()
    // The row's error is tied to its field for a screen reader.
    const name = within(label).getByRole('textbox', { name: 'Назва мітки' })
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveAccessibleDescription('Використовується в 3 задачах')
    expect(api.putBoardConfig).not.toHaveBeenCalled()
  })

  it('статус без задач удаляется сразу, без диалога', async () => {
    const user = userEvent.setup()
    renderAt(`${SETTINGS}/statuses`)
    await user.click(await screen.findByRole('button', { name: 'Видалити «Відхилено»' }))
    await waitFor(() => expect(previewNames()).not.toContain('Відхилено'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('412 при сохранении — свежая карточка и баннер расхождения; правки остаются', async () => {
    const user = userEvent.setup()
    const fresh = settingsBoard({
      version: 7,
      config: { ...settingsBoard().config, labels: [{ id: 'l-x', name: 'Інша', position: 1 }] },
    })
    api.putBoardConfig.mockRejectedValue(
      plannerError(412, { code: 'revision_mismatch', details: { current: fresh } })
    )
    renderAt(`${SETTINGS}/labels`)
    await user.type(await screen.findByDisplayValue('Терміново'), '!')
    await user.click(screen.getByRole('button', { name: 'Зберегти' }))
    expect(
      await screen.findByText(/Конфігурацію щойно змінив інший адміністратор/)
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue('Терміново!')).toBeInTheDocument()
    expect(toast.info).toHaveBeenCalledWith(
      'Конфігурацію змінив інший адміністратор — ваші правки збережені в чернетці'
    )
  })
})

// ─── AC3: participants ─────────────────────────────────────────────────────

describe('5.10 AC3 — «Учасники»', () => {
  it('вычисленные — «з відділу», только чтение; руководителя не снять; «Не у відділі» у явного админа', async () => {
    renderAt(`${SETTINGS}/members`)
    const manager = await findRow('data-member-row', 'u-1')
    expect(manager).toHaveTextContent('з відділу')
    expect(manager).toHaveTextContent('керівник відділу в CRM')
    expect(within(manager).queryByRole('button')).toBeNull()
    expect(within(manager).queryByRole('combobox')).toBeNull()
    expect(row('data-member-row', 'u-2')).toHaveTextContent('з відділу')

    const deputy = row('data-member-row', 'u-3')
    expect(deputy).toHaveTextContent('Не у відділі')
    expect(within(deputy).getByRole('combobox', { name: 'Роль' })).toHaveValue('board_admin')
    expect(row('data-member-row', 'u-4')).not.toHaveTextContent('Не у відділі')
  })

  it('с manage_admins роль «Адмін» предлагается явным членам и гостям', async () => {
    renderAt(`${SETTINGS}/members`)
    const guest = await findRow('data-member-row', 'u-4')
    const options = (select: HTMLElement) =>
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent)
    expect(options(within(guest).getByRole('combobox', { name: 'Роль' }))).toEqual([
      'Член',
      'Гість',
      'Адмін',
    ])
  })

  it('явный админ (без manage_admins): «Адмін» не предлагается, строки админов без правки', async () => {
    api.getBoard.mockResolvedValue(
      settingsBoard({ allowed_actions: ['create_task', 'configure', 'manage_members'] })
    )
    renderAt(`${SETTINGS}/members`)
    const guest = await findRow('data-member-row', 'u-4')
    expect(
      within(within(guest).getByRole('combobox', { name: 'Роль' }))
        .getAllByRole('option')
        .map((o) => o.textContent)
    ).toEqual(['Член', 'Гість'])
    const deputy = row('data-member-row', 'u-3')
    expect(within(deputy).queryByRole('combobox')).toBeNull()
    expect(within(deputy).queryByRole('button')).toBeNull()
    expect(deputy).toHaveTextContent('Адмін')
  })

  it('сотрудник отдела: 409 already_member — «Вже учасник з відділу»', async () => {
    const user = userEvent.setup()
    const olena: PlannerPerson = {
      user_id: 'u-9',
      crm_user_id: 9,
      full_name: 'Олена Коваль',
      never_logged_in: false,
      departments: [{ department_id: 'd1', name: 'Склад', project_id: 'p1', group: null }],
    }
    api.searchPeople.mockResolvedValue({ items: [olena] })
    api.putBoardMember.mockRejectedValue(
      plannerError(409, { code: 'conflict', details: { reason: 'already_member' } })
    )
    renderAt(`${SETTINGS}/members`)
    await user.type(await screen.findByLabelText('Співробітник'), 'Оле')
    await user.click(await screen.findByRole('button', { name: 'Олена Коваль · Склад' }))
    await user.click(screen.getByRole('button', { name: 'Додати' }))
    expect(await screen.findByText('Вже учасник з відділу')).toBeInTheDocument()
    expect(api.putBoardMember).toHaveBeenCalledWith('SKL', 'u-9', 5, 'board_member')
  })

  it('устаревшая оргструктура: баннер «Оргструктуру оновлено N хв тому…», «Адмін» неактивен с причиной', async () => {
    api.getBoard.mockResolvedValue(settingsBoard({ org_snapshot_age_minutes: 40 }))
    renderAt(`${SETTINGS}/members`)
    expect(
      await screen.findByText(
        'Оргструктуру оновлено 40 хв тому. Призначення адміністраторів недоступне, доки CRM не надішле свіжу оргструктуру'
      )
    ).toBeInTheDocument()
    const guest = row('data-member-row', 'u-4')
    const options = within(within(guest).getByRole('combobox', { name: 'Роль' })).getAllByRole(
      'option'
    )
    expect(options.map((o) => o.textContent)).toEqual([
      'Член',
      'Гість',
      'Адмін — недоступно, доки оргструктура застаріла',
    ])
    expect(options[2]).toBeDisabled()
    expect(options[0]).toBeEnabled()
    // The form of adding: the same inactive «Адмін».
    const addRole = screen.getAllByRole('combobox', { name: 'Роль' }).at(-1) as HTMLElement
    expect(within(addRole).getByRole('option', { name: /^Адмін/ })).toBeDisabled()
    expect(addRole).toHaveValue('board_member')
    // The explicit admin is not editable while the snapshot is stale.
    expect(within(row('data-member-row', 'u-3')).queryByRole('combobox')).toBeNull()
  })

  it('«Прибрати» — DELETE участника под версией доски; карточка из ответа', async () => {
    const user = userEvent.setup()
    api.deleteBoardMember.mockResolvedValue(
      settingsBoard({ version: 6, members: [MANAGER, STAFF, DEPUTY] })
    )
    renderAt(`${SETTINGS}/members`)
    const guest = await findRow('data-member-row', 'u-4')
    await user.click(within(guest).getByRole('button', { name: /Прибрати/ }))
    await waitFor(() => expect(row('data-member-row', 'u-4')).toBeNull())
    expect(api.deleteBoardMember).toHaveBeenCalledWith('SKL', 'u-4', 5)
    expect(toast.success).toHaveBeenCalledWith('Учасника прибрано')
  })

  it('409 last_admin — своим текстом', async () => {
    const user = userEvent.setup()
    api.deleteBoardMember.mockRejectedValue(
      plannerError(409, { code: 'conflict', details: { reason: 'last_admin' } })
    )
    renderAt(`${SETTINGS}/members`)
    const guest = await findRow('data-member-row', 'u-4')
    await user.click(within(guest).getByRole('button', { name: /Прибрати/ }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Не можна прибрати останнього адміністратора дошки')
    )
  })
})

// ─── AC4: rights and archive ───────────────────────────────────────────────

describe('5.10 AC4 — права и архив', () => {
  it('без configure прямой адрес настроек даёт «Немає прав»', async () => {
    api.getBoard.mockResolvedValue(settingsBoard({ allowed_actions: ['create_task'] }))
    renderAt(`${SETTINGS}/statuses`)
    expect(await screen.findByText('Немає прав на налаштування цієї дошки')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Розділи налаштувань' })).toBeNull()
  })

  it('archive_board есть, а команды архива нет (контракт 0.24.0) — кнопки нет', async () => {
    renderAt(`${SETTINGS}/general`)
    expect(await screen.findByText('Часовий пояс')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Архівувати дошку' })).toBeNull()
  })

  it('с командой: «На дошці 12 відкритих задач…», причина обязательна, «Закрити 12 задач і архівувати»', async () => {
    const user = userEvent.setup()
    const archive = vi.fn()
    archiveState.command = { openTasks: 12, pending: false, archive }
    renderAt(`${SETTINGS}/general`)
    await user.click(await screen.findByRole('button', { name: 'Архівувати дошку' }))
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText(
        'На дошці 12 відкритих задач. Щоб архівувати, закрийте їх із причиною'
      )
    ).toBeInTheDocument()
    const confirm = within(dialog).getByRole('button', { name: 'Закрити 12 задач і архівувати' })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByLabelText('Причина*'), 'Відділ закрито')
    await user.click(confirm)
    expect(archive).toHaveBeenCalledWith('Відділ закрито')
  })

  it('без allowed_actions archive_board кнопки нет даже с командой', async () => {
    archiveState.command = { openTasks: 0, pending: false, archive: vi.fn() }
    api.getBoard.mockResolvedValue(
      settingsBoard({ allowed_actions: ['create_task', 'configure', 'manage_members'] })
    )
    renderAt(`${SETTINGS}/general`)
    expect(await screen.findByText('Часовий пояс')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Архівувати дошку' })).toBeNull()
  })

  it('одна открытая задача — «На дошці 1 відкрита задача…»', async () => {
    const user = userEvent.setup()
    archiveState.command = { openTasks: 1, pending: false, archive: vi.fn() }
    renderAt(`${SETTINGS}/general`)
    await user.click(await screen.findByRole('button', { name: 'Архівувати дошку' }))
    expect(
      await screen.findByText('На дошці 1 відкрита задача. Щоб архівувати, закрийте її з причиною')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Закрити 1 задачу і архівувати' })).toBeDisabled()
  })
})

// ─── model ─────────────────────────────────────────────────────────────────

describe('5.10 — модель черновика', () => {
  const sent = toConfigInput(settingsBoard().config)

  it('карточка → тело PUT /config по порядку position, без policy и position', () => {
    expect(sent.statuses.map((s) => s.id)).toEqual(['s-todo', 's-work', 's-done', 's-rej'])
    expect(sent).not.toHaveProperty('policy')
    expect(sent.statuses[0]).not.toHaveProperty('position')
    expect(sent.fields[0].options).toEqual([
      { id: 'o-sms', label: 'SMS' },
      { id: 'o-call', label: 'Дзвінок' },
    ])
  })

  it('путь ошибки → строка тела', () => {
    expect(
      locateError({ field: 'config.statuses[1].name', reason: 'duplicate' }, sent)
    ).toMatchObject({ section: 'statuses', rowId: 's-work', key: 'name' })
    expect(
      locateError({ field: 'config.fields[0].options[1].label', reason: 'length' }, sent)
    ).toMatchObject({ section: 'fields', rowId: 'f-channel', optionId: 'o-call', key: 'label' })
    expect(
      locateError({ field: 'config.defaults.checklist[0]', reason: 'length' }, sent)
    ).toMatchObject({ section: 'defaults', rowId: null, key: 'checklist' })
    expect(
      locateError({ field: 'config.priorities', reason: 'priority_count' }, sent)
    ).toMatchObject({ section: 'priorities', rowId: null })
    expect(
      locateError({ field: 'move_tasks_to.s-work', reason: 'invalid_target' }, sent)
    ).toMatchObject({ section: 'statuses', key: 'move_tasks_to' })
    expect(locateError({ field: 'config', reason: 'config_too_large' }, sent).section).toBeNull()
  })

  it('move_tasks_to — только для статусов, которых в черновике больше нет', () => {
    expect(requestBody({ config: sent, moves: { 's-work': 's-done' } })).toEqual({ config: sent })
    const without = { ...sent, statuses: sent.statuses.filter((s) => s.id !== 's-work') }
    expect(requestBody({ config: without, moves: { 's-work': 's-done' } }).move_tasks_to).toEqual({
      's-work': 's-done',
    })
  })

  it('используемое (`*_in_use`) возвращается в черновик на своё место', () => {
    const draft = {
      ...sent,
      labels: [],
      priorities: sent.priorities.filter((p) => p.id !== 'p-mid'),
      fields: [{ ...sent.fields[0], options: [{ id: 'o-call', label: 'Дзвінок' }] }],
    }
    const located = locateErrors(
      [
        { field: 'config.labels', reason: 'label_in_use', id: 'l-urgent', used_count: 3 },
        { field: 'config.priorities', reason: 'priority_in_use', id: 'p-mid', used_count: 1 },
        { field: 'config.fields[0].options', reason: 'option_in_use', id: 'o-sms', used_count: 12 },
        { field: 'config.priorities', reason: 'priority_count' },
      ],
      draft
    )
    expect(located[0]).toMatchObject({ section: 'labels', rowId: 'l-urgent', usedCount: 3 })
    expect(located[2]).toMatchObject({ section: 'fields', rowId: 'f-channel', optionId: 'o-sms' })
    expect(located[3]).toMatchObject({ section: 'priorities', rowId: null })
    const back = restoreUsed(draft, sent, located)
    expect(back.labels.map((l) => l.id)).toEqual(['l-urgent'])
    expect(back.priorities.map((p) => p.id)).toEqual(['p-low', 'p-mid', 'p-high'])
    expect(back.fields[0].options?.map((o) => o.id)).toEqual(['o-sms', 'o-call'])
  })

  it('три формы числа по правилам языка', () => {
    expect([1, 3, 12, 21, 22, 25].map((n) => pluralKey('x', n, 'uk'))).toEqual([
      'xOne',
      'xFew',
      'xMany',
      'xOne',
      'xFew',
      'xMany',
    ])
    expect([1, 3, 12].map((n) => pluralKey('x', n, 'en'))).toEqual(['xOne', 'xMany', 'xMany'])
  })
})
