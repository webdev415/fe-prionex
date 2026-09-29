/**
 * The task and request form (planner story 5.7): the board picker with
 * «Заявка в інший відділ», the board's fields and defaults, the deadline as
 * one key, server errors at their fields, one key per form, and the request
 * form of a non-member with files uploaded right after the 201.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, AxiosHeaders } from 'axios'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  const { plannerUseTranslation } = await import('./plannerUkI18n')
  return { ...actual, useTranslation: plannerUseTranslation }
})
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('sonner', () => ({ toast }))

const api = vi.hoisted(() => ({
  listCreatableBoards: vi.fn(),
  getBoard: vi.fn(),
  createTask: vi.fn(),
  uploadTaskAttachment: vi.fn(),
  searchPeople: vi.fn(),
}))
vi.mock('@/api/planner/plannerApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/planner/plannerApi')>()
  return { ...actual, ...api }
})

import { CreateTaskDialog } from '../components/CreateTaskDialog'
import type { PlannerBoard, PlannerBoardList } from '@/api/planner/plannerApi'
import { makeBoard, makeTask } from './plannerFixtures'

const OLENA_ID = '0190a0a0-0000-5000-8000-000000000001'

const ITEMS: PlannerBoardList['items'] = [
  {
    id: 'b1',
    code: 'SKL',
    name: 'Склад',
    kind: 'team',
    version: 5,
    role: 'board_member',
    allowed_actions: ['create_task'],
  },
  {
    id: 'b9',
    code: 'OLK',
    name: 'Особиста дошка',
    kind: 'personal',
    version: 1,
    role: 'board_admin',
    allowed_actions: ['create_task'],
  },
]

const ANL = {
  id: 'b2',
  code: 'ANL',
  name: 'Аналітика',
  kind: 'department' as const,
  department_name: 'Аналітика',
  intake_hint: 'звіти та вивантаження, не стягнення',
  required_fields: [
    {
      id: 'f-period',
      name: 'Період',
      type: 'text' as const,
      required: true,
      default: null,
      position: 1,
      options: [],
    },
  ],
}

const INTAKE: NonNullable<PlannerBoardList['intake']> = [
  ANL,
  {
    id: 'b3',
    code: 'TP',
    name: 'ТП',
    kind: 'department',
    department_name: 'ТП',
    intake_hint: 'стягнення простроченої заборгованості',
    required_fields: [],
  },
  {
    id: 'b4',
    code: 'SUP',
    name: 'Підтримка',
    kind: 'department',
    department_name: 'Тех. підтримка',
    intake_hint: 'підтримка клієнтів, не стягнення',
    required_fields: [],
  },
  {
    id: 'b5',
    code: 'ITO',
    name: 'IT-опс',
    kind: 'team',
    department_name: null,
    intake_hint: null,
    required_fields: [],
  },
]

function memberBoard(): PlannerBoard {
  const base = makeBoard()
  return makeBoard({
    config: {
      ...base.config,
      task_types: [
        {
          id: 't-once',
          name: 'Разова',
          position: 1,
          default: true,
          sla: null,
          initial_status_id: null,
          default_assignee_id: OLENA_ID,
        },
        {
          id: 't-bug',
          name: 'Помилка',
          position: 2,
          default: false,
          sla: null,
          initial_status_id: null,
          default_assignee_id: null,
        },
      ],
      priorities: [
        { id: 'p-low', name: 'Низький', position: 1, default: false },
        { id: 'p-mid', name: 'Середній', position: 2, default: true },
        { id: 'p-high', name: 'Високий', position: 3, default: false },
      ],
      labels: [{ id: 'l-urgent', name: 'Терміново', position: 1 }],
      fields: [
        {
          id: 'f-source',
          name: 'Джерело',
          type: 'single_select',
          required: false,
          default: null,
          position: 2,
          options: [{ id: 'o-web', label: 'Сайт', position: 1 }],
        },
        {
          id: 'f-contract',
          name: 'Номер договору',
          type: 'text',
          required: true,
          default: null,
          position: 1,
          options: [],
        },
      ],
      defaults: {
        assignee_id: null,
        checklist: [],
        description_template: 'Що зробити:',
      },
    },
    members: [
      {
        user_id: OLENA_ID,
        crm_user_id: 41,
        full_name: 'Олена Коваль',
        role: 'board_member',
        source: 'explicit',
        granted_as: null,
        not_in_department: false,
      },
    ],
  })
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

function renderDialog(props: { boardCode?: string; intent?: 'task' | 'request' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const onClose = vi.fn()
  const onOpenTask = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <CreateTaskDialog onClose={onClose} onOpenTask={onOpenTask} {...props} />
    </QueryClientProvider>
  )
  return { onClose, onOpenTask }
}

/** The body of the only create call. */
async function sentBody() {
  await waitFor(() => expect(api.createTask).toHaveBeenCalledTimes(1))
  return api.createTask.mock.calls[0][1] as Record<string, unknown>
}

async function openPicker(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /^(Дошка|Кому)/ }))
}

describe('Форма «+ Задача» и заявка (5.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listCreatableBoards.mockResolvedValue({ items: ITEMS, intake: INTAKE })
    api.getBoard.mockResolvedValue(memberBoard())
    api.searchPeople.mockResolvedValue({ items: [] })
    api.createTask.mockResolvedValue(makeTask({ key: 'SKL-43' }))
    api.uploadTaskAttachment.mockResolvedValue({})
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('«Дошка» — доски из can_create; «Заявка в інший відділ» — отдел · код · подсказка П-9 одной строкой', async () => {
    const user = userEvent.setup()
    renderDialog({ boardCode: 'SKL' })
    // The board page's own board is chosen from the start.
    expect(await screen.findByRole('button', { name: 'Дошка SKL · Склад' })).toBeInTheDocument()
    await openPicker(user)

    expect(
      within(screen.getByRole('group', { name: 'Команди' })).getByRole('button', {
        name: 'SKL · Склад',
      })
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('group', { name: 'Особиста' })).getByRole('button', {
        name: 'OLK · Особиста дошка',
      })
    ).toBeInTheDocument()
    const requests = screen.getByRole('group', { name: 'Заявка в інший відділ' })
    expect(
      within(requests)
        .getAllByRole('button')
        .map((b) => b.textContent)
    ).toEqual([
      'Аналітика · ANL · звіти та вивантаження, не стягнення',
      'ТП · TP · стягнення простроченої заборгованості',
      'Тех. підтримка · SUP · підтримка клієнтів, не стягнення',
    ])
    // Team boards that take requests: their own group below.
    expect(
      within(screen.getByRole('group', { name: 'Заявка на дошку команди' })).getByRole('button', {
        name: 'IT-опс · ITO',
      })
    ).toBeInTheDocument()
    expect(api.listCreatableBoards).toHaveBeenCalledTimes(1)
  })

  it('поиск по названию и подсказке П-9 отличает «ТП» от «Тех. підтримка»', async () => {
    const user = userEvent.setup()
    renderDialog({ boardCode: 'SKL' })
    await openPicker(user)
    await user.type(screen.getByLabelText('Знайти дошку або відділ'), 'клієнт')
    expect(screen.getByRole('button', { name: /^Тех\. підтримка · SUP/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^ТП · TP/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'SKL · Склад' })).toBeNull()

    await user.clear(screen.getByLabelText('Знайти дошку або відділ'))
    await user.type(screen.getByLabelText('Знайти дошку або відділ'), 'аналіт')
    expect(screen.getByRole('button', { name: /^Аналітика · ANL/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Тех\. підтримка/ })).toBeNull()

    await user.clear(screen.getByLabelText('Знайти дошку або відділ'))
    await user.type(screen.getByLabelText('Знайти дошку або відділ'), 'бухгалтерія')
    expect(screen.getByText('Нічого не знайдено')).toBeInTheDocument()
  })

  it('поля доски: образец описания, тип и приоритет по умолчанию, исполнитель по умолчанию, обязательное поле, «Ще поля»', async () => {
    const user = userEvent.setup()
    renderDialog({ boardCode: 'SKL' })
    await screen.findByLabelText('Тип')
    expect(screen.getByLabelText('Опис')).toHaveValue('Що зробити:')
    expect(screen.getByRole('heading', { name: 'Нова задача' })).toBeInTheDocument()
    expect(screen.getByLabelText('Тип')).toHaveValue('t-once')
    expect(screen.getByLabelText('Пріоритет')).toHaveValue('p-mid')
    // The default assignee of the default type is in the field.
    expect(screen.getByText('Олена Коваль')).toBeInTheDocument()
    expect(screen.getByText('1 / 10')).toBeInTheDocument()
    expect(screen.getByLabelText('Номер договору')).toHaveAttribute('aria-required', 'true')
    expect(screen.getByRole('group', { name: 'Термін' })).toBeInTheDocument()
    for (const preset of ['Сьогодні 18:00', 'Завтра', 'Пт', 'Обрати дату']) {
      expect(screen.getByRole('button', { name: preset })).toBeInTheDocument()
    }

    // «Ще поля» holds labels, watchers and the optional fields.
    expect(screen.queryByLabelText('Джерело')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Ще поля' }))
    expect(screen.getByRole('button', { name: 'Терміново' })).toBeInTheDocument()
    expect(screen.getByLabelText('Спостерігачі')).toBeInTheDocument()
    expect(screen.getByLabelText('Джерело')).toBeInTheDocument()

    // A type without its own default assignee: the board's (none here).
    await user.selectOptions(screen.getByLabelText('Тип'), 'Помилка')
    expect(screen.queryByText('Олена Коваль')).toBeNull()
  })

  it('нетронутые умолчания в тело не уходят — их подставит сервер', async () => {
    const user = userEvent.setup()
    renderDialog({ boardCode: 'SKL' })
    await screen.findByLabelText('Тип')
    await user.type(screen.getByLabelText('Назва'), 'Звірка залишків')
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    const body = await sentBody()
    expect(Object.keys(body).sort()).toEqual(['due_date', 'title'])
    expect(api.createTask.mock.calls[0][0]).toBe('SKL')
  })

  it('тронутые поля уходят явно: тип, исполнители [], приоритет null, метки, наблюдатели, поля, описание null', async () => {
    api.searchPeople.mockResolvedValue({
      items: [
        {
          user_id: 'u-ivan',
          crm_user_id: 42,
          full_name: 'Іван Петренко',
          never_logged_in: false,
          departments: [],
        },
      ],
    })
    const user = userEvent.setup()
    renderDialog({ boardCode: 'SKL' })
    await screen.findByLabelText('Тип')
    await user.type(screen.getByLabelText('Назва'), 'Звірка')
    await user.clear(screen.getByLabelText('Опис'))
    await user.selectOptions(screen.getByLabelText('Тип'), 'Помилка')
    await user.selectOptions(screen.getByLabelText('Пріоритет'), 'Без пріоритету')
    await user.type(screen.getByLabelText('Номер договору'), 'КД-17')
    await user.click(screen.getByRole('button', { name: 'Ще поля' }))
    await user.click(screen.getByRole('button', { name: 'Терміново' }))
    await user.selectOptions(screen.getByLabelText('Джерело'), 'Сайт')
    await user.type(screen.getByLabelText('Спостерігачі'), 'Іва')
    await user.click(await screen.findByRole('button', { name: /Іван Петренко/ }))
    await user.click(screen.getByRole('button', { name: 'Створити' }))

    const body = await sentBody()
    expect(body).toEqual({
      title: 'Звірка',
      due_date: null,
      // The template was cleared on purpose: no description, not the template.
      description: null,
      type_id: 't-bug',
      priority_id: null,
      // The type «Помилка» has no default assignee, and nobody was picked.
      label_ids: ['l-urgent'],
      watcher_ids: ['u-ivan'],
      fields: { 'f-contract': 'КД-17', 'f-source': 'o-web' },
    })
  })

  it('убранный исполнитель по умолчанию — assignee_ids: []', async () => {
    const user = userEvent.setup()
    renderDialog({ boardCode: 'SKL' })
    await screen.findByText('Олена Коваль')
    await user.type(screen.getByLabelText('Назва'), 'Без виконавця')
    await user.click(screen.getByRole('button', { name: 'Прибрати Олена Коваль' }))
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    expect((await sentBody()).assignee_ids).toEqual([])
  })

  it('срок: «Обрати дату» без часа шлёт due_date и не шлёт due_at', async () => {
    const user = userEvent.setup()
    renderDialog({ boardCode: 'SKL' })
    await screen.findByLabelText('Тип')
    await user.type(screen.getByLabelText('Назва'), 'Дата')
    await user.click(screen.getByRole('button', { name: 'Обрати дату' }))
    await user.type(screen.getByLabelText('Дата'), '2026-10-05')
    expect(screen.getByText('пн, 05.10.2026 — без часу')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    const body = await sentBody()
    expect(body.due_date).toBe('2026-10-05')
    expect(body).not.toHaveProperty('due_at')
  })

  it('срок: дата с часом — due_at в поясе доски, без due_date', async () => {
    const user = userEvent.setup()
    renderDialog({ boardCode: 'SKL' })
    await screen.findByLabelText('Тип')
    await user.type(screen.getByLabelText('Назва'), 'Момент')
    await user.click(screen.getByRole('button', { name: 'Обрати дату' }))
    await user.type(screen.getByLabelText('Дата'), '2026-12-01')
    await user.type(screen.getByLabelText("Час (необов'язково)"), '09:30')
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    const body = await sentBody()
    expect(body.due_at).toBe('2026-12-01T09:30:00+02:00')
    expect(body).not.toHaveProperty('due_date')
  })

  it('срок: пресеты «Сьогодні 18:00» и «Пт» — 18:00 по часам доски, due_at', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // Thursday 01.10.2026, 12:00 in Kyiv.
    vi.setSystemTime(new Date('2026-10-01T09:00:00Z'))
    const user = userEvent.setup()
    renderDialog({ boardCode: 'SKL' })
    await screen.findByLabelText('Тип')
    await user.type(screen.getByLabelText('Назва'), 'Пресет')
    await user.click(screen.getByRole('button', { name: 'Сьогодні 18:00' }))
    expect(screen.getByRole('button', { name: 'Сьогодні 18:00' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByText('чт, 01.10.2026, 18:00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Пт' }))
    expect(screen.getByText('пт, 02.10.2026, 18:00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    const body = await sentBody()
    expect(body.due_at).toBe('2026-10-02T18:00:00+03:00')
    expect(body).not.toHaveProperty('due_date')
  })

  it('ошибка сервера — у своего поля по details.field, без тоста; поле из «Ще поля» раскрывает секцию', async () => {
    const user = userEvent.setup()
    renderDialog({ boardCode: 'SKL' })
    await screen.findByLabelText('Тип')
    await user.type(screen.getByLabelText('Назва'), 'Помилка поля')
    api.createTask.mockRejectedValueOnce(
      plannerError(400, 'validation', {
        field: 'Номер договору',
        id: 'f-contract',
        reason: 'required',
      })
    )
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    const contract = screen.getByLabelText('Номер договору')
    await waitFor(() => expect(contract).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getByText('Заповніть це поле')).toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()

    api.createTask.mockRejectedValueOnce(
      plannerError(400, 'validation', { field: 'Джерело', id: 'f-source', reason: 'invalid' })
    )
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    expect(await screen.findByText('Перевірте значення')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ще поля' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByLabelText('Джерело')).toHaveAttribute('aria-invalid', 'true')

    api.createTask.mockRejectedValueOnce(
      plannerError(400, 'validation', { field: 'description', reason: 'raw_html' })
    )
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    expect(await screen.findByText('Опис не може містити HTML-розмітку')).toBeInTheDocument()

    // A field the form does not show: a toast by the failure path.
    api.createTask.mockRejectedValueOnce(plannerError(400, 'validation', { field: 'dev_task_url' }))
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Не заповнено або неправильно заповнено поле «dev_task_url»'
      )
    )
    // Every attempt of this form carried the same key.
    const keys = new Set(api.createTask.mock.calls.map((call) => call[2]))
    expect(keys.size).toBe(1)
  })

  it('«Створити» занята на время отправки; тост «Створено SKL-43 · Відкрити» открывает задачу', async () => {
    let resolveCreate: (task: unknown) => void = () => {}
    api.createTask.mockImplementation(() => new Promise((resolve) => (resolveCreate = resolve)))
    const user = userEvent.setup()
    const { onClose, onOpenTask } = renderDialog({ boardCode: 'SKL' })
    await screen.findByLabelText('Тип')
    await user.type(screen.getByLabelText('Назва'), 'Зайнята кнопка')
    const submit = screen.getByRole('button', { name: 'Створити' })
    await user.click(submit)
    await waitFor(() => expect(submit).toBeDisabled())
    await user.click(submit)
    resolveCreate(makeTask({ key: 'SKL-43' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
    expect(api.createTask).toHaveBeenCalledTimes(1)
    const [text, options] = toast.success.mock.calls[0]
    expect(text).toBe('Створено SKL-43')
    expect(options.action.label).toBe('Відкрити')
    options.action.onClick()
    expect(onOpenTask).toHaveBeenCalledWith('SKL-43')
    expect(onClose).toHaveBeenCalled()
  })

  it('без выбранной доски форма не отправляется — ошибка у поля «Дошка»', async () => {
    const user = userEvent.setup()
    renderDialog()
    await screen.findByRole('button', { name: /^Дошка Оберіть дошку/ })
    await user.type(screen.getByLabelText('Назва'), 'Нікуди')
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    expect(await screen.findByText('Оберіть дошку', { selector: 'p' })).toBeInTheDocument()
    expect(api.createTask).not.toHaveBeenCalled()
  })

  it('404 при создании — доска исчезла: ошибка у поля «Дошка», список перечитан', async () => {
    api.createTask.mockRejectedValueOnce(plannerError(404, 'not_found'))
    const user = userEvent.setup()
    renderDialog({ boardCode: 'SKL' })
    await screen.findByLabelText('Тип')
    await user.type(screen.getByLabelText('Назва'), 'Зникла')
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    expect(
      await screen.findByText('Дошку не знайдено або вона вже не приймає задач. Оберіть іншу')
    ).toBeInTheDocument()
    await waitFor(() => expect(api.listCreatableBoards).toHaveBeenCalledTimes(2))
    expect(toast.error).not.toHaveBeenCalled()
  })
})

describe('Заявка не члена доски с «Приймає заявки» (5.7, AC2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listCreatableBoards.mockResolvedValue({ items: ITEMS, intake: INTAKE })
    api.getBoard.mockResolvedValue(memberBoard())
    api.searchPeople.mockResolvedValue({ items: [] })
    api.createTask.mockResolvedValue(
      makeTask({
        id: 'task-anl-43',
        key: 'ANL-43',
        is_request: true,
        needs_triage: true,
        assignees: [],
      })
    )
    api.uploadTaskAttachment.mockResolvedValue({})
  })

  it('заголовок «Нова заявка до «Аналітика»», строка отдела, поля заявки, без ключей разбора; файлы — сразу после 201', async () => {
    const user = userEvent.setup()
    const { onOpenTask } = renderDialog({ boardCode: 'SKL' })
    await openPicker(user)
    await user.click(screen.getByRole('button', { name: /^Аналітика · ANL/ }))

    expect(screen.getByRole('heading', { name: 'Нова заявка до «Аналітика»' })).toBeInTheDocument()
    expect(screen.getByText('Тип, пріоритет і виконавця визначить відділ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Кому Аналітика · ANL/ })).toBeInTheDocument()
    // Title, description, files, the board's required fields and the deadline.
    expect(screen.getByLabelText('Назва')).toBeInTheDocument()
    expect(screen.getByLabelText('Опис')).toHaveValue('')
    expect(screen.getByLabelText('Вкладення')).toBeInTheDocument()
    expect(screen.getByLabelText('Період')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Термін' })).toBeInTheDocument()
    // No triage fields and no «Ще поля».
    expect(screen.queryByLabelText('Тип')).toBeNull()
    expect(screen.queryByLabelText('Пріоритет')).toBeNull()
    expect(screen.queryByLabelText('Виконавці')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ще поля' })).toBeNull()
    // The board card is not visible to a non-member: the form lives on `intake`.
    expect(api.getBoard).not.toHaveBeenCalledWith('ANL')

    await user.type(screen.getByLabelText('Назва'), 'Вивантаження за вересень')
    await user.type(screen.getByLabelText('Період'), 'вересень 2026')
    const report = new File(['a;b'], 'report.csv', { type: 'text/csv' })
    const scan = new File(['%PDF'], 'scan.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText('Вкладення'), [report, scan])
    expect(screen.getByText('report.csv')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Створити' }))

    await waitFor(() => expect(api.uploadTaskAttachment).toHaveBeenCalledTimes(2))
    const [code, body, key] = api.createTask.mock.calls[0]
    expect(code).toBe('ANL')
    expect(body).toEqual({
      title: 'Вивантаження за вересень',
      due_date: null,
      fields: { 'f-period': 'вересень 2026' },
    })
    for (const triage of ['assignee_ids', 'type_id', 'priority_id', 'label_ids', 'watcher_ids']) {
      expect(body).not.toHaveProperty(triage)
    }
    const uploads = api.uploadTaskAttachment.mock.calls
    expect(uploads.map((call) => [call[0], (call[1] as File).name])).toEqual([
      ['task-anl-43', 'report.csv'],
      ['task-anl-43', 'scan.pdf'],
    ])
    // Each file has its own key, none is the key of the task.
    expect(new Set([key, uploads[0][2], uploads[1][2]]).size).toBe(3)
    // The create finished before the first upload started.
    expect(api.createTask.mock.invocationCallOrder[0]).toBeLessThan(
      api.uploadTaskAttachment.mock.invocationCallOrder[0]
    )

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
    const [text, options] = toast.success.mock.calls[0]
    expect(text).toBe('Створено ANL-43')
    options.action.onClick()
    expect(onOpenTask).toHaveBeenCalledWith('ANL-43')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('файл не загрузился — заявка создана, тост говорит, сколько файлов не дошло', async () => {
    api.uploadTaskAttachment.mockRejectedValueOnce(plannerError(503, 'feature_disabled'))
    const user = userEvent.setup()
    const { onClose } = renderDialog({ boardCode: 'ANL' })
    await screen.findByRole('heading', { name: 'Нова заявка до «Аналітика»' })
    await user.type(screen.getByLabelText('Назва'), 'З файлом')
    await user.upload(screen.getByLabelText('Вкладення'), new File(['x'], 'a.txt'))
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
    expect(toast.error).toHaveBeenCalledWith('Не завантажено файлів: 1. Додайте їх у задачі')
    expect(onClose).toHaveBeenCalled()
  })

  it('файл больше 50 МБ и пустой файл — ошибка у поля, заявка не отправляется', async () => {
    const user = userEvent.setup()
    renderDialog({ boardCode: 'ANL' })
    await screen.findByRole('heading', { name: 'Нова заявка до «Аналітика»' })
    await user.type(screen.getByLabelText('Назва'), 'Великий файл')
    const big = new File(['x'], 'big.zip')
    Object.defineProperty(big, 'size', { value: 52_428_801 })
    await user.upload(screen.getByLabelText('Вкладення'), big)
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    expect(await screen.findByText('Файл більший за 50 МБ')).toBeInTheDocument()
    expect(api.createTask).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Прибрати файл big.zip' }))
    await user.upload(screen.getByLabelText('Вкладення'), new File([], 'empty.txt'))
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    expect(await screen.findByText('Порожній файл не завантажиться')).toBeInTheDocument()
    expect(api.createTask).not.toHaveBeenCalled()
  })

  it('«Нова заявка» (intent=request): только доски для заявок, поле «Кому», поиск «Знайти відділ»', async () => {
    const user = userEvent.setup()
    renderDialog({ intent: 'request' })
    expect(await screen.findByRole('heading', { name: 'Нова заявка' })).toBeInTheDocument()
    await openPicker(user)
    expect(screen.getByLabelText('Знайти відділ')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Команди' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'SKL · Склад' })).toBeNull()
    expect(screen.getByRole('group', { name: 'Заявка в інший відділ' })).toBeInTheDocument()
  })

  it('400 triage_only — человек уже не член: список перечитан, форма становится заявкой', async () => {
    api.createTask.mockRejectedValueOnce(
      plannerError(400, 'validation', { field: 'type_id', reason: 'triage_only' })
    )
    const user = userEvent.setup()
    renderDialog({ boardCode: 'SKL' })
    await screen.findByLabelText('Тип')
    await user.type(screen.getByLabelText('Назва'), 'Вже не член')
    await user.selectOptions(screen.getByLabelText('Тип'), 'Помилка')
    api.listCreatableBoards.mockResolvedValue({
      items: [],
      intake: [
        {
          id: 'b1',
          code: 'SKL',
          name: 'Склад',
          kind: 'team',
          department_name: null,
          intake_hint: null,
          required_fields: [],
        },
      ],
    })
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    expect(
      await screen.findByRole('heading', { name: 'Нова заявка до «Склад»' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Ви вже не учасник цієї дошки — задача стане заявкою. Перевірте форму й створіть ще раз'
      )
    ).toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()

    // The second attempt is a request: no triage keys even though a type was picked.
    api.createTask.mockResolvedValueOnce(makeTask({ key: 'SKL-44', is_request: true }))
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    await waitFor(() => expect(api.createTask).toHaveBeenCalledTimes(2))
    expect(api.createTask.mock.calls[1][1]).toEqual({ title: 'Вже не член', due_date: null })
  })
})

describe('Ревью 5.7, раунд 1: подсказка П-9, клавиатура в «Дошка/Кому», «×» во время отправки', () => {
  const LONG_HINT =
    'звіти, вибірки та вивантаження для керівників і фінансового відділу; не стягнення, не підтримка клієнтів, не юридичні питання'

  beforeEach(() => {
    vi.clearAllMocks()
    api.listCreatableBoards.mockResolvedValue({
      items: ITEMS,
      intake: [{ ...ANL, intake_hint: LONG_HINT }, ...INTAKE.slice(1)],
    })
    api.getBoard.mockResolvedValue(memberBoard())
    api.searchPeople.mockResolvedValue({ items: [] })
    api.createTask.mockResolvedValue(makeTask({ key: 'SKL-43' }))
    api.uploadTaskAttachment.mockResolvedValue({})
  })

  it('длинная подсказка П-9 — одной строкой текста с переносом, целиком (не «…»), полный текст в title', async () => {
    const user = userEvent.setup()
    renderDialog({ boardCode: 'SKL' })
    await openPicker(user)
    const option = screen.getByRole('button', { name: /^Аналітика · ANL/ })
    const line = within(option).getByTestId('board-line')
    expect(line).toHaveTextContent(`Аналітика · ANL · ${LONG_HINT}`)
    // Wraps (up to three rows in the list), is never cut on one row.
    expect(line).toHaveClass('whitespace-normal', 'line-clamp-3')
    expect(line.closest('.truncate')).toBeNull()
    expect(option).not.toHaveClass('truncate')
    expect(option).toHaveAttribute('title', `Аналітика · ANL · ${LONG_HINT}`)
    expect(option).toHaveAccessibleName(`Аналітика · ANL · ${LONG_HINT}`)

    // The chosen request board shows the hint in the field too, not «…».
    await user.click(option)
    const trigger = screen.getByRole('button', { name: /^Кому Аналітика · ANL/ })
    expect(trigger).toHaveAttribute('title', `Аналітика · ANL · ${LONG_HINT}`)
    const value = within(trigger).getByTestId('board-line')
    expect(value).toHaveTextContent(LONG_HINT)
    expect(value).toHaveClass('whitespace-normal', 'line-clamp-2')
    expect(value.closest('.truncate')).toBeNull()
  })

  it('выбор с клавиатуры (Enter) возвращает фокус на поле «Кому»; следующий Tab — к «Назва»', async () => {
    const user = userEvent.setup()
    renderDialog({ boardCode: 'SKL' })
    await openPicker(user)
    expect(screen.getByLabelText('Знайти дошку або відділ')).toHaveFocus()
    await user.type(screen.getByLabelText('Знайти дошку або відділ'), 'клієнт')
    screen.getByRole('button', { name: /^Тех\. підтримка · SUP/ }).focus()
    await user.keyboard('{Enter}')
    const trigger = screen.getByRole('button', { name: /^Кому Тех\. підтримка · SUP/ })
    expect(trigger).toHaveFocus()
    expect(screen.queryByLabelText('Знайти дошку або відділ')).toBeNull()
    await user.tab()
    expect(screen.getByLabelText('Назва')).toHaveFocus()
  })

  it('Esc в поиске «Дошка» закрывает только список: форма и набранная «Назва» остаются, фокус на поле', async () => {
    const user = userEvent.setup()
    const { onClose } = renderDialog({ boardCode: 'SKL' })
    await screen.findByLabelText('Тип')
    await user.type(screen.getByLabelText('Назва'), 'Не загубити')
    await openPicker(user)
    await user.type(screen.getByLabelText('Знайти дошку або відділ'), 'ана')
    await user.keyboard('{Escape}')
    expect(screen.queryByLabelText('Знайти дошку або відділ')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Нова задача' })).toBeInTheDocument()
    expect(screen.getByLabelText('Назва')).toHaveValue('Не загубити')
    expect(screen.getByRole('button', { name: /^Дошка SKL · Склад/ })).toHaveFocus()

    // With the list closed, Escape is the dialog's again.
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('во время отправки «×» нет, форму не закрыть; после 201 — тост «Створено … · Відкрити» и закрытие', async () => {
    let resolveCreate: (task: unknown) => void = () => {}
    api.createTask.mockImplementation(() => new Promise((resolve) => (resolveCreate = resolve)))
    const user = userEvent.setup()
    const { onClose } = renderDialog({ boardCode: 'SKL' })
    await screen.findByLabelText('Тип')
    expect(screen.getByRole('button', { name: 'Close modal' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Назва'), 'Довга відправка')
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Close modal' })).toBeNull())
    expect(screen.getByRole('button', { name: 'Скасувати' })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()

    resolveCreate(makeTask({ key: 'SKL-43' }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
    expect(toast.success.mock.calls[0][0]).toBe('Створено SKL-43')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('заявка с файлами: «×» нет, пока идёт загрузка файлов после 201; тост о незагруженных файлах не теряется', async () => {
    let resolveUpload: (value: unknown) => void = () => {}
    api.createTask.mockResolvedValue(
      makeTask({ id: 'task-anl-43', key: 'ANL-43', is_request: true, assignees: [] })
    )
    api.uploadTaskAttachment.mockImplementationOnce(
      () => new Promise((_, reject) => (resolveUpload = reject))
    )
    const user = userEvent.setup()
    const { onClose } = renderDialog({ boardCode: 'ANL' })
    await screen.findByRole('heading', { name: 'Нова заявка до «Аналітика»' })
    await user.type(screen.getByLabelText('Назва'), 'Великий файл')
    await user.upload(screen.getByLabelText('Вкладення'), new File(['x'], 'a.zip'))
    await user.click(screen.getByRole('button', { name: 'Створити' }))
    await waitFor(() => expect(api.uploadTaskAttachment).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('button', { name: 'Close modal' })).toBeNull()
    expect(onClose).not.toHaveBeenCalled()

    resolveUpload(plannerError(503, 'feature_disabled'))
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
    expect(toast.error).toHaveBeenCalledWith('Не завантажено файлів: 1. Додайте їх у задачі')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
