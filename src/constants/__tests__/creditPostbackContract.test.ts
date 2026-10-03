/**
 * Перечни постбеков партнерам в `postbacks.ts` — копия контракта модуля, а не
 * список «что уже видели» (18-13d-a1, AC-a8; образец — `creditRailCodes.test.ts`).
 *
 * Триггеры, макросы, исходы и причины пропуска приходят открытыми строками:
 * модуль расширяет их без нашего релиза. Экран называет значение словами,
 * только если оно есть в перечне, а словари покрывают ровно перечни
 * (`i18nKeys.test.ts` обходит `CREDIT_DYNAMIC_NAMESPACES`). Перечень,
 * разошедшийся с контрактом, молча уронит маркетологу машинное имя — или
 * подпишет чужой код своим.
 *
 * Страж сверяет перечни с vendored-снимком контракта
 * (`./vendored/credit-postback-contract.json`), подписи снимка — с его
 * списками, и регистрацию пространства триггеров — с перечнем. Живой контракт
 * тест не открывает: пересъёмка — по README рядом со снимком. Исходы и причины
 * пропуска сняты сразу (их показывает лог, 18-13d-b) — их сверку с перечнем
 * добавит та единица.
 */
import { describe, it, expect } from 'vitest'
import snapshot from './vendored/credit-postback-contract.json'
import { CREDIT_DYNAMIC_NAMESPACES } from '@/features/credit/api/enums'
import {
  CREDIT_POSTBACK_AMOUNT_TRIGGERS,
  CREDIT_POSTBACK_MACROS,
  CREDIT_POSTBACK_TRIGGERS,
} from '@/features/credit/api/postbacks'
import { isCommitSha, isSha256Hex } from './creditPermissionSets'

/** Снимок как словарь: имена списков и их подписей читаются по строке. */
const SNAP = snapshot as unknown as Record<string, unknown>

/** Список снимка → схема контракта, число значений на съёмке и перечень `postbacks.ts` (если есть). */
const LISTS: Array<{ name: string; schema: string; size: number; values?: readonly string[] }> = [
  {
    name: 'triggers',
    schema: 'PartnerPostbackRule.properties.trigger.enum',
    size: 2,
    values: CREDIT_POSTBACK_TRIGGERS,
  },
  {
    name: 'amount_triggers',
    schema: 'paths./api/v1/credit/admin/partner-postbacks/rules.post.description',
    size: 1,
    values: CREDIT_POSTBACK_AMOUNT_TRIGGERS,
  },
  {
    name: 'macros',
    schema: 'PartnerPostbackRuleList.properties.macros.items.enum',
    size: 5,
    values: CREDIT_POSTBACK_MACROS,
  },
  { name: 'outcomes', schema: 'PartnerPostbackDelivery.properties.status.enum', size: 5 },
  {
    name: 'skip_reasons',
    schema: 'PartnerPostbackDelivery.properties.skip_reason.enum',
    size: 3,
  },
]

function listOf(name: string): string[] {
  const value = SNAP[name]
  return Array.isArray(value) ? (value as string[]) : []
}

const sorted = (values: readonly string[]) => [...values].sort()

/** Подпись списка: `sha256(sorted(list).join('\n'))` — алгоритм соседних снимков (README). */
async function listHash(values: readonly string[]): Promise<string> {
  const bytes = new TextEncoder().encode(sorted(values).join('\n'))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

describe('снимок перечней постбеков: происхождение', () => {
  it('источник — контракт credit-module на main, коммит и sha256 по форме', () => {
    expect(snapshot.source_repo).toBe('CRM/credit-module')
    expect(snapshot.source_ref).toBe('main')
    expect(snapshot.source_path).toBe('contracts/openapi.yaml')
    expect(isCommitSha(snapshot.source_commit_sha), 'source_commit_sha не 40-hex').toBe(true)
    expect(isSha256Hex(snapshot.source_sha256), 'source_sha256 не 64-hex').toBe(true)
    expect(
      Number.isFinite(Date.parse(snapshot.captured_at)),
      'captured_at не разбираемая дата'
    ).toBe(true)
    expect(snapshot.captured_by.trim(), 'captured_by пуст').not.toBe('')
  })

  it('проза «`{amount}` — только у `new_loan`» названа диапазоном строк источника', () => {
    expect(snapshot.source_lines.amount_triggers).toMatch(/^\d+-\d+$/)
  })

  it.each(LISTS)('$name: схема источника названа', ({ name, schema }) => {
    const schemas = snapshot.source_schemas as Record<string, string>
    expect(schemas[name], `в source_schemas нет схемы списка ${name}`).toBe(schema)
  })
})

describe('снимок перечней постбеков: списки и подписи', () => {
  it.each(LISTS)('$name: отсортирован, без дублей, размера съёмки', ({ name, size }) => {
    const list = listOf(name)
    expect(list, `список ${name} в снимке не отсортирован`).toEqual(sorted(list))
    expect(new Set(list).size, `в списке ${name} есть дубли`).toBe(list.length)
    expect(list, `список ${name}: значений не столько, сколько снято`).toHaveLength(size)
  })

  it.each(LISTS)('$name: подпись списка сходится', async ({ name }) => {
    expect(
      await listHash(listOf(name)),
      `подпись ${name}_sha256 не сходится — список правили без пересъёмки`
    ).toBe(SNAP[`${name}_sha256`])
  })

  it('триггеры с `{amount}` — подмножество триггеров', () => {
    const triggers = new Set(listOf('triggers'))
    expect(listOf('amount_triggers').filter((code) => !triggers.has(code))).toEqual([])
  })

  it('контроль: дописанный в копию триггер ломает подпись', async () => {
    const mutated = [...listOf('triggers'), 'loan_repaid']
    expect(await listHash(mutated)).not.toBe(SNAP.triggers_sha256)
  })
})

describe('перечни postbacks.ts равны снимку контракта', () => {
  it.each(LISTS.filter((list) => list.values))(
    '$name: множество postbacks.ts — ровно множество снимка',
    ({ name, values }) => {
      const own = values ?? []
      expect(
        sorted(own),
        `перечень postbacks.ts для ${name} разошёлся со снимком: правьте пересъёмкой, а не руками`
      ).toEqual(listOf(name))
      expect(new Set(own).size, `в перечне postbacks.ts для ${name} есть дубли`).toBe(own.length)
    }
  )

  it('сверяются все три перечня a1 — выборка не усохла', () => {
    expect(LISTS.filter((list) => list.values).map((list) => list.name)).toEqual([
      'triggers',
      'amount_triggers',
      'macros',
    ])
  })
})

describe('пространство триггеров зарегистрировано своим перечнем', () => {
  // Без регистрации страж `i18nKeys` (динамические ключи) выключился бы для
  // пространства молча: незарегистрированное пространство он просто не обходит.
  it('postbacks.trigger — в реестре и равно перечню триггеров', () => {
    const registered = CREDIT_DYNAMIC_NAMESPACES['postbacks.trigger']
    expect(registered, 'пространство postbacks.trigger не зарегистрировано').toBeDefined()
    expect(sorted(registered ?? [])).toEqual(sorted(CREDIT_POSTBACK_TRIGGERS))
  })
})
