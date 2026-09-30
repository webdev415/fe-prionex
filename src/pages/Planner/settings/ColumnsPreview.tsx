/**
 * Mini preview of the board's columns above the settings (planner story 5.10,
 * AC1; UX C-08): the statuses of the draft in their order — the category dot
 * of 5.1 (`CATEGORY_DOT`, the same tone table as the board's column header)
 * and the name, a mark on the default status and on a paused or switched-off
 * SLA clock. It follows the draft, so a reorder or a rename shows at once.
 */
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { CATEGORY_DOT } from '../plannerTones'
import type { StatusInput } from './boardSettingsModel'

export function ColumnsPreview({ statuses }: { statuses: StatusInput[] }) {
  const { t } = useTranslation('planner')
  return (
    <ol
      aria-label={t('settings.preview.label')}
      className="flex gap-2 overflow-x-auto pb-1"
      data-columns-preview=""
    >
      {statuses.map((status) => (
        <li
          key={status.id}
          className="bg-muted/40 border-border flex w-36 shrink-0 flex-col gap-1 rounded-lg border px-2 py-1.5"
        >
          <span className="text-foreground flex min-w-0 items-center gap-1.5 text-xs font-medium">
            <span
              aria-hidden="true"
              className={cn('h-2 w-2 shrink-0 rounded-full', CATEGORY_DOT[status.category])}
            />
            <span className="truncate">{status.name}</span>
          </span>
          <span className="text-muted-foreground min-h-4 text-[11px]">
            {[
              status.default ? t('settings.preview.default') : null,
              status.sla_mode === 'paused' ? t('settings.preview.slaPaused') : null,
              status.sla_mode === 'off' ? t('settings.preview.slaOff') : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </li>
      ))}
    </ol>
  )
}

export default ColumnsPreview
