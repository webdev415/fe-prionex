/**
 * Блок «Кредит (наш)» в карточке клиента CRM — класс А границы видимости.
 *
 * (а) ПОЧЕМУ НЕ `LoanCard` карточки клиента. Та карточка построена под
 * КУПЛЕННЫЙ долг: продавец, дата покупки, юридическое имя продавца, цепочка
 * факторинга, коридор выкупа, признак «подлежит возврату». У кредита, который
 * мы выдали сами, продавца нет по определению — половина карточки была бы
 * пустой, а вторая подписана чужими словами. Плюс список долгов делит строки
 * по `status === 'closed'`, а у модуля двенадцать статусов, и `charged_off`
 * со `written_off` попали бы в «открытые».
 *
 * (б) 🔴 ДОЛГ ВИДЕН ОПЕРАТОРУ ВСЕГДА. Строка кредитного модуля убрана из
 * «Позики» и из всех действий взыскания, поэтому единственное место, где
 * человек может её увидеть, — этот блок. Значит при ЛЮБОМ состоянии, кроме
 * «дверь ответила 200 с этим кредитом», блок показывает то, что у карточки уже
 * есть, — проекцию `debts`, и над ней плашку, объясняющую, ПОЧЕМУ данных
 * модуля нет. Раньше проекция показывалась только на 403, и при 401, 404, 5xx,
 * сетевом отказе и пустом ответе долг пропадал с экрана целиком.
 *
 * (в) ПОЧЕМУ 404 — СОСТОЯНИЕ, А НЕ ОШИБКА. Пока у шлюза нет группы `clients`,
 * 404 приходит от ШЛЮЗА, а не от модуля: это «блока здесь ещё нет», а не
 * «авария у клиента». Красная полоса с технической строкой в карточке
 * должника читается оператором как поломка того человека, которому он сейчас
 * звонит. Поэтому все плашки нейтральные: без `role="alert"`, без
 * `console.error` и без повторов. Но состояния РАЗЛИЧЕНЫ: истёкший пропуск,
 * отсутствие прав, отсутствие модуля и временный сбой требуют разных действий
 * человека, и один текст на четверых — ложный диагноз.
 *
 * (г) ПОЧЕМУ `as_of` СТОИТ РЯДОМ С ДЕНЬГАМИ. Пометка «станом на» относится к
 * числам; оторванная от них в подвал мелким шрифтом, она не читается, и
 * оператор называет человеку сумму вчерашнего дня как сегодняшнюю.
 *
 * (д) ПРАВИЛО `return_pending`. Деньги по состоявшемуся отказу ещё не
 * вернулись — и нулевой баланс с заполненной датой закрытия значит «долга по
 * договору нет», а не «человек ничего не должен». Такой кредит НЕ называется
 * погашенным: это неправда, за которую оператор извинится перед человеком.
 *
 * (е) ВРЕМЯ — В ЗОНЕ ЮРИСДИКЦИИ КРЕДИТА. Поля-моменты — зачисление
 * (`disbursed_at`), закрытие (`closed_at`), отказ (`cancelled_at`), передача
 * дефолта в бюро (`default_reported_at`) и обновление проекции
 * (`lifecycle_updated_at`) — приходят метками UTC, а дата у них календарная:
 * `2026-09-21T23:10:00Z` — это 21 сентября в Лондоне и 22-е в Киеве. Печатать
 * их в зоне браузера значит показывать оператору день, о котором он будет
 * спорить с клиентом. Даты БЕЗ времени — `as_of`, `maturity_date`,
 * `closed_through` и срок ближайшего платежа — остаются календарными как есть.
 * Третьего списка нет: каждое поле отнесено к одному из двух.
 *
 * Действий у блока нет ни одного: остановка начислений, пролонгация,
 * реструктуризация и сторно — класс Б, они живут по ссылке в модуле. Кнопка
 * здесь означала бы, что кредитом владеет CRM, а она им не владеет.
 */
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { PERMISSIONS } from '@/constants/permissions'
import { useHasPermission } from '@/hooks/usePermissions'
import { CreditApiError } from '@/features/credit/api/creditApi'
import { formatCreditMoney } from '@/features/credit/api/money'
import { useClientCreditLoans } from '@/features/credit/hooks/useCredit'
import type { ClientLoanCard } from '@/features/credit/api/types'
import type { DebtDetail } from '@/features/clients/api/types'
import { formatDate, formatDateTime } from '@/lib/formatters'
import { jurisdictionTimeZone, noticeKeyForStatus } from '@/features/credit/api/clientBlockRules'

type Props = {
  clientId: number
  /** Строки `debts` с `origin='credit_module'` — их показывает фолбэк. */
  projections: DebtDetail[]
  /** Запрос разрешён: id валиден (вкладку и флаг проверяет карточка). */
  enabled: boolean
}

/** Значение без времени — календарная дата: `2026-08-14`. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Момент времени — днём и часом ТОЙ юрисдикции, а не зоны браузера.
 *
 * Значение без времени печатается календарно и не получает выдуманного часа:
 * `2026-08-14` — это день, а не полночь UTC, и «03:00» рядом с ним было бы
 * сочинением. Поле может прийти в обоих видах (контракт объявляет часть дат
 * как `date`, а модуль отдаёт часть из них меткой), и решать по значению
 * честнее, чем по имени поля.
 */
function formatMoment(value: string | null | undefined, jurisdiction?: string | null): string {
  if (!value) return '—'
  if (DATE_ONLY.test(value)) return formatDate(value)
  return formatDateTime(value, jurisdictionTimeZone(jurisdiction))
}

/** Подпись и значение одной строкой — форма всех полей блока. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-7 items-center gap-2">
      <span className="text-muted-foreground flex-1 text-xs leading-[140%] font-light">
        {label}
      </span>
      <span className="text-foreground flex-1 text-right text-xs leading-[140%] font-medium">
        {children}
      </span>
    </div>
  )
}

/** Нейтральное сообщение: ни красного, ни `role="alert"`. */
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border bg-card text-muted-foreground w-full rounded-xl border p-4 text-sm">
      {children}
    </div>
  )
}

/**
 * Строки проекции `debts` — то, что у карточки есть и без модуля.
 *
 * Показываются при любом состоянии, кроме живого ответа с кредитами: данные
 * заведомо неполные и несвежие, поэтому каждая строка несёт день среза и
 * пометку «полные данные — по праву». Ссылки в модуль здесь нет: её рисует
 * только живая карточка, и только тому, у кого есть право.
 */
function ProjectionRows({ rows }: { rows: DebtDetail[] }) {
  const { t } = useTranslation('common')
  return (
    <div className="flex w-full flex-col gap-3">
      {rows.map((debt) => (
        <div key={debt.id} className="border-border bg-card rounded-xl border p-4">
          <div className="text-foreground mb-2 text-sm font-semibold">{debt.contract_number}</div>
          <Field label={t('credit.clientBlock.issued')}>
            {debt.original_debt_amount} {debt.currency ?? '—'}
          </Field>
          <Field label={t('credit.clientBlock.outstanding')}>
            {debt.remaining_debt_amount} {debt.currency ?? '—'}
          </Field>
          <Field label={t('credit.clientBlock.dpd')}>{debt.days_past_due ?? 0}</Field>
          <Field label={t('credit.clientBlock.status')}>
            {debt.status}
            {debt.lifecycle_detail ? ` · ${debt.lifecycle_detail}` : ''}
          </Field>
          <div className="text-muted-foreground mt-2 text-xs">
            <em>
              {t('credit.clientBlock.projectionAsOf')} {formatMoment(debt.lifecycle_updated_at)}
            </em>
          </div>
          <div className="text-muted-foreground text-xs">
            <em>{t('credit.clientBlock.projectionOnly')}</em>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Плашка состояния плюс проекция под ней.
 *
 * Пары «объяснение + то, что всё-таки известно» не было в первой редакции, и
 * оператор на любом состоянии, кроме 403, терял долг целиком.
 */
function NoticeWithProjections({ noticeKey, rows }: { noticeKey: string; rows: DebtDetail[] }) {
  const { t } = useTranslation('common')
  return (
    <div className="flex w-full flex-col gap-3">
      <Notice>{t(noticeKey)}</Notice>
      {rows.length > 0 && <ProjectionRows rows={rows} />}
    </div>
  )
}

/** Карточка одного кредита — ровно класс А, в порядке §3А рекомендации. */
function LoanCardA({ loan, canOpenModule }: { loan: ClientLoanCard; canOpenModule: boolean }) {
  const { t } = useTranslation('common')
  // Погашенным кредит выглядит по нулевому остатку и дате закрытия — но при
  // незакрытом возврате этого сказать нельзя (см. (д) в шапке файла).
  const looksRepaid = loan.balance_total_minor === 0 && loan.closed_at !== null

  return (
    <div className="border-border bg-card flex w-full flex-col gap-2 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-foreground text-sm font-semibold">{loan.contract_number}</span>
        <span className="flex items-center gap-2">
          <span className="text-foreground text-xs font-medium">
            {t(`credit.loanStatus.${loan.status}`, loan.status)}
          </span>
          {loan.return_pending ? (
            <span className="border-border text-foreground rounded-full border px-2 py-0.5 text-xs">
              {t('credit.clientBlock.returnPending')}
            </span>
          ) : (
            looksRepaid &&
            loan.close_reason !== null && (
              <span className="border-border text-foreground rounded-full border px-2 py-0.5 text-xs">
                {t(`credit.closeReason.${loan.close_reason}`, loan.close_reason)}
              </span>
            )
          )}
        </span>
      </div>

      <Field label={t('credit.clientBlock.product')}>{loan.product_code}</Field>
      <Field label={t('credit.clientBlock.jurisdiction')}>{loan.jurisdiction}</Field>

      <Field label={t('credit.clientBlock.issued')}>
        {formatCreditMoney(loan.principal_minor, loan.currency)}
      </Field>
      <Field label={t('credit.clientBlock.outstanding')}>
        {formatCreditMoney(loan.balance_total_minor, loan.currency)}
      </Field>
      <Field label={t('credit.clientBlock.paid')}>
        {formatCreditMoney(loan.paid_minor, loan.currency)}
      </Field>
      <Field label={t('credit.clientBlock.overdue')}>
        {formatCreditMoney(loan.overdue_minor, loan.currency)}
      </Field>
      {/* Пометка «станом на» стоит ЗДЕСЬ, рядом с числами, а не в подвале. */}
      <div className="text-muted-foreground text-xs">
        {t('credit.card.asOf', { date: formatDate(loan.as_of) })}
      </div>
      {loan.closed_through && (
        <div className="text-muted-foreground text-xs">
          {t('credit.clientBlock.closedThrough')} {formatDate(loan.closed_through)}
        </div>
      )}

      <Field label={t('credit.clientBlock.dpd')}>{loan.delinquency_days}</Field>
      <Field label={t('credit.clientBlock.arrears')}>
        {loan.arrears_flag ? t('common.yes') : t('common.no')}
      </Field>
      <Field label={t('credit.clientBlock.noContact')}>
        {loan.no_contact_flag ? t('common.yes') : t('common.no')}
      </Field>
      <Field label={t('credit.clientBlock.defaultReported')}>
        {formatMoment(loan.default_reported_at, loan.jurisdiction)}
      </Field>

      <Field label={t('credit.clientBlock.disbursed')}>
        {formatMoment(loan.disbursed_at, loan.jurisdiction)}
      </Field>
      <Field label={t('credit.clientBlock.maturity')}>{formatDate(loan.maturity_date)}</Field>
      <Field label={t('credit.clientBlock.nextPayment')}>
        {loan.next_payment
          ? `${formatDate(loan.next_payment.due_date)} · ${formatCreditMoney(
              loan.next_payment.amount_minor,
              loan.currency
            )}`
          : '—'}
      </Field>
      <Field label={t('credit.clientBlock.closed')}>
        {formatMoment(loan.closed_at, loan.jurisdiction)}
      </Field>
      <Field label={t('credit.clientBlock.cancelled')}>
        {formatMoment(loan.cancelled_at, loan.jurisdiction)}
      </Field>

      {canOpenModule && loan.module_url && (
        <Link
          to={loan.module_url}
          className="text-primary-700 hover:text-primary-600 mt-1 text-xs hover:underline"
        >
          {t('credit.clientBlock.openInModule')}
        </Link>
      )}
    </div>
  )
}

export function ClientCreditBlock({ clientId, projections, enabled }: Props) {
  const { t } = useTranslation('common')
  // Локальное право решает РОВНО ОДНО: рисовать ли ссылку в модуль. Состав
  // блока выбирается по ОТВЕТУ двери: права в пропуске CRM и права, которые
  // модуль прочитает у CRM, — два разных замера, и расходиться они могут.
  const canRead = useHasPermission(PERMISSIONS.CREDIT.LOANS_VIEW)
  const { data, isPending, isPaused, error } = useClientCreditLoans(clientId, enabled)

  const status = error instanceof CreditApiError ? error.status : undefined

  const body = (() => {
    // Любой отказ: объясняем причину и показываем то, что известно из CRM.
    if (error) {
      return <NoticeWithProjections noticeKey={noticeKeyForStatus(status)} rows={projections} />
    }

    // 🔴 ЗАПРОС ПРИОСТАНОВЛЕН — это не «кредитов нет».
    //
    // Без сети запрос уходит в `paused`: ошибки нет, данных нет, ответа не
    // было вовсе. Прежняя проверка спрашивала `isLoading`, а он у react-query
    // означает «ждём ОТВЕТ прямо сейчас» (`isPending && isFetching`) и на
    // приостановленном запросе ложен — блок проваливался в ветку «200 с
    // пустым списком» и уверенно сообщал, что кредитов нет. Для оператора за
    // туннелем обрыв связи — обычное дело, а не экзотика.
    if (isPaused) {
      return (
        <NoticeWithProjections noticeKey="credit.clientBlock.temporaryFailure" rows={projections} />
      )
    }

    // Ответа ещё нет (запрос идёт либо не отправлялся — невалидный id). Сказать
    // о долге нечего, и молчать честнее, чем отрицать.
    if (isPending) {
      return (
        <div
          aria-busy="true"
          data-testid="client-credit-block-loading"
          className="border-border bg-card h-24 w-full animate-pulse rounded-xl border"
        />
      )
    }

    const items = data?.items ?? []
    if (items.length === 0) {
      // Дверь ответила «кредитов нет», а проекция в CRM есть — это расхождение
      // связи, а не отсутствие кредита. Сказать здесь «кредитів немає» значило
      // бы уверенно отрицать долг, который CRM сама же и хранит.
      if (projections.length > 0) {
        return (
          <NoticeWithProjections noticeKey="credit.clientBlock.linkNotFound" rows={projections} />
        )
      }
      // Пусто и там и там — норма: договор подписан, кредит ещё не создан.
      return <Notice>{t('credit.clientBlock.noLoans')}</Notice>
    }

    return (
      <div className="flex w-full flex-col gap-3">
        {items.map((loan) => (
          <LoanCardA key={loan.loan_id} loan={loan} canOpenModule={canRead} />
        ))}
      </div>
    )
  })()

  return (
    <div className="flex w-full flex-col gap-3 p-3 md:p-4">
      <h3 className="text-foreground text-sm font-semibold">{t('credit.clientBlock.title')}</h3>
      {body}
    </div>
  )
}

export default ClientCreditBlock
