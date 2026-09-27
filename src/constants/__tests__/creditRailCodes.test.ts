/**
 * Перечни операций рельса в `enums.ts` — копия контракта модуля, а не список
 * «что уже видели» (story 17-6f, Р-176f-4).
 *
 * Коды отказа, статусы и шаги Zūm приходят открытыми строками: провайдер
 * расширяет словарь без нашего релиза. Экран называет значение словами, только
 * если оно есть в перечне `enums.ts`, а словари раздела покрывают ровно перечни
 * (`i18nKeys.test.ts` обходит `CREDIT_DYNAMIC_NAMESPACES`). Значит, перечень,
 * разошедшийся с контрактом, молча уронит оператору машинное имя — или,
 * наоборот, подпишет чужой код своим.
 *
 * Страж сверяет каждый перечень с vendored-снимком контракта
 * (`./vendored/credit-rail-codes.json`), подписи снимка — с его списками, и
 * регистрацию пространств словаря — с перечнями. Живой контракт тест не
 * открывает: пересъёмка — по README рядом со снимком.
 */
import { describe, it, expect } from 'vitest'
import snapshot from './vendored/credit-rail-codes.json'
import {
  CREDIT_DISBURSEMENT_STATES,
  CREDIT_DYNAMIC_NAMESPACES,
  CREDIT_MODULE_RAIL_FAILURE_CODES,
  CREDIT_MODULE_RAIL_FAILURE_PATTERNS,
  CREDIT_RAIL_FAILURE_CODES,
  CREDIT_RAIL_MODULE_STATUSES,
  CREDIT_RAIL_STAND_FAILURE_CODES,
  CREDIT_ZUM_EVENTS,
  CREDIT_ZUM_FAILURE_CODES,
  CREDIT_ZUM_STATUSES,
} from '@/features/credit/api/enums'
import { isCommitSha, isSha256Hex } from './creditPermissionSets'

/** Снимок как словарь: имена списков и их подписей читаются по строке. */
const SNAP = snapshot as unknown as Record<string, unknown>

/** Список снимка → перечень `enums.ts`, схема контракта и число значений на съёмке. */
const LISTS: Array<{ name: string; schema: string; values: readonly string[]; size: number }> = [
  {
    name: 'zum_failure_codes',
    schema: 'RailProviderFailureCode.x-known-values',
    values: CREDIT_ZUM_FAILURE_CODES,
    size: 44,
  },
  {
    name: 'module_failure_codes',
    schema: 'RailModuleFailureCode.x-known-values',
    values: CREDIT_MODULE_RAIL_FAILURE_CODES,
    size: 9,
  },
  {
    name: 'module_failure_code_patterns',
    schema: 'RailModuleFailureCode.x-known-patterns',
    values: CREDIT_MODULE_RAIL_FAILURE_PATTERNS,
    size: 1,
  },
  {
    name: 'zum_statuses',
    schema: 'RailProviderStatus.x-known-values',
    values: CREDIT_ZUM_STATUSES,
    size: 7,
  },
  {
    name: 'module_statuses',
    schema: 'RailModuleStatus.x-known-values',
    values: CREDIT_RAIL_MODULE_STATUSES,
    size: 1,
  },
  {
    name: 'zum_events',
    schema: 'RailOperationEvent.properties.event.description',
    values: CREDIT_ZUM_EVENTS,
    size: 15,
  },
]

function listOf(name: string): string[] {
  const value = SNAP[name]
  return Array.isArray(value) ? (value as string[]) : []
}

const sorted = (values: readonly string[]) => [...values].sort()

/**
 * Подпись списка: `sha256(sorted(list).join('\n'))` — тот же алгоритм, что у
 * соседнего снимка прав (README). WebCrypto, а не модуль crypto из Node: тот
 * уронил бы `tsc -b`.
 */
async function listHash(values: readonly string[]): Promise<string> {
  const bytes = new TextEncoder().encode(sorted(values).join('\n'))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

describe('снимок перечней рельса: происхождение', () => {
  it('источник — контракт credit-module, коммит и sha256 по форме', () => {
    expect(snapshot.source_repo).toBe('CRM/credit-module')
    expect(snapshot.source_path).toBe('contracts/openapi.yaml')
    expect(isCommitSha(snapshot.source_commit_sha), 'source_commit_sha не 40-hex').toBe(true)
    expect(isSha256Hex(snapshot.source_sha256), 'source_sha256 не 64-hex').toBe(true)
    expect(
      Number.isFinite(Date.parse(snapshot.captured_at)),
      'captured_at не разбираемая дата'
    ).toBe(true)
    expect(snapshot.captured_by.trim(), 'captured_by пуст').not.toBe('')
  })

  it('проза шагов Zūm названа диапазоном строк источника', () => {
    // Шаги контракт перечисляет только прозой: без диапазона пересъёмка не
    // найдёт, откуда снят список, и сверит его не с тем абзацем.
    expect(snapshot.source_lines.zum_events).toMatch(/^\d+-\d+$/)
  })

  it.each(LISTS)('$name: схема источника названа', ({ name, schema }) => {
    const schemas = snapshot.source_schemas as Record<string, string>
    expect(schemas[name], `в source_schemas нет схемы списка ${name}`).toBe(schema)
  })
})

describe('снимок перечней рельса: списки и подписи', () => {
  it.each(LISTS)('$name: список отсортирован, без дублей, размера съёмки', ({ name, size }) => {
    const list = listOf(name)
    expect(list, `список ${name} в снимке не отсортирован`).toEqual(sorted(list))
    expect(new Set(list).size, `в списке ${name} есть дубли`).toBe(list.length)
    expect(list, `список ${name}: значений не столько, сколько снято`).toHaveLength(size)
  })

  it.each(LISTS)('$name: подпись списка сходится', async ({ name }) => {
    expect(
      await listHash(listOf(name)),
      `подпись ${name}_sha256 не сходится со списком снимка — список правили без пересъёмки`
    ).toBe(SNAP[`${name}_sha256`])
  })

  it('контроль: дописанный в копию код ломает подпись', async () => {
    const list = listOf('zum_failure_codes')
    const mutated = [...list, 'EftFailedSomethingNew']
    expect(mutated, 'контроль не построен: код не дописан').not.toEqual(list)
    expect(
      await listHash(mutated),
      'контроль не покраснел: подпись сошлась на изменённом списке'
    ).not.toBe(SNAP.zum_failure_codes_sha256)
  })
})

describe('перечни enums.ts равны снимку контракта', () => {
  it.each(LISTS)('$name: множество enums.ts — ровно множество снимка', ({ name, values }) => {
    expect(
      sorted(values),
      `перечень enums.ts для ${name} разошёлся со снимком контракта: правьте пересъёмкой, а не руками`
    ).toEqual(listOf(name))
    expect(new Set(values).size, `в перечне enums.ts для ${name} есть дубли`).toBe(values.length)
  })

  it('коды Zūm и коды модуля не пересекаются — подпись владельца однозначна', () => {
    const module = new Set<string>(CREDIT_MODULE_RAIL_FAILURE_CODES)
    const both = CREDIT_ZUM_FAILURE_CODES.filter((code) => module.has(code))
    expect(
      both,
      'код числится и у Zūm, и у модуля: экран подпишет его то «код Zūm», то «код модуля»'
    ).toEqual([])
  })

  it('статусы Zūm и слова модуля не пересекаются — слово модуля не выдаётся за слово Zūm', () => {
    const module = new Set<string>(CREDIT_RAIL_MODULE_STATUSES)
    expect(CREDIT_ZUM_STATUSES.filter((status) => module.has(status))).toEqual([])
  })

  it('шаги Zūm не дублируют коды отказа — у одного кода один текст', () => {
    const codes = new Set<string>(CREDIT_ZUM_FAILURE_CODES)
    expect(CREDIT_ZUM_EVENTS.filter((event) => codes.has(event))).toEqual([])
  })

  it('словарь текстов кодов = модуль ∪ Zūm ∪ слово стенда, 54 без дублей', () => {
    const union = [
      ...CREDIT_MODULE_RAIL_FAILURE_CODES,
      ...CREDIT_ZUM_FAILURE_CODES,
      ...CREDIT_RAIL_STAND_FAILURE_CODES,
    ]
    expect(sorted(CREDIT_RAIL_FAILURE_CODES)).toEqual(sorted(union))
    expect(new Set(CREDIT_RAIL_FAILURE_CODES).size).toBe(CREDIT_RAIL_FAILURE_CODES.length)
    expect(CREDIT_RAIL_FAILURE_CODES).toHaveLength(54)
  })

  it('шаблон семейства распознаёт код целиком, а не по префиксу', () => {
    const matches = (code: string) =>
      CREDIT_MODULE_RAIL_FAILURE_PATTERNS.some((pattern) => new RegExp(pattern).test(code))
    expect(matches('zum_http_503'), 'семейство не узнало свой код').toBe(true)
    // Контроли формы: два знака статуса, буквы и чужой префикс — не семейство.
    expect(matches('zum_http_50')).toBe(false)
    expect(matches('zum_http_abc')).toBe(false)
    expect(matches('x_zum_http_503')).toBe(false)
  })
})

describe('пространства словаря зарегистрированы своими перечнями', () => {
  // Без регистрации страж `i18nKeys` (динамические ключи) выключился бы для
  // пространства молча: удалённое из реестра пространство он просто не обходит.
  const REGISTRY: Array<[string, readonly string[]]> = [
    ['railFailure', CREDIT_RAIL_FAILURE_CODES],
    ['zumStatus', CREDIT_ZUM_STATUSES],
    ['railModuleStatus', CREDIT_RAIL_MODULE_STATUSES],
    ['zumEvent', CREDIT_ZUM_EVENTS],
    ['railOperationState', CREDIT_DISBURSEMENT_STATES],
  ]

  it.each(REGISTRY)('%s — в реестре и со своим перечнем', (namespace, values) => {
    expect(
      CREDIT_DYNAMIC_NAMESPACES[namespace],
      `пространство ${namespace} не зарегистрировано в CREDIT_DYNAMIC_NAMESPACES`
    ).toBeDefined()
    expect(sorted(CREDIT_DYNAMIC_NAMESPACES[namespace] ?? [])).toEqual(sorted(values))
  })

  it('прежнего пространства disbursementFailure в реестре нет', () => {
    // Один словарь кодов на раздел: вторая копия дала бы одному коду два текста.
    expect(Object.hasOwn(CREDIT_DYNAMIC_NAMESPACES, 'disbursementFailure')).toBe(false)
    // Положительный контроль того же поиска.
    expect(Object.hasOwn(CREDIT_DYNAMIC_NAMESPACES, 'railFailure')).toBe(true)
  })
})
