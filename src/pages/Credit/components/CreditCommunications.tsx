/**
 * Коммуникации с клиентом в карточке заявки: звонки и SMS CRM, письма сайта и
 * честные маркеры каналов, которых нет.
 *
 * Звонки и SMS CRM запрашиваются ТОЛЬКО по `client_id`, который дал модуль (см.
 * `features/credit/api/communications.ts`). В строке — минимум без
 * персональных данных: время, направление, длительность, исход или статус.
 * Номеров и текстов сообщений здесь нет; полная история — в карточке клиента,
 * под теми же правами.
 *
 * Письма сайта — те же строки хронологии, без отдельного запроса. Каналы, которых
 * у заявителя нет, называются всегда: пустой блок читался бы как «клиенту не
 * звонили».
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { formatDateTime } from '@/lib/formatters'
import type { CallRecord } from '@/features/clients/api/types'
import {
  formatTalkDuration,
  type CreditCrmChannelState,
} from '@/features/credit/api/communications'
import { hasTimeline, mailRows, portalEventLabel } from '@/features/credit/api/timeline'
import type { CreditTimelineRow } from '@/features/credit/api/types'
import { useCreditCrmCommunications } from '@/features/credit/hooks/useCreditCommunications'

export function CreditCommunications({
  clientId,
  timeline,
}: {
  clientId: number | null | undefined
  timeline: CreditTimelineRow[] | undefined
}) {
  const { t } = useTranslation('common')
  const { calls, sms } = useCreditCrmCommunications(clientId)
  // Без хронологии писем «нет» не значит «не было»: модуль ленту не передал, и
  // сказать про письма нечего. «Листів немає» — только когда лента пришла.
  const timelineProvided = hasTimeline(timeline)
  const mail = mailRows(timeline)

  return (
    <div className="text-sm">
      <Subblock title={t('credit.communications.calls')}>
        <ChannelBody state={calls} none={t('credit.communications.noneCalls')}>
          {(items) => items.map((call) => <CallRow key={call.call_id} call={call} />)}
        </ChannelBody>
      </Subblock>

      <Subblock title={t('credit.communications.sms')}>
        <ChannelBody state={sms} none={t('credit.communications.noneSms')}>
          {(items) =>
            items.map((message, index) => (
              <li
                key={`${message.id}-${index}`}
                className="border-border flex gap-3 border-b py-1.5 last:border-0"
              >
                <span className="text-muted-foreground w-40 shrink-0 font-mono text-xs">
                  {formatDateTime(message.sent_at ?? undefined)}
                </span>
                <span className="text-xs">{message.status}</span>
              </li>
            ))
          }
        </ChannelBody>
      </Subblock>

      <Subblock title={t('credit.communications.mail')}>
        {!timelineProvided ? (
          <p className="text-muted-foreground text-xs">
            {t('credit.communications.mailNotProvided')}
          </p>
        ) : mail.length === 0 ? (
          <p className="text-muted-foreground text-xs">{t('credit.communications.mailNone')}</p>
        ) : (
          <ul>
            {mail.map((row, index) => (
              <li
                key={`${row.at}-${index}`}
                className="border-border flex gap-3 border-b py-1.5 last:border-0"
              >
                <span className="text-muted-foreground w-40 shrink-0 font-mono text-xs">
                  {formatDateTime(row.at)}
                </span>
                <span>
                  {portalEventLabel(t, row.client?.event ?? '')}
                  {row.client?.scope === 'client' && (
                    <span className="text-warning-800 ml-2 text-xs">
                      {t('credit.timeline.scopeClient')}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {/* Письмо по кредиту модуль кладёт в ленту кредита, а не заявки, и
            видно оно в паспорте кредита, панель «Листи сайту». Строка говорит,
            где его искать: без неё «листів немає» у выданного кредита
            читалось бы «писем не было». */}
        <p className="text-muted-foreground mt-1 text-xs">
          {t('credit.communications.mailLoanStage')}
        </p>
      </Subblock>

      <p className="text-muted-foreground mt-3 text-xs">{t('credit.communications.gotoMissing')}</p>
      <p className="text-muted-foreground mt-1 text-xs">
        {t('credit.communications.smsCanadaMissing')}
      </p>
      {/* Полная история звонков и SMS — в карточке клиента, под теми же правами;
          ссылка общая для обоих каналов, поэтому стоит вне их подблоков. */}
      {typeof clientId === 'number' && (
        <Link
          to={`/dashboard/clients/${clientId}`}
          className="text-information-600 mt-2 inline-block text-xs underline"
        >
          {t('credit.communications.openClientCard')}
        </Link>
      )}
    </div>
  )
}

function Subblock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <h3 className="text-muted-foreground mb-1 text-xs font-semibold">{title}</h3>
      {children}
    </div>
  )
}

function ChannelBody<T>({
  state,
  none,
  children,
}: {
  state: CreditCrmChannelState<T>
  none: string
  children: (items: T[]) => ReactNode
}) {
  const { t } = useTranslation('common')
  switch (state.kind) {
    case 'no_client':
      return <p className="text-muted-foreground text-xs">{t('credit.communications.noClient')}</p>
    case 'loading':
      return <p className="text-muted-foreground text-xs">{t('credit.communications.loading')}</p>
    case 'forbidden':
      return <p className="text-warning-800 text-xs">{t('credit.communications.forbidden')}</p>
    case 'failed':
      return <p className="text-warning-800 text-xs">{t('credit.communications.failed')}</p>
    case 'ok':
      // «Не знайдено» — только когда CRM сказала «ноль». Пустой список при
      // ненулевом числе — это «показано 0 из N», а не отсутствие истории.
      if (state.total === 0) {
        return <p className="text-muted-foreground text-xs">{none}</p>
      }
      return (
        <>
          {state.items.length > 0 && <ul>{children(state.items)}</ul>}
          {state.items.length < state.total && (
            <p className="text-muted-foreground mt-1 text-xs">
              {t('credit.communications.shownOf', {
                shown: state.items.length,
                total: state.total,
              })}
            </p>
          )}
        </>
      )
  }
}

function CallRow({ call }: { call: CallRecord }) {
  const { t } = useTranslation('common')
  // Направление — двумя литералами, а не шаблонным ключом: так обе подписи видит
  // страж словарей, а незнакомое значение показывается как есть.
  const direction =
    call.direction === 'inbound'
      ? t('credit.communications.direction.inbound')
      : call.direction === 'outbound'
        ? t('credit.communications.direction.outbound')
        : (call.direction ?? '—')
  return (
    <li className="border-border flex flex-wrap gap-3 border-b py-1.5 last:border-0">
      <span className="text-muted-foreground w-40 shrink-0 font-mono text-xs">
        {formatDateTime(call.initiated_at)}
      </span>
      <span className="text-xs">{direction}</span>
      <span className="font-mono text-xs">{formatTalkDuration(call.talk_duration)}</span>
      <span className="text-muted-foreground text-xs">{call.outcome ?? call.state}</span>
    </li>
  )
}
