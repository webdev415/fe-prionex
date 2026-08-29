/**
 * Карточка заявки кредитного модуля.
 *
 * Паттерн карточки клиента: шапка с ключевыми полями + вкладки. Всё, что
 * показывается, приходит из API модуля; решение принимает андеррайтер прямо
 * здесь — с обязательным обоснованием, которое переживёт смену исполнителя.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { Icons } from '@/lib/icons'
import { formatDate, formatDateTime } from '@/lib/formatters'
import {
  useCreditApplication,
  useCreditManualDecision,
  useCreditOverview,
} from '@/features/credit/hooks/useCredit'
import { creditApi, CreditApiError } from '@/features/credit/api/creditApi'
import { normalizeDraft } from '@/features/credit/api/draft'
import type {
  CreditApplicationDetail,
  CreditDecisionOutcome,
  CreditDocumentMeta,
} from '@/features/credit/api/types'
import { CreditStatusBadge } from './components/CreditStatusBadge'

const DECLINE_CODES = ['RC-04', 'RC-08', 'RC-11']
const DECIDABLE_STATUSES = ['scoring', 'referred']

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
  const navigate = useNavigate()
  const { applicationId } = useParams<{ applicationId: string }>()
  const { data: overview } = useCreditOverview()
  const { data: application, isLoading, error } = useCreditApplication(applicationId)
  const [tab, setTab] = useState('form')

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
    { id: 'documents', label: t('credit.tabs.documents') },
    { id: 'decision', label: t('credit.tabs.decision') },
    { id: 'history', label: t('credit.tabs.history') },
  ]

  return (
    <div className="p-6">
      <button
        type="button"
        onClick={() => navigate('/dashboard/credit/applications')}
        className="text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1.5 text-sm"
      >
        <Icons.ArrowLeft size={16} />
        {t('credit.actions.backToList')}
      </button>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-foreground text-xl font-semibold">
          {t('credit.card.applicationTitle', { number: application.number })}
        </h1>
        <CreditStatusBadge status={application.status} />
        <span className="text-muted-foreground text-sm">{application.product_code}</span>
      </div>

      <SegmentedTabs
        items={tabs}
        value={tab}
        onChange={setTab}
        ariaLabel={t('credit.card.applicationTitle', { number: application.number })}
      />

      {tab === 'form' && <ApplicationForm application={application} />}
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

  return (
    <>
      {applicant.note && (
        <Alert variant="warning" className="mb-4">
          {applicant.note}
        </Alert>
      )}
      <Panel title={t('credit.card.applicant')}>
        <Field label={t('credit.fields.name')}>{applicant.fullName || '—'}</Field>
        <Field label={t('credit.fields.email')}>{applicant.email ?? '—'}</Field>
        <Field label={t('credit.fields.phone')}>{applicant.phone ?? '—'}</Field>
        <Field label={t('credit.fields.birthDate')}>{applicant.birthDate ?? '—'}</Field>
        <Field label={t('credit.fields.address')}>{applicant.address ?? '—'}</Field>
      </Panel>

      <Panel title={t('credit.card.incomeAndLoan')}>
        <Field label={t('credit.fields.employmentStatus')}>
          {applicant.employmentStatus
            ? t(`credit.employment.${applicant.employmentStatus}`, applicant.employmentStatus)
            : '—'}
        </Field>
        <Field label={t('credit.fields.income')}>
          {applicant.incomeMinor
            ? `${money(applicant.incomeMinor, application.currency)} / ${
                applicant.incomeFrequency
                  ? t(`credit.frequency.${applicant.incomeFrequency}`, applicant.incomeFrequency)
                  : '—'
              }`
            : '—'}
        </Field>
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
        <Field label={t('credit.fields.paydays')}>
          {(applicant.paydays.length ? applicant.paydays : (application.paydays ?? []))
            .map((d) => formatDate(d))
            .join(', ') || '—'}
        </Field>
        <Field label={t('credit.fields.referralSource')}>{applicant.referralSource ?? '—'}</Field>
        <Field label={t('credit.fields.channel')}>{application.channel}</Field>
        <Field label={t('credit.fields.jurisdiction')}>{application.jurisdiction}</Field>
      </Panel>

      <Panel title={t('credit.card.links')}>
        <Field label={t('credit.fields.clientId')}>
          {application.client_id === null ? (
            <span className="text-muted-foreground text-xs">{t('credit.card.clientPending')}</span>
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
    </>
  )
}

function ApplicationDocuments({ application }: { application: CreditApplicationDetail }) {
  const { t } = useTranslation('common')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const documents = application.documents ?? []

  const open = async (doc: CreditDocumentMeta) => {
    setBusyId(doc.document_id)
    setFailure(null)
    try {
      const { blob, disposition } = await creditApi.documentContent(doc.document_id)
      const url = URL.createObjectURL(blob)
      // Политику inline/attachment задаёт сервер (файл прислал клиент —
      // доверять его типу нельзя). Фронт лишь исполняет решение сервера.
      if (disposition.startsWith('inline')) {
        window.open(url, '_blank', 'noopener,noreferrer')
      } else {
        const link = document.createElement('a')
        link.href = url
        link.download = doc.title ?? 'document'
        document.body.append(link)
        link.click()
        link.remove()
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      setFailure(error instanceof CreditApiError ? error.message : String(error))
    } finally {
      setBusyId(null)
    }
  }

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
                <td className="py-2">{doc.kind}</td>
                <td className="py-2 font-mono text-xs">{doc.title ?? doc.document_id}</td>
                <td className="text-muted-foreground py-2 text-xs">
                  {formatDateTime(doc.generated_at)}
                </td>
                <td className="py-2 text-right">
                  <Button
                    size="sm"
                    variant="white-secondary"
                    isLoading={busyId === doc.document_id}
                    onClick={() => void open(doc)}
                  >
                    {t('credit.actions.openDocument')}
                  </Button>
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
            {money(decision.final_amount_minor, decision.currency)}
          </Field>
          <Field label={t('credit.fields.declineCodes')}>
            {decision.decline_codes.join(', ') || '—'}
          </Field>
          <Field label={t('credit.fields.underwriter')}>{decision.underwriter_id ?? '—'}</Field>
          <Field label={t('credit.fields.rationale')}>{decision.rationale ?? '—'}</Field>
          <Field label={t('credit.fields.rules')}>
            {decision.ruleset_version} / {decision.model_version}
          </Field>
          <Field label={t('credit.fields.decidedAt')}>{formatDateTime(decision.decided_at)}</Field>
          <p className="text-muted-foreground mt-3 mb-1 text-xs">{t('credit.card.snapshot')}</p>
          <pre className="bg-secondary-900 max-h-72 overflow-auto rounded-md p-3 font-mono text-[11px] text-white">
            {snapshot}
          </pre>
        </Panel>
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
              <span className="text-muted-foreground ml-2 text-xs">({entry.actor})</span>
            </span>
          </li>
        ))}
      </ul>
      {(application.consents ?? []).length > 0 && (
        <>
          <p className="text-muted-foreground mt-4 mb-1 text-xs">{t('credit.card.consents')}</p>
          <ul className="text-sm">
            {application.consents.map((consent, index) => (
              <li key={`${consent.kind}-${index}`} className="py-1">
                {consent.kind} · {consent.text_version} ·{' '}
                {consent.granted ? t('credit.card.granted') : t('credit.card.notGranted')}
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

export default CreditApplicationDetailPage
