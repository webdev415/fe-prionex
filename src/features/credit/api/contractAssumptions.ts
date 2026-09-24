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
import type { CreditApplicationStage } from './applicationStages'
import type {
  CreditApplicationDetail,
  CreditApplicationStatus,
  CreditDecision,
  CreditDocumentMeta,
  CreditJournalEntry,
  CreditLoanDetail,
  CreditLoanStatus,
  CreditPayment,
} from './types'

/** Утверждение: `true` проходит, `false` роняет сборку именем строки. */
type Assert<T extends true> = T
/** Есть ли у типа такое поле (в том числе необязательное). */
type Has<T, K extends string> = K extends keyof T ? true : false
/** Поле обязательно (объявлено без `?:`). `Has` этого не различает. */
type IsRequired<T, K extends keyof T> = Record<never, never> extends Pick<T, K> ? false : true
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

/* ─── Этап заявки ───────────────────────────────────────────────────────
   Позиция ленты в карточке читается из ответа модуля. Эти три утверждения
   стерегут СОСТАВ ТИПА, и только его: удалит кто-нибудь поле из
   `CreditApplicationDetail` — красная сборка с именем строки. Чего они НЕ
   стерегут, надо знать: ответ приходит неконтролируемым приведением типа, без
   разбора схемы, и объект уходит в компонент целиком, а компонент объявляет
   нужные поля в СВОЁМ структурном типе. Поэтому сцену «страница передала ленте
   обрезанный объект» эти строки не поймают — её стережёт отдельный тест
   уровня страницы (`CreditApplicationDetailPage.test.tsx`, «передаёт ленте три
   поля этапа»). `Has` ловит локальное удаление и ничего не говорит о
   контракте (см. шапку про два класса утверждений). */
export type _app_has_stage = Assert<Has<CreditApplicationDetail, 'stage'>>
export type _app_has_stage_index = Assert<Has<CreditApplicationDetail, 'stage_index'>>
export type _app_has_stage_total = Assert<Has<CreditApplicationDetail, 'stage_total'>>
/* А это — второй класс: утверждение о СОДЕРЖИМОМ перечня. Переименуют этап
   обратно в `bank` — красная сборка с именем строки, а не молча неверный
   экран: имя этапа уезжает в ключ словаря и на экран оператора. */
export type _app_stage_income_check = Assert<Includes<CreditApplicationStage, 'income_check'>>

/* ─── Статусы, на которых стоит состояние строки ленты ──────────────────
   `serverStepState` (`applicationStages.ts`) сравнивает статус заявки с этими
   строками поимённо: 'contracted'/'disbursed' → шаг пройден, 'expired'/
   'abandoned' → у мёртвой заявки текущего шага нет, 'declined' → сбой.
   'declined' и 'disbursed' уже утверждены выше; ниже — три недостающие.
   Переименует модуль любую из них — без этих строк сборка останется зелёной,
   а на экране строка индекса молча станет «поточний крок»: ровно тот класс
   отказа, ради которого файл и заведён. */
export type _app_status_contracted = Assert<Includes<CreditApplicationStatus, 'contracted'>>
export type _app_status_expired = Assert<Includes<CreditApplicationStatus, 'expired'>>
export type _app_status_abandoned = Assert<Includes<CreditApplicationStatus, 'abandoned'>>

/* ─── Излишек возврата и указатель на заменённое решение ───────────────
   Оба поля объявлены БЕЗ `?:`, чтобы каждая фикстура и каждый новый читатель
   назвали значение. Что сломается, если вернуть `?:`: фикстура без поля снова
   соберётся, а карточка кредита на отстающем модуле станет прятать излишек
   как «излишка нет» — без единого слова компилятора. `Has` здесь бесполезен:
   необязательное поле он тоже засчитывает.
   Стерегут ЛОКАЛЬНЫЙ тип, не контракт (см. шапку про `Has` у этапа заявки):
   у `supersedes_decision_id` required строже контракта намеренно — модуль
   кладёт ключ всегда. Третья строка стережёт `null`: без него «ничего не
   заменяло» некуда положить, и фикстуры начали бы выдумывать id. */
export type _loan_excess_required = Assert<
  IsRequired<CreditLoanDetail, 'advance_refund_excess_minor'>
>
export type _decision_supersedes_required = Assert<
  IsRequired<CreditDecision, 'supersedes_decision_id'>
>
export type _decision_supersedes_nullable = Assert<
  null extends CreditDecision['supersedes_decision_id'] ? true : false
>

/* ─── Признак «содержимое откроется» у документа ───────────────────────
   Кнопка документа читает его ДО нажатия: `false` — по записям модуля
   выдавать нечего, и кнопка говорит это вместо запроса. Что сломается, если
   поле станет необязательным или пропадёт: кнопка перестанет заранее говорить
   «не откроется», а фикстуры забудут значение молча — компилятор промолчит.
   Стережёт ЛОКАЛЬНЫЙ тип, не контракт (см. шапку про `Has` у этапа заявки):
   в контракте поле не required, здесь required намеренно — модуль кладёт
   ключ всегда. */
export type _document_content_available_required = Assert<
  IsRequired<CreditDocumentMeta, 'content_available'>
>
