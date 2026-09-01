/**
 * На что раздел «Кредитный модуль» ОПИРАЕТСЯ в контракте — проверкой сборки.
 *
 * Приём взят у команды сайта (`web-credit/packages/api-client/src/contract-assumptions.ts`)
 * и решает дыру, которую мой собственный страж не видит. Страж ключей
 * (`__tests__/i18nKeys.test.ts`) сверяет словари с перечислениями в
 * `enums.ts` — но сам `enums.ts` я написал ЗЕРКАЛОМ контракта вручную. Если
 * модуль сменит набор значений, зеркало останется прежним, страж промолчит, и
 * экран будет сравнивать со строками, которых больше нет.
 *
 * У сайта это уже случилось: набор состояний выдачи сменился молча — одно
 * значение исчезло, два появились. Наличие самого поля не изменилось, поэтому
 * проверки полей прошли, а ветки решения продолжали сравнивать со старым.
 *
 * Здесь — утверждения о полях и ЗНАЧЕНИЯХ, на которых стоят ветки кода.
 * Ничего не исполняется: проверяет `tsc`. Пропадёт поле или значение —
 * красная сборка с именем утверждения, а не молча неверный экран.
 *
 * Как добавлять: появилась ветка, сравнивающая поле контракта с конкретной
 * строкой, — допиши утверждение и назови в комментарии, ЧТО сломается без
 * него. Утверждение без объяснения бесполезно: следующий не поймёт, можно ли
 * его удалить.
 */
import type {
  CreditApplicationStatus,
  CreditJournalEntry,
  CreditLoanStatus,
  CreditPayment,
} from './types'

/** Утверждение: `true` проходит, `false` роняет сборку именем строки. */
type Assert<T extends true> = T
/** Есть ли у типа такое поле (в том числе необязательное). */
type Has<T, K extends string> = K extends keyof T ? true : false
/** Есть ли значение в объединении. */
type Includes<Union, V extends string> = V extends Union ? true : false

/* ─── Состояние платежа ─────────────────────────────────────────────────
   `CreditLoanDetailPage` рисует сторнированный платёж иначе обычного:
   зачёркивает сумму и подписывает датой возврата. Ветка стоит на значении
   'reversed'. Если модуль переименует состояние, экран покажет сторно как
   обычный платёж — то самое расхождение «плитка 70,00, таблица 154,00»,
   ради которого различение и заводилось. */
export type _payment_has_state = Assert<Has<CreditPayment, 'state'>>
export type _payment_state_reversed = Assert<Includes<CreditPayment['state'], 'reversed'>>
export type _payment_state_accepted = Assert<Includes<CreditPayment['state'], 'accepted'>>
/** Дата возврата — учётная из журнала, не дата платежа. Ветка подписи read'ёт её. */
export type _payment_has_reversed_on = Assert<Has<CreditPayment, 'reversed_on'>>

/* ─── Тип проводки ──────────────────────────────────────────────────────
   Журнал не дублирует слово «сторно», если тип проводки уже 'reversal'
   (иначе выходило «Сторнування (сторно)»). Ветка сравнивает entry_type
   именно с этой строкой; переименование вернёт тавтологию. */
export type _entry_has_type = Assert<Has<CreditJournalEntry, 'entry_type'>>
/**
 * Значение, на котором стоит ветка. До 31.08 поле было объявлено как
 * произвольная строка — компилятор молчал бы при любом переименовании, и
 * тавтология «Сторнування (сторно)» вернулась бы незамеченной. Теперь тип
 * выводится из перечисления контракта, и утверждение это стережёт.
 */
export type _entry_type_reversal = Assert<Includes<CreditJournalEntry['entry_type'], 'reversal'>>
export type _entry_has_reversal_ref = Assert<Has<CreditJournalEntry, 'reversal_of_entry_id'>>

/* ─── Статусы кредита ───────────────────────────────────────────────────
   Метрики списка считают кредиты по статусам, а `CreditStatusBadge` красит
   их по имени. Значения ниже — те, на которых стоит поведение: пропажа
   любого означает пустую метрику или бейдж без цвета. */
export type _loan_status_active = Assert<Includes<CreditLoanStatus, 'active'>>
export type _loan_status_delinquent = Assert<Includes<CreditLoanStatus, 'delinquent'>>
export type _loan_status_closed = Assert<Includes<CreditLoanStatus, 'closed'>>
export type _loan_status_pending = Assert<Includes<CreditLoanStatus, 'pending_disbursement'>>
/** Отменённая выдача. Если модуль заведёт для неё отдельное состояние —
    здесь станет видно раньше, чем на экране (см. Д-12 хребта). */
export type _loan_status_cancelled = Assert<Includes<CreditLoanStatus, 'cancelled'>>

/* ─── Статусы заявки ────────────────────────────────────────────────────
   Очередь оператора фильтрует по этим значениям; из 'declined' возврата
   нет (ФТ-14), и на этом стоит поведение карточки. */
export type _app_status_referred = Assert<Includes<CreditApplicationStatus, 'referred'>>
export type _app_status_declined = Assert<Includes<CreditApplicationStatus, 'declined'>>
export type _app_status_disbursed = Assert<Includes<CreditApplicationStatus, 'disbursed'>>
export type _app_status_scoring = Assert<Includes<CreditApplicationStatus, 'scoring'>>
