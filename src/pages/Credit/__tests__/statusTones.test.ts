/**
 * У каждого статуса должен быть свой цвет.
 *
 * Дефект, ради которого страж написан, нашёлся сверкой с макетом Figma
 * «Techno-Finance» (фрейм «Credit status»): там девять состояний с цветом и
 * знаком, а у нас **девять статусов вообще не имели тона** и падали в
 * одинаковый серый `default`. Среди них — `disbursement_failed` и
 * `funding_exception`: кредит, где деньги НЕ ДОШЛИ до клиента, выглядел ровно
 * так же, как аккуратно закрытый.
 *
 * Тон подставляется по словарю с запасным значением (`TONES[status] ?? 'default'`),
 * поэтому новый статус не ломает сборку — он молча становится серым. Это
 * удобно и это же опасно: модуль добавляет состояния регулярно, и каждое новое
 * приезжает к оператору бесцветным. Значит проверять должен тест, а не
 * компилятор.
 *
 * Тест читает ИСХОДНИКИ, а не рендерит: важно не «как выглядит один бейдж», а
 * что ни одно значение перечисления не осталось без строки в карте тонов.
 */
import { describe, it, expect } from 'vitest'
import {
  CREDIT_ALL_APPLICATION_STATUSES,
  CREDIT_LOAN_STATUSES,
  CREDIT_QUEUE_STATUSES,
} from '@/features/credit/api/enums'

// `node:fs` здесь нельзя: проектная сборка идёт без типов Node, и `tsc -b`
// (то есть CI) падает на его импорте. Читаем глобом Vite.
const SOURCES = import.meta.glob('../components/CreditStatusBadge.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function tonedStatuses(): Set<string> {
  const source = Object.values(SOURCES)[0]
  const toned = new Set<string>()
  for (const match of source.matchAll(/^ {2}([a-z_]+):\s*'(?:default|ok|warn|danger|accent)'/gm)) {
    toned.add(match[1])
  }
  return toned
}

describe('цвета статусов раздела', () => {
  const toned = tonedStatuses()

  it('карта тонов вообще прочиталась', () => {
    // Контроль от «проверять было нечего»: если разбор исходника сломается,
    // множество окажется пустым и все проверки ниже пройдут «успешно».
    expect(toned.size).toBeGreaterThan(15)
  })

  it.each([
    ['статусы кредита', CREDIT_LOAN_STATUSES],
    ['статусы заявки', CREDIT_ALL_APPLICATION_STATUSES],
    ['статусы очереди', CREDIT_QUEUE_STATUSES],
  ])('%s: ни одного без цвета', (_name, statuses) => {
    const colourless = (statuses as readonly string[]).filter((status) => !toned.has(status))
    expect(colourless).toEqual([])
  })

  it('беда с деньгами не красится как норма', () => {
    // Отдельно и поимённо: эти два состояния означают, что клиент остался без
    // денег. Серый или зелёный здесь — не «неточный оттенок», а неверный ответ
    // на вопрос «всё ли в порядке».
    const source = Object.values(SOURCES)[0]
    for (const status of ['disbursement_failed', 'funding_exception']) {
      expect(source).toMatch(new RegExp(`${status}: 'danger'`))
    }
  })
})
