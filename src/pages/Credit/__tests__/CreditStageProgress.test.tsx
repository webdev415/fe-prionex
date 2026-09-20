/**
 * Лента этапов в карточке заявки.
 *
 * Проверяется ровно то, ради чего лента заведена: оператор видит ТЕ ЖЕ пять
 * шагов и ТУ ЖЕ нумерацию, что клиент в кабинете, — иначе разговор «я на
 * третьем шаге» превращается в спор о нумерации. Сам расчёт пинуется отдельно
 * (`features/credit/api/__tests__/applicationStages.test.ts`); здесь — что
 * лента вообще доехала до карточки и что подписи берутся из словаря.
 *
 * Данные заявки — форма живого ответа стенда (CA-000208, dev 72.62.17.132,
 * 01.09.2026): `in_progress`, `resume_step: 'address'`,
 * `missing_fields: ['address','phones','income','params','bank_verification']`.
 *
 * ПОСЛЕ ПЕРЕХОДА НА ОТВЕТ МОДУЛЯ маркером «новая сборка» годится ТОЛЬКО подпись
 * «крок N з M» (её нет ни в одной прежней сборке) и расхождение позиций из
 * случая (а): пять `<li>` выглядят одинаково у зеркала и у новой реализации,
 * поэтому ни счёт элементов, ни наличие `<ol>` маркерами не являются.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CreditStageProgress } from '../components/CreditStageProgress'
import { CreditApplicationDetailPage } from '../CreditApplicationDetailPage'
import * as hooks from '@/features/credit/hooks/useCredit'
import type { ReactNode } from 'react'
import type { CreditApplicationDetail } from '@/features/credit/api/types'

// Страница ищет клиента CRM по телефону заёмщика (см. CreditClientLink), поэтому
// ей нужен клиент запросов. Запрос в тестах не уходит: телефона в фикстурах нет,
// а хук включается только при непустом телефоне — но провайдер обязан быть.
const withQuery = (ui: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {ui}
  </QueryClientProvider>
)

vi.mock('@/features/credit/hooks/useCredit')
// Глобальный мок (`src/test/setup.ts`) возвращает КЛЮЧ и ИГНОРИРУЕТ значения
// интерполяции, поэтому подпись «крок 4 з 5» по нему тестом не видна вовсе.
// Здесь `t` печатает ключ и переданные значения — и именно это делает случай
// (а) знаком: 4 и 5 приходят из ответа модуля, а не из длины локального
// массива. Форма — дословно соседний `CreditLoanDetailPage.test.tsx:27-40`;
// общий `src/test/setup.ts` не трогаем: он обслуживает 554 тестовых файла.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Ключи СОРТИРУЮТСЯ перед склейкой: иначе восемь ожиданий подписи прибиты
    // к порядку свойств в вызове `t()`, и безобидная перестановка `{ total,
    // index }` покрасила бы их сообщением «unable to find element», которое о
    // предмете не говорит ничего.
    t: (key: string, vars?: Record<string, unknown>) =>
      vars && typeof vars === 'object'
        ? `${key} ${Object.entries(vars)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, value]) => `${name}=${String(value)}`)
            .join(' ')}`
        : key,
    i18n: { language: 'uk', changeLanguage: vi.fn() },
  }),
  // Эти экспорты нужны `src/lib/i18n.ts`, который тянется через formatters.
  I18nextProvider: ({ children }: { children: ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useParams: () => ({ applicationId: '6a547e31-ba5e-4723-a2ea-ea55c8ef5197' }),
}))

const APPLICATION: CreditApplicationDetail = {
  application_id: '6a547e31-ba5e-4723-a2ea-ea55c8ef5197',
  number: 'CA-000208',
  status: 'in_progress',
  product_code: 'CA_AB_PAYDAY',
  channel: 'web',
  jurisdiction: 'CA-AB',
  currency: 'CAD',
  requested_amount_minor: 40_000,
  client_email: 'client@example.com',
  created_at: '2026-09-01T08:00:00+00:00',
  updated_at: '2026-09-01T09:00:00+00:00',
  decision_outcome: null,
  decision_mode: null,
  final_amount_minor: null,
  resume_step: 'address',
  missing_fields: ['address', 'phones', 'income', 'params', 'bank_verification'],
  project_id: 1,
  client_id: null,
  decision_id: null,
  loan_id: null,
  paydays: [],
  consents: [],
  audit: [],
  draft: {},
}

/** Пункт ленты целиком: значок, подпись, состояние. */
function stageItem(stage: string) {
  const label = screen.getByText(`credit.stage.${stage}`)
  return label.closest('li') as HTMLElement
}

describe('лента этапов', () => {
  it('показывает пять шагов клиента подряд', () => {
    render(<CreditStageProgress application={APPLICATION} />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(5)
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('credit.stage.registration'),
      expect.stringContaining('credit.stage.questionnaire'),
      expect.stringContaining('credit.stage.income_check'),
      expect.stringContaining('credit.stage.decision'),
      expect.stringContaining('credit.stage.signing'),
    ])
  })

  it('называет состояние каждого шага словом, а не одним цветом', () => {
    // jsdom не применяет Tailwind, и «зелёный кружок» тестом не проверить.
    // Но состояние обязано быть В ТЕКСТЕ — ради читалки и ради дальтоника.
    render(<CreditStageProgress application={APPLICATION} />)
    expect(within(stageItem('registration')).getByText('credit.stageState.done')).toBeVisible()
    expect(within(stageItem('questionnaire')).getByText('credit.stageState.current')).toBeVisible()
    expect(
      within(stageItem('income_check')).getByText('credit.stageState.todo')
    ).toBeInTheDocument()
  })

  it('нумерует непройденные шаги теми же номерами, что видит клиент', () => {
    render(<CreditStageProgress application={APPLICATION} />)
    // Клиент на втором шаге — значок текущего показывает «2», а не «1» и не «3».
    expect(within(stageItem('questionnaire')).getByText('2')).toBeInTheDocument()
    expect(within(stageItem('signing')).getByText('5')).toBeInTheDocument()
  })

  it('на отказе отмечает сбойным шаг решения, а не подписание', () => {
    render(<CreditStageProgress application={{ status: 'declined', missing_fields: [] }} />)
    expect(within(stageItem('decision')).getByText('credit.stageState.failed')).toBeVisible()
    expect(within(stageItem('signing')).getByText('credit.stageState.todo')).toBeInTheDocument()
  })
})

/**
 * Тексты строк ленты ПО ПОРЯДКУ. Читаем позиционно, а не поиском по подписи:
 * при расхождении источников одно и то же имя попадает на ДВЕ строки (наше по
 * позиции и присланное модулем на текущей), и поиск по тексту падает словами
 * «found multiple elements» — краснота не про предмет. Позиция же говорит
 * прямо: на четвёртой строке ожидали «поточний крок».
 */
function rowTexts(): string[] {
  return Array.from(document.querySelectorAll('li')).map((li) =>
    (li.textContent ?? '').replace(/\s+/g, ' ')
  )
}

/** Заявка с полями этапа: базовая фикстура + переопределения. */
const withStage = (over: Partial<CreditApplicationDetail>): CreditApplicationDetail => ({
  ...APPLICATION,
  ...over,
})

describe('этап из ответа модуля', () => {
  it('(а) берёт позицию из stage_index, а не из зеркала', () => {
    // Зеркало на этой фикстуре дало бы ВТОРОЙ шаг (`anketaMissing` по
    // 'passport'), модуль говорит «четвёртый». Если тест зелёный и при чтении
    // из зеркала, он не различает источники и предмет не проверяет.
    render(
      <CreditStageProgress
        application={withStage({
          status: 'in_progress',
          missing_fields: ['passport'],
          stage: 'decision',
          stage_index: 4,
          stage_total: 5,
        })}
      />
    )
    // Подпись — из полей модуля: 4 и 5, а не длина локального массива. Стоит
    // ПЕРВЫМ утверждением: именно она различает источники, и её отсутствие
    // называет предмет прямо.
    expect(screen.getByText(/credit\.card\.stageOfTotal index=4 total=5/)).toBeVisible()
    const rows = rowTexts()
    expect(rows).toHaveLength(5)
    expect(rows[3]).toContain('credit.stage.decision')
    // Все пять позиций поимённо, а не три из пяти: иначе мутация, ставящая
    // `todo` на вторую-третью строку, оставила бы случай зелёным.
    expect(rows.map((row) => row.match(/credit\.stageState\.\w+/)?.[0])).toEqual([
      'credit.stageState.done',
      'credit.stageState.done',
      'credit.stageState.done',
      'credit.stageState.current',
      'credit.stageState.todo',
    ])
    // Контроль различения источников: второй шаг НЕ текущий (зеркало сказало бы
    // ровно про него).
    expect(rows[1]).not.toContain('credit.stageState.current')
  })

  it('(б) stage_total короче перечня — деградированный вид, ленты нет', () => {
    render(
      <CreditStageProgress
        application={withStage({ stage: 'income_check', stage_index: 3, stage_total: 4 })}
      />
    )
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByText(/credit\.card\.stageOfTotal index=3 total=4/)).toBeVisible()
    // Блок пути НЕ исчезает: заголовок секции на месте. Без этого утверждения
    // снятие всей ветки degraded уехало бы зелёным, а оператор получил бы
    // карточку без блока пути вовсе.
    expect(screen.getByText(/credit\.card\.stagesTitle/)).toBeVisible()
    // Своя нумерация не подставлена: подсказки про «пять кроків» здесь нет.
    expect(screen.queryByText(/credit\.card\.stagesHint/)).toBeNull()
  })

  it('(б′) stage_total длиннее перечня — шесть строк и имя модуля, а не деградация', () => {
    render(
      <CreditStageProgress
        application={withStage({
          status: 'in_progress',
          stage: 'unknown_step',
          stage_index: 6,
          stage_total: 6,
        })}
      />
    )
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(6)
    expect(items[5].textContent).toContain('unknown_step')
    expect(items[5].textContent).toContain('credit.stageState.current')
    // Номер шестой строки доезжает до читалки: он и есть то, что оператор и
    // клиент называют вслух. `sr-only`-строка, а не кружок: кружок aria-hidden.
    expect(within(items[5]).getByText('6.')).toBeInTheDocument()
    // Чужой ключ не собирается никогда — на экране сырое значение.
    expect(screen.queryByText(/credit\.stage\.unknown_step/)).toBeNull()
    expect(screen.getByText(/credit\.card\.stageOfTotal index=6 total=6/)).toBeVisible()
    // Подсказка обещает «ті самі п'ять кроків» — при шести строках она лжёт
    // ровно так же, как лгала бы в деградированном виде, где её уже сняли.
    expect(screen.queryByText(/credit\.card\.stagesHint/)).toBeNull()
  })

  it('(б″) stage_total выше потолка 12 — деградированный вид', () => {
    render(
      <CreditStageProgress
        application={withStage({ stage: 'decision', stage_index: 4, stage_total: 13 })}
      />
    )
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('(б‴) stage_total 12 — сам потолок рисуется: двенадцать строк и номер 12 на экране', () => {
    // Внутренняя сторона потолка на РЕНДЕРЕ: двузначный номер обязан быть и
    // виден, и озвучен. До этого круга лента ни разу не рисовалась длиннее шести.
    render(
      <CreditStageProgress
        application={withStage({
          status: 'in_progress',
          stage: 'twelfth',
          stage_index: 12,
          stage_total: 12,
        })}
      />
    )
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(12)
    expect(within(items[11]).getByText('12.')).toBeInTheDocument()
    expect(items[11].textContent).toContain('twelfth')
    expect(screen.getByText(/credit\.card\.stageOfTotal index=12 total=12/)).toBeVisible()
  })

  it('(б⁗) строки за пределами перечня — без подписи, но с номером для читалки', () => {
    // Законный путь из восьми шагов, клиент на третьем: строки 6-8 наш перечень
    // назвать не может. Молча потерять их хуже, чем показать безымянными, но
    // номер обязан доезжать до читалки — иначе она озвучит пустоту.
    render(
      <CreditStageProgress
        application={withStage({
          status: 'in_progress',
          stage: 'income_check',
          stage_index: 3,
          stage_total: 8,
        })}
      />
    )
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(8)
    expect(within(items[7]).getByText('8.')).toBeInTheDocument()
    // Подписи нет ни в каком виде: ни имени, ни ключа словаря.
    expect(items[7].textContent).not.toMatch(/credit\.stage\./)
    expect(items[2].textContent).toContain('credit.stage.income_check')
  })

  it('(д′) числа пришли, имени нет — деградация с подписью и без имени', () => {
    // Обратная половина частичного набора. Экран показывает «крок 3 з 5» и
    // молчит о том, что это за этап: додумывать имя не из чего.
    render(<CreditStageProgress application={withStage({ stage_index: 3, stage_total: 5 })} />)
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByText(/credit\.card\.stagesTitle/)).toBeVisible()
    expect(screen.getByText(/credit\.card\.stageOfTotal index=3 total=5/)).toBeVisible()
    expect(screen.queryByText(/credit\.stage\./)).toBeNull()
    expect(screen.queryByText(/undefined/)).toBeNull()
  })

  it('(в′) пустое имя без чисел — прежнее зеркало, а НЕ пустая рамка', () => {
    // Пустая строка приезжает физически, но ответом модуля не является.
    // Приняв её за ответ, карточка показала бы заголовок без ленты, имени и
    // номера — там, где до этого была лента из пяти шагов.
    render(<CreditStageProgress application={withStage({ stage: '   ' })} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.queryByText(/stageOfTotal/)).toBeNull()
  })

  it('(в) полей нет вовсе — прежнее зеркало, подписи шага нет', () => {
    // Контроль от подмены предмета: эта ветка обязана остаться зелёной при
    // любой мутации правил разбора, кроме мутации самой ветки зеркала.
    render(<CreditStageProgress application={APPLICATION} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.queryByText(/stageOfTotal/)).toBeNull()
    expect(within(stageItem('questionnaire')).getByText('credit.stageState.current')).toBeVisible()
  })

  it('(г) чужое имя этапа показывается значением, а не ключом', () => {
    render(
      <CreditStageProgress
        application={withStage({ stage: 'bank_statement', stage_index: 3, stage_total: 5 })}
      />
    )
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByText('bank_statement')).toBeVisible()
    expect(screen.queryByText(/credit\.stage\.bank_statement/)).toBeNull()
  })

  it('(д) часть полей — деградация без «крок undefined з 5»', () => {
    render(
      <CreditStageProgress
        application={withStage({ stage: 'decision', stage_index: undefined, stage_total: 5 })}
      />
    )
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.queryByText(/undefined/)).toBeNull()
    expect(screen.queryByText(/stageOfTotal/)).toBeNull()
    // Имя пришло — его и показываем.
    expect(screen.getByText('credit.stage.decision')).toBeVisible()
  })

  it.each([0, 7])('(е) stage_index %s вне 1..stage_total — деградация', (index) => {
    render(
      <CreditStageProgress
        application={withStage({ stage: 'decision', stage_index: index, stage_total: 5 })}
      />
    )
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    // Числа печатаются КАК ПРИШЛИ, даже противоречивые: это единственный
    // видимый признак того, что модуль отвечает несогласованно.
    expect(screen.getByText(new RegExp(`stageOfTotal index=${index} total=5`))).toBeVisible()
  })

  it('(ж) индекс не совпал с позицией имени — деградация', () => {
    render(
      <CreditStageProgress
        application={withStage({ stage: 'decision', stage_index: 2, stage_total: 5 })}
      />
    )
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByText(/credit\.card\.stageOfTotal index=2 total=5/)).toBeVisible()
  })

  it('(з) declined: строка индекса остаётся failed, current нет ни на одной', () => {
    render(
      <CreditStageProgress
        application={withStage({
          status: 'declined',
          missing_fields: [],
          stage: 'decision',
          stage_index: 4,
          stage_total: 5,
        })}
      />
    )
    const rows = rowTexts()
    expect(rows).toHaveLength(5)
    expect(rows[3]).toContain('credit.stage.decision')
    expect(rows[3]).toContain('credit.stageState.failed')
    expect(screen.queryAllByText('credit.stageState.current')).toHaveLength(0)
    expect(screen.getByText(/credit\.card\.stageOfTotal index=4 total=5/)).toBeVisible()
  })

  it.each(['disbursed', 'contracted'] as const)(
    '(и) %s: пять done и ни одного «поточний крок»',
    (status) => {
      render(
        <CreditStageProgress
          application={withStage({
            status,
            missing_fields: [],
            stage: 'signing',
            stage_index: 5,
            stage_total: 5,
          })}
        />
      )
      expect(screen.getAllByRole('listitem')).toHaveLength(5)
      expect(screen.queryAllByText('credit.stageState.done')).toHaveLength(5)
      expect(screen.queryAllByText('credit.stageState.current')).toHaveLength(0)
      expect(screen.getByText(/credit\.card\.stageOfTotal index=5 total=5/)).toBeVisible()
    }
  )

  it.each(['expired', 'abandoned'] as const)(
    '(к) %s: done до индекса, todo дальше, current нигде',
    (status) => {
      // На стенде DEV таких заявок ноль из 254 — случай доказуем ТОЛЬКО здесь.
      render(
        <CreditStageProgress
          application={withStage({
            status,
            stage: 'income_check',
            stage_index: 3,
            stage_total: 5,
          })}
        />
      )
      // Позиционный ряд, а не счёт: те же два `done` и три `todo` дала бы и
      // раскладка, где пройденными помечены первая и третья строки.
      expect(rowTexts().map((row) => row.match(/credit\.stageState\.\w+/)?.[0])).toEqual([
        'credit.stageState.done',
        'credit.stageState.done',
        'credit.stageState.todo',
        'credit.stageState.todo',
        'credit.stageState.todo',
      ])
      expect(screen.queryAllByText('credit.stageState.current')).toHaveLength(0)
      expect(screen.getByText(/credit\.card\.stageOfTotal index=3 total=5/)).toBeVisible()
    }
  )
})

describe('карточка заявки', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(hooks.useCreditOverview).mockReturnValue({
      data: { permissions: [] },
    } as unknown as ReturnType<typeof hooks.useCreditOverview>)
    vi.mocked(hooks.useCreditApplication).mockReturnValue({
      data: APPLICATION,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof hooks.useCreditApplication>)
  })

  it('несёт ленту этапов рядом с блоком «застряв на кроці»', () => {
    render(<MemoryRouter>{withQuery(<CreditApplicationDetailPage />)}</MemoryRouter>)
    // Обе вещи на одном экране: где встал (строка простоя) и весь путь (лента).
    expect(screen.getByText(/credit\.card\.stuckAt/)).toBeInTheDocument()
    expect(screen.getByText(/credit\.card\.stagesTitle/)).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(within(stageItem('questionnaire')).getByText('credit.stageState.current')).toBeVisible()
  })

  it('номер шага достаётся читалке, а не только глазу', () => {
    // Кружок с цифрой помечен aria-hidden — он несёт ещё и знак состояния.
    // Значит номер обязан быть отдельной строкой, иначе оператору с читалкой
    // не достаётся именно то, ради чего лента и заведена: общий с клиентом
    // номер шага. Приёмка показала, что getByText и toBeVisible этого не
    // ловят — проверяем текст элементов, НЕ помеченных aria-hidden.
    render(
      <CreditStageProgress
        application={{ status: 'in_progress', missing_fields: ['bank_verification'] }}
      />
    )

    const items = Array.from(document.querySelectorAll('li'))
    const spoken = items.map((li) =>
      Array.from(li.querySelectorAll('span'))
        .filter((el) => el.getAttribute('aria-hidden') === null)
        .map((el) => el.textContent)
        .join(' ')
    )
    // Третий шаг — банковская проверка, он же текущий: читалка обязана
    // произнести его номер.
    expect(spoken[2]).toContain('3.')
    expect(spoken[0]).toContain('1.')
  })
})
