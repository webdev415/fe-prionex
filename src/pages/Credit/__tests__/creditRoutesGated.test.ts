/**
 * Ни один маршрут раздела не должен остаться мимо рубильника.
 *
 * Компонент-калитку легко написать и забыть повесить на шестой маршрут —
 * именно так и жила предыдущая версия: рубильник убирал пункт меню, а прямая
 * ссылка открывала раздел. Экранный тест калитки этого не поймает: он
 * проверяет саму калитку, а не то, что она стоит в дверях.
 *
 * Поэтому тест читает ИСХОДНИК таблицы маршрутов (тем же способом, что страж
 * ключей словаря: `import.meta.glob` с `?raw`, а не `node:fs` — сборка проекта
 * идёт без типов Node, и `tsc -b`, то есть CI, падает на импорте `node:fs`).
 */
import { describe, it, expect } from 'vitest'

const ROUTES_SOURCE = Object.values(
  import.meta.glob('../../../routes/index.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
)[0]

/** Кусок таблицы от одного `path: '…'` до следующего. */
function routeBlocks(): Array<{ path: string; body: string }> {
  return ROUTES_SOURCE.split("path: '")
    .slice(1)
    .map((body) => ({ path: body.slice(0, body.indexOf("'")), body }))
}

describe('маршруты раздела «Кредитный модуль»', () => {
  it('каждый закрыт рубильником `crm_section`', () => {
    const credit = routeBlocks().filter(
      (route) => route.path === 'credit' || route.path.startsWith('credit/')
    )

    // Контроль от пустой выборки: маршруты могли переименовать, и тогда
    // «все закрыты» означало бы «проверять было нечего».
    expect(credit.length).toBeGreaterThanOrEqual(6)

    const unguarded = credit
      // Редирект `credit` → `credit/applications` калитки не требует: он никого
      // никуда не пускает, а ведёт на маршрут, который ею закрыт.
      .filter((route) => !route.body.includes('<Navigate'))
      .filter((route) => !route.body.includes('<CreditSectionGate>'))
      .map((route) => route.path)

    expect(unguarded).toEqual([])
  })
})
