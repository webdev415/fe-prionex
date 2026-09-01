/**
 * Карточка заявки кредитного модуля.
 *
 * Паттерн карточки клиента: шапка с ключевыми полями + вкладки. Всё, что
 * показывается, приходит из API модуля; решение принимает андеррайтер прямо
 * здесь — с обязательным обоснованием, которое переживёт смену исполнителя.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { formatDate, formatDateTime } from '@/lib/formatters'
import {
  useCreditApplication,
  useCreditManualDecision,
  useCreditOverview,
} from '@/features/credit/hooks/useCredit'
import type { CreditApiError } from '@/features/credit/api/creditApi'
import { normalizeDraft } from '@/features/credit/api/draft'
import type { CreditApplicationDetail, CreditDecisionOutcome } from '@/features/credit/api/types'
import { CreditStatusBadge } from './components/CreditStatusBadge'
import { CreditDocumentOpenButton } from './components/CreditDocumentOpenButton'
import { CreditDraftBlocks } from './components/CreditDraftBlocks'
import { CreditFlagList } from './components/CreditFlagList'
import { CreditStageProgress } from './components/CreditStageProgress'
import { CreditClientLink } from './components/CreditClientLink'
import { collectApplicationFlags } from '@/features/credit/api/applicantFlags'
import { formatIdle, idleMinutes } from '@/features/credit/api/idle'
import { useNowTick } from '@/features/credit/hooks/useNowTick'
import {
  CreditCardHeader,
  CreditNotice,
  type CreditHeaderMetric,
} from './components/CreditCardHeader'
import { CreditIdentifierRows } from './components/CreditIdentifiers'
import { CreditIbvTab } from './components/CreditIbvTab'
import { CreditDecisionBasis } from './components/CreditDecisionBasis'
import {
  formatCreditMoney,
  formatCreditPercent,
  formatCreditRate,
} from '@/features/credit/api/money'
import { Pii } from '@/lib/openreplay/pii'

const DECLINE_CODES = ['RC-04', 'RC-08', 'RC-11']
const DECIDABLE_STATUSES = ['scoring', 'referred']
/** Заявка отработана — срок годности показывать бессмысленно. */
const TERMINAL_STATUSES = ['disbursed', 'declined', 'expired', 'abandoned', 'contracted']
/** Клиент ещё не дошёл до конца — показываем, на каком шаге застрял. */
const UNFINISHED_STATUSES = ['draft', 'in_progress', 'identity_check', 'data_collection']

const money = formatCreditMoney

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground w-52 shrink-0">{label}</span>
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

export function CreditApplicationDetailPage() {
  const { t } = useTranslation('common')
  const { applicationId } = useParams<{ applicationId: string }>()
  const { data: overview } = useCreditOverview()
  const { data: application, isLoading, error } = useCreditApplication(applicationId)
  const [tab, setTab] = useState('form')
  // Своим тиком, а не по приходу данных: карточку держат открытой часами,
  // а запрос может не повториться ни разу — «5 хвилин тому» замёрзло бы.
  const now = useNowTick()

  const canDecide = Boolean(overview?.permissions.includes('credit.decisions.decide'))

  if (isLoading) {
    return <div className="text-muted-foreground p-6">{t('common.loading', 'Загрузка…')}</div>
  }
  if (error || !application) {
    return (
      <div className="p-6">
        <Alert variant="error">{(error as Error)?.message ?? t('credit.card.notFound')}</Alert>
      </div>
    )
  }

  const tabs = [
    { id: 'form', label: t('credit.tabs.form') },
    { id: 'fullForm', label: t('credit.tabs.fullForm') },
    { id: 'ibv', label: t('credit.tabs.ibv') },
    { id: 'documents', label: t('credit.tabs.documents') },
    { id: 'decision', label: t('credit.tabs.decision') },
    { id: 'history', label: t('credit.tabs.history') },
  ]

  // Плитки шапки заявки — зеркало кредитных: сколько просят, сколько одобрено,
  // на что опирается решение и можно ли верить личности. Один визуальный язык
  // на обе сущности: оператор не переучивается, переходя между карточками.
  const snapshot = application.decision?.input_snapshot
  const verifiedIncome = application.ibv?.income?.net_amount_minor
  const identityRate = application.ibv?.identity_match_rate
  const headerMetrics: CreditHeaderMetric[] = [
    {
      key: 'requested',
      label: t('credit.fields.requested'),
      value: money(application.requested_amount_minor, application.currency),
    },
    {
      key: 'approved',
      label: t('credit.fields.finalAmount'),
      value:
        application.decision?.final_amount_minor != null
          ? money(application.decision.final_amount_minor, application.currency)
          : '—',
      tone: application.decision?.outcome === 'approved' ? 'ok' : 'default',
    },
    {
      key: 'income',
      label: t('credit.fields.incomeVerified'),
      value: verifiedIncome !== undefined ? money(verifiedIncome, application.currency) : '—',
      hint:
        snapshot?.affordability_cap_minor !== undefined
          ? `${t('credit.fields.affordabilityCap')} ${money(snapshot.affordability_cap_minor, application.currency)}`
          : undefined,
    },
    {
      key: 'identity',
      label: t('credit.fields.identityMatch'),
      value: identityRate !== undefined ? formatCreditRate(identityRate) : '—',
      tone: identityRate !== undefined && identityRate < 0.9 ? 'warn' : 'ok',
    },
  ]

  const stuck =
    UNFINISHED_STATUSES.includes(application.status) &&
    (application.resume_step || (application.missing_fields ?? []).length > 0)
  // Сколько заявка стоит без движения. Модуль не пишет время входа в каждый
  // шаг анкеты, поэтому «сколько он там стоит» строим от `updated_at` —
  // единственной метки, которая уже есть (см. `api/idle.ts`).
  const idle = idleMinutes(application.updated_at, now)
  const standing = application.client_standing
  const cooldownActive =
    !!standing?.cooldown_until && new Date(standing.cooldown_until).getTime() > now.getTime()
  // «Что-то не так» — требование CEO. Два вида признаков держим раздельно:
  // противоречия и нехватка требуют от оператора разных действий.
  const flags = collectApplicationFlags(application)

  return (
    <div className="p-6">
      <CreditCardHeader
        backTo="/dashboard/credit/applications"
        backLabel={t('credit.actions.backToList')}
        title={t('credit.card.applicationTitle', { number: application.number })}
        copyValue={application.number}
        badge={<CreditStatusBadge status={application.status} />}
        subtitle={`${application.product_code} · ${application.jurisdiction}`}
        identity={
          <>
            <span>
              {t('credit.fields.createdAt')}: {formatDateTime(application.created_at)}
            </span>
            <span>
              {t('credit.fields.updatedAt')}: {formatDateTime(application.updated_at)}
            </span>
            {application.expires_at && !TERMINAL_STATUSES.includes(application.status) && (
              <span>
                {t('credit.fields.expiresAt')}: {formatDateTime(application.expires_at)}
              </span>
            )}
          </>
        }
        metrics={headerMetrics}
        notices={
          <>
            <CreditFlagList flags={flags} />
            {stuck && (
              <CreditNotice>
                {t('credit.card.stuckAt', {
                  step: t(
                    `credit.blocks.${application.resume_step}`,
                    application.resume_step ?? '—'
                  ),
                })}
                {(application.missing_fields ?? []).length > 0 && (
                  <>
                    {' · '}
                    {t('credit.card.missingBlocks')}:{' '}
                    {(application.missing_fields ?? [])
                      .map((field) => t(`credit.blocks.${field}`, field))
                      .join(', ')}
                  </>
                )}
                {idle !== null && (
                  <>
                    {' · '}
                    {t('credit.card.idleFor', { duration: formatIdle(idle, t) })}
                  </>
                )}
              </CreditNotice>
            )}
            {/* Весь путь клиента по этапам — теми же пятью шагами и с той же
                нумерацией, что он видит в своём кабинете. Стоит рядом с
                «застряв на кроці» намеренно: та строка отвечает «где встал»,
                эта — «сколько позади и сколько осталось». */}
            <CreditStageProgress application={application} />
            {/* Основания, на которых машина откажет: непогашенный заём и
                остывание после прошлого отказа. Оператор решает здесь же —
                значит и предъявлять их надо здесь. */}
            {(cooldownActive || (standing?.outstanding_loans ?? []).length > 0) && (
              <CreditNotice>
                {(standing?.outstanding_loans ?? []).length > 0 && (
                  <>
                    {t('credit.card.outstandingLoans')}:{' '}
                    {(standing?.outstanding_loans ?? [])
                      .map(
                        (loan) =>
                          `${loan.contract_number} (${t(`credit.loanStatus.${loan.status}`, loan.status)})`
                      )
                      .join(', ')}
                  </>
                )}
                {cooldownActive && (standing?.outstanding_loans ?? []).length > 0 && ' · '}
                {cooldownActive && (
                  <>
                    {t('credit.card.cooldownUntil', {
                      date: formatDate(standing?.cooldown_until ?? ''),
                    })}
                  </>
                )}
              </CreditNotice>
            )}
          </>
        }
      />

      <SegmentedTabs
        items={tabs}
        value={tab}
        onChange={setTab}
        ariaLabel={t('credit.card.applicationTitle', { number: application.number })}
      />

      {tab === 'form' && <ApplicationForm application={application} />}
      {tab === 'fullForm' && (
        <CreditDraftBlocks draft={application.draft} currency={application.currency} />
      )}
      {tab === 'ibv' && <CreditIbvTab ibv={application.ibv} currency={application.currency} />}
      {tab === 'documents' && <ApplicationDocuments application={application} />}
      {tab === 'decision' && (
        <ApplicationDecision application={application} canDecide={canDecide} />
      )}
      {tab === 'history' && <ApplicationHistory application={application} />}
    </div>
  )
}

function ApplicationForm({ application }: { application: CreditApplicationDetail }) {
  const { t } = useTranslation('common')
  // Анкету присылает сайт блоками (personal/phones/address/income/params);
  // разбор форматов — в normalizeDraft, здесь только показ.
  const applicant = normalizeDraft(application.draft, application.client_email)

  const ibv = application.ibv
  const ibvIncome = ibv?.income
  const identityMatch = ibv?.identity_match_rate
  const holderName = ibv?.accounts?.find(
    (account) => account.account_id === ibv?.payout_account_id
  )?.holder_name
  const observedPaydays = ibvIncome?.observed_paydays ?? []
  const reconciliation = application.decision?.input_snapshot?.income_reconciliation
  const divergencePct = formatCreditPercent(reconciliation?.divergence_pct)
  const needsIncomeReview = Boolean(reconciliation?.needs_review)

  return (
    <>
      {applicant.note && (
        <Alert variant="warning" className="mb-4">
          {applicant.note}
        </Alert>
      )}
      <Panel title={t('credit.card.applicant')}>
        {/* `Field` takes {label, children} and forwards nothing, so the
            attribute cannot be spread onto it — the wrapper goes inside. */}
        <Field label={t('credit.fields.name')}>
          <Pii>{applicant.fullName || '—'}</Pii>
        </Field>
        <Field label={t('credit.fields.email')}>{applicant.email ?? '—'}</Field>
        <Field label={t('credit.fields.phone')}>{applicant.phone ?? '—'}</Field>
        <Field label={t('credit.fields.birthDate')}>{applicant.birthDate ?? '—'}</Field>
        <Field label={t('credit.fields.address')}>
          <Pii>{applicant.address ?? '—'}</Pii>
        </Field>
        {identityMatch !== undefined && (
          <Field label={t('credit.fields.identityMatch')}>
            <span className={identityMatch >= 0.9 ? 'text-success-700' : 'text-warning-800'}>
              {formatCreditRate(identityMatch)}
            </span>
            {holderName && <span className="text-muted-foreground"> · {holderName}</span>}
          </Field>
        )}
      </Panel>

      <Panel title={t('credit.card.incomeAndLoan')}>
        <Field label={t('credit.fields.employmentStatus')}>
          {applicant.employmentStatus
            ? t(`credit.employment.${applicant.employmentStatus}`, applicant.employmentStatus)
            : '—'}
        </Field>
        {(ibvIncome?.employer_name || applicant.employer) && (
          <Field label={t('credit.fields.employer')}>
            {ibvIncome?.employer_name ?? applicant.employer}
            {ibvIncome?.employer_name &&
              applicant.employer &&
              ibvIncome.employer_name !== applicant.employer && (
                <span className="text-warning-800 ml-2 text-xs">
                  {t('credit.card.declaredDiffers', { value: applicant.employer })}
                </span>
              )}
          </Field>
        )}
        <Field label={t('credit.fields.income')}>
          {applicant.incomeMinor
            ? `${money(applicant.incomeMinor, application.currency)} / ${
                applicant.incomeFrequency
                  ? t(`credit.frequency.${applicant.incomeFrequency}`, applicant.incomeFrequency)
                  : '—'
              }`
            : '—'}
          <span className="text-muted-foreground"> ({t('credit.fields.declaredByClient')})</span>
        </Field>
        {/* Подтверждённый банком доход — то, на что опирается решение.
            Без него заявленная клиентом сумма читается как проверенная. */}
        {ibvIncome?.net_amount_minor !== undefined && (
          <Field label={t('credit.fields.incomeVerified')}>
            <strong>{money(ibvIncome.net_amount_minor, application.currency)}</strong>
            {divergencePct !== null && (
              <span
                className={
                  needsIncomeReview ? 'text-warning-800 ml-2' : 'text-muted-foreground ml-2'
                }
              >
                {t('credit.fields.divergence')} {divergencePct} %
              </span>
            )}
          </Field>
        )}
        <Field label={t('credit.fields.receiptMethod')}>
          {applicant.receiptMethod
            ? t(`credit.receipt.${applicant.receiptMethod}`, applicant.receiptMethod)
            : '—'}
        </Field>
        <Field label={t('credit.fields.requested')}>
          {money(
            applicant.requestedMinor ?? application.requested_amount_minor,
            application.currency
          )}
        </Field>
        <Field label={t('credit.fields.paydaysDeclared')}>
          {(application.paydays ?? applicant.paydays).map((d) => formatDate(d)).join(', ') || '—'}
        </Field>
        {observedPaydays.length > 0 && (
          <Field label={t('credit.fields.paydaysObserved')}>
            {observedPaydays.map((d) => formatDate(d)).join(', ')}
          </Field>
        )}
        <Field label={t('credit.fields.referralSource')}>{applicant.referralSource ?? '—'}</Field>
        <Field label={t('credit.fields.channel')}>
          {t(`credit.channel.${application.channel}`, application.channel)}
        </Field>
        <Field label={t('credit.fields.jurisdiction')}>{application.jurisdiction}</Field>
      </Panel>

      <Panel title={t('credit.card.links')}>
        <Field label={t('credit.fields.clientId')}>
          {/* Раньше здесь стояло «клієнта ще не створено», и это обещало, что
              запись появится сама. Не появится: CRM требует при создании
              десятизначный налоговый номер, у канадского заёмщика такого нет.
              Теперь ищем по телефону сами и говорим, что именно узнали —
              включая «не искали», которое не равно «не найдено». */}
          {application.client_id === null ? (
            <CreditClientLink clientId={null} phone={application.client_phone} />
          ) : (
            <Link
              to={`/dashboard/clients/${application.client_id}`}
              className="text-information-600 underline"
            >
              #{application.client_id}
            </Link>
          )}
        </Field>
        <Field label={t('credit.fields.loan')}>
          {application.loan_id ? (
            <Link
              to={`/dashboard/credit/loans/${application.loan_id}`}
              className="text-information-600 underline"
            >
              {t('credit.card.openLoan')}
            </Link>
          ) : (
            '—'
          )}
        </Field>
      </Panel>

      {/* Ссылка «Відкрити кредит» отвечает на «куда нажать», но не на «что
          продиктовать»: сами идентификаторы в ней не видны. */}
      <Panel title={t('credit.card.identifiers')}>
        <CreditIdentifierRows
          items={[
            {
              key: 'application',
              label: t('credit.fields.applicationId'),
              value: application.application_id,
            },
            {
              key: 'external',
              label: t('credit.fields.externalApplicationId'),
              value: application.external_application_id,
            },
            {
              key: 'decision',
              label: t('credit.fields.decisionId'),
              value: application.decision_id,
            },
            { key: 'loan', label: t('credit.fields.loanId'), value: application.loan_id },
          ]}
        />
      </Panel>
    </>
  )
}

function ApplicationDocuments({ application }: { application: CreditApplicationDetail }) {
  const { t } = useTranslation('common')
  const [failure, setFailure] = useState<string | null>(null)
  const documents = application.documents ?? []

  return (
    <Panel title={t('credit.tabs.documents')}>
      {failure && (
        <Alert variant="error" className="mb-3">
          {failure}
        </Alert>
      )}
      {documents.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('credit.card.noDocuments')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-xs">
              <th className="py-2 text-left font-medium">{t('credit.columns.documentKind')}</th>
              <th className="py-2 text-left font-medium">{t('credit.columns.documentFile')}</th>
              <th className="py-2 text-left font-medium">{t('credit.columns.uploaded')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.document_id} className="border-border border-b last:border-0">
                <td className="py-2">{t(`credit.documentKind.${doc.kind}`, doc.kind)}</td>
                <td className="py-2 font-mono text-xs">{doc.title ?? doc.document_id}</td>
                <td className="text-muted-foreground py-2 text-xs">
                  {formatDateTime(doc.generated_at)}
                </td>
                <td className="py-2 text-right">
                  <CreditDocumentOpenButton document={doc} onError={setFailure} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}

function ApplicationDecision({
  application,
  canDecide,
}: {
  application: CreditApplicationDetail
  canDecide: boolean
}) {
  const { t } = useTranslation('common')
  const decision = application.decision
  const decidable = DECIDABLE_STATUSES.includes(application.status)
  const mutation = useCreditManualDecision(application.application_id)

  const [outcome, setOutcome] = useState<CreditDecisionOutcome>('approved')
  const [amount, setAmount] = useState(String((application.requested_amount_minor ?? 0) / 100))
  const [rationale, setRationale] = useState('')
  const [codes, setCodes] = useState<string[]>([])
  const [underwriterId, setUnderwriterId] = useState('')

  const snapshot = useMemo(
    () => JSON.stringify(decision?.input_snapshot ?? {}, null, 2),
    [decision]
  )

  const submit = () => {
    mutation.mutate({
      outcome,
      rationale: rationale.trim(),
      ...(outcome === 'approved' ? { final_amount_minor: Math.round(Number(amount) * 100) } : {}),
      ...(outcome === 'declined' ? { decline_codes: codes } : {}),
      ...(underwriterId ? { underwriter_id: Number(underwriterId) } : {}),
    })
  }

  return (
    <>
      {decision && (
        <Panel title={t('credit.card.currentDecision')}>
          <Field label={t('credit.fields.outcome')}>
            <CreditStatusBadge status={decision.outcome} />
          </Field>
          <Field label={t('credit.fields.mode')}>
            {t(`credit.decision.${decision.decision_mode}`, decision.decision_mode)}
          </Field>
          <Field label={t('credit.fields.finalAmount')}>
            {money(application.requested_amount_minor, application.currency)}
            {decision.final_amount_minor !== null && (
              <>
                {' → '}
                <strong>{money(decision.final_amount_minor, decision.currency)}</strong>
              </>
            )}
          </Field>
          <Field label={t('credit.fields.declineCodes')}>
            {decision.decline_codes.length
              ? decision.decline_codes
                  .map((code) => `${code} — ${t(`credit.declineCode.${code}`, code)}`)
                  .join('; ')
              : '—'}
          </Field>
          {decision.outcome === 'declined' && decision.cooldown_until && (
            <Field label={t('credit.fields.retryAfter')}>
              {formatDate(decision.cooldown_until)}
            </Field>
          )}
          <Field label={t('credit.fields.underwriter')}>{decision.underwriter_id ?? '—'}</Field>
          <Field label={t('credit.fields.rationale')}>{decision.rationale ?? '—'}</Field>
          <Field label={t('credit.fields.rules')}>
            {decision.ruleset_version} / {decision.model_version}
          </Field>
          <Field label={t('credit.fields.decidedAt')}>{formatDateTime(decision.decided_at)}</Field>
        </Panel>
      )}

      {decision && (
        <CreditDecisionBasis
          snapshot={decision.input_snapshot}
          currency={decision.currency ?? application.currency}
        />
      )}

      {decision && (
        <details className="border-border bg-card mb-4 rounded-xl border p-4 shadow-sm">
          <summary className="text-muted-foreground cursor-pointer text-xs">
            {t('credit.card.snapshot')}
          </summary>
          <pre className="bg-secondary-900 mt-2 max-h-72 overflow-auto rounded-md p-3 font-mono text-[11px] text-white">
            {snapshot}
          </pre>
        </details>
      )}

      {decidable && canDecide && (
        <Panel title={t('credit.card.manualDecision')}>
          {mutation.isError && (
            <Alert variant="error" className="mb-3">
              {(mutation.error as CreditApiError).message}
            </Alert>
          )}
          {mutation.isSuccess && (
            <Alert variant="success" className="mb-3">
              {t('credit.card.decisionSaved')}
            </Alert>
          )}

          <div className="mb-3 flex flex-wrap items-end gap-3">
            <label className="text-muted-foreground flex flex-col gap-1.5 text-xs">
              {t('credit.fields.outcome')}
              <select
                className="border-input-border bg-card text-foreground h-10 rounded-md border px-3 text-sm"
                value={outcome}
                onChange={(event) => setOutcome(event.target.value as CreditDecisionOutcome)}
              >
                <option value="approved">{t('credit.actions.approve')}</option>
                <option value="declined">{t('credit.actions.decline')}</option>
                <option value="referred">{t('credit.actions.refer')}</option>
              </select>
            </label>
            {outcome === 'approved' && (
              <label className="text-muted-foreground flex flex-col gap-1.5 text-xs">
                {t('credit.fields.finalAmount')}
                <Input
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>
            )}
            <label className="text-muted-foreground flex flex-col gap-1.5 text-xs">
              {t('credit.fields.underwriterId')}
              <Input
                type="number"
                min="1"
                value={underwriterId}
                onChange={(event) => setUnderwriterId(event.target.value)}
              />
            </label>
          </div>

          {outcome === 'declined' && (
            <div className="mb-3">
              <p className="text-muted-foreground mb-1.5 text-xs">
                {t('credit.card.declineCodesHint')}
              </p>
              <div className="flex flex-wrap gap-2">
                {DECLINE_CODES.map((code) => {
                  const active = codes.includes(code)
                  return (
                    <button
                      key={code}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setCodes((prev) =>
                          prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
                        )
                      }
                      className={`h-8 rounded-full border px-3.5 text-xs font-medium ${
                        active
                          ? 'bg-secondary-800 border-secondary-800 text-white'
                          : 'border-border bg-card text-muted-foreground'
                      }`}
                    >
                      {code}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <label className="text-muted-foreground mb-1.5 block text-xs">
            {t('credit.fields.rationale')}
          </label>
          <textarea
            className="border-input-border bg-card text-foreground min-h-[96px] w-full rounded-md border p-3 text-sm"
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
            placeholder={t('credit.card.rationalePlaceholder')}
          />

          <div className="mt-3 flex items-center gap-3">
            <Button
              variant="primary"
              disabled={!rationale.trim() || mutation.isPending}
              isLoading={mutation.isPending}
              onClick={submit}
            >
              {t('credit.actions.saveDecision')}
            </Button>
            <span className="text-muted-foreground text-xs">{t('credit.card.state01')}</span>
          </div>
        </Panel>
      )}

      {decidable && !canDecide && (
        <Alert variant="info">{t('credit.card.noDecisionPermission')}</Alert>
      )}
      {!decidable && !decision && <Alert variant="info">{t('credit.card.notDecidable')}</Alert>}
    </>
  )
}

function ApplicationHistory({ application }: { application: CreditApplicationDetail }) {
  const { t } = useTranslation('common')
  return (
    <Panel title={t('credit.tabs.history')}>
      <ul className="text-sm">
        {(application.audit ?? []).map((entry, index) => (
          <li
            key={`${entry.at}-${index}`}
            className="border-border flex gap-3 border-b py-2 last:border-0"
          >
            <span className="text-muted-foreground w-40 shrink-0 font-mono text-xs">
              {formatDateTime(entry.at)}
            </span>
            <span>
              {entry.from_status
                ? `${t(`credit.status.${entry.from_status}`, entry.from_status)} → `
                : ''}
              <strong>{t(`credit.status.${entry.to_status}`, entry.to_status)}</strong>
              <span className="text-muted-foreground ml-2 text-xs">
                ({t(`credit.actor.${entry.actor}`, entry.actor)})
              </span>
            </span>
          </li>
        ))}
      </ul>
      {application.sign_evidence && (
        <div className="mt-4">
          <div className="text-muted-foreground mb-2 text-xs">{t('credit.card.signEvidence')}</div>
          <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-1 text-sm">
            <dt className="text-muted-foreground">{t('credit.fields.signMethod')}</dt>
            <dd className="m-0">
              {t(
                `credit.signMethod.${application.sign_evidence.method}`,
                application.sign_evidence.method ?? '—'
              )}
              {application.sign_evidence.typed_name
                ? ` · ${application.sign_evidence.typed_name}`
                : ''}
            </dd>
            <dt className="text-muted-foreground">{t('credit.fields.signedAt')}</dt>
            <dd className="m-0">{formatDateTime(application.sign_evidence.signed_at)}</dd>
            <dt className="text-muted-foreground">{t('credit.fields.signHash')}</dt>
            <dd className="m-0 overflow-hidden font-mono text-xs text-ellipsis whitespace-nowrap">
              {application.sign_evidence.pdf_sha256 ?? '—'}
            </dd>
            <dt className="text-muted-foreground">{t('credit.fields.signSession')}</dt>
            <dd className="m-0 font-mono text-xs">
              {application.sign_evidence.session_id ?? '—'}
              {application.sign_evidence.ip ? ` · ${application.sign_evidence.ip}` : ''}
            </dd>
          </dl>
        </div>
      )}

      {(application.consents ?? []).length > 0 && (
        <>
          <p className="text-muted-foreground mt-4 mb-1 text-xs">{t('credit.card.consents')}</p>
          <ul className="text-sm">
            {application.consents.map((consent, index) => (
              <li key={`${consent.kind}-${index}`} className="flex flex-wrap gap-x-2 py-1">
                <span>{t(`credit.consent.${consent.kind}`, consent.kind)}</span>
                <span className={consent.granted ? 'text-success-700' : 'text-error-700'}>
                  {consent.granted ? t('credit.card.granted') : t('credit.card.notGranted')}
                </span>
                <span className="text-muted-foreground text-xs">
                  {consent.text_version}
                  {consent.granted_at ? ` · ${formatDateTime(consent.granted_at)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

export default CreditApplicationDetailPage
