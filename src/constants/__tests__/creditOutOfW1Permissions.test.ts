/**
 * Четыре константы вне W1 остаются объявленными — и только объявленными.
 *
 * `credit.applications.write`, `credit.documents.generate`,
 * `credit.parameters.propose`, `credit.parameters.approve` в словаре Wave 1 не
 * существуют: модуль их не выдаёт и не проверяет. Они объявлены намеренно
 * (решение SPEC; контракт C-02 перечисляет ровно эти четыре как FE_OUT_OF_W1;
 * вариант удаления — открытый вопрос Q-FE-02, решение владельца). Требование
 * поэтому не «удалить», а «не пускать в гейты».
 *
 * Чем это плохо на деле: кредитные маршруты стоят в `mode="any"` вместе с
 * `PERMISSIONS.SYSTEM.MANAGE_SETTINGS`. Гейт на несуществующее право не
 * «закрывает раздел навсегда» — он закрывает его для кредитных ролей и
 * оставляет открытым держателям системного права. Снаружи это выглядит как
 * «у части людей работает», а такой дефект живёт дольше полного отказа.
 *
 * Проверяются ОБЕ формы употребления — строковое значение и идентификатор
 * `PERMISSIONS.CREDIT.<ИМЯ>`: в гейтах маршрутов и пунктах меню стоят именно
 * идентификаторы (строковых литералов `'credit.'` там ноль), поэтому страж,
 * знающий только значения, пропустил бы ровно тот случай, ради которого он
 * заведён. Замер базы 8f654086e7: у каждого из четырёх имён и значение, и
 * идентификатор встречаются только в `permissions.ts`.
 *
 * ⚠️ ПРЕДЕЛ ФОРМЫ. Имя ищется целым словом. Право, собранное конкатенацией
 * (`'credit.parameters.' + 'approve'`), шаблонной строкой или вычисляемым
 * доступом, этим стражем не ловится. Границы слова при этом обязательны с
 * другой стороны: без них будущее легальное `credit.applications.write_bulk`
 * засчиталось бы как вхождение `credit.applications.write` и покрасило бы
 * страж в чужом PR.
 *
 * ⚠️ Тестовые файлы исключены из выборки — той же политикой, что у соседнего
 * стража (`isTestFile`). Фикстура, описывающая поведение ПРИ ОТСУТСТВИИ права,
 * не является употреблением права.
 *
 * Исходники читаются глобом Vite с `?raw`: средства файловой системы Node
 * уронили бы `tsc -b` (`types: ["vite/client"]`, TS2307 — проверено).
 */
import { describe, it, expect } from 'vitest'
import { OUT_OF_W1, isTestFile, selfPath } from './creditPermissionSets'

/**
 * Вся `src/`, кроме тестов: требование — «нигде, кроме permissions.ts».
 *
 * Негативные шаблоны отсекают тестовые файлы на уровне глоба, а не после
 * чтения: это и есть политика `isTestFile`, применённая раньше и дешевле.
 * Замер базы 8f654086e7: 2166 файлов `.ts/.tsx` в `src/`, из них 1608 не тесты.
 * Средствами файловой системы это читалось бы дешевле, но такой импорт валит
 * `tsc -b` (см. шапку), поэтому цена глоба — осознанная плата за зелёный
 * Type Check, и она измерена в Dev Agent Record story.
 */
const SOURCES = import.meta.glob(
  [
    '../../**/*.{ts,tsx}',
    '!../../**/__tests__/**',
    '!../../**/*.test.{ts,tsx}',
    '!../../**/*.spec.{ts,tsx}',
  ],
  { query: '?raw', import: 'default', eager: true }
) as Record<string, string>

/**
 * Ключи глоба Vite относительны ЭТОГО каталога: `src/constants/permissions.ts`
 * приходит как `../permissions.ts`. В `src/` такой файл ровно один (замер базы),
 * и второй появившийся поймает тест «ровно один файл-владелец» ниже.
 */
const DECLARATION = '/permissions.ts'

/** Собственный путь — для самоисключения без привязки к буквальному имени файла. */
const SELF = selfPath(import.meta.url)

function isSelf(key: string): boolean {
  return SELF.endsWith(`/${key.replace(/^(\.\.\/)+/, '')}`)
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Имя целым словом: ни как часть более длинного имени, ни как хвост чужого пути. */
function mentions(source: string, name: string): boolean {
  const value = new RegExp(`(?<![\\w.])${escapeForRegExp(name)}(?![\\w])`)
  return value.test(source)
}

function mentionsIdentifier(source: string, identifier: string): boolean {
  return new RegExp(`\\b${escapeForRegExp(identifier)}\\b`).test(source)
}

/**
 * Общий предикат: где имя вне W1 встречается за пределами объявления.
 * Им пользуется и знак, и отрицательные контроли — иначе контроль проверял бы
 * сам себя, а не тот код, который стоит в дверях.
 */
function straysIn(sources: Record<string, string>): string[] {
  const strays: string[] = []
  for (const [file, src] of Object.entries(sources)) {
    if (file.endsWith(DECLARATION) || isTestFile(file) || isSelf(file)) continue
    for (const name of OUT_OF_W1) {
      if (mentions(src, name.value) || mentionsIdentifier(src, name.identifier)) {
        strays.push(`${name.value} встретилось вне permissions.ts: ${file}`)
      }
    }
  }
  return strays
}

/** Файлы, где имя встречается в любой из двух форм. */
function ownersOf(name: (typeof OUT_OF_W1)[number]): string[] {
  return Object.keys(SOURCES).filter(
    (file) =>
      !isSelf(file) &&
      (mentions(SOURCES[file], name.value) || mentionsIdentifier(SOURCES[file], name.identifier))
  )
}

describe('T-FE-2-03 имена вне W1 живут только в объявлении', () => {
  it('контроль от пустой выборки: все четыре объявлены в permissions.ts', () => {
    const declaration = Object.entries(SOURCES).find(([path]) => path.endsWith(DECLARATION))?.[1]
    expect(declaration, 'permissions.ts не прочитан — глоб потерял предмет').toBeTruthy()
    const text = declaration ?? ''
    for (const name of OUT_OF_W1) {
      // Предмет теста — объявление имени, а не его описание в
      // PERMISSION_DESCRIPTIONS: легальная уборка описаний (Q-FE-02) не должна
      // красить этот страж сообщением не по делу.
      expect(
        text.includes(name.declaration),
        `${name.declaration} не найден в permissions.ts`
      ).toBe(true)
    }
  })

  it('у каждого имени ровно один файл-владелец — src/constants/permissions.ts', () => {
    for (const name of OUT_OF_W1) {
      const owners = ownersOf(name)
      expect(owners, `${name.value}: файлы-владельцы ${owners.join(', ')}`).toHaveLength(1)
      expect(owners[0].endsWith(DECLARATION)).toBe(true)
    }
  })

  it('и больше нигде в src/', () => {
    const strays = straysIn(SOURCES)
    expect(strays, strays.join('\n')).toEqual([])
  })
})

describe('T-FE-2-03 отрицательные контроли (копии текста в памяти)', () => {
  it('идентификатор в гейте маршрута краснит проверку', () => {
    const entry = Object.entries(SOURCES).find(([path]) => path.endsWith('routes/index.tsx'))
    expect(entry, 'routes/index.tsx не прочитан — глоб потерял предмет').toBeTruthy()
    const [routesPath, routesSource] = entry ?? ['', '']
    const mutated = routesSource.replace(
      'PERMISSIONS.CREDIT.PARAMETERS_VIEW',
      'PERMISSIONS.CREDIT.PARAMETERS_APPROVE'
    )
    expect(mutated, 'контроль не построен: подмена идентификатора не состоялась').not.toBe(
      routesSource
    )
    const strays = straysIn({ [routesPath]: mutated })
    expect(
      strays.join('\n'),
      'контроль не покраснел: страж принял идентификатор вне-W1 в гейте маршрута'
    ).toEqual(`credit.parameters.approve встретилось вне permissions.ts: ${routesPath}`)
  })

  it('голой литерал в чужом файле краснит проверку', () => {
    // Вторая половина предиката (форма ЗНАЧЕНИЯ) до сих пор ничем не доказана:
    // в гейтах стоят идентификаторы, и без этой сцены половина стража спала бы.
    const fake = "const guard = (p: string[]) => p.includes('credit.documents.generate')\n"
    const strays = straysIn({ '../../pages/Credit/FakePage.tsx': fake })
    expect(
      strays.join('\n'),
      'контроль не покраснел: страж принял голой литерал вне-W1 в чужом файле'
    ).toContain('credit.documents.generate встретилось вне permissions.ts')
  })

  it('второй файл с именем permissions.ts краснит «ровно один владелец»', () => {
    // Именно на этот тест переложена защита от послабления DECLARATION:
    // endsWith('/permissions.ts') пропустил бы любой файл с таким именем.
    const name = OUT_OF_W1[0]
    const owners = [...ownersOf(name), '../../features/credit/permissions.ts']
    expect(owners.length, 'контроль не построен: второй владелец не добавлен').toBe(2)
    expect(
      owners.length === 1,
      'контроль не покраснел: проверка приняла двух владельцев одного имени'
    ).toBe(false)
  })

  it('имя-надмножество НЕ считается вхождением', () => {
    // credit.applications.write_bulk — законное будущее имя; подстрочный поиск
    // покрасил бы страж на нём в чужом PR.
    const wider = "const p = 'credit.applications.write_bulk'\n"
    expect(
      straysIn({ '../../pages/Credit/FakeWider.tsx': wider }),
      'страж поймал имя-надмножество как вхождение'
    ).toEqual([])
  })

  it('тестовая фикстура с именем вне W1 стража не красит', () => {
    const fixture = "mockOverview(['credit.parameters.approve'])\n"
    expect(
      straysIn({ '../../pages/Credit/__tests__/Fake.test.tsx': fixture }),
      'страж поймал фикстуру теста как употребление права'
    ).toEqual([])
  })
})
