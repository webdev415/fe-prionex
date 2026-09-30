/**
 * Карточка заявки кредитного модуля.
 *
 * Паттерн карточки клиента: шапка с ключевыми полями + вкладки. Всё, что
 * показывается, приходит из API модуля; решение принимает андеррайтер прямо
 * здесь — с обязательным обоснованием, которое переживёт смену исполнителя.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Link, useParams } from 'react-router-dom'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { PERMISSIONS } from '@/constants/permissions'
import { formatDate, formatDateTime } from '@/lib/formatters'
import {
  useCreditApplication,
  useCreditDecisionCodes,
  useCreditManualDecision,
  useCreditOverview,
} from '@/features/credit/hooks/useCredit'
import { CreditApiError } from '@/features/credit/api/creditApi'
import {
  decisionCodeNote,
  decisionCodeText,
  normalizeDecisionCodes,
  type CreditDecisionCodeIndex,
} from '@/features/credit/api/decisionCodes'
import {
  checklistItemsOf,
  checklistPayload,
  conditionalOf,
  withoutConditionalCodes,
  type CreditChecklistAnswers,
  type CreditChecklistNotes,
} from '@/features/credit/api/decisionChecklist'
import { normalizeDraft } from '@/features/credit/api/draft'
import { CREDIT_DOCUMENT_META_KINDS } from '@/features/credit/api/enums'
import type {
  CreditApplicationDetail,
  CreditDecision,
  CreditDecisionOutcome,
} from '@/features/credit/api/types'
import { CreditStatusBadge } from './components/CreditStatusBadge'
import { CreditDocumentOpenButton } from './components/CreditDocumentOpenButton'
import { CreditDraftBlocks } from './components/CreditDraftBlocks'
import { CreditFlagList } from './components/CreditFlagList'
import { CreditStageProgress } from './components/CreditStageProgress'
import { CreditClientLink } from './components/CreditClientLink'
import { CreditPriorApplications } from './components/CreditPriorApplications'
import { CreditApplicationTimeline } from './components/CreditApplicationTimeline'
import { CreditCommunications } from './components/CreditCommunications'
import { collectApplicationFlags } from '@/features/credit/api/applicantFlags'
import { hasStatusRows, hasTimeline } from '@/features/credit/api/timeline'
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
import { CreditScorecardBreakdown } from './components/CreditScorecardBreakdown'
import {
  CreditDecisionChecklistForm,
  CreditDecisionChecklistView,
} from './components/CreditDecisionChecklist'
import { CreditConditionalConfirm } from './components/CreditConditionalConfirm'
import { snapshotForDisplay } from '@/features/credit/api/decisionSnapshot'
import { readScorecard } from '@/features/credit/api/scorecard'
import {
  formatCreditMoney,
  formatCreditPercent,
  formatCreditRate,
} from '@/features/credit/api/money'
import { Pii, piiProps } from '@/lib/openreplay/pii'

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
  const canConfirm = Boolean(
    overview?.permissions.includes(PERMISSIONS.CREDIT.DECISIONS_CONFIRM_CONDITIONAL)
  )

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
            {/* Весь путь клиента по этапам: этап, его номер и длину пути
                присылает МОДУЛЬ — тот же ответ, по которому клиент видит свой
                шаг в кабинете. Стоит рядом с «застряв на кроці» намеренно: та
                строка отвечает «где встал», эта — «сколько позади и сколько
                осталось». */}
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
        <ApplicationDecision
          application={application}
          canDecide={canDecide}
          canConfirm={canConfirm}
        />
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
            {/* Имя держателя счёта — ПД, как ФИО заёмщика: в запись сессии не уходит. */}
            {holderName && (
              <span className="text-muted-foreground">
                {' · '}
                <Pii>{holderName}</Pii>
              </span>
            )}
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

      {/* Сколько заявок этот клиент уже подавал — счёт модуля по его правилу
          тождества; стоит сразу за связями, потому что отвечает на тот же
          вопрос «кто это». */}
      <Panel title={t('credit.clientHistory.title')}>
        <CreditPriorApplications value={application.applicant_applications} />
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
  const [notice, setNotice] = useState<string | null>(null)
  const documents = application.documents ?? []
  // Плашка над таблицей одна: отказ и уведомление вытесняют друг друга, иначе
  // запоздавший ответ одного документа лёг бы рядом с итогом другого.
  const showFailure = (message: string | null) => {
    setFailure(message)
    if (message !== null) setNotice(null)
  }
  const showNotice = (message: string | null) => {
    setNotice(message)
    if (message !== null) setFailure(null)
  }

  return (
    <Panel title={t('credit.tabs.documents')}>
      {failure && (
        <Alert variant="error" className="mb-3">
          {failure}
        </Alert>
      )}
      {/* Живая область стоит в DOM всегда: вставленную вместе с текстом часть
          дикторов не объявляет, а у самой плашки роли нет. */}
      <div role="status" aria-live="polite">
        {notice && (
          <CreditNotice tone="info" className="mb-3">
            {notice}
          </CreditNotice>
        )}
      </div>
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
                <td className="py-2">
                  {CREDIT_DOCUMENT_META_KINDS.includes(doc.kind)
                    ? t(`credit.documentKind.${doc.kind}`)
                    : t('credit.documentKind.unknown', { code: doc.kind })}
                </td>
                <td className="py-2 font-mono text-xs">{doc.title ?? doc.document_id}</td>
                <td className="text-muted-foreground py-2 text-xs">
                  {formatDateTime(doc.generated_at)}
                </td>
                <td className="py-2 text-right">
                  <CreditDocumentOpenButton
                    document={doc}
                    owner={{ kind: 'application', id: application.application_id }}
                    onError={showFailure}
                    onNotice={showNotice}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}

/**
 * Отказ ручного решения по машинному коду модуля. Три кода — отказы по пропуску
 * CRM, из которого модуль берёт автора решения: `detail` модуля написан
 * по-русски, а оператору нужен текст на его языке. Ключи — статическими
 * литералами: страж словарей видит только их. Прочие отказы — прежним
 * сообщением: в `validation_failed` оно называет поле, которое надо поправить.
 * Сообщения нет (брошен не `Error` или текст пуст) — общий текст отказа: пустая
 * плашка не говорит оператору даже того, что решение не записано.
 */
function manualDecisionErrorText(t: TFunction, error: unknown): string {
  if (error instanceof CreditApiError) {
    switch (error.code) {
      case 'operator_id_not_numeric':
        return t('credit.decisionError.operatorIdNotNumeric')
      case 'operator_id_ambiguous':
        return t('credit.decisionError.operatorIdAmbiguous')
      case 'underwriter_not_the_caller':
        return t('credit.decisionError.underwriterNotTheCaller')
      case 'conditional_approval_unconfirmed':
        return t('credit.decisionError.conditionalApprovalUnconfirmed')
    }
  }
  const message = error instanceof Error ? error.message : ''
  return message.trim() ? message : t('credit.decisionError.generic')
}

/**
 * Отказ двери подтверждения условного одобрения (19-5f). Свои тексты — у двух
 * кодов: автор подтверждает своё же предложение, и предложение больше не
 * действует (`invalid_state`: заявка не на разборе, его заменило другое решение
 * или факты банка изменились после него). Всё прочее — как у ручного решения:
 * отказы по пропуску, сообщение модуля, пустое — общий текст.
 */
function confirmErrorText(t: TFunction, error: unknown): string {
  if (error instanceof CreditApiError) {
    switch (error.code) {
      case 'conditional_confirmer_is_the_author':
        return t('credit.decisionError.confirmerIsTheAuthor')
      case 'invalid_state':
        return t('credit.decisionError.proposalNotActive')
    }
  }
  return manualDecisionErrorText(t, error)
}

/**
 * Строка «Коди відмови» карточки решения.
 *
 * Смысл отказа — `decision_codes` словами справочника модуля; рядом, если
 * оператор прислал другое (`RC-04` при смысле `AB-O-05`), приглушённо — как
 * прислано: модуль хранит коды так, как их прислали. «Как прислано» — только у
 * ручного решения (`decision_mode = manual`): у автоматического `decline_codes`
 * записала машина, override кодов не принимает (`OverrideRequest`), и подпись
 * «надіслано» там была бы неправдой. Ключа нет или список пуст
 * (решения до 0.1.27, `RC-11` без установленной причины) — прежний вывод
 * словарём `credit.declineCode`.
 *
 * Справочника нет (у роли нет `credit.decisions.decide`, которым закрыта его
 * дверь, либо запрос ещё не пришёл или не удался) — текст взять неоткуда, кроме
 * прежнего словаря. Поэтому присланные коды идут прежним выводом
 * `credit.declineCode` (старое решение `RC-04` читается словами, как до
 * справочника), а коды справочника — приглушённой строкой с подписью, если они
 * не совпадают с присланными.
 *
 * Прежний вывод печатает код одним `id`, когда строки для него в прежнем
 * словаре нет (`AB-O-13` новой формы, неизвестный код в решении без
 * `decision_codes`): запасным текстом i18next вернул бы сам код, и строка
 * читалась бы `AB-O-13 — AB-O-13`. Правило одно для всех трёх веток и смотрит
 * в словарь, а не в состав `decision_codes`.
 *
 * Список смысла нормализуется тем же правилом, что сравнение с присланным: без
 * повторов и по возрастанию. Модуль отдаёт его уже таким (`decision_codes_of` —
 * `sorted(set)`), поэтому порядок модуля не меняется, а повтор в ответе не
 * даёт двух строк с одним ключом.
 */
function DecisionCodesValue({
  decision,
  directory,
  language,
}: {
  decision: CreditDecision
  directory: CreditDecisionCodeIndex | undefined
  language: string | undefined
}) {
  const { t } = useTranslation('common')
  const meaning = normalizeDecisionCodes(decision.decision_codes ?? [])
  const legacyText = () =>
    decision.decline_codes
      .map((code) => {
        // Пустой запасной текст — признак «строки в словаре нет», а не сам код.
        const text = t(`credit.declineCode.${code}`, { defaultValue: '' })
        return text ? `${code} — ${text}` : code
      })
      .join('; ')

  if (meaning.length && !directory) {
    const differs = normalizeDecisionCodes(decision.decline_codes).join('\n') !== meaning.join('\n')
    return (
      <span className="flex flex-col gap-1">
        {decision.decline_codes.length > 0 && <span>{legacyText()}</span>}
        {differs && (
          <span className="text-muted-foreground text-xs">
            {t('credit.card.decisionCodesIds', { codes: meaning.join(', ') })}
          </span>
        )}
      </span>
    )
  }
  if (meaning.length && directory) {
    const sent =
      decision.decision_mode === 'manual' ? normalizeDecisionCodes(decision.decline_codes) : []
    const differs = sent.length > 0 && sent.join('\n') !== meaning.join('\n')
    return (
      <span className="flex flex-col gap-1">
        {meaning.map((id) => {
          const entry = directory.byId.get(id)
          return (
            <span key={id}>
              <span className="font-mono">{id}</span>
              {entry && (
                <>
                  {' — '}
                  {decisionCodeText(entry, language).primary}
                  <span className="text-muted-foreground">
                    {' · '}
                    {t(`credit.decisionCodeCategory.${entry.category}`, entry.category)}
                  </span>
                </>
              )}
            </span>
          )
        })}
        {differs && (
          <span className="text-muted-foreground text-xs">
            {t('credit.card.declineCodesSent', { codes: decision.decline_codes.join(', ') })}
          </span>
        )}
      </span>
    )
  }
  if (decision.decline_codes.length) {
    return <>{legacyText()}</>
  }
  return <>—</>
}

/**
 * Сбой справочника, который повтор не вылечит. 404 — у модуля нет двери
 * справочника (он старше 0.1.27), 403 — роли не дают читать справочник. Ответ
 * не изменится, пока администратор не обновит модуль или права, поэтому
 * «Повторити» здесь не предлагается. Остальное (5xx, сеть, таймаут) — `null`:
 * временный сбой, прежняя плашка с повтором. Ключи — статическими литералами:
 * страж словарей видит только их.
 */
function permanentDirectoryFailure(t: TFunction, error: unknown): string | null {
  if (error instanceof CreditApiError) {
    if (error.status === 404) return t('credit.card.decisionCodesModuleTooOld')
    if (error.status === 403) return t('credit.card.decisionCodesForbidden')
  }
  return null
}

function ApplicationDecision({
  application,
  canDecide,
  canConfirm,
}: {
  application: CreditApplicationDetail
  canDecide: boolean
  canConfirm: boolean
}) {
  const { t, i18n } = useTranslation('common')
  const decision = application.decision
  const decidable = DECIDABLE_STATUSES.includes(application.status)
  const mutation = useCreditManualDecision(application.application_id)
  // Дверь справочника закрыта тем же правом, что и само решение: без него
  // запрос не уходит, а карточка показывает коды одним `id`.
  const decisionCodes = useCreditDecisionCodes(canDecide)
  const directory = decisionCodes.data
  const language = i18n.resolvedLanguage ?? i18n.language
  const directoryFailure = decisionCodes.isError
    ? permanentDirectoryFailure(t, decisionCodes.error)
    : null

  const [outcome, setOutcome] = useState<CreditDecisionOutcome>('approved')
  const [amount, setAmount] = useState(String((application.requested_amount_minor ?? 0) / 100))
  const [rationale, setRationale] = useState('')
  const [codes, setCodes] = useState<string[]>([])
  const [answers, setAnswers] = useState<CreditChecklistAnswers>({})
  const [notes, setNotes] = useState<CreditChecklistNotes>({})
  const [conditionalCodes, setConditionalCodes] = useState<string[]>([])
  // Подтверждение прошло: карточка перезапросится подтверждённой, и кнопка уйдёт
  // вместе со своим компонентом — плашка успеха живёт здесь, а не в нём.
  const [confirmed, setConfirmed] = useState(false)

  // Условие действующего решения — из снимка (у роли без справочника тоже).
  const conditional = decision ? conditionalOf(decision) : null
  const confirmable =
    canConfirm && application.status === 'referred' && conditional?.stage === 'proposed'

  // Разбор скоринга читается ОДИН раз: по этому же чтению страница рисует панель
  // и решает, отсылает ли к ней строка под сырым снимком.
  const scorecard = useMemo(() => readScorecard(decision?.input_snapshot), [decision])

  // Сырой снимок — доказательство DAT-02, но без реквизитов счёта выплаты и
  // сумм пособий: счёт видно на вкладке IBV, класс дохода — в разборе скоринга,
  // если разбор на вкладке есть (ключ `scorecard`); иначе строка к нему не отсылает.
  const snapshot = useMemo(() => {
    const shown = snapshotForDisplay(decision?.input_snapshot)
    return {
      ...shown,
      text: JSON.stringify(shown.snapshot, null, 2),
      withBreakdown: scorecard !== null,
    }
  }, [decision, scorecard])

  // В тело и в замок кнопки идут только коды, которые справочник предлагает
  // СЕЙЧАС: отмеченный код, выпавший из отказов новой версии реестра, из формы
  // исчез, и снять его оператору уже нечем.
  const offered = useMemo(
    () =>
      new Set(directory?.declineGroups.flatMap((group) => group.codes.map((entry) => entry.id))),
    [directory]
  )
  const chosen = codes.filter((id) => offered.has(id))
  // Условие одобрения — тем же приёмом: только коды, которые справочник
  // предлагает сейчас. Выбран хоть один — это ПРЕДЛОЖЕНИЕ: `referred` с кодами,
  // и никогда `approved` с `AB-C-*` (модуль ответил бы 409).
  const conditionalChosen = normalizeDecisionCodes(
    conditionalCodes.filter((id) => directory?.conditional.some((entry) => entry.id === id))
  )
  const proposing = outcome === 'approved' && conditionalChosen.length > 0
  // Справочник загружен, а кодов условия в нём нет — ни пустой рамки, ни строки о
  // недоступности: условий в книге просто нет, одобрение обычное.
  const conditionalOffered = directory?.conditional ?? []
  // Условие отмечено, а справочник пропал — без блокировки ушло бы одобрение без условия.
  const conditionalLost = outcome === 'approved' && !directory && conditionalCodes.length > 0

  const submit = () => {
    const checklist = checklistPayload(answers, notes)
    const sentOutcome = proposing ? 'referred' : outcome
    mutation.mutate({
      outcome: sentOutcome,
      rationale: rationale.trim(),
      // Ключи ниже — по ВЫБРАННОМУ исходу: предложение (`referred`) намеренно несёт
      // `final_amount_minor` — из него модуль читает предложенную сумму.
      ...(outcome === 'approved' ? { final_amount_minor: Math.round(Number(amount) * 100) } : {}),
      ...(outcome === 'declined' ? { decline_codes: normalizeDecisionCodes(chosen) } : {}),
      ...(proposing ? { conditional_codes: conditionalChosen } : {}),
      ...(checklist ? { checklist } : {}),
    })
  }

  const toggleCode = (id: string) =>
    setCodes((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  const toggleConditional = (id: string) =>
    setConditionalCodes((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  // Отказ без кода модуль отвергает `422`; без справочника код выбрать нечем.
  const declineBlocked = outcome === 'declined' && (!directory || chosen.length === 0)

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
            <DecisionCodesValue
              decision={withoutConditionalCodes(decision)}
              directory={directory}
              language={language}
            />
          </Field>
          {conditional && (
            <Field label={t('credit.fields.conditionalCodes')}>
              <span className="flex flex-col gap-1">
                {conditional.codes.map((id) => {
                  const entry = directory?.byId.get(id)
                  return (
                    <span key={id}>
                      <span className="font-mono">{id}</span>
                      {entry && ` — ${decisionCodeText(entry, language).primary}`}
                    </span>
                  )
                })}
                <span className="flex flex-wrap items-center gap-2 text-xs">
                  {conditional.stage && (
                    <span className="bg-warning-100 text-warning-800 inline-flex h-6 items-center rounded-full px-2.5">
                      {t(`credit.conditionalStage.${conditional.stage}`, conditional.stage)}
                    </span>
                  )}
                  <span>
                    {t('credit.card.proposedAmount', {
                      amount: money(conditional.amountMinor, decision.currency),
                    })}
                  </span>
                </span>
                {confirmed && (
                  <Alert variant="success">{t('credit.card.conditionalConfirmed')}</Alert>
                )}
                {confirmable && !confirmed && (
                  <CreditConditionalConfirm
                    applicationId={application.application_id}
                    proposalDecisionId={decision.decision_id}
                    amount={money(conditional.amountMinor, decision.currency)}
                    codes={conditional.codes}
                    errorText={confirmErrorText}
                    onConfirmed={() => setConfirmed(true)}
                  />
                )}
              </span>
            </Field>
          )}
          {(decision.decision_mode === 'manual' ||
            decision.checklist_completed ||
            decision.input_snapshot?.checklist) && (
            <Field label={t('credit.fields.checklist')}>
              <CreditDecisionChecklistView
                completed={decision.checklist_completed}
                items={checklistItemsOf(decision)}
              />
            </Field>
          )}
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
          {/* Указатель, а не ссылка: двери «решение по id» в модуле нет
              (replayDecision отвечает 501), заявка несёт только действующее
              решение, и ссылка вела бы на эту же карточку или в никуда. Id с
              копированием — то, что оператор передаст разработчику.
              `null` — «ничего не заменяло», поэтому строки нет вовсе, а не
              прочерк, как у прочих идентификаторов. Ключа нет (модуль старше
              B-3) — строки тоже нет: такой модуль решений не пересматривает. */}
          {decision.supersedes_decision_id && (
            <CreditIdentifierRows
              items={[
                {
                  key: 'supersedes',
                  label: t('credit.fields.supersedesDecision'),
                  value: decision.supersedes_decision_id,
                },
              ]}
            />
          )}
        </Panel>
      )}

      {decision && (
        <CreditDecisionBasis
          snapshot={decision.input_snapshot}
          currency={decision.currency ?? application.currency}
        />
      )}

      {decision && scorecard && (
        <CreditScorecardBreakdown
          view={scorecard}
          currency={decision.currency ?? application.currency}
          directory={directory}
          language={language}
        />
      )}

      {decision && (
        <details className="border-border bg-card mb-4 rounded-xl border p-4 shadow-sm">
          <summary className="text-muted-foreground cursor-pointer text-xs">
            {t('credit.card.snapshot')}
          </summary>
          {/* В снимке остаются имя работодателя и свободные примечания — запись
              сессии его не читает. */}
          <pre
            {...piiProps}
            className="bg-secondary-900 mt-2 max-h-72 overflow-auto rounded-md p-3 font-mono text-[11px] text-white"
          >
            {snapshot.text}
          </pre>
          {snapshot.payoutHidden && (
            <p className="text-muted-foreground mt-2 text-xs">
              {t('credit.card.snapshotPayoutHidden')}
            </p>
          )}
          {snapshot.amountsHidden && (
            <p className="text-muted-foreground mt-2 text-xs">
              {snapshot.withBreakdown
                ? t('credit.card.snapshotAmountsHiddenSeeBreakdown')
                : t('credit.card.snapshotAmountsHidden')}
            </p>
          )}
        </details>
      )}

      {decidable && canDecide && (
        <Panel title={t('credit.card.manualDecision')}>
          {mutation.isError && (
            <Alert variant="error" className="mb-3">
              {manualDecisionErrorText(t, mutation.error)}
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
                onChange={(event) => {
                  setOutcome(event.target.value as CreditDecisionOutcome)
                  // Условие — только под «Схвалити»: при смене исхода отметки уходят
                  // с экрана, и в состоянии их тоже нет — возврат не вернёт их молча.
                  setConditionalCodes([])
                }}
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
          </div>

          {outcome === 'declined' && (
            <div className="mb-3">
              <p className="text-muted-foreground mb-1.5 text-xs">
                {t('credit.card.declineCodesHint')}
              </p>
              {/* Коды — только из справочника модуля. Ввода кода строкой и
                  запасного списка нет намеренно: второе текстовое поле обходит
                  закрытый реестр, а запасной список прячет, что справочник не
                  загрузился. Одобрение и направление на разбор работают и так. */}
              {directory ? (
                <div className="border-border max-h-80 overflow-auto rounded-md border p-3">
                  {directory.declineGroups.map((group) => (
                    <fieldset key={group.category} className="mb-3 last:mb-0">
                      <legend className="text-muted-foreground mb-1 text-xs font-semibold">
                        {t(`credit.decisionCodeCategory.${group.category}`, group.category)}
                      </legend>
                      {group.codes.map((entry) => {
                        const text = decisionCodeText(entry, language)
                        // Основание книги — текстом внутри метки, а не `title`:
                        // подсказку видит только мышь, а клавиатура, сенсор и
                        // скринридер — нет. Строка есть лишь там, где её отдаёт
                        // `decisionCodeNote` (русское основание — под `uk`).
                        const note = decisionCodeNote(entry, language)
                        return (
                          <label
                            key={entry.id}
                            className="flex cursor-pointer items-start gap-2 py-1 text-sm"
                          >
                            <input
                              type="checkbox"
                              className="mt-1 shrink-0"
                              checked={codes.includes(entry.id)}
                              onChange={() => toggleCode(entry.id)}
                            />
                            <span className="min-w-0">
                              <span className="font-mono text-xs">{entry.id}</span>{' '}
                              <span>{text.primary}</span>
                              <span className="text-muted-foreground block text-xs">
                                {text.secondary}
                              </span>
                              {note && (
                                <span className="text-muted-foreground block text-xs">{note}</span>
                              )}
                            </span>
                          </label>
                        )
                      })}
                    </fieldset>
                  ))}
                </div>
              ) : directoryFailure ? (
                <Alert variant="error" className="mb-2">
                  {directoryFailure}
                </Alert>
              ) : decisionCodes.isError || decisionCodes.isPaused ? (
                // Пауза — запрос, начатый без сети (`networkMode: 'online'`):
                // ни данных, ни ошибки, и без этой ветки оператор ждал бы
                // «Завантажуємо…» бесконечно при закрытом отказе. Это
                // временный сбой: своя строка и тот же повтор. Сеть вернулась —
                // React Query продолжит запрос сам.
                <>
                  <Alert variant="error" className="mb-2">
                    {decisionCodes.isPaused
                      ? t('credit.card.decisionCodesOffline')
                      : t('credit.card.decisionCodesUnavailable')}
                  </Alert>
                  <Button
                    size="sm"
                    variant="white-secondary"
                    isLoading={decisionCodes.isFetching}
                    onClick={() => void decisionCodes.refetch()}
                  >
                    {t('credit.actions.retry')}
                  </Button>
                </>
              ) : (
                <p className="text-muted-foreground text-xs">
                  {t('credit.card.decisionCodesLoading')}
                </p>
              )}
            </div>
          )}

          {outcome === 'approved' &&
            (conditionalOffered.length > 0 ? (
              <fieldset className="border-border mb-3 rounded-md border p-3">
                <legend className="text-muted-foreground px-1 text-xs font-semibold">
                  {t('credit.card.conditionalTitle')}
                </legend>
                {conditionalOffered.map((entry) => {
                  const text = decisionCodeText(entry, language)
                  const note = decisionCodeNote(entry, language)
                  return (
                    <label
                      key={entry.id}
                      className="flex cursor-pointer items-start gap-2 py-1 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 shrink-0"
                        checked={conditionalCodes.includes(entry.id)}
                        onChange={() => toggleConditional(entry.id)}
                      />
                      <span className="min-w-0">
                        <span className="font-mono text-xs">{entry.id}</span>{' '}
                        <span>{text.primary}</span>
                        <span className="text-muted-foreground block text-xs">
                          {text.secondary}
                        </span>
                        {note && (
                          <span className="text-muted-foreground block text-xs">{note}</span>
                        )}
                      </span>
                    </label>
                  )
                })}
              </fieldset>
            ) : (
              !directory &&
              decisionCodes.isError && (
                // Строка, а не плашка: одобрение без условия работает, а плашки
                // `alert` панели считают отказы решения.
                <p className="text-muted-foreground mb-3 text-xs">
                  {t('credit.card.conditionalUnavailable')}
                </p>
              )
            ))}

          <CreditDecisionChecklistForm
            answers={answers}
            notes={notes}
            // Снятый ответ — `undefined`: пункт не уходит, примечание остаётся в
            // состоянии и уйдёт снова, если пункт ответят (`checklistPayload`).
            onAnswer={(key, value) => setAnswers((prev) => ({ ...prev, [key]: value }))}
            onNote={(key, note) => setNotes((prev) => ({ ...prev, [key]: note }))}
          />

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
              disabled={
                !rationale.trim() || mutation.isPending || declineBlocked || conditionalLost
              }
              isLoading={mutation.isPending}
              onClick={submit}
            >
              {proposing
                ? t('credit.actions.proposeConditional')
                : t('credit.actions.saveDecision')}
            </Button>
            <span className="text-muted-foreground text-xs">{t('credit.card.state01')}</span>
          </div>
          {proposing && (
            <p className="text-muted-foreground mt-2 text-xs">{t('credit.card.conditionalHint')}</p>
          )}
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
  const timeline = application.timeline
  return (
    <>
      <Panel title={t('credit.tabs.history')}>
        {/* Хронология модуля уже несёт переходы статуса дорожкой `status`, поэтому
            `audit` рядом не выводится — переходы не дублируются. Нет поля или лента
            пуста (стенд отстаёт от контракта) — прежний список `audit` и честная
            пометка. В ленте нет ни одного перехода — `audit` остаётся под ней:
            иначе история статусов пропала бы молча. */}
        {hasTimeline(timeline) ? (
          <>
            <CreditApplicationTimeline
              timeline={timeline}
              portalEvents={application.portal_events}
              portalEventsTotal={application.portal_events_total}
            />
            {!hasStatusRows(timeline) && <AuditList application={application} />}
          </>
        ) : (
          <>
            <p className="text-muted-foreground mb-2 text-xs">{t('credit.timeline.notProvided')}</p>
            <AuditList application={application} />
          </>
        )}
        <ApplicationSignAndConsents application={application} />
      </Panel>
      <Panel title={t('credit.communications.title')}>
        <CreditCommunications clientId={application.client_id} timeline={timeline} />
      </Panel>
    </>
  )
}

function AuditList({ application }: { application: CreditApplicationDetail }) {
  const { t } = useTranslation('common')
  return (
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
  )
}

function ApplicationSignAndConsents({ application }: { application: CreditApplicationDetail }) {
  const { t } = useTranslation('common')
  return (
    <>
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
    </>
  )
}

export default CreditApplicationDetailPage
