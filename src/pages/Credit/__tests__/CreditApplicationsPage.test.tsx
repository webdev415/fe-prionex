/**
 * Раздел «Кредитный модуль» → Заявки.
 *
 * Что здесь защищается:
 *  - список показывает то, что вернул модуль, и ведёт в карточку (иначе очередь
 *    бесполезна);
 *  - фильтр по статусу уходит в запрос, а не фильтрует локально: страниц много,
 *    локальная фильтрация показывала бы верификатору неполную очередь;
 *  - статусы переключает один ряд «таблеток», и счёт в них — из сводки, а не
 *    выдумывается нулями (без сводки чисел нет);
 *  - даты создания и последнего движения уходят в модуль днём, без перевода, и
 *    перевёрнутая пара не уходит вовсе;
 *  - колонка шага появляется по данным модуля, а не по релизу фронта.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom'
import { CreditApplicationsPage } from '../CreditApplicationsPage'
import { CreditLoansPage } from '../CreditLoansPage'
import { CreditUnderwritingQueuePage } from '../CreditUnderwritingQueuePage'
import {
  useCreditApplications,
  useCreditLoans,
  useCreditOverview,
  useCreditUnderwritingQueue,
} from '@/features/credit/hooks/useCredit'
import { CreditApiError } from '@/features/credit/api/creditApi'
import {
  CREDIT_APPLICATION_STATUSES,
  type CreditApplicationsParams,
  type CreditApplicationSummary,
  type CreditLoanSummary,
  type CreditOverview,
  type CreditQueueItem,
} from '@/features/credit/api/types'

// Мокаем ХУКИ, а не HTTP-клиент: живой QueryClient оставляет таймеры
// notifyManager, которые срабатывают уже после teardown jsdom и падают в
// чужом тест-файле («window is not defined»). Странице всё равно, откуда
// данные, — проверяем ровно её поведение.
vi.mock('@/features/credit/hooks/useCredit', () => ({
  useCreditOverview: vi.fn(),
  useCreditApplications: vi.fn(),
  // Два соседних хука — ради параметризованного блока T-FE-6-06 в конце файла:
  // `vi.mock` подменяет модуль ЦЕЛИКОМ, и страницы кредитов и очереди, не
  // перечисленные здесь, получили бы `undefined` вместо хука.
  useCreditLoans: vi.fn(),
  useCreditUnderwritingQueue: vi.fn(),
}))

const OVERVIEW: CreditOverview = {
  role: 'underwriter',
  permissions: ['credit.applications.read', 'credit.decisions.decide'],
  applications: { referred: 2, scoring: 1, declined: 118, disbursed: 257 },
  loans: { active: 61 },
  application_statuses: ['in_progress', 'scoring', 'referred', 'approved', 'declined', 'disbursed'],
  demo_mode: true,
}

const ROW: CreditApplicationSummary = {
  application_id: '11111111-2222-3333-4444-555555555555',
  number: 'DEMO-202608-03A17C',
  status: 'referred',
  product_code: 'CA_AB_PAYDAY',
  channel: 'site',
  jurisdiction: 'CA-AB',
  currency: 'CAD',
  requested_amount_minor: 90_000,
  client_email: 'marie.tremblay@example.ca',
  created_at: '2026-08-29T09:00:00Z',
  updated_at: '2026-08-29T09:05:00Z',
  decision_outcome: 'referred',
  decision_mode: 'automatic',
  final_amount_minor: null,
}

function renderPage(initialEntry = '/dashboard/credit/applications') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CreditApplicationsPage />
    </MemoryRouter>
  )
}

/** «Таблетка» статуса: имя — подпись, затем (если есть сводка) её счёт. */
function pill(status: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^credit\\.status\\.${status}(\\s|$)`) })
}

/** Параметры последнего вызова хука списка — то, что ушло бы в модуль. */
function lastListParams(): CreditApplicationsParams | undefined {
  return vi.mocked(useCreditApplications).mock.lastCall?.[0]
}

function dayField(labelKey: string): HTMLInputElement {
  return screen.getByLabelText(labelKey) as HTMLInputElement
}

/** Текущий адрес страницы и способ последней навигации — чтобы видеть, что стало со ссылкой. */
function UrlProbe() {
  const location = useLocation()
  const navigation = useNavigationType()
  return <output data-testid="url">{`${navigation} ${location.search}`}</output>
}

function renderPageWithUrl(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CreditApplicationsPage />
      <UrlProbe />
    </MemoryRouter>
  )
}

const DATES_URL =
  '/dashboard/credit/applications?created_from=2026-08-31&created_to=2026-09-01&updated_from=2026-09-20&updated_to=2026-09-24'

describe('CreditApplicationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCreditOverview).mockReturnValue({ data: OVERVIEW } as ReturnType<
      typeof useCreditOverview
    >)
    vi.mocked(useCreditApplications).mockReturnValue({
      data: { items: [ROW], next_cursor: null, total: 1 },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCreditApplications>)
  })

  it('показывает заявку из модуля', async () => {
    renderPage()
    expect(await screen.findByText('DEMO-202608-03A17C')).toBeInTheDocument()
    expect(screen.getByText('marie.tremblay@example.ca')).toBeInTheDocument()
    // 90 000 minor = 900.00 CAD: форматирование денег не должно терять масштаб
    expect(screen.getByText(/900[,.]00\s*CAD/)).toBeInTheDocument()
  })

  it('фильтр по статусу уходит в запрос к модулю, а не фильтрует локально', async () => {
    renderPage()
    await screen.findByText('DEMO-202608-03A17C')

    // В тестовой среде i18n замокан и возвращает ключ (см. src/test/setup.ts),
    // поэтому ищем кнопку по ключу перевода, а не по русскому/английскому тексту.
    // Регэксп, а не точная строка: в имени «таблетки» теперь стоит и её счёт.
    fireEvent.click(pill('referred'))

    await waitFor(() => {
      expect(vi.mocked(useCreditApplications)).toHaveBeenCalledWith(
        expect.objectContaining({ status: ['referred'] })
      )
    })
    // Карточек статусов больше нет: выбор виден только по «таблетке».
    await waitFor(() => {
      expect(
        pill('referred').getAttribute('aria-pressed'),
        'выбранная «таблетка» не отмечена'
      ).toBe('true')
    })
    expect(pill('declined').getAttribute('aria-pressed'), 'невыбранная «таблетка» отмечена').toBe(
      'false'
    )
  })

  it('счёт статуса берётся из сводки модуля', async () => {
    renderPage()
    await screen.findByText('DEMO-202608-03A17C')
    // счётчик статуса «ручной разбор» из overview — в самой «таблетке»
    expect(within(pill('referred')).getByText('2')).toBeInTheDocument()
  })

  // Колонка шага. Модуль начал отдавать `resume_step` в сводке позже самого
  // раздела, поэтому колонка обязана появляться ПО ДАННЫМ, а не по релизу
  // фронта: столбец из одних прочерков хуже отсутствующего.
  it('колонки шага нет, пока модуль шаг не отдаёт', async () => {
    renderPage()
    await screen.findByText('DEMO-202608-03A17C')
    expect(screen.queryByText('credit.columns.step')).not.toBeInTheDocument()
  })

  it('колонка шага появляется сама, как только шаг приходит', async () => {
    vi.mocked(useCreditApplications).mockReturnValue({
      data: {
        items: [{ ...ROW, status: 'in_progress', resume_step: 'bank_verification' }],
        next_cursor: null,
        total: 1,
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCreditApplications>)

    renderPage()
    expect(await screen.findByText('credit.columns.step')).toBeInTheDocument()
    // Название шага — из словаря блоков анкеты, а не машинным именем.
    expect(screen.getByText('credit.blocks.bank_verification')).toBeInTheDocument()
  })

  // Время на шаге. Модуль отдаёт его вместе с признаком, ИЗМЕРЕНО оно или
  // подставлено от создания заявки. Подстановка обязана быть подписана:
  // иначе «40 дн» читается как «клиент стоит сорок дней», хотя правда —
  // «ленты переходов тогда не было».
  const withStepTime = (source: 'step' | 'created') => {
    vi.mocked(useCreditApplications).mockReturnValue({
      data: {
        items: [
          {
            ...ROW,
            status: 'in_progress',
            resume_step: 'bank_verification',
            step_entered_at: '2026-08-29T06:00:00Z',
            step_entered_at_source: source,
          },
        ],
        next_cursor: null,
        total: 1,
      },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCreditApplications>)
  }

  it('измеренное время на шаге показывается без оговорки', async () => {
    withStepTime('step')
    renderPage()
    expect(await screen.findByText('credit.columns.onStep')).toBeInTheDocument()
    expect(screen.queryByText(/credit\.idle\.sinceCreated/)).not.toBeInTheDocument()
  })

  it('подставленное время подписано «з моменту створення», а не выдано за измерение', async () => {
    withStepTime('created')
    renderPage()
    await screen.findByText('credit.columns.onStep')
    expect(screen.getByText(/credit\.idle\.sinceCreated/)).toBeInTheDocument()
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Один ряд статусов и фильтры дат.
//
// Статус переключали два ряда одного и того же параметра `status` — «таблетки»
// и кликабельные карточки статусов. Остаётся один: «таблетки» со счётом из
// сводки, где ноль тоже виден, а без сводки чисел нет. Даты уходят в модуль
// днём `YYYY-MM-DD` в ключи `created_from`/`created_to`/`updated_from`/
// `updated_to`; границы суток по календарю юрисдикции заявки считает модуль,
// фронт суток не считает. Моки ставятся здесь же, в `beforeEach`: соседний
// параметризованный блок сбрасывает реализации (`mockReset`), и донашивать
// чужие было бы проверкой не того.

describe('заявки: один ряд статусов и даты', () => {
  beforeEach(() => {
    vi.mocked(useCreditOverview).mockReset()
    vi.mocked(useCreditApplications).mockReset()
    vi.mocked(useCreditOverview).mockReturnValue({ data: OVERVIEW, error: null } as ReturnType<
      typeof useCreditOverview
    >)
    vi.mocked(useCreditApplications).mockReturnValue({
      data: { items: [ROW], next_cursor: null, total: 1 },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCreditApplications>)
  })

  const statusButtons = () => screen.getAllByRole('button', { name: /^credit\.status\./ })

  it('над таблицей один ряд статусов — восемь «таблеток» по контракту, в его порядке', async () => {
    renderPage()
    await screen.findByText('DEMO-202608-03A17C')
    // Положительный контроль того же поиска: «таблетка» находится.
    expect(pill('referred')).toBeInTheDocument()
    const buttons = statusButtons()
    expect(
      buttons.length,
      `кнопок статуса ${buttons.length}, а не 8: второй ряд статусов вернулся`
    ).toBe(8)
    buttons.forEach((button, index) => {
      expect(
        button.textContent?.startsWith(`credit.status.${CREDIT_APPLICATION_STATUSES[index]}`),
        `кнопка ${index} — не «таблетка» ${CREDIT_APPLICATION_STATUSES[index]}`
      ).toBe(true)
    })
  })

  it('счёт «таблетки» — из сводки модуля, ноль виден', async () => {
    renderPage()
    await screen.findByText('DEMO-202608-03A17C')
    // `approved` сводка объявляет (`application_statuses`), но ключа в счётчиках
    // нет — это ноль в проекте, и он виден.
    const expected: Array<[string, string]> = [
      ['referred', '2'],
      ['declined', '118'],
      ['disbursed', '257'],
      ['approved', '0'],
    ]
    for (const [status, count] of expected) {
      expect(
        within(pill(status)).queryByText(count),
        `в «таблетке» ${status} нет счёта ${count} из сводки`
      ).not.toBeNull()
    }
    // Положительный контроль сцены «без сводки чисел нет»: цифра здесь есть.
    expect(/\d/.test(pill('referred').textContent ?? '')).toBe(true)
  })

  it('статус, которого сводка не считает, стоит без числа, а не с выдуманным нулём', async () => {
    renderPage()
    await screen.findByText('DEMO-202608-03A17C')
    // `expired` и `contracted` в `OVERVIEW.application_statuses` нет.
    for (const status of ['expired', 'contracted']) {
      expect(
        /\d/.test(pill(status).textContent ?? ''),
        `«таблетка» ${status} получила число, хотя сводка этот статус не считает`
      ).toBe(false)
    }
  })

  it('без сводки «таблетки» стоят без чисел — неизвестное не выдаётся за ноль', async () => {
    vi.mocked(useCreditOverview).mockReturnValue({
      data: undefined,
      error: new CreditApiError('forbidden', 403, 'forbidden'),
    } as unknown as ReturnType<typeof useCreditOverview>)
    renderPage()
    await screen.findByText('DEMO-202608-03A17C')
    const buttons = statusButtons()
    expect(buttons).toHaveLength(8)
    for (const button of buttons) {
      expect(
        /\d/.test(button.textContent ?? ''),
        `без сводки в «таблетке» число: «${button.textContent}»`
      ).toBe(false)
    }
  })

  it('денежные карточки и конверсия остались и не кликабельны', async () => {
    renderPage()
    await screen.findByText('DEMO-202608-03A17C')
    for (const key of ['credit.metrics.requested', 'credit.metrics.conversion']) {
      const card = screen.getByText(key)
      expect(card.closest('button'), `карточка ${key} стала кнопкой`).toBeNull()
    }
  })

  it('даты из ссылки доходят до запроса днём, каждая в свой ключ', async () => {
    renderPage(DATES_URL)
    await screen.findByText('DEMO-202608-03A17C')
    const params = lastListParams()
    expect(params?.created_from, 'created_from из ссылки не дошёл до запроса').toBe('2026-08-31')
    expect(params?.created_to, 'created_to из ссылки не дошёл до запроса').toBe('2026-09-01')
    expect(params?.updated_from, 'updated_from из ссылки не дошёл до запроса').toBe('2026-09-20')
    expect(params?.updated_to, 'updated_to из ссылки не дошёл до запроса').toBe('2026-09-24')
    expect(dayField('credit.filters.createdFrom').value, 'поле «Створено з» не из ссылки').toBe(
      '2026-08-31'
    )
    expect(dayField('credit.filters.createdTo').value, 'поле «Створено по» не из ссылки').toBe(
      '2026-09-01'
    )
    expect(dayField('credit.filters.updatedFrom').value, 'поле «Останній рух з» не из ссылки').toBe(
      '2026-09-20'
    )
    expect(dayField('credit.filters.updatedTo').value, 'поле «Останній рух по» не из ссылки').toBe(
      '2026-09-24'
    )
  })

  const FIELDS: Array<[string, keyof CreditApplicationsParams, string]> = [
    ['credit.filters.createdFrom', 'created_from', '2026-08-31'],
    ['credit.filters.createdTo', 'created_to', '2026-09-01'],
    ['credit.filters.updatedFrom', 'updated_from', '2026-09-20'],
    ['credit.filters.updatedTo', 'updated_to', '2026-09-24'],
  ]

  it.each(FIELDS)(
    'поле %s пишет свой параметр %s и возвращает на первую страницу',
    async (labelKey, key, day) => {
      renderPage('/dashboard/credit/applications?page=3')
      await screen.findByText('DEMO-202608-03A17C')
      expect(lastListParams()?.cursor, 'сцена не про то: старт не с третьей страницы').toBeDefined()
      fireEvent.change(dayField(labelKey), { target: { value: day } })
      await waitFor(() => {
        expect(lastListParams()?.[key], `${labelKey} не записало ${key}`).toBe(day)
      })
      const params = lastListParams()
      for (const [, otherKey] of FIELDS) {
        if (otherKey === key) continue
        expect(params?.[otherKey], `${labelKey} записало чужой ключ ${otherKey}`).toBeUndefined()
      }
      expect(params?.cursor, `${labelKey} не вернуло на первую страницу`).toBeUndefined()
    }
  )

  it('«Сброс» чистит и четыре даты', async () => {
    renderPage(DATES_URL)
    await screen.findByText('DEMO-202608-03A17C')
    fireEvent.click(screen.getByRole('button', { name: 'credit.actions.reset' }))
    await waitFor(() => {
      const params = lastListParams()
      for (const [labelKey, key] of FIELDS) {
        expect(params?.[key], `«Сброс» не очистил ${key}`).toBeUndefined()
        expect(dayField(labelKey).value, `«Сброс» не очистил поле ${labelKey}`).toBe('')
      }
    })
  })

  it('мусор в ссылке вместо дня в запрос не уходит', async () => {
    renderPage('/dashboard/credit/applications?created_from=31.08.2026')
    await screen.findByText('DEMO-202608-03A17C')
    expect(lastListParams()?.created_from, 'мусор из ссылки ушёл в запрос как дата').toBeUndefined()
    expect(dayField('credit.filters.createdFrom').value).toBe('')
  })

  it.each([
    [
      '?created_from=2026-08-31&updated_to=2026-09-24',
      { createdTo: ['min', '2026-08-31'], updatedFrom: ['max', '2026-09-24'] },
      { createdFrom: 'max', updatedTo: 'min' },
    ],
    [
      '?created_to=2026-09-01&updated_from=2026-09-20',
      { createdFrom: ['max', '2026-09-01'], updatedTo: ['min', '2026-09-20'] },
      { createdTo: 'min', updatedFrom: 'max' },
    ],
  ] as Array<[string, Record<string, [string, string]>, Record<string, string>]>)(
    'соседнее поле пары ограничивает календарь (%s)',
    async (search, bounded, unbounded) => {
      renderPage(`/dashboard/credit/applications${search}`)
      await screen.findByText('DEMO-202608-03A17C')
      for (const [field, [attribute, day]] of Object.entries(bounded)) {
        expect(
          dayField(`credit.filters.${field}`).getAttribute(attribute),
          `у поля ${field} нет ${attribute} ${day} от соседа по паре`
        ).toBe(day)
      }
      for (const [field, attribute] of Object.entries(unbounded)) {
        expect(
          dayField(`credit.filters.${field}`).hasAttribute(attribute),
          `у поля ${field} ${attribute} без соседа по паре`
        ).toBe(false)
      }
    }
  )

  it.each(['', '?created_from=2026-08-31'])(
    'подсказка о календаре провинции видна всегда (%s)',
    async (search) => {
      renderPage(`/dashboard/credit/applications${search}`)
      await screen.findByText('DEMO-202608-03A17C')
      expect(
        screen.queryByText('credit.filters.calendarHint'),
        'подсказки о календаре провинции нет'
      ).not.toBeNull()
    }
  )

  it('без поиска и дат подписи счётчиков нет', async () => {
    renderPage()
    await screen.findByText('DEMO-202608-03A17C')
    expect(
      screen.queryByText('credit.applications.statusCountsHint'),
      'подпись счётчиков видна без поиска и дат'
    ).toBeNull()
  })

  it.each([
    '?q=demo',
    '?created_from=2026-08-31',
    '?created_to=2026-09-01',
    '?updated_from=2026-09-20',
    '?updated_to=2026-09-24',
  ])('при сужении списка (%s) подпись счётчиков видна', async (search) => {
    renderPage(`/dashboard/credit/applications${search}`)
    await screen.findByText('DEMO-202608-03A17C')
    expect(
      screen.queryByText('credit.applications.statusCountsHint'),
      `список сужен (${search}), а подписи, что счётчики по всему разделу, нет`
    ).not.toBeNull()
  })

  it('перевёрнутая пара не уходит, помечена одной строкой, вторая пара уходит', async () => {
    renderPage(
      '/dashboard/credit/applications?created_from=2026-09-02&created_to=2026-08-31&updated_from=2026-09-20'
    )
    await screen.findByText('DEMO-202608-03A17C')
    const params = lastListParams()
    expect(params?.created_from, 'перевёрнутая пара ушла в запрос (created_from)').toBeUndefined()
    expect(params?.created_to, 'перевёрнутая пара ушла в запрос (created_to)').toBeUndefined()
    expect(params?.updated_from, 'вторая пара пострадала от перевёрнутой').toBe('2026-09-20')

    const hints = screen.getAllByText('credit.filters.rangeInverted')
    expect(hints, 'строк о перевёрнутом диапазоне не одна').toHaveLength(1)
    const hintId = hints[0].id
    expect(hintId, 'у строки о перевёрнутом диапазоне нет id').not.toBe('')
    for (const labelKey of ['credit.filters.createdFrom', 'credit.filters.createdTo']) {
      const field = dayField(labelKey)
      expect(field.getAttribute('aria-invalid'), `поле ${labelKey} не помечено`).toBe('true')
      expect(
        field.getAttribute('aria-describedby'),
        `поле ${labelKey} не ссылается на строку о перевёрнутом диапазоне`
      ).toBe(hintId)
      const label = field.closest('label')
      expect(label).not.toBeNull()
      expect(
        within(label as HTMLElement).queryByRole('alert'),
        `у поля ${labelKey} своя строка ошибки`
      ).toBeNull()
    }
    expect(
      dayField('credit.filters.updatedFrom').getAttribute('aria-invalid'),
      'поле второй пары помечено перевёрнутым'
    ).not.toBe('true')
  })

  it('форма фильтров не отдаёт даты на суд браузеру: min/max — подсказка, не запрет', async () => {
    renderPage()
    await screen.findByText('DEMO-202608-03A17C')
    const form = screen
      .getByPlaceholderText('credit.applications.searchPlaceholder')
      .closest('form')
    expect(form, 'поле поиска не в форме фильтров').not.toBeNull()
    expect(
      (form as HTMLFormElement).noValidate,
      'браузер проверяет min/max полей дат и молча блокирует «Пошук» при перевёрнутой паре'
    ).toBe(true)
  })

  it('выбор дня применяет и набранный, но не отправленный поиск', async () => {
    renderPage()
    await screen.findByText('DEMO-202608-03A17C')
    fireEvent.change(screen.getByPlaceholderText('credit.applications.searchPlaceholder'), {
      target: { value: 'demo' },
    })
    // Положительный контроль: набранный поиск без «Пошук» в запрос ещё не ушёл.
    expect(lastListParams()?.query).toBeUndefined()
    fireEvent.change(dayField('credit.filters.createdFrom'), { target: { value: '2026-08-31' } })
    await waitFor(() => {
      expect(lastListParams()?.created_from).toBe('2026-08-31')
    })
    expect(
      lastListParams()?.query,
      'выбор дня потерял набранный поиск: в поле один поиск, в запросе другой'
    ).toBe('demo')
  })

  it.each([
    ['created', '?created_from=2026-09-02&created_to=2026-08-31'],
    ['updated', '?updated_from=2026-09-24&updated_to=2026-09-20'],
  ])('перевёрнутая пара %s громко названа над таблицей', async (_pair, search) => {
    renderPage(`/dashboard/credit/applications${search}`)
    await screen.findByText('DEMO-202608-03A17C')
    expect(
      screen.queryByText('credit.applications.dateRangeNotApplied'),
      `перевёрнутая пара (${search}) молча расширила список: плашки над таблицей нет`
    ).not.toBeNull()
  })

  it.each(['', '?created_from=2026-08-31&created_to=2026-08-31'])(
    'без перевёрнутой пары плашки нет (%s)',
    async (search) => {
      renderPage(`/dashboard/credit/applications${search}`)
      await screen.findByText('DEMO-202608-03A17C')
      expect(
        screen.queryByText('credit.applications.dateRangeNotApplied'),
        'плашка «фильтр дат не применён» без перевёрнутой пары'
      ).toBeNull()
    }
  )

  it('мусор вместо дня уходит и из ссылки — заменой, без шага истории', async () => {
    renderPageWithUrl('/dashboard/credit/applications?created_from=31.08.2026&q=demo')
    await screen.findByText('DEMO-202608-03A17C')
    await waitFor(() => {
      expect(
        screen.getByTestId('url').textContent,
        'мусор вместо дня остался в ссылке'
      ).not.toContain('created_from')
    })
    const url = screen.getByTestId('url').textContent ?? ''
    // Положительный контроль: остальная ссылка на месте, а не стёрта целиком.
    expect(url, 'вместе с мусором из ссылки ушёл поиск').toContain('q=demo')
    expect(url.startsWith('REPLACE '), `ссылка поправлена новым шагом истории: ${url}`).toBe(true)
  })

  it('равные границы — законный один день: уходят обе, пометки нет', async () => {
    renderPage('/dashboard/credit/applications?created_from=2026-08-31&created_to=2026-08-31')
    await screen.findByText('DEMO-202608-03A17C')
    const params = lastListParams()
    expect(params?.created_from, 'один день не ушёл (created_from)').toBe('2026-08-31')
    expect(params?.created_to, 'один день не ушёл (created_to)').toBe('2026-08-31')
    for (const labelKey of ['credit.filters.createdFrom', 'credit.filters.createdTo']) {
      expect(
        dayField(labelKey).getAttribute('aria-invalid'),
        `один день помечен перевёрнутым (${labelKey})`
      ).not.toBe('true')
    }
    expect(
      screen.queryByText('credit.filters.rangeInverted'),
      'один день назван перевёрнутым диапазоном'
    ).toBeNull()
  })
})

// ───────────────────────────────────────────────────────────────────────────
// T-FE-6-06 — два разных отказа на трёх операторских страницах раздела.
//
// Предмет: полноэкранная подмена `CreditModuleUnavailable` наступает ТОЛЬКО
// когда показывать нечего. «Нечего» — это не «запрос отказал», а «данных на
// экране нет»: у списков заявок и кредитов стоит `placeholderData`, а у всех
// трёх хуков прежний успешный ответ переживает упавший рефетч, поэтому
// состояние «строки есть И ошибка есть» штатное, и подмена в нём снесла бы с
// экрана видимые строки — ровно то, что правило запрещает.
//
// Блок живёт в этом файле по норме (T-FE-6-06), но параметризован по трём
// страницам: правило одно, и проверять его на одной из трёх значило бы
// оставить две другие без знака.

// Счётчики РАЗНЫЕ у двух страниц: общее число проходило бы утверждение и
// тогда, когда страница заявок случайно нарисовала бы счётчик портфеля.
// Оба трёхзначные НАМЕРЕННО: `formatCreditCount` гонит значение через
// `Intl.NumberFormat` (locale пришпилен к `C.UTF-8` в vitest.config.ts), и
// четырёхзначное вышло бы на экран как «4,242» — тогда утверждение «счётчика
// нет» было бы зелёным при ЛЮБОЙ реализации, проверкой пустого множества.
const APPLICATIONS_COUNTER = 777
const LOANS_COUNTER = 778

const PARAM_OVERVIEW: CreditOverview = {
  role: 'underwriter',
  permissions: ['credit.applications.read', 'credit.loans.read', 'credit.decisions.decide'],
  applications: { referred: APPLICATIONS_COUNTER },
  loans: { active: LOANS_COUNTER },
  application_statuses: ['in_progress', 'scoring', 'referred', 'approved', 'declined', 'disbursed'],
  demo_mode: true,
}

/** Снимок живой строки стенда `GET /loans` (FB-000074). */
const LOAN_ROW: CreditLoanSummary = {
  loan_id: 'a249ee86-b723-483a-bbba-1ad400cc5bdd',
  contract_number: 'FB-000074',
  product_code: 'CA_AB_PAYDAY',
  status: 'active',
  currency: 'CAD',
  principal_minor: 30_000,
  total_payable_minor: 34_200,
  delinquency_days: 0,
  client_email: 'info+fullpath-happy@loanbridge.ca',
  disbursed_at: '2026-08-31T18:27:54.336420+00:00',
  maturity_date: '2026-10-12',
  application_id: '62386a7c-c8e6-4668-a7da-fa120472bb38',
}

/** Снимок живой строки стенда `GET /underwriting/queue?status=pending`. */
const QUEUE_ROW: CreditQueueItem = {
  application_id: 'a5f957e1-6b72-43a1-9076-12e1665a2b72',
  decision_id: 'f5b1f3bd-1d58-4233-8561-e1df3830c26f',
  status: 'pending',
  assigned_to: null,
  referred_at: '2026-08-31T13:28:02.999780+00:00',
  requested_amount_minor: 30_000,
  currency: 'CAD',
  product_code: 'CA_AB_PAYDAY',
}

const OWN_FAILED = new Error('own request failed')
/** Отказ рефетча при живом кэше: у списка есть и строки, и ошибка. */
const OWN_REFETCH_FAILED = new CreditApiError('upstream boom', 500, 'internal')

interface ListState {
  data?: unknown
  isLoading: boolean
  error: unknown
}

// `overviewCounter` — число, которое страница берёт ИЗ ОБЗОРА. У очереди
// разбора его нет вовсе (счёт идёт по `items.length`, метрик-карточек на
// странице не существует), и требовать там «счётчик пропал» значило бы
// проверять пустое множество: утверждение было бы зелёным при любой
// реализации. Для очереди положительный предмет — строки на экране.
const PAGES = [
  {
    name: 'заявки',
    Page: CreditApplicationsPage,
    route: '/dashboard/credit/applications',
    // Смысловой маркер строки, а не форма её показа.
    ownRow: 'DEMO-202608-03A17C' as string | RegExp,
    overviewCounter: APPLICATIONS_COUNTER as number | null,
    emptyKey: 'credit.applications.empty',
    mockList: (state: ListState) =>
      vi
        .mocked(useCreditApplications)
        .mockReturnValue(state as unknown as ReturnType<typeof useCreditApplications>),
    listData: { items: [ROW], next_cursor: null, total: 1 },
    emptyData: { items: [], next_cursor: null, total: 0 },
  },
  {
    name: 'кредиты',
    Page: CreditLoansPage,
    route: '/dashboard/credit/loans',
    ownRow: 'FB-000074' as string | RegExp,
    overviewCounter: LOANS_COUNTER as number | null,
    emptyKey: 'credit.loans.empty',
    mockList: (state: ListState) =>
      vi
        .mocked(useCreditLoans)
        .mockReturnValue(state as unknown as ReturnType<typeof useCreditLoans>),
    listData: { items: [LOAN_ROW], next_cursor: null, total: 1 },
    emptyData: { items: [], next_cursor: null, total: 0 },
  },
  {
    name: 'очередь разбора',
    Page: CreditUnderwritingQueuePage,
    route: '/dashboard/credit/underwriting',
    // Префикс идентификатора, а не его усечённая форма: колонка показывает
    // `slice(0, 8)` с многоточием, и утверждение по готовой строке ломалось бы
    // от косметики показа, не имеющей отношения к предмету.
    ownRow: /^a5f957e1/ as string | RegExp,
    overviewCounter: null as number | null,
    emptyKey: 'credit.queue.empty',
    mockList: (state: ListState) =>
      vi
        .mocked(useCreditUnderwritingQueue)
        .mockReturnValue(state as unknown as ReturnType<typeof useCreditUnderwritingQueue>),
    listData: { items: [QUEUE_ROW], next_cursor: null },
    emptyData: { items: [], next_cursor: null },
  },
]

function mockOverview(state: { data?: CreditOverview; error: unknown }) {
  vi.mocked(useCreditOverview).mockReturnValue(
    state as unknown as ReturnType<typeof useCreditOverview>
  )
}

/** Ни одного из трёх экранов подмены на странице. */
function expectNoSubstitution() {
  expect(screen.queryByText('credit.unavailable.title')).toBeNull()
  expect(screen.queryByText('credit.access.notAuthenticated')).toBeNull()
  expect(screen.queryByText('credit.access.noRights')).toBeNull()
}

describe.each(PAGES)(
  'раздел «Кредити» → $name: отказ обзора и отказ своего запроса — разные события',
  ({ Page, route, ownRow, overviewCounter, emptyKey, mockList, listData, emptyData }) => {
    beforeEach(() => {
      // `mockReset`, а не `clearAllMocks`: последний снимает записи о вызовах,
      // но ОСТАВЛЯЕТ реализацию, поставленную соседним describe этого файла.
      // Без сброса случай, забывший замокать свой хук, донашивал бы чужой
      // ответ и был бы зелёным не про то.
      vi.mocked(useCreditOverview).mockReset()
      vi.mocked(useCreditApplications).mockReset()
      vi.mocked(useCreditLoans).mockReset()
      vi.mocked(useCreditUnderwritingQueue).mockReset()
    })

    function renderIt() {
      return render(
        <MemoryRouter initialEntries={[route]}>
          <Page />
        </MemoryRouter>
      )
    }

    // (0) ПОЛОЖИТЕЛЬНЫЙ КОНТРОЛЬ. Без него утверждение «счётчик пропал» ничего
    // не значит: оно зелёное и тогда, когда счётчик не появлялся никогда.
    it(
      overviewCounter === null
        ? 'положительный контроль: строки списка на экране'
        : 'положительный контроль: на живом обзоре счётчик из сводки ВИДЕН',
      async () => {
        mockOverview({ data: PARAM_OVERVIEW, error: null })
        mockList({ data: listData, isLoading: false, error: null })

        renderIt()
        expect(await screen.findByText(ownRow)).toBeInTheDocument()
        if (overviewCounter !== null) {
          expect(screen.getByText(String(overviewCounter))).toBeInTheDocument()
        }
        expectNoSubstitution()
      }
    )

    // (а) ОТКАЗ ТОЛЬКО ОБЗОРА — предмет правки.
    it('отказ обзора оставляет свои строки на экране и деградирует шапку', async () => {
      mockOverview({ data: undefined, error: new CreditApiError('forbidden', 403, 'forbidden') })
      mockList({ data: listData, isLoading: false, error: null })

      renderIt()
      expect(await screen.findByText(ownRow)).toBeInTheDocument()
      expectNoSubstitution()
      if (overviewCounter !== null) {
        expect(screen.queryByText(String(overviewCounter))).toBeNull()
      }
    })

    // (б) ОТКАЗ ТОЛЬКО СОБСТВЕННОГО ЗАПРОСА — фиксация сегодняшнего поведения.
    // Зелёный случай означает «врезку не потеряли», а НЕ «подмену на своей
    // ошибке сохранили»: такого поведения нет и вводить его запрещено.
    it('отказ своего запроса остаётся врезкой, экран не подменяется', async () => {
      mockOverview({ data: PARAM_OVERVIEW, error: null })
      mockList({ data: undefined, isLoading: false, error: OWN_FAILED })

      renderIt()
      expect(await screen.findByText('own request failed')).toBeInTheDocument()
      expectNoSubstitution()
    })

    // (в) ОТКАЗАЛИ ОБА, НО СТРОКИ НА ЭКРАНЕ ЕСТЬ (кэш прежнего ответа пережил
    // упавший рефетч). «Показывать нечего» ложно — подмены быть не должно, и
    // врезка с текстом ошибки остаётся.
    it('упавший рефетч при живых строках не подменяет экран', async () => {
      mockOverview({ data: undefined, error: new CreditApiError('forbidden', 403, 'forbidden') })
      mockList({ data: listData, isLoading: false, error: OWN_REFETCH_FAILED })

      renderIt()
      expect(await screen.findByText(ownRow)).toBeInTheDocument()
      expectNoSubstitution()
      expect(screen.getByText('upstream boom')).toBeInTheDocument()
    })

    // (г) ПУСТОЙ УСПЕШНЫЙ СПИСОК ПРИ ОТКАЗЕ ОБЗОРА. Закрепляется как ОСОЗНАННОЕ
    // поведение: обзор — демо-ручка, и на не-демо стенде его 403 штатен, а
    // пустой список законен. Оператор читает «нет записей», а не объяснение
    // про отказ обзора; выбор сцены — открытая строка владельцу fe.
    it('пустой успешный список при отказе обзора показывает пустое состояние, не подмену', async () => {
      mockOverview({ data: undefined, error: new CreditApiError('forbidden', 403, 'forbidden') })
      mockList({ data: emptyData, isLoading: false, error: null })

      renderIt()
      expect(await screen.findByText(emptyKey)).toBeInTheDocument()
      expectNoSubstitution()
    })

    // (д) СЦЕНА «ПОКАЗЫВАТЬ НЕЧЕГО»: отказали оба И данных нет. Подмена
    // сохраняется, и выбирается она ПО СТАТУСУ — поэтому три статуса подряд,
    // каждый со своим текстом. Без этого случая сужение условия неотличимо от
    // снятия подмены вообще, а два из трёх ключей `expectNoSubstitution`
    // никогда не проверялись положительно.
    it.each([
      [404, 'credit.unavailable.title'],
      [401, 'credit.access.notAuthenticated'],
      [403, 'credit.access.noRights'],
    ])('отказ обоих запросов без данных подменяет экран целиком (%i)', async (status, key) => {
      const failure = new CreditApiError(`boom ${status}`, status, 'failed')
      mockOverview({ data: undefined, error: failure })
      mockList({ data: undefined, isLoading: false, error: failure })

      renderIt()
      expect(await screen.findByText(key)).toBeInTheDocument()
      expect(screen.queryByText(ownRow)).toBeNull()
    })

    // (е) NULLABLE РОЛЬ. Случай СТОРОЖЕВОЙ: сегодня `overview.role` не читает
    // ни одна из трёх страниц (замер `grep -rn 'overview\.role' src` → 0),
    // поэтому покраснеть он не может ни от какой реализации. Покраснеет, когда
    // внутри этих страниц появится первый читатель без проверки на null —
    // `overview.role.toUpperCase()` и подобное.
    it('role: null рендерится так же, как непустая роль', async () => {
      mockOverview({ data: { ...PARAM_OVERVIEW, role: null }, error: null })
      mockList({ data: listData, isLoading: false, error: null })

      renderIt()
      expect(await screen.findByText(ownRow)).toBeInTheDocument()
      if (overviewCounter !== null) {
        expect(screen.getByText(String(overviewCounter))).toBeInTheDocument()
      }
      expectNoSubstitution()
    })
  }
)

// Форма фикстуры обзора. Отдельно от параметризации: утверждение к странице
// отношения не имеет и трижды не нужно.
describe('контракт обзора 0.1.26', () => {
  // Имя снятого поля собирается из частей НАМЕРЕННО. Знак единицы — поиск
  // этого имени по `src` с нулём попаданий; страж, написавший его буквально
  // (хоть в утверждении, хоть в комментарии), сам бы знак и сломал: куратору
  // пришлось бы принимать «ноль строк, кроме моего теста», то есть знак был бы
  // уже не про дерево.
  const REMOVED_OVERVIEW_FIELD = ['roles', 'available'].join('_')

  it('фикстура обзора не объявляет снятое контрактом поле', () => {
    expect(REMOVED_OVERVIEW_FIELD in PARAM_OVERVIEW).toBe(false)
    // Точный состав: краснеет на ЛЮБОМ лишнем или потерянном поле, не только
    // на снятом. Что фикстура аннотирована типом, а не приведена через
    // `as unknown`, стережёт `tsc`: под двойным приведением
    // excess-property-check молчит и возврат поля прошёл бы незамеченным.
    const typed: CreditOverview = PARAM_OVERVIEW
    expect(Object.keys(typed).sort()).toEqual(
      ['application_statuses', 'applications', 'demo_mode', 'loans', 'permissions', 'role'].sort()
    )
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 18-13c — фильтры меток. Отбор делает модуль (`listInternalApplications`):
// фильтр по одной странице врал бы. Текст меток применяется вместе с поиском —
// по «Пошук» и выбором дня, — «click_id є/немає» применяется сразу, как день.
// Значения живут в ссылке: её пересылают коллеге.
describe('18-13c: фильтры меток', () => {
  beforeEach(() => {
    vi.mocked(useCreditOverview).mockReset()
    vi.mocked(useCreditApplications).mockReset()
    vi.mocked(useCreditOverview).mockReturnValue({ data: OVERVIEW, error: null } as ReturnType<
      typeof useCreditOverview
    >)
    vi.mocked(useCreditApplications).mockReturnValue({
      data: { items: [ROW], next_cursor: null, total: 1 },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useCreditApplications>)
  })

  const TEXT_FIELDS: Array<[string, 'utm_source' | 'utm_campaign' | 'click_id']> = [
    ['credit.filters.utmSource', 'utm_source'],
    ['credit.filters.utmCampaign', 'utm_campaign'],
    ['credit.filters.clickId', 'click_id'],
  ]
  const TAG_PARAMS = ['utm_source', 'utm_campaign', 'click_id', 'has_click_id'] as const

  const field = (labelKey: string) => screen.getByLabelText(labelKey) as HTMLInputElement
  const hasClickSelect = () =>
    screen.getByLabelText('credit.filters.hasClickId') as HTMLSelectElement
  const search = () =>
    fireEvent.click(screen.getByRole('button', { name: 'credit.actions.search' }))

  it('три поля и список «click_id» — с подписями из словаря, список из трёх вариантов', async () => {
    renderPage()
    await screen.findByText('DEMO-202608-03A17C')
    for (const [labelKey] of TEXT_FIELDS) {
      expect(field(labelKey).tagName, `${labelKey} — не поле ввода`).toBe('INPUT')
    }
    const options = Array.from(hasClickSelect().options).map((option) => [
      option.value,
      option.textContent,
    ])
    expect(options).toEqual([
      ['', 'credit.filters.hasClickIdAny'],
      ['true', 'credit.filters.hasClickIdYes'],
      ['false', 'credit.filters.hasClickIdNo'],
    ])
  })

  it.each(TEXT_FIELDS)(
    'поле %s уходит в запрос по «Пошук» обрезанным, пишется в ссылку и возвращает на страницу 1',
    async (labelKey, key) => {
      renderPageWithUrl('/dashboard/credit/applications?page=3')
      await screen.findByText('DEMO-202608-03A17C')
      expect(lastListParams()?.cursor, 'сцена не про то: старт не с третьей страницы').toBeDefined()
      fireEvent.change(field(labelKey), { target: { value: '  partner1 ' } })
      // Положительный контроль: набранное без «Пошук» в запрос не ушло.
      expect(lastListParams()?.[key], `${key} ушёл в запрос без «Пошук»`).toBeUndefined()
      search()
      await waitFor(() => {
        expect(lastListParams()?.[key], `${labelKey} не дошло до запроса`).toBe('partner1')
      })
      const params = lastListParams()
      for (const other of TAG_PARAMS) {
        if (other === key) continue
        expect(params?.[other], `${labelKey} записало чужой ключ ${other}`).toBeUndefined()
      }
      expect(params?.cursor, `${labelKey} не вернуло на первую страницу`).toBeUndefined()
      await waitFor(() => {
        expect(screen.getByTestId('url').textContent, `${key} не попал в ссылку`).toContain(
          `${key}=partner1`
        )
      })
    }
  )

  it('пробельная метка по «Пошук» не уходит', async () => {
    renderPage()
    await screen.findByText('DEMO-202608-03A17C')
    fireEvent.change(field('credit.filters.utmCampaign'), { target: { value: '   ' } })
    fireEvent.change(field('credit.filters.utmSource'), { target: { value: 'google' } })
    search()
    await waitFor(() => {
      expect(lastListParams()?.utm_source).toBe('google')
    })
    expect(lastListParams()?.utm_campaign, 'пробельный utm_campaign ушёл в запрос').toBeUndefined()
  })

  it('выбор дня применяет и набранные, но не отправленные метки', async () => {
    renderPage()
    await screen.findByText('DEMO-202608-03A17C')
    fireEvent.change(field('credit.filters.utmSource'), { target: { value: 'google' } })
    fireEvent.change(field('credit.filters.clickId'), { target: { value: 'ck-1' } })
    expect(lastListParams()?.utm_source).toBeUndefined()
    fireEvent.change(dayField('credit.filters.createdFrom'), { target: { value: '2026-08-31' } })
    await waitFor(() => {
      expect(lastListParams()?.created_from).toBe('2026-08-31')
    })
    expect(
      lastListParams()?.utm_source,
      'выбор дня потерял набранный utm_source: в поле одно, в запросе другое'
    ).toBe('google')
    expect(lastListParams()?.click_id, 'выбор дня потерял набранный click_id').toBe('ck-1')
  })

  it.each([
    ['false', false],
    ['true', true],
  ] as Array<[string, boolean]>)(
    'список «click_id» = %s применяется сразу, без «Пошук», и возвращает на страницу 1',
    async (value, expected) => {
      renderPageWithUrl('/dashboard/credit/applications?page=3')
      await screen.findByText('DEMO-202608-03A17C')
      expect(lastListParams()?.has_click_id, 'фильтр стоит до выбора').toBeUndefined()
      fireEvent.change(hasClickSelect(), { target: { value } })
      await waitFor(() => {
        expect(lastListParams()?.has_click_id, 'выбор не дошёл до запроса').toBe(expected)
      })
      expect(lastListParams()?.cursor, 'выбор не вернул на первую страницу').toBeUndefined()
      await waitFor(() => {
        expect(screen.getByTestId('url').textContent).toContain(`has_click_id=${value}`)
      })
    }
  )

  it('ссылка с метками открывает список уже отфильтрованным', async () => {
    renderPage('/dashboard/credit/applications?click_id=abc&has_click_id=true&utm_source=google')
    await screen.findByText('DEMO-202608-03A17C')
    const params = lastListParams()
    expect(params?.click_id, 'click_id из ссылки не дошёл до запроса').toBe('abc')
    expect(params?.has_click_id, 'has_click_id из ссылки не дошёл до запроса').toBe(true)
    expect(params?.utm_source).toBe('google')
    expect(field('credit.filters.clickId').value, 'поле click_id не из ссылки').toBe('abc')
    expect(field('credit.filters.utmSource').value).toBe('google')
    expect(hasClickSelect().value, 'список click_id не из ссылки').toBe('true')
  })

  it('мусор в has_click_id ссылки фильтром не становится', async () => {
    renderPage('/dashboard/credit/applications?has_click_id=yes')
    await screen.findByText('DEMO-202608-03A17C')
    expect(lastListParams()?.has_click_id, '«yes» из ссылки стал фильтром').toBeUndefined()
    expect(hasClickSelect().value).toBe('')
  })

  it('три поля меток ограничены пределом модуля: maxlength = 512', async () => {
    renderPage()
    await screen.findByText('DEMO-202608-03A17C')
    for (const [labelKey] of TEXT_FIELDS) {
      expect(field(labelKey).getAttribute('maxlength'), `${labelKey} без предела 512`).toBe('512')
    }
  })

  // Мусор в ссылке — тем же правилом, что дни: в запрос не уходит, сужением не
  // считается и из ссылки уходит заменой (пересланная, она несла бы фильтр, которого нет).
  it.each([
    ['пробельный utm_source', 'utm_source', '%20%20'],
    ['click_id длиннее 512', 'click_id', 'x'.repeat(513)],
    ['has_click_id=yes', 'has_click_id', 'yes'],
  ] as Array<[string, (typeof TAG_PARAMS)[number], string]>)(
    'мусор в ссылке (%s): не фильтр, без подписи счётчиков, уходит из ссылки',
    async (_case, key, raw) => {
      renderPageWithUrl(`/dashboard/credit/applications?status=referred&${key}=${raw}`)
      await screen.findByText('DEMO-202608-03A17C')
      const sent = vi.mocked(useCreditApplications).mock.calls.map(([params]) => params?.[key])
      expect(
        sent.every((value) => value === undefined),
        `мусор ${key} ушёл в хук`
      ).toBe(true)
      expect(
        screen.queryByText('credit.applications.statusCountsHint'),
        `мусор ${key} посчитан сужением списка`
      ).toBeNull()
      await waitFor(() => {
        expect(
          screen.getByTestId('url').textContent,
          `мусор ${key} остался в ссылке`
        ).not.toContain(`${key}=`)
      })
      const url = screen.getByTestId('url').textContent ?? ''
      // Положительный контроль: остальная ссылка на месте, а не стёрта целиком.
      expect(url, 'вместе с мусором из ссылки ушёл статус').toContain('status=referred')
      expect(url.startsWith('REPLACE '), `ссылка поправлена новым шагом истории: ${url}`).toBe(true)
    }
  )

  it('выбор в списке «click_id» применяет и набранные, но не отправленные метки', async () => {
    renderPage()
    await screen.findByText('DEMO-202608-03A17C')
    fireEvent.change(field('credit.filters.utmSource'), { target: { value: ' google ' } })
    expect(lastListParams()?.utm_source, 'набранное ушло без применения').toBeUndefined()
    fireEvent.change(hasClickSelect(), { target: { value: 'false' } })
    await waitFor(() => {
      expect(lastListParams()?.has_click_id, 'выбор не дошёл до запроса').toBe(false)
    })
    expect(
      lastListParams()?.utm_source,
      'выбор в списке потерял набранный utm_source: в поле одно, в запросе другое'
    ).toBe('google')
  })

  it('«Скинути» чистит четыре поля и четыре параметра ссылки', async () => {
    renderPageWithUrl(
      '/dashboard/credit/applications?utm_source=a&utm_campaign=b&click_id=c&has_click_id=false'
    )
    await screen.findByText('DEMO-202608-03A17C')
    // Положительный контроль: метки из ссылки стоят.
    expect(lastListParams()?.has_click_id).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'credit.actions.reset' }))
    await waitFor(() => {
      const params = lastListParams()
      for (const key of TAG_PARAMS) {
        expect(params?.[key], `«Скинути» не очистил ${key}`).toBeUndefined()
      }
    })
    for (const [labelKey] of TEXT_FIELDS) {
      expect(field(labelKey).value, `«Скинути» не очистил поле ${labelKey}`).toBe('')
    }
    expect(hasClickSelect().value, '«Скинути» не очистил список click_id').toBe('')
    await waitFor(() => {
      const url = screen.getByTestId('url').textContent ?? ''
      for (const key of TAG_PARAMS) {
        expect(url, `«Скинути» оставил ${key} в ссылке`).not.toContain(`${key}=`)
      }
    })
  })

  it.each([
    '?utm_source=google',
    '?utm_campaign=camp-a',
    '?click_id=abc',
    '?has_click_id=true',
    '?has_click_id=false',
  ])('при сужении меткой (%s) подпись счётчиков видна', async (searchPart) => {
    renderPage(`/dashboard/credit/applications${searchPart}`)
    await screen.findByText('DEMO-202608-03A17C')
    expect(
      screen.queryByText('credit.applications.statusCountsHint'),
      `список сужен меткой (${searchPart}), а подписи, что счётчики по всему разделу, нет`
    ).not.toBeNull()
  })

  it('без меток в ссылке ключей меток в запросе нет', async () => {
    renderPage()
    await screen.findByText('DEMO-202608-03A17C')
    const params = lastListParams()
    for (const key of TAG_PARAMS) {
      expect(params?.[key], `${key} ушёл в хук без фильтра`).toBeUndefined()
    }
  })
})
