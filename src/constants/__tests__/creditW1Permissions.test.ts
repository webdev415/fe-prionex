/**
 * Право, которое просит интерфейс, обязано существовать в словаре W1.
 *
 * Сегодня связи нет вовсе: в `permissions.ts` лежат десять кредитных литералов, а
 * настоящий словарь живёт в миграции 082 auth-сервиса api-prionex и содержит
 * семнадцать имён. Миграция 098 (19-5a) добавила восемнадцатое — право
 * подтверждения условного одобрения; оно лежит ВТОРЫМ снимком со своим
 * провенансом, а словарь стража — объединение снимков (19-5f). Миграция 100
 * (18-13d) — права постбеков партнерам, ТРЕТИЙ снимок по тому же образцу; из той же
 * миграции 100 право выгрузки заявок CSV (18-13c-b) — ЧЕТВЁРТЫЙ снимок. Опечатка в константе или тихое появление в гейте имени,
 * которого backend не выдаёт, проходят CI зелёными — и оператор получает пункт
 * меню, который никогда не откроется, либо, наоборот, теряет доступ.
 *
 * Тест сверяет УПОТРЕБЛЕНИЯ (а не объявления) с vendored-снимком словаря, плюс
 * отдельно сверяет сами ОБЪЯВЛЕНИЯ: каждая константа `PERMISSIONS.CREDIT.*`
 * либо принадлежит снимку, либо числится в списке вне-W1 — третьего не дано.
 * Снимок не «копия для удобства»: он несёт происхождение (репозиторий, коммит,
 * путь, sha256 источника), поэтому расхождение читается как дрейф словаря, а не
 * как «кто-то поправил константу».
 *
 * ⚠️ ПРЕДЕЛ ФОРМЫ. Употребление распознаётся структурно, по признанным идиомам
 * репозитория: `PERMISSIONS.CREDIT.<ИМЯ>`, `permissions?.includes('…')`,
 * `useHasPermission('…')` / `useHasAnyPermission([…])` / `useHasAllPermissions([…])`,
 * сравнение `p === '…'`. НЕ распознаются и проходят зелёными: право, собранное
 * конкатенацией или шаблонной строкой; вынесенное в переменную-алиас; взятое
 * вычисляемым доступом `PERMISSIONS.CREDIT[key]`; полученное деструктуризацией
 * `const { CREDIT } = PERMISSIONS`. Расширять матчер имеет смысл вместе с
 * появлением такой идиомы в коде, а не впрок.
 *
 * ⚠️ ПРЕДЕЛ ОБЛАСТИ. Читаются четыре области нормы (таблица маршрутов, меню,
 * `pages/Credit/**`, `features/credit/**`). Право, проверяемое где-то ещё в
 * `src/`, этим стражем не сверяется — расширение области записано в deferred.
 *
 * Исходники читаются глобом Vite с `?raw`, а не средствами файловой системы
 * Node: `tsconfig.app.json` держит `types: ["vite/client"]`, и `tsc -b`
 * (job Type Check) падает на таком импорте с TS2307 — проверено на этой базе.
 */
import { describe, it, expect } from 'vitest'
import { PERMISSIONS } from '../permissions'
import snapshot from './vendored/credit-w1-permissions.json'
import snapshot098 from './vendored/credit-confirm-conditional-permission.json'
import snapshot100 from './vendored/credit-postbacks-permissions.json'
import snapshotExport from './vendored/credit-applications-export-permission.json'
import {
  OUT_OF_W1_VALUES,
  PERMISSION_NAME_RE,
  isCommitSha,
  isSha256Hex,
  isTestFile,
} from './creditPermissionSets'

/**
 * Словарь W1 — объединение снимков: 082 (17 имён), 098 (19-5a, 1 имя), 100
 * (18-13d, 2 имени постбеков) и 100 (18-13c-b, 1 имя выгрузки). Снимок 082 не
 * переписывается: его провенанс — один файл миграции.
 */
const W1 = new Set<string>([
  ...snapshot.permissions,
  ...snapshot098.permissions,
  ...snapshot100.permissions,
  ...snapshotExport.permissions,
])

/** Сырой текст снимка — для проверок, которые `JSON.parse` уже не видит. */
const SNAPSHOT_RAW = Object.values(
  import.meta.glob('./vendored/credit-w1-permissions.json', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
)[0]
const SNAPSHOT_098_RAW = Object.values(
  import.meta.glob('./vendored/credit-confirm-conditional-permission.json', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
)[0]
const SNAPSHOT_100_RAW = Object.values(
  import.meta.glob('./vendored/credit-postbacks-permissions.json', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
)[0]
const SNAPSHOT_EXPORT_RAW = Object.values(
  import.meta.glob('./vendored/credit-applications-export-permission.json', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
)[0]

/** Каждый снимок — со своим сырым текстом и своим ожидаемым счётом имён. */
const SNAPSHOTS = [
  { label: '082', snap: snapshot, raw: SNAPSHOT_RAW, expected: 17 },
  { label: '098 (19-5a)', snap: snapshot098, raw: SNAPSHOT_098_RAW, expected: 1 },
  { label: '100 (18-13d)', snap: snapshot100, raw: SNAPSHOT_100_RAW, expected: 2 },
  { label: '100 (18-13c-b)', snap: snapshotExport, raw: SNAPSHOT_EXPORT_RAW, expected: 1 },
]

/** Четыре области нормы. Пути относительные от `src/constants/__tests__/`. */
const SOURCES = {
  ...import.meta.glob('../../routes/index.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob('../../components/layout/DashboardLayout.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob('../../pages/Credit/**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob('../../features/credit/**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
} as Record<string, string>

/**
 * Положительный контроль КАЖДОЙ области глоба.
 *
 * Без него опечатка в шаблоне пути неотличима от «там сегодня честно нет прав»:
 * `features/credit/**` именно таков — употреблений там ноль, одни ключи
 * перевода. Числа — замер базы 8f654086e7: 1 / 1 / 42 / 27 файлов.
 */
const REQUIRED_AREAS = [
  { label: 'таблица маршрутов', prefix: '../../routes/index.tsx', minFiles: 1 },
  { label: 'меню', prefix: '../../components/layout/DashboardLayout.tsx', minFiles: 1 },
  { label: 'страницы раздела', prefix: '../../pages/Credit/', minFiles: 20 },
  { label: 'фичи раздела', prefix: '../../features/credit/', minFiles: 10 },
]

/** Плоская карта 'PERMISSIONS.CREDIT.APPLICATIONS_VIEW' -> 'credit.applications.read'. */
const BY_IDENTIFIER = new Map<string, string>(
  Object.entries(PERMISSIONS.CREDIT).map(([name, value]) => [
    `PERMISSIONS.CREDIT.${name}`,
    value as string,
  ])
)

type Use = { file: string; value: string }

/** Цифры в имени константы законны (версии, уровни); граница слова — чтобы не поймать префикс. */
const IDENTIFIER_RE = /PERMISSIONS\.CREDIT\.([A-Z0-9_]+)\b/g

/**
 * Форма 1: идентификаторы. Разрешаются через карту настоящего объекта
 * `PERMISSIONS` — иначе тест сравнивал бы со снимком ИМЕНА констант
 * (`LOANS_VIEW`), а снимок содержит значения (`credit.loans.read`).
 */
function identifierUses(sources: Record<string, string> = SOURCES): Use[] {
  const out: Use[] = []
  for (const [file, src] of Object.entries(sources)) {
    // Политика одна с голой формой: литерал теста — не употребление.
    if (isTestFile(file)) continue
    for (const match of src.matchAll(IDENTIFIER_RE)) {
      const id = `PERMISSIONS.CREDIT.${match[1]}`
      const value = BY_IDENTIFIER.get(id)
      // Неизвестный идентификатор — отдельный провал, а не «не право»: иначе
      // уменьшение выборки неотличимо от «все права легальны».
      expect(value, `${file}: ${id} — такой константы в PERMISSIONS.CREDIT нет`).toBeTruthy()
      if (value !== undefined) out.push({ file, value })
    }
  }
  return out
}

/** Срез аргументов вызова от открывающей скобки до парной ей закрывающей. */
function callArguments(src: string, openParenIndex: number): string {
  let depth = 0
  for (let i = openParenIndex; i < src.length; i += 1) {
    if (src[i] === '(') depth += 1
    else if (src[i] === ')') {
      depth -= 1
      if (depth === 0) return src.slice(openParenIndex, i + 1)
    }
  }
  return src.slice(openParenIndex, openParenIndex + 400)
}

const PERMISSION_LITERAL_RE = /'(credit\.[A-Za-z0-9_.]+)'/g

/** Признанные идиомы проверки права голой строкой — см. ПРЕДЕЛ ФОРМЫ в шапке. */
const BARE_MATCHERS: RegExp[] = [
  // `overview?.permissions.includes('credit.switches.write')`
  /(?:permissions|perms)\s*\??\.\s*includes\(\s*'(credit\.[A-Za-z0-9_.]+)'\s*\)/g,
  // `.some((p) => p === 'credit.switches.write')`, `if (p !== 'credit.…')`
  /(?:===|!==)\s*'(credit\.[A-Za-z0-9_.]+)'/g,
  /'(credit\.[A-Za-z0-9_.]+)'\s*(?:===|!==)/g,
]

/** Домашние хуки прав репозитория (`src/hooks/usePermissions.ts`). */
const HOOK_CALL_RE = /useHas(?:Any|All)?Permissions?\s*\(/g

/**
 * Форма 2: голые строки В ПРОВЕРКАХ ПРАВ.
 *
 * Матчер привязан к ВЫЗОВУ проверки (`permissions.includes('…')`, домашние
 * хуки, сравнение), а не к виду литерала: в области глоба лежит около 150
 * литералов `'credit.*'`, которые правами НЕ являются (ключи перевода
 * `credit.fields.*`, значения перечислений `credit.status.*`). Регулярка по
 * виду имени дала бы зелёный тест на мусорном множестве.
 */
function bareUses(sources: Record<string, string> = SOURCES): Use[] {
  const out: Use[] = []
  for (const [file, src] of Object.entries(sources)) {
    if (isTestFile(file)) continue
    for (const matcher of BARE_MATCHERS) {
      for (const match of src.matchAll(matcher)) out.push({ file, value: match[1] })
    }
    for (const hook of src.matchAll(HOOK_CALL_RE)) {
      const args = callArguments(src, (hook.index ?? 0) + hook[0].length - 1)
      for (const literal of args.matchAll(PERMISSION_LITERAL_RE))
        out.push({ file, value: literal[1] })
    }
  }
  return out
}

/** Пять голых прав, измеренных на selected exact base 8f654086e7 (буквально, N-13). */
const REQUIRED_BARE = [
  'credit.decisions.decide',
  'credit.products.read',
  'credit.parameters.read',
  'credit.switches.read',
  'credit.switches.write',
]

/** Три положительных файла-якоря голой выборки. */
const REQUIRED_ANCHORS = [
  'pages/Credit/CreditApplicationDetailPage.tsx',
  'pages/Credit/CreditSettingsPage.tsx',
  'pages/Credit/components/CreditSwitchesSection.tsx',
]

/**
 * Якоря идентификаторной формы — НА ФАЙЛ, а не суммой.
 *
 * Общий порог «>= 4 различных» удовлетворяется любым ОДНИМ из двух файлов:
 * и таблица маршрутов, и меню несут по четыре одинаковых имени. Значит полное
 * снятие кредитных прав из таблицы маршрутов оставляло бы порог выполненным.
 * Числа — замер базы: по 4 различных имени в каждом файле.
 */
const REQUIRED_IDENTIFIER_ANCHORS = [
  { file: 'routes/index.tsx', distinct: 4 },
  { file: 'components/layout/DashboardLayout.tsx', distinct: 4 },
]

/** Общий предикат принадлежности — им пользуются и знаки, и отрицательные контроли. */
function straysOf(uses: Use[], dictionary: Set<string>): string[] {
  return uses
    .filter((u) => !dictionary.has(u.value))
    .map((u) => `${u.value} (${u.file}) ∉ W1-снимка`)
}

function missingBare(uses: Use[]): string[] {
  const seen = new Set(uses.map((u) => u.value))
  return REQUIRED_BARE.filter((value) => !seen.has(value))
}

function missingAnchors(uses: Use[]): string[] {
  return REQUIRED_ANCHORS.filter((anchor) => !uses.some((u) => u.file.endsWith(anchor)))
}

function missingIdentifierAnchors(uses: Use[]): string[] {
  return REQUIRED_IDENTIFIER_ANCHORS.filter(({ file, distinct }) => {
    const values = new Set(uses.filter((u) => u.file.endsWith(file)).map((u) => u.value))
    return values.size < distinct
  }).map(({ file, distinct }) => `${file}: различных кредитных прав меньше ${distinct}`)
}

const CANON_KEYS = [
  'source_repo',
  'source_ref',
  'source_commit_sha',
  'source_path',
  'source_sha256',
  'captured_at',
  'captured_by',
  'permissions',
  'sha256',
]

/** Проблемы списка прав: счёт, дубли, сортировка, форма имени. */
function listProblems(list: string[], expected: number): string[] {
  const problems: string[] = []
  if (list.length !== expected) problems.push(`имён ${list.length}, ожидалось ${expected}`)
  if (new Set(list).size !== list.length) problems.push('в списке есть дубли')
  if (list.join('\n') !== [...list].sort().join('\n')) problems.push('список не отсортирован')
  for (const name of list)
    if (!PERMISSION_NAME_RE.test(name)) problems.push(`имя не по форме: ${JSON.stringify(name)}`)
  return problems
}

/** Проблемы происхождения: формы полей. */
function provenanceProblems(snap: typeof snapshot): string[] {
  const problems: string[] = []
  if (!isCommitSha(snap.source_commit_sha)) problems.push('source_commit_sha не 40-hex')
  if (!isSha256Hex(snap.source_sha256)) problems.push('source_sha256 не 64-hex')
  if (
    !/^\d{4}-\d{2}-\d{2}T/.test(snap.captured_at) ||
    !Number.isFinite(Date.parse(snap.captured_at))
  )
    problems.push('captured_at не разбираемая ISO-дата')
  return problems
}

function keyOrderProblems(keys: string[]): string[] {
  return keys.join(',') === CANON_KEYS.join(',') ? [] : [`порядок ключей: ${keys.join(',')}`]
}

/**
 * Дубль ключа в JSON виден только в сыром тексте: `JSON.parse` молча оставляет
 * последнее значение, и проверка порядка ключей работает уже над схлопнутым
 * объектом — человек читает первое значение, код берёт второе.
 */
function duplicateKeyProblems(raw: string): string[] {
  return CANON_KEYS.map((key) => ({ key, count: raw.split(`"${key}":`).length - 1 }))
    .filter(({ count }) => count !== 1)
    .map(({ key, count }) => `ключ "${key}" встречается ${count} раз(а)`)
}

/**
 * sha256 канонического СПИСКА прав: `sha256(sorted(permissions).join('\n'))`.
 *
 * ⚠️ Алгоритм — канонический список, НЕ «байты файла с обнулённым полем sha256».
 * Так считаны оба существующих снимка credit-module (`permissions-082.json`,
 * `permissions-fe.json`) — проверено счётом, эррата Э-4 story 16-3f. Буква
 * T-FE-2-02 (б) даёт другое число и к тому же неоднозначна: с завершающим
 * переводом строки и без него получаются два разных хеша. Не «чинить» по норме:
 * сломается сходимость с credit-module, и снимок перестанет быть тем же снимком.
 *
 * Хеш считается WebCrypto (`crypto.subtle`): он есть и в Node 20+, и в
 * jsdom-окружении vitest, а модуль crypto из Node уронил бы `tsc -b` ровно так
 * же, как модуль файловой системы.
 */
async function canonHash(permissions: string[]): Promise<string> {
  const bytes = new TextEncoder().encode([...permissions].sort().join('\n'))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

describe('T-FE-2-02 (а) употребления прав принадлежат словарю W1', () => {
  it('все четыре области глоба прочитаны', () => {
    const problems = REQUIRED_AREAS.map((area) => {
      const files = Object.keys(SOURCES).filter((file) => file.startsWith(area.prefix)).length
      return files < area.minFiles
        ? `${area.label}: файлов ${files}, ожидалось не меньше ${area.minFiles}`
        : ''
    }).filter(Boolean)
    expect(problems, `область глоба потеряна:\n${problems.join('\n')}`).toEqual([])
  })

  it('выборка не пуста: обе формы собраны на измеренном пороге', () => {
    const ids = new Set(identifierUses().map((u) => u.value))
    const bare = new Set(bareUses().map((u) => u.value))
    // Пороги — замер базы 8f654086e7: 4 различных идентификатора, 5 различных
    // голых прав. `>=`, потому что права добавляют; потерю ловят якоря ниже —
    // поимённая пятёрка и три файла для голой формы, счёт НА ФАЙЛ для идентификаторной.
    expect(
      ids.size,
      `идентификаторы не разрешены: собрано ${ids.size} из >=4`
    ).toBeGreaterThanOrEqual(4)
    expect(bare.size, `голые права потеряны: собрано ${bare.size} из >=5`).toBeGreaterThanOrEqual(5)
  })

  it('идентификаторные якоря выполнены В КАЖДОМ файле-гейте', () => {
    const lost = missingIdentifierAnchors(identifierUses())
    expect(lost, `потерян якорь идентификаторов: ${lost.join('; ')}`).toEqual([])
  })

  it('все пять измеренных голых прав на месте поимённо', () => {
    const lost = missingBare(bareUses())
    expect(lost, `потеряно право ${lost.join(', ')}`).toEqual([])
  })

  it('три положительных файла-якоря присутствуют в выборке', () => {
    const lost = missingAnchors(bareUses())
    expect(lost, `потерян якорь ${lost.join(', ')}`).toEqual([])
  })

  it('каждое употреблённое право принадлежит снимку W1', () => {
    const strays = straysOf([...identifierUses(), ...bareUses()], W1)
    expect(strays, `право вне словаря W1:\n${strays.join('\n')}`).toEqual([])
  })
})

describe('T-FE-2-02 объявленные константы делятся на снимок и список вне-W1', () => {
  it('разность «объявленные минус снимок» ТОЧНО равна списку вне-W1', () => {
    // Двустороннее равенство. Пятая константа вне W1 краснит его, пока её не
    // внесли в список; имя, попавшее в снимок после пересъёмки, краснит с
    // другой стороны — два стража не смогут разойтись молча.
    const declared = Object.values(PERMISSIONS.CREDIT) as string[]
    const declaredOutOfW1 = declared.filter((value) => !W1.has(value))
    expect(new Set(declaredOutOfW1), `объявлено вне W1: ${declaredOutOfW1.join(', ')}`).toEqual(
      new Set(OUT_OF_W1_VALUES)
    )
  })

  it('список вне-W1 не пересекается со снимком', () => {
    const both = OUT_OF_W1_VALUES.filter((value) => W1.has(value))
    expect(both, `имя числится и в снимке, и в списке вне-W1: ${both.join(', ')}`).toEqual([])
  })

  it('каждое имя вне-W1 действительно объявлено в PERMISSIONS.CREDIT', () => {
    const declared = new Set(Object.values(PERMISSIONS.CREDIT) as string[])
    const orphans = OUT_OF_W1_VALUES.filter((value) => !declared.has(value))
    expect(orphans, `список вне-W1 протух: ${orphans.join(', ')} больше не объявлены`).toEqual([])
  })
})

describe.each(SNAPSHOTS)(
  'T-FE-2-02 (б) снимок $label описывает своё происхождение и сходится',
  ({ snap, raw, expected }) => {
    it('девять полей канона в каноническом порядке', () => {
      const problems = keyOrderProblems(Object.keys(snap))
      expect(problems, `канон снимка нарушен: ${problems.join('; ')}`).toEqual([])
    })

    it('каждый ключ канона встречается в файле ровно один раз', () => {
      const problems = duplicateKeyProblems(raw)
      expect(problems, `дубль ключа в снимке: ${problems.join('; ')}`).toEqual([])
    })

    it('права своего счёта: отсортированы, без дублей, каждое по форме имени', () => {
      const problems = listProblems(snap.permissions, expected)
      expect(problems, `список прав снимка: ${problems.join('; ')}`).toEqual([])
    })

    it('поля происхождения по форме', () => {
      const problems = provenanceProblems(snap)
      expect(problems, `происхождение снимка: ${problems.join('; ')}`).toEqual([])
    })

    it('sha256 равен хешу канонического списка', async () => {
      expect(await canonHash(snap.permissions), 'sha256 снимка не сходится').toBe(snap.sha256)
    })
  }
)

describe('T-FE-2-02 право подтверждения условного одобрения (19-5a → 19-5f)', () => {
  it('W-1: право употреблено на странице карточки и принадлежит второму снимку', () => {
    const uses = identifierUses().filter(
      (u) =>
        u.file.endsWith('pages/Credit/CreditApplicationDetailPage.tsx') &&
        u.value === 'credit.decisions.confirm_conditional'
    )
    expect(uses, 'the card no longer checks the conditional confirmation right').toHaveLength(1)
    expect(
      snapshot098.permissions,
      'the 19-5a snapshot lost the conditional confirmation right'
    ).toContain('credit.decisions.confirm_conditional')
    expect(
      snapshot.permissions,
      'the right appeared in the 082 snapshot — 082 must not be rewritten'
    ).not.toContain('credit.decisions.confirm_conditional')
  })

  it('W-2: снимки не пересекаются', () => {
    const both = snapshot098.permissions.filter((name) => snapshot.permissions.includes(name))
    expect(both, `имя числится в обоих снимках: ${both.join(', ')}`).toEqual([])
  })
})

describe('T-FE-2-02 права постбеков партнерам (18-13d-a1)', () => {
  it('P-1: оба права употреблены на странице настроек и принадлежат третьему снимку', () => {
    const onSettings = new Set(
      identifierUses()
        .filter((u) => u.file.endsWith('pages/Credit/CreditSettingsPage.tsx'))
        .map((u) => u.value)
    )
    for (const name of ['credit.partner_postbacks.read', 'credit.partner_postbacks.write']) {
      expect(onSettings.has(name), `страница настроек не проверяет ${name}`).toBe(true)
      expect(snapshot100.permissions, `снимок 100 потерял ${name}`).toContain(name)
    }
  })

  it('P-2: право чтения стоит в обоих файлах-гейтах — маршрут и меню', () => {
    for (const gate of ['routes/index.tsx', 'components/layout/DashboardLayout.tsx']) {
      const uses = identifierUses().filter(
        (u) => u.file.endsWith(gate) && u.value === 'credit.partner_postbacks.read'
      )
      expect(uses.length, `${gate}: нет права чтения постбеков`).toBeGreaterThan(0)
    }
  })

  it('P-3: третий снимок не пересекается с 082 и 098', () => {
    const both = snapshot100.permissions.filter(
      (name) => snapshot.permissions.includes(name) || snapshot098.permissions.includes(name)
    )
    expect(both, `имя числится в двух снимках: ${both.join(', ')}`).toEqual([])
  })

  it('P-4 контроль: подменённое имя в копии третьего снимка краснит множество', () => {
    const mutated = snapshot100.permissions.map((p) =>
      p === 'credit.partner_postbacks.read' ? 'credit.partner_postback.read' : p
    )
    expect(mutated).not.toEqual(snapshot100.permissions)
    const strays = straysOf(
      [...identifierUses(), ...bareUses()],
      new Set([...snapshot.permissions, ...snapshot098.permissions, ...mutated])
    )
    expect(
      strays.some((s) => s.startsWith('credit.partner_postbacks.read')),
      'контроль не покраснел: страж принял право чтения постбеков без снимка'
    ).toBe(true)
  })
})

describe('T-FE-2-02 право выгрузки заявок CSV (18-13c-b)', () => {
  it('E-1: право употреблено на странице списка заявок и принадлежит четвёртому снимку', () => {
    const uses = identifierUses().filter(
      (u) =>
        u.file.endsWith('pages/Credit/CreditApplicationsPage.tsx') &&
        u.value === 'credit.applications.export'
    )
    expect(uses, 'список заявок больше не проверяет право выгрузки').toHaveLength(1)
    expect(snapshotExport.permissions, 'четвёртый снимок потерял право выгрузки').toContain(
      'credit.applications.export'
    )
  })

  it('E-2: право выгрузки не взято снимком постбеков — у каждого экрана свой снимок', () => {
    expect(
      snapshot100.permissions,
      'право выгрузки попало в снимок постбеков: счёт 2 и самохеш снимка 100 разошлись бы'
    ).not.toContain('credit.applications.export')
  })

  it('E-3: четвёртый снимок не пересекается с 082, 098 и 100', () => {
    const both = snapshotExport.permissions.filter(
      (name) =>
        snapshot.permissions.includes(name) ||
        snapshot098.permissions.includes(name) ||
        snapshot100.permissions.includes(name)
    )
    expect(both, `имя числится в двух снимках: ${both.join(', ')}`).toEqual([])
  })

  it('E-4 контроль: подменённое имя в копии четвёртого снимка краснит множество', () => {
    const mutated = snapshotExport.permissions.map((p) =>
      p === 'credit.applications.export' ? 'credit.application.export' : p
    )
    expect(mutated).not.toEqual(snapshotExport.permissions)
    const strays = straysOf(
      [...identifierUses(), ...bareUses()],
      new Set([
        ...snapshot.permissions,
        ...snapshot098.permissions,
        ...snapshot100.permissions,
        ...mutated,
      ])
    )
    expect(
      strays.some((s) => s.startsWith('credit.applications.export')),
      'контроль не покраснел: страж принял право выгрузки без снимка'
    ).toBe(true)
  })
})

describe('T-FE-2-02 отрицательные контроли (копии в памяти, файл снимка не трогается)', () => {
  it('подменённое имя в копии снимка краснит И множество, И самохеш', async () => {
    const mutated = snapshot.permissions.map((p) =>
      p === 'credit.switches.write' ? 'credit.switches.writ' : p
    )
    expect(mutated, 'контроль не построен: подмена имени не состоялась').not.toEqual(
      snapshot.permissions
    )
    // Второй снимок — в словаре контроля: краснеть обязано подменённое имя 082,
    // а не право 19-5a, которого в 082 нет по построению.
    const strays = straysOf(
      [...identifierUses(), ...bareUses()],
      new Set([...mutated, ...snapshot098.permissions])
    )
    expect(
      strays.length,
      'контроль не покраснел: страж принял употребление права, которого нет в подменённом снимке'
    ).toBeGreaterThan(0)
    expect(
      await canonHash(mutated),
      'контроль не покраснел: самохеш сошёлся на подменённом списке'
    ).not.toBe(snapshot.sha256)
  })

  it('перестановка двух ключей канона краснит проверку порядка', () => {
    const swapped = [...CANON_KEYS]
    swapped[0] = CANON_KEYS[1]
    swapped[1] = CANON_KEYS[0]
    expect(swapped, 'контроль не построен: ключи не переставлены').not.toEqual(CANON_KEYS)
    expect(
      keyOrderProblems(swapped).length,
      'контроль не покраснел: проверка канона приняла переставленные ключи'
    ).toBeGreaterThan(0)
  })

  it('дубль ключа в сыром тексте краснит проверку', () => {
    const doubled = SNAPSHOT_RAW.replace(
      '"source_sha256":',
      '"source_sha256": "0000", \n  "source_sha256":'
    )
    expect(doubled, 'контроль не построен: дубль ключа не вставлен').not.toBe(SNAPSHOT_RAW)
    expect(
      duplicateKeyProblems(doubled).length,
      'контроль не покраснел: проверка приняла файл с повторяющимся ключом'
    ).toBeGreaterThan(0)
  })

  it('дубль имени и укороченный список краснят проверку списка', () => {
    const withDuplicate = [...snapshot.permissions.slice(0, 16), snapshot.permissions[0]]
    expect(
      listProblems(withDuplicate, 17).length,
      'контроль не покраснел: список с дублем принят'
    ).toBeGreaterThan(0)
    const sixteen = snapshot.permissions.slice(0, 16)
    expect(
      listProblems(sixteen, 17).length,
      'контроль не покраснел: список из 16 имён принят'
    ).toBeGreaterThan(0)
    const malformed = [...snapshot.permissions.slice(0, 16), 'Credit.Switches.WRITE ']
    expect(
      listProblems(malformed, 17).length,
      'контроль не покраснел: имя не по форме принято'
    ).toBeGreaterThan(0)
  })

  it('укороченный source_commit_sha и 63-hex source_sha256 краснят проверку формы', () => {
    const shortSha = { ...snapshot, source_commit_sha: snapshot.source_commit_sha.slice(0, 12) }
    expect(
      provenanceProblems(shortSha).length,
      'контроль не покраснел: проверка формы приняла укороченный source_commit_sha'
    ).toBeGreaterThan(0)
    const shortHash = { ...snapshot, source_sha256: snapshot.source_sha256.slice(0, 63) }
    expect(
      provenanceProblems(shortHash).length,
      'контроль не покраснел: проверка формы приняла 63-hex source_sha256'
    ).toBeGreaterThan(0)
  })

  it('без разрешения идентификаторов боевые якоря НЕ выполняются', () => {
    // Боевой предикат прогоняется на выборке, где идентификаторная форма
    // выключена и остались одни литералы: в обоих файлах-гейтах их ноль,
    // поэтому оба якоря обязаны оказаться потерянными.
    const gateFiles = ['routes/index.tsx', 'components/layout/DashboardLayout.tsx']
    const literalsInGates = bareUses().filter((u) => gateFiles.some((f) => u.file.endsWith(f)))
    const lost = missingIdentifierAnchors(literalsInGates)
    expect(
      lost.length,
      `контроль не покраснел: боевой предикат якорей принял выборку из одних литералов (${literalsInGates.length} шт.)`
    ).toBe(2)
  })

  it('снятие кредитных прав из одного файла-гейта краснит якорь этого файла', () => {
    const uses = identifierUses()
    expect(missingIdentifierAnchors(uses)).toEqual([])
    const withoutRoutes = uses.filter((u) => !u.file.endsWith('routes/index.tsx'))
    expect(withoutRoutes.length, 'контроль не построен: выборка не изменилась').toBeLessThan(
      uses.length
    )
    // Общий порог >=4 при этом ОСТАЁТСЯ выполненным за счёт меню — ровно тот
    // случай, ради которого якоря считаются на файл. Счёт — по меню: с 19-5f
    // карточка заявки несёт пятое имя (право подтверждения), и сумма по всем
    // файлам перестала бы быть заслугой меню. С 18-13d в меню пятое имя —
    // право чтения постбеков (пункт «Настройки» и вход при выключенном разделе).
    const menuOnly = withoutRoutes.filter((u) =>
      u.file.endsWith('components/layout/DashboardLayout.tsx')
    )
    expect(new Set(menuOnly.map((u) => u.value)).size).toBe(5)
    const lost = missingIdentifierAnchors(withoutRoutes)
    expect(
      lost,
      'контроль не покраснел: якорь принял файл-гейт без единого кредитного права'
    ).toHaveLength(1)
  })

  it('потеря одного файла-якоря краснит даже при сохранном числе голых прав', () => {
    const uses = bareUses()
    expect(missingAnchors(uses)).toEqual([])
    const lostAnchor = 'pages/Credit/components/CreditSwitchesSection.tsx'
    const mutated: Use[] = [
      ...uses.filter((u) => !u.file.endsWith(lostAnchor)),
      { file: '../../pages/Credit/CreditLoansPage.tsx', value: 'credit.switches.write' },
    ]
    expect(missingBare(mutated), 'контроль не построен: число голых прав упало').toEqual([])
    expect(
      missingAnchors(mutated),
      'контроль не покраснел: якорный предикат принял выборку без файла-якоря'
    ).toContain(lostAnchor)
  })

  it('потеря одного голого права краснит проверку пятёрки', () => {
    const uses = bareUses()
    const mutated = uses.filter((u) => u.value !== 'credit.decisions.decide')
    expect(mutated.length, 'контроль не построен: право не снято').toBeLessThan(uses.length)
    expect(missingBare(mutated), 'контроль не покраснел: пятёрка принята без одного права').toEqual(
      ['credit.decisions.decide']
    )
  })
})
