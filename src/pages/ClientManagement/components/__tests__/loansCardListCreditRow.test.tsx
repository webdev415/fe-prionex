/**
 * Строка кредитного модуля в списке «Позики» — сцены L-1…L-13 (WS-11, 14-7b).
 *
 * 🔴 ПОЧЕМУ ОТДЕЛЬНЫЙ ФАЙЛ, А НЕ ДОПИСКА В СОСЕДНИЕ. Рядом лежат
 * `LoansCardList.test.tsx` (6 сцен) и `LoanCard.test.tsx` (14 сцен), оба
 * старше этой единицы, и оба остаются нетронутыми. Кредитную строку они не
 * держат по механической причине: первый подаёт `renderLoan` МОКОМ и
 * настоящий `LoanCard` не монтирует вовсе, а второй строит свою фабрику в
 * ФАКТОРИНГОВОЙ форме и о происхождении строки не знает. Файлы есть —
 * покрытия нет.
 *
 * Отсюда правило: механику, которую сосед уже держит (свёрнутость «Закритих»,
 * `data-closed`, нулевые счётчики, слоты кнопок), здесь НЕ дублировать — она
 * разошлась бы при первой же правке списка. Мерить только то, что меняет
 * кредитная строка, и мерить через НАСТОЯЩИЙ `LoanCard`: предмет здесь —
 * утверждение об экране, а не о правиле рядом.
 *
 * 🔴 СТАТИЧЕСКИЕ импорты списка и карточки в шапке — не стиль, а тот же урок,
 * которым чинили красный CI карточного теста: `await import(…)` в теле теста
 * кладёт холодную загрузку в бюджет ПЕРВОЙ сцены, и под покрытием с полусотней
 * форков она в двадцать секунд не укладывается. Явных `{ timeout: … }` здесь
 * нет намеренно — локальный таймаут маскирует ровно этот класс отказа.
 * Форма сторожится в `pages/Credit/__tests__/ClientCreditBlock.test.tsx`.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'

import { LoansCardList } from '../LoansCardList'
import { LoanCard, type LoanCardAction, type LoanCardLoan } from '../LoanCard'
import ukCommon from '../../../../../public/locales/uk/common.json'
import enCommon from '../../../../../public/locales/en/common.json'

/**
 * Общий мок `react-i18next` возвращает САМ КЛЮЧ, а половина сцен ниже меряет
 * слова, которые прочитает оператор: подпись чипа, подсказку вместо действий,
 * украинское имя стадии. Поэтому словарь берётся настоящий — и язык тоже `uk`,
 * иначе деньги отформатировались бы английской локалью и `456,00` стало бы
 * `456.00`.
 */
vi.mock('react-i18next', async () => {
  const uk = (await import('../../../../../public/locales/uk/common.json')).default as Record<
    string,
    unknown
  >
  const lookup = (key: string): unknown =>
    key
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === 'object' && part in node
            ? (node as Record<string, unknown>)[part]
            : undefined,
        uk
      )
  const t = (key: string, options?: unknown, interpolation?: Record<string, unknown>): string => {
    const vars = (interpolation ?? (typeof options === 'object' ? options : undefined)) as
      | Record<string, unknown>
      | undefined
    const found = lookup(key)
    let template = typeof found === 'string' ? found : typeof options === 'string' ? options : key
    if (vars) {
      template = template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
        name in vars ? String(vars[name]) : `{{${name}}}`
      )
    }
    return template
  }
  return {
    useTranslation: () => ({ t, i18n: { language: 'uk', changeLanguage: vi.fn() } }),
    Trans: ({ children }: { children: ReactNode }) => children,
    I18nextProvider: ({ children }: { children: ReactNode }) => children,
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  }
})

// Radix-меню щупает pointer capture, которого в jsdom нет.
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false)
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

const OPEN_HEADING = 'Відкриті позики'
const CLOSED_HEADING = 'Закриті позики'
const MORE_ACTIONS = 'Більше дій'
const CREDIT_TAG = 'кредит (наш)'
const ACTIONS_HINT = 'Дії — у кредитному модулі'
const RR_TAG = 'РР'

/** Купленный долг — контрольная половина почти каждой сцены ниже. */
function factoringRow(over: Partial<LoanCardLoan> = {}): LoanCardLoan {
  return {
    id: 1,
    loanNumber: 'LEGACY-55',
    issueDate: '06-12-2024',
    counterparty: 'Egroshi',
    saleDate: '02-05-2025',
    sellerLegalName: 'ТОВ «ФК»',
    factoringAgreementPreviousLender: null,
    factoringAgreementPurchaseDate: '10-05-2025',
    principalAmount: 1000,
    principalDebt: 900,
    remainingDebtAmount: 900,
    totalToReturn: 900,
    closingCoefficient: null,
    creditClosedDate: null,
    eligibleForReturn: null,
    creditTermDays: 540,
    status: 'active',
    sentToCreditBureau: false,
    creditBureauSentDate: null,
    needsManualClosureReview: false,
    ...over,
  }
}

/**
 * Строка нашего кредита — ровно та форма, которую собирает карточка клиента:
 * заполнены пять полей из двадцати плюс три признака происхождения, остальные
 * пятнадцать пусты, потому что значений у проекции НЕТ.
 */
function creditRow(over: Partial<LoanCardLoan> = {}): LoanCardLoan {
  return {
    id: 2,
    loanNumber: 'FB-000090',
    issueDate: '',
    counterparty: '',
    saleDate: '',
    sellerLegalName: null,
    factoringAgreementPreviousLender: null,
    factoringAgreementPurchaseDate: null,
    principalAmount: 400,
    principalDebt: null,
    remainingDebtAmount: 456,
    totalToReturn: 0,
    closingCoefficient: null,
    creditClosedDate: null,
    eligibleForReturn: null,
    creditTermDays: null,
    status: 'active',
    sentToCreditBureau: false,
    creditBureauSentDate: null,
    needsManualClosureReview: false,
    origin: 'credit_module',
    currency: 'CAD',
    lifecycleDetail: 'delinquent',
    ...over,
  }
}

const ACTIONS: LoanCardAction[] = [
  { key: 'writeoff', label: 'Списати', onSelect: vi.fn() },
  { key: 'ubki', label: 'Відправити в УБКІ', onSelect: vi.fn() },
]

type CardOverrides = Partial<React.ComponentProps<typeof LoanCard>>

/**
 * Список с НАСТОЯЩЕЙ карточкой внутри. Пропсы на карточку выдаются по строке,
 * иначе контрольная половина («у факторинговой чип РР есть») и предмет («у
 * кредитной нет») не поместились бы в один список.
 */
function renderList(
  loans: LoanCardLoan[],
  perLoan: (loan: LoanCardLoan) => CardOverrides = () => ({})
) {
  const onFocus = vi.fn()
  const onToggleCredit = vi.fn()
  const utils = render(
    <LoansCardList
      loans={loans}
      renderLoan={(loan, isClosed) => (
        <LoanCard
          key={loan.id}
          loan={loan}
          isClosed={isClosed}
          hasRr={false}
          rrExpanded={false}
          onToggleRr={vi.fn()}
          focused={false}
          onFocus={onFocus}
          actions={ACTIONS}
          onToggleCredit={loan.origin === 'credit_module' ? onToggleCredit : undefined}
          {...perLoan(loan)}
        />
      )}
    />
  )
  return { ...utils, onFocus, onToggleCredit }
}

const sectionOf = (heading: string) => screen.getByText(heading).closest('div') as HTMLElement
const closedHeaderOf = () => screen.getByText(CLOSED_HEADING).closest('button') as HTMLElement

describe('L-1/L-2: секция выбирается статусом проекции, а не происхождением', () => {
  it('L-1 active — строка кредита в «Відкриті», рядом с купленным долгом', () => {
    renderList([factoringRow(), creditRow()])

    // Контроль: список отрисован и купленный долг на месте — «кредит здесь»
    // сказано о непустом экране.
    expect(screen.getByText(/LEGACY-55/)).toBeInTheDocument()
    expect(
      screen.queryByText(/FB-000090/),
      'активный кредит модуля не в «Відкриті» — секция выбрана не по статусу'
    ).not.toBeNull()
  })

  it('L-2 closed — строка кредита в «Закриті», видна после раскрытия секции', async () => {
    const user = userEvent.setup()
    renderList([factoringRow(), creditRow({ status: 'closed' })])

    // Секция свёрнута по умолчанию: без раскрытия «строки нет» выполнилось бы
    // на свёрнутом блоке при любом составе списка.
    expect(
      screen.queryByText(/FB-000090/),
      'закрытый кредит модуля оказался в «Відкриті»'
    ).not.toBeInTheDocument()
    expect(screen.getByText(/LEGACY-55/)).toBeInTheDocument()

    await user.click(closedHeaderOf())

    expect(screen.getByText(/FB-000090/)).toBeInTheDocument()
  })
})

describe('L-3/L-4: счётчик считает строку кредита', () => {
  it('L-3 открытых — 2 на «факторинг + кредит», 1 на одном факторинге', () => {
    const { unmount } = renderList([factoringRow(), creditRow()])
    expect(
      within(sectionOf(OPEN_HEADING)).queryByText('2'),
      'счётчик «Відкриті» не считает строку кредита — цифра не сходится с видимым списком'
    ).not.toBeNull()
    unmount()

    renderList([factoringRow()])
    expect(within(sectionOf(OPEN_HEADING)).getByText('1')).toBeInTheDocument()
  })

  it('L-4 закрытых — 2 на «факторинг + кредит», 1 на одном факторинге', () => {
    const closedPair = [factoringRow({ status: 'closed' }), creditRow({ status: 'closed' })]
    const { unmount } = renderList(closedPair)
    expect(within(closedHeaderOf()).getByText('2')).toBeInTheDocument()
    unmount()

    renderList([factoringRow({ status: 'closed' })])
    expect(within(closedHeaderOf()).getByText('1')).toBeInTheDocument()
  })
})

describe('L-5/L-6: пометка есть у кредита и только у него', () => {
  it('L-5 чип «кредит (наш)» — у кредитной строки есть, у купленной нет', () => {
    renderList([factoringRow(), creditRow()])

    const tags = screen.getAllByText(CREDIT_TAG)
    // Ровно одна пометка на два долга: вторая означала бы, что купленный долг
    // подписан как наш кредит.
    expect(tags).toHaveLength(1)
    // Контроль: купленная строка отрисована — «чипа у неё нет» сказано о
    // существующей карточке.
    expect(screen.getByText(/LEGACY-55/)).toBeInTheDocument()
  })

  it('L-5b подсказка «Дії — у кредитному модулі» стоит на самом чипе — и у ручки, и у подписи', () => {
    // В меню подсказку увидит только тот, кто уже открыл меню (Р-12); на чипе
    // её читает каждый, кто навёл на пометку.
    const { unmount } = renderList([creditRow()])
    const handle = screen.getByText(CREDIT_TAG)
    // Контроль формы: это ручка разворота, а не подпись.
    expect(handle.tagName).toBe('BUTTON')
    expect(
      handle.getAttribute('title'),
      'подсказка «Дії — у кредитному модулі» пропала с чипа-ручки — её увидит только тот, кто уже открыл меню (Р-12)'
    ).toBe(ACTIONS_HINT)
    unmount()

    // Флаг стенда выключен — ручки нет, пометка печатается подписью, и
    // подсказка обязана остаться на ней.
    renderList([creditRow()], () => ({ onToggleCredit: undefined }))
    const label = screen.getByText(CREDIT_TAG)
    expect(label.tagName).toBe('SPAN')
    expect(
      label.getAttribute('title'),
      'подсказка «Дії — у кредитному модулі» пропала с пометки без ручки — её увидит только тот, кто уже открыл меню (Р-12)'
    ).toBe(ACTIONS_HINT)
  })

  it('L-6 🔴 РР у кредитной строки заперт СТРУКТУРНО — даже когда страница его отдала', () => {
    // Страница считает `hasRr` одинаково для всех строк (`rrDebtIds` строится
    // из всех соглашений клиента без фильтра по происхождению), а сервер при
    // создании соглашения происхождение долга не проверяет. Поэтому сцена
    // подаёт РР ОБЕИМ строкам и утверждает, что кредит его не рисует. Прежняя
    // редакция сама подавала `hasRr: loan.origin !== 'credit_module'` и
    // проверяла, что карточка рисует то, что ей дали, — тавтологию.
    renderList([factoringRow(), creditRow()], () => ({
      hasRr: true,
      rrExpanded: true,
      rrStatus: { label: 'Підключено', tone: 'active' },
      rrPanel: <div>ПАНЕЛЬ РР</div>,
    }))

    // Контроль: у купленного долга с теми же пропсами все три РР-узла на месте
    // — значит «у кредита их нет» проверено против работающей отрисовки.
    const factoringCard = screen.getByText(/LEGACY-55/).closest('[role="button"]') as HTMLElement
    expect(within(factoringCard).getByText(RR_TAG)).toBeInTheDocument()
    expect(within(factoringCard).getByText('Підключено')).toBeInTheDocument()
    expect(within(factoringCard).getByText('ПАНЕЛЬ РР')).toBeInTheDocument()

    const creditCard = screen.getByText(/FB-000090/).closest('[role="button"]') as HTMLElement
    expect(
      within(creditCard).queryByText(RR_TAG),
      'у кредитной строки нарисован чип РР при hasRr=true — реструктуризация по долгу, которым CRM не владеет'
    ).not.toBeInTheDocument()
    expect(
      within(creditCard).queryByText('Підключено'),
      'статус РР у кредита модуля — соглашение по долгу, которым CRM не владеет'
    ).not.toBeInTheDocument()
    expect(
      within(creditCard).queryByText('ПАНЕЛЬ РР'),
      'панель РР развернулась под кредитом модуля'
    ).not.toBeInTheDocument()
  })
})

describe('L-7: у строки кредита нет НИ ОДНОГО пункта действий', () => {
  it('меню кредитной строки пусто, но подсказка в нём есть', async () => {
    const user = userEvent.setup()
    renderList([creditRow()])

    await user.click(screen.getByRole('button', { name: MORE_ACTIONS }))

    const menu = await screen.findByRole('menu')
    // Ноль ПУНКТОВ, а не ноль активных: неактивный пункт остаётся пунктом —
    // попадает в роль `menuitem`, читается скринридером как действие и
    // однажды будет «временно включён».
    expect(
      screen.queryAllByRole('menuitem'),
      'у кредита модуля в меню есть пункты действий взыскания'
    ).toHaveLength(0)
    // Контроль от пустого множества: меню открыто и что-то в нём есть.
    expect(within(menu).getByText(ACTIONS_HINT)).toBeInTheDocument()
  })

  it('контроль: у купленного долга с тем же набором действий пункты есть', async () => {
    const user = userEvent.setup()
    renderList([factoringRow()])

    await user.click(screen.getByRole('button', { name: MORE_ACTIONS }))

    await screen.findByRole('menu')
    expect(screen.queryAllByRole('menuitem').length).toBeGreaterThanOrEqual(1)
  })
})

describe('L-8/L-9: чип разворачивает, карточка фокусирует — и они не путаются', () => {
  it('L-8 клик по чипу зовёт разворот один раз и НЕ трогает фокус', async () => {
    const user = userEvent.setup()
    const { onFocus, onToggleCredit } = renderList([creditRow()])

    await user.click(screen.getByText(CREDIT_TAG))

    expect(
      onToggleCredit,
      'клик по чипу не развернул кредит — у пометки нет ручки'
    ).toHaveBeenCalledTimes(1)
    // Без `stopPropagation` клик по чипу всплыл бы на корень карточки и
    // каждый разворот притемнял бы соседние карточки.
    expect(onFocus, 'клик по чипу всплыл на карточку и переключил её фокус').not.toHaveBeenCalled()
  })

  it('L-8 развёрнутая строка показывает панель под карточкой', () => {
    const { unmount } = renderList([creditRow()], () => ({
      creditExpanded: false,
      creditPanel: <div>КАРТА КРЕДИТУ</div>,
    }))
    // Контроль: свёрнутой панели на экране НЕТ — значит её появление ниже
    // вызвано разворотом, а не тем, что она там была всегда.
    expect(screen.queryByText('КАРТА КРЕДИТУ')).not.toBeInTheDocument()
    unmount()

    renderList([creditRow()], () => ({
      creditExpanded: true,
      creditPanel: <div>КАРТА КРЕДИТУ</div>,
    }))
    expect(screen.getByText('КАРТА КРЕДИТУ')).toBeInTheDocument()
  })

  it('L-9 клик по телу кредитной карточки фокусирует и НЕ разворачивает', async () => {
    const user = userEvent.setup()
    const { onFocus, onToggleCredit } = renderList([creditRow()])

    await user.click(screen.getByText(/FB-000090/))

    expect(onFocus).toHaveBeenCalled()
    expect(
      onToggleCredit,
      'клик по телу карточки развернул кредит — ручка разворота обязана жить только на чипе (Р-FEL1B-3)'
    ).not.toHaveBeenCalled()
  })
})

describe('L-10: деньги строки — и код валюты, и само число', () => {
  it('456 CAD печатается как «456,00 CAD», без ₴ и без «4,56»', () => {
    const { container } = renderList([creditRow()])
    const creditCard = screen.getByText(/FB-000090/).closest('[role="button"]') as HTMLElement
    const text = creditCard.textContent ?? ''

    // 🔴 Порядок утверждений — не вкусовщина. Две ловушки денег здесь
    // ПРОТИВОПОЛОЖНЫ, и сцена обязана называть, какая именно сработала:
    // «в строке нет 456,00 CAD» верно для обеих и не различает их.
    // Поэтому сначала идут отрицания, каждое со своим предметом в тексте.
    expect(text, 'жёсткая гривна общего форматтера — ложь о валюте на кредите в CAD').not.toContain(
      '₴'
    )
    expect(
      text,
      'сумма поделена на 100 форматтером модуля: код валюты верен, а число занижено в сто раз'
    ).not.toContain('4,56')
    expect(container.textContent).not.toContain('4,00 CAD')
    // И только теперь — положительное: обе суммы напечатаны как надо.
    expect(text).toContain('456,00 CAD')
    expect(text).toContain('400,00 CAD')
  })

  it('контроль: купленный долг в том же списке печатает ₴', () => {
    renderList([factoringRow(), creditRow()])
    const factoringCard = screen.getByText(/LEGACY-55/).closest('[role="button"]') as HTMLElement

    expect(factoringCard.textContent ?? '').toContain('₴')
  })

  it('L-10b валюты проекция не сказала — число без кода валюты, гривна не подставляется (Р-FEL1B-11)', () => {
    // `currency = null` — «модуль валюту не прислал», а не «гривна». Подставить
    // `₴` или `UAH` значило бы утверждать валюту, которой нам не сказали, —
    // ровно то, от чего строка защищает кредит в CAD.
    const { unmount } = renderList([creditRow({ currency: null })])
    const text =
      (screen.getByText(/FB-000090/).closest('[role="button"]') as HTMLElement).textContent ?? ''
    expect(text, 'валюты проекция не сказала, а строка утверждает гривну (Р-FEL1B-11)').not.toMatch(
      /₴|UAH/
    )
    expect(text).not.toContain('CAD')
    // Положительный контроль: число напечатано — «кода нет» сказано о
    // существующей сумме, а не о пустой ячейке.
    expect(text).toContain('456,00')
    unmount()

    // Контроль: та же строка с валютой печатает её код рядом с числом.
    renderList([creditRow({ currency: 'CAD' })])
    const withCurrency =
      (screen.getByText(/FB-000090/).closest('[role="button"]') as HTMLElement).textContent ?? ''
    expect(withCurrency).toContain('456,00 CAD')
  })

  it('L-10c нечисловая сумма — прочерк без кода валюты: «— CAD» читается как сумма', () => {
    // `formatNumber` на нечисловом входе отдаёт свой плейсхолдер «—», и
    // приклеенный к нему код валюты превратил бы «значения нет» в «сумма в CAD».
    renderList([creditRow({ remainingDebtAmount: Number.NaN })])
    const creditCard = screen.getByText(/FB-000090/).closest('[role="button"]') as HTMLElement
    const remaining = within(creditCard).getByText('Залишок боргу', { selector: 'span' })
      .nextElementSibling?.textContent

    expect(remaining, 'прочерк напечатан с кодом валюты — «— CAD» читается как сумма').toBe('—')
    // Контроль: соседняя числовая сумма той же строки печатается с кодом.
    const loanAmount = within(creditCard).getByText('Сума позики', { selector: 'span' })
      .nextElementSibling?.textContent
    expect(loanAmount).toBe('400,00 CAD')
  })
})

describe('L-11: отсутствие поля не изображается нулём и прочерком', () => {
  it('в кредитной строке нет «₴ 0.00» и нет прочерков на месте дат', () => {
    renderList([factoringRow(), creditRow()])
    const creditCard = screen.getByText(/FB-000090/).closest('[role="button"]') as HTMLElement
    const text = creditCard.textContent ?? ''

    // ⚠️ Регулярка с `\s`, а не литерал «₴ 0.00»: общий форматтер карточки
    // склеивает символ и число НЕРАЗРЫВНЫМ пробелом (U+00A0), и литерал с
    // обычным пробелом не совпал бы ни с одним его выходом — прежняя редакция
    // этого утверждения была слепой и зеленела при любой строке.
    expect(text, 'в строке кредита «₴ 0.00» — ноль как факт (Р-5)').not.toMatch(/₴\s*0\.00/)
    expect(text, 'три прочерка на месте дат у кредита модуля').not.toContain('—')
    // Ни одной подписи зоны дат: «Дата видачі», «Дата купівлі (ФА)», «Строк
    // боргу» у проекции значений не имеют, и три прочерка подряд читались бы
    // как «данные потерялись».
    expect(within(creditCard).queryByText('Дата видачі')).not.toBeInTheDocument()
    // Продавца у своего кредита нет по определению — зона контрагента с её
    // тултипом «Первинний кредитор» не рисуется вовсе.
    expect(within(creditCard).queryByText('Контрагент')).not.toBeInTheDocument()
  })

  it('контроль: купленный долг свои даты печатает', () => {
    renderList([factoringRow()])
    const factoringCard = screen.getByText(/LEGACY-55/).closest('[role="button"]') as HTMLElement

    expect(within(factoringCard).getByText('Дата видачі')).toBeInTheDocument()
    expect(factoringCard.textContent ?? '').toContain('06-12-2024')
  })
})

describe('L-12: стадия печатается только словарём', () => {
  it('известная стадия — украинским словом, неизвестная не печатается вовсе', () => {
    const { unmount } = renderList([creditRow({ lifecycleDetail: 'delinquent' })])
    expect(screen.getByText('Прострочення')).toBeInTheDocument()
    unmount()

    renderList([creditRow({ lifecycleDetail: 'who_knows' })])
    // Ни сырым словом, ни ключом: машинное имя на экране оператора — утечка
    // внутреннего словаря, а не подпись.
    expect(
      screen.queryByText(/who_knows/),
      'машинное слово стадии вне известного множества напечатано оператору'
    ).toBeNull()
    expect(screen.queryByText(/credit\.loanStatus/)).not.toBeInTheDocument()
    // Контроль: строка при этом отрисована.
    expect(screen.getByText(/FB-000090/)).toBeInTheDocument()
  })
})

describe('L-12b: известное множество стадий = реальный выход модуля (пин, Р-FEL1B-13)', () => {
  /**
   * 🔴 Литерал снят с кредитного модуля, а не со словаря фронта:
   * `credit-module service/src/credit_service/app/crm_projection.py@8ccb0295`,
   * `PROJECTED_STATUS` (`:72-83`) и `crm_status_of` (`:173-189`). В одно поле
   * `lifecycle_detail` едут значения ДВУХ словарей: нюанс статуса и причина
   * закрытия (`repaid`, `early_settled`, плюс `closed`, когда причины нет), а
   * сторно выдачи — чужим словом `disbursement_reversed`. Дверь client-service
   * принимает поле свободной строкой (`schemas/credit_link.py`,
   * `max_length=64`), и опубликованного перечня нет нигде — поэтому он живёт
   * здесь. Модуль расширил множество — правьте литерал ЗДЕСЬ и решайте, каким
   * словом печатать новое значение; молча оно на экран не попадёт.
   *
   * `closeReason` не входит в `CREDIT_DYNAMIC_NAMESPACES`, и `i18nKeys.test.ts`
   * его полноту не сторожит — присутствие строки в ОБОИХ словарях проверяется
   * тут же, для каждого значения.
   */
  const MODULE_LIFECYCLE_DETAILS: ReadonlyArray<readonly [string, string, 'active' | 'closed']> = [
    ['delinquent', 'credit.loanStatus.delinquent', 'active'],
    ['forbearance', 'credit.loanStatus.forbearance', 'active'],
    ['protected', 'credit.loanStatus.protected', 'active'],
    ['charged_off', 'credit.loanStatus.charged_off', 'active'],
    ['written_off', 'credit.loanStatus.written_off', 'closed'],
    ['cancelled', 'credit.loanStatus.cancelled', 'closed'],
    ['withdrawn', 'credit.loanStatus.withdrawn', 'closed'],
    ['disbursement_reversed', 'credit.loanStatus.disbursement_failed', 'closed'],
    ['closed', 'credit.loanStatus.closed', 'closed'],
    ['repaid', 'credit.closeReason.repaid', 'closed'],
    ['early_settled', 'credit.closeReason.early_settled', 'closed'],
  ]

  const lookup = (dict: unknown, key: string): unknown =>
    key
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === 'object' && part in node
            ? (node as Record<string, unknown>)[part]
            : undefined,
        dict
      )

  it('каждое значение модуля печатается словом словаря, и строка есть в uk и en', () => {
    expect(MODULE_LIFECYCLE_DETAILS, 'пин множества пуст — сверять нечего').toHaveLength(11)
    for (const [detail, key, status] of MODULE_LIFECYCLE_DETAILS) {
      for (const [lang, dict] of [
        ['uk', ukCommon],
        ['en', enCommon],
      ] as const) {
        expect(typeof lookup(dict, key), `${lang}: нет строки ${key} для «${detail}»`).toBe(
          'string'
        )
      }
      const word = lookup(ukCommon, key) as string
      const { unmount } = render(
        <LoanCard
          loan={creditRow({ lifecycleDetail: detail, status })}
          isClosed={status === 'closed'}
          hasRr={false}
          rrExpanded={false}
          onToggleRr={vi.fn()}
          focused
          onFocus={vi.fn()}
          actions={ACTIONS}
        />
      )
      const shown = screen.queryByText(word)
      if (key.startsWith('credit.closeReason.')) {
        expect(shown, `погашенный кредит (${detail}) остался без подписи стадии`).not.toBeNull()
      } else {
        expect(shown, `стадия «${detail}» не напечатана словом словаря`).not.toBeNull()
      }
      // И ни машинного слова, ни ключа словаря на экране.
      expect(screen.queryByText(detail), `сырое «${detail}» на экране оператора`).toBeNull()
      expect(screen.queryByText(key)).toBeNull()
      unmount()
    }
  })
})

describe('L-13: оба новых ключа существуют в обоих словарях и ни с чем не сталкиваются', () => {
  const lookup = (dict: unknown, key: string): unknown =>
    key
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === 'object' && part in node
            ? (node as Record<string, unknown>)[part]
            : undefined,
        dict
      )

  it('ключи есть строками и в uk, и в en', () => {
    // 🔴 Эту пару не видит НИ ОДИН прежний страж словаря: `i18nKeys.test.ts`
    // читает только `pages/Credit/**` и `features/credit/**` и ловит только
    // префикс `credit.`, а ключи зовутся из `ClientManagement` и начинаются с
    // `pages.`. Без этой сцены и без четвёртого поддерева в страже паритета
    // пропавшее английское значение показало бы оператору машинное имя, и не
    // покраснело бы ничто.
    for (const dict of [ukCommon, enCommon]) {
      expect(typeof lookup(dict, 'pages.clients.detail.creditModuleTag')).toBe('string')
      expect(typeof lookup(dict, 'pages.clients.detail.creditModuleActionsHint')).toBe('string')
    }
  })

  it('подпись чипа не совпадает ни с одним «чужим Кредитом» той же страницы', () => {
    for (const dict of [ukCommon, enCommon]) {
      // Пять ключей, которые на этой же странице означают КУПЛЕННЫЙ долг.
      const taken = new Set(
        [
          'pages.clients.detail.loan',
          'pages.clients.detail.rrSelectLoan',
          'pages.clients.detail.generateModal.credit',
          'pages.clients.detail.ubki.history.headers.loan',
          'pages.clientChains.credit',
        ].map((key) => lookup(dict, key))
      )
      // Положительный контроль: набор непуст и собран из ЖИВЫХ значений —
      // без него сравнение ниже зеленело бы на пустом множестве.
      expect(taken.size).toBeGreaterThan(0)
      expect(taken.has(undefined)).toBe(false)

      expect(
        taken.has(lookup(dict, 'pages.clients.detail.creditModuleTag')),
        'подпись чипа совпала с «чужим Кредитом» той же страницы — купленный долг и наш кредит подписаны одинаково'
      ).toBe(false)
    }
  })
})
