/**
 * Recent interactions list (KAN-379, §7.2 / design operator-03).
 *
 * Reuses useClientActivities to show the N most recent interactions for the
 * client currently in the call. Shared by the active-call client-info block and
 * the client-info popup.
 */

import { useTranslation } from 'react-i18next'

import { useClientActivities } from '@/features/clients/hooks/useClients'

interface RecentInteractionsProps {
  clientId: number
  limit?: number
}

export function RecentInteractions({ clientId, limit = 5 }: RecentInteractionsProps) {
  const { t } = useTranslation('common')
  const { data, isLoading } = useClientActivities(clientId)
  const items = (data ?? []).slice(0, limit)

  if (isLoading) {
    return <p className="text-muted-foreground text-xs">{t('common.loading', 'Loading...')}</p>
  }
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        {t('dialer.call.noInteractions', 'No interactions yet.')}
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((it) => (
        <li key={it.id} className="border-border rounded-md border p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-foreground text-xs font-medium">
              {it.type_name ?? it.direction ?? t('dialer.call.interaction', 'Interaction')}
            </span>
            <span className="text-muted-foreground text-[11px]">
              {it.interaction_date ? new Date(it.interaction_date).toLocaleDateString() : ''}
            </span>
          </div>
          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
            {it.summary ?? it.notes ?? '—'}
          </p>
        </li>
      ))}
    </ul>
  )
}

export default RecentInteractions
