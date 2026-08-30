/**
 * Вкладка «Банківська перевірка» карточки заявки.
 *
 * Ради этого блока верификатор и открывает заявку: здесь ПОДТВЕРЖДЁННЫЙ банком
 * доход против заявленного клиентом, счёт, на который уйдут деньги, совпадение
 * личности с держателем счёта и риск-атрибуты. Раньше весь объект `ibv` не
 * рендерился нигде, а часть цифр была видна только внутри чёрного JSON-дампа
 * во вкладке решения.
 *
 * Номер счёта маскируется: полный оператору для решения не нужен, а утечь
 * через скриншот может.
 */
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'
import { formatDate, formatDateTime } from '@/lib/formatters'
import { formatCreditMoney, formatCreditRate } from '@/features/credit/api/money'
import type { CreditIbv, CreditIbvAccount } from '@/features/credit/api/types'

/** Провайдеры, чьи данные НЕ боевые — показываем это явно. */
const SYNTHETIC_PROVIDERS = new Set(['mock', 'stub', 'demo', 'fake'])

function maskAccount(value?: string): string {
  if (!value) return '—'
  return value.length <= 4 ? value : `•••${value.slice(-3)}`
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground w-64 shrink-0">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-border bg-card mb-4 rounded-xl border shadow-sm">
      <h3 className="border-border flex min-h-[49px] items-center border-b px-4 text-sm font-semibold">
        {title}
      </h3>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function CreditIbvTab({ ibv, currency }: { ibv?: CreditIbv; currency?: string }) {
  const { t } = useTranslation('common')

  if (!ibv || Object.keys(ibv).length === 0) {
    return (
      <Panel title={t('credit.card.ibv')}>
        <p className="text-muted-foreground text-sm">{t('credit.card.noIbv')}</p>
      </Panel>
    )
  }

  const synthetic = ibv.provider ? SYNTHETIC_PROVIDERS.has(ibv.provider) : false
  const payout =
    ibv.accounts?.find((a) => a.account_id === ibv.payout_account_id) ?? ibv.accounts?.[0]
  const others = (ibv.accounts ?? []).filter((a) => a.account_id !== payout?.account_id)
  const risk = ibv.risk ?? {}
  const extra = (risk.extra ?? {}) as Record<string, number | boolean>
  const recon = ibv.payday_reconciliation

  return (
    <>
      {synthetic && (
        <Alert variant="warning" className="mb-4">
          {t('credit.card.mockProviderWarning', { provider: ibv.provider })}
        </Alert>
      )}
      {ibv.payout_account_ambiguous && (
        <Alert variant="error" className="mb-4">
          {t('credit.card.ambiguousPayout')}
        </Alert>
      )}

      <Panel title={t('credit.card.ibv')}>
        <Row label={t('credit.fields.ibvStatus')}>
          {t(`credit.ibvStatus.${ibv.status}`, ibv.status ?? '—')}
          {ibv.callback_status && ibv.callback_status !== ibv.status && (
            <span className="text-muted-foreground">
              {' '}
              · {t(`credit.ibvStatus.${ibv.callback_status}`, ibv.callback_status)}
            </span>
          )}
        </Row>
        <Row label={t('credit.fields.ibvProvider')}>{ibv.provider ?? '—'}</Row>
        <Row label={t('credit.fields.receivedAt')}>{formatDateTime(ibv.received_at)}</Row>
        <Row label={t('credit.fields.identityMatch')}>
          <span
            className={
              (ibv.identity_match_rate ?? 0) >= 0.9 ? 'text-success-700' : 'text-warning-800'
            }
          >
            {formatCreditRate(ibv.identity_match_rate)}
          </span>
          {payout?.holder_name && (
            <span className="text-muted-foreground"> · {payout.holder_name}</span>
          )}
        </Row>
        {ibv.income?.employer_name && (
          <Row label={t('credit.fields.employer')}>{ibv.income.employer_name}</Row>
        )}
        {ibv.income?.net_amount_minor !== undefined && (
          <Row label={t('credit.fields.incomeVerified')}>
            {formatCreditMoney(ibv.income.net_amount_minor, currency)}
            {ibv.income.employer_income_frequency && (
              <span className="text-muted-foreground">
                {' '}
                · {ibv.income.employer_income_frequency}
              </span>
            )}
          </Row>
        )}
      </Panel>

      {recon && (
        <Panel title={t('credit.card.paydayReconciliation')}>
          <Row label={t('credit.fields.reconciliation')}>
            {recon.needs_review ? (
              <span className="bg-warning-100 text-warning-800 rounded-full px-3 py-1 text-xs font-medium">
                {t('credit.card.needsReview')}
              </span>
            ) : (
              <span className="text-success-700">{t('credit.card.reconciliationOk')}</span>
            )}
          </Row>
          <Row label={t('credit.fields.paydaysObserved')}>
            {(ibv.income?.observed_paydays ?? []).map((d) => formatDate(d)).join(', ') || '—'}
          </Row>
          <Row label={t('credit.fields.paydaysProjected')}>
            {(recon.projected_paydays ?? []).map((d) => formatDate(d)).join(', ') || '—'}
          </Row>
          <Row label={t('credit.fields.paydaysDeclared')}>
            {(recon.application_paydays ?? []).map((d) => formatDate(d)).join(', ') || '—'}
          </Row>
          <Row label={t('credit.fields.frequencyCompare')}>
            {t(
              `credit.frequency.${recon.application_frequency}`,
              recon.application_frequency ?? '—'
            )}
            {' → '}
            {t(`credit.frequency.${recon.detected_frequency}`, recon.detected_frequency ?? '—')}
          </Row>
        </Panel>
      )}

      <Panel title={t('credit.card.ibvRisk')}>
        <Row label={t('credit.fields.nsf90')}>{risk.count_nsf_90_days ?? '—'}</Row>
        <Row label={t('credit.fields.nsf30')}>{String(extra.count_nsf_30_days ?? '—')}</Row>
        <Row label={t('credit.fields.overdraft')}>
          {extra.has_overdraft === undefined
            ? '—'
            : extra.has_overdraft
              ? t('common.yes', 'Так')
              : t('common.no', 'Ні')}
        </Row>
        <Row label={t('credit.fields.accountAge')}>
          {extra.account_age_days !== undefined
            ? t('credit.card.days', { count: Number(extra.account_age_days) })
            : '—'}
        </Row>
        <Row label={t('credit.fields.balanceMin')}>
          {extra.balance_min !== undefined
            ? formatCreditMoney(Number(extra.balance_min) * 100, currency)
            : '—'}
        </Row>
        <Row label={t('credit.fields.balanceCurrent')}>
          {extra.balance_current !== undefined
            ? formatCreditMoney(Number(extra.balance_current) * 100, currency)
            : '—'}
        </Row>
        <Row label={t('credit.fields.freeCashFlow')}>
          {extra.average_monthly_free_cash_flow !== undefined
            ? formatCreditMoney(Number(extra.average_monthly_free_cash_flow) * 100, currency)
            : '—'}
        </Row>
        <Row label={t('credit.fields.microLenders')}>
          {risk.count_distinct_micro_lenders ?? '—'}
        </Row>
        <Row label={t('credit.fields.balanceTrend')}>
          {t(`credit.balanceTrend.${risk.balance_trend_simple}`, risk.balance_trend_simple ?? '—')}
        </Row>
      </Panel>

      {payout && (
        <Panel title={t('credit.card.payoutAccount')}>
          <AccountRows account={payout} currency={currency} />
          {others.length > 0 && (
            <details className="mt-3">
              <summary className="text-muted-foreground cursor-pointer text-xs">
                {t('credit.card.otherAccounts', { count: others.length })}
              </summary>
              <div className="mt-2 space-y-3">
                {others.map((account) => (
                  <div key={account.account_id} className="border-border rounded-md border p-3">
                    <AccountRows account={account} currency={currency} />
                  </div>
                ))}
              </div>
            </details>
          )}
        </Panel>
      )}
    </>
  )
}

function AccountRows({ account, currency }: { account: CreditIbvAccount; currency?: string }) {
  const { t } = useTranslation('common')
  return (
    <>
      <Row label={t('credit.fields.account')}>
        {[account.title, account.account_type].filter(Boolean).join(' · ') || '—'}
        <span className="text-muted-foreground"> · {maskAccount(account.account_number)}</span>
      </Row>
      <Row label={t('credit.fields.accountRouting')}>
        {account.transit_number ?? '—'} / {account.institution_number ?? '—'}
      </Row>
      <Row label={t('credit.fields.eftCapable')}>
        {account.eft_capable ? (
          <span className="text-success-700">{t('common.yes', 'Так')}</span>
        ) : (
          <span className="text-error-700">{t('common.no', 'Ні')}</span>
        )}
      </Row>
      <Row label={t('credit.fields.balanceCurrent')}>
        {formatCreditMoney(account.balance_current_minor, account.currency ?? currency)}
      </Row>
      <Row label={t('credit.fields.holder')}>{account.holder_name ?? '—'}</Row>
    </>
  )
}

export default CreditIbvTab
