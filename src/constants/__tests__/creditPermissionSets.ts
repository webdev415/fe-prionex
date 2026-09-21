/**
 * Общие множества и предикаты двух стражей кредитных прав.
 *
 * Вынесены из тестов, чтобы список имён вне Wave 1 жил в ОДНОМ месте: пока он
 * был продублирован, два стража могли разойтись молча — один запрещал бы
 * употребление имени, которое другой уже считает легальным после пересъёмки
 * снимка. Здесь же лежит общий признак тестового файла: политика «литерал
 * теста — не употребление права» обязана быть одной для обеих выборок.
 *
 * Файл лежит в `__tests__/`, но тестом не является: `vitest.config.ts` ловит
 * только `*.{test,spec}.*`. Он же попадает под собственный предикат
 * `isTestFile`, поэтому четыре имени ниже не засчитываются стражем замкнутости
 * как употребление.
 */

/**
 * Кредитные права, объявленные в `permissions.ts` и отсутствующие в словаре W1.
 *
 * Список не «справочный»: тест равенства в `creditW1Permissions.test.ts`
 * требует, чтобы он ТОЧНО совпадал с разностью «объявленные минус снимок».
 * Пятая такая константа краснит тест, пока её сюда не внесли; имя, попавшее в
 * снимок после пересъёмки, краснит его же с другой стороны.
 */
export const OUT_OF_W1 = [
  { value: 'credit.applications.write', constant: 'APPLICATIONS_WRITE' },
  { value: 'credit.documents.generate', constant: 'DOCUMENTS_GENERATE' },
  { value: 'credit.parameters.propose', constant: 'PARAMETERS_PROPOSE' },
  { value: 'credit.parameters.approve', constant: 'PARAMETERS_APPROVE' },
].map((name) => ({
  ...name,
  /** Форма УПОТРЕБЛЕНИЯ: в гейтах, меню и экранах стоит именно она. */
  identifier: `PERMISSIONS.CREDIT.${name.constant}`,
  /** Форма ОБЪЯВЛЕНИЯ: `APPLICATIONS_WRITE: 'credit.applications.write'`. */
  declaration: `${name.constant}: '${name.value}'`,
}))

export const OUT_OF_W1_VALUES = OUT_OF_W1.map((name) => name.value)

/**
 * Признак тестового файла — один на оба стража.
 *
 * Репозиторий держит обе конвенции: каталог `__tests__/` и сорасположенный
 * `*.test.ts(x)` (`src/lib/utils.test.ts` и десятки других). Литерал внутри
 * теста употреблением права не является — ни в выборке идентификаторов, ни в
 * выборке голых строк, ни в проверке замкнутости: иначе фикстура вида
 * `mockOverview(['credit.parameters.approve'])`, описывающая поведение ПРИ
 * ОТСУТСТВИИ права, краснила бы страж как «право попало в гейт».
 */
export function isTestFile(path: string): boolean {
  return /(^|\/)__tests__\//.test(path) || /\.(test|spec)\.(ts|tsx)$/.test(path)
}

/** Форма имени права в словаре: `credit.<сегмент>.<сегмент>[…]`, нижний регистр. */
export const PERMISSION_NAME_RE = /^credit\.[a-z0-9_]+(\.[a-z0-9_]+)+$/

/** 40-hex коммита. Один предикат для боевого утверждения и для его контроля. */
export function isCommitSha(value: string): boolean {
  return /^[0-9a-f]{40}$/.test(value)
}

/** 64-hex sha256. Тот же довод, что у `isCommitSha`. */
export function isSha256Hex(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value)
}

/**
 * Путь собственного файла по `import.meta.url` — для самоисключения стража.
 *
 * Привязка к буквальному имени файла ломается от переименования, копии или
 * выноса списка в общий модуль: файл начинает краснить сам от своего текста.
 */
export function selfPath(metaUrl: string): string {
  return metaUrl.replace(/^file:\/\//, '')
}
