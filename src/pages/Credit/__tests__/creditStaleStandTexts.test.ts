/**
 * Устаревшие тексты стенда не возвращаются — ни в словари, ни в комментарии.
 *
 * Три утверждения («модуль мимо шлюза», «localhost:8020», «маршрут появится
 * вместе с развёртыванием») и название проекта в подсказке 403 были верны до
 * маршрутов шлюза (C-01) и после них стали ложью на экране оператора. Один
 * раз их сняли; этот тест держит их снятыми — включая комментарии исходников,
 * потому что комментарий, оставшийся прежним, возвращает утверждение в код
 * при первой же правке «по образцу соседа».
 *
 * ── Политика запрета. Запрещается УТВЕРЖДЕНИЕ, а не слово: «модуль работает
 * мимо шлюза», «его отдаёт машина разработчика», «права выдаются в таком-то
 * проекте». Списки ниже — приближение политики написаниями, потому что искать
 * утверждение подстрокой больше нечем. Отсюда два следствия.
 *   (1) Список обязан нести ВСЕ живые написания одной мысли: «Етап 1» в
 *       именительном не ловится по «етапі 1», «Финбуст» — по «Фінбуст».
 *   (2) Законное упоминание проекта (фикстура контракта, где имя проекта —
 *       данные, а не объяснение прав) снимается НЕ правкой списка, а строкой
 *       в `ALLOWED_PROJECT_MENTIONS`: путь, токен, владелец и причина. Тогда
 *       видно, кто и зачем разрешил, и для всех прочих мест запрет в силе.
 *
 * Исходники читаются глобом Vite с `?raw`, а НЕ модулем файловой системы Node:
 * сборка проекта идёт без типов Node, и `tsc -b` — то есть job Type Check —
 * падает на его импорте. Тот же довод записан в `i18nKeys.test.ts:19-20`, и
 * имя этого модуля здесь не пишется даже в комментарии: страж раздела ищет его
 * подстрокой.
 */
import { describe, it, expect } from 'vitest'
import en from '../../../../public/locales/en/common.json'
import uk from '../../../../public/locales/uk/common.json'

// ── Область (б): ДВА точных raw-глоба, файловый шаблон **/*.{ts,tsx} в обоих
//    корнях раздела. Множество файлов считается ДО любых исключений содержимого:
//    иначе исключение молча урезало бы выборку, и контроль от пустого множества
//    сравнивал бы baseline с уже урезанным набором.
const SOURCES = {
  ...import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('../../../features/credit/**/*.{ts,tsx}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
} as Record<string, string>

// Ключи глоба относительны ЭТОМУ файлу (`./Сосед.tsx`, `../Страница.tsx`,
// `../../../features/credit/...`). Приводим их к репозиторным путям: иначе
// поимённые исключения и разрешения пришлось бы писать в трёх разных формах, а
// текст падения называл бы путь, которого в репозитории нет.
const GLOB_BASE = 'src/pages/Credit/__tests__'

function repoPath(key: string): string {
  const parts = GLOB_BASE.split('/')
  for (const segment of key.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') parts.pop()
    else parts.push(segment)
  }
  return parts.join('/')
}

const FILES: Array<[string, string]> = Object.entries(SOURCES).map(([key, src]) => [
  repoPath(key),
  src,
])

// Таблица маршрутов читается ОТДЕЛЬНО от области (б): она живёт вне двух корней
// раздела и в baseline не входит. Прецедент формы — `creditRoutesGated.test.ts:15-21`.
const ROUTES_SOURCE = Object.values(
  import.meta.glob('../../../routes/index.tsx', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
)[0]

// Снят на selected exact base 8f654086e7875d0b5c6f8298e017dcfd343f422d командой
//   git ls-tree -r --name-only 8f654086e7875d0b5c6f8298e017dcfd343f422d \
//     -- src/pages/Credit src/features/credit | grep -E '\.tsx?$' | wc -l   → 68
// Число живёт ЗДЕСЬ и в описании PR; от HEAD задачи оно не пересчитывается (N-12).
const SECTION_FILES_BASELINE = 68

// Глоб Vite НИКОГДА не возвращает сам импортирующий модуль. Замер в
// отсоединённой копии: `find src/pages/Credit src/features/credit -name '*.ts*'
// | wc -l` → 70, ключей глоба → 69, своего ключа среди них нет. В этом дереве:
// 68 файлов (снят CreditStandBanner.tsx, добавлен этот файл) → глоб отдаёт 67.
// Поэтому область (б) = ключи глоба ПЛЮС этот файл: он в разделе есть, потому
// что прямо сейчас выполняется. Слагаемое постоянно, потерю файлов глобом оно
// не маскирует; что оно не стало двойным счётом, проверяет отдельный знак ниже.
const SECTION_FILES_COUNTED = FILES.length + 1

// Расширения, которыми набран baseline выше. Глоб обязан брать ровно их.
const BASELINE_EXTENSIONS = ['ts', 'tsx']

// Собственный путь. Исключение ПО ПУТИ, не по маске `__tests__`. По построению
// глоба оно не срабатывает ни разу (см. знак «глоб не принёс сам себя») и
// оставлено как защита от смены поведения инструмента.
const SELF = 'src/pages/Credit/__tests__/creditStaleStandTexts.test.ts'

// Предметы контроля (в), поимённо: репозиторные пути
// `src/features/credit/api/creditApi.ts` и
// `src/features/credit/api/__tests__/credentials.test.ts`.
const CREDIT_API = 'src/features/credit/api/creditApi.ts'
const CREDENTIALS_TEST = 'src/features/credit/api/__tests__/credentials.test.ts'
const UNAVAILABLE_SCREEN = 'src/pages/Credit/components/CreditModuleUnavailable.tsx'
const TYPES = 'src/features/credit/api/types.ts'
const LOANS_PAGE = 'src/pages/Credit/CreditLoansPage.tsx'

/** Утверждения о топологии и фазе, снятые с экрана оператора. */
const STALE_CLAIM_TOKENS = [
  'localhost:8020',
  'етап 1',
  'етапі 1',
  'этап 1',
  'stage 1',
  'повз шлюз',
  'мимо шлюза',
  'past Kong',
  'outside the Kong',
  'вне Kong',
  'поза Kong',
  'outside Kong',
]

/** Имя проекта как объяснение прав — во всех живых написаниях. */
const PROJECT_NAME_TOKENS = ['Фінбуст', 'Финбуст', 'Finboost', 'Fin-boost']

// В значениях словаря запрещён и путь маршрута: экран оператора не обязан
// знать адрес ручки, а обещание «маршрут появится» уже устарело.
const FORBIDDEN_IN_VALUES = [...STALE_CLAIM_TOKENS, '/api/v1/credit', ...PROJECT_NAME_TOKENS]

// В ИСХОДНИКАХ пути `/api/v1/credit` нет в списке намеренно: это живой префикс
// API модуля (`creditApi.ts`, `CREDIT_PREFIX`), и запрет означал бы запрет на
// сам вызов. Всё остальное совпадает со списком значений — до этого круга
// список исходников был вдвое короче, и «Етап 1 … повз шлюз … localhost:8020»,
// вписанные прямо в JSX страницы, проходили зелёными.
const FORBIDDEN_IN_SOURCES = [...STALE_CLAIM_TOKENS, ...PROJECT_NAME_TOKENS]

/** Точечные разрешения на имя проекта: путь + токен + владелец + причина. */
const ALLOWED_PROJECT_MENTIONS: Array<{
  path: string
  token: string
  owner: string
  why: string
}> = [
  {
    path: 'src/pages/Credit/__tests__/CreditSettingsPage.test.tsx',
    token: 'Fin-boost',
    owner: 'WP-FE-6 / владелец fe',
    why: "фикстура продукта: 'fin-boost' — идентификатор проекта из контракта модуля (CREDIT_PROJECT_IDS), то есть данные, а не объяснение прав оператору",
  },
  {
    path: 'src/features/credit/api/scorecard.ts',
    token: 'Fin-boost',
    owner: '19-7 / куратор',
    why: 'версия конфига скоринга модуля (scorecard.version из seed.py модуля) — ключ таблицы констант листа книги под версию, то есть данные, а не объяснение прав оператору',
  },
  {
    path: 'src/features/credit/api/__tests__/scorecard.test.ts',
    token: 'Fin-boost',
    owner: '19-7 / куратор',
    why: 'литерал версии конфига скоринга модуля в тесте-пине таблицы констант — данные, не объяснение прав',
  },
]

const STORAGE_KEYS = ['credit.stand.apiKey', 'credit.stand.role']

const REMOVE_ITEM_CALLS = [
  "sessionStorage.removeItem('credit.stand.apiKey')",
  "localStorage.removeItem('credit.stand.apiKey')",
  "localStorage.removeItem('credit.stand.role')",
]

const ACCESS_KEYS = [
  'credit.access.notAuthenticated',
  'credit.access.notAuthenticatedHint',
  'credit.access.noRights',
  'credit.access.noRightsHint',
]

/** Пары «статус → ключ», как их обязан строить экран. */
const EXPECTED_ACCESS_PAIRS = [
  '401=credit.access.notAuthenticated 403=credit.access.noRights',
  '401=credit.access.notAuthenticatedHint 403=credit.access.noRightsHint',
]

const ACCESS_TERNARY =
  /status\s*===\s*(401|403)\s*\?\s*'(credit\.access\.[A-Za-z]+)'\s*:\s*'(credit\.access\.[A-Za-z]+)'/g

/** Ключи-замены: они обязаны БЫТЬ, а не только «не содержать запрещённого». */
const REPLACEMENT_KEYS = ['credit.unavailable.title', 'credit.unavailable.hint', ...ACCESS_KEYS]

/** Пары, которые обязаны отличаться ТЕКСТОМ, а не только именем ключа. */
const DISTINCT_TEXT_PAIRS: Array<[string, string]> = [
  ['credit.access.noRights', 'credit.access.notAuthenticated'],
  ['credit.access.noRightsHint', 'credit.access.notAuthenticatedHint'],
  ['credit.unavailable.hint', 'credit.unavailable.title'],
]

const DICTIONARIES: Array<[string, unknown]> = [
  ['uk', uk],
  ['en', en],
]

const lower = (s: string) => s.toLowerCase()
const has = (haystack: string, needle: string) => lower(haystack).includes(lower(needle))

/** Один исходник выборки по хвосту пути — с отказом, который называет предмет. */
function source(tail: string): string {
  const found = FILES.find(([path]) => path.endsWith(tail))
  if (!found) throw new Error(`глоб не принёс ${tail} — выборка потеряла предмет контроля`)
  return found[1]
}

function lookup(dictionary: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in node) {
      return (node as Record<string, unknown>)[part]
    }
    return undefined
  }, dictionary)
}

/**
 * Плоский список [путь-ключа, значение] строк, которые видит оператор раздела:
 * всё поддерево `credit.*` ПЛЮС `navigation.creditModule` — заголовок, который
 * рисует сам экран недоступности (`t('navigation.creditModule', …)`), то есть
 * текст раздела, живущий вне его поддерева.
 */
function creditStrings(dict: unknown): Array<[string, string]> {
  const walk = (node: unknown, prefix: string): Array<[string, string]> =>
    node && typeof node === 'object'
      ? Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
          typeof value === 'string'
            ? ([[`${prefix}${key}`, value]] as Array<[string, string]>)
            : walk(value, `${prefix}${key}.`)
        )
      : []
  const out = walk((dict as Record<string, unknown>).credit, 'credit.')
  const heading = lookup(dict, 'navigation.creditModule')
  if (typeof heading === 'string') out.push(['navigation.creditModule', heading])
  return out
}

/**
 * Структурно извлечённые ключи перевода во ВСЕХ живых формах react-i18next:
 * `t('…')`, `i18n.t('…')`, `<Trans i18nKey="…">`, `useTranslation(…, { keyPrefix })`.
 * Одной формы мало: ключ, заданный префиксом, регуляркой по `t(` не виден вовсе.
 */
function translationKeys(src: string): string[] {
  const patterns = [
    // Граница слова перед `t(` обязательна — иначе в выборку попадает хвост
    // любого имени, кончающегося на «t» (урок i18nKeys.test.ts:34-36).
    /(?<![A-Za-z0-9_])t\(\s*['"`]([A-Za-z0-9_.]+)/g,
    /i18nKey\s*=\s*\{?\s*['"`]([A-Za-z0-9_.]+)/g,
    /keyPrefix\s*:\s*['"`]([A-Za-z0-9_.]+)/g,
  ]
  return patterns.flatMap((re) => [...src.matchAll(re)].map((m) => m[1]))
}

/** Контроль (а), часть первая: собственная группа `stand` внутри непустого `credit`. */
function standGroupHits(dictionaries: Array<[string, unknown]>): string[] {
  const hits: string[] = []
  for (const [name, dict] of dictionaries) {
    const credit = (dict as Record<string, unknown>).credit as Record<string, unknown> | undefined
    if (!credit || Object.keys(credit).length === 0) {
      hits.push(`dictionary ${name}: объекта credit нет вовсе или он пуст`)
      continue
    }
    if (Object.hasOwn(credit, 'stand')) {
      hits.push(`dictionary ${name}: группа credit.stand вернулась`)
    }
  }
  return hits
}

/** Контроль (а), часть вторая: устаревшие утверждения в значениях раздела. */
function forbiddenValueHits(dictionaries: Array<[string, unknown]>): string[] {
  const hits: string[] = []
  for (const [name, dict] of dictionaries) {
    for (const [key, value] of creditStrings(dict)) {
      for (const bad of FORBIDDEN_IN_VALUES) {
        if (has(value, bad)) hits.push(`${name} ${key} << ${bad}`)
      }
    }
  }
  return hits
}

/** Контроль (а), часть третья: ключи-замены есть, непусты и различимы. */
function dictionaryTextHits(dictionaries: Array<[string, unknown]>): string[] {
  const hits: string[] = []
  for (const [name, dict] of dictionaries) {
    for (const key of REPLACEMENT_KEYS) {
      const value = lookup(dict, key)
      if (typeof value !== 'string' || value.trim() === '') {
        hits.push(`dictionary ${name}: ключ-замена ${key} пропал или пуст`)
      }
    }
    for (const [left, right] of DISTINCT_TEXT_PAIRS) {
      const a = lookup(dict, left)
      const b = lookup(dict, right)
      if (typeof a === 'string' && typeof b === 'string' && a === b) {
        hits.push(
          `dictionary ${name}: ${left} и ${right} стали одним текстом — оператор увидит одно и то же в разных состояниях`
        )
      }
    }
  }
  return hits
}

/** Контроль (б): исторические утверждения в исходниках раздела. */
function forbiddenSourceHits(files: Array<[string, string]>): string[] {
  return files
    .filter(([path]) => !path.endsWith(SELF))
    .flatMap(([path, src]) =>
      FORBIDDEN_IN_SOURCES.filter(
        (bad) =>
          has(src, bad) &&
          !ALLOWED_PROJECT_MENTIONS.some(
            (entry) => path.endsWith(entry.path) && lower(entry.token) === lower(bad)
          )
      ).map((bad) => `${path} << ${bad}`)
    )
}

/**
 * Контроль (в): сохранность уборки `credit.stand.*` из браузера.
 *
 * Признак вызова — структурный: `purgeStandCredentials()` где угодно ВНЕ строки
 * объявления. Прежняя форма требовала вызова на верхнем уровне без отступа и
 * без точки с запятой, то есть красила бы законную правку «обернуть в if».
 */
function purgeHits(api: string): string[] {
  const hits: string[] = []
  const declared =
    /function\s+purgeStandCredentials\s*\(/.test(api) ||
    /(?:const|let)\s+purgeStandCredentials\s*(?::[^=]+)?=\s*(?:async\s*)?\(/.test(api)
  if (!declared) {
    hits.push('creditApi.ts: очистка credentials исчезла — объявления purgeStandCredentials нет')
  }
  const calls = api
    .split('\n')
    .filter(
      (line) =>
        /\bpurgeStandCredentials\(\)/.test(line) &&
        !/function\s+purgeStandCredentials\s*\(/.test(line) &&
        !/(?:const|let)\s+purgeStandCredentials\s*[:=]/.test(line)
    )
  if (calls.length === 0) {
    hits.push('creditApi.ts: очистка credentials исчезла — она объявлена, но нигде не вызвана')
  }
  for (const call of REMOVE_ITEM_CALLS) {
    if (!api.includes(call)) hits.push(`creditApi.ts: пропал вызов ${call}`)
  }
  return hits
}

/**
 * Контроль (в), вторая половина: `credentials.test.ts` проверяет уборку ПО СУЩЕСТВУ.
 *
 * Утверждения структурные и привязаны к литералам ключей, `resetModules`,
 * импорту клиента, `toBeNull` и пропуску CRM — не к именам переменных: файл
 * переписывает соседняя единица (WP-FE-6), и имена в нём не обещаны.
 */
function credentialsTestHits(creds: string): string[] {
  const hits: string[] = []
  for (const key of STORAGE_KEYS) {
    if (!creds.includes(`'${key}'`) && !creds.includes(`"${key}"`)) {
      hits.push(`credentials.test.ts: пропал ключ ${key}`)
    }
  }
  if (!/vi\.resetModules\(\)/.test(creds)) {
    hits.push('credentials.test.ts: пропал vi.resetModules() — импорт клиента перестал быть первым')
  }
  const importIdx = creds.lastIndexOf("import('../creditApi')")
  if (importIdx < 0) {
    hits.push('credentials.test.ts: пропал импорт клиента — уборка в тесте не запускается')
    return hits
  }
  const blockStart = creds.lastIndexOf('it(', importIdx)
  const head = creds.slice(blockStart < 0 ? 0 : blockStart, importIdx)
  const tail = creds.slice(importIdx)
  const seeds = (head.match(/setItem\(/g) ?? []).length
  if (seeds < 2) {
    hits.push(
      `credentials.test.ts: посев ключей ДО импорта исчез (setItem в блоке: ${seeds}, нужно ≥ 2)`
    )
  }
  const nulls = (tail.match(/toBeNull\(\)/g) ?? []).length
  if (nulls < 3) {
    hits.push(
      `credentials.test.ts: assertions очистки исчезли (toBeNull после импорта: ${nulls}, нужно ≥ 3)`
    )
  }
  if (!/getItem\(\s*(?:CRM_TOKEN_KEY|['"]prionex_token['"])\s*\)\s*\)\s*\.toBe\(/.test(tail)) {
    hits.push('credentials.test.ts: пропала проверка сохранности пропуска CRM')
  }
  return hits
}

/**
 * Различает ли исходник экрана 401 и 403 (Э-24, AC эпика epics.md:1826).
 *
 * Ключи ищутся полными литералами В КАВЫЧКАХ: без кавычек `credit.access.noRights`
 * находится внутри `credit.access.noRightsHint`, и слияние пары через префикс
 * прошло бы зелёным. Сверх наличия проверяется СВЯЗЬ статуса с ключом: иначе
 * перестановка плеч тернарника оставляет все признаки на месте, а оператор при
 * 401 читает «нет прав», при 403 — «войдите заново».
 */
function accessBranchHits(src: string): string[] {
  const hits: string[] = []
  if (!/status\s*===\s*401/.test(src) || !/status\s*===\s*403/.test(src)) {
    hits.push(
      'CreditModuleUnavailable.tsx: 401 и 403 снова показываются одинаково — ' +
        'условие перестало называть оба статуса'
    )
  }
  for (const key of ACCESS_KEYS) {
    if (!src.includes(`'${key}'`)) {
      hits.push(`CreditModuleUnavailable.tsx: пропал ключ пары ${key} — 401 и 403 слиты`)
    }
  }
  const pairs = [...src.matchAll(ACCESS_TERNARY)]
    .map(([, status, whenTrue, whenFalse]) => {
      const [for401, for403] = status === '401' ? [whenTrue, whenFalse] : [whenFalse, whenTrue]
      return `401=${for401} 403=${for403}`
    })
    .sort()
  for (const expected of EXPECTED_ACCESS_PAIRS) {
    if (!pairs.includes(expected)) {
      hits.push(
        `CreditModuleUnavailable.tsx: пара «${expected}» не строится — статус и текст разошлись ` +
          `(найдено: ${pairs.join(' | ') || 'ни одной пары'})`
      )
    }
  }
  return hits
}

/**
 * Чтения `.roles_available` в разделе. Поле снято модулем (J-3), а тип его ещё
 * требует, и все фикстуры его отдают: чтение в коде не краснит ни typecheck, ни
 * один тест, зато падает на живом ответе модуля. Объявление типа и фикстуры
 * тестов исключены поимённо — их снимает WP-FE-6 парно с модулем.
 */
function rolesAvailableReadHits(files: Array<[string, string]>): string[] {
  return files
    .filter(([path]) => !path.endsWith(SELF) && !path.endsWith(TYPES))
    .filter(([path]) => !path.includes('__tests__') && !/\.test\.tsx?$/.test(path))
    .flatMap(([path, src]) =>
      [...src.matchAll(/\.roles_available\b/g)].map(
        () => `${path} << чтение .roles_available (поле снято модулем в J-3)`
      )
    )
}

/** Контроль одинаковой области: baseline и глоб обязаны считать одно множество. */
function areaMismatch(declared: string[], paths: string[]): string[] {
  const seen = new Set(paths.map((path) => path.slice(path.lastIndexOf('.') + 1)))
  return [
    ...declared
      .filter((ext) => !seen.has(ext))
      .map((ext) => `baseline и глоб считают РАЗНЫЕ множества: baseline знает .${ext}, глоб — нет`),
    ...[...seen]
      .filter((ext) => !declared.includes(ext))
      .map(
        (ext) => `baseline и глоб считают РАЗНЫЕ множества: глоб принёс .${ext}, baseline — нет`
      ),
  ]
}

describe('T-FE-2-01 (а) словари', () => {
  it('в объекте credit нет собственной группы stand, и объект непуст', () => {
    const hits = standGroupHits(DICTIONARIES)
    expect(hits, hits.join('\n')).toEqual([])
  })

  it('ни одно значение раздела не несёт устаревших утверждений', () => {
    const hits = forbiddenValueHits(DICTIONARIES)
    expect(hits, `устаревшее утверждение в значении словаря:\n${hits.join('\n')}`).toEqual([])
  })

  it('ключи-замены есть в обоих словарях, непусты и различимы текстом', () => {
    const hits = dictionaryTextHits(DICTIONARIES)
    expect(hits, hits.join('\n')).toEqual([])
  })
})

describe('T-FE-2-01 (б) исходники раздела', () => {
  it('выборка не пуста, совпадает с baseline по области и содержит предмет проверки', () => {
    // Контроль от пустой выборки: «нарушений нет» на пустом множестве — это
    // отказ проверки, а не зелёный результат.
    expect(SECTION_FILES_BASELINE, 'baseline обнулён — контроль потерял смысл').toBeGreaterThan(0)
    expect(
      FILES.some(([path]) => path.endsWith(SELF)),
      'глоб принёс сам себя — слагаемое +1 стало двойным счётом'
    ).toBe(false)
    expect(
      SECTION_FILES_COUNTED,
      `глоб потерял файлы раздела: глоб отдал ${FILES.length} + сам ${SELF} = ` +
        `${SECTION_FILES_COUNTED}, baseline ${SECTION_FILES_BASELINE}`
    ).toBeGreaterThanOrEqual(SECTION_FILES_BASELINE)
    expect(
      FILES.some(([path]) => path.endsWith(UNAVAILABLE_SCREEN)),
      'в выборке нет CreditModuleUnavailable.tsx — глоб потерял предмет контроля (б)'
    ).toBe(true)
    const areaHits = areaMismatch(
      BASELINE_EXTENSIONS,
      FILES.map(([path]) => path)
    )
    expect(areaHits, areaHits.join('\n')).toEqual([])
    // Словари тоже обязаны быть непустыми: пустой `credit` сделал бы контроль (а)
    // зелёным ни на чём.
    for (const [name, dict] of DICTIONARIES) {
      const credit = (dict as Record<string, unknown>).credit as Record<string, unknown> | undefined
      expect(credit, `${name}: объекта credit нет вовсе`).toBeTruthy()
      expect(Object.keys(credit ?? {}).length, `${name}: объект credit пуст`).toBeGreaterThan(0)
    }
  })

  it('CreditStandBanner и credit.stand.notice не встречаются нигде', () => {
    const hits = FILES.filter(([path]) => !path.endsWith(SELF)).flatMap(([path, src]) =>
      ['CreditStandBanner', 'credit.stand.notice']
        .filter((needle) => src.includes(needle))
        .map((needle) => `${path} << ${needle}`)
    )
    expect(hits, `снятая плашка вернулась:\n${hits.join('\n')}`).toEqual([])
  })

  it('ни один вызов перевода не просит ключ с префиксом credit.stand', () => {
    const hits = FILES.filter(([path]) => !path.endsWith(SELF)).flatMap(([path, src]) =>
      translationKeys(src)
        .filter((key) => key === 'credit.stand' || key.startsWith('credit.stand.'))
        .map((key) => `${path} << перевод по ключу '${key}'`)
    )
    expect(hits, `UI снова читает снятую группу:\n${hits.join('\n')}`).toEqual([])
  })

  it('исходник CreditModuleUnavailable.tsx различает 401 и 403', () => {
    const hits = accessBranchHits(source(UNAVAILABLE_SCREEN))
    expect(hits, hits.join('\n')).toEqual([])
  })

  it('исторические утверждения отсутствуют и в комментариях', () => {
    const hits = forbiddenSourceHits(FILES)
    expect(hits, `source: историческое утверждение вернулось:\n${hits.join('\n')}`).toEqual([])
  })

  it('в разделе нет ни одного чтения roles_available', () => {
    const hits = rolesAvailableReadHits(FILES)
    expect(hits, `чтение снятого модулем поля:\n${hits.join('\n')}`).toEqual([])
  })

  it('CreditSectionGate импортирован статически — на этом держится уборка ключей', () => {
    // Уборка выполняется при импорте `creditApi`, а страницы раздела грузятся
    // лениво. Ключ стирается у оператора, который раздел НЕ открывает, только
    // потому, что калитка импортирована в таблицу маршрутов эагерно. Перевод её
    // в `lazy()` — обычная оптимизация бандла — оставил бы служебный ключ
    // лежать в браузере, и ни один поведенческий тест этого не заметил бы.
    expect(ROUTES_SOURCE, 'глоб не принёс routes/index.tsx').toBeTruthy()
    expect(
      /import\s*\{[^}]*\bCreditSectionGate\b[^}]*\}\s*from/.test(ROUTES_SOURCE),
      'routes/index.tsx: статический импорт CreditSectionGate исчез — уборка ключей стенда перестала доезжать до операторов, не открывающих раздел'
    ).toBe(true)
    expect(
      /lazy\(\s*\(\s*\)\s*=>\s*import\([^)]*CreditSectionGate/.test(ROUTES_SOURCE),
      'routes/index.tsx: CreditSectionGate переведён в lazy() — уборка ключей стенда стала недостижимой'
    ).toBe(false)
  })
})

describe('T-FE-2-01 (в) сохранность очистки credentials', () => {
  it('оба файла существуют и прочитаны', () => {
    expect(() => source(CREDIT_API), 'creditApi.ts не прочитан').not.toThrow()
    expect(() => source(CREDENTIALS_TEST), 'credentials.test.ts не прочитан').not.toThrow()
  })

  it('purgeStandCredentials объявлен, вызван и чистит три ключа', () => {
    const hits = purgeHits(source(CREDIT_API))
    expect(hits, hits.join('\n')).toEqual([])
  })

  it('credentials-тест сеет ключи до импорта и проверяет очистку после', () => {
    const hits = credentialsTestHits(source(CREDENTIALS_TEST))
    expect(hits, hits.join('\n')).toEqual([])
  })
})

describe('T-FE-2-01 отрицательные контроли (мутации над копией в памяти)', () => {
  // Дерево не трогаем ни одной мутацией: копия строки или объекта живёт только
  // внутри этого теста ([[mutate-in-an-isolated-copy-not-the-shared-tree]]).

  it('вернувшаяся группа credit.stand краснит контроль (а)', () => {
    const credit = (uk as Record<string, unknown>).credit as Record<string, unknown>
    const mutated = { credit: { ...credit, stand: { notice: 'Етап 1: модуль ще працює…' } } }
    expect(
      standGroupHits([['uk', mutated]]),
      'контроль (а) не заметил, что группа вернулась'
    ).toContain('dictionary uk: группа credit.stand вернулась')
  })

  it('вернувшееся утверждение в значении словаря краснит контроль (а)', () => {
    // Именно та форма, которую сняли: «Етап 1» в именительном, а не «на етапі 1».
    const credit = (uk as Record<string, unknown>).credit as Record<string, unknown>
    const unavailable = credit.unavailable as Record<string, unknown>
    const mutated = {
      credit: {
        ...credit,
        unavailable: {
          ...unavailable,
          hint: 'Етап 1: модуль ще працює повз шлюз Kong; його віддає localhost:8020.',
        },
      },
    }
    const hits = forbiddenValueHits([['uk', mutated]])
    expect(hits.join('\n'), 'контроль значений не заметил устаревшее утверждение').toContain(
      'credit.unavailable.hint'
    )
  })

  it('одинаковые подсказки 401 и 403 краснят контроль различимости текстов', () => {
    const credit = (uk as Record<string, unknown>).credit as Record<string, unknown>
    const access = credit.access as Record<string, string>
    // Положительный маркер: на дереве подсказки РАЗНЫЕ, иначе проба зелёная ни на чём.
    expect(
      access.noRightsHint !== access.notAuthenticatedHint,
      'положительный маркер исчез — подсказки уже одинаковы, мутации нечего ломать'
    ).toBe(true)
    const mutated = {
      credit: { ...credit, access: { ...access, noRightsHint: access.notAuthenticatedHint } },
    }
    const hits = dictionaryTextHits([['uk', mutated]])
    expect(hits.join('\n'), 'контроль не заметил, что 401 и 403 стали одним текстом').toContain(
      'стали одним текстом'
    )
  })

  it('вернувшееся «Фінбуст» в копии исходника краснит контроль (б)', () => {
    // Мутация по устойчивому якорю — в начало копии, а не по литералу
    // комментария: привязка к тексту соседней строки ломалась бы от её правки.
    const src = source(UNAVAILABLE_SCREEN)
    const mutated = `// права заведены в «Фінбусті»\n${src}`
    expect(mutated, 'мутация не изменила копию — проверять было бы нечего').not.toBe(src)
    const hits = forbiddenSourceHits([[UNAVAILABLE_SCREEN, mutated]])
    expect(
      hits.join('\n'),
      'контроль (б) не заметил, что историческое утверждение вернулось'
    ).toContain('Фінбуст')
  })

  it('вернувшаяся плашка в JSX страницы краснит контроль (б) без имени компонента', () => {
    // Именно этот случай проходил зелёным до расширения списка: текст вписан в
    // страницу литералом, без имени CreditStandBanner и без ключа словаря.
    const page = source(LOANS_PAGE)
    const mutated = page.replace(
      'export ',
      '// Етап 1: модуль ще працює повз шлюз Kong; локально його віддає localhost:8020\nexport '
    )
    expect(mutated, 'мутация не изменила копию').not.toBe(page)
    const hits = forbiddenSourceHits([[LOANS_PAGE, mutated]])
    expect(
      hits.length,
      'контроль (б) не заметил вписанный в страницу текст плашки'
    ).toBeGreaterThan(0)
  })

  it('разрешение из allow-list снимает запрет только для своего файла', () => {
    // Положительный маркер: разрешение в списке есть и относится к живому файлу.
    expect(ALLOWED_PROJECT_MENTIONS.length, 'allow-list пуст — снимать нечего').toBeGreaterThan(0)
    const entry = ALLOWED_PROJECT_MENTIONS[0]
    const line = `const project = 'fin-boost'\n`
    expect(
      forbiddenSourceHits([[entry.path, line]]),
      'разрешение из allow-list не сработало на своём файле'
    ).toEqual([])
    expect(
      forbiddenSourceHits([[LOANS_PAGE, line]]).length,
      'разрешение из allow-list подействовало на ЧУЖОЙ файл — запрет перестал быть точечным'
    ).toBeGreaterThan(0)
  })

  it('исчезнувшая очистка краснит контроль (в) при зелёных (а) и (б)', () => {
    const api = source(CREDIT_API)
    const mutations: Array<[string, string]> = [
      ['снято объявление', api.replace('function purgeStandCredentials(', 'function unused(')],
      ['снят вызов', api.replace(/^purgeStandCredentials\(\)$/m, '')],
      ...REMOVE_ITEM_CALLS.map((call, i): [string, string] => [
        `снят removeItem #${i + 1}`,
        api.replace(call, ''),
      ]),
    ]
    for (const [name, mutated] of mutations) {
      expect(mutated, `мутация «${name}» не изменила копию`).not.toBe(api)
      expect(
        purgeHits(mutated).length,
        `контроль (в) не заметил: creditApi.ts: очистка credentials исчезла («${name}»)`
      ).toBeGreaterThan(0)
      // Перекрёстная проверка не тавтологична: creditApi.ts из контроля (б)
      // больше не исключён, и (б) считается ПО МУТИРОВАННОЙ копии.
      expect(
        forbiddenSourceHits([[CREDIT_API, mutated]]),
        `мутация «${name}» задела контроль (б)`
      ).toEqual([])
    }
  })

  it('законная форма записи уборки контроль (в) НЕ краснит', () => {
    // Обратная ошибка стража: обёртка вызова в условие или точка с запятой —
    // законная правка, и красное на ней было бы красным не по делу.
    const wrapped = source(CREDIT_API).replace(
      /^purgeStandCredentials\(\)$/m,
      "if (typeof window !== 'undefined') {\n  purgeStandCredentials()\n}"
    )
    expect(wrapped, 'мутация не изменила копию').not.toBe(source(CREDIT_API))
    expect(purgeHits(wrapped), 'страж покраснел на законной форме записи вызова').toEqual([])
  })

  it('выпотрошенный credentials-тест краснит вторую половину контроля (в)', () => {
    const creds = source(CREDENTIALS_TEST)
    const importIdx = creds.lastIndexOf("import('../creditApi')")
    const head = creds.slice(0, importIdx)
    const tail = creds.slice(importIdx)
    const mutations: Array<[string, string, string]> = [
      ['снят один toBeNull', head + tail.replace('.toBeNull()', '.toBeTruthy()'), 'toBeNull'],
      [
        'снят посев до импорта',
        head.replace(/\n\s*window\.(session|local)Storage\.setItem\([^)]*\)/g, '') + tail,
        'посев',
      ],
      [
        'снята проверка пропуска CRM',
        head +
          tail.replace(
            /expect\(window\.localStorage\.getItem\(CRM_TOKEN_KEY\)\)\.toBe\([^)]*\)/,
            ''
          ),
        'пропуск',
      ],
    ]
    for (const [name, mutated, marker] of mutations) {
      expect(mutated, `мутация «${name}» не изменила копию`).not.toBe(creds)
      expect(
        credentialsTestHits(mutated).join('\n'),
        `контроль не заметил мутацию «${name}»`
      ).toContain(marker)
    }
  })

  it('иное расширение в baseline краснит проверку одинаковой области', () => {
    const paths = FILES.map(([path]) => path)
    expect(areaMismatch(BASELINE_EXTENSIONS, paths), 'область разошлась ещё до мутации').toEqual([])
    const hits = areaMismatch([...BASELINE_EXTENSIONS, 'json', 'css', 'md'], paths)
    expect(
      hits.join('\n'),
      'проверка области не заметила, что baseline и глоб считают РАЗНЫЕ множества'
    ).toContain('РАЗНЫЕ множества')
  })

  it('слитое условие 401/403 краснит контроль различения', () => {
    const src = source(UNAVAILABLE_SCREEN)
    expect(
      /status\s*===\s*403/.test(src),
      'положительный маркер исчез — мутация стала зелёной на пустом множестве'
    ).toBe(true)
    // Только условие, БЕЗ подмены ключей: составная мутация зеленела бы от
    // второй половины, даже если первая не применилась.
    const condMutated = src.replace(
      /status\s*===\s*401\s*\|\|\s*status\s*===\s*403/,
      'status !== undefined'
    )
    expect(condMutated, 'мутация условия не применилась').not.toBe(src)
    expect(
      accessBranchHits(condMutated).join('\n'),
      'контроль не заметил слитое условие'
    ).toContain('401 и 403 снова показываются одинаково')
  })

  it('слитые ключи пары краснят контроль различения', () => {
    const src = source(UNAVAILABLE_SCREEN)
    // Слияние ЧЕРЕЗ ПРЕФИКС: оба плеча первого тернарника дают ключ 401.
    const keysMutated = src.replace(
      "status === 401 ? 'credit.access.notAuthenticated' : 'credit.access.noRights'",
      "status === 401 ? 'credit.access.notAuthenticated' : 'credit.access.notAuthenticated'"
    )
    expect(keysMutated, 'мутация ключей не применилась').not.toBe(src)
    expect(
      accessBranchHits(keysMutated).join('\n'),
      'контроль не заметил слияние пары через префикс'
    ).toContain('пара «401=credit.access.notAuthenticated 403=credit.access.noRights» не строится')
  })

  it('переставленные плечи тернарника краснят контроль различения', () => {
    const src = source(UNAVAILABLE_SCREEN)
    const swapped = src.replace(
      "status === 401 ? 'credit.access.notAuthenticated' : 'credit.access.noRights'",
      "status === 401 ? 'credit.access.noRights' : 'credit.access.notAuthenticated'"
    )
    expect(swapped, 'мутация перестановки не применилась').not.toBe(src)
    expect(
      accessBranchHits(swapped).join('\n'),
      'контроль не заметил перестановку плеч — оператор при 401 прочитал бы «нет прав»'
    ).toContain('статус и текст разошлись')
  })

  it('вернувшееся чтение roles_available краснит свой страж', () => {
    const page = source(LOANS_PAGE)
    const mutated = page.replace(
      'export ',
      'const stale = (o: { roles_available: string[] }) => o.roles_available.map((r) => r)\nexport '
    )
    expect(mutated, 'мутация не изменила копию').not.toBe(page)
    expect(
      rolesAvailableReadHits([[LOANS_PAGE, mutated]]).join('\n'),
      'страж не заметил вернувшееся чтение снятого поля'
    ).toContain('.roles_available')
  })

  it('ленивая калитка краснит страж достижимости уборки', () => {
    const lazyRoutes = ROUTES_SOURCE.replace(
      /import\s*\{\s*CreditSectionGate\s*\}\s*from\s*'([^']+)'/,
      "const CreditSectionGate = lazy(() => import('$1'))"
    )
    expect(lazyRoutes, 'мутация не изменила копию').not.toBe(ROUTES_SOURCE)
    expect(
      /import\s*\{[^}]*\bCreditSectionGate\b[^}]*\}\s*from/.test(lazyRoutes),
      'страж не заметил перевод калитки в lazy()'
    ).toBe(false)
    expect(
      /lazy\(\s*\(\s*\)\s*=>\s*import\([^)]*CreditSectionGate/.test(lazyRoutes),
      'страж не увидел форму lazy() — мутация не воспроизвела оптимизацию бандла'
    ).toBe(true)
  })

  it('широкий поиск подстроки credit.stand ловил бы обязательные storage keys', () => {
    const api = source(CREDIT_API)
    expect(
      api.includes('credit.stand.apiKey'),
      'положительный маркер исчез — проба стала зелёной на пустом множестве'
    ).toBe(true)
    expect(
      api.split('credit.stand').length - 1,
      'наивный матчер ловит обязательные storage keys — так проверять нельзя'
    ).toBeGreaterThan(0)
    expect(
      translationKeys(api).filter((key) => key.startsWith('credit.stand')),
      'структурный матчер обязан видеть ноль вызовов перевода в creditApi.ts'
    ).toEqual([])
  })

  it('ключ, заданный не через t(), тоже виден структурному матчеру', () => {
    // Форма записи ключа в react-i18next не одна: `<Trans i18nKey>` и keyPrefix
    // регуляркой по `t(` не видны вовсе, и контроль держался бы на одной из трёх.
    // Кавычка собирается в рантайме: литерал `t('credit.…')`, написанный здесь
    // прямо, попал бы в выборку СОСЕДНЕГО стража `i18nKeys.test.ts` — его фильтр
    // `__tests__` слеп к собственной папке (ключи соседей приходят как `./X`),
    // и он потребовал бы снятый ключ обратно в словарь.
    const q = String.fromCharCode(39)
    const samples = [
      '<Trans i18nKey="credit.stand.notice" />',
      `useTranslation(${q}common${q}, { keyPrefix: ${q}credit.stand${q} })`,
      `i18n.t(${q}credit.stand.notice${q})`,
    ]
    for (const sample of samples) {
      expect(
        translationKeys(sample).some((key) => key.startsWith('credit.stand')),
        `форма записи ключа не разбирается: ${sample}`
      ).toBe(true)
    }
  })
})
