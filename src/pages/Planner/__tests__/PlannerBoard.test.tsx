/**
 * Board, task creation and status change in the CRM (planner story 1.10).
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
import { plannerKeys } from '@/api/planner/plannerQueries'
import { makeBoard, makeCard, makeMeta, makeTask } from './plannerFixtures'

// The section is lazy-loaded. On a loaded CI runner the first render spent more
// than the 5 s query timeout on transforming the chunk and the test saw only the
// loading fallback. The chunk is imported once here, so every test renders the
// page itself.
beforeAll(async () => {
  await import('@/pages/Planner')
}, 120_000)

/** The client of the last `renderAt`, for tests that drive a query directly. */
let currentClient: QueryClient

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  currentClient = queryClient
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
      due_date: null,
    })
    // Nobody picked: no key, so the board's default assignee applies.
    expect(body).not.toHaveProperty('assignee_ids')
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
    const body = api.createTask.mock.calls[0][1]
    expect(body).toMatchObject({
      title: 'Інвентаризація',
      assignee_ids: ['u-olena'],
      due_date: '2026-10-05',
    })
    // No description typed: no key, so the board's description template applies.
    expect(body).not.toHaveProperty('description')
  })

  it('нетронутые описание и исполнители — ключей нет в теле (дефолты доски работают)', async () => {
    api.createTask.mockResolvedValue(makeTask({ key: 'SKL-6' }))
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '+ Задача' }))
    await user.type(screen.getByLabelText('Назва'), 'Порожня')
    // Whitespace only is «nothing typed», not an empty description.
    await user.type(screen.getByLabelText('Опис'), '   ')
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    await waitFor(() => expect(api.createTask).toHaveBeenCalledTimes(1))
    const body = api.createTask.mock.calls[0][1]
    expect(Object.keys(body).sort()).toEqual(['due_date', 'title'])
  })

  it('поиск людей — после паузы в наборе, а не на каждую букву', async () => {
    api.searchPeople.mockResolvedValue({ items: [] })
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '+ Задача' }))
    await user.type(screen.getByLabelText('Виконавці'), 'Олена')
    expect(await screen.findByText('Нікого не знайдено')).toBeInTheDocument()
    expect(api.searchPeople).toHaveBeenCalledTimes(1)
    expect(api.searchPeople).toHaveBeenCalledWith('Олена')
  })

  it('описание длиннее 20 000 — ошибка у поля, вставка не обрезается, запроса нет', async () => {
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '+ Задача' }))
    await user.type(screen.getByLabelText('Назва'), 'Довгий опис')
    const description = screen.getByLabelText('Опис') as HTMLTextAreaElement
    // jsdom does not apply `maxlength` to a programmatic change, so the value
    // alone proves nothing: the attribute itself must be absent (a browser
    // would cut the paste).
    expect(description).not.toHaveAttribute('maxlength')
    expect(screen.getByLabelText('Назва')).not.toHaveAttribute('maxlength')
    fireEvent.change(description, { target: { value: 'x'.repeat(20_001) } })
    expect(description.value).toHaveLength(20_001)
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    expect(await screen.findByText(/^Опис — не довше 20\s000 символів$/)).toBeInTheDocument()
    expect(api.createTask).not.toHaveBeenCalled()
  })

  it('длина — в символах Unicode, как руны планера: 300 эмодзи проходят, 301 — ошибка', async () => {
    api.createTask.mockResolvedValue(makeTask({ key: 'SKL-9' }))
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '+ Задача' }))
    const title = screen.getByLabelText('Назва')
    // 301 code points, 602 UTF-16 units: over the limit by one character.
    fireEvent.change(title, { target: { value: '😀'.repeat(301) } })
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    expect(await screen.findByText(/^Назва — не довше 300 символів$/)).toBeInTheDocument()
    expect(api.createTask).not.toHaveBeenCalled()

    // 300 emoji is 600 in `String.length`, but exactly the limit for the planner.
    fireEvent.change(title, { target: { value: '😀'.repeat(300) } })
    fireEvent.change(screen.getByLabelText('Опис'), { target: { value: '😀'.repeat(20_000) } })
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    await waitFor(() => expect(api.createTask).toHaveBeenCalledTimes(1))
    expect(api.createTask.mock.calls[0][1].title).toBe('😀'.repeat(300))
  })

  it('409 idempotency_key_reused — «задачу, можливо, вже створено» и список доски перечитан', async () => {
    api.createTask.mockRejectedValueOnce(
      plannerError(409, 'conflict', { reason: 'idempotency_key_reused' })
    )
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '+ Задача' }))
    await user.type(screen.getByLabelText('Назва'), 'Повтор')
    const before = api.listBoardTasks.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith(
        'Задачу, можливо, вже створено. Список дошки оновлено'
      )
    )
    await waitFor(() => expect(api.listBoardTasks.mock.calls.length).toBeGreaterThan(before))
    expect(toast.error).not.toHaveBeenCalled()
    // The key is spent: the dialog closes instead of offering a «Створити»
    // that would get the same 409 again.
    await waitFor(() => expect(screen.queryByLabelText('Назва')).toBeNull())

    // Any other 409 is a plain conflict, not «could not save»; the form stays.
    api.createTask.mockRejectedValueOnce(
      plannerError(409, 'conflict', { reason: 'board_archived' })
    )
    await user.click(screen.getByRole('button', { name: '+ Задача' }))
    await user.type(screen.getByLabelText('Назва'), 'Повтор')
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Хтось змінив це одночасно з вами. Оновіть і повторіть'
      )
    )
    expect(screen.getByLabelText('Назва')).toBeInTheDocument()
    // A new form, a new key.
    expect(api.createTask.mock.calls[1][2]).not.toBe(api.createTask.mock.calls[0][2])
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

  it('причина длиннее 1000 символов — ошибка в диалоге, не обрезка; 1000 эмодзи проходят', async () => {
    api.patchTask.mockResolvedValue({ task: makeTask(), etag: '"4"' })
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Змінити статус: Нова' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Відхилено' }))
    const reason = (await screen.findByLabelText('Причина*')) as HTMLTextAreaElement
    expect(reason).not.toHaveAttribute('maxlength')
    fireEvent.change(reason, { target: { value: '😀'.repeat(1001) } })
    expect(reason.value).toBe('😀'.repeat(1001))
    await user.click(screen.getByRole('button', { name: 'Змінити статус' }))
    expect(await screen.findByText(/^Причина — не довше 1\s000 символів$/)).toBeInTheDocument()
    expect(api.patchTask).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Причина*')).toBeInTheDocument()

    fireEvent.change(reason, { target: { value: '😀'.repeat(1000) } })
    await user.click(screen.getByRole('button', { name: 'Змінити статус' }))
    await waitFor(() =>
      expect(api.patchTask).toHaveBeenCalledWith('0190a0a0-0000-7000-8000-000000000002', 3, {
        status_id: 's-rej',
        reason: '😀'.repeat(1000),
      })
    )
  })

  it('чип: доска была, её повторное чтение упало — старые статусы и тихий «Повторити», без ошибки', async () => {
    renderAt('/dashboard/planning/tasks')
    const chip = await screen.findByRole('button', { name: 'Змінити статус: Нова' })
    await waitFor(() => expect(api.getBoard).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(currentClient.getQueryData(plannerKeys.board('SKL'))).toBeDefined())
    api.getBoard.mockRejectedValue(plannerError(503, 'unavailable'))
    await act(async () => {
      await currentClient.refetchQueries({ queryKey: plannerKeys.board('SKL') })
    })
    expect(currentClient.getQueryState(plannerKeys.board('SKL'))?.status).toBe('error')

    const user = userEvent.setup()
    await user.click(chip)
    expect(await screen.findByRole('menuitem', { name: 'В роботі' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Не вдалося завантажити статуси' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Завантаження статусів…' })).toBeNull()
    const calls = api.getBoard.mock.calls.length
    api.getBoard.mockResolvedValue(makeBoard())
    await user.click(screen.getByRole('menuitem', { name: 'Повторити' }))
    await waitFor(() => expect(api.getBoard.mock.calls.length).toBe(calls + 1))
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'Повторити' })).toBeNull())
    expect(screen.getByRole('menuitem', { name: 'В роботі' })).toBeInTheDocument()
  })

  it('чип на «Мої задачі»: доска грузится заранее; пока грузится и при ошибке меню это говорит', async () => {
    let resolveBoard: (board: unknown) => void = () => {}
    api.getBoard.mockImplementationOnce(() => new Promise((resolve) => (resolveBoard = resolve)))
    renderAt('/dashboard/planning/tasks')
    const chip = await screen.findByRole('button', { name: 'Змінити статус: Нова' })
    // Loaded before any click: the first click never meets an empty menu.
    await waitFor(() => expect(api.getBoard).toHaveBeenCalledWith('SKL'))
    const user = userEvent.setup()
    await user.click(chip)
    expect(
      await screen.findByRole('menuitem', { name: 'Завантаження статусів…' })
    ).toBeInTheDocument()
    resolveBoard(makeBoard())
    expect(await screen.findByRole('menuitem', { name: 'В роботі' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Завантаження статусів…' })).toBeNull()
  })

  it('чип: GET /boards/{code} упал — меню говорит об ошибке и даёт повторить', async () => {
    // Down for the preload AND for the retry that opening the menu makes.
    api.getBoard.mockRejectedValue(plannerError(503, 'unavailable'))
    renderAt('/dashboard/planning/tasks')
    const user = userEvent.setup()
    await waitFor(() => expect(api.getBoard).toHaveBeenCalledTimes(1))
    await user.click(await screen.findByRole('button', { name: 'Змінити статус: Нова' }))
    expect(
      await screen.findByRole('menuitem', { name: 'Не вдалося завантажити статуси' })
    ).toBeInTheDocument()
    expect(api.getBoard).toHaveBeenCalledTimes(2)
    api.getBoard.mockResolvedValue(makeBoard())
    await user.click(screen.getByRole('menuitem', { name: 'Повторити' }))
    expect(await screen.findByRole('menuitem', { name: 'Готово' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Не вдалося завантажити статуси' })).toBeNull()
  })

  it('имена исполнителей замаскированы для записи сессии (карточка, «Мої задачі», панель)', async () => {
    api.resolveTask.mockResolvedValue(makeTask())
    renderAt('/dashboard/planning/tasks?task=SKL-2')
    const panel = await screen.findByRole('complementary', { name: 'Задача SKL-2' })
    const inPanel = await within(panel).findByText('Олена Коваль')
    expect(inPanel).toHaveAttribute('data-openreplay-obscured')
    const rows = await screen.findAllByText('Олена Коваль')
    for (const row of rows) expect(row).toHaveAttribute('data-openreplay-obscured')
    expect(rows.length).toBeGreaterThan(1)
  })

  it('срок-момент показан в поясе доски (tzid), а не браузера', async () => {
    api.getBoard.mockResolvedValue(makeBoard({ tzid: 'Asia/Tokyo' }))
    api.resolveTask.mockResolvedValue(makeTask({ due_date: null, due_at: '2026-10-02T15:30:00Z' }))
    renderAt('/dashboard/planning/tasks?task=SKL-2')
    const panel = await screen.findByRole('complementary', { name: 'Задача SKL-2' })
    // 15:30 UTC is 00:30 of the next day in Tokyo (UTC+9); the test run is UTC.
    expect(await within(panel).findByText(/03\.10\.2026.*00:30/)).toBeInTheDocument()
  })

  it('Esc в диалоге причины закрывает диалог, а не панель под ним', async () => {
    api.resolveTask.mockResolvedValue(makeTask())
    renderAt('/dashboard/planning/tasks?task=SKL-2')
    const panel = await screen.findByRole('complementary', { name: 'Задача SKL-2' })
    await within(panel).findByText('Звірити склад із таблицею')
    const user = userEvent.setup()
    await user.click(within(panel).getByRole('button', { name: 'Змінити статус: Нова' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Відхилено' }))
    const reason = await screen.findByLabelText('Причина*')
    await user.click(reason)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByLabelText('Причина*')).toBeNull())
    expect(screen.getByRole('complementary', { name: 'Задача SKL-2' })).toBeInTheDocument()
    // With nothing above it, Esc closes the panel.
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('complementary', { name: 'Задача SKL-2' })).toBeNull()
    )
  })

  it('панель: 503 — «Планер тимчасово недоступний», а не «не знайдено»', async () => {
    api.resolveTask.mockRejectedValueOnce(plannerError(503, 'unavailable'))
    renderAt('/dashboard/planning/tasks?task=SKL-7')
    expect(
      await screen.findByText('Планер тимчасово недоступний. Решта CRM працює', {
        selector: 'aside p',
      })
    ).toBeInTheDocument()
  })

  it('панель: обрыв сети (ответа нет) — тоже недоступность', async () => {
    api.resolveTask.mockRejectedValueOnce(new AxiosError('Network Error', 'ERR_NETWORK'))
    renderAt('/dashboard/planning/tasks?task=SKL-7')
    expect(
      await screen.findByText('Планер тимчасово недоступний. Решта CRM працює', {
        selector: 'aside p',
      })
    ).toBeInTheDocument()
  })

  it('панель: 500 — общая ошибка загрузки, не «не знайдено»', async () => {
    api.resolveTask.mockRejectedValueOnce(plannerError(500, 'internal'))
    renderAt('/dashboard/planning/tasks?task=SKL-8')
    expect(
      await screen.findByText('Не вдалося завантажити задачу. Повторіть ще раз')
    ).toBeInTheDocument()
    expect(screen.queryByText('Задачу не знайдено або у вас немає до неї доступу')).toBeNull()
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

describe('общие компоненты на карточке, в строке и в панели (5.1)', () => {
  const RICH = {
    sla_state: 'soon' as const,
    sla_deadline_at: '2026-10-02T15:00:00Z',
    origin: { kind: 'import' },
    priority: { id: 'p-top', name: 'Високий' },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    const board = makeBoard()
    api.getMeta.mockResolvedValue(makeMeta())
    api.listBoards.mockResolvedValue({ items: [] })
    api.getBoard.mockResolvedValue(
      makeBoard({
        config: {
          ...board.config,
          priorities: [
            { id: 'p-low', name: 'Низький', position: 1, default: false },
            { id: 'p-mid', name: 'Середній', position: 2, default: true },
            { id: 'p-top', name: 'Високий', position: 3, default: false },
          ],
        },
      })
    )
    api.listBoardTasks.mockResolvedValue({ items: [makeCard(RICH)], has_more: false })
    api.listMyTasks.mockResolvedValue({ items: [makeCard(RICH)], has_more: false })
    api.searchPeople.mockResolvedValue({ items: [] })
  })

  it('карточка доски: пилюля SLA, происхождение, приоритет и аватар', async () => {
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const todo = await screen.findByRole('region', { name: 'Нова' })
    expect(await within(todo).findByText('SLA скоро')).toBeInTheDocument()
    expect(within(todo).getByText('перенесено з Forgejo')).toBeInTheDocument()
    expect(await within(todo).findByRole('img', { name: 'Пріоритет: Високий' })).toHaveClass(
      'text-warning-700'
    )
    expect(within(todo).getByText('ОК')).toBeInTheDocument()
  })

  it('строка «Мої задачі»: чип статуса первым, затем название, пилюли и аватар', async () => {
    renderAt('/dashboard/planning/tasks')
    const title = await screen.findByText('Перевірити залишки')
    const row = title.closest('li')!
    expect(within(row).getAllByRole('button')[0]).toHaveAccessibleName('Змінити статус: Нова')
    expect(await within(row).findByText('SLA скоро')).toBeInTheDocument()
    expect(within(row).getByText('перенесено з Forgejo')).toBeInTheDocument()
  })

  it('панель: остаток SLA с сервера; Esc при открытой подсказке закрывает подсказку, не панель', async () => {
    api.resolveTask.mockResolvedValue(
      makeTask({
        sla_state: 'running',
        sla_deadline_at: '2026-10-02T15:00:00Z',
        sla_remaining_seconds: 5 * 3600,
      })
    )
    renderAt('/dashboard/planning/tasks?task=SKL-2')
    const panel = await screen.findByRole('complementary', { name: 'Задача SKL-2' })
    const pill = (await within(panel).findByText('5 год')).closest('[tabindex="0"]') as HTMLElement
    expect(pill).toHaveTextContent('SLA')
    act(() => pill.focus())
    expect(await screen.findByRole('tooltip')).toBeInTheDocument()
    const user = userEvent.setup()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
    expect(screen.getByRole('complementary', { name: 'Задача SKL-2' })).toBeInTheDocument()
  })

  it('пустая доска — пустое состояние один раз, колонки остаются без «Немає задач»', async () => {
    api.listBoardTasks.mockResolvedValue({ items: [], has_more: false })
    renderAt('/dashboard/planning/tasks/boards/SKL')
    expect(await screen.findByText('На дошці ще немає задач')).toBeInTheDocument()
    const todo = screen.getByRole('region', { name: 'Нова' })
    expect(within(todo).getByText('0')).toBeInTheDocument()
    expect(screen.queryByText('Немає задач')).toBeNull()
  })

  it('конфигурация пришла раньше задач — колонки стоят со скелетоном карточек, без «0» и «Немає задач»', async () => {
    let resolveTasks: (list: unknown) => void = () => {}
    api.listBoardTasks.mockImplementation(() => new Promise((resolve) => (resolveTasks = resolve)))
    renderAt('/dashboard/planning/tasks/boards/SKL')
    const todo = await screen.findByRole('region', { name: 'Нова' })
    expect(todo.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(within(todo).getByText('Завантаження…')).toHaveClass('sr-only')
    expect(within(todo).queryByText('0')).toBeNull()
    expect(screen.queryByText('Немає задач')).toBeNull()
    expect(screen.queryByText('На дошці ще немає задач')).toBeNull()

    await act(async () => resolveTasks({ items: [makeCard()], has_more: false }))
    expect(await within(todo).findByText('Перевірити залишки')).toBeInTheDocument()
    expect(within(todo).getByText('1')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'В роботі' })).toHaveTextContent('Немає задач')
    expect(document.querySelector('[aria-busy="true"]')).toBeNull()
  })

  it('задачи доски не загрузились — ошибка, и под ней ни «0», ни «Немає задач»', async () => {
    api.listBoardTasks.mockRejectedValue(plannerError(500, 'internal'))
    renderAt('/dashboard/planning/tasks/boards/SKL')
    expect(await screen.findByText('Не вдалося завантажити дошку')).toBeInTheDocument()
    const todo = screen.getByRole('region', { name: 'Нова' })
    expect(within(todo).queryByText('0')).toBeNull()
    expect(screen.queryByText('Немає задач')).toBeNull()
    expect(todo.querySelector('[aria-busy="true"]')).toBeNull()
  })
})
