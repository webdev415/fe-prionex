/**
 * Карточка кредита: паспорт, балансы, график, платежи, журнал проводок.
 *
 * Все цифры берутся из состояния ядра (`/loans/{id}/state`) — того же среза,
 * что видит клиент в личном кабинете. Фронт ничего не пересчитывает: любая
 * «своя» арифметика здесь означала бы вторую версию правды.
 *
 * Три состояния на каждой вкладке — загрузка / ошибка / действительно пусто.
 * Раньше упавший запрос показывался как «Графіка ще немає», и оператор говорил
 * клиенту «у вас немає графіка», когда график был.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { Icons } from '@/lib/icons'
import { formatDate, formatDateTime } from '@/lib/formatters'
import {
  useCreditApplication,
  useCreditLoan,
  useCreditLoanJournal,
  useCreditLoanSchedule,
  useCreditLoanState,
} from '@/features/credit/hooks/useCredit'
import { formatCreditMoney } from '@/features/credit/api/money'
import { normalizeDraft } from '@/features/credit/api/draft'
import type {
  CreditBalances,
  CreditJournalEntry,
  CreditLoanDetail as LoanDetail,
  CreditLoanState,
  CreditPayment,
  CreditScheduleVersion,
} from '@/features/credit/api/types'
import { CreditStatusBadge } from './components/CreditStatusBadge'
import {
  CreditCardHeader,
  CreditNotice,
  type CreditHeaderMetric,
} from './components/CreditCardHeader'

/** Часовой пояс кредита: окно отказа регуляторное, показывать его надо
 *  в зоне юрисдикции, иначе киевский оператор увидит чужие сутки. */
const JURISDICTION_TIMEZONE: Record<string, string> = {
  'CA-AB': 'America/Edmonton',
  'CA-ON': 'America/Toronto',
  'CA-BC': 'America/Vancouver',
}

const money = formatCreditMoney

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground w-56 shrink-0">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  )
}

function Panel({
  title,
  children,
  footer,
}: {
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <section className="border-border bg-card mb-4 rounded-xl border shadow-sm">
      <h2 className="border-border flex min-h-[49px] items-center border-b px-4 text-sm font-semibold">
        {title}
      </h2>
      <div className="p-4">{children}</div>
      {footer && (
        <div className="border-border text-muted-foreground border-t px-4 py-2 text-xs">
          {footer}
        </div>
      )}
    </section>
  )
}

/**
 * Загрузка / ошибка / пусто — три РАЗНЫХ состояния.
 * Смешивать ошибку с пустотой нельзя: это не «данных нет», это «мы не знаем».
 */
function AsyncPanel({
  title,
  isLoading,
  error,
  isEmpty,
  emptyText,
  onRetry,
  children,
  footer,
}: {
  title: string
  isLoading: boolean
  error: unknown
  isEmpty: boolean
  emptyText: string
  onRetry: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const { t } = useTranslation('common')
  if (isLoading) {
    return (
      <Panel title={title}>
        <TableSkeleton columns={5} rows={4} />
      </Panel>
    )
  }
  if (error) {
    return (
      <Panel title={title}>
        <Alert variant="error" className="mb-3">
          {(error as Error).message || t('credit.card.loadFailed')}
        </Alert>
        <Button size="sm" variant="white-secondary" onClick={onRetry}>
          {t('credit.actions.retry')}
        </Button>
      </Panel>
    )
  }
  if (isEmpty) {
    return (
      <Panel title={title}>
        <p className="text-muted-foreground text-sm">{emptyText}</p>
      </Panel>
    )
  }
  return (
    <Panel title={title} footer={footer}>
      {children}
    </Panel>
  )
}

export function CreditLoanDetailPage() {
  const { t } = useTranslation('common')
  const { loanId } = useParams<{ loanId: string }>()
  const [tab, setTab] = useState('passport')

  const { data: loan, isLoading, error } = useCreditLoan(loanId)
  const stateQuery = useCreditLoanState(loanId)
  const scheduleQuery = useCreditLoanSchedule(loanId)
  const journalQuery = useCreditLoanJournal(loanId)
  // Кто заёмщик — знает заявка: в паспорте кредита персональных полей нет
  // вовсе. Пока сервис не отдаёт блок borrower, тянем вторым запросом.
  const applicationQuery = useCreditApplication(loan?.application_id)

  const state = stateQuery.data

  if (isLoading) {
    return <div className="text-muted-foreground p-6">{t('common.loading', 'Загрузка…')}</div>
  }
  if (error || !loan) {
    return (
      <div className="p-6">
        <Alert variant="error">{(error as Error)?.message ?? t('credit.card.notFound')}</Alert>
      </div>
    )
  }

  const tabs = [
    { id: 'passport', label: t('credit.tabs.passport') },
    { id: 'balances', label: t('credit.tabs.balances') },
    { id: 'schedule', label: t('credit.tabs.schedule') },
    { id: 'payments', label: t('credit.tabs.payments') },
    { id: 'journal', label: t('credit.tabs.journal') },
  ]

  const timezone = JURISDICTION_TIMEZONE[loan.jurisdiction]
  const borrower = applicationQuery.data
    ? normalizeDraft(applicationQuery.data.draft, applicationQuery.data.client_email)
    : null
  const nextPayment = state?.next_payment ?? loan.next_payment
  const dpd = state?.delinquency.delinquency_days ?? loan.delinquency_days
  const validationFailed = state?.flags?.validation_valid === false

  // Плитки шапки — главные цифры кредита. Порядок продиктован разговором с
  // клиентом: сколько должен → сколько уже отдал → когда следующий платёж →
  // насколько просрочен.
  const balances = state?.balances
  const metrics: CreditHeaderMetric[] = [
    {
      key: 'balance',
      label: t('credit.fields.balance'),
      value: money(balances?.total_due_minor ?? loan.balance_total_minor, loan.currency),
    },
    {
      key: 'paid',
      label: t('credit.fields.paid'),
      value: money(
        state?.paid_minor ??
          (balances ? balances.total_charged_minor - balances.total_due_minor : loan.paid_minor),
        loan.currency
      ),
    },
    {
      key: 'next',
      label: t('credit.fields.nextPayment'),
      value: nextPayment ? money(nextPayment.amount_minor, loan.currency) : '—',
      hint: nextPayment ? formatDate(nextPayment.due_date) : undefined,
    },
    {
      key: 'dpd',
      label: t('credit.fields.dpd'),
      value: String(dpd),
      hint: state?.flags?.delinquency_bucket,
      tone: dpd > 0 ? 'danger' : 'default',
    },
  ]
  if (balances && balances.overdue_minor > 0) {
    metrics.splice(1, 0, {
      key: 'overdue',
      label: t('credit.fields.overdue'),
      value: money(balances.overdue_minor, loan.currency),
      tone: 'danger',
    })
  }

  return (
    <div className="p-6">
      <CreditCardHeader
        backTo="/dashboard/credit/loans"
        backLabel={t('credit.actions.backToLoans')}
        title={t('credit.card.loanTitle', { number: loan.contract_number })}
        copyValue={loan.contract_number}
        badge={<CreditStatusBadge status={loan.status} namespace="loanStatus" />}
        subtitle={`${loan.product_code} · ${loan.jurisdiction}`}
        identity={
          borrower && (
            <>
              <Icons.UserCircle02Icon size={15} />
              <Link
                to={`/dashboard/credit/applications/${loan.application_id}`}
                className="text-foreground font-medium hover:underline"
              >
                {borrower.fullName || t('credit.card.borrowerUnknown')}
              </Link>
              {borrower.phone && <span>{borrower.phone}</span>}
              {borrower.email && <span>{borrower.email}</span>}
            </>
          )
        }
        metrics={metrics}
        notices={
          <>
            {validationFailed && (
              <Alert variant="error" className="mb-4">
                {t('credit.card.validationFailed')}
              </Alert>
            )}
            {stateQuery.error && <CreditNotice>{t('credit.card.staleFromCache')}</CreditNotice>}
            {state?.cancellation_window_until && (
              <CreditNotice>
                {t('credit.card.cancellationWindow', {
                  until: formatDateTime(state.cancellation_window_until, timezone),
                })}
              </CreditNotice>
            )}
            {state?.delinquency.no_contact_flag && (
              <Alert variant="error" className="mb-4">
                {t('credit.card.noContact')}
              </Alert>
            )}
          </>
        }
      />

      <SegmentedTabs
        items={tabs}
        value={tab}
        onChange={setTab}
        ariaLabel={t('credit.card.loanTitle', { number: loan.contract_number })}
      />

      <div className="mt-4">
        {tab === 'passport' && <LoanPassport loan={loan} state={state} />}
        {tab === 'balances' && (
          <LoanBalances
            currency={loan.currency}
            state={state}
            isLoading={stateQuery.isLoading}
            error={stateQuery.error}
            onRetry={() => void stateQuery.refetch()}
          />
        )}
        {tab === 'schedule' && (
          <LoanSchedule
            loan={loan}
            schedule={scheduleQuery.data}
            isLoading={scheduleQuery.isLoading}
            error={scheduleQuery.error}
            onRetry={() => void scheduleQuery.refetch()}
            nextDueDate={nextPayment?.due_date}
          />
        )}
        {tab === 'payments' && (
          <LoanPayments
            currency={loan.currency}
            payments={state?.payments ?? []}
            isLoading={stateQuery.isLoading}
            error={stateQuery.error}
            onRetry={() => void stateQuery.refetch()}
          />
        )}
        {tab === 'journal' && (
          <LoanJournal
            entries={journalQuery.data?.items ?? []}
            isLoading={journalQuery.isLoading}
            error={journalQuery.error}
            onRetry={() => void journalQuery.refetch()}
          />
        )}
      </div>
    </div>
  )
}

function LoanPassport({ loan, state }: { loan: LoanDetail; state?: CreditLoanState }) {
  const { t } = useTranslation('common')
  const caps = state?.caps
  const capEntries = caps ? Object.entries(caps) : []
  const failedCaps = capEntries.filter(([, ok]) => !ok)

  return (
    <>
      <Panel
        title={t('credit.card.passport')}
        footer={state ? t('credit.card.asOf', { date: formatDate(state.as_of) }) : undefined}
      >
        <Field label={t('credit.fields.product')}>
          {loan.product_code} · {loan.product_version}
        </Field>
        <Field label={t('credit.fields.jurisdiction')}>{loan.jurisdiction}</Field>
        <Field label={t('credit.fields.disbursedAt')}>{formatDateTime(loan.disbursed_at)}</Field>
        {/* «Кінцевий строк», а не «Дата погашення»: последнее оператор читает
            как ближайший платёж — тот теперь в шапке отдельной строкой. */}
        <Field label={t('credit.fields.maturity')}>{formatDate(loan.maturity_date)}</Field>
        <Field label={t('credit.fields.principal')}>
          {money(loan.principal_minor, loan.currency)}
        </Field>
        <Field label={t('credit.fields.scheduleVersion')}>{loan.schedule_version}</Field>
        {loan.close_reason && (
          <Field label={t('credit.fields.closeReason')}>
            {t(`credit.closeReason.${loan.close_reason}`, loan.close_reason)}
          </Field>
        )}
      </Panel>

      {caps && (
        <Panel
          title={t('credit.card.regulatory')}
          footer={
            state?.regulatory_package_version
              ? t('credit.card.regulatoryPackage', { version: state.regulatory_package_version })
              : undefined
          }
        >
          {failedCaps.length === 0 ? (
            <p className="text-success-700 text-sm">
              {t('credit.card.capsAllPassed', { count: capEntries.length })}
            </p>
          ) : (
            <>
              <Alert variant="error" className="mb-3">
                {t('credit.card.capsFailed', { count: failedCaps.length })}
              </Alert>
              <ul className="text-error-700 list-inside list-disc text-sm">
                {failedCaps.map(([name]) => (
                  <li key={name}>{t(`credit.caps.${name}`, name)}</li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      )}

      <Panel title={t('credit.card.links')}>
        <Field label={t('credit.fields.application')}>
          <Link
            to={`/dashboard/credit/applications/${loan.application_id}`}
            className="text-information-600 underline"
          >
            {t('credit.card.openApplication')}
          </Link>
        </Field>
        <Field label={t('credit.fields.clientId')}>
          {loan.client_id === null ? (
            <span className="text-muted-foreground text-xs">{t('credit.card.clientPending')}</span>
          ) : (
            <Link
              to={`/dashboard/clients/${loan.client_id}`}
              className="text-information-600 underline"
            >
              #{loan.client_id}
            </Link>
          )}
        </Field>
        <Field label={t('credit.fields.debtId')}>
          {loan.debt_id === null ? (
            <span className="text-muted-foreground text-xs">
              {t('credit.card.projectionPending')}
            </span>
          ) : (
            `#${loan.debt_id}`
          )}
        </Field>
      </Panel>
    </>
  )
}

/** Строки разбивки: (ключ перевода, осталось, начислено). */
const BALANCE_ROWS: Array<[string, keyof CreditBalances, keyof CreditBalances]> = [
  ['principal', 'principal_minor', 'principal_charged_minor'],
  ['interest', 'interest_minor', 'interest_charged_minor'],
  ['fee', 'fee_minor', 'fee_charged_minor'],
  ['commission', 'commission_minor', 'commission_charged_minor'],
  ['penalty', 'penalty_minor', 'penalty_charged_minor'],
  ['fine', 'fine_minor', 'fine_charged_minor'],
]

function LoanBalances({
  currency,
  state,
  isLoading,
  error,
  onRetry,
}: {
  currency: string
  state?: CreditLoanState
  isLoading: boolean
  error: unknown
  onRetry: () => void
}) {
  const { t } = useTranslation('common')
  const b = state?.balances

  return (
    <AsyncPanel
      title={t('credit.card.balances')}
      isLoading={isLoading}
      error={error}
      isEmpty={!b}
      emptyText={t('credit.card.noBalances')}
      onRetry={onRetry}
      footer={state ? t('credit.card.asOf', { date: formatDate(state.as_of) }) : undefined}
    >
      {b && (
        <>
          <div className="mb-4 flex flex-wrap gap-6">
            <div>
              <div className="text-muted-foreground text-xs">{t('credit.fields.overdue')}</div>
              <div
                className={`text-xl font-semibold tabular-nums ${b.overdue_minor > 0 ? 'text-error-700' : ''}`}
              >
                {money(b.overdue_minor, currency)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">{t('credit.fields.totalDue')}</div>
              <div className="text-xl font-semibold tabular-nums">
                {money(b.total_due_minor, currency)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">{t('credit.fields.paid')}</div>
              <div className="text-xl font-semibold tabular-nums">
                {money(state?.paid_minor ?? b.total_charged_minor - b.total_due_minor, currency)}
              </div>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-xs">
                <th className="py-2 text-left font-medium">{t('credit.columns.component')}</th>
                <th className="py-2 text-right font-medium">{t('credit.columns.due')}</th>
                <th className="py-2 text-right font-medium">{t('credit.columns.charged')}</th>
              </tr>
            </thead>
            <tbody>
              {BALANCE_ROWS.filter(([, due, charged]) => b[due] !== 0 || b[charged] !== 0).map(
                ([key, due, charged]) => (
                  <tr key={key} className="border-border border-b last:border-0">
                    <td className="py-2">{t(`credit.bucket.${key}`, key)}</td>
                    <td className="py-2 text-right tabular-nums">{money(b[due], currency)}</td>
                    <td className="text-muted-foreground py-2 text-right tabular-nums">
                      {money(b[charged], currency)}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>

          {(b.overpayment_minor > 0 || b.default_interest_minor > 0 || b.nsf_fees_minor > 0) && (
            <div className="mt-3 space-y-1 text-sm">
              {b.overpayment_minor > 0 && (
                <Field label={t('credit.bucket.overpayment')}>
                  {money(b.overpayment_minor, currency)}
                </Field>
              )}
              {b.default_interest_minor > 0 && (
                <Field label={t('credit.fields.defaultInterest')}>
                  {money(b.default_interest_minor, currency)}
                </Field>
              )}
              {b.nsf_fees_minor > 0 && (
                <Field label={t('credit.fields.nsfFees')}>
                  {money(b.nsf_fees_minor, currency)}
                </Field>
              )}
            </div>
          )}
        </>
      )}
    </AsyncPanel>
  )
}

function LoanSchedule({
  loan,
  schedule,
  isLoading,
  error,
  onRetry,
  nextDueDate,
}: {
  loan: LoanDetail
  schedule?: CreditScheduleVersion
  isLoading: boolean
  error: unknown
  onRetry: () => void
  nextDueDate?: string
}) {
  const { t } = useTranslation('common')
  const items = schedule?.items ?? []
  // Колонку процентов показываем, только если они где-то ненулевые: у payday
  // проценты всегда 0, и пустой столбец — шум, а не информация.
  const hasInterest = items.some((item) => (item.interest_minor ?? 0) !== 0)
  const totals = items.reduce(
    (acc, item) => ({
      principal: acc.principal + (item.principal_minor ?? 0),
      cost: acc.cost + (item.interest_minor ?? 0) + (item.fee_minor ?? 0),
      total: acc.total + item.total_minor,
    }),
    { principal: 0, cost: 0, total: 0 }
  )

  return (
    <AsyncPanel
      title={t('credit.card.scheduleVersion', {
        version: schedule?.version ?? loan.schedule_version,
      })}
      isLoading={isLoading}
      error={error}
      isEmpty={items.length === 0}
      emptyText={t('credit.card.noSchedule')}
      onRetry={onRetry}
      footer={
        schedule
          ? t('credit.card.scheduleEffective', {
              date: formatDate(schedule.effective_date),
              reason: t(`credit.scheduleReason.${schedule.reason}`, schedule.reason),
            })
          : undefined
      }
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-xs">
            <th className="py-2 text-left font-medium">#</th>
            <th className="py-2 text-left font-medium">{t('credit.columns.dueDate')}</th>
            <th className="py-2 text-right font-medium">{t('credit.columns.principal')}</th>
            {hasInterest && (
              <th className="py-2 text-right font-medium">{t('credit.columns.interest')}</th>
            )}
            <th className="py-2 text-right font-medium">
              {hasInterest ? t('credit.columns.fee') : t('credit.columns.cost')}
            </th>
            <th className="py-2 text-right font-medium">{t('credit.columns.total')}</th>
            <th className="px-3 py-2 text-right font-medium">{t('credit.columns.balanceAfter')}</th>
            <th className="py-2 text-left font-medium">{t('credit.columns.status')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.seq}
              className={`border-border border-b last:border-0 ${
                item.due_date === nextDueDate ? 'bg-secondary-100' : ''
              }`}
            >
              <td className="py-2">{item.seq}</td>
              <td className="py-2">{formatDate(item.due_date)}</td>
              <td className="py-2 text-right tabular-nums">{money(item.principal_minor)}</td>
              {hasInterest && (
                <td className="py-2 text-right tabular-nums">{money(item.interest_minor)}</td>
              )}
              <td className="py-2 text-right tabular-nums">
                {money(
                  hasInterest ? item.fee_minor : (item.interest_minor ?? 0) + (item.fee_minor ?? 0)
                )}
              </td>
              <td className="py-2 text-right font-medium tabular-nums">
                {money(item.total_minor)}
              </td>
              <td className="text-muted-foreground px-3 py-2 text-right tabular-nums">
                {money(item.balance_after_minor)}
              </td>
              <td className="py-2">
                {item.status && (
                  <CreditStatusBadge status={item.status} namespace="scheduleStatus" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-border border-t font-medium">
            <td className="py-2" colSpan={2}>
              {t('credit.columns.totalRow')}
            </td>
            <td className="py-2 text-right tabular-nums">{money(totals.principal)}</td>
            {hasInterest && <td />}
            <td className="py-2 text-right tabular-nums">{money(totals.cost)}</td>
            <td className="py-2 text-right tabular-nums">{money(totals.total, loan.currency)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </AsyncPanel>
  )
}

function LoanPayments({
  currency,
  payments,
  isLoading,
  error,
  onRetry,
}: {
  currency: string
  payments: CreditPayment[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
}) {
  const { t } = useTranslation('common')
  return (
    <AsyncPanel
      title={t('credit.card.payments')}
      isLoading={isLoading}
      error={error}
      isEmpty={payments.length === 0}
      emptyText={t('credit.card.noPayments')}
      onRetry={onRetry}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-xs">
            <th className="py-2 text-left font-medium">{t('credit.columns.date')}</th>
            <th className="py-2 text-right font-medium">{t('credit.columns.amount')}</th>
            <th className="py-2 text-left font-medium">{t('credit.columns.allocation')}</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.payment_id} className="border-border border-b last:border-0">
              <td className="py-2">{formatDate(payment.effective_date)}</td>
              <td className="py-2 text-right tabular-nums">
                {money(payment.amount_minor, currency)}
              </td>
              <td className="text-muted-foreground py-2 text-xs">
                {payment.allocation?.length
                  ? payment.allocation
                      .map(
                        (part) =>
                          `${t(`credit.bucket.${part.bucket}`, part.bucket)} ${money(part.amount_minor)}`
                      )
                      .join(' · ')
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AsyncPanel>
  )
}

function LoanJournal({
  entries,
  isLoading,
  error,
  onRetry,
}: {
  entries: CreditJournalEntry[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
}) {
  const { t } = useTranslation('common')
  const [expanded, setExpanded] = useState(false)
  const PAGE = 60
  // Порядок задаём явно: полагаться на порядок ответа — значит молча
  // перепутать проводки, когда сервис сменит сортировку.
  const ordered = [...entries].sort(
    (a, b) => b.business_date.localeCompare(a.business_date) || b.seq - a.seq
  )
  const visible = expanded ? ordered : ordered.slice(0, PAGE)
  const reversed = new Set(ordered.map((e) => e.reversal_of_entry_id).filter(Boolean) as string[])

  return (
    <AsyncPanel
      title={t('credit.tabs.journal')}
      isLoading={isLoading}
      error={error}
      isEmpty={entries.length === 0}
      emptyText={t('credit.card.noJournal')}
      onRetry={onRetry}
      footer={
        ordered.length > PAGE
          ? t('credit.card.journalShown', { shown: visible.length, total: ordered.length })
          : undefined
      }
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-xs">
            <th className="py-2 text-left font-medium">{t('credit.columns.date')}</th>
            <th className="py-2 text-left font-medium">{t('credit.columns.entryType')}</th>
            <th className="py-2 text-left font-medium">{t('credit.columns.bucket')}</th>
            <th className="py-2 text-right font-medium">{t('credit.columns.installment')}</th>
            <th className="py-2 text-right font-medium">{t('credit.columns.amount')}</th>
            <th className="py-2 text-left font-medium">{t('credit.columns.rule')}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((entry) => {
            const isReversed = reversed.has(entry.entry_id)
            const isReversal = Boolean(entry.reversal_of_entry_id)
            return (
              <tr
                key={entry.entry_id}
                className={`border-border border-b last:border-0 ${
                  isReversed ? 'text-muted-foreground line-through' : ''
                }`}
              >
                <td className="py-2">{formatDate(entry.business_date)}</td>
                <td className="py-2">
                  {t(`credit.entryType.${entry.entry_type}`, entry.entry_type)}
                  {isReversal && (
                    <span className="text-muted-foreground ml-1 text-xs">
                      {t('credit.card.isReversal')}
                    </span>
                  )}
                </td>
                <td className="py-2">{t(`credit.bucket.${entry.bucket}`, entry.bucket)}</td>
                <td className="text-muted-foreground py-2 text-right tabular-nums">
                  {entry.installment_seq ?? '—'}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {money(entry.amount_minor, entry.currency)}
                </td>
                <td className="text-muted-foreground py-2 text-xs">{entry.rule_id ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {ordered.length > PAGE && !expanded && (
        <div className="mt-3">
          <Button size="sm" variant="white-secondary" onClick={() => setExpanded(true)}>
            {t('credit.actions.showMore')}
          </Button>
        </div>
      )}
    </AsyncPanel>
  )
}

export default CreditLoanDetailPage
