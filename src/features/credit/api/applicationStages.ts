/**
 * ГДЕ СТОИТ ЗАЯВКА — ответ модуля, а не расчёт CRM.
 *
 * ИСТОЧНИК ПОЗИЦИИ. Этап, его номер и длину пути присылает модуль:
 * `stage` / `stage_index` / `stage_total` контракта `0.1.26`
 * (`Application`, `openapi.yaml:5680`/`:5690`/`:5699`; перечень имён —
 * `x-application-stages`, `:254-259`). Фронт больше не вычисляет, ГДЕ заявка;
 * он решает только «идёт / сделано / провалено» — это вопрос витрины и её
 * языка, и он решается здесь, по `stage_index` и `status`.
 *
 * ЗАЧЕМ. Раньше позицию считал сам фронт — шесть веток по `status` и
 * `missing_fields`. Правило было ВЕРНЫМ для всего, что CRM могла увидеть в тот
 * день, и именно этим опасно: модуль заводит новый статус — фронт молча
 * относит его к ветке по умолчанию, и тесты этого не ловят, потому что нового
 * статуса у них нет. Такой дефект не закрывается дисциплиной, только переносом
 * правила туда, где статус рождается. Правило живёт в модуле
 * (`credit-module/service/src/credit_service/app/stages.py`).
 *
 * ЗЕРКАЛО ОСТАЁТСЯ ФОЛБЭКОМ — и только им. `creditApplicationStageStates` и
 * `creditApplicationStages` ниже сохранены ради стендов и образов модуля,
 * которые трёх полей не присылают (вид `mirror` в `creditApplicationStageView`).
 * На ответе, где поля есть, зеркало не участвует вовсе. Своего правила вывода
 * этапа из `status`/`missing_fields` фронт больше не заводит.
 *
 * ДЕЙСТВУЮЩИЙ ОРИГИНАЛ ТОЙ ЖЕ ЗАДАЧИ — у витрины:
 * `web-credit/apps/cabinet/src/components/application-stage.ts`
 * (Forgejo `CRM/web-credit`, ветка `main`). Прежняя шапка отправляла читателя к
 * карточке заявки кабинета и её локальному расчёту этапов — этого расчёта там
 * больше нет: кабинет сам читает ответ модуля, и файла по прежней ссылке уже
 * не существует.
 *
 * 🔴 ДВЕ РЕАЛИЗАЦИИ РАЗОШЛИСЬ ПО ТРЁМ ПРАВИЛАМ, И ЭТО НАЗВАНО ВСЛУХ. Перечень
 * закрытый, и он таков:
 *   1. `stage_total` КОРОЧЕ своего перечня — витрина считает законным и рисует
 *      ленту, CRM уходит в деградированный вид;
 *   2. незнакомое имя на любой позиции — витрина рисует, CRM деградирует;
 *   3. сверки `stage_index` с позицией имени (правило 8) у витрины НЕТ ВОВСЕ:
 *      на ответе `stage: 'decision', stage_index: 2, stage_total: 5` клиент в
 *      кабинете увидит ленту и «шаг 2», а оператор — деградированный вид без
 *      ленты. Это ровно тот разговор о нумерации, ради предотвращения которого
 *      лента и заведена, и вопрос владельцу нормы открыт.
 * Общее у двух потребителей: расширение пути (`stage_total` БОЛЬШЕ перечня
 * рисуется целиком) и потолок разметки в 12 строк. Кто правит одно правило,
 * обязан прийти ко второму — иначе копии разойдутся молча.
 *
 * ЧЕГО ЗДЕСЬ НЕТ: чтения `resume_step`. Состояние шагов считается ТОЛЬКО из
 * ответа модуля (а в фолбэке — из `status` и `missing_fields`); `resume_step` в
 * расчёте не участвует, хотя в ответе есть (его карточка CRM показывает
 * отдельно, в блоке «застряв на кроці»). Поле принимаем на вход, чтобы
 * вызывающему не пришлось разбирать заявку по полям, но НЕ читаем: начать
 * читать его здесь — значит тихо разойтись с кабинетом.
 */

// `import type` — и это важно: `types.ts` тянет `enums.ts`, а `enums.ts` тянет ЭТОТ файл.
// При `verbatimModuleSyntax` типовой импорт стирается целиком, рантайм-цикла не возникает.
import type { CreditApplicationStatus } from './types'

/**
 * Пять этапов клиента, в порядке прохождения. Нумерация = порядок в массиве.
 *
 * Перечень снят с `x-application-stages` контракта модуля **`0.1.26`**
 * (`contracts/openapi.yaml:254-259`) — не с кода кабинета: локального расчёта
 * там больше нет, кабинет сам читает ответ модуля.
 *
 * ПРО ИМЯ ТРЕТЬЕГО ЭТАПА. Контракт назвал его `income_check`, а не `bank`, и
 * довод там же (`openapi.yaml:245-247`): этап проходится ДВУМЯ путями —
 * банковская связка или присланные выписки, — и клиенту, приславшему выписки,
 * нельзя показывать «банк проверен». Прежнее локальное имя `bank` пришло от
 * первой реализации, а не от довода.
 *
 * ⚠️ Слово `bank` встречается в этом файле ещё и ниже, в `mirroredStepStates`:
 * проверка префикса по `missing_fields` и переменная `bankMissing`. Там это имя
 * БЛОКА АНКЕТЫ (модуль присылает `bank_verification`), а не имя этапа, и
 * переименовать его вслед за этапом значит сломать зеркало. Поиск по одному
 * слову `bank` признаком правки поэтому не годится.
 */
export const CREDIT_APPLICATION_STAGES = [
  'registration',
  'questionnaire',
  'income_check',
  'decision',
  'signing',
] as const

export type CreditApplicationStage = (typeof CREDIT_APPLICATION_STAGES)[number]

/** Состояние этапа — те же четыре значения, что и в кабинете. */
export type CreditStageState = 'done' | 'current' | 'todo' | 'failed'

export const CREDIT_STAGE_STATES = ['done', 'current', 'todo', 'failed'] as const

export interface CreditApplicationStageStep {
  stage: CreditApplicationStage
  state: CreditStageState
  /** Номер шага, каким его называет клиент: «я на третьем». 1..5. */
  number: number
}

/**
 * Вход правил этапа. Тип СТРУКТУРНЫЙ, а не `CreditApplicationDetail`: функция
 * обязана оставаться проверяемой без сборки целой заявки, и точно так же должна
 * принимать строку списка, когда модуль начнёт отдавать в ней те же поля.
 *
 * ⚠️ Это структурный вход ПОМОЩНИКА, а НЕ проекция строки списка: объявление
 * полей этапа здесь ничего не обещает про `ApplicationSummary` (список их не
 * отдаёт — `operator.py`, `_list_row`), и запрета «не объявлять поля этапа на
 * типе строки списка» не задевает. Тип строки списка —
 * `CreditApplicationSummary` в `types.ts`, и он остаётся без изменений.
 */
export interface CreditApplicationStageInput {
  status: string
  /** Принимаем, но НЕ читаем — см. шапку файла. */
  resume_step?: string | null
  missing_fields?: string[] | null
  /**
   * Ответ модуля о том, ГДЕ стоит заявка (контракт `0.1.26`, `Application`:
   * `stage` / `stage_index` / `stage_total`). Необязательны: ни одно поле не в
   * `required`, и стенд со старым образом модуля их не пришлёт. `stage` —
   * `string`, а не `CreditApplicationStage`: union закрыт, а модуль вправе
   * прислать имя, которого у нас ещё нет. Сужение — рантаймом.
   */
  stage?: string | null
  stage_index?: number | null
  stage_total?: number | null
}

/**
 * Статусы, в которых заявку видит САМ КЛИЕНТ.
 *
 * Это не наш выбор, а список модуля: `CURRENT_APPLICATION_STATUSES` в
 * `credit-module/service/src/credit_service/app/applications.py` — только эти
 * статусы отдаёт `GET /public/applications/current`, то есть только на них
 * кабинет вообще вызывает `stepStates`. Экспортируется ради теста: именно на
 * этом наборе зеркало обязано совпадать с оригиналом дословно.
 */
export const CREDIT_CABINET_VISIBLE_STATUSES = [
  'in_progress',
  'scoring',
  'referred',
  'approved',
  'declined',
] as const

/**
 * ─────────────── НАЧАЛО ЗЕРКАЛА ───────────────
 * Дословный перенос `stepStates` из кабинета: те же условия, в том же порядке,
 * с теми же выражениями. Менять здесь что-либо, не поменяв оригинал, — значит
 * развести оператора и клиента.
 */
function mirroredStepStates(status: string, missing: string[]): CreditStageState[] {
  const st = status
  const anketaMissing = missing.some((f) => !f.startsWith('bank'))
  const bankMissing = missing.some((f) => f.startsWith('bank'))
  if (st === 'approved') return ['done', 'done', 'done', 'done', 'current']
  if (st === 'declined') return ['done', 'done', 'done', 'failed', 'todo']
  if (st === 'scoring' || st === 'referred') return ['done', 'done', 'done', 'current', 'todo']
  // in_progress / data_collection
  if (anketaMissing) return ['done', 'current', bankMissing ? 'todo' : 'done', 'todo', 'todo']
  if (bankMissing) return ['done', 'done', 'current', 'todo', 'todo']
  return ['done', 'done', 'done', 'current', 'todo']
}
/** ─────────────── КОНЕЦ ЗЕРКАЛА ─────────────── */

/**
 * Состояния пяти этапов заявки.
 *
 * За пределами зеркала — ТОЛЬКО статусы, которых кабинет не видит вовсе (см.
 * `CREDIT_CABINET_VISIBLE_STATUSES`), поэтому разойтись с клиентом здесь не на
 * чем: ни при каком статусе мы с ним не смотрим на одну заявку по-разному.
 * Обойтись без этих веток нельзя: у CRM в списке ВСЕ статусы, и на стенде
 * 01.09.2026 выданных (`disbursed`) — 23 заявки из 50, то есть общий хвост
 * кабинета («решение — текущий шаг, подписание впереди») врал бы оператору
 * чаще, чем говорил правду.
 */
export function creditApplicationStageStates(
  application: CreditApplicationStageInput
): CreditStageState[] {
  const status = application.status ?? ''
  const missing = application.missing_fields ?? []

  // Договор подписан (`contracted`) или деньги выданы (`disbursed`) — пройдены
  // все пять шагов, включая подписание. Общий хвост кабинета показал бы здесь
  // «решение — сейчас», то есть работу, которой давно нет.
  if (status === 'contracted' || status === 'disbursed') {
    return ['done', 'done', 'done', 'done', 'done']
  }

  const states = mirroredStepStates(status, missing)

  // Заявка умерла по таймауту (`expired`) или брошена (`abandoned`): дошла
  // докуда дошла, и НИКТО над ней сейчас не работает. «Текущего» шага у неё
  // быть не может — иначе оператор читает «клиент сейчас здесь» о заявке,
  // которую закрыл таймер.
  if (status === 'expired' || status === 'abandoned') {
    return states.map((state) => (state === 'current' ? 'todo' : state))
  }

  return states
}

/** То же самое, но с ключом и номером шага — форма для отрисовки. */
export function creditApplicationStages(
  application: CreditApplicationStageInput
): CreditApplicationStageStep[] {
  const states = creditApplicationStageStates(application)
  return CREDIT_APPLICATION_STAGES.map((stage, index) => ({
    stage,
    state: states[index],
    number: index + 1,
  }))
}

/**
 * ПОТОЛОК ДЛИНЫ ПУТИ. Контракт потолка не даёт: `stage_total` объявлен
 * `integer, minimum: 1` и сверху ничем не ограничен (`openapi.yaml:5699-5701`).
 * Без своего потолка ЧУЖОЙ ответ задаёт число строк: `stage_total: 100000`
 * нарисует сто тысяч элементов и положит карточку. Это не гипотеза о злом
 * умысле, а обычная цена доверия к неограниченному числу из сети.
 *
 * Двенадцать — то же число и тот же довод, что у витрины
 * (`web-credit/apps/cabinet/src/components/application-stage.ts`): вдвое больше
 * нашего перечня, с запасом на законное расширение пути.
 */
export const CREDIT_MAX_STAGE_TOTAL = 12

/** Строка ленты: имя может быть чужим или отсутствовать вовсе. */
export interface CreditStageRow {
  /** Имя этапа: наше по позиции, имя модуля на текущей позиции или ничего. */
  name?: string
  /** Знаем ли мы это имя. Решает ДОМЕН, чтобы компонент не собирал ключ сам. */
  known: boolean
  state: CreditStageState
  /** Номер шага, каким его называет клиент. 1-базовый. */
  number: number
}

/**
 * Три вида экрана — и второй с третьим различаются НЕ качеством данных, а тем,
 * можем ли мы честно нарисовать ленту.
 *
 * `mirror`   — полей нет вовсе: старый стенд, рисуем прежнее зеркало.
 * `server`   — позиция из ответа модуля, лента на `total` строк.
 * `degraded` — ответ модуля и наш перечень не сходятся: показываем ТО, ЧТО
 *              ПРИШЛО, и НЕ подставляем свою нумерацию.
 */
export type CreditStageView =
  | { kind: 'mirror'; steps: CreditApplicationStageStep[] }
  | { kind: 'server'; rows: CreditStageRow[]; index: number; total: number }
  | { kind: 'degraded'; stage?: string; known: boolean; index?: number; total?: number }

/**
 * Ключ словаря — ТОЛЬКО для имени из нашего перечня, иначе `null`.
 *
 * Ключ `credit.stage.<чужое имя>` не собирается никогда: в словаре законно
 * может оказаться ключ с таким именем, и оператор прочтёт чужую служебную
 * строку как название этапа. Тот же довод и та же форма у витрины
 * (`application-stage.ts`, `labelKeyFor`).
 */
export function creditStageLabelKey(name: string | undefined): string | null {
  if (name === undefined) return null
  const known: readonly string[] = CREDIT_APPLICATION_STAGES
  return known.includes(name) ? `credit.stage.${name}` : null
}

/**
 * Состояние строки НА ПОЗИЦИИ МОДУЛЯ — по каждому статусу поимённо.
 *
 * Таблица, а не цепочка `if` с веткой по умолчанию, и это главное здесь.
 * Ветка по умолчанию — ровно тот дефект, ради которого правило и переносили в
 * модуль: заводится новый статус, фронт молча относит его к «поточний крок», и
 * оператор читает «клиент сейчас здесь» о заявке, которую закрыл таймер.
 * `Record<CreditApplicationStatus, …>` требует ВСЕ ключи union'а: вырастет
 * перечень статусов — красный `typecheck` с именем недостающего ключа, а не
 * молчаливый `current`.
 */
const STATE_AT_MODULE_POSITION: Record<CreditApplicationStatus, CreditStageState> = {
  // Заявка идёт: на позиции модуля стоит работа.
  draft: 'current',
  in_progress: 'current',
  identity_check: 'current',
  data_collection: 'current',
  scoring: 'current',
  approved: 'current',
  referred: 'current',
  // Сорвалось.
  declined: 'failed',
  // Дошло до конца: позиция модуля уже пройдена.
  contracted: 'done',
  disbursed: 'done',
  // Никто над заявкой не работает — «текущего» шага у неё быть не может.
  expired: 'todo',
  abandoned: 'todo',
}

/**
 * Состояние строки на позиции `position` (1-базовой).
 *
 * Терминальный статус решает ЗДЕСЬ, на позиции модуля, а не на прибитом номере:
 * `failed` садится на `index`, а не на литеральную четвёртую строку — на
 * заявке, отказанной раньше, прибитый номер соврал бы.
 *
 * Статус, которого нет в таблице, — это ответ модуля новее нашего типа. Берём
 * `todo`: это менее опасная из двух неправд. «Впереди» про идущую заявку —
 * неточность; «поточний крок» про закрытую — ложь, по которой оператор звонит
 * клиенту.
 */
function serverStepState(position: number, index: number, status: string): CreditStageState {
  if (position < index) return 'done'
  if (position > index) return 'todo'
  return Object.prototype.hasOwnProperty.call(STATE_AT_MODULE_POSITION, status)
    ? STATE_AT_MODULE_POSITION[status as CreditApplicationStatus]
    : 'todo'
}

/** Лента на `total` строк по ответу модуля. */
function serverStageRows(
  status: string,
  stage: string,
  index: number,
  total: number
): CreditStageView {
  const local: readonly string[] = CREDIT_APPLICATION_STAGES
  const rows: CreditStageRow[] = Array.from({ length: total }, (_, k) => {
    const position = k + 1
    const byPosition: string | undefined = local[k]
    // Имя — по позиции; исключение одно и оно названо: на ТЕКУЩЕЙ позиции
    // показываем имя модуля, если оно не совпало с нашим. Это правда о заявке,
    // а не наша несвежесть.
    const name = position === index && stage !== byPosition ? stage : byPosition
    return {
      name,
      known: name !== undefined && local.includes(name),
      state: serverStepState(position, index, status),
      number: position,
    }
  })
  return { kind: 'server', rows, index, total }
}

/**
 * ГДЕ СТОИТ ЗАЯВКА — ответ модуля, а не догадка CRM.
 *
 * Читаем чужой ответ как `unknown`, и это не педантизм: тип объявляет
 * `stage?: string`, но пустая строка, число или отсутствие поля физически
 * возможны, и ровно от них защищает закрытый разбор ниже. `trim()`, а не просто
 * `!== ''`: строка из пробелов — то же отсутствие имени, но она прошла бы
 * проверку на пустоту и уехала на экран пустой подписью.
 *
 * ПОРЯДОК ПРОВЕРОК — ЧАСТЬ ПРАВИЛА: перестановка меняет исход (правило 5
 * снимает 6–8 для законно более длинного пути).
 */
export function creditApplicationStageView(
  application: CreditApplicationStageInput
): CreditStageView {
  const rawStage: unknown = application.stage
  const rawIndex: unknown = application.stage_index
  const rawTotal: unknown = application.stage_total
  // `status` читается так же, как остальные поля. От него зависит состояние
  // КАЖДОЙ строки, а тип «строка» — обещание контракта, а не свойство байтов:
  // при `status: 42` из сети все сравнения дали бы false и на позиции индекса
  // молча встал бы «поточний крок».
  const rawStatus: unknown = application.status
  const status = typeof rawStatus === 'string' ? rawStatus : ''

  // Имя тримится ОДИН раз, и дальше живёт только нормализованное значение —
  // и в сравнении с перечнем, и на экране. Иначе ` decision ` не признаётся
  // знакомым и уезжает оператору с видимыми пробелами по краям.
  const trimmedStage = typeof rawStage === 'string' ? rawStage.trim() : undefined
  const hasName = trimmedStage !== undefined && trimmedStage !== ''

  /**
   * «Поле пришло» — это НЕ «поле не `undefined`». Пустая строка и дробное
   * число приезжают физически, но не несут смысла, и принимать их за ответ
   * модуля значит нарисовать пустую рамку там, где до этого была лента:
   * заголовок без имени, без номера и без строк.
   */
  const meaningful = (v: unknown) => (typeof v === 'string' ? v.trim() !== '' : Number.isInteger(v))
  // (0) Ни одного осмысленного поля — это НЕ деградация, это старый стенд.
  if (![rawStage, rawIndex, rawTotal].some(meaningful)) {
    return { kind: 'mirror', steps: creditApplicationStages(application) }
  }

  const degraded = (): CreditStageView => ({
    kind: 'degraded',
    stage: hasName ? trimmedStage : undefined,
    known: hasName && (CREDIT_APPLICATION_STAGES as readonly string[]).includes(trimmedStage),
    index: Number.isInteger(rawIndex) ? (rawIndex as number) : undefined,
    total: Number.isInteger(rawTotal) ? (rawTotal as number) : undefined,
  })

  // (1) имени нет / оно не строка / оно пустое после trim()
  if (!hasName) return degraded()
  // (2) числа не целые (в том числе пришла ЧАСТЬ полей)
  if (!Number.isInteger(rawIndex) || !Number.isInteger(rawTotal)) return degraded()
  const stage = trimmedStage
  const index = rawIndex as number
  const total = rawTotal as number
  const local: readonly string[] = CREDIT_APPLICATION_STAGES

  // (3) границы: индекс 1-базовый (контракт: `minimum: 1`)
  if (index < 1 || total < 1 || index > total) return degraded()
  // (4) потолок разметки
  if (total > CREDIT_MAX_STAGE_TOTAL) return degraded()
  // (5) путь ДЛИННЕЕ нашего перечня — законное расширение: рисуем `total` строк.
  //     Проверки 6 и 7 здесь не применяются: длину и полноту перечня сверять не
  //     с чем, наш список заведомо короче присланного пути.
  //     А правило 8 действует и здесь — но только для ЗНАКОМОГО имени. Если
  //     модуль прислал наше имя на чужой позиции (`signing` шагом вторым из
  //     шести), это противоречие, а не расширение: лента нарисовала бы
  //     «Підписання» дважды — на второй строке как имя модуля и на пятой как
  //     наше по позиции, — и «поточний крок» оказался бы на второй.
  if (total > local.length) {
    if (local.includes(stage) && local.indexOf(stage) + 1 !== index) return degraded()
    return serverStageRows(status, stage, index, total)
  }
  // (6) путь КОРОЧЕ перечня — деградация.
  //     ⚠️ Витрина считает это законным (рисует `total` строк). Расхождение
  //     намеренное и названо в шапке файла.
  if (total !== local.length) return degraded()
  // (7) имя вне перечня
  if (!local.includes(stage)) return degraded()
  // (8) индекс не равен позиции имени — страж дрейфа перечней.
  //     Сегодняшний модуль такого не присылает: `stage_index` он считает как
  //     `APPLICATION_STAGES.index(stage) + 1`.
  if (local.indexOf(stage) + 1 !== index) return degraded()

  return serverStageRows(status, stage, index, total)
}
