#!/usr/bin/env node
/**
 * Мутационная проверка тестов.
 *
 * ЗАЧЕМ. Зелёный тест не доказывает, что он что-то проверяет. Он может быть
 * зелёным по неверной причине — и останется зелёным, когда причина станет
 * вредной. Проверка одна: сломать поведение, которое тест якобы защищает, и
 * убедиться, что тест покраснел.
 *
 * Живые примеры из раздела «Кредитный модуль» (29.08.2026), оба прошли бы в
 * прод незамеченными:
 *
 *   1. Тест «ловит расхождение дохода» был зелёным без приведения строки к
 *      числу — JS сравнивает `'75.26' > 10` сам. Но `'9.50' > '10'`
 *      лексикографически ИСТИНА, то есть на нормальной заявке оператор увидел
 *      бы ложную тревогу. Тест этого не видел.
 *   2. Тест «локаль не захардкожена» был зелёным при хардкоде `'ru-RU'` —
 *      приложение схлопывает любую чужую локаль в английскую, и подмена
 *      выглядела как норма.
 *
 *   3. Тест разбора анкеты прогонял сломанную ветку через себя каждый прогон
 *      и оставался зелёным до исправления дефекта и после — просто не
 *      проверял нужное поле.
 *
 * КАК ЧИТАТЬ РЕЗУЛЬТАТ — здесь легко ошибиться:
 *
 *   «тест покраснел»  — ХОРОШО. Тест действительно защищает поведение.
 *   «тесты ЗЕЛЁНЫЕ»   — НАХОДКА В ТЕСТЕ, а не успех. Код сломан, а проверка
 *                       промолчала: тест надо переписать, чтобы он ловил.
 *                       На первый взгляд эта строка выглядит как «всё хорошо» —
 *                       это самая частая ошибка чтения отчёта.
 *   «мутация не внесена» — текст в файле изменился, поправьте описание мутации.
 *
 * ЧТО ИМЕННО ПРОВЕРЯЕТСЯ: набор тестов файла, а не отдельная проверка внутри
 * него. Если одна проверка ослабла, а соседняя ловит ту же мутацию, отчёт
 * останется зелёным — и это верно: поведение по-прежнему защищено. Ослабление
 * конкретного `expect` инструмент не ловит и не должен.
 *
 * ЗАПУСК:
 *   node scripts/mutation-check.mjs                     # все наборы
 *   node scripts/mutation-check.mjs credit              # набор по имени
 *
 * КУДА ДОБАВЛЯТЬ СВОИ: массив MUTATIONS ниже. Мутация должна ломать СМЫСЛ
 * (выключать проверку, убирать приведение, возвращать прежний дефект), а не
 * синтаксис: сломанная сборка красит тесты и без вашего теста.
 *
 * Файлы восстанавливаются всегда, в том числе при Ctrl+C.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'

const FLAGS = 'src/features/credit/api/applicantFlags.ts'
const MONEY = 'src/features/credit/api/money.ts'
const DRAFT = 'src/features/credit/api/draft.ts'

const FLAGS_SPEC = 'src/features/credit/api/__tests__/applicantFlags.test.ts'
const MONEY_SPEC = 'src/features/credit/api/__tests__/money.test.ts'
const DRAFT_SPEC = 'src/features/credit/api/__tests__/draft.test.ts'

const LOAN_PAGE = 'src/pages/Credit/CreditLoanDetailPage.tsx'
const LOAN_PAGE_SPEC = 'src/pages/Credit/__tests__/CreditLoanDetailPage.test.tsx'

/**
 * @type {Array<{suite: string, name: string, file: string, from: string,
 *               to: string, spec: string, why: string}>}
 */
const MUTATIONS = [
  {
    suite: 'credit',
    name: 'убрано приведение процента (строка → число)',
    why: 'без него сравнение идёт лексикографически: 9,5 % при допуске 10 % даёт ложную тревогу',
    file: FLAGS,
    from: 'const divergence = toNumber(reconciliation?.divergence_pct)',
    to: 'const divergence = (reconciliation?.divergence_pct as number) ?? null',
    spec: FLAGS_SPEC,
  },
  {
    suite: 'credit',
    name: 'выключен признак возвратов за недостатком средств',
    why: 'риск невозврата перестал бы подсвечиваться',
    file: FLAGS,
    from: '  if (nsf90 > 0) {',
    to: '  if (false) {',
    spec: FLAGS_SPEC,
  },
  {
    suite: 'credit',
    name: 'отказ от рекламы снова считается нехваткой данных',
    why: 'красный на законном отказе приучает оператора не смотреть на цвет',
    file: FLAGS,
    from: 'REQUIRED_CONSENTS.has(consent.kind)',
    to: 'true',
    spec: FLAGS_SPEC,
  },
  {
    suite: 'credit',
    name: 'выключено расхождение работодателя',
    why: 'признак поддельного дохода перестал бы подсвечиваться',
    file: FLAGS,
    from: 'declaredEmployer.toLowerCase() !== verifiedEmployer.toLowerCase()',
    to: 'false',
    spec: FLAGS_SPEC,
  },
  {
    suite: 'credit',
    name: 'локаль форматирования снова захардкожена',
    why: 'украинский оператор видел бы чужие разделители',
    file: MONEY,
    from: "return i18n.language || 'uk'",
    to: "return 'ru-RU'",
    spec: MONEY_SPEC,
  },
  {
    suite: 'credit',
    name: 'пустая сумма печатается нулём',
    why: '«0,00» на месте неизвестного долга оператор прочтёт как «долга нет»',
    file: MONEY,
    from: "if (minor === null || minor === undefined || Number.isNaN(minor)) return '—'",
    to: "if (false) return '—'",
    spec: MONEY_SPEC,
  },
  {
    suite: 'credit',
    name: 'работодатель снова подменяет статус занятости',
    why: 'оператор видел бы название компании в графе «Занятость» — хуже пустоты',
    file: DRAFT,
    from: 'employmentStatus: income.employment_status ? String(income.employment_status) : null,',
    to: 'employmentStatus: income.employment_status ? String(income.employment_status) : (income.employer ? String(income.employer) : null),',
    spec: DRAFT_SPEC,
  },
  {
    suite: 'credit',
    name: 'сторнированный платёж снова выглядит как обычный',
    why: 'оператор видит три платежа, система считает один — тот самый разговор «я же платил»',
    file: LOAN_PAGE,
    from: "const reversed = payment.state === 'reversed'",
    to: 'const reversed = false',
    spec: LOAN_PAGE_SPEC,
  },
  {
    suite: 'credit',
    name: 'дата сторно подменена датой платежа',
    why: 'возврат приходит позже, иногда на месяц: чужая дата в подписи хуже отсутствия подписи',
    file: LOAN_PAGE,
    from: 'date: formatDate(payment.reversed_on ?? undefined),',
    to: 'date: formatDate(payment.effective_date),',
    spec: LOAN_PAGE_SPEC,
  },
]

const wanted = process.argv[2]
const selected = wanted ? MUTATIONS.filter((m) => m.suite === wanted) : MUTATIONS

if (selected.length === 0) {
  const suites = [...new Set(MUTATIONS.map((m) => m.suite))].join(', ')
  console.error(`Нет мутаций для набора «${wanted}». Доступные: ${suites}`)
  process.exit(2)
}

/** Файлы, которые сейчас подменены — восстановить при любом выходе. */
const dirty = new Set()

function restoreAll() {
  for (const file of dirty) {
    const backup = `${file}.mutation-backup`
    if (existsSync(backup)) {
      copyFileSync(backup, file)
      unlinkSync(backup)
    }
  }
  dirty.clear()
}

process.on('SIGINT', () => {
  restoreAll()
  process.exit(130)
})
process.on('uncaughtException', (error) => {
  restoreAll()
  throw error
})

let survived = 0
let notApplied = 0

console.log('Мутационная проверка: ломаем поведение и ждём, что тест покраснеет.\n')

for (const mutation of selected) {
  const source = readFileSync(mutation.file, 'utf8')
  if (!source.includes(mutation.from)) {
    console.log(`  ??  ${mutation.name}`)
    console.log(`      мутация не внесена — текст изменился, поправьте описание\n`)
    notApplied += 1
    continue
  }

  const backup = `${mutation.file}.mutation-backup`
  copyFileSync(mutation.file, backup)
  dirty.add(mutation.file)
  writeFileSync(mutation.file, source.replace(mutation.from, mutation.to), 'utf8')

  let testsPassed = true
  try {
    execFileSync('npx', ['vitest', 'run', mutation.spec], { stdio: 'ignore' })
  } catch {
    testsPassed = false
  }

  copyFileSync(backup, mutation.file)
  unlinkSync(backup)
  dirty.delete(mutation.file)

  if (testsPassed) {
    console.log(`  ХХ  ${mutation.name}`)
    console.log(`      код сломан, а тесты ЗЕЛЁНЫЕ — это находка В ТЕСТЕ`)
    console.log(`      последствие дефекта: ${mutation.why}\n`)
    survived += 1
  } else {
    console.log(`  ок  ${mutation.name}\n`)
  }
}

console.log('—'.repeat(60))
if (survived === 0 && notApplied === 0) {
  console.log(`Все ${selected.length} мутаций пойманы тестами.`)
  process.exit(0)
}
if (survived > 0) {
  console.log(`Тесты НЕ ловят ${survived} из ${selected.length} мутаций — перепишите их.`)
}
if (notApplied > 0) {
  console.log(`Не удалось внести ${notApplied} мутаций — описания устарели.`)
}
process.exit(1)
