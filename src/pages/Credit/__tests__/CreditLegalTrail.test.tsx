/**
 * Блок «Показані правові тексти» (18-4e): какие правовые тексты сайта клиент
 * видел до подачи заявки.
 *
 * Комплаенс сверяет эти строки с журналом CMS построчно, поэтому защищается:
 * порядок — как прислал модуль; момент показа — только часы сайта (не момент
 * приёма); отпечаток — 12 знаков на экране и полная строка в буфере; столбцы
 * «Показано» и «Етап» — только когда есть что в них показать; кривой элемент не
 * роняет карточку. Отпечатки и ключи — синтетические.
 */
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import { CreditLegalTrail } from '../components/CreditLegalTrail'
import { formatDateTime } from '@/lib/formatters'

// Мок печатает ключ: сцены различают подписи по ключам словаря.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'uk', changeLanguage: vi.fn() },
  }),
  I18nextProvider: ({ children }: { children: ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}))

const SHA_A = '0123456789abcdef'.repeat(4)
const SHA_B = 'fedcba9876543210'.repeat(4)
const SHA_C = 'a1b2c3d4e5f60718'.repeat(4)
const SHA_D = '9f8e7d6c5b4a3921'.repeat(4)
const RECEIVED = '2026-10-04T03:33:19.123456+00:00'
const SHOWN = '2026-10-04T08:15:00+00:00'

const A = {
  source: 'legal-texts',
  subject: 'sign.max_cost',
  publication_id: 63,
  version_no: 1,
  sha256: SHA_A,
  locale: 'en',
  shown_at: null,
  received_at: RECEIVED,
}
const B = { ...A, subject: 'disclosure.brand', publication_id: 2, sha256: SHA_B, shown_at: SHOWN }
const C = {
  ...A,
  source: 'site-documents',
  subject: 'privacy_policy',
  publication_id: 5,
  version_no: 2,
  sha256: SHA_C,
}

const title = () => screen.getByText('credit.legalTrail.title')
const headers = () =>
  within(screen.getByRole('table'))
    .getAllByRole('columnheader')
    .map((cell) => cell.textContent)
const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)
/** Ячейка строки под столбцом с этим заголовком (ключ мока `t`). */
const cell = (row: HTMLElement, column: string) => {
  const index = headers().indexOf(`credit.legalTrail.columns.${column}`)
  if (index < 0) throw new Error(`столбца ${column} нет`)
  return within(row).getAllByRole('cell')[index]
}
const column = (name: string) => bodyRows().map((row) => cell(row, name).textContent)

afterEach(cleanup)

describe('CreditLegalTrail: строки следа (AC-1)', () => {
  beforeEach(() => {
    render(<CreditLegalTrail value={[A, B, C]} />)
  })

  it('подзаголовок со счётом и строки в порядке массива', () => {
    expect(title().textContent).toBe('credit.legalTrail.title · 3')
    expect(column('subject')).toEqual(['sign.max_cost', 'disclosure.brand', 'privacy_policy'])
  })

  it('источник, версия с номером публикации, язык', () => {
    expect(column('source')).toEqual([
      'credit.legalTrail.source.legalTexts',
      'credit.legalTrail.source.legalTexts',
      'credit.legalTrail.source.siteDocuments',
    ])
    expect(column('version')).toEqual(['v1 · #63', 'v1 · #2', 'v2 · #5'])
    expect(column('locale')).toEqual(['en', 'en', 'en'])
  })

  it('«Показано» — часы сайта или «—» (момент приёма не подставляется); «Отримано» — всегда', () => {
    expect(column('shownAt')).toEqual(['—', formatDateTime(SHOWN), '—'])
    expect(column('receivedAt')).toEqual(Array(3).fill(formatDateTime(RECEIVED)))
  })

  it('отпечаток — первые 12 знаков', () => {
    expect(column('sha256')).toEqual([SHA_A, SHA_B, SHA_C].map((sha) => sha.slice(0, 12)))
  })
})

describe('CreditLegalTrail: столбцы по наличию данных (AC-2, AC-3)', () => {
  it('все `shown_at` = null и нет `door` → ни «Показано», ни «Етап»', () => {
    render(<CreditLegalTrail value={[A, { ...A, subject: 'licence.view_pdf' }]} />)
    expect(headers()).not.toContain('credit.legalTrail.columns.shownAt')
    expect(headers()).not.toContain('credit.legalTrail.columns.door')
    expect(headers()).toContain('credit.legalTrail.columns.receivedAt')
  })

  it('этап: известные значения подписаны, незнакомое — как пришло, без поля — «—»', () => {
    render(
      <CreditLegalTrail
        value={[{ ...A, door: 'intake' }, { ...A, door: 'sign' }, { ...A, door: 'screen_x' }, A]}
      />
    )
    expect(column('door')).toEqual([
      'credit.legalTrail.door.intake',
      'credit.legalTrail.door.sign',
      'screen_x',
      '—',
    ])
  })

  it('`door` пустой у всех строк — столбца нет', () => {
    render(
      <CreditLegalTrail
        value={[
          { ...A, door: '' },
          { ...B, door: '' },
        ]}
      />
    )
    expect(headers()).not.toContain('credit.legalTrail.columns.door')
  })
})

describe('CreditLegalTrail: состояния и терпимость (AC-4)', () => {
  it.each([
    ['поля нет', undefined],
    ['null', null],
    ['объект', {}],
    ['строка', 'x'],
  ])('%s → блока нет', (_name, value) => {
    const { container } = render(<CreditLegalTrail value={value} />)
    expect(container.textContent).toBe('')
  })

  it.each([
    ['пустой массив', []],
    ['только не-объекты', [null, 'x']],
  ])('%s → подзаголовок и «следа нет», таблицы нет', (_name, value) => {
    render(<CreditLegalTrail value={value} />)
    expect(title().textContent).toBe('credit.legalTrail.title')
    expect(screen.getByText('credit.legalTrail.empty')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('не-объекты пропускаются: одна строка и счёт 1', () => {
    render(<CreditLegalTrail value={[null, 'x', A]} />)
    expect(title().textContent).toBe('credit.legalTrail.title · 1')
    expect(bodyRows()).toHaveLength(1)
    expect(screen.queryByText('credit.legalTrail.empty')).toBeNull()
  })

  it('нечисло в версии, пустой отпечаток, неразборная дата → «—», кнопки копирования нет', () => {
    render(
      <CreditLegalTrail
        value={[{ ...A, version_no: 'one', sha256: null, received_at: 'not-a-date' }]}
      />
    )
    expect(column('version')).toEqual(['v— · #63'])
    expect(column('sha256')).toEqual(['—'])
    expect(column('receivedAt')).toEqual(['—'])
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('значения не того вида → «—» в своих ячейках, рендер не падает', () => {
    render(
      <CreditLegalTrail
        value={[
          {
            ...B,
            received_at: 123,
            shown_at: {},
            subject: {},
            locale: 7,
            sha256: 123,
            publication_id: '63',
          },
          B,
        ]}
      />
    )
    const [broken] = bodyRows()
    expect(cell(broken, 'subject').textContent).toBe('—')
    expect(cell(broken, 'locale').textContent).toBe('—')
    expect(cell(broken, 'shownAt').textContent).toBe('—')
    expect(cell(broken, 'receivedAt').textContent).toBe('—')
    expect(cell(broken, 'sha256').textContent).toBe('—')
    expect(cell(broken, 'version').textContent).toBe('v1 · #—')
  })

  it('один `subject` дважды (разные языки) — обе строки, без предупреждения о ключах', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(<CreditLegalTrail value={[A, { ...A, locale: 'uk' }, A]} />)
      expect(column('subject')).toEqual(['sign.max_cost', 'sign.max_cost', 'sign.max_cost'])
      expect(error).not.toHaveBeenCalled()
    } finally {
      error.mockRestore()
    }
  })
})

describe('CreditLegalTrail: отпечаток и точные значения (AC-5)', () => {
  it('кнопка по подписи строки кладёт в буфер полный отпечаток', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<CreditLegalTrail value={[A, B, C]} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'credit.actions.copy · disclosure.brand · en' })
    )
    expect(writeText).toHaveBeenCalledWith(SHA_B)
  })

  it('один `subject` в двух языках и на этапе — подписи различны, каждая копирует свой отпечаток', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(
      <CreditLegalTrail
        value={[
          A,
          { ...A, locale: 'uk', sha256: SHA_B },
          { ...A, door: 'intake', sha256: SHA_C },
          { ...A, locale: '', sha256: SHA_D },
        ]}
      />
    )
    const copy = 'credit.actions.copy · sign.max_cost'
    const expected: Array<[string, string]> = [
      [`${copy} · en`, SHA_A],
      [`${copy} · uk`, SHA_B],
      [`${copy} · en · credit.legalTrail.door.intake`, SHA_C],
      [copy, SHA_D],
    ]
    expect(
      screen.getAllByRole('button').map((button) => button.getAttribute('aria-label'))
    ).toEqual(expected.map(([name]) => name))
    for (const [name, sha] of expected) {
      writeText.mockClear()
      fireEvent.click(screen.getByRole('button', { name }))
      expect(writeText).toHaveBeenCalledTimes(1)
      expect(writeText).toHaveBeenCalledWith(sha)
    }
  })

  it('`title` ячеек — полный отпечаток и строки ISO как прислал модуль', () => {
    render(<CreditLegalTrail value={[B]} />)
    const [only] = bodyRows()
    expect(cell(only, 'sha256').title).toBe(SHA_B)
    expect(cell(only, 'shownAt').title).toBe(SHOWN)
    expect(cell(only, 'receivedAt').title).toBe(RECEIVED)
  })

  it('неизвестный раздел журнала — как пришёл', () => {
    render(<CreditLegalTrail value={[{ ...A, source: 'cms-other' }]} />)
    expect(column('source')).toEqual(['cms-other'])
  })
})
