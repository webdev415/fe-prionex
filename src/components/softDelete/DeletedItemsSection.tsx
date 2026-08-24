/**
 * The "Deleted" table that sits under a page's active list.
 *
 * Soft delete has always kept these rows for a retention window, but until now
 * nothing in the SPA listed them, so deleting looked permanent to the user even
 * though the row was still there. This is the recovery surface, kept next to the
 * list it belongs to rather than on a separate screen.
 *
 * Renders nothing at all when there is nothing deleted: a permanently visible
 * "Deleted (0)" block would be noise on the overwhelming majority of visits.
 */

import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'

interface DeletedItemsSectionProps<T extends { id: string | number }> {
  items: T[]
  total: number
  columns: Column<T>[]
  /** Section heading, e.g. "Deleted templates". */
  title: string
}

export function DeletedItemsSection<T extends { id: string | number }>({
  items,
  total,
  columns,
  title,
}: DeletedItemsSectionProps<T>) {
  const { t } = useTranslation('common')

  if (!items.length) {
    return null
  }

  return (
    <section className="mt-8 w-full self-stretch" aria-label={title}>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-foreground text-base font-semibold">{title}</h2>
        <span className="text-muted-foreground text-sm">({total})</span>
      </div>
      <p className="text-muted-foreground mb-3 text-sm">
        {t(
          'softDelete.sectionHint',
          'These were deleted and can still be restored until the date shown.'
        )}
      </p>
      <DataTable columns={columns} data={items} className="w-full" />
    </section>
  )
}
