/**
 * Страж КЛАССА, а не одного инстанса: служебный ключ и роль стенда не
 * встречаются в исполняемом коде нигде в `src`.
 *
 * Зачем отдельно от `credentials.test.ts`. Тот перебирает методы `creditApi`
 * и подменяет адаптер модульного синглтона `creditHttp` — то есть стережёт
 * ОДНУ дверь. Всё, что пойдёт мимо этой пары, он не увидит: кредитная ручка,
 * позванная через общий клиент CRM, голый `fetch`, новый экземпляр axios в
 * соседнем файле, чтение ключа стенда каким-нибудь дев-инструментом вне
 * `features/credit`. Сегодня таких путей в дереве нет — значит момент для
 * дешёвого стража идеальный: он фиксирует ноль, а не чинит найденное.
 *
 * Правило, которое здесь исполняется: имена служебной схемы могут
 * встречаться в ОБЪЯСНЕНИЯХ (комментарий, объясняющий, почему заголовка
 * больше нет, полезен) и ровно в одном месте кода — в уборке прежних
 * секретов. Везде ещё в исполняемом коде их быть не должно.
 *
 * ⚠️ Почему обход через `import.meta.glob`, а не через `node:fs`. Замер
 * 20.09.2026 в изолированной копии дерева: файл с `import { readdirSync }
 * from 'node:fs'` роняет `npm run typecheck` (`tsc -b`) —
 * `error TS2307: Cannot find module 'node:fs' or its corresponding type
 * declarations`, потому что `tsconfig.app.json` объявляет `"types":
 * ["vite/client"]` и типов Node в сборке нет. То есть путь через `fs` красит
 * required-контекст `Type Check`. Приём с глобом взят из соседнего
 * `CreditUnderwritingQueuePage.test.tsx`, где тот же довод уже записан.
 */
import { describe, it, expect } from 'vitest'

/** Имена служебной схемы, которой в браузере больше нет. */
const FORBIDDEN = [
  'X-Internal-Api-Key',
  'X-Operator-Role',
  'credit.stand.apiKey',
  'credit.stand.role',
] as const

/**
 * Единственный файл, которому эти имена разрешены в КОДЕ, и только в уборке:
 * `purgeStandCredentials` обязана знать, что именно стирает.
 */
const CLEANUP_OWNER = 'src/features/credit/api/creditApi.ts'

/**
 * Нижняя граница обхода. Замер 20.09.2026: файлов `.ts`/`.tsx` в `src` вне
 * `__tests__` — 1621. Порог с запасом на штатные удаления, но он есть: без
 * него страж остался бы зелёным и тогда, когда глоб перестал бы что-либо
 * находить, — классическое зелёное на пустом множестве.
 */
const MIN_FILES_SCANNED = 1200

const SOURCES = import.meta.glob(['/src/**/*.ts', '/src/**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Путь глоба — от корня проекта; приводим к виду `src/...`. */
function toRepoPath(globPath: string): string {
  return globPath.replace(/^\//, '')
}

/** Тесты пишут эти имена по своему предмету — они не часть боевого кода. */
function isTestFile(path: string): boolean {
  return path.includes('/__tests__/') || path.startsWith('src/test/')
}

/** Строка-объяснение, а не исполняемый код. */
function isComment(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')
}

/** Единственный законный код: уборка прежних секретов. */
function isCleanupLine(path: string, line: string): boolean {
  return path === CLEANUP_OWNER && line.includes('removeItem(')
}

interface Hit {
  path: string
  line: number
  text: string
  name: string
}

function collectHits(): { hits: Hit[]; scanned: number; legal: Hit[] } {
  const hits: Hit[] = []
  const legal: Hit[] = []
  let scanned = 0

  for (const [globPath, source] of Object.entries(SOURCES)) {
    const path = toRepoPath(globPath)
    if (isTestFile(path)) continue
    scanned += 1

    source.split('\n').forEach((line, index) => {
      for (const name of FORBIDDEN) {
        if (!line.includes(name)) continue
        const hit = { path, line: index + 1, text: line.trim(), name }
        if (isComment(line)) continue
        if (isCleanupLine(path, line)) {
          legal.push(hit)
          continue
        }
        hits.push(hit)
      }
    })
  }

  return { hits, scanned, legal }
}

describe('служебные учётные данные не живут в исходниках раздела', () => {
  it('обход покрывает всё дерево src, а не его остаток', () => {
    const { scanned } = collectHits()
    // Без этой проверки сломавшийся глоб дал бы «нарушений нет» на пустом
    // множестве файлов, и страж молчал бы ровно тогда, когда он нужен.
    expect(scanned).toBeGreaterThanOrEqual(MIN_FILES_SCANNED)
    // И контрольные точки: три файла, которые обязаны быть в выборке.
    const paths = Object.keys(SOURCES).map(toRepoPath)
    expect(paths).toContain(CLEANUP_OWNER)
    expect(paths).toContain('src/pages/Credit/CreditApplicationsPage.tsx')
    expect(paths).toContain('src/features/credit/hooks/useCredit.ts')
  })

  it('законный случай существует и найден — allow-list не прикрывает пустоту', () => {
    const { legal } = collectHits()
    // Положительный контроль к разрешению: если уборка переименуется или
    // исчезнет, разрешение начнёт прикрывать НИЧЕГО, и молчание стража станет
    // означать не «чисто», а «искать уже нечего».
    expect(legal.length).toBeGreaterThanOrEqual(3)
    expect(legal.every((hit) => hit.path === CLEANUP_OWNER)).toBe(true)
    expect(legal.map((hit) => hit.name).sort()).toContain('credit.stand.role')
  })

  it('ни одного служебного имени в исполняемом коде', () => {
    const { hits } = collectHits()
    const report = hits.map((hit) => `${hit.path}:${hit.line} — ${hit.name}: ${hit.text}`)
    expect(report, `служебные имена вернулись в код:\n${report.join('\n')}`).toEqual([])
  })
})
