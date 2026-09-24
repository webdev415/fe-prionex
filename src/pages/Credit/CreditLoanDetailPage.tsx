/**
 * Карточка кредита: паспорт, балансы, график, платежи, журнал проводок.
 *
 * Долг и его составляющие берутся из состояния ядра (`/loans/{id}/state`) —
 * того же среза, что видит клиент в личном кабинете.
 * Обязательство модуля вернуть клиенту излишек — из паспорта (`/loans/{id}`):
 * в состоянии ядра его нет, и к долгу оно не относится. Фронт ничего не
 * пересчитывает: любая «своя» арифметика здесь означала бы вторую версию правды.
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
  useCreditLoanDocuments,
  useCreditLoanJournal,
  useCreditLoanSchedule,
  useCreditLoanScheduleVersions,
  useCreditLoanState,
} from '@/features/credit/hooks/useCredit'
import { formatCreditMoney } from '@/features/credit/api/money'
import { normalizeDraft } from '@/features/credit/api/draft'
import type {
  CreditBalances,
  CreditBucket,
  CreditDisbursement,
  CreditDocumentMeta,
  CreditJournalEntry,
  CreditLoanDetail as LoanDetail,
  CreditLoanState,
  CreditPayment,
  CreditScheduleVersion,
} from '@/features/credit/api/types'
import {
  CREDIT_BUCKETS,
  CREDIT_DISBURSEMENT_FAILURE_CODES,
  CREDIT_DOCUMENT_META_KINDS,
  CREDIT_RAIL_REVIEW_REASONS,
} from '@/features/credit/api/enums'
import { CreditStatusBadge } from './components/CreditStatusBadge'
import { CreditDocumentOpenButton } from './components/CreditDocumentOpenButton'
import {
  CopyButton,
  CreditCardHeader,
  CreditNotice,
  type CreditHeaderMetric,
} from './components/CreditCardHeader'
import { Pii } from '@/lib/openreplay/pii'
import { CreditIdentifierRows } from './components/CreditIdentifiers'
import { loanAgeDays, todayInTimezone } from '@/features/credit/api/loanAge'
import { useNowTick } from '@/features/credit/hooks/useNowTick'

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
  // Корзина журнала: отбор делает СЕРВЕР, поэтому состояние живёт там же, где
  // зовётся хук. «Все корзины» — пустая строка, при которой объект параметров
  // не строится вовсе и запрос уходит без ключа `bucket`.
  const [journalBucket, setJournalBucket] = useState<CreditBucket | ''>('')
  const journalQuery = useCreditLoanJournal(
    loanId,
    journalBucket ? { bucket: journalBucket } : undefined
  )
  const versionsQuery = useCreditLoanScheduleVersions(loanId)
  const documentsQuery = useCreditLoanDocuments(loanId)
  const [scheduleVersion, setScheduleVersion] = useState<number | null>(null)
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
    { id: 'documents', label: t('credit.tabs.documents') },
    { id: 'journal', label: t('credit.tabs.journal') },
  ]

  const timezone = JURISDICTION_TIMEZONE[loan.jurisdiction]
  const borrower = applicationQuery.data
    ? normalizeDraft(applicationQuery.data.draft, applicationQuery.data.client_email)
    : null
  const nextPayment = state?.next_payment ?? loan.next_payment
  const dpd = state?.delinquency.delinquency_days ?? loan.delinquency_days
  const validationFailed = state?.flags?.validation_valid === false
  // Версии графика приходят отдельным списком со ВСЕМИ взносами, поэтому
  // выбранную версию берём оттуда, не гоняя лишний запрос за каждой.
  const scheduleVersions = versionsQuery.data?.items ?? []
  const selectedSchedule =
    scheduleVersion !== null
      ? scheduleVersions.find((version) => version.version === scheduleVersion)
      : (scheduleQuery.data ?? scheduleVersions[scheduleVersions.length - 1])

  // Плитки шапки — главные цифры кредита. Порядок продиктован разговором с
  // клиентом: сколько должен → сколько уже отдал → когда следующий платёж →
  // насколько просрочен.
  const balances = state?.balances
  const metrics: CreditHeaderMetric[] = [
    {
      key: 'balance',
      label: t('credit.fields.balance'),
      // Запасного значения из поля займа здесь НЕТ намеренно. Раньше стояло
      // `?? loan.balance_total_minor`, и это выглядело осторожностью, а по
      // факту было подменой источника: модуль отдаёт в этом поле `null`
      // (проверено на живом кредите), поэтому «запасной путь» всегда давал
      // прочерк — правду, но случайно.
      //
      // Опаснее другое: деньги, показанные оператору, обязаны приходить из
      // ТОГО ЖЕ расчёта, что видит клиент, — из состояния ядра. Тихо
      // подставить сюда поле займа значило бы назвать клиенту и оператору
      // разные суммы, а это хуже прочерка. Нет состояния — нет числа.
      value: money(balances?.total_due_minor, loan.currency),
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
                <Pii>{borrower.fullName || t('credit.card.borrowerUnknown')}</Pii>
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
        {tab === 'passport' && (
          <LoanPassport
            loan={loan}
            state={state}
            stateLoading={stateQuery.isLoading}
            stateError={stateQuery.error}
          />
        )}
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
            schedule={selectedSchedule}
            versions={versionsQuery.data?.items ?? []}
            selectedVersion={scheduleVersion}
            onSelectVersion={setScheduleVersion}
            isLoading={scheduleQuery.isLoading || versionsQuery.isLoading}
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
        {tab === 'documents' && (
          <LoanDocuments
            loanId={loan.loan_id}
            documents={documentsQuery.data?.items ?? []}
            isLoading={documentsQuery.isLoading}
            error={documentsQuery.error}
            onRetry={() => void documentsQuery.refetch()}
          />
        )}
        {tab === 'journal' && (
          <LoanJournal
            entries={journalQuery.data?.items ?? []}
            bucket={journalBucket}
            onBucketChange={setJournalBucket}
            isLoading={journalQuery.isLoading}
            error={journalQuery.error}
            onRetry={() => void journalQuery.refetch()}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Статусы кредита, при которых деньги ОБЯЗАНЫ были двинуться.
 *
 * Нужны для единственного случая: попытки отправки нет вовсе. У живого
 * кредита отсутствие блока ничего не значит и лишняя панель только отвлекает,
 * а у застрявшего — это и есть ответ на вопрос «почему клиент без денег».
 */
const AWAITING_MONEY = new Set(['pending_disbursement', 'disbursement_failed', 'funding_exception'])

/** Тона выплаты — своим словарём, а не через `CreditStatusBadge`.
 *  Там `cancelled` уже занят статусом кредита и покрашен красным, а отозванная
 *  выплата — предупреждение: общий словарь дал бы одному слову два смысла. */
const DISBURSEMENT_TONE: Record<CreditDisbursement['state'], string> = {
  pending: 'bg-muted text-muted-foreground',
  settled: 'bg-success-100 text-success-700',
  failed: 'bg-error-100 text-error-700',
  reversed: 'bg-error-100 text-error-700',
  cancelled: 'bg-warning-100 text-warning-800',
  unknown: 'bg-error-100 text-error-700',
}

type RetryVerdict =
  | 'available'
  | 'reviewOpen'
  | 'notFailed'
  | 'settled'
  | 'inFlight'
  | 'unknownState'

/**
 * Можно ли повторить отправку — ПО УСЛОВИЮ КОМАНДЫ, а не по флагу модуля.
 *
 * `retry_allowed` модуль считает как `state ∈ {failed, cancelled, reversed}`
 * (`app/loans.py:229,281`), а команда возобновления
 * `POST /rails/loans/{id}/resume-disbursement` отвечает 409, если последняя
 * попытка не `failed` (`disbursement_not_failed`) либо по ней открыт разбор
 * (`disbursement_review_not_resolved`). Предикаты разъехались, и на стенде
 * 31.08.2026 из-за этого отказ получили бы ВСЕ 16 «разрешённых» повторов:
 * шесть `reversed` — по первому охраннику, десять `failed` с открытым
 * разбором — по второму. Пока модуль не свёл флаг к условию команды, читать
 * флаг как разрешение нельзя — повторяем условие команды здесь.
 */
function retryVerdict(disbursement: CreditDisbursement): RetryVerdict {
  if (disbursement.state === 'failed') {
    return disbursement.review_reason === null ? 'available' : 'reviewOpen'
  }
  if (disbursement.state === 'settled') return 'settled'
  if (disbursement.state === 'pending') return 'inFlight'
  if (disbursement.state === 'unknown') return 'unknownState'
  return 'notFailed'
}

/**
 * Выплата прошла ровно: деньги зачислены, отказа не было, человека не ждёт и
 * дата зачисления известна от провайдера, а не выведена нами.
 *
 * Такому кредиту блок не нужен — дата выдачи уже стоит в паспорте, и вторая
 * панель об одном и том же добавляет шума, а не смысла. Показывать блок стоит
 * ровно тогда, когда в нём есть что прочитать.
 */
function isRoutineDisbursement(disbursement: CreditDisbursement): boolean {
  return (
    disbursement.state === 'settled' &&
    disbursement.failure_code === null &&
    disbursement.failed_at === null &&
    disbursement.review_reason === null &&
    disbursement.provider_time_source !== 'observed'
  )
}

/**
 * Ход выдачи денег.
 *
 * Заводится потому, что до сих пор оператор у кредита с неудавшейся выдачей
 * видел один бейдж «Видача не пройшла» и ничего больше — при том что причина,
 * даты и признак ожидания разбора уже лежали в `/loans/{id}/state`, который
 * карточка и так запрашивает.
 *
 * Кнопки повтора здесь нет НАМЕРЕННО (см. `retryVerdict`): показать «повторити»
 * там, где команда ответит 409, хуже, чем не показать ничего, — оператор жмёт
 * и делает вывод, что сломана система, а не что расходятся два предиката.
 */
function LoanDisbursement({
  loan,
  state,
  isLoading,
  error,
}: {
  loan: LoanDetail
  state?: CreditLoanState
  isLoading: boolean
  error: unknown
}) {
  const { t } = useTranslation('common')
  const timezone = JURISDICTION_TIMEZONE[loan.jurisdiction]
  const disbursement = state?.disbursement

  // «Попытки не было» и «мы не знаем» — РАЗНЫЕ ответы на вопрос «почему клиент
  // без денег», и путать их дороже всего именно здесь. Пока состояние ядра
  // грузится или запрос упал, `disbursement` тоже пуст — и панель раньше
  // говорила категоричное «спроби переказу не було жодної». Оператор передавал
  // это клиенту, тогда как перевод мог уйти и провалиться.
  //
  // Это ровно тот дефект, что уже был у графика («Графіка ще немає» на упавшем
  // запросе), поэтому лечим тем же способом, что и соседние панели.
  if (isLoading) {
    return (
      <Panel title={t('credit.card.disbursement')}>
        <TableSkeleton columns={2} rows={3} />
      </Panel>
    )
  }
  if (error) {
    return (
      <Panel title={t('credit.card.disbursement')}>
        <p className="text-muted-foreground text-sm">{t('credit.card.disbursementUnknown')}</p>
      </Panel>
    )
  }

  if (!disbursement) {
    if (!AWAITING_MONEY.has(loan.status)) return null
    return (
      <Panel title={t('credit.card.disbursement')}>
        <p className="text-muted-foreground text-sm">{t('credit.card.disbursementNotSent')}</p>
      </Panel>
    )
  }
  if (isRoutineDisbursement(disbursement)) return null

  const verdict = retryVerdict(disbursement)
  // Код провайдера, которого мы не знаем, — это не пропущенный перевод, а
  // чужой словарь. Показываем его как чужое слово, а не как голое имя ключа.
  const failureText =
    disbursement.failure_code === null
      ? '—'
      : (CREDIT_DISBURSEMENT_FAILURE_CODES as readonly string[]).includes(disbursement.failure_code)
        ? t(`credit.disbursementFailure.${disbursement.failure_code}`)
        : t('credit.card.disbursementUnknownCode', { code: disbursement.failure_code })
  const reviewText =
    disbursement.review_reason === null
      ? null
      : (CREDIT_RAIL_REVIEW_REASONS as readonly string[]).includes(disbursement.review_reason)
        ? t(`credit.railReviewReason.${disbursement.review_reason}`)
        : t('credit.card.disbursementUnknownCode', { code: disbursement.review_reason })

  return (
    <Panel
      title={t('credit.card.disbursement')}
      footer={t('credit.card.disbursementNoRetryButton')}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${DISBURSEMENT_TONE[disbursement.state]}`}
        >
          <span className="h-2 w-2 rounded-full bg-current opacity-70" />
          {t(`credit.disbursementState.${disbursement.state}`)}
        </span>
        <span className="text-muted-foreground text-sm">
          {t('credit.card.disbursementUpdated', {
            when: formatDateTime(disbursement.updated_at, timezone),
          })}
        </span>
      </div>

      {reviewText && (
        <CreditNotice className="mb-3">
          {disbursement.review_raised_at
            ? t('credit.card.disbursementReview', {
                reason: reviewText,
                since: formatDateTime(disbursement.review_raised_at, timezone),
              })
            : t('credit.card.disbursementReviewNoDate', { reason: reviewText })}
        </CreditNotice>
      )}

      {/* Дата зачисления, выведенная нами, и дата от провайдера — разные вещи:
          от неё считается регуляторное окно отказа, и «оценено» надо сказать
          вслух, иначе срок клиента выглядит посчитанным. */}
      {disbursement.provider_time_source === 'observed' && (
        <CreditNotice className="mb-3">{t('credit.card.disbursementObservedTime')}</CreditNotice>
      )}

      <Field label={t('credit.fields.disbursementAmount')}>
        {money(disbursement.amount_minor, disbursement.currency)}
      </Field>
      <Field label={t('credit.fields.disbursementMethod')}>
        {t(`credit.disbursementMethod.${disbursement.method}`)}
      </Field>
      <Field label={t('credit.fields.settledAt')}>
        {formatDateTime(disbursement.settled_at ?? undefined, timezone)}
      </Field>
      <Field label={t('credit.fields.failedAt')}>
        {formatDateTime(disbursement.failed_at ?? undefined, timezone)}
      </Field>
      <Field label={t('credit.fields.failureCode')}>{failureText}</Field>
      <Field label={t('credit.fields.timeSource')}>
        {disbursement.provider_time_source
          ? t(`credit.providerTimeSource.${disbursement.provider_time_source}`)
          : '—'}
      </Field>
      <Field label={t('credit.fields.provider')}>{disbursement.provider}</Field>
      <Field label={t('credit.fields.providerTxId')}>
        {disbursement.provider_tx_id ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="font-mono text-xs">{disbursement.provider_tx_id}</span>
            <CopyButton value={disbursement.provider_tx_id} label={t('credit.actions.copy')} />
          </span>
        ) : (
          '—'
        )}
      </Field>
      {/* Слово провайдера как есть: перевод чужого статуса — это уже наша
          трактовка, а по нему сверяются с поддержкой рельса дословно. */}
      <Field label={t('credit.fields.providerStatus')}>{disbursement.provider_status ?? '—'}</Field>
      <Field label={t('credit.fields.clientTransactionId')}>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-mono text-xs">{disbursement.client_transaction_id}</span>
          <CopyButton value={disbursement.client_transaction_id} label={t('credit.actions.copy')} />
        </span>
      </Field>
      <Field label={t('credit.fields.retry')}>{t(`credit.disbursementRetry.${verdict}`)}</Field>

      {disbursement.retry_allowed && verdict !== 'available' && (
        <CreditNotice className="mt-3">
          {t('credit.card.disbursementRetryContradiction')}
        </CreditNotice>
      )}
      {disbursement.provider === 'mock' && (
        <CreditNotice className="mt-3" tone="info">
          {t('credit.card.mockProviderWarning', { provider: disbursement.provider })}
        </CreditNotice>
      )}
    </Panel>
  )
}

/**
 * Деньги, которые МОДУЛЬ должен клиенту, — не долг клиента. Излишек бывает у
 * кредита, снятого в карантине выдачи, когда клиент вернул больше тела.
 *
 * (а) Не в «Складові боргу»: всё, что там стоит, оператор читает как
 *     составляющую долга, а там уже живёт переплата из `/state`. Поле приходит
 *     в паспорте, поэтому и панель — на вкладке паспорта, без `/state`.
 * (б) `Number.isFinite`, а не `> 0`: у отстающего модуля ключа нет, и `> 0`
 *     молча убрал бы панель — экран сказал бы «излишка нет», не зная этого.
 *     Нет ключа — своя фраза и никакой суммы: прочерк читался бы как «пусто».
 *     И заголовок — имя величины, а не «Винні клієнту»: заголовок не
 *     утверждает того, чего не знает тело.
 * (в) Без тона тревоги: красное и жёлтое в разделе значат «клиент в минусе»,
 *     а это нейтральный факт, который оператор сообщает клиенту.
 * (г) Ни с чем не складывается: сумма печатается как пришла, ни в баланс, ни
 *     в «Сплачено» не входит.
 */
function LoanOwedToClient({ loan }: { loan: LoanDetail }) {
  const { t } = useTranslation('common')
  const excess = loan.advance_refund_excess_minor
  if (Number.isFinite(excess) && excess <= 0) return null

  return (
    <Panel
      title={
        Number.isFinite(excess)
          ? t('credit.card.owedToClient')
          : t('credit.fields.advanceRefundExcess')
      }
    >
      {Number.isFinite(excess) ? (
        <>
          <Field label={t('credit.fields.advanceRefundExcess')}>
            <span className="tabular-nums">{money(excess, loan.currency)}</span>
          </Field>
          <p className="text-muted-foreground mt-1 text-xs">{t('credit.card.owedToClientHint')}</p>
        </>
      ) : (
        <p className="text-muted-foreground text-sm">{t('credit.card.owedToClientUnknown')}</p>
      )}
    </Panel>
  )
}

function LoanPassport({
  loan,
  state,
  stateLoading,
  stateError,
}: {
  loan: LoanDetail
  state?: CreditLoanState
  // Состояние запроса тянем сюда только ради панели выдачи: она обязана
  // отличать «попытки не было» от «мы не знаем».
  stateLoading: boolean
  stateError: unknown
}) {
  const { t } = useTranslation('common')
  // Возраст кредита считается от «сейчас», когда среза сервиса ещё нет, и без
  // собственного тика замер бы на моменте открытия карточки: смена дал бы
  // «14 днів» до самого закрытия вкладки.
  const now = useNowTick()
  const timezone = JURISDICTION_TIMEZONE[loan.jurisdiction]
  const caps = state?.caps
  const capEntries = caps ? Object.entries(caps) : []
  const failedCaps = capEntries.filter(([, ok]) => !ok)
  // Считаем от СЕГОДНЯ В ЮРИСДИКЦИИ, как это делает кабинет клиента, а не от
  // `as_of`: тот равен горизонту ночного расчёта и уходит вперёд — на стенде
  // кредиты, выданные 31.08, имели `as_of` 04.10, и оператор увидел бы «34
  // днів» там, где клиент видит «1 день».
  const ageDays = loanAgeDays(loan.disbursed_at, todayInTimezone(now, timezone))

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
        {/* Зона обязательна: без неё дата выдачи рисуется по часам браузера, а
            возраст рядом считается по календарю юрисдикции. Канадская выдача
            после ~15:00 по местному времени попадала у киевского оператора в
            следующие сутки — «видано сьогодні, живе день» в соседних строках. */}
        <Field label={t('credit.fields.disbursedAt')}>
          {formatDateTime(loan.disbursed_at, timezone)}
        </Field>
        {/* Сколько кредит живёт. Поля в модуле нет — это разность дат (см.
            loanAge.ts), поэтому и стоит рядом с датой выдачи, из которой
            посчитано, а не в шапке среди цифр, пришедших от сервиса. */}
        <Field label={t('credit.fields.loanAgeDays')}>{ageDays === null ? '—' : ageDays}</Field>
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

      <LoanOwedToClient loan={loan} />

      <LoanDisbursement loan={loan} state={state} isLoading={stateLoading} error={stateError} />

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

      <Panel title={t('credit.card.identifiers')}>
        <CreditIdentifierRows
          items={[
            { key: 'loan', label: t('credit.fields.loanId'), value: loan.loan_id },
            {
              key: 'application',
              label: t('credit.fields.applicationId'),
              value: loan.application_id,
            },
          ]}
        />
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
  versions,
  selectedVersion,
  onSelectVersion,
  isLoading,
  error,
  onRetry,
  nextDueDate,
}: {
  loan: LoanDetail
  schedule?: CreditScheduleVersion
  versions: CreditScheduleVersion[]
  selectedVersion: number | null
  onSelectVersion: (version: number | null) => void
  isLoading: boolean
  error: unknown
  onRetry: () => void
  nextDueDate?: string
}) {
  const { t } = useTranslation('common')
  const items = schedule?.items ?? []
  // Актуальная версия может быть ПУСТОЙ (сторнированная выдача), а взносы —
  // в предыдущей. Показать «графіка немає» здесь значит скрыть, что график был.
  const lastNonEmpty = [...versions].reverse().find((version) => (version.items ?? []).length > 0)
  const emptyButHasHistory =
    items.length === 0 && lastNonEmpty !== undefined && lastNonEmpty.version !== schedule?.version
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
      isEmpty={items.length === 0 && !emptyButHasHistory}
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
      {emptyButHasHistory && (
        <div className="bg-warning-100 text-warning-800 mb-3 rounded-lg px-4 py-3 text-sm">
          {t('credit.card.scheduleVersionEmpty', {
            version: schedule?.version ?? '—',
            reason: t(`credit.scheduleReason.${schedule?.reason}`, schedule?.reason ?? ''),
            previous: lastNonEmpty?.version ?? '—',
          })}{' '}
          <button
            type="button"
            className="underline"
            onClick={() => onSelectVersion(lastNonEmpty?.version ?? null)}
          >
            {t('credit.card.openPreviousVersion')}
          </button>
        </div>
      )}

      {versions.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">{t('credit.card.scheduleHistory')}</span>
          {versions.map((version) => {
            const active = (selectedVersion ?? schedule?.version) === version.version
            return (
              <button
                key={version.version}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectVersion(version.version)}
                className={`h-8 rounded-full border px-3.5 text-xs font-medium ${
                  active
                    ? 'bg-secondary-800 border-secondary-800 text-white'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted'
                }`}
                title={t(`credit.scheduleReason.${version.reason}`, version.reason)}
              >
                {t('credit.card.versionShort', { version: version.version })}
              </button>
            )
          })}
        </div>
      )}

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
            <th className="py-2 pr-6 text-right font-medium">{t('credit.columns.amount')}</th>
            <th className="py-2 text-left font-medium">{t('credit.columns.allocation')}</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => {
            // Сторно проверяем по значению, а не по наличию поля: модуль
            // отдаёт `state` всегда, и если он однажды пропадёт — это дефект
            // модуля, который должен быть виден, а не тихо приравнен к
            // обычному платежу.
            const reversed = payment.state === 'reversed'
            return (
              <tr key={payment.payment_id} className="border-border border-b last:border-0">
                <td className="py-2">{formatDate(payment.effective_date)}</td>
                <td className="py-2 pr-6 text-right tabular-nums">
                  {/* Зачёркивание и подпись — не только цвет: иначе разницу
                      не увидят ни в чёрно-белой печати, ни при дальтонизме,
                      а разговор «я же платил» начинается именно с неё. */}
                  <span className={reversed ? 'text-muted-foreground line-through' : undefined}>
                    {money(payment.amount_minor, currency)}
                  </span>
                  {reversed && (
                    <span className="text-error-600 mt-0.5 block text-xs whitespace-nowrap">
                      {t('credit.card.paymentReversedOn', {
                        date: formatDate(payment.reversed_on ?? undefined),
                      })}
                    </span>
                  )}
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
            )
          })}
        </tbody>
      </table>
      {/* Без этой строки на экране необъяснённое расхождение: плитка «Сплачено»
          считает только зачтённое, а таблица показывает все строки. Оператор
          видит три платежа, система — один. */}
      {payments.some((payment) => payment.state === 'reversed') && (
        <p className="text-muted-foreground mt-3 text-xs">
          {t('credit.card.paymentsReversedHint', {
            count: payments.filter((payment) => payment.state === 'reversed').length,
            amount: money(
              payments
                .filter((payment) => payment.state === 'reversed')
                .reduce((sum, payment) => sum + payment.amount_minor, 0),
              currency
            ),
          })}
        </p>
      )}
    </AsyncPanel>
  )
}

function LoanDocuments({
  loanId,
  documents,
  isLoading,
  error,
  onRetry,
}: {
  loanId: string
  documents: CreditDocumentMeta[]
  isLoading: boolean
  error: unknown
  onRetry: () => void
}) {
  const { t } = useTranslation('common')
  const [failure, setFailure] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
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
    <AsyncPanel
      title={t('credit.tabs.documents')}
      isLoading={isLoading}
      error={error}
      isEmpty={documents.length === 0}
      emptyText={t('credit.card.noLoanDocuments')}
      onRetry={onRetry}
      footer={t('credit.card.documentsCurrentOnly')}
    >
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
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border text-muted-foreground border-b text-xs">
            <th className="py-2 pr-3 text-left font-medium">{t('credit.columns.documentKind')}</th>
            <th className="py-2 pr-3 text-left font-medium">{t('credit.columns.documentFile')}</th>
            <th className="py-2 pr-3 text-left font-medium">
              {t('credit.fields.templateVersion')}
            </th>
            <th className="py-2 pr-3 text-left font-medium">{t('credit.columns.uploaded')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <tr key={doc.document_id} className="border-border border-b last:border-0">
              <td className="py-2 pr-3">
                {CREDIT_DOCUMENT_META_KINDS.includes(doc.kind)
                  ? t(`credit.documentKind.${doc.kind}`)
                  : t('credit.documentKind.unknown', { code: doc.kind })}
              </td>
              <td className="py-2 pr-3 font-mono text-xs">{doc.title ?? doc.document_id}</td>
              <td className="text-muted-foreground py-2 pr-3 text-xs">
                {doc.template_version ?? '—'}
              </td>
              <td className="text-muted-foreground py-2 pr-3 text-xs">
                {formatDateTime(doc.generated_at)}
              </td>
              <td className="py-2 text-right">
                <CreditDocumentOpenButton
                  document={doc}
                  owner={{ kind: 'loan', id: loanId }}
                  onError={showFailure}
                  onNotice={showNotice}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AsyncPanel>
  )
}

/**
 * Журнал проводок с отбором по корзине.
 *
 * (а) Отбор делает СЕРВЕР — параметр `bucket` уходит в запрос, а массив
 *     `entries` здесь не фильтруется. Клиентский `filter` обманул бы дважды:
 *     `PAGE = 60` режет хвост ДО отбора («в корзине пусто» = «они на 61-й»),
 *     и объявленный дверью параметр остался бы мёртвым.
 * (б) Селектор и пометка живут НАД `AsyncPanel`: он при загрузке, ошибке и
 *     пустоте рисует ВМЕСТО children, и фильтр исчезал бы ровно тогда, когда
 *     его результат пуст, — снять его было бы нечем, кроме перезагрузки.
 * (в) Пометка под активным фильтром говорит о свойстве ВЫБОРКИ: компенсирующая
 *     запись могла остаться за фильтром, и незачёркнутая строка не означает
 *     «деньги действующие». Она одна на панель, а не у каждой строки:
 *     достоверного признака у экрана нет по построению, и шестьдесят повторов
 *     одного предложения читать перестают.
 * (г) Второй ключ сортировки — `posted_at`, а НЕ `seq`: модуль нумерует `seq`
 *     ПОСЛЕ отбора, и под фильтром одна и та же проводка получает другой номер.
 *     `seq` остаётся третьим ключом — только для ничьей по `posted_at` и только
 *     как порядок внутри одного ответа, где он и есть порядок записи.
 */
function LoanJournal({
  entries,
  bucket,
  onBucketChange,
  isLoading,
  error,
  onRetry,
}: {
  entries: CreditJournalEntry[]
  bucket: CreditBucket | ''
  onBucketChange: (bucket: CreditBucket | '') => void
  isLoading: boolean
  error: unknown
  onRetry: () => void
}) {
  const { t } = useTranslation('common')
  const [expanded, setExpanded] = useState(false)
  const PAGE = 60
  // Порядок задаём явно: полагаться на порядок ответа — значит молча
  // перепутать проводки, когда сервис сменит сортировку. Ничья по
  // `posted_at` — обычный случай: проводки одной операции пишутся одной
  // транзакцией и несут одно `now()`. Её разбирает `seq`: значение под фильтром
  // другое, но относительный порядок внутри одного ответа — порядок записи.
  const ordered = [...entries].sort(
    (a, b) =>
      b.business_date.localeCompare(a.business_date) ||
      b.posted_at.localeCompare(a.posted_at) ||
      b.seq - a.seq
  )
  const visible = expanded ? ordered : ordered.slice(0, PAGE)
  const reversed = new Set(ordered.map((e) => e.reversal_of_entry_id).filter(Boolean) as string[])

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="text-muted-foreground flex flex-col gap-1.5 text-xs">
          {t('credit.columns.bucket')}
          <select
            className="border-input-border bg-card text-foreground h-10 rounded-md border px-3 text-sm"
            value={bucket}
            onChange={(event) => {
              // Раскрытый срез прежней корзины не переносится: иначе `PAGE`
              // отключался бы в каждой следующей. Сброс — в том же событии, а
              // не `key` (пересоздал бы `<select>` и снял бы с него фокус) и не
              // эффект (кадр между сменой и эффектом рисует весь список).
              setExpanded(false)
              onBucketChange(event.target.value as CreditBucket | '')
            }}
          >
            <option value="">{t('credit.filters.anyBucket')}</option>
            {/* Итерация по словарю кода, а не семь строк руками: дверь значение
                со словарём не сверяет и на неизвестное отвечает 200 с пустым
                `items` — опечатка дошла бы до оператора как «в корзине пусто». */}
            {CREDIT_BUCKETS.map((name) => (
              <option key={name} value={name}>
                {t(`credit.bucket.${name}`, name)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {bucket !== '' && (
        <CreditNotice>{t('credit.card.journalBucketReversalUnknown')}</CreditNotice>
      )}

      <AsyncPanel
        title={t('credit.tabs.journal')}
        isLoading={isLoading}
        error={error}
        isEmpty={entries.length === 0}
        emptyText={bucket ? t('credit.card.noJournalInBucket') : t('credit.card.noJournal')}
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
              <th className="py-2 pr-3 text-left font-medium">{t('credit.columns.date')}</th>
              <th className="py-2 pr-3 text-left font-medium">{t('credit.columns.entryType')}</th>
              <th className="py-2 pr-3 text-left font-medium">{t('credit.columns.bucket')}</th>
              <th className="py-2 pr-3 text-right font-medium">
                {t('credit.columns.installment')}
              </th>
              <th className="py-2 pr-3 text-right font-medium">{t('credit.columns.amount')}</th>
              <th className="py-2 text-left font-medium">{t('credit.columns.rule')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((entry) => {
              const isReversed = reversed.has(entry.entry_id)
              // Пометка «(сторно)» нужна там, где по типу это не видно:
              // компенсирующей может быть и `cancellation`. У самого
              // `reversal` она давала тавтологию «Сторнування (сторно)».
              const isReversal =
                Boolean(entry.reversal_of_entry_id) && entry.entry_type !== 'reversal'
              return (
                <tr
                  key={entry.entry_id}
                  className={`border-border border-b last:border-0 ${
                    isReversed ? 'text-muted-foreground line-through' : ''
                  }`}
                >
                  <td className="py-2 pr-3">{formatDate(entry.business_date)}</td>
                  <td className="py-2 pr-3">
                    {t(`credit.entryType.${entry.entry_type}`, entry.entry_type)}
                    {isReversal && (
                      <span className="text-muted-foreground ml-1 text-xs">
                        {t('credit.card.isReversal')}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{t(`credit.bucket.${entry.bucket}`, entry.bucket)}</td>
                  <td className="text-muted-foreground py-2 pr-3 text-right tabular-nums">
                    {entry.installment_seq ?? '—'}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">
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
    </div>
  )
}

export default CreditLoanDetailPage
