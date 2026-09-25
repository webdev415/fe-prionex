/**
 * Хронология заявки — действия клиента на сайте и переходы статуса одной лентой.
 *
 * Ленту собирает модуль (`InternalApplication.timeline`): две дорожки, свёртка
 * соседних однотипных событий, область события. Здесь она только рисуется — в
 * ТОМ ЖЕ порядке: сортировка во фронте по строке времени поставила бы метки с
 * разными смещениями зоны не туда.
 *
 * Чего в строке нет намеренно: `details` (свободный словарь с машинными
 * ключами) и `who` (псевдоним — адрес, а не человек, оператору он ничего не
 * говорит). Событие адреса клиента, не привязанное к этой заявке, помечается в
 * самой строке — по полю `scope`, а не выводом из отсутствия ссылки.
 */
import { useTranslation } from 'react-i18next'
import { formatDateTime } from '@/lib/formatters'
import { portalEventLabel, truncatedPortalEvents } from '@/features/credit/api/timeline'
import type { CreditPortalEventRecord, CreditTimelineRow } from '@/features/credit/api/types'

export function CreditApplicationTimeline({
  timeline,
  portalEvents,
  portalEventsTotal,
}: {
  timeline: CreditTimelineRow[]
  portalEvents: CreditPortalEventRecord[] | undefined
  portalEventsTotal: number | undefined
}) {
  const { t } = useTranslation('common')
  const truncated = truncatedPortalEvents(portalEvents, portalEventsTotal)

  return (
    <div>
      <div className="text-muted-foreground mb-2 text-xs">{t('credit.timeline.title')}</div>
      {truncated && (
        <p className="text-warning-800 mb-2 text-xs">
          {t('credit.timeline.truncated', { shown: truncated.shown, total: truncated.total })}
        </p>
      )}
      <ul className="text-sm">
        {timeline.map((row, index) => (
          <li
            key={`${row.at}-${index}`}
            className="border-border flex gap-3 border-b py-2 last:border-0"
          >
            <span className="text-muted-foreground w-40 shrink-0 font-mono text-xs">
              {formatDateTime(row.at)}
            </span>
            <span className="bg-muted text-muted-foreground h-6 shrink-0 rounded-full px-2.5 text-xs leading-6">
              {row.track === 'status'
                ? t('credit.timeline.trackStatus')
                : t('credit.timeline.trackClient')}
            </span>
            <span className="min-w-0">
              {row.track === 'status' ? (
                <TransitionText row={row} />
              ) : (
                <ClientEventText row={row} />
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TransitionText({ row }: { row: CreditTimelineRow }) {
  const { t } = useTranslation('common')
  const transition = row.transition
  if (!transition) return <>—</>
  return (
    <>
      {transition.from_status
        ? `${t(`credit.status.${transition.from_status}`, transition.from_status)} → `
        : ''}
      <strong>{t(`credit.status.${transition.to_status}`, transition.to_status)}</strong>
      <span className="text-muted-foreground ml-2 text-xs">
        ({transition.actor ? t(`credit.actor.${transition.actor}`, transition.actor) : '—'})
      </span>
    </>
  )
}

function ClientEventText({ row }: { row: CreditTimelineRow }) {
  const { t } = useTranslation('common')
  const client = row.client
  if (!client) return <>—</>
  return (
    <>
      {portalEventLabel(t, client.event)}
      <span className="text-muted-foreground ml-2 text-xs">{client.source}</span>
      {row.count > 1 && (
        <span className="text-muted-foreground ml-2 text-xs">
          {t('credit.timeline.collapsed', { count: row.count, last: formatDateTime(row.last_at) })}
        </span>
      )}
      {client.scope === 'client' && (
        <span className="text-warning-800 ml-2 text-xs">{t('credit.timeline.scopeClient')}</span>
      )}
    </>
  )
}
