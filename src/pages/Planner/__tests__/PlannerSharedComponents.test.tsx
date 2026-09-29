/**
 * Shared pieces of the planner section (planner story 5.1): due and SLA pills,
 * status chip, priority icon, avatar, origin chip, people picker, the undo
 * toast, error toasts by way of failure, banners, empty states and skeletons.
 * The acceptance texts are pinned in Ukrainian, as the story states them.
 */
import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  getBoard: vi.fn(),
  patchTask: vi.fn(),
  searchPeople: vi.fn(),
}))
vi.mock('@/api/planner/plannerApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/planner/plannerApi')>()
  return { ...actual, ...api }
})

import {
  PLANNER_EVENT_PARTICIPANTS_MAX,
  PLANNER_PEOPLE_QUERY_MAX,
  type PlannerBoard,
  type PlannerBoardPriority,
  type PlannerDueState,
  type PlannerPerson,
  type PlannerSlaState,
  type PlannerTaskOrigin,
} from '@/api/planner/plannerApi'
import { plannerKeys } from '@/api/planner/plannerQueries'
import { expectObscured } from '@/test/piiHelpers'
import { DuePill, SlaPill } from '../components/TaskPills'
import { StatusChip } from '../components/StatusChip'
import { PriorityIcon } from '../components/PriorityIcon'
import { AvatarStack, PersonAvatar } from '../components/PersonAvatar'
import { OriginChip } from '../components/OriginChip'
import { PeoplePicker } from '../components/PeoplePicker'
import {
  BoardSkeleton,
  PanelSkeleton,
  PlannerBanners,
  PlannerEmptyState,
  TaskListSkeleton,
} from '../components/PlannerStates'
import { toastPlannerError } from '../hooks/usePlannerMutations'
import { formatPlannerDuration, type PlannerT } from '../plannerFormat'
import { PLANNER_UNDO_MS } from '../plannerToasts'
import { plannerT } from './plannerUkI18n'
import { makeBoard, makeCard, makeTask } from './plannerFixtures'

// The test dictionary stands in for i18next's branded `TFunction`.
const t = plannerT('planner') as unknown as PlannerT

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return { ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>), client }
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

const ONCE_TYPE = { id: 'type-once', name: 'Разова' }

type SlaNorm = NonNullable<PlannerBoard['config']['task_types'][number]['sla']>

function boardWith({
  norm = { value: 48, unit: 'hours', calendar: 'calendar' },
  priorities = [],
}: { norm?: SlaNorm; priorities?: PlannerBoardPriority[] } = {}) {
  const base = makeBoard()
  return makeBoard({
    config: {
      ...base.config,
      task_types: [
        {
          ...ONCE_TYPE,
          position: 1,
          default: true,
          sla: norm,
          initial_status_id: null,
          default_assignee_id: null,
        },
      ],
      priorities,
    },
  })
}

const level = (id: string, name: string, position: number): PlannerBoardPriority => ({
  id,
  name,
  position,
  default: false,
})

/** «Низький · Середній · Високий · Критичний», deliberately out of order. */
const FOUR_LEVELS = [
  level('p-high', 'Високий', 3),
  level('p-low', 'Низький', 1),
  level('p-crit', 'Критичний', 4),
  level('p-mid', 'Середній', 2),
]

/** The pill under the word (the word may be the visible text or the hidden one). */
function pillOf(word: string): HTMLElement {
  const pill = screen.getByText(word).closest('[tabindex="0"]')
  expect(pill, `pill with «${word}»`).not.toBeNull()
  return pill as HTMLElement
}

beforeEach(() => {
  vi.clearAllMocks()
  api.getBoard.mockResolvedValue(boardWith())
  api.searchPeople.mockResolvedValue({ items: [] })
})

describe('пилюли срока и SLA — иконка, слово и цвет роли, подсказка расчёта (5.1 AC1)', () => {
  const DUE_CASES: [PlannerDueState, string, string, string][] = [
    ['overdue', 'Прострочено', 'text-error-700 bg-error-50', 'Термін минув: 20.09.2026'],
    ['soon', 'Скоро термін', 'text-warning-700 bg-warning-50', 'Термін скоро: 20.09.2026'],
    ['ok', 'Термін', 'text-gray-900 bg-gray-50', 'Термін: 20.09.2026'],
  ]
  it.each(DUE_CASES)('срок %s — «%s», %s, подсказка по фокусу', async (state, word, tone, hint) => {
    renderWithClient(<DuePill task={makeCard({ due_date: '2026-09-20', due_state: state })} />)
    const pill = pillOf(word)
    for (const cls of tone.split(' ')) expect(pill).toHaveClass(cls)
    // Never colour alone: an icon and the word (read out even when hidden).
    expect(pill.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(pill).toHaveTextContent(word)
    expect(pill).toHaveTextContent('20.09.2026')
    await userEvent.setup().tab()
    expect(pill).toHaveFocus()
    expect(await screen.findByRole('tooltip')).toHaveTextContent(hint)
  })

  it('срока нет (due_state none) — «Без терміну» без пилюли', () => {
    renderWithClient(<DuePill task={makeCard({ due_date: null, due_state: 'none' })} />)
    const text = screen.getByText('Без терміну')
    expect(text.closest('[tabindex]')).toBeNull()
  })

  it('SLA идёт — остаток с сервера; подсказка «SLA 48 год за типом «Разова», календарний час, залишилось 5 год»', async () => {
    renderWithClient(
      <SlaPill
        task={makeTask({
          type: ONCE_TYPE,
          sla_state: 'running',
          sla_deadline_at: '2026-10-02T15:00:00Z',
          sla_remaining_seconds: 5 * 3600,
        })}
      />
    )
    const pill = pillOf('SLA')
    expect(pill).toHaveTextContent('5 год')
    expect(pill).toHaveClass('text-gray-900', 'bg-gray-50')
    await userEvent.setup().tab()
    expect(pill).toHaveFocus()
    // The norm and the board's zone arrive with the board.
    await waitFor(() =>
      expect(screen.getByRole('tooltip').textContent).toMatch(
        /^SLA 48 год за типом «Разова», календарний час, залишилось 5 год, до 02\.10\.2026.*18:00$/
      )
    )
  })

  it('на карточке остатка нет — пилюля показывает SLA-срок в поясе доски, клиент ничего не вычитает', async () => {
    renderWithClient(
      <SlaPill
        task={makeCard({
          type: ONCE_TYPE,
          sla_state: 'soon',
          sla_deadline_at: '2026-10-02T15:00:00Z',
        })}
      />
    )
    await waitFor(() => expect(api.getBoard).toHaveBeenCalledWith('SKL'))
    const pill = pillOf('SLA скоро')
    expect(pill).toHaveClass('text-warning-700', 'bg-warning-50')
    // 15:00 UTC is 18:00 in Kyiv (the board's tzid), whatever the browser zone.
    await waitFor(() => expect(pill.textContent).toMatch(/до 02\.10\.2026.*18:00/))
    expect(pill.textContent).not.toContain('залишилось')
  })

  it('норматив по будням — подсказка говорит «лише будні (Пн–Пт)»', async () => {
    api.getBoard.mockResolvedValue(
      boardWith({ norm: { value: 3, unit: 'days', calendar: 'weekdays' } })
    )
    renderWithClient(
      <SlaPill
        task={makeTask({ type: ONCE_TYPE, sla_state: 'running', sla_remaining_seconds: 90 * 60 })}
      />
    )
    await userEvent.setup().tab()
    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveTextContent(
        'SLA 3 дн за типом «Разова», лише будні (Пн–Пт), залишилось 1 год'
      )
    )
  })

  it('SLA на паузі — информационный синий, иконка паузы и остаток', async () => {
    renderWithClient(
      <SlaPill task={makeTask({ sla_state: 'paused', sla_remaining_seconds: 12 * 3600 })} />
    )
    const pill = pillOf('SLA на паузі')
    expect(pill).toHaveClass('text-information-700', 'bg-information-50')
    expect(pill).toHaveTextContent('12 год')
    expect(pill.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    await userEvent.setup().tab()
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'годинник SLA стоїть, залишилось 12 год'
    )
  })

  it('SLA порушено — красный только здесь и у просрочки; подсказка — момент нарушения', async () => {
    renderWithClient(
      <SlaPill
        task={makeTask({ sla_state: 'breached', sla_breached_at: '2026-09-28T07:30:00Z' })}
      />
    )
    const pill = pillOf('SLA порушено')
    expect(pill).toHaveClass('text-error-700', 'bg-error-50')
    await userEvent.setup().tab()
    // 07:30 UTC is 10:30 on the board's clock (Europe/Kyiv).
    await waitFor(() =>
      expect(screen.getByRole('tooltip').textContent).toMatch(/^порушено 28\.09\.2026.*10:30$/)
    )
  })

  it('SLA выключен — пилюли нет и доска не читается', () => {
    const { container } = renderWithClient(<SlaPill task={makeCard({ sla_state: 'off' })} />)
    expect(container).toBeEmptyDOMElement()
    expect(api.getBoard).not.toHaveBeenCalled()
  })

  it('состояние SLA, незнакомое сборке, — пилюли нет, а не догадка', async () => {
    const { container } = renderWithClient(
      <SlaPill task={makeCard({ sla_state: 'frozen' as unknown as PlannerSlaState })} />
    )
    await waitFor(() => expect(api.getBoard).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('длительности — сокращения без плюралов, не меньше одной единицы', () => {
    expect(formatPlannerDuration(30, t, 'uk')).toBe('1 хв')
    expect(formatPlannerDuration(59 * 60, t, 'uk')).toBe('59 хв')
    expect(formatPlannerDuration(47 * 3600 + 3599, t, 'uk')).toBe('47 год')
    expect(formatPlannerDuration(49 * 3600, t, 'uk')).toBe('2 дн')
    // Against a norm, the norm's unit: hours stay hours, days start at a day.
    expect(formatPlannerDuration(50 * 3600, t, 'uk', 'hours')).toBe('50 год')
    expect(formatPlannerDuration(30 * 3600, t, 'uk', 'days')).toBe('1 дн')
    expect(formatPlannerDuration(5 * 3600, t, 'uk', 'days')).toBe('5 год')
  })

  it('норматив в часах — остаток больше двух суток тоже в часах, на пилюле и в подсказке', async () => {
    renderWithClient(
      <SlaPill
        task={makeTask({ type: ONCE_TYPE, sla_state: 'running', sla_remaining_seconds: 50 * 3600 })}
      />
    )
    const pill = pillOf('SLA')
    await userEvent.setup().tab()
    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveTextContent(
        'SLA 48 год за типом «Разова», календарний час, залишилось 50 год'
      )
    )
    expect(pill).toHaveTextContent('50 год')
    expect(pill).not.toHaveTextContent('дн')
  })
})

describe('чип статуса, приоритет, аватар и происхождение (5.1 AC2, AC5)', () => {
  it.each([
    ['todo', 'bg-gray-600'],
    ['in_progress', 'bg-secondary-500'],
    ['done', 'bg-success-600'],
  ] as const)(
    'без change_status чип — подпись, а не кнопка; точка категории %s — %s',
    (category, dot) => {
      renderWithClient(
        <StatusChip
          task={makeCard({
            status: { id: 's-x', name: 'На перевірці', category },
            allowed_actions: ['edit'],
          })}
        />
      )
      expect(screen.queryByRole('button')).toBeNull()
      const name = screen.getByText('На перевірці')
      const face = name.parentElement!
      expect(face.tagName).toBe('SPAN')
      expect(face.querySelector(`span[aria-hidden="true"].${dot}`)).not.toBeNull()
      // A label does not need the board: nothing to choose from.
      expect(api.getBoard).not.toHaveBeenCalled()
    }
  )

  it('иконка приоритета — по позиции в шкале доски, цвет только у верхнего уровня', async () => {
    api.getBoard.mockResolvedValue(boardWith({ priorities: FOUR_LEVELS }))
    renderWithClient(
      <>
        {FOUR_LEVELS.map((p) => (
          <PriorityIcon key={p.id} task={makeCard({ priority: { id: p.id, name: p.name } })} />
        ))}
      </>
    )
    const shapes: Record<string, string> = {}
    for (const name of ['Низький', 'Середній', 'Високий', 'Критичний']) {
      const icon = await screen.findByRole('img', { name: `Пріоритет: ${name}` })
      shapes[name] = icon.getAttribute('data-priority-icon') ?? ''
      if (name === 'Критичний') expect(icon).toHaveClass('text-warning-700')
      else expect(icon).toHaveClass('text-muted-foreground')
    }
    expect(shapes).toEqual({
      Низький: 'down',
      Середній: 'flat',
      Високий: 'up',
      Критичний: 'double-up',
    })
  })

  it('пятый уровень — восклицание; в шкале из трёх верхний — «вверх» и он один цветной', async () => {
    api.getBoard.mockImplementation((code: string) =>
      Promise.resolve(
        makeBoard({
          ...boardWith({
            priorities:
              code === 'FIVE'
                ? [...FOUR_LEVELS, level('p-block', 'Блокер', 5)]
                : FOUR_LEVELS.filter((p) => p.position <= 3),
          }),
          code,
        })
      )
    )
    renderWithClient(
      <>
        <PriorityIcon
          task={makeCard({
            board: { id: 'b5', code: 'FIVE', name: 'П’ять' },
            priority: { id: 'p-block', name: 'Блокер' },
          })}
        />
        <PriorityIcon task={makeCard({ priority: { id: 'p-high', name: 'Високий' } })} />
      </>
    )
    const top5 = await screen.findByRole('img', { name: 'Пріоритет: Блокер' })
    expect(top5).toHaveAttribute('data-priority-icon', 'exclamation')
    expect(top5).toHaveClass('text-warning-700')
    const top3 = await screen.findByRole('img', { name: 'Пріоритет: Високий' })
    expect(top3).toHaveAttribute('data-priority-icon', 'up')
    expect(top3).toHaveClass('text-warning-700')
  })

  it('уровня нет в шкале или приоритета нет — иконки нет (позиция не угадывается)', async () => {
    api.getBoard.mockResolvedValue(boardWith({ priorities: FOUR_LEVELS }))
    renderWithClient(
      <>
        <PriorityIcon task={makeCard({ priority: { id: 'p-gone', name: 'Старий' } })} />
        <PriorityIcon task={makeCard({ priority: null })} />
        <PriorityIcon task={makeCard({ priority: { id: 'p-low', name: 'Низький' } })} />
      </>
    )
    // The scale is loaded (a known level is drawn), and still only one icon.
    expect(await screen.findByRole('img', { name: 'Пріоритет: Низький' })).toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  it('неактивный — серый перечёркнутый; «неактивний» и в доступном имени, и в подсказке; ФИО не в атрибутах', async () => {
    const { container } = render(
      <PersonAvatar
        person={{ user_id: 'u1', crm_user_id: 41, full_name: 'Олена Коваль', inactive: true }}
      />
    )
    const name = screen.getByText('Олена Коваль · неактивний')
    expect(name).toHaveClass('sr-only')
    expectObscured(name)
    const disc = name.parentElement!
    expect(disc).toHaveClass('bg-muted', 'text-muted-foreground')
    expect(disc.querySelector('.-rotate-45')).not.toBeNull()
    expectObscured(screen.getByText('ОК'))
    for (const node of container.querySelectorAll('*')) {
      for (const attr of ['title', 'aria-label', 'alt']) {
        expect(node.getAttribute(attr) ?? '').not.toContain('Олена')
      }
    }
    await userEvent.setup().hover(disc)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Олена Коваль · неактивний')
    const shown = screen.getAllByText('Олена Коваль · неактивний')
    expect(shown.length).toBeGreaterThan(1)
    for (const node of shown) expectObscured(node)
  })

  it('«ще не користувався Планером» — пустое кольцо и подпись', () => {
    render(
      <PersonAvatar
        person={{
          user_id: 'u2',
          crm_user_id: 42,
          full_name: 'Ігор Ткач',
          never_logged_in: true,
          departments: [
            {
              department_id: 'd1',
              name: 'Склад',
              project_id: 'p1',
              group: null,
            },
          ],
        }}
      />
    )
    const name = screen.getByText('Ігор Ткач · Склад · ще не користувався Планером')
    const disc = name.parentElement!
    expect(disc).toHaveClass('bg-transparent', 'border-muted-foreground')
    expect(disc.querySelector('.-rotate-45')).toBeNull()
  })

  it('стопка — до трёх аватаров и «+N»; без людей — «Без виконавця» под маской', () => {
    const person = (n: number) => ({
      user_id: `u${n}`,
      crm_user_id: n,
      full_name: `Людина ${n}`,
      inactive: false,
    })
    const { rerender } = render(<AvatarStack people={[1, 2, 3, 4, 5].map(person)} />)
    expect(screen.getByText('Людина 3')).toBeInTheDocument()
    expect(screen.queryByText('Людина 4')).toBeNull()
    expect(screen.getByText('+2')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('і ще 2')).toHaveClass('sr-only')
    rerender(<AvatarStack people={[]} />)
    expectObscured(screen.getByText('Без виконавця'))
  })

  it.each([
    ['draft', 'з чату'],
    ['chat', 'з чату'],
    ['protocol', 'з протоколу'],
    ['recurrence', 'повтор'],
    ['import', 'перенесено з Forgejo'],
  ])('происхождение %s — иконка и слово «%s»', (kind, word) => {
    render(<OriginChip origin={{ kind }} />)
    const chip = screen.getByText(word).parentElement!
    expect(chip.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(chip).toHaveClass('text-gray-900', 'bg-gray-50')
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('ручная задача и незнакомый вид — без чипа', () => {
    const origins: PlannerTaskOrigin[] = [
      { kind: 'manual' },
      { kind: 'constructor' },
      { kind: '__proto__' },
      { kind: 'telegram' },
    ]
    const { container } = render(
      <>
        {origins.map((origin) => (
          <OriginChip key={origin.kind} origin={origin} />
        ))}
      </>
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('ссылка на источник — только http(s) из message_url', () => {
    const { rerender } = render(
      <OriginChip origin={{ kind: 'draft', message_url: 'https://hub.example/c/1/m/2' }} />
    )
    const link = screen.getByRole('link', { name: /з чату/ })
    expect(link).toHaveAttribute('href', 'https://hub.example/c/1/m/2')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(link).toHaveTextContent('відкрити джерело')
    rerender(<OriginChip origin={{ kind: 'draft', message_url: 'javascript:alert(1)' }} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('з чату')).toBeInTheDocument()
  })
})

describe('выбор людей (5.1 AC3, AC5)', () => {
  const OLENA: PlannerPerson = {
    user_id: 'u-olena',
    crm_user_id: 41,
    full_name: 'Олена Коваль',
    never_logged_in: false,
    departments: [
      {
        department_id: 'd-sklad',
        name: 'Склад',
        project_id: 'p1',
        group: { group_id: 'g1', name: 'Приймання' },
      },
    ],
  }
  const IHOR: PlannerPerson = {
    user_id: 'u-ihor',
    crm_user_id: 42,
    full_name: 'Ігор Ткач',
    never_logged_in: true,
    departments: [{ department_id: 'd-sklad', name: 'Склад', project_id: 'p1', group: null }],
  }
  const people = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ ...OLENA, user_id: `u-${i}`, full_name: `Л ${i}` }))

  it('строки «аватар · ФИО · відділ · група» из GET /people, пометка «ще не користувався Планером»', async () => {
    api.searchPeople.mockResolvedValue({ items: [OLENA, IHOR] })
    renderWithClient(<PeoplePicker value={[]} onChange={vi.fn()} />)
    await userEvent.setup().type(screen.getByLabelText('Виконавці'), 'Ко')
    const olena = await screen.findByRole('button', { name: 'Олена Коваль · Склад · Приймання' })
    const ihor = screen.getByRole('button', {
      name: 'Ігор Ткач · Склад · ще не користувався Планером',
    })
    // The avatar only repeats the text of the line.
    expect(olena.querySelector('span[aria-hidden="true"]')).not.toBeNull()
    expect(within(ihor).getByText('ІТ').closest('.bg-transparent')).not.toBeNull()
    expectObscured(screen.getByText('Олена Коваль'))
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  // Who is inactive is the server's knowledge (`Person` carries no such
  // field): `GET /people` leaves them out. The client's part is to show
  // exactly that answer — the lines of an earlier, shorter search that it
  // keeps while the name is being typed must not outlive it.
  it('точное ФИО, которого сервер не отдаёт (неактивный), — строк прошлого поиска не остаётся', async () => {
    const PETRO: PlannerPerson = { ...OLENA, user_id: 'u-petro', full_name: 'Петро Сидоренко' }
    api.searchPeople.mockImplementation(async (q: string) => ({
      items: q === 'Пе' ? [PETRO] : [],
    }))
    renderWithClient(<PeoplePicker value={[OLENA]} onChange={vi.fn()} />)
    const user = userEvent.setup()
    const field = screen.getByLabelText('Виконавці')
    await user.type(field, 'Пе')
    expect(
      await screen.findByRole('button', { name: 'Петро Сидоренко · Склад · Приймання' })
    ).toBeInTheDocument()

    await user.type(field, 'тро Сидоренко ')
    await waitFor(() => expect(api.searchPeople).toHaveBeenLastCalledWith('Петро Сидоренко'))
    expect(await screen.findByText('Нікого не знайдено')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Петро Сидоренко ·/ })).toBeNull()
    // The picked person stays a chip, never a line of the results.
    expect(screen.queryByRole('button', { name: /Олена Коваль ·/ })).toBeNull()
  })

  it('счётчик «3 / 10» у исполнителей, «12 / 200» у участников события; предел — не дальше поиска', () => {
    const { unmount } = renderWithClient(<PeoplePicker value={people(3)} onChange={vi.fn()} />)
    expect(screen.getByText('3 / 10')).toBeInTheDocument()
    expect(screen.getByLabelText('Виконавці')).toBeEnabled()
    unmount()
    renderWithClient(
      <PeoplePicker
        value={people(12)}
        onChange={vi.fn()}
        max={PLANNER_EVENT_PARTICIPANTS_MAX}
        label="Учасники"
        placeholder="Кого запросити"
      />
    )
    expect(screen.getByText('12 / 200')).toBeInTheDocument()
    expect(screen.getByLabelText('Учасники')).toBeEnabled()
    expect(screen.getByLabelText('Учасники')).toHaveAttribute('placeholder', 'Кого запросити')
  })

  it('на пределе поле поиска закрыто', () => {
    renderWithClient(<PeoplePicker value={people(10)} onChange={vi.fn()} />)
    expect(screen.getByText('10 / 10')).toBeInTheDocument()
    expect(screen.getByLabelText('Виконавці')).toBeDisabled()
  })

  it('запрос длиннее 100 символов не уходит — поле это говорит; 100 — уходит', async () => {
    renderWithClient(<PeoplePicker value={[]} onChange={vi.fn()} />)
    const field = screen.getByLabelText('Виконавці')
    fireEvent.change(field, { target: { value: 'я'.repeat(PLANNER_PEOPLE_QUERY_MAX + 1) } })
    expect(screen.getByRole('alert')).toHaveTextContent('Запит задовгий — не більше 100 символів')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(field).toHaveAccessibleDescription('Запит задовгий — не більше 100 символів')
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)))
    expect(api.searchPeople).not.toHaveBeenCalled()

    fireEvent.change(field, { target: { value: 'я'.repeat(PLANNER_PEOPLE_QUERY_MAX) } })
    expect(screen.queryByRole('alert')).toBeNull()
    await waitFor(() => expect(api.searchPeople).toHaveBeenCalledTimes(1))
  })

  it('размонтирование до конца паузы — запроса нет (таймер снят)', async () => {
    const { unmount } = renderWithClient(<PeoplePicker value={[]} onChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Виконавці'), { target: { value: 'Олена' } })
    unmount()
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)))
    expect(api.searchPeople).not.toHaveBeenCalled()
  })
})

describe('тост «Скасувати», ошибки по пути отказа (5.1 AC4)', () => {
  async function changeTo(target: string) {
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /^Змінити статус/ }))
    await user.click(await screen.findByRole('menuitem', { name: target }))
  }

  it('смена статуса обратима: тост «SKL-2 → «В роботі»» с «Скасувати» на 5 с, отмена — обратный PATCH', async () => {
    api.patchTask
      .mockResolvedValueOnce({ task: makeTask({ version: 4 }), etag: '"4"' })
      .mockResolvedValueOnce({ task: makeTask({ version: 5 }), etag: '"5"' })
    const { client } = renderWithClient(<StatusChip task={makeCard()} />)
    await changeTo('В роботі')
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
    const [message, options] = toast.success.mock.calls[0]
    expect(message).toBe('SKL-2 → «В роботі»')
    expect(PLANNER_UNDO_MS).toBe(5000)
    expect(options.duration).toBe(PLANNER_UNDO_MS)
    expect(options.action.label).toBe('Скасувати')

    act(() => options.action.onClick())
    // Back to «Нова» under the version the change produced (412 if it moved on).
    await waitFor(() =>
      expect(api.patchTask).toHaveBeenLastCalledWith('0190a0a0-0000-7000-8000-000000000002', 4, {
        status_id: 's-todo',
      })
    )
    // The undo itself offers no second undo — checked once its answer is
    // applied (the task under version 5 is in the cache), not before.
    await waitFor(() =>
      expect(client.getQueryData<{ version: number }>(plannerKeys.task('SKL-2'))?.version).toBe(5)
    )
    expect(api.patchTask).toHaveBeenCalledTimes(2)
    expect(toast.success).toHaveBeenCalledTimes(1)
  })

  it('отмена опоздала (412) — тост о свежей версии, не тихая перезапись', async () => {
    api.patchTask
      .mockResolvedValueOnce({ task: makeTask({ version: 4 }), etag: '"4"' })
      .mockRejectedValueOnce(plannerError(412, 'revision_mismatch'))
    renderWithClient(<StatusChip task={makeCard()} />)
    await changeTo('Готово')
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
    act(() => toast.success.mock.calls[0][1].action.onClick())
    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith('Задачу щойно змінили. Показано свіжу версію.')
    )
  })

  it('из статуса «потребує причини» отмены нет — вернуть без причины нельзя', async () => {
    api.patchTask.mockResolvedValue({ task: makeTask({ version: 4 }), etag: '"4"' })
    renderWithClient(
      <StatusChip
        task={makeCard({ status: { id: 's-rej', name: 'Відхилено', category: 'done' } })}
      />
    )
    await changeTo('Нова')
    await waitFor(() => expect(api.patchTask).toHaveBeenCalledTimes(1))
    expect(toast.success).not.toHaveBeenCalled()
  })

  it.each([
    [
      '429',
      () => plannerError(429, 'rate_limited'),
      'Забагато запитів. Зачекайте хвилину й повторіть',
    ],
    ['500', () => plannerError(500, 'internal'), 'Помилка на боці Планера. Повторіть трохи згодом'],
    [
      '502',
      () => plannerError(502, 'bad_gateway'),
      'Помилка на боці Планера. Повторіть трохи згодом',
    ],
    [
      'обрыв сети',
      () => new AxiosError('Network Error', 'ERR_NETWORK'),
      "Немає зв'язку з Планером. Перевірте мережу й повторіть",
    ],
    [
      '503',
      () => plannerError(503, 'unavailable'),
      'Планер тимчасово недоступний. Решта CRM працює',
    ],
    ['400 без поля', () => plannerError(400, 'invalid'), 'Не вдалося зберегти. Повторіть ще раз'],
  ])('ошибка команды %s — своя фраза', (_, error, text) => {
    toastPlannerError(t, error())
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith(text)
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining('server text'))
  })
})

describe('баннеры, пустые состояния и скелетоны (5.1 AC4)', () => {
  it('один баннер на причину', () => {
    render(
      <PlannerBanners
        banners={[
          { reason: 'prep', tone: 'info', text: 'Режим підготовки' },
          { reason: 'org-stale', tone: 'warning', text: 'Оргструктура застаріла' },
          { reason: 'prep', tone: 'info', text: 'Режим підготовки' },
        ]}
      />
    )
    expect(screen.getAllByText('Режим підготовки')).toHaveLength(1)
    expect(screen.getByText('Оргструктура застаріла')).toBeInTheDocument()
  })

  it('без причин — ничего', () => {
    const { container } = render(<PlannerBanners banners={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('пустое состояние — иконка, одно предложение и не больше одного действия', () => {
    render(
      <PlannerEmptyState
        text="Ви ще не ставили задач"
        action={<button type="button">+ Задача</button>}
      />
    )
    const text = screen.getByText('Ви ще не ставили задач')
    const block = text.parentElement!
    expect(block.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(within(block).getAllByRole('button')).toHaveLength(1)
  })

  it('скелетоны повторяют форму и заняты, спиннера нет', () => {
    const { container } = render(
      <>
        <TaskListSkeleton />
        <BoardSkeleton />
        <PanelSkeleton />
      </>
    )
    expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(3)
    expect(container.querySelector('.animate-spin')).toBeNull()
    expect(screen.getAllByText('Завантаження…')).toHaveLength(2)
    expect(screen.getByText('Завантаження задачі…')).toHaveClass('sr-only')
  })
})
