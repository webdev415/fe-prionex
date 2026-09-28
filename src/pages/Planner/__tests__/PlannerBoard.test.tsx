/**
 * Board, task creation and status change in the CRM (planner story 1.10).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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
  listBoards: vi.fn(),
  listMyTasks: vi.fn(),
  resolveTask: vi.fn(),
  getBoard: vi.fn(),
  listBoardTasks: vi.fn(),
  createTask: vi.fn(),
  patchTask: vi.fn(),
  searchPeople: vi.fn(),
}))
vi.mock('@/api/planner/plannerApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/planner/plannerApi')>()
  return { ...actual, ...api }
})

import { plannerRoute } from '@/routes/plannerRoutes'
import { makeBoard, makeCard, makeMeta, makeTask } from './plannerFixtures'

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

const SECOND = makeCard({
  id: '0190a0a0-0000-7000-8000-000000000003',
  key: 'SKL-3',
  number: 3,
  title: 'Замовити коробки',
  status: { id: 's-work', name: 'В роботі', category: 'in_progress' },
  assignees: [],
  due_date: null,
  due_deadline_at: null,
  due_state: 'none',
  allowed_actions: [],
})

describe('Доска, создание задачи и смена статуса (1.10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getMeta.mockResolvedValue(makeMeta())
    api.listBoards.mockResolvedValue({ items: [] })
    api.listMyTasks.mockResolvedValue({ items: [makeCard()], has_more: false })
    api.getBoard.mockResolvedValue(makeBoard())
    api.listBoardTasks.mockResolvedValue({ items: [makeCard(), SECOND], has_more: false })
    api.searchPeople.mockResolvedValue({ items: [] })
  })

  it('колонки-статусы в порядке конфигурации, карточки с номером, названием, исполнителем и сроком', async () => {
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const columns = await screen.findAllByRole('region')
    const names = columns
      .map((c) => c.getAttribute('aria-label'))
      .filter((n): n is string => Boolean(n))
    expect(names).toEqual(['Нова', 'В роботі', 'Готово', 'Відхилено'])

    const todo = screen.getByRole('region', { name: 'Нова' })
    expect(await within(todo).findByText('SKL-2')).toBeInTheDocument()
    expect(within(todo).getByText('Перевірити залишки')).toBeInTheDocument()
    expect(within(todo).getByText('Олена Коваль')).toBeInTheDocument()
    expect(within(todo).getByText('02.10.2026')).toBeInTheDocument()

    const work = screen.getByRole('region', { name: 'В роботі' })
    expect(within(work).getByText('SKL-3')).toBeInTheDocument()
    expect(within(work).getByText('Без виконавця')).toBeInTheDocument()
  })

  it('«Створити» дважды подряд — одна задача, один Idempotency-Key, тост «Створено SKL-4 · Відкрити»', async () => {
    let resolveCreate: (task: unknown) => void = () => {}
    api.createTask.mockImplementation(() => new Promise((resolve) => (resolveCreate = resolve)))
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '+ Задача' }))
    await user.type(screen.getByLabelText('Назва'), 'Нова поставка')
    await user.type(screen.getByLabelText('Опис'), 'Прийняти палети')

    const submit = screen.getByRole('button', { name: 'Створити' })
    await user.dblClick(submit)
    resolveCreate(makeTask({ key: 'SKL-4', title: 'Нова поставка' }))

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
    expect(api.createTask).toHaveBeenCalledTimes(1)
    const [code, body, key] = api.createTask.mock.calls[0]
    expect(code).toBe('SKL')
    expect(body).toMatchObject({
      title: 'Нова поставка',
      description: 'Прийняти палети',
      assignee_ids: [],
      due_date: null,
    })
    expect(key).toMatch(/^[0-9a-f-]{36}$/)
    const [text, options] = toast.success.mock.calls[0]
    expect(text).toBe('Створено SKL-4')
    expect(options.action.label).toBe('Відкрити')
  })

  it('исполнители — из GET /people (от двух букв), срок — дата; в теле их user_id и due_date', async () => {
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
    api.createTask.mockResolvedValue(makeTask({ key: 'SKL-5' }))
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '+ Задача' }))
    await user.type(screen.getByLabelText('Назва'), 'Інвентаризація')
    await user.type(screen.getByLabelText('Виконавці'), 'Оле')
    await user.click(await screen.findByRole('button', { name: /Олена Коваль/ }))
    expect(api.searchPeople).toHaveBeenCalledWith('Оле')
    expect(screen.getByText('1 / 10')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Термін'), '2026-10-05')
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    await waitFor(() => expect(api.createTask).toHaveBeenCalledTimes(1))
    expect(api.createTask.mock.calls[0][1]).toMatchObject({
      title: 'Інвентаризація',
      assignee_ids: ['u-olena'],
      due_date: '2026-10-05',
      description: null,
    })
  })

  it('без create_task в allowed_actions доски кнопки «+ Задача» нет', async () => {
    api.getBoard.mockResolvedValue(makeBoard({ allowed_actions: [] }))
    renderAt('/dashboard/planning/tasks/boards/SKL')
    expect(await screen.findByRole('region', { name: 'Нова' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Задача' })).not.toBeInTheDocument()
  })

  it('чип статуса шлёт PATCH с версией (If-Match); без change_status — чипа-кнопки нет', async () => {
    api.patchTask.mockResolvedValue({ task: makeTask(), etag: '"4"' })
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Змінити статус: Нова' }))
    const items = await screen.findAllByRole('menuitem')
    expect(items.map((i) => i.textContent)).toEqual(['Нова', 'В роботі', 'Готово', 'Відхилено'])
    await user.click(screen.getByRole('menuitem', { name: 'В роботі' }))
    await waitFor(() =>
      expect(api.patchTask).toHaveBeenCalledWith('0190a0a0-0000-7000-8000-000000000002', 3, {
        status_id: 's-work',
      })
    )
    // SKL-3 has no change_status: plain text, not a control.
    expect(screen.queryByRole('button', { name: 'Змінити статус: В роботі' })).toBeNull()
  })

  it('412 — тост о свежей версии и перечитывание; 403 — «Немає прав: …» по причине сервера', async () => {
    api.patchTask.mockRejectedValueOnce(
      plannerError(412, 'revision_mismatch', { current: makeTask({ version: 5 }) })
    )
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Змінити статус: Нова' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Готово' }))
    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith('Задачу щойно змінили. Показано свіжу версію.')
    )
    await waitFor(() => expect(api.listBoardTasks.mock.calls.length).toBeGreaterThan(1))

    api.patchTask.mockRejectedValueOnce(
      plannerError(403, 'forbidden', { reason: 'view_as_not_supported' })
    )
    await user.click(await screen.findByRole('button', { name: 'Змінити статус: Нова' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Готово' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Немає прав: режим «Перегляд як» не підтримується')
    )
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining('server text'))
  })

  it('статус «потребує причини» сначала спрашивает причину', async () => {
    api.patchTask.mockResolvedValue({ task: makeTask(), etag: '"4"' })
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Змінити статус: Нова' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Відхилено' }))
    expect(api.patchTask).not.toHaveBeenCalled()
    await user.type(await screen.findByLabelText('Причина*'), 'дубль SKL-1')
    await user.click(screen.getByRole('button', { name: 'Змінити статус' }))
    await waitFor(() =>
      expect(api.patchTask).toHaveBeenCalledWith('0190a0a0-0000-7000-8000-000000000002', 3, {
        status_id: 's-rej',
        reason: 'дубль SKL-1',
      })
    )
  })

  it('?task=SKL-2 открывает панель задачи; невидимая задача — «Задачу не знайдено…»', async () => {
    api.resolveTask.mockResolvedValueOnce(makeTask())
    renderAt('/dashboard/planning/tasks?task=SKL-2')
    const panel = await screen.findByRole('complementary', { name: 'Задача SKL-2' })
    expect(await within(panel).findByText('Звірити склад із таблицею')).toBeInTheDocument()
    expect(within(panel).getByText('Олена Коваль')).toBeInTheDocument()
    expect(within(panel).getByText('02.10.2026')).toBeInTheDocument()
  })

  it('невидимая или несуществующая задача — одна и та же фраза', async () => {
    api.resolveTask.mockRejectedValue(plannerError(404, 'not_found'))
    renderAt('/dashboard/planning/tasks?task=SKL-99')
    expect(
      await screen.findByText('Задачу не знайдено або у вас немає до неї доступу')
    ).toBeInTheDocument()
  })

  it('«Мої задачі» — список «Поставлені мені» из GET /me/tasks?list=assigned', async () => {
    renderAt('/dashboard/planning/tasks')
    expect(await screen.findByText('Перевірити залишки')).toBeInTheDocument()
    expect(api.listMyTasks).toHaveBeenCalled()
  })
})
