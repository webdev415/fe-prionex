/**
 * Путь заявки по этапам — ЗЕРКАЛО расчёта из личного кабинета клиента.
 *
 * ОРИГИНАЛ (источник правды, снят 01.09.2026):
 *   web-credit/apps/cabinet/src/components/ApplicationCard.tsx
 *   → константа `STEPS` и функция `stepStates`.
 * Локально: /home/PYCHARMPRODJECT/CEO-Prionex/web-credit/apps/cabinet/src/
 *           components/ApplicationCard.tsx
 * В Forgejo: CRM/web-credit, ветка `main`.
 *
 * ЗАЧЕМ ЗЕРКАЛО, А НЕ СВОЯ НУМЕРАЦИЯ. Клиент в кабинете видит пять шагов и
 * говорит оператору «я на третьем». Если оператор считает этапы по-своему,
 * «одна сущность» разваливается на первом же разговоре: клиент называет один
 * номер, оператор видит другой, и спорить они будут о нумерации, а не о деле.
 * Ровно поэтому `api/idle.ts` в своё время отказался изобретать ленту этапов
 * («своя нумерация гарантированно разъедется с чужой») — теперь изобретать и
 * не нужно, нумерация уже есть, и она клиентская.
 *
 * ЗАЧЕМ КОПИЯ, А НЕ ОБЩИЙ ПАКЕТ. `fe-prionex` (CRM) и `web-credit` (сайт и
 * кабинет) — РАЗНЫЕ репозитории в Forgejo, с разными сборками (Vite+React
 * против Next.js в pnpm-монорепо) и без единого реестра пакетов между ними.
 * Общего места, куда положить эту функцию, сегодня физически нет: чтобы оно
 * появилось, нужен публикуемый npm-пакет и его выпуск в обе стороны — это
 * отдельная работа, а не строчка импорта.
 *
 * РИСК, НАЗЫВАЮ ПРЯМО: две копии разъедутся МОЛЧА. Правку в кабинете (новый
 * статус, другое правило по `missing_fields`) здесь ничто не подсветит — ни
 * сборка, ни тесты, потому что чужой репозиторий нам не виден. Единственная
 * страховка — `__tests__/applicationStages.test.ts`: ожидания в нём выписаны
 * из кода кабинета дословно, и при правке ЗДЕСЬ он краснеет. Правку ТАМ он не
 * поймает; тот, кто трогает `stepStates` в кабинете, обязан прийти сюда.
 *
 * ЧЕГО ЗДЕСЬ НЕТ: чтения `resume_step`. Кабинет считает состояние шагов
 * ТОЛЬКО из `status` и `missing_fields` — `resume_step` в расчёте не
 * участвует, хотя в ответе есть (его карточка CRM показывает отдельно, в
 * блоке «застряв на кроці»). Поле принимаем на вход, чтобы вызывающему не
 * пришлось разбирать заявку по полям, но НЕ читаем: начать читать его здесь —
 * значит тихо разойтись с кабинетом.
 */

/** Пять этапов клиента, в порядке прохождения. Нумерация = порядок в массиве. */
export const CREDIT_APPLICATION_STAGES = [
  'registration',
  'questionnaire',
  'bank',
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
 * Вход — три поля ответа модуля. Тип структурный, а не `CreditApplicationDetail`:
 * функция обязана оставаться проверяемой без сборки целой заявки, и точно так же
 * должна принимать строку списка, когда модуль начнёт отдавать в ней те же поля.
 */
export interface CreditApplicationStageInput {
  status: string
  /** Принимаем, но НЕ читаем — см. шапку файла. */
  resume_step?: string | null
  missing_fields?: string[] | null
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
