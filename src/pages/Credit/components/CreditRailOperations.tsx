/**
 * «Операції Zūm» — все операции рельса кредита под таблицей платежей (17-6f).
 *
 * Операция и платёж — разные сущности: неудавшееся списание платежа не даёт, у
 * выплаты платежа нет вовсе. Поэтому операции — своей таблицей, а не строками
 * таблицы платежей: слить их значило бы выдумать платёж у отказа или спрятать
 * отказ. Связь в обе стороны — по `payment_id`: ячейка «Платіж» здесь и метка
 * со ссылкой в строке платежа.
 *
 * Хуков данных панель не зовёт: ответ двери, платежи и пояс приходят пропсами
 * от вкладки, которая зовёт хук один раз на обе таблицы.
 *
 * Модуль старше двери отвечает `404` с `code: "not_found"` — тем же ответом,
 * что чужой кредит. Карточка кредита уже загрузилась, значит кредит наш, и
 * остаётся «модуль старший» — это и говорит панель, без кнопки повтора: повтор
 * ответит тем же. `404` без кода — от шлюза, это обычный отказ с повтором.
 */
import { useTranslation } from 'react-i18next'
import { CreditApiError } from '@/features/credit/api/creditApi'
import { CREDIT_DISBURSEMENT_METHODS } from '@/features/credit/api/enums'
import { formatCreditMoney } from '@/features/credit/api/money'
import {
  callbackLines,
  eventLabel,
  eventLines,
  eventText,
  isBlankStatus,
  noCallbackText,
  nonZumProviders,
  paymentCellOf,
  railCodeLabel,
  railFailureText,
  railOperationAnchor,
  statusLabel,
  statusText,
  submissionOf,
} from '@/features/credit/api/railOperations'
import type {
  CreditLoanRailOperations,
  CreditPayment,
  CreditRailOperation,
} from '@/features/credit/api/types'
import { formatDate, formatDateTime } from '@/lib/formatters'
import { CopyButton, CreditNotice } from './CreditCardHeader'
import { AsyncPanel, CreditRailStateBadge, Panel } from './CreditPanel'

type Translate = ReturnType<typeof useTranslation>['t']

/** Мелкая строка ячейки: подписи, дословные слова, пометки. */
function Small({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground block text-xs">{children}</span>
}

/** Дверь не отвечает этой сборке модуля — не отказ, а отсутствие функции. */
function isDoorMissing(error: unknown): boolean {
  return error instanceof CreditApiError && error.status === 404 && error.code === 'not_found'
}

export function CreditRailOperations({
  page,
  isLoading,
  error,
  onRetry,
  zone,
  payments,
  paymentsReady,
}: {
  page?: CreditLoanRailOperations
  isLoading: boolean
  error: unknown
  onRetry: () => void
  /** Пояс юрисдикции кредита — один на вкладку. */
  zone: string
  payments: readonly CreditPayment[]
  /** Платежи загружены: иначе «не знайдено» было бы ложью о платеже, которого ещё не читали. */
  paymentsReady: boolean
}) {
  const { t } = useTranslation('common')
  const title = t('credit.railOps.title')

  if (isDoorMissing(error)) {
    return (
      <Panel title={title}>
        <p className="text-muted-foreground text-sm">{t('credit.railOps.unavailable')}</p>
      </Panel>
    )
  }

  const operations = page?.items ?? []
  const total = page?.total ?? operations.length

  return (
    <AsyncPanel
      title={title}
      isLoading={isLoading}
      error={error}
      isEmpty={operations.length === 0}
      emptyText={t('credit.railOps.empty')}
      onRetry={onRetry}
      footer={t('credit.railOps.footer', { zone })}
    >
      {/* По одному на каждого не боевого провайдера: на стенде все операции
          синтетические, и оператор не должен принять их за банк. */}
      {nonZumProviders(operations).map((provider) => (
        <CreditNotice key={provider} tone="info">
          {t('credit.card.mockProviderWarning', { provider })}
        </CreditNotice>
      ))}
      {/* Страховка, а не норма: по контракту дверь отдаёт все операции. */}
      {total > operations.length && (
        <p className="text-muted-foreground mb-3 text-xs">
          {t('credit.railOps.truncated', { shown: operations.length, total })}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-xs">
              <th className="py-2 pr-3 text-left font-medium">
                {t('credit.railOps.columns.operation')}
              </th>
              <th className="py-2 pr-3 text-left font-medium">
                {t('credit.railOps.columns.submitted')}
              </th>
              <th className="py-2 pr-3 text-left font-medium">
                {t('credit.railOps.columns.callback')}
              </th>
              <th className="py-2 pr-3 text-left font-medium">
                {t('credit.railOps.columns.events')}
              </th>
              <th className="py-2 pr-3 text-left font-medium">
                {t('credit.railOps.columns.meaning')}
              </th>
              <th className="py-2 text-left font-medium">{t('credit.railOps.columns.payment')}</th>
            </tr>
          </thead>
          <tbody>
            {operations.map((op) => (
              <tr
                key={op.client_transaction_id}
                id={railOperationAnchor(op)}
                className="border-border border-b align-top last:border-0"
              >
                <td className="py-2 pr-3">
                  <OperationCell op={op} t={t} />
                </td>
                <td className="py-2 pr-3">
                  <SubmissionCell op={op} zone={zone} t={t} />
                </td>
                <td className="py-2 pr-3">
                  <CallbackCell op={op} zone={zone} t={t} />
                </td>
                <td className="py-2 pr-3">
                  <EventsCell op={op} zone={zone} t={t} />
                </td>
                <td className="py-2 pr-3">
                  <MeaningCell op={op} t={t} />
                </td>
                <td className="py-2">
                  <PaymentCell op={op} payments={payments} paymentsReady={paymentsReady} t={t} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AsyncPanel>
  )
}

/**
 * «Операція»: направление и сумма, состояние, канал и оба ключа — по ним
 * оператор ищет операцию в поддержке Zūm. Id провайдера нет — строки нет:
 * ячейка «Передано в Zūm» уже говорит, почему.
 */
function OperationCell({ op, t }: { op: CreditRailOperation; t: Translate }) {
  return (
    <>
      <span className="block">
        {op.direction === 'collect'
          ? t('credit.railOps.direction.collect')
          : t('credit.railOps.direction.disburse')}{' '}
        · <span className="tabular-nums">{formatCreditMoney(op.amount_minor, op.currency)}</span>
      </span>
      <span className="mt-1 block">
        <CreditRailStateBadge state={op.state}>
          {t(`credit.railOperationState.${op.state}`)}
        </CreditRailStateBadge>
      </span>
      {/* Канал в контракте — открытая строка: незнакомый показывается дословно. */}
      <Small>
        {(CREDIT_DISBURSEMENT_METHODS as readonly string[]).includes(op.method)
          ? t(`credit.disbursementMethod.${op.method}`)
          : op.method}
      </Small>
      <span className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 text-xs">
        <span>{t('credit.fields.clientTransactionId')}</span>
        <span className="font-mono">{op.client_transaction_id}</span>
        <CopyButton value={op.client_transaction_id} label={t('credit.actions.copy')} />
      </span>
      {op.provider_tx_id !== null && (
        <span className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
          <span>{t('credit.fields.providerTxId')}</span>
          <span className="font-mono">{op.provider_tx_id}</span>
          <CopyButton value={op.provider_tx_id} label={t('credit.actions.copy')} />
        </span>
      )}
    </>
  )
}

/** «Передано в Zūm» — по правилу `submissionOf`; `created_at` здесь не бывает никогда. */
function SubmissionCell({ op, zone, t }: { op: CreditRailOperation; zone: string; t: Translate }) {
  const submission = submissionOf(op)
  switch (submission.kind) {
    case 'sent':
      return (
        <>
          <span className="block tabular-nums">{formatDateTime(submission.at, zone)}</span>
          {!submission.acknowledged && (
            <Small>{t('credit.railOps.submission.notAcknowledged')}</Small>
          )}
        </>
      )
    case 'notRecorded':
      return <>{t('credit.railOps.submission.notRecorded')}</>
    case 'notSent':
      return <>{t('credit.railOps.submission.notSent')}</>
    case 'notYet':
      return <>{t('credit.railOps.submission.notYet')}</>
    default:
      return <>{t('credit.railOps.submission.unknown')}</>
  }
}

/**
 * «Колбек» — каждый колбэк своей строкой: колонка «Розшифровка» показывает
 * последний код операции, а в нём бывает наш код — код Zūm из колбэка иначе
 * пропал бы.
 */
function CallbackCell({ op, zone, t }: { op: CreditRailOperation; zone: string; t: Translate }) {
  const lines = callbackLines(op)
  if (lines.length === 0 && op.callbacks_total === 0) {
    const absence = noCallbackText(op)
    switch (absence.kind) {
      case 'notAsked':
        return <>—</>
      case 'waiting':
        return <>{t('credit.railOps.callback.waiting')}</>
      case 'awaitingReconciliation':
        return <>{t('credit.railOps.callback.awaitingReconciliation')}</>
      case 'noneObserved':
        return (
          <>
            {t('credit.railOps.callback.noneObserved', {
              when: formatDateTime(absence.at, zone),
            })}
          </>
        )
      default:
        return <>{t('credit.railOps.callback.none')}</>
    }
  }
  return (
    <>
      <ul className="space-y-2">
        {lines.map((line, index) => {
          const { callback } = line
          const label = statusLabel(t, callback.status)
          const codeLabel =
            callback.failure_code === null ? null : railCodeLabel(t, callback.failure_code)
          return (
            <li key={`${callback.received_at}-${index}`}>
              <span className="block tabular-nums">
                {formatDateTime(callback.received_at, zone)}
              </span>
              <span className="block">{statusText(t, callback.status)}</span>
              {label && <Small>{label}</Small>}
              {callback.failure_code !== null && (
                <span className="block">{railFailureText(t, callback.failure_code)}</span>
              )}
              {codeLabel && <Small>{codeLabel}</Small>}
              {line.signatureMismatch && (
                <span className="text-error-700 block text-xs">
                  {t('credit.railOps.callback.signatureMismatch')}
                </span>
              )}
              {line.notProcessed && <Small>{t('credit.railOps.callback.notProcessed')}</Small>}
              {line.matchedByKey && <Small>{t('credit.railOps.callback.matchedByKey')}</Small>}
            </li>
          )
        })}
      </ul>
      {op.callbacks_total > lines.length && (
        <Small>
          {t('credit.railOps.callbacksTruncated', {
            shown: lines.length,
            total: op.callbacks_total,
          })}
        </Small>
      )}
    </>
  )
}

/**
 * «Кроки Zūm» — история операции у Zūm, отдельно от колбэков: колбэк — что и
 * когда пришло к нам, шаг — что Zūm записал в истории переказа. В одной
 * колонке потерялось бы, кто что сказал.
 */
function EventsCell({ op, zone, t }: { op: CreditRailOperation; zone: string; t: Translate }) {
  const view = eventLines(op)
  return (
    <>
      {view.events.length > 0 && (
        <ul className="space-y-2">
          {view.events.map((event, index) => {
            const label = eventLabel(t, event.event)
            return (
              <li key={`${event.event}-${index}`}>
                <span className="block tabular-nums">
                  {event.occurred_at === null
                    ? t('credit.railOps.event.noTime')
                    : formatDateTime(event.occurred_at, zone)}
                </span>
                <span className="block">{eventText(t, event.event)}</span>
                {label && <Small>{label}</Small>}
              </li>
            )
          })}
        </ul>
      )}
      {view.dropped > 0 && <Small>{t('credit.railOps.events.dropped', { n: view.dropped })}</Small>}
      {view.empty === 'notAsked' && '—'}
      {view.empty === 'none' && t('credit.railOps.events.none')}
    </>
  )
}

/**
 * «Розшифровка» — две независимые строки: код (если есть) и статус (если не
 * пуст). Слово модуля `NotFound` приходит только вместе с кодом, поэтому
 * статус не прячется за кодом. Пусты оба — текст состояния операции.
 */
function MeaningCell({ op, t }: { op: CreditRailOperation; t: Translate }) {
  const code = op.failure_code
  const hasStatus = !isBlankStatus(op.provider_status)
  const codeLabel = code === null ? null : railCodeLabel(t, code)
  const label = hasStatus ? statusLabel(t, op.provider_status) : null
  return (
    <>
      {code !== null && <span className="block">{railFailureText(t, code)}</span>}
      {codeLabel && <Small>{codeLabel}</Small>}
      {hasStatus && <span className="block">{statusText(t, op.provider_status)}</span>}
      {label && <Small>{label}</Small>}
      {code === null && !hasStatus && t(`credit.railOperationState.${op.state}`)}
    </>
  )
}

/** «Платіж» — по `payment_id` (правила — `paymentCellOf`). */
function PaymentCell({
  op,
  payments,
  paymentsReady,
  t,
}: {
  op: CreditRailOperation
  payments: readonly CreditPayment[]
  paymentsReady: boolean
  t: Translate
}) {
  const cell = paymentCellOf(op, payments, paymentsReady)
  switch (cell.kind) {
    case 'found':
      return (
        <>
          <span className="block">
            {formatDate(cell.payment.effective_date)} ·{' '}
            <span className="tabular-nums">
              {formatCreditMoney(cell.payment.amount_minor, op.currency)}
            </span>
          </span>
          {cell.reversed && (
            <span className="text-error-600 block text-xs">
              {t('credit.railOps.payment.reversed')}
            </span>
          )}
        </>
      )
    case 'noneFailedCollect':
      return <>{t('credit.railOps.payment.noneFailedCollect')}</>
    case 'notFound':
      return <>{t('credit.railOps.payment.notFound')}</>
    default:
      return <>—</>
  }
}
