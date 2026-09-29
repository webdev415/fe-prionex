/**
 * Board as a kanban in the CRM (planner story 5.3): header, columns, filters in
 * the address, moving cards (the `⋯` path — the same command as drag and
 * drop), one Tab stop per card, and the «список» view below 1024 px.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom'
import { AxiosError, AxiosHeaders } from 'axios'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  const { plannerUseTranslation } = await import('./plannerUkI18n')
  return { ...actual, useTranslation: plannerUseTranslation }
})
vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: unknown }) => unknown) =>
    selector({ user: { id: '7', permissions: ['planner.access'] } }),
}))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

const api = vi.hoisted(() => ({
  getMeta: vi.fn(),
  getMe: vi.fn(),
  listBoards: vi.fn(),
  listMyTasks: vi.fn(),
  resolveTask: vi.fn(),
  getBoard: vi.fn(),
  getBoardKanban: vi.fn(),
  listBoardTasks: vi.fn(),
  createTask: vi.fn(),
  patchTask: vi.fn(),
  getTaskHistory: vi.fn(),
  searchPeople: vi.fn(),
}))
vi.mock('@/api/planner/plannerApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/planner/plannerApi')>()
  return { ...actual, ...api }
})

import { plannerRoute } from '@/routes/plannerRoutes'
import type { PlannerBoard, PlannerBoardStatus, PlannerTaskCard } from '@/api/planner/plannerApi'
import { CHANGED_BY_BUDGET_MS } from '../hooks/useMoveTask'
import { REFOCUS_HOLD_MS } from '../board/KanbanBoard'
import { makeBoard, makeCard, makeKanban, makeMeta, makeTask } from './plannerFixtures'

beforeAll(async () => {
  await import('@/pages/Planner')
}, 120_000)

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
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

function plannerError(status: number, code: string, details: Record<string, unknown> = {}) {
  return new AxiosError('planner error', String(status), undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { error: { code, message: 'server text', request_id: 'r1', details } },
  })
}

const status = (
  id: string,
  name: string,
  position: number,
  category: PlannerBoardStatus['category'],
  extra: Partial<PlannerBoardStatus> = {}
): PlannerBoardStatus => ({
  id,
  name,
  position,
  category,
  sla_mode: 'running',
  default: false,
  notify_author: false,
  requires_reason: false,
  ...extra,
})

/** «Аналітика»-like board: SLA paused / off, «повідомити автора», a reason status. */
function richBoard(overrides: Partial<PlannerBoard> = {}): PlannerBoard {
  const base = makeBoard()
  return makeBoard({
    kind: 'department',
    allowed_actions: ['create_task', 'configure'],
    config: {
      ...base.config,
      statuses: [
        status('s-todo', 'Нова', 1, 'todo', { default: true }),
        status('s-work', 'В роботі', 2, 'in_progress', { notify_author: true }),
        status('s-wait', 'Очікує', 3, 'in_progress', { sla_mode: 'paused' }),
        status('s-done', 'Готово', 4, 'done', { sla_mode: 'off' }),
        status('s-rej', 'Відхилено', 5, 'done', { requires_reason: true, sla_mode: 'off' }),
      ],
      labels: [{ id: 'l-1', name: 'Термінові', position: 1 }],
      fields: [
        {
          id: 'f-1',
          name: 'Регіон',
          type: 'single_select',
          required: false,
          default: null,
          position: 1,
          options: [{ id: 'o-1', label: 'Київ', position: 1 }],
        },
      ],
      policy: {
        value: { intake_open: true },
      } as unknown as PlannerBoard['config']['policy'],
    },
    ...overrides,
  })
}

const FIRST = makeCard()
const THIRD_ID = '0190a0a0-0000-7000-8000-000000000005'
const SECOND = makeCard({
  id: '0190a0a0-0000-7000-8000-000000000004',
  key: 'SKL-4',
  number: 4,
  title: 'Звірити накладні',
})

function kanbanOf(cards: PlannerTaskCard[], board = richBoard(), totals = {}) {
  return makeKanban(cards, board, totals)
}

describe('доска канбаном (5.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getMeta.mockResolvedValue(makeMeta())
    api.getMe.mockResolvedValue({
      user_id: 'me-uuid',
      crm_user_id: 7,
      permissions: [],
      personal_board: null,
    })
    api.listBoards.mockResolvedValue({ items: [] })
    api.listMyTasks.mockResolvedValue({ items: [], has_more: false })
    api.getBoard.mockResolvedValue(richBoard())
    api.getBoardKanban.mockResolvedValue(kanbanOf([FIRST, SECOND]))
    api.listBoardTasks.mockResolvedValue({ items: [FIRST], has_more: false, next_cursor: null })
    api.searchPeople.mockResolvedValue({ items: [] })
    api.getTaskHistory.mockResolvedValue({ items: [], truncated: false })
  })

  // ─── AC1: header and columns ────────────────────────────────────────────

  it('шапка: название, код, вид, «Приймає заявки», «Дошка | Список», одна «+ Задача» и ⚙ админу', async () => {
    const router = renderAt('/dashboard/planning/tasks/boards/SKL')
    const heading = await screen.findByRole('heading', { name: /Склад/ })
    expect(heading).toHaveTextContent('SKL')
    expect(screen.getByText('Відділ')).toBeInTheDocument()
    expect(screen.getByText('Приймає заявки')).toBeInTheDocument()
    const views = screen.getByRole('group', { name: 'Вигляд дошки' })
    expect(within(views).getByRole('button', { name: 'Дошка' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getAllByRole('button', { name: '+ Задача' })).toHaveLength(1)
    const gear = screen.getByRole('link', { name: 'Налаштування дошки' })
    expect(gear).toHaveAttribute('href', '/dashboard/planning/tasks/boards/SKL/settings')

    const user = userEvent.setup()
    await user.click(gear)
    expect(router.state.location.pathname).toBe('/dashboard/planning/tasks/boards/SKL/settings')
    expect(
      await screen.findByText("Налаштування дошки з'являться з наступним оновленням")
    ).toBeInTheDocument()
  })

  it('без configure — ⚙ нет; без приёма заявок — нет бейджа', async () => {
    api.getBoard.mockResolvedValue(makeBoard({ allowed_actions: ['create_task'] }))
    api.getBoardKanban.mockResolvedValue(makeKanban([FIRST, SECOND]))
    renderAt('/dashboard/planning/tasks/boards/SKL')
    expect(await screen.findByText('Команда')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Налаштування дошки' })).toBeNull()
    expect(screen.queryByText('Приймає заявки')).toBeNull()
  })

  it('колонка: 288 px, счётчик сервера, «ще N» в вид «список», «Закриті за 7 днів →», иконки режима SLA и «повідомити автора»', async () => {
    api.getBoardKanban.mockResolvedValue(
      kanbanOf([FIRST, SECOND], richBoard(), { 's-todo': 57, 's-done': 3 })
    )
    renderAt('/dashboard/planning/tasks/boards/SKL?label=l-1')
    const todo = await screen.findByRole('region', { name: 'Нова' })
    expect(todo).toHaveClass('w-72')
    expect(await within(todo).findByText('57')).toBeInTheDocument()
    // The list has no status filter (contract 0.24.0): the name says whole board.
    const more = within(todo).getByRole('link', {
      name: /ще 55\s*— відкрити всі задачі дошки списком/,
    })
    expect(more).toHaveAttribute('href', expect.stringContaining('view=list'))
    expect(more).toHaveAttribute('href', expect.stringContaining('label=l-1'))

    const done = screen.getByRole('region', { name: 'Готово' })
    expect(
      within(done).getByRole('link', {
        name: /Закриті за 7 днів.*відкрити всі задачі дошки списком/,
      })
    ).toHaveAttribute('href', expect.stringContaining('view=list'))
    expect(within(todo).queryByRole('link', { name: /Закриті за 7 днів/ })).toBeNull()
    // Nothing closed within 7 days in «Відхилено» — nothing to open.
    const rejected = screen.getByRole('region', { name: 'Відхилено' })
    expect(within(rejected).queryByRole('link', { name: /Закриті за 7 днів/ })).toBeNull()

    const work = screen.getByRole('region', { name: 'В роботі' })
    const bell = within(work).getByRole('img', {
      name: 'Перехід у цей статус повідомляє замовника',
    })
    act(() => bell.focus())
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Перехід у цей статус повідомляє замовника'
    )
    const wait = screen.getByRole('region', { name: 'Очікує' })
    expect(within(wait).getByRole('img', { name: 'SLA у цьому статусі на паузі' })).toHaveAttribute(
      'tabindex',
      '0'
    )
    expect(
      within(done).getByRole('img', { name: 'SLA у цьому статусі не рахується' })
    ).toBeVisible()
  })

  it('«Закриті за 7 днів →» ведёт в список, и список говорит, что закрытые — только за 7 дней (Spec Change Log 8)', async () => {
    api.getBoardKanban.mockResolvedValue(kanbanOf([FIRST, SECOND], richBoard(), { 's-done': 2 }))
    const router = renderAt('/dashboard/planning/tasks/boards/SKL')
    const done = await screen.findByRole('region', { name: 'Готово' })
    const user = userEvent.setup()
    await user.click(await within(done).findByRole('link', { name: /Закриті за 7 днів/ }))
    expect(router.state.location.search).toContain('view=list')
    expect(await screen.findByText('Перевірити залишки')).toBeInTheDocument()
    // The contract has no «all closed» projection: the view must not read as one.
    expect(screen.getByText('Закриті задачі показано лише за останні 7 днів')).toBeInTheDocument()
  })

  it('«+» только в колонке статуса по умолчанию и открывает создание задачи', async () => {
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const todo = await screen.findByRole('region', { name: 'Нова' })
    const plus = within(todo).getByRole('button', { name: 'Нова задача в колонці «Нова»' })
    expect(screen.getAllByRole('button', { name: /Нова задача в колонці/ })).toHaveLength(1)
    const user = userEvent.setup()
    await user.click(plus)
    expect(await screen.findByLabelText('Назва')).toBeInTheDocument()
  })

  it('навигатор прокрутки — при переполнении, колонки по названиям', async () => {
    const width = vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (
      this: Element
    ) {
      return this.classList.contains('overflow-x-auto') ? 2400 : 0
    })
    const client = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (
      this: Element
    ) {
      return this.classList.contains('overflow-x-auto') ? 1200 : 0
    })
    try {
      renderAt('/dashboard/planning/tasks/boards/SKL')
      const nav = await screen.findByRole('group', { name: 'Прокрутка колонок дошки' })
      expect(
        within(nav)
          .getAllByRole('button')
          .map((b) => b.getAttribute('aria-label'))
      ).toEqual(['Нова', 'В роботі', 'Очікує', 'Готово', 'Відхилено'])
    } finally {
      width.mockRestore()
      client.mockRestore()
    }
  })

  it('навигатор: отменённый указатель (прокрутку забрал браузер) повторно не отпускается', async () => {
    const width = vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (
      this: Element
    ) {
      return this.classList.contains('overflow-x-auto') ? 2400 : 0
    })
    const client = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (
      this: Element
    ) {
      return this.classList.contains('overflow-x-auto') ? 1200 : 0
    })
    // jsdom has no pointer capture: the browser's rules — releasing a pointer
    // that holds no capture throws NotFoundError.
    const captured = new Set<number>()
    const proto = HTMLElement.prototype as unknown as Record<string, unknown>
    const release = vi.fn((id: number) => {
      if (!captured.delete(id)) throw new DOMException('No active pointer', 'NotFoundError')
    })
    proto.setPointerCapture = (id: number) => captured.add(id)
    proto.hasPointerCapture = (id: number) => captured.has(id)
    proto.releasePointerCapture = release
    try {
      renderAt('/dashboard/planning/tasks/boards/SKL')
      await screen.findByRole('group', { name: 'Прокрутка колонок дошки' })
      const thumb = document.querySelector('[data-scroll-thumb]') as HTMLElement
      fireEvent.pointerDown(thumb, { pointerId: 1, clientX: 10 })
      captured.delete(1) // the browser took the touch over: its capture is gone
      fireEvent.pointerCancel(thumb, { pointerId: 1 })
      expect(release).not.toHaveBeenCalled()
      // An ordinary release still lets go.
      fireEvent.pointerDown(thumb, { pointerId: 2, clientX: 10 })
      fireEvent.pointerUp(thumb, { pointerId: 2 })
      expect(release).toHaveBeenCalledWith(2)
    } finally {
      delete proto.setPointerCapture
      delete proto.hasPointerCapture
      delete proto.releasePointerCapture
      width.mockRestore()
      client.mockRestore()
    }
  })

  // ─── AC2: filters ───────────────────────────────────────────────────────

  it('фильтры из адреса уходят серверу как есть; активные — чипами; ✕ и «Скинути все» снимают', async () => {
    const router = renderAt('/dashboard/planning/tasks/boards/SKL?label=l-1&overdue=1&q=звіт')
    await waitFor(() =>
      expect(api.getBoardKanban).toHaveBeenCalledWith('SKL', {
        label_id: 'l-1',
        overdue: 'true',
        q: 'звіт',
      })
    )
    const chips = await screen.findByRole('list', { name: 'Активні фільтри' })
    expect(within(chips).getByRole('button', { name: /Мітка: Термінові/ })).toBeInTheDocument()
    expect(within(chips).getByRole('button', { name: /Пошук: «звіт»/ })).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(within(chips).getByRole('button', { name: /Прострочені/ }))
    await waitFor(() =>
      expect(api.getBoardKanban).toHaveBeenLastCalledWith('SKL', { label_id: 'l-1', q: 'звіт' })
    )
    expect(router.state.location.search).not.toContain('overdue')

    await user.click(screen.getByRole('button', { name: 'Скинути все' }))
    await waitFor(() => expect(api.getBoardKanban).toHaveBeenLastCalledWith('SKL', {}))
    expect(screen.queryByRole('list', { name: 'Активні фільтри' })).toBeNull()
  })

  it('«Мої» — assignee_user_id из GET /me; выбор «Виконавець» снимает «Мої»', async () => {
    api.searchPeople.mockResolvedValue({
      items: [
        {
          user_id: 'u-olena',
          crm_user_id: 41,
          full_name: 'Олена Коваль',
          never_logged_in: false,
          departments: [],
        },
      ],
    })
    const router = renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = userEvent.setup()
    const mine = await screen.findByRole('button', { name: 'Мої' })
    await user.click(mine)
    await waitFor(() =>
      expect(api.getBoardKanban).toHaveBeenLastCalledWith('SKL', { assignee_user_id: 'me-uuid' })
    )
    expect(api.getMe).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Мої' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: /Виконавець/, expanded: false }))
    await user.type(screen.getByLabelText('Виконавець'), 'Оле')
    await user.click(await screen.findByRole('button', { name: /Олена Коваль/ }))
    await waitFor(() =>
      expect(api.getBoardKanban).toHaveBeenLastCalledWith('SKL', { assignee_user_id: 'u-olena' })
    )
    expect(router.state.location.search).toContain('assignee=u-olena')
    expect(router.state.location.search).not.toContain('mine')
    const chip = within(screen.getByRole('list', { name: 'Активні фільтри' })).getByRole('button', {
      name: /Виконавець: Олена Коваль/,
    })
    expect(within(chip).getByText('Олена Коваль')).toHaveAttribute('data-openreplay-obscured')
  })

  it('имя выбранного человека живёт с экраном доски: заново открытая ссылка говорит «обрано»', async () => {
    api.searchPeople.mockResolvedValue({
      items: [
        {
          user_id: 'u-olena',
          crm_user_id: 41,
          full_name: 'Олена Коваль',
          never_logged_in: false,
          departments: [],
        },
      ],
    })
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Виконавець/, expanded: false }))
    await user.type(screen.getByLabelText('Виконавець'), 'Оле')
    await user.click(await screen.findByRole('button', { name: /Олена Коваль/ }))
    expect(
      await screen.findByRole('button', { name: /Виконавець: Олена Коваль/ })
    ).toBeInTheDocument()

    // The screen is gone (another page, a sign-out): the name goes with it.
    cleanup()
    renderAt('/dashboard/planning/tasks/boards/SKL?assignee=u-olena')
    expect(await screen.findByRole('button', { name: /Виконавець: обрано/ })).toBeInTheDocument()
    expect(screen.queryByText('Олена Коваль')).toBeNull()
  })

  it('«Мітка» — из меток доски; «Замовник» — через выбор людей (author_user_id)', async () => {
    api.searchPeople.mockResolvedValue({
      items: [
        {
          user_id: 'u-lara',
          crm_user_id: 52,
          full_name: 'Лариса Бондар',
          never_logged_in: false,
          departments: [],
        },
      ],
    })
    const router = renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /^Мітка/ }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Термінові' }))
    await waitFor(() =>
      expect(api.getBoardKanban).toHaveBeenLastCalledWith('SKL', { label_id: 'l-1' })
    )
    // The chosen option is checked, not only drawn bolder (UX-DR46).
    await user.click(screen.getByRole('button', { name: 'Мітка' }))
    expect(await screen.findByRole('menuitemradio', { name: 'Термінові' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByRole('menuitemradio', { name: 'Усі' })).toHaveAttribute(
      'aria-checked',
      'false'
    )
    await user.keyboard('{Escape}')
    // A board without a priority scale or types offers no such menu.
    expect(screen.queryByRole('button', { name: /^Пріоритет/ })).toBeNull()

    await user.click(screen.getByRole('button', { name: /^Замовник/ }))
    await user.type(screen.getByLabelText('Замовник'), 'Лар')
    await user.click(await screen.findByRole('button', { name: /Лариса Бондар/ }))
    await waitFor(() =>
      expect(api.getBoardKanban).toHaveBeenLastCalledWith('SKL', {
        author_user_id: 'u-lara',
        label_id: 'l-1',
      })
    )
    expect(router.state.location.search).toContain('author=u-lara')
    expect(screen.getByRole('button', { name: /Замовник: Лариса Бондар/ })).toBeInTheDocument()
  })

  it('поиск — после паузы в наборе; длиннее 200 символов — ошибка поля, запроса нет', async () => {
    const router = renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = userEvent.setup()
    const search = await screen.findByRole('textbox', { name: 'Пошук' })
    await user.type(search, 'SKL-2')
    await waitFor(() => expect(api.getBoardKanban).toHaveBeenLastCalledWith('SKL', { q: 'SKL-2' }))
    expect(router.state.location.search).toContain('q=SKL-2')

    fireEvent.change(search, { target: { value: 'x'.repeat(201) } })
    expect(await screen.findByText(/^Запит задовгий — не більше 200 символів$/)).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(api.getBoardKanban).not.toHaveBeenCalledWith('SKL', { q: 'x'.repeat(201) })
  })

  it('«Поле…» — поле и значение доски (field_id + field_value), чип с подписью варианта', async () => {
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Поле…/ }))
    expect(screen.getByLabelText('Поле')).toHaveValue('f-1')
    await user.selectOptions(screen.getByLabelText('Значення'), 'o-1')
    await user.click(screen.getByRole('button', { name: 'Застосувати' }))
    await waitFor(() =>
      expect(api.getBoardKanban).toHaveBeenLastCalledWith('SKL', {
        field_id: 'f-1',
        field_value: 'o-1',
      })
    )
    expect(screen.getByRole('button', { name: /Регіон: Київ/ })).toBeInTheDocument()
  })

  it('пустой результат фильтров — «Нічого не знайдено за фільтрами» и «Скинути фільтри»', async () => {
    api.getBoardKanban.mockResolvedValue(kanbanOf([]))
    const router = renderAt('/dashboard/planning/tasks/boards/SKL?overdue=1')
    expect(await screen.findByText('Нічого не знайдено за фільтрами')).toBeInTheDocument()
    expect(screen.queryByText('На дошці ще немає задач')).toBeNull()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Скинути фільтри' }))
    await waitFor(() => expect(router.state.location.search).not.toContain('overdue'))
  })

  it('неправильный фильтр в ссылке (400) — говорит об этом и даёт сбросить', async () => {
    api.getBoardKanban.mockRejectedValue(
      plannerError(400, 'validation', { field: 'assignee_user_id' })
    )
    renderAt('/dashboard/planning/tasks/boards/SKL?assignee=not-a-uuid')
    expect(await screen.findByText('Посилання містить неправильний фільтр')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Скинути фільтри' })).toBeInTheDocument()
  })

  // ─── AC3: moving ────────────────────────────────────────────────────────

  async function openMenu(key: string) {
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: `Дії з задачею ${key}` }))
    return user
  }

  it('«Перемістити в…» — карточка встаёт сразу, одна команда PATCH со status_id и If-Match', async () => {
    let resolvePatch: (value: unknown) => void = () => {}
    api.patchTask.mockImplementation(() => new Promise((resolve) => (resolvePatch = resolve)))
    // After the first answer the kanban is not read again: only the
    // optimistic picture can put the card into «Очікує».
    api.getBoardKanban
      .mockResolvedValueOnce(kanbanOf([FIRST, SECOND]))
      .mockImplementation(() => new Promise(() => {}))
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = await openMenu('SKL-2')
    const moveTo = screen.getByRole('group', { name: 'Перемістити в…' })
    expect(
      within(moveTo)
        .getAllByRole('menuitem')
        .map((i) => i.textContent)
    ).toEqual(['В роботі', 'Очікує', 'Готово', 'Відхилено'])
    await user.click(within(moveTo).getByRole('menuitem', { name: 'Очікує' }))

    const waiting = screen.getByRole('region', { name: 'Очікує' })
    expect(await within(waiting).findByText('SKL-2')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Нова' })).queryByText('SKL-2')).toBeNull()
    expect(api.patchTask).toHaveBeenCalledTimes(1)
    expect(api.patchTask).toHaveBeenCalledWith(FIRST.id, 3, { status_id: 's-wait' })

    await act(async () =>
      resolvePatch({
        task: makeTask({
          status: { id: 's-wait', name: 'Очікує', category: 'in_progress' },
          version: 4,
        }),
        etag: '"4"',
      })
    )
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(toast.success.mock.calls[0][0]).toBe('SKL-2 → «Очікує»')
  })

  it('в «готово» — тост «SKL-2 закрито · Скасувати» 5 с; отмена возвращает статус и место под новой версией', async () => {
    api.patchTask.mockResolvedValueOnce({
      task: makeTask({ status: { id: 's-done', name: 'Готово', category: 'done' }, version: 4 }),
      etag: '"4"',
    })
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = await openMenu('SKL-2')
    await user.click(screen.getByRole('menuitem', { name: 'Готово' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    const [text, options] = toast.success.mock.calls[0]
    expect(text).toBe('SKL-2 закрито')
    expect(options.duration).toBe(5000)
    expect(options.action.label).toBe('Скасувати')

    api.patchTask.mockResolvedValueOnce({ task: makeTask({ version: 5 }), etag: '"5"' })
    await act(async () => options.action.onClick())
    await waitFor(() => expect(api.patchTask).toHaveBeenCalledTimes(2))
    // Back to «Нова», before its old neighbour SKL-4, under version 4.
    expect(api.patchTask).toHaveBeenLastCalledWith(FIRST.id, 4, {
      status_id: 's-todo',
      position: { before_id: SECOND.id },
    })
    // The undo itself says nothing more than aria-live.
    expect(toast.success).toHaveBeenCalledTimes(1)
  })

  it('в статус с «повідомити автора» — тост добавляет «Замовника повідомлено»; итог в aria-live', async () => {
    api.patchTask.mockResolvedValueOnce({
      task: makeTask({
        status: { id: 's-work', name: 'В роботі', category: 'in_progress' },
        version: 4,
      }),
      etag: '"4"',
    })
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = await openMenu('SKL-2')
    await user.click(screen.getByRole('menuitem', { name: 'В роботі' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(toast.success.mock.calls[0][0]).toBe('SKL-2 → «В роботі» · Замовника повідомлено')
    expect(screen.getByRole('status')).toHaveTextContent(
      'SKL-2 → «В роботі» · Замовника повідомлено'
    )
  })

  it('«Змінити порядок» — только position соседом, без тоста; итог объявляется', async () => {
    api.patchTask.mockResolvedValueOnce({ task: makeTask({ version: 4 }), etag: '"4"' })
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = await openMenu('SKL-2')
    const order = screen.getByRole('group', { name: 'Змінити порядок' })
    expect(within(order).getByRole('menuitem', { name: 'Вище' })).toHaveAttribute('data-disabled')
    expect(within(order).getByRole('menuitem', { name: 'На початок колонки' })).toHaveAttribute(
      'data-disabled'
    )
    await user.click(within(order).getByRole('menuitem', { name: 'Нижче' }))
    await waitFor(() =>
      expect(api.patchTask).toHaveBeenCalledWith(FIRST.id, 3, {
        position: { after_id: SECOND.id },
      })
    )
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('SKL-2: порядок у колонці змінено')
    )
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('после «Перемістити в…» с клавиатуры фокус — на карточке в новой колонке', async () => {
    let resolvePatch: (value: unknown) => void = () => {}
    api.patchTask.mockImplementation(() => new Promise((resolve) => (resolvePatch = resolve)))
    api.getBoardKanban
      .mockResolvedValueOnce(kanbanOf([FIRST, SECOND]))
      .mockImplementation(() => new Promise(() => {}))
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = userEvent.setup()
    const card = (await screen.findByText('SKL-2')).closest('article')!
    within(card).getAllByRole('button')[0].focus()
    await user.keyboard('{Shift>}{F10}{/Shift}')
    const moveTo = await screen.findByRole('group', { name: 'Перемістити в…' })
    within(moveTo).getByRole('menuitem', { name: 'Очікує' }).focus()
    await user.keyboard('{Enter}')

    const waiting = screen.getByRole('region', { name: 'Очікує' })
    const moved = (await within(waiting).findByText('SKL-2')).closest('button')!
    await waitFor(() => expect(document.activeElement).toBe(moved))

    // The answer keeps it there; a click elsewhere releases the card.
    await act(async () =>
      resolvePatch({
        task: makeTask({
          status: { id: 's-wait', name: 'Очікує', category: 'in_progress' },
          version: 4,
        }),
        etag: '"4"',
      })
    )
    expect(document.activeElement).toBe(within(waiting).getByText('SKL-2').closest('button'))
  })

  it('после «Змінити порядок → Нижче» фокус остаётся на карточке', async () => {
    api.patchTask.mockResolvedValueOnce({ task: makeTask({ version: 4 }), etag: '"4"' })
    // Only the optimistic picture reorders: the kanban is not answered again.
    api.getBoardKanban
      .mockResolvedValueOnce(kanbanOf([FIRST, SECOND]))
      .mockImplementation(() => new Promise(() => {}))
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = userEvent.setup()
    const card = (await screen.findByText('SKL-2')).closest('article')!
    within(card).getAllByRole('button')[0].focus()
    await user.keyboard('{Shift>}{F10}{/Shift}')
    const order = await screen.findByRole('group', { name: 'Змінити порядок' })
    within(order).getByRole('menuitem', { name: 'Нижче' }).focus()
    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(api.patchTask).toHaveBeenCalledWith(FIRST.id, 3, {
        position: { after_id: SECOND.id },
      })
    )
    const todo = screen.getByRole('region', { name: 'Нова' })
    await waitFor(() =>
      expect(
        within(todo)
          .getAllByRole('article')
          .map((a) => a.getAttribute('data-task-id'))
      ).toEqual([SECOND.id, FIRST.id])
    )
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByText('SKL-2').closest('button'))
    )
  })

  it('фокус после «⋯» держится недолго: поздний перечит, унёсший карточку, фокус не тянет', async () => {
    api.patchTask.mockResolvedValueOnce({ task: makeTask({ version: 4 }), etag: '"4"' })
    let answer: (value: unknown) => void = () => {}
    api.getBoardKanban
      .mockResolvedValueOnce(kanbanOf([FIRST, SECOND]))
      .mockImplementation(() => new Promise((resolve) => (answer = resolve)))
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = userEvent.setup()
    const card = (await screen.findByText('SKL-2')).closest('article')!
    within(card).getAllByRole('button')[0].focus()
    await user.keyboard('{Shift>}{F10}{/Shift}')
    const order = await screen.findByRole('group', { name: 'Змінити порядок' })
    within(order).getByRole('menuitem', { name: 'Нижче' }).focus()
    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByText('SKL-2').closest('button'))
    )
    await waitFor(() => expect(api.getBoardKanban.mock.calls.length).toBeGreaterThan(1))

    // Well after the move, the re-read shows the card moved by someone else.
    await act(() => new Promise((resolve) => setTimeout(resolve, REFOCUS_HOLD_MS + 300)))
    const elsewhere = makeCard({
      ...FIRST,
      version: 5,
      status: { id: 's-wait', name: 'Очікує', category: 'in_progress' },
    })
    await act(async () => answer(kanbanOf([SECOND, elsewhere])))
    const waiting = screen.getByRole('region', { name: 'Очікує' })
    const moved = (await within(waiting).findByText('SKL-2')).closest('button')
    expect(document.activeElement).not.toBe(moved)
  })

  it('пока сервер подтверждает перемещение, следующее не уходит, и об этом сказано', async () => {
    api.patchTask.mockImplementation(() => new Promise(() => {}))
    api.getBoardKanban
      .mockResolvedValueOnce(kanbanOf([FIRST, SECOND]))
      .mockImplementation(() => new Promise(() => {}))
    renderAt('/dashboard/planning/tasks/boards/SKL')
    let user = await openMenu('SKL-2')
    await user.click(screen.getByRole('menuitem', { name: 'Очікує' }))
    await waitFor(() => expect(api.patchTask).toHaveBeenCalledTimes(1))
    user = await openMenu('SKL-4')
    await user.click(screen.getByRole('menuitem', { name: 'В роботі' }))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Зачекайте: попереднє переміщення ще зберігається'
    )
    // Seen, not only heard: the card simply stays, as after a refusal.
    expect(toast.info).toHaveBeenCalledWith('Зачекайте: попереднє переміщення ще зберігається')
    expect(api.patchTask).toHaveBeenCalledTimes(1)
  })

  it('пока доска перечитывается под новые фильтры (на экране прежние колонки), перемещение не теряется молча', async () => {
    api.getBoardKanban
      .mockResolvedValueOnce(kanbanOf([FIRST, SECOND]))
      .mockImplementation(() => new Promise(() => {}))
    renderAt('/dashboard/planning/tasks/boards/SKL')
    await screen.findByText('SKL-2')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Прострочені' }))
    await waitFor(() =>
      expect(api.getBoardKanban).toHaveBeenLastCalledWith('SKL', { overdue: 'true' })
    )
    // The previous columns stand until the answer and look fully interactive.
    await user.click(screen.getByRole('button', { name: 'Дії з задачею SKL-2' }))
    await user.click(screen.getByRole('menuitem', { name: 'Очікує' }))

    const said = 'Дошка оновлюється — задачу не переміщено. Спробуйте ще раз'
    expect(toast.info).toHaveBeenCalledWith(said)
    expect(screen.getByRole('status')).toHaveTextContent(said)
    expect(api.patchTask).not.toHaveBeenCalled()
    expect(within(screen.getByRole('region', { name: 'Нова' })).getByText('SKL-2')).toBeVisible()
  })

  it('«Копіювати посилання» — постоянная ссылка задачи; сбой буфера обмена — свой тост', async () => {
    renderAt('/dashboard/planning/tasks/boards/SKL')
    let user = await openMenu('SKL-2')
    await user.click(screen.getByRole('menuitem', { name: 'Копіювати посилання' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Посилання скопійовано'))
    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/dashboard/planning/t/SKL-2`
    )

    // Outside a secure context there is no clipboard to write to.
    user = await openMenu('SKL-2')
    const write = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'))
    await user.click(screen.getByRole('menuitem', { name: 'Копіювати посилання' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Не вдалося скопіювати посилання'))
    write.mockRestore()
  })

  it('отказ — карточка возвращается, тост с причиной сервера', async () => {
    api.patchTask.mockRejectedValueOnce(
      plannerError(403, 'forbidden', { reason: 'view_as_not_supported' })
    )
    api.getBoardKanban
      .mockResolvedValueOnce(kanbanOf([FIRST, SECOND]))
      .mockImplementation(() => new Promise(() => {}))
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = await openMenu('SKL-2')
    await user.click(screen.getByRole('menuitem', { name: 'Очікує' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Немає прав: режим «Перегляд як» не підтримується')
    )
    // Back without a re-read: the kanban is not answered again.
    expect(within(screen.getByRole('region', { name: 'Нова' })).getByText('SKL-2')).toBeVisible()
    expect(within(screen.getByRole('region', { name: 'Очікує' })).queryByText('SKL-2')).toBeNull()
  })

  it('конфликт версии (412) — тост называет автора свежей версии из журнала задачи', async () => {
    const fresh = makeTask({ version: 9, updated_at: '2026-09-29T10:15:30.123456Z' })
    api.patchTask.mockRejectedValueOnce(plannerError(412, 'revision_mismatch', { current: fresh }))
    api.getTaskHistory.mockResolvedValueOnce({
      truncated: false,
      items: [
        {
          id: 'h-1',
          at: '2026-09-28T08:00:00Z',
          action: 'created',
          actor: { user_id: 'u-1', crm_user_id: 1, full_name: 'Інна Коваль', inactive: false },
          client: 'crm',
          before: null,
          after: {},
        },
        {
          id: 'h-2',
          // Same transaction as the fresh `updated_at`: the same `now()`.
          at: '2026-09-29T10:15:30.123456Z',
          action: 'status_changed',
          actor: { user_id: 'u-2', crm_user_id: 2, full_name: 'Олег Мельник', inactive: false },
          client: 'hub-web',
          before: {},
          after: {},
        },
      ],
    })
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = await openMenu('SKL-2')
    await user.click(screen.getByRole('menuitem', { name: 'Очікує' }))
    await waitFor(() => expect(toast.info).toHaveBeenCalled())
    expect(api.getTaskHistory).toHaveBeenCalledWith(FIRST.id, {
      signal: expect.any(AbortSignal),
    })
    const { container } = render(<>{toast.info.mock.calls[0][0]}</>)
    expect(container).toHaveTextContent('Задачу змінив Олег Мельник. Показано свіжу версію')
    // The name is a person's: masked in session recordings.
    expect(container.querySelector('[data-openreplay-obscured]')).not.toBeNull()
  })

  it('конфликт версии (412) — без строки журнала от человека на свежую версию тост без имени', async () => {
    api.patchTask.mockRejectedValueOnce(
      plannerError(412, 'revision_mismatch', {
        current: makeTask({ version: 9, updated_at: '2026-09-29T10:15:30Z' }),
      })
    )
    api.getTaskHistory.mockResolvedValueOnce({
      truncated: false,
      items: [
        {
          id: 'h-1',
          at: '2026-09-29T10:15:30Z',
          action: 'sla_breached',
          actor: null,
          client: 'system',
          before: null,
          after: {},
        },
      ],
    })
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = await openMenu('SKL-2')
    await user.click(screen.getByRole('menuitem', { name: 'Очікує' }))
    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith('Задачу щойно змінили. Показано свіжу версію.')
    )
  })

  it('конфликт версии (412) — журнал не ответил в срок: запрос прерван, тост без имени', async () => {
    api.patchTask.mockRejectedValueOnce(
      plannerError(412, 'revision_mismatch', {
        current: makeTask({ version: 9, updated_at: '2026-09-29T10:15:30Z' }),
      })
    )
    // A journal that does not answer (unpaged: up to 500 rows / 8 MiB).
    let signal: AbortSignal | undefined
    api.getTaskHistory.mockImplementationOnce(
      (_id: string, options: { signal?: AbortSignal } = {}) => {
        signal = options.signal
        return new Promise(() => {})
      }
    )
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = await openMenu('SKL-2')
    await user.click(screen.getByRole('menuitem', { name: 'Очікує' }))
    await waitFor(() => expect(api.getTaskHistory).toHaveBeenCalledTimes(1))
    await waitFor(
      () => expect(toast.info).toHaveBeenCalledWith('Задачу щойно змінили. Показано свіжу версію.'),
      { timeout: CHANGED_BY_BUDGET_MS + 1500 }
    )
    expect(signal?.aborted).toBe(true)
  })

  it('конфликт версии (412) — повтор против той же свежей версии журнал заново не читает', async () => {
    const fresh = makeTask({ version: 9, updated_at: '2026-09-29T10:15:30Z' })
    api.patchTask.mockRejectedValue(plannerError(412, 'revision_mismatch', { current: fresh }))
    // The kanban is not re-read: the card keeps its old version, a retry meets the same 412.
    api.getBoardKanban
      .mockResolvedValueOnce(kanbanOf([FIRST, SECOND]))
      .mockImplementation(() => new Promise(() => {}))
    api.getTaskHistory.mockResolvedValue({
      truncated: false,
      items: [
        {
          id: 'h-2',
          at: '2026-09-29T10:15:30Z',
          action: 'status_changed',
          actor: { user_id: 'u-2', crm_user_id: 2, full_name: 'Олег Мельник', inactive: false },
          client: 'hub-web',
          before: {},
          after: {},
        },
      ],
    })
    renderAt('/dashboard/planning/tasks/boards/SKL')
    let user = await openMenu('SKL-2')
    await user.click(screen.getByRole('menuitem', { name: 'Очікує' }))
    await waitFor(() => expect(toast.info).toHaveBeenCalledTimes(1))
    user = await openMenu('SKL-2')
    await user.click(screen.getByRole('menuitem', { name: 'Очікує' }))
    await waitFor(() => expect(toast.info).toHaveBeenCalledTimes(2))
    expect(api.patchTask).toHaveBeenCalledTimes(2)
    expect(api.getTaskHistory).toHaveBeenCalledTimes(1)
    const { container } = render(<>{toast.info.mock.calls[1][0]}</>)
    expect(container).toHaveTextContent('Задачу змінив Олег Мельник. Показано свіжу версію')
  })

  it('конфликт версии (412) — возврат и тост о свежей версии; нет места (409) — свой тост', async () => {
    api.patchTask.mockRejectedValueOnce(
      plannerError(412, 'revision_mismatch', { current: makeTask({ version: 9 }) })
    )
    renderAt('/dashboard/planning/tasks/boards/SKL')
    let user = await openMenu('SKL-2')
    await user.click(screen.getByRole('menuitem', { name: 'Очікує' }))
    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith('Задачу щойно змінили. Показано свіжу версію.')
    )

    api.patchTask.mockRejectedValueOnce(
      plannerError(409, 'conflict', { reason: 'position_exhausted' })
    )
    user = await openMenu('SKL-2')
    await user.click(screen.getByRole('menuitem', { name: 'Нижче' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Не вдалося поставити задачу на це місце. Спробуйте інше місце'
      )
    )
  })

  it('статус «потребує причини» — сначала причина, затем PATCH с reason', async () => {
    api.patchTask.mockResolvedValueOnce({
      task: makeTask({ status: { id: 's-rej', name: 'Відхилено', category: 'done' }, version: 4 }),
      etag: '"4"',
    })
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = await openMenu('SKL-2')
    await user.click(screen.getByRole('menuitem', { name: 'Відхилено' }))
    expect(api.patchTask).not.toHaveBeenCalled()
    await user.type(await screen.findByLabelText('Причина*'), 'дубль')
    await user.click(screen.getByRole('button', { name: 'Змінити статус' }))
    await waitFor(() =>
      expect(api.patchTask).toHaveBeenCalledWith(FIRST.id, 3, {
        status_id: 's-rej',
        reason: 'дубль',
      })
    )
  })

  it('без права смены статуса — ни ручки, ни «Перемістити в…»; без reorder — ни «Змінити порядок»', async () => {
    api.getBoardKanban.mockResolvedValue(
      kanbanOf([
        makeCard({ allowed_actions: ['edit'] }),
        { ...SECOND, allowed_actions: ['reorder'] },
      ])
    )
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const first = (await screen.findByText('SKL-2')).closest('article')!
    expect(first.querySelector('[data-drag-handle]')).toBeNull()
    expect(first).not.toHaveAttribute('draggable', 'true')
    const second = screen.getByText('SKL-4').closest('article')!
    expect(second.querySelector('[data-drag-handle]')).not.toBeNull()

    let user = await openMenu('SKL-2')
    expect(screen.queryByRole('group', { name: 'Перемістити в…' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Змінити порядок' })).toBeNull()
    expect(screen.getByRole('menuitem', { name: 'Відкрити' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    user = await openMenu('SKL-4')
    expect(screen.queryByRole('group', { name: 'Перемістити в…' })).toBeNull()
    expect(screen.getByRole('group', { name: 'Змінити порядок' })).toBeInTheDocument()
  })

  it('карточка — одна Tab-остановка: Enter открывает, стрелки — её элементы, Shift+F10 — меню', async () => {
    api.getBoardKanban.mockResolvedValue(
      kanbanOf([makeCard({ assignees: [{ ...FIRST.assignees[0], inactive: true }] })])
    )
    const router = renderAt('/dashboard/planning/tasks/boards/SKL')
    const card = (await screen.findByText('SKL-2')).closest('article')!
    const open = within(card).getAllByRole('button')[0]
    expect(open).toHaveTextContent('Перевірити залишки')
    expect(open).not.toHaveAttribute('tabindex')
    for (const other of Array.from(card.querySelectorAll('button, a[href], [tabindex]'))) {
      if (other !== open) expect(other).toHaveAttribute('tabindex', '-1')
    }
    expect(card).toHaveAccessibleName('SKL-2 Перевірити залишки')

    const user = userEvent.setup()
    act(() => open.focus())
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toHaveAccessibleName('Дії з задачею SKL-2')
    await user.keyboard('{End}')
    // The avatar: its state opens for a keyboard user too.
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Олена Коваль · неактивний')
    await user.keyboard('{Home}')
    expect(document.activeElement).toBe(open)

    await user.keyboard('{Shift>}{F10}{/Shift}')
    expect(await screen.findByRole('menuitem', { name: 'Відкрити' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())

    act(() => open.focus())
    await user.keyboard('{Enter}')
    expect(router.state.location.search).toContain('task=SKL-2')
  })

  it('клавиша меню открывает ⋯ и гасит следующее за ней меню браузера; правый клик мыши не трогает', async () => {
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const card = (await screen.findByText('SKL-2')).closest('article')!
    const open = within(card).getAllByRole('button')[0]
    // A right click with no menu key before it: the browser's menu stays.
    expect(fireEvent.contextMenu(open)).toBe(true)

    act(() => open.focus())
    fireEvent.keyDown(open, { key: 'ContextMenu' })
    expect(await screen.findByRole('menuitem', { name: 'Відкрити' })).toBeInTheDocument()
    // On Windows the browser's own `contextmenu` arrives after keyup, into the open menu.
    expect(fireEvent.contextMenu(screen.getByRole('menu'))).toBe(false)
  })

  // ─── AC3: drag and drop (native HTML5 events, as a browser sends them) ───

  describe('перетаскивание', () => {
    // jsdom has no DragEvent / DataTransfer and no elementsFromPoint: the
    // library's own testing guide polyfills them for unit tests.
    class TestDataTransfer {
      types: string[] = []
      private data: Record<string, string> = {}
      dropEffect = 'none'
      effectAllowed = 'all'
      items = []
      files = []
      setData(key: string, value: string) {
        this.types.push(key)
        this.data[key] = value
      }
      getData(key: string) {
        return this.data[key] ?? ''
      }
      clearData() {}
      setDragImage() {}
    }
    const realDragEvent = globalThis.DragEvent
    const realElementsFromPoint = document.elementsFromPoint
    beforeAll(() => {
      globalThis.DragEvent = class extends MouseEvent {
        dataTransfer: unknown
        constructor(type: string, init: MouseEventInit & { dataTransfer?: unknown } = {}) {
          super(type, init)
          this.dataTransfer = init.dataTransfer ?? null
        }
      } as unknown as typeof DragEvent
      document.elementsFromPoint = () => []
    })
    afterAll(() => {
      globalThis.DragEvent = realDragEvent
      document.elementsFromPoint = realElementsFromPoint
    })

    const frame = () => new Promise((resolve) => setTimeout(resolve, 30))

    async function drag(card: HTMLElement, over: HTMLElement) {
      const dataTransfer = new TestDataTransfer()
      fireEvent.dragStart(card, { dataTransfer })
      await act(frame)
      fireEvent.dragEnter(over, { dataTransfer })
      fireEvent.dragOver(over, { dataTransfer })
      await act(frame)
      return () => {
        fireEvent.drop(over, { dataTransfer })
      }
    }

    it('в другую колонку — карточка встаёт сразу, PATCH со status_id; пустые колонки зовут «Перетягніть сюди»', async () => {
      let resolvePatch: (value: unknown) => void = () => {}
      api.patchTask.mockImplementation(() => new Promise((resolve) => (resolvePatch = resolve)))
      api.getBoardKanban
        .mockResolvedValueOnce(kanbanOf([FIRST, SECOND]))
        .mockImplementation(() => new Promise(() => {}))
      renderAt('/dashboard/planning/tasks/boards/SKL')
      const card = (await screen.findByText('SKL-2')).closest('article')!
      const waiting = screen.getByRole('region', { name: 'Очікує' })
      const area = waiting.querySelector('[data-column-drop]') as HTMLElement
      const drop = await drag(card, area)
      expect(card).toHaveClass('opacity-40')
      expect(within(waiting).getByText('Перетягніть сюди')).toBeInTheDocument()
      await act(async () => drop())

      expect(await within(waiting).findByText('SKL-2')).toBeInTheDocument()
      expect(api.patchTask).toHaveBeenCalledWith(FIRST.id, 3, { status_id: 's-wait' })
      await act(async () =>
        resolvePatch({
          task: makeTask({
            status: { id: 's-wait', name: 'Очікує', category: 'in_progress' },
            version: 4,
          }),
          etag: '"4"',
        })
      )
      await waitFor(() => expect(toast.success).toHaveBeenCalled())
    })

    it('внутри колонки на карточку — только position соседом (линия вставки на её краю)', async () => {
      api.patchTask.mockResolvedValue({ task: makeTask({ version: 4 }), etag: '"4"' })
      renderAt('/dashboard/planning/tasks/boards/SKL')
      const second = (await screen.findByText('SKL-4')).closest('article')!
      const first = screen.getByText('SKL-2').closest('article')!
      const drop = await drag(second, first)
      expect(first.querySelector('[data-drop-indicator]')).not.toBeNull()
      await act(async () => drop())
      await waitFor(() =>
        expect(api.patchTask).toHaveBeenCalledWith(SECOND.id, 3, {
          position: { before_id: FIRST.id },
        })
      )
    })

    it('отпустить карточку на ней самой — ничего: ни команды, ни подсветки колонки', async () => {
      api.getBoardKanban.mockResolvedValue(
        kanbanOf([FIRST, SECOND, makeCard({ id: THIRD_ID, key: 'SKL-5', number: 5 })])
      )
      renderAt('/dashboard/planning/tasks/boards/SKL')
      const card = (await screen.findByText('SKL-2')).closest('article')!
      const area = screen
        .getByRole('region', { name: 'Нова' })
        .querySelector('[data-column-drop]') as HTMLElement
      const drop = await drag(card, card)
      // No insertion line on the card itself, the column does not call it.
      expect(card.querySelector('[data-drop-indicator]')).toBeNull()
      expect(area).not.toHaveClass('bg-secondary-600/10')
      await act(async () => drop())
      await act(frame)
      expect(api.patchTask).not.toHaveBeenCalled()
    })

    it('в щели между карточками — место у последней карточки под курсором, не конец колонки', async () => {
      api.patchTask.mockResolvedValue({ task: makeTask({ version: 4 }), etag: '"4"' })
      api.getBoardKanban.mockResolvedValue(
        kanbanOf([FIRST, SECOND, makeCard({ id: THIRD_ID, key: 'SKL-5', number: 5 })])
      )
      renderAt('/dashboard/planning/tasks/boards/SKL')
      const card = (await screen.findByText('SKL-2')).closest('article')!
      const third = screen.getByText('SKL-5').closest('article')!
      const area = screen
        .getByRole('region', { name: 'Нова' })
        .querySelector('[data-column-drop]') as HTMLElement
      const dataTransfer = new TestDataTransfer()
      fireEvent.dragStart(card, { dataTransfer })
      await act(frame)
      // Over SKL-5 (its upper edge), then out into the 8 px gap: the column area.
      fireEvent.dragEnter(third, { dataTransfer })
      fireEvent.dragOver(third, { dataTransfer })
      await act(frame)
      fireEvent.dragEnter(area, { dataTransfer })
      fireEvent.dragOver(area, { dataTransfer })
      await act(frame)
      expect(third.querySelector('[data-drop-indicator="top"]')).not.toBeNull()
      await act(async () => {
        fireEvent.drop(area, { dataTransfer })
      })
      await waitFor(() =>
        expect(api.patchTask).toHaveBeenCalledWith(FIRST.id, 3, {
          position: { before_id: THIRD_ID },
        })
      )
    })

    it('пока доска перечитывается под новые фильтры, бросок не теряется молча', async () => {
      api.getBoardKanban
        .mockResolvedValueOnce(kanbanOf([FIRST, SECOND]))
        .mockImplementation(() => new Promise(() => {}))
      renderAt('/dashboard/planning/tasks/boards/SKL')
      await screen.findByText('SKL-2')
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: 'Прострочені' }))
      await waitFor(() =>
        expect(api.getBoardKanban).toHaveBeenLastCalledWith('SKL', { overdue: 'true' })
      )
      const card = screen.getByText('SKL-2').closest('article')!
      const area = screen
        .getByRole('region', { name: 'Очікує' })
        .querySelector('[data-column-drop]') as HTMLElement
      const drop = await drag(card, area)
      await act(async () => drop())
      await act(frame)
      expect(toast.info).toHaveBeenCalledWith(
        'Дошка оновлюється — задачу не переміщено. Спробуйте ще раз'
      )
      expect(api.patchTask).not.toHaveBeenCalled()
    })

    it('карточка только с reorder: чужие пустые колонки её не зовут «Перетягніть сюди»', async () => {
      api.getBoardKanban.mockResolvedValue(
        kanbanOf([FIRST, { ...SECOND, allowed_actions: ['reorder'] }])
      )
      renderAt('/dashboard/planning/tasks/boards/SKL')
      const card = (await screen.findByText('SKL-4')).closest('article')!
      const waiting = screen.getByRole('region', { name: 'Очікує' })
      const area = waiting.querySelector('[data-column-drop]') as HTMLElement
      const drop = await drag(card, area)
      expect(within(waiting).queryByText('Перетягніть сюди')).toBeNull()
      expect(within(waiting).getByText('Немає задач')).toBeInTheDocument()
      await act(async () => drop())
      await act(frame)
      expect(api.patchTask).not.toHaveBeenCalled()
    })

    it('карточка без прав не тянется: нет draggable, нет команды', async () => {
      api.getBoardKanban.mockResolvedValue(
        kanbanOf([makeCard({ allowed_actions: ['edit'] }), SECOND])
      )
      renderAt('/dashboard/planning/tasks/boards/SKL')
      const card = (await screen.findByText('SKL-2')).closest('article')!
      expect(card).not.toHaveAttribute('draggable', 'true')
      const area = screen
        .getByRole('region', { name: 'Очікує' })
        .querySelector('[data-column-drop]') as HTMLElement
      const drop = await drag(card, area)
      await act(async () => drop())
      await act(frame)
      expect(api.patchTask).not.toHaveBeenCalled()
    })
  })

  // ─── AC4: narrow window ─────────────────────────────────────────────────

  describe('ширина меньше 1024 px', () => {
    const matchMedia = window.matchMedia
    beforeEach(() => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })) as unknown as typeof window.matchMedia
    })
    afterEach(() => {
      window.matchMedia = matchMedia
    })

    it('по умолчанию вид «список» (те же фильтры); переключатель возвращает канбан', async () => {
      const router = renderAt('/dashboard/planning/tasks/boards/SKL?overdue=1')
      expect(await screen.findByText('Перевірити залишки')).toBeInTheDocument()
      expect(api.listBoardTasks).toHaveBeenCalledWith('SKL', { overdue: 'true' })
      expect(screen.queryByRole('region', { name: 'Нова' })).toBeNull()
      expect(api.getBoardKanban).not.toHaveBeenCalled()
      const views = screen.getByRole('group', { name: 'Вигляд дошки' })
      expect(within(views).getByRole('button', { name: 'Список' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )

      const user = userEvent.setup()
      await user.click(within(views).getByRole('button', { name: 'Дошка' }))
      expect(router.state.location.search).toContain('view=board')
      expect(await screen.findByRole('region', { name: 'Нова' })).toBeInTheDocument()
      expect(api.getBoardKanban).toHaveBeenCalledWith('SKL', { overdue: 'true' })
    })
  })
})
