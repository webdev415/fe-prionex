import { useTranslation } from 'react-i18next'

import type { RecentInteractionItem } from '@/features/dialer'

interface RecentInteractionsProps {
  items: RecentInteractionItem[]
  limit?: number
}

export function RecentInteractions({ items, limit = 5 }: RecentInteractionsProps) {
  const { t } = useTranslation('common')
  const visible = items.slice(0, limit)

  if (visible.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        {t('dialer.call.noInteractions', 'No interactions yet.')}
      </p>
    )
  }

  return (
    <ul className="border-border bg-card divide-border flex flex-col divide-y overflow-hidden rounded-lg border">
      {visible.map((it) => (
        <li key={it.id} className="p-3">
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
