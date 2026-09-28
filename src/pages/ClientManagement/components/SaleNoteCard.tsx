import { format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'
import i18n from '@/lib/i18n'
import { displayFormatForLanguage } from '@/lib/dateUtils'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { SaleNote } from '@/features/clients/types/saleNotes'
import { piiProps } from '@/lib/openreplay/pii'

interface Props {
  note: SaleNote
  isLatest?: boolean
  canDelete?: boolean
  onDelete?: (id: number) => void
}

function formatAddedBy(note: SaleNote, migratedLabel: string): string {
  // Q3 heuristic: null sale_date → migrated row (no real author).
  if (!note.sale_date) return migratedLabel
  // Q2: prefer resolved name from auth-service; fall back to id.
  return note.added_by_name || `user #${note.added_by_user_id}`
}

export function SaleNoteCard({ note, isLatest, canDelete, onDelete }: Props) {
  const { t } = useTranslation('common')

  // Q1: DD-MM-YYYY (dashes). Null sale_date → em-dash.
  const formattedDate = note.sale_date
    ? format(parseISO(note.sale_date), displayFormatForLanguage('dd-MM-yyyy', i18n.language))
    : '—'

  const addedBy = formatAddedBy(
    note,
    t('pages.client.saleNotes.systemMigrated', 'system (migrated)')
  )

  return (
    <div
      className={cn(
        'border-border overflow-hidden rounded-lg border',
        isLatest && 'border-l-4 border-l-green-500'
      )}
    >
      <div className="bg-muted flex items-center justify-between gap-3 px-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {t('pages.client.saleNotes.saleDate', 'Sale date')}:
          </span>
          <span className="text-foreground font-medium">{formattedDate}</span>
          {isLatest && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
              {t('pages.client.saleNotes.latest', 'LATEST')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {t('pages.client.saleNotes.addedBy', 'Added by')}:{' '}
            <span className="text-foreground">{addedBy}</span>
          </span>
          {canDelete && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(note.id)}
              className="text-muted-foreground transition hover:text-red-500"
              aria-label={t('pages.client.saleNotes.deleteAria', 'Delete comment')}
            >
              <Icons.Delete size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="bg-card p-4">
        <div
          className="text-foreground text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: note.content }}
          {...piiProps}
        />
      </div>
    </div>
  )
}
