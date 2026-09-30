import { describe, it, expect } from 'vitest'
import enCommon from '@/../public/locales/en/common.json'
import ukCommon from '@/../public/locales/uk/common.json'

type Json = Record<string, unknown>

// `pages.clients.detail.tabs.` пришло сюда со вкладкой «Кредит (наш)» (WS-11,
// story 14-7): её подпись читают и полоса вкладок карточки, и лента активности
// клиента, а под страж раздела `credit.*` она не попадает — другой префикс.
// Пропавший английский ключ показал бы англоязычному оператору машинное имя, и
// до этого файла такое расхождение не краснило ничего.
// `pages.aiAssistant.` — тумблер «Міркування 31B» (#149): строки переключателя
// живут в обеих локалях, и расхождение ловится тем же стражем.
// `pages.clients.detail.creditModule` — тем же ходом и по той же причине
// (WS-11, story 14-7b): подпись чипа «кредит (наш)» и подсказка «Дії — у
// кредитному модулі» зовутся из `ClientManagement/components/LoanCard.tsx` и
// начинаются с `pages.`, поэтому страж раздела `i18nKeys.test.ts` их не видит
// дважды — он читает только `pages/Credit/**` и `features/credit/**` и только
// префикс `credit.`. Без этой строки пропажа английского значения доехала бы
// до оператора молча.
// Тип договора покупки (KAN-1617): слова типа, подписи дат карточки кредита,
// блок договора на шаге загрузки и колонка у продавца — по ним оператор решает,
// какие слова говорить должнику, и машинный ключ вместо них недопустим.
const SUBTREES = [
  'pages.lawyerWorkplace.',
  'pages.training.',
  'pages.clients.detail.tabs.',
  'pages.aiAssistant.',
  'pages.clients.detail.creditModule',
  'saleType.',
  'pages.clients.detail.tableHeaders.',
  'pages.imports.step1.factoringAgreement.',
  'pages.sellers.detail.factoringAgreements.columns.',
  'pages.documentGeneration.templates.saleTypes.',
] as const

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

function flattenKeys(obj: Json, prefix = ''): string[] {
  const keys: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as Json, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}

/** Plural forms differ per language (en: _one/_other, uk: _one/_few/_many), compare base keys. */
function normalizedKeys(obj: Json, subtree: string): Set<string> {
  return new Set(
    flattenKeys(obj)
      .filter((k) => k.startsWith(subtree))
      .map((k) => k.replace(PLURAL_SUFFIX, ''))
  )
}

// Сверка множеств зеленеет на ПУСТОМ множестве: опечатка в префиксе поддерева
// (или переименование ключей под ним) дала бы два пустых набора и «паритет
// соблюдён» — страж сверял бы ничто. Поэтому каждая сверка начинается с
// утверждения, что сторона, которую она перебирает, непуста.
describe.each(SUBTREES)('locale parity for %s', (subtree) => {
  it('every en key exists in uk', () => {
    const en = normalizedKeys(enCommon as Json, subtree)
    const uk = normalizedKeys(ukCommon as Json, subtree)
    expect(en.size, `поддерево ${subtree} пусто — паритет сверял бы ничто`).toBeGreaterThan(0)
    const missing = [...en].filter((k) => !uk.has(k))
    expect(missing, `ключи есть в en и отсутствуют в uk: ${missing.join(', ')}`).toEqual([])
  })

  it('every uk key exists in en', () => {
    const en = normalizedKeys(enCommon as Json, subtree)
    const uk = normalizedKeys(ukCommon as Json, subtree)
    expect(uk.size, `поддерево ${subtree} пусто — паритет сверял бы ничто`).toBeGreaterThan(0)
    const extra = [...uk].filter((k) => !en.has(k))
    expect(extra, `ключи есть в uk и отсутствуют в en: ${extra.join(', ')}`).toEqual([])
  })
})
