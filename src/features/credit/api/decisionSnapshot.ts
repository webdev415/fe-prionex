/**
 * Сырой снимок решения для экрана оператора — без реквизитов выплаты и сумм пособий.
 *
 * Снимок остаётся на вкладке решения свёрнутым: это доказательство DAT-02, его
 * пересылают разработчику, и в нём живут разделы, у которых панели нет. Но
 * модуль кладёт туда и то, чему на этом экране не место:
 *
 * - `ibv.payout_account` — имя и адрес держателя, номера банка, отделения и
 *   счёта. Вкладка IBV той же заявки номер счёта маскирует;
 * - `income_class_basis.amounts` и ключи `sum_*` в `ibv.risk.extra` — суммы
 *   пенсии, выплат по инвалидности, EI, соцпомощи, WSIB. Они говорят о здоровье
 *   и социальном статусе клиента, а решение по ним уже свёрнуто в признаки
 *   класса дохода, которые показывает разбор скоринга.
 *
 * Фронт убирает их с экрана, а не из ответа модуля: ответ по-прежнему их несёт.
 * Вход не мутируется — копируется только путь до убранного ключа.
 *
 * Флаг «суммы скрыты» — по значениям, а не по ключу: модуль пишет
 * `income_class_basis.amounts` в каждое решение, и без банковской проверки все
 * семь сумм там `null`. Ключ с одними `null` убирается молча — прятать было нечего.
 */

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export interface CreditSnapshotForDisplay {
  snapshot: Json
  /** Был ли в снимке счёт выплаты — для строки под сырым блоком. */
  payoutHidden: boolean
  /** Были ли в снимке суммы пособий — хоть одна не `null`. */
  amountsHidden: boolean
}

/** Копия без ключей, для которых `drop` — истина, и убранные значения; `null`, если убирать нечего. */
function without(
  source: Json,
  drop: (key: string) => boolean
): { kept: Json; dropped: unknown[] } | null {
  const keys = Object.keys(source)
  if (!keys.some(drop)) return null
  return {
    kept: Object.fromEntries(keys.filter((key) => !drop(key)).map((key) => [key, source[key]])),
    dropped: keys.filter(drop).map((key) => source[key]),
  }
}

/** Есть ли сумма: хоть одно значение не `null` (в объекте `amounts` — среди его значений). */
const carriesAmount = (value: unknown): boolean =>
  isObject(value) ? Object.values(value).some(carriesAmount) : value !== null && value !== undefined

export function snapshotForDisplay(snapshot: unknown): CreditSnapshotForDisplay {
  if (!isObject(snapshot)) return { snapshot: {}, payoutHidden: false, amountsHidden: false }
  const out: Json = { ...snapshot }
  let payoutHidden = false
  let amountsHidden = false

  if (isObject(snapshot.ibv)) {
    let ibv = snapshot.ibv
    const noPayout = without(ibv, (key) => key === 'payout_account')
    if (noPayout) {
      ibv = noPayout.kept
      payoutHidden = true
    }
    const risk = ibv.risk
    if (isObject(risk) && isObject(risk.extra)) {
      const extra = without(risk.extra, (key) => key.startsWith('sum_'))
      if (extra) {
        ibv = { ...ibv, risk: { ...risk, extra: extra.kept } }
        amountsHidden ||= extra.dropped.some(carriesAmount)
      }
    }
    out.ibv = ibv
  }

  if (isObject(snapshot.income_class_basis)) {
    const basis = without(snapshot.income_class_basis, (key) => key === 'amounts')
    if (basis) {
      out.income_class_basis = basis.kept
      amountsHidden ||= basis.dropped.some(carriesAmount)
    }
  }

  return { snapshot: out, payoutHidden, amountsHidden }
}
