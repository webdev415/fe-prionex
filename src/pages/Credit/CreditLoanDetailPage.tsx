/**
 * Карточка кредита: паспорт, график, журнал проводок, связи с CRM.
 *
 * Все цифры берутся из состояния ядра (`/loans/{id}/state`) — того же среза,
 * что видит клиент в личном кабинете. Фронт ничего не пересчитывает: любая
 * «своя» арифметика здесь означала бы вторую версию правды.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert } from '@/components/ui/Alert'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { Icons } from '@/lib/icons'
import { formatDate, formatDateTime } from '@/lib/formatters'
import {
  useCreditLoan,
  useCreditLoanJournal,
  useCreditLoanSchedule,
  useCreditLoanState,
} from '@/features/credit/hooks/useCredit'
import type {
  CreditLoanDetail as LoanDetail,
  CreditLoanState,
  CreditScheduleVersion,
} from '@/features/credit/api/types'
import { CreditStatusBadge } from './components/CreditStatusBadge'

function money(minor: number | null | undefined, currency?: string): string {
  if (minor === null || minor === undefined) return '—'
  const value = (minor / 100).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return currency ? `${value} ${currency}` : value
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground w-56 shrink-0">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-border bg-card mb-4 rounded-xl border shadow-sm">
      <h2 className="border-border flex min-h-[49px] items-center border-b px-4 text-sm font-semibold">
        {title}
      </h2>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function CreditLoanDetailPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const { loanId } = useParams<{ loanId: string }>()
  const [tab, setTab] = useState('passport')

  const { data: loan, isLoading, error } = useCreditLoan(loanId)
  const { data: state } = useCreditLoanState(loanId)
  const { data: schedule } = useCreditLoanSchedule(loanId)
  const { data: journal } = useCreditLoanJournal(loanId)

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
    { id: 'schedule', label: t('credit.tabs.schedule') },
    { id: 'journal', label: t('credit.tabs.journal') },
  ]

  return (
    <div className="p-6">
      <button
        type="button"
        onClick={() => navigate('/dashboard/credit/loans')}
        className="text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1.5 text-sm"
      >
        <Icons.ArrowLeft size={16} />
        {t('credit.actions.backToLoans')}
      </button>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-foreground text-xl font-semibold">
          {t('credit.card.loanTitle', { number: loan.contract_number })}
        </h1>
        <CreditStatusBadge status={loan.status} namespace="loanStatus" />
        <span className="text-muted-foreground text-sm">{loan.product_code}</span>
      </div>

      <SegmentedTabs
        items={tabs}
        value={tab}
        onChange={setTab}
        ariaLabel={t('credit.card.loanTitle', { number: loan.contract_number })}
      />

      {tab === 'passport' && <LoanPassport loan={loan} state={state} />}
      {tab === 'schedule' && <LoanSchedule loan={loan} schedule={schedule} />}
      {tab === 'journal' && <LoanJournal entries={journal?.items ?? []} />}
    </div>
  )
}

function LoanPassport({ loan, state }: { loan: LoanDetail; state?: CreditLoanState }) {
  const { t } = useTranslation('common')
  return (
    <>
      <Panel title={t('credit.card.passport')}>
        <Field label={t('credit.fields.product')}>
          {loan.product_code} · {loan.product_version}
        </Field>
        <Field label={t('credit.fields.jurisdiction')}>{loan.jurisdiction}</Field>
        <Field label={t('credit.fields.disbursedAt')}>{formatDateTime(loan.disbursed_at)}</Field>
        <Field label={t('credit.fields.maturity')}>{formatDate(loan.maturity_date)}</Field>
        <Field label={t('credit.fields.principal')}>
          {money(loan.principal_minor, loan.currency)}
        </Field>
        <Field label={t('credit.fields.balance')}>
          {money(state?.balances.total_due_minor ?? loan.balance_total_minor, loan.currency)}
        </Field>
        <Field label={t('credit.fields.dpd')}>
          {state?.delinquency.delinquency_days ?? loan.delinquency_days}
        </Field>
        <Field label={t('credit.fields.scheduleVersion')}>{loan.schedule_version}</Field>
        <Field label={t('credit.fields.prepaymentMode')}>{loan.prepayment_mode ?? '—'}</Field>
        {state && <Field label={t('credit.fields.asOf')}>{formatDate(state.as_of)}</Field>}
      </Panel>

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

function LoanSchedule({ loan, schedule }: { loan: LoanDetail; schedule?: CreditScheduleVersion }) {
  const { t } = useTranslation('common')
  const items = schedule?.items ?? []
  return (
    <Panel
      title={t('credit.card.scheduleVersion', {
        version: schedule?.version ?? loan.schedule_version,
      })}
    >
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('credit.card.noSchedule')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-xs">
              <th className="py-2 text-left font-medium">#</th>
              <th className="py-2 text-left font-medium">{t('credit.columns.dueDate')}</th>
              <th className="py-2 text-right font-medium">{t('credit.columns.principal')}</th>
              <th className="py-2 text-right font-medium">{t('credit.columns.cost')}</th>
              <th className="py-2 text-right font-medium">{t('credit.columns.total')}</th>
              <th className="py-2 text-left font-medium">{t('credit.columns.status')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.seq} className="border-border border-b last:border-0">
                <td className="py-2">{item.seq}</td>
                <td className="py-2">{formatDate(item.due_date)}</td>
                <td className="py-2 text-right tabular-nums">{money(item.principal_minor)}</td>
                <td className="py-2 text-right tabular-nums">
                  {money((item.interest_minor ?? 0) + (item.fee_minor ?? 0))}
                </td>
                <td className="py-2 text-right tabular-nums">{money(item.total_minor)}</td>
                <td className="py-2">
                  {item.status && (
                    <CreditStatusBadge status={item.status} namespace="scheduleStatus" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}

function LoanJournal({
  entries,
}: {
  entries: Array<{
    entry_id: string
    entry_type: string
    bucket: string
    amount_minor: number
    currency: string
    effective_date: string
    rule_id?: string
  }>
}) {
  const { t } = useTranslation('common')
  const visible = entries.slice(-60).reverse()
  return (
    <Panel title={t('credit.tabs.journal')}>
      {visible.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('credit.card.noJournal')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-xs">
              <th className="py-2 text-left font-medium">{t('credit.columns.date')}</th>
              <th className="py-2 text-left font-medium">{t('credit.columns.entryType')}</th>
              <th className="py-2 text-left font-medium">{t('credit.columns.bucket')}</th>
              <th className="py-2 text-right font-medium">{t('credit.columns.amount')}</th>
              <th className="py-2 text-left font-medium">{t('credit.columns.rule')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((entry) => (
              <tr key={entry.entry_id} className="border-border border-b last:border-0">
                <td className="py-2">{formatDate(entry.effective_date)}</td>
                <td className="py-2 font-mono text-xs">{entry.entry_type}</td>
                <td className="py-2">{entry.bucket}</td>
                <td className="py-2 text-right tabular-nums">
                  {money(entry.amount_minor, entry.currency)}
                </td>
                <td className="text-muted-foreground py-2 text-xs">{entry.rule_id ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}

export default CreditLoanDetailPage
