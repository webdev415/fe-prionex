/**
 * Лог отправок постбеков партнерам (18-13d-b): таблица одной страницы.
 *
 * Только поля двери — ПД заявки нет. Коды (триггер, исход, причина пропуска,
 * `last_error`) — открытые строки: вне снимка контракта показываются сырыми с
 * пометкой, экран не падает. «Сторновано» — по `reversed_at` (выдачу сторнировали
 * после отправки; партнёру модуль не сообщает), а не по причине пропуска.
 *
 * Итоговый URL несёт `click_id` и токен партнёра (Р-18-13d-11): колонка под
 * замазкой записи, полный адрес — в подсказке (`PiiTooltip`, текст тоже под
 * замазкой) и кнопкой копирования; в атрибуты адрес не кладётся.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { PiiTooltip } from '@/components/ui/PiiTooltip'
import { formatDateTime } from '@/lib/formatters'
import { CREDIT_DYNAMIC_NAMESPACES } from '@/features/credit/api/enums'
import type { CreditPostbackDelivery, CreditPostbackRule } from '@/features/credit/api/postbacks'
import { CopyButton } from './CreditCardHeader'

/** Видимая часть адреса; целиком — в подсказке и копированием. */
const URL_VISIBLE = 48

/** Карточка действия по коду триггера (Р-18-13d-12): лід — заявка, видача — кредит. */
const CARD_BY_TRIGGER: Record<string, string> = {
  new_lead: '/dashboard/credit/applications/',
  new_loan: '/dashboard/credit/loans/',
}

export function CreditPostbackDeliveriesTable({
  items,
  rules,
  emptyMessage,
}: {
  items: CreditPostbackDelivery[]
  /** Живые правила; `undefined` — список не загружен, пометки «видалено» нет. */
  rules?: CreditPostbackRule[]
  emptyMessage: string
}) {
  const { t } = useTranslation('common')
  const deleted = (ruleId: string) => rules && !rules.some((rule) => rule.id === ruleId)

  /**
   * Подпись кода из словаря или сырой код с пометкой «невідоме значення». Известен
   * код из перечня реестра `CREDIT_DYNAMIC_NAMESPACES` — его сверяет страж снимка.
   */
  const label = (code: string, namespace: string): ReactNode =>
    CREDIT_DYNAMIC_NAMESPACES[`postbacks.${namespace}`]?.includes(code) ? (
      <span>{t(`credit.postbacks.${namespace}.${code}`)}</span>
    ) : (
      <span>
        <span className="font-mono text-xs">{code}</span>{' '}
        <span className="text-muted-foreground text-xs">
          ({t('credit.postbacks.unknownValue')})
        </span>
      </span>
    )

  const columns: Column<CreditPostbackDelivery>[] = [
    {
      key: 'created_at',
      header: t('credit.postbacks.log.columns.createdAt'),
      // Отправка и следующая попытка — подсказкой строки: время не ПД.
      render: (row) => (
        <span
          title={`${t('credit.postbacks.log.sentAt')}: ${formatDateTime(row.sent_at ?? undefined)}\n${t('credit.postbacks.log.nextAttemptAt')}: ${formatDateTime(row.next_attempt_at ?? undefined)}`}
        >
          {formatDateTime(row.created_at)}
        </span>
      ),
    },
    {
      key: 'rule',
      header: t('credit.postbacks.log.columns.rule'),
      render: (row) => (
        <span>
          {row.rule_name}
          {deleted(row.rule_id) && (
            <span className="text-muted-foreground text-xs">
              {' '}
              ({t('credit.postbacks.log.deleted')})
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'trigger',
      header: t('credit.postbacks.log.columns.trigger'),
      render: (row) => label(row.trigger, 'trigger'),
    },
    {
      key: 'action',
      header: t('credit.postbacks.log.columns.action'),
      render: (row) => {
        const text = row.action_number ?? row.action_id
        const card = CARD_BY_TRIGGER[row.trigger]
        return card ? (
          <Link
            to={`${card}${encodeURIComponent(row.action_id)}`}
            className="text-primary-500 hover:underline"
          >
            {text}
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1">
            <span className="font-mono text-xs">{text}</span>
            <CopyButton value={row.action_id} label={t('credit.postbacks.log.copyActionId')} />
          </span>
        )
      },
    },
    {
      key: 'status',
      header: t('credit.postbacks.log.columns.outcome'),
      render: (row) => (
        <span className="inline-flex flex-wrap items-center gap-1">
          {label(row.status, 'outcome')}
          {row.skip_reason && (
            <>
              {' — '}
              {label(row.skip_reason, 'skipReason')}
            </>
          )}
          {row.reversed_at && (
            <span className="bg-muted rounded px-1.5 text-xs">
              {t('credit.postbacks.log.reversed')}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'response',
      header: t('credit.postbacks.log.columns.response'),
      render: (row) => (
        <span className="inline-flex flex-col">
          <span>{row.response_code ?? '—'}</span>
          {row.last_error && (
            <span className="text-error-500 text-xs">{label(row.last_error, 'lastError')}</span>
          )}
        </span>
      ),
    },
    {
      key: 'url',
      header: t('credit.postbacks.log.columns.url'),
      obscured: true,
      render: (row) =>
        row.url ? (
          <span className="inline-flex items-center gap-1">
            <PiiTooltip label={row.url}>
              <span className="font-mono text-xs">
                {row.url.length > URL_VISIBLE ? `${row.url.slice(0, URL_VISIBLE - 1)}…` : row.url}
              </span>
            </PiiTooltip>
            <CopyButton value={row.url} label={t('credit.postbacks.rules.copyUrl')} />
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'attempts',
      header: t('credit.postbacks.log.columns.attempts'),
      align: 'right',
      render: (row) => row.attempts,
    },
  ]

  return <DataTable columns={columns} data={items} emptyMessage={emptyMessage} />
}
