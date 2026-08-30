/**
 * Сортируемая колонка обязана называть поле, по которому сервис умеет
 * сортировать, — и поле СВОЕЙ операции.
 *
 * Перечни у кредитов и заявок разные и не пересекаются целиком: `GET /loans`
 * знает семь полей, `GET /applications` — четыре, общего словаря нет. Сервис
 * на чужое поле отвечает 422 (это объявлено в контракте намеренно, тихая
 * подмена порядка была бы хуже отказа), так что промах превращается в пустой
 * экран после клика по заголовку — оператор решит, что кредитов нет.
 *
 * Проверяем исходники, потому что колонки объявлены внутри компонентов.
 * До этого теста перечни в sorting.ts не использовались НИГДЕ: они выглядели
 * защитой, ничего не защищая.
 */
import { describe, it, expect } from 'vitest'
import { LOAN_SORTABLE, APPLICATION_SORTABLE } from '@/features/credit/api/sorting'

const SOURCES = import.meta.glob('../Credit*Page.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function sortKeysOf(fileEnding: string): string[] {
  const [, source] = Object.entries(SOURCES).find(([path]) => path.endsWith(fileEnding)) ?? []
  if (!source) throw new Error(`не найден исходник ${fileEnding}`)
  return [...source.matchAll(/sortKey:\s*'([a-z_]+)'/g)].map((match) => match[1])
}

describe('сортируемые колонки раздела', () => {
  it('в списке кредитов называют только поля GET /loans', () => {
    const keys = sortKeysOf('CreditLoansPage.tsx')
    expect(keys.length).toBeGreaterThan(0)
    expect(keys.filter((key) => !LOAN_SORTABLE.includes(key as never))).toEqual([])
  })

  it('в списке заявок называют только поля GET /applications', () => {
    const keys = sortKeysOf('CreditApplicationsPage.tsx')
    expect(keys.length).toBeGreaterThan(0)
    expect(keys.filter((key) => !APPLICATION_SORTABLE.includes(key as never))).toEqual([])
  })

  it('перечни двух операций не считаются одним словарём', () => {
    // Пересечение есть (created_at), но списки разные — общий словарь колонок
    // на два экрана дал бы 422 на первом же клике по чужому полю.
    expect([...LOAN_SORTABLE].sort()).not.toEqual([...APPLICATION_SORTABLE].sort())
  })
})
