/**
 * Срез живого реестра кодов решения — не выдумка.
 *
 * Одиннадцать записей дословно из `registry_view()` файла
 * `service/src/credit_service/app/decision_codes.py` репозитория credit-module
 * (`main` `8b46966`, единица 19-1; sha256 файла на этом коммите `f10e7824…`);
 * `AB-C-02`…`AB-C-04` добавлены в 19-5f из снимка того же реестра
 * `registry-view-1f05e4c.json` (sha256 `a58891e6…`, в нём ровно четыре записи
 * `kind = conditional`) — срез несёт весь живой состав условий. Отобраны так,
 * чтобы в срезе был каждый вид: условное одобрение `AB-C-01`…`AB-C-04` (форма
 * предлагает `AB-C-*` при `approved` и никогда — к отказу), автогейт `AB-G-06` и
 * служебный `AB-X-08` (к отказу предлагает — положительный контроль отбора),
 * отказы книги в четырёх разделах. Два отказа одного раздела — `AB-O-08` и
 * `AB-O-09` (`conduct`): без них порядок по `id` внутри группы не проверить.
 *
 * Единственное отличие от `registry_view()` — `version`: живое значение несёт
 * имя проекта, а страж устаревших текстов раздела ищет его и в тестах. Для
 * фронта `version` непрозрачна, поэтому здесь синтетические `book@1` / `book@2`.
 */
import type { CreditDecisionCodeEntry, CreditDecisionCodesRegistry } from '../types'

export const DECISION_CODE_ENTRIES: readonly CreditDecisionCodeEntry[] = [
  {
    id: 'AB-C-01',
    kind: 'conditional',
    book: 'У-01',
    book_code: null,
    category: 'income',
    ru: 'В расчётном листке выплачены отпускные (признак увольнения)',
    en: 'Vacation pay on the pay stub (sign of termination)',
    note_ru: 'Требуется одобрение руководителя',
    traits: ['supervisor'],
    legacy_rc: null,
  },
  {
    id: 'AB-C-02',
    kind: 'conditional',
    book: 'У-02',
    book_code: null,
    category: 'bank_statement',
    ru: 'Один случай NSF',
    en: 'One NSF event',
    note_ru: 'Требуется одобрение руководителя',
    traits: ['supervisor'],
    legacy_rc: null,
  },
  {
    id: 'AB-C-03',
    kind: 'conditional',
    book: 'У-03',
    book_code: null,
    category: 'bank_statement',
    ru: 'Клиент снимает всю сумму в день зарплаты',
    en: 'Client withdraws the full amount on payday',
    note_ru: 'Требуется одобрение руководителя',
    traits: ['supervisor'],
    legacy_rc: null,
  },
  {
    id: 'AB-C-04',
    kind: 'conditional',
    book: 'У-04',
    book_code: null,
    category: 'employment',
    ru: 'Заявитель не отработал полный расчётный период у работодателя',
    en: 'Applicant has not completed a full pay period with the employer (employer letter required)',
    note_ru: 'Требуется письмо от работодателя, подтверждающее занятость',
    traits: ['supervisor'],
    legacy_rc: null,
  },
  {
    id: 'AB-G-06',
    kind: 'gate',
    book: null,
    book_code: 'О-01',
    category: 'loan_terms',
    ru: 'Допустимая сумма ниже минимума $100 (50 % ЗП за период)',
    en: 'Allowed amount below the $100 minimum (50 % of net pay per period)',
    note_ru: null,
    traits: ['automatic'],
    legacy_rc: 'RC-11',
  },
  {
    id: 'AB-O-05',
    kind: 'refusal',
    book: 'О-05',
    book_code: null,
    category: 'loan_terms',
    ru: 'У заявителя уже есть действующий заём до зарплаты',
    en: 'Applicant already has an active payday loan',
    note_ru: 'Повторные займы не допускаются',
    traits: ['automatic'],
    legacy_rc: 'RC-04',
  },
  {
    id: 'AB-O-08',
    kind: 'refusal',
    book: 'О-08',
    book_code: null,
    category: 'conduct',
    ru: 'Признаки алкогольного опьянения (невнятная речь, запах алкоголя и т.п.)',
    en: 'Signs of alcohol intoxication',
    note_ru: 'Автоматический отказ на месте',
    traits: ['on_site'],
    legacy_rc: null,
  },
  {
    id: 'AB-O-09',
    kind: 'refusal',
    book: 'О-09',
    book_code: null,
    category: 'conduct',
    ru: 'Признаки употребления наркотиков',
    en: 'Signs of drug use',
    note_ru: 'Автоматический отказ на месте',
    traits: ['on_site'],
    legacy_rc: null,
  },
  {
    id: 'AB-O-13',
    kind: 'refusal',
    book: 'О-13',
    book_code: null,
    category: 'financial_hardship',
    ru: 'Кредитное консультирование в последние 3 месяца',
    en: 'Credit counselling within the last 3 months',
    note_ru: null,
    traits: ['checklist'],
    legacy_rc: null,
  },
  {
    id: 'AB-O-20',
    kind: 'refusal',
    book: 'О-20',
    book_code: null,
    category: 'income',
    ru: 'Валовой доход менее $1000 в месяц',
    en: 'Gross income below $1,000 per month',
    note_ru: null,
    traits: ['automatic'],
    legacy_rc: 'RC-11',
  },
  {
    id: 'AB-X-08',
    kind: 'service',
    book: null,
    book_code: null,
    category: 'service',
    ru: 'Остывание после отказа',
    en: 'Re-application period after a previous refusal has not expired',
    note_ru: null,
    traits: ['automatic'],
    legacy_rc: 'RC-08',
  },
]

/** Реестр той же формы, что ответ двери, — первая версия. */
export const DECISION_CODES_FIXTURE: CreditDecisionCodesRegistry = {
  version: 'book@1',
  codes: DECISION_CODE_ENTRIES.map((entry) => ({ ...entry, traits: [...entry.traits] })),
}

export const entryOf = (id: string): CreditDecisionCodeEntry => {
  const found = DECISION_CODE_ENTRIES.find((entry) => entry.id === id)
  if (!found) throw new Error(`фикстура не несёт ${id} — срез реестра потерял запись`)
  return found
}
