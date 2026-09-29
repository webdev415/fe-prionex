/**
 * Справочник кодов решения: что форма предлагает к отказу, в каком порядке и
 * каким текстом, и когда индекс пересобирается.
 *
 * Фикстура — срез живого реестра модуля (см. `decisionCodesFixture.ts`), а не
 * придуманные записи: отбор по виду кода проверяется на тех самых `AB-C-01`,
 * `AB-G-06` и `AB-X-08`, которые реестр отдаёт.
 *
 * ⚠️ Индекс кэшируется по `version` — так обещает контракт: новое содержимое
 * реестра = новая версия. Поэтому сцена с иным содержимым обязана нести свою
 * версию: иначе она получит индекс прошлой сцены, и это будет правдой, а не
 * дефектом.
 */
import { describe, it, expect } from 'vitest'
import {
  CREDIT_DECLINE_KINDS,
  decisionCodeText,
  indexDecisionCodes,
  normalizeDecisionCodes,
} from '../decisionCodes'
import { CREDIT_DECISION_CODE_CATEGORIES } from '../enums'
import type { CreditDecisionCodeEntry, CreditDecisionCodesRegistry } from '../types'
import { DECISION_CODES_FIXTURE, entryOf } from './decisionCodesFixture'

const declineIds = (registry: CreditDecisionCodesRegistry) =>
  indexDecisionCodes(registry).declineGroups.flatMap((group) => group.codes.map((c) => c.id))

describe('decisionCodes → что предлагается к отказу', () => {
  it('P-1: коды отказа, автогейта и служебный — да, условное одобрение — нет', () => {
    const ids = declineIds(DECISION_CODES_FIXTURE)

    expect(
      ids,
      'the decline list offers the conditional approval AB-C-01 — a supervisor approval would be sent as a refusal'
    ).not.toContain('AB-C-01')
    // Положительный контроль отбора: автогейт и служебный код реестр тоже
    // принимает отказом, и отбор «только refusal» потерял бы их молча.
    expect(ids, 'the decline list lost the calculator gate AB-G-06').toContain('AB-G-06')
    expect(ids, 'the decline list lost the service code AB-X-08').toContain('AB-X-08')
    expect(
      ids,
      'the decline list is not the seven non-conditional codes of the slice'
    ).toHaveLength(7)
    expect([...CREDIT_DECLINE_KINDS].sort()).toEqual(['gate', 'refusal', 'service'])
  })
})

describe('decisionCodes → язык текста кода', () => {
  const entry = entryOf('AB-O-13')

  it.each(['uk', 'uk-UA'])('P-2: интерфейс %s — первой строкой RU книги, второй EN', (lang) => {
    expect(
      decisionCodeText(entry, lang),
      `the ${lang} interface does not show the book's Russian text first`
    ).toEqual({ primary: entry.ru, secondary: entry.en })
  })

  it.each([['en'], ['es'], [undefined], ['de']])(
    'P-2: интерфейс %s — первой строкой EN, второй RU',
    (lang) => {
      expect(
        decisionCodeText(entry, lang),
        `the ${String(lang)} interface does not show the English text first`
      ).toEqual({ primary: entry.en, secondary: entry.ru })
    }
  )
})

describe('decisionCodes → порядок групп и кодов', () => {
  it('P-3: разделы — в порядке книги, внутри — отказ раньше автогейта, коды одного вида по id, незнакомый раздел — последним', () => {
    const future = {
      ...entryOf('AB-O-13'),
      id: 'AB-O-99',
      category: 'future_category',
    } as unknown as CreditDecisionCodeEntry
    // Порядок ответа намеренно не совпадает ни с книгой, ни с `id`: незнакомый
    // раздел первым, автогейт `AB-G-06` раньше отказа `AB-O-05` того же раздела,
    // два отказа раздела `conduct` — по убыванию `id` (`AB-O-09` раньше `AB-O-08`).
    const order = [
      'AB-X-08',
      'AB-G-06',
      'AB-O-20',
      'AB-O-09',
      'AB-C-01',
      'AB-O-13',
      'AB-O-05',
      'AB-O-08',
    ]
    const shuffled: CreditDecisionCodesRegistry = {
      version: 'book@shuffled',
      codes: [future, ...order.map(entryOf)],
    }

    const groups = indexDecisionCodes(shuffled).declineGroups
    const known = CREDIT_DECISION_CODE_CATEGORIES.filter((category) =>
      groups.some((group) => group.category === category)
    )

    expect(
      groups.map((group) => group.category),
      'the decline groups do not follow the order of the rule book'
    ).toEqual([...known, 'future_category'])
    expect(known).toEqual(['loan_terms', 'conduct', 'financial_hardship', 'income', 'service'])
    expect(
      groups.find((group) => group.category === 'loan_terms')?.codes.map((c) => c.id),
      'inside a section the gate AB-G-06 came before the refusal AB-O-05'
    ).toEqual(['AB-O-05', 'AB-G-06'])
    expect(
      groups.find((group) => group.category === 'conduct')?.codes.map((c) => c.id),
      'inside a section two refusals are not ordered by id — AB-O-09 came before AB-O-08'
    ).toEqual(['AB-O-08', 'AB-O-09'])
    expect(
      groups.at(-1)?.codes.map((c) => c.id),
      'a code of an unknown section was lost instead of shown last'
    ).toEqual(['AB-O-99'])
  })
})

describe('decisionCodes → кэш индекса по версии реестра', () => {
  it('P-4: та же версия — тот же индекс, новая версия — новый текст', () => {
    const first = indexDecisionCodes(DECISION_CODES_FIXTURE)
    const copy = JSON.parse(JSON.stringify(DECISION_CODES_FIXTURE)) as CreditDecisionCodesRegistry
    expect(copy).not.toBe(DECISION_CODES_FIXTURE)

    expect(
      indexDecisionCodes(copy),
      'a re-fetched registry of the same version rebuilt the index — the cache is not keyed by version'
    ).toBe(first)

    const NEW_TEXT = 'Синтетичний текст другої версії реєстру'
    const second: CreditDecisionCodesRegistry = {
      version: 'book@2',
      codes: copy.codes.map((entry) =>
        entry.id === 'AB-O-13' ? { ...entry, ru: NEW_TEXT } : entry
      ),
    }
    const next = indexDecisionCodes(second)

    expect(next, 'a new registry version returned the old index').not.toBe(first)
    expect(
      next.byId.get('AB-O-13')?.ru,
      'a new registry version is shown with the text of the old one'
    ).toBe(NEW_TEXT)
    expect(next.version).toBe('book@2')
  })
})

describe('decisionCodes → поиск кода по id', () => {
  it('P-5: известный код найден, незнакомый — undefined', () => {
    const index = indexDecisionCodes(DECISION_CODES_FIXTURE)

    expect(index.byId.get('AB-O-13')?.en).toBe(entryOf('AB-O-13').en)
    // Условное одобрение к отказу не предлагается, но в индексе есть: карточка
    // решения обязана назвать любой код, который модуль записал.
    expect(index.byId.get('AB-C-01')?.kind).toBe('conditional')
    expect(index.byId.get('AB-O-77')).toBeUndefined()
  })

  it('P-6: коды тела решения — без повторов и по возрастанию', () => {
    expect(normalizeDecisionCodes(['AB-O-20', 'AB-O-13', 'AB-O-20'])).toEqual([
      'AB-O-13',
      'AB-O-20',
    ])
    expect(normalizeDecisionCodes([])).toEqual([])
  })
})
