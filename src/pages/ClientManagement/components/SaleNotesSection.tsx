import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useDeleteSaleNote, useSaleNotesList } from '@/features/clients/hooks/useSaleNotes'
import { useHasPermission } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/constants/permissions'
import { SaleNoteCard } from './SaleNoteCard'

interface Props {
  clientId: number
}

export function SaleNotesSection({ clientId }: Props) {
  const { t } = useTranslation('common')
  const [expanded, setExpanded] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const { data: notes, isLoading, error, refetch } = useSaleNotesList(clientId)
  const deleteMutation = useDeleteSaleNote()

  // Permission gating — only operators with manage_primary_creditor_comments
  // can see and use the trash icon (per KAN-617 spec). Uses the shared
  // `useHasPermission` hook (primitive return → stable Zustand comparison)
  // + the PERMISSIONS catalog for typo-safe constant lookup.
  const canDelete = useHasPermission(PERMISSIONS.SALE_NOTES.MANAGE)

  const handleDeleteClick = (noteId: number) => setDeletingId(noteId)
  const handleCancelDelete = () => setDeletingId(null)
  const handleConfirmDelete = () => {
    if (deletingId !== null) {
      deleteMutation.mutate(
        { noteId: deletingId, clientId },
        { onSuccess: () => setDeletingId(null) }
      )
    }
  }

  if (isLoading) {
    return (
      <div className="w-full space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-muted-foreground/25 h-28 animate-pulse rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 self-stretch py-16">
        <p className="text-foreground text-center">
          {t('pages.client.saleNotes.loadError', 'Failed to load comments')}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-primary-500 text-sm underline"
        >
          {t('common.retry', 'Retry')}
        </button>
      </div>
    )
  }

  if (!notes || notes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 self-stretch py-16 md:gap-6">
        <Icons.FileRemove size={48} className="text-muted-foreground" strokeWidth={0.5} />
        <p className="text-foreground text-center text-xl leading-tight font-light tracking-[-0.48px] md:text-2xl">
          {t('pages.client.saleNotes.empty', 'No comments yet')}
        </p>
      </div>
    )
  }

  // Collapsed default (Q4 + Q7): show only the LATEST card. Operators with
  // multiple comments see a `View All (N)` button to expand. Single-comment
  // clients never see the toggle — nothing to expand to.
  const visibleNotes = expanded ? notes : notes.slice(0, 1)
  const hasMore = notes.length > 1

  return (
    <div className="w-full p-4">
      <div className="space-y-3">
        {visibleNotes.map((note, idx) => (
          <SaleNoteCard
            key={note.id}
            note={note}
            isLatest={idx === 0}
            canDelete={canDelete}
            onDelete={handleDeleteClick}
          />
        ))}
      </div>
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-foreground flex items-center gap-2 text-sm font-medium hover:opacity-80"
          >
            {expanded
              ? t('pages.client.saleNotes.collapse', 'Collapse')
              : t('pages.client.saleNotes.viewAll', 'View All ({{count}})', {
                  count: notes.length,
                })}
            <Icons.ArrowDown
              size={16}
              className={expanded ? 'rotate-180 transition' : 'transition'}
            />
          </button>
        </div>
      )}

      <Modal open={deletingId !== null} onClose={handleCancelDelete} maxWidth="sm">
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <Icons.Delete size={26} className="text-red-600" strokeWidth={1.8} />
          </div>
          <div className="flex flex-col gap-1.5">
            <h3 className="text-foreground text-base font-semibold">
              {t('pages.client.saleNotes.deleteTitle', 'Delete sale note')}
            </h3>
            <p className="text-muted-foreground text-sm">
              {t(
                'pages.client.saleNotes.deleteMessage',
                'Are you sure you want to delete this comment? This cannot be undone.'
              )}
            </p>
          </div>
          <div className="mt-2 flex w-full gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCancelDelete}
              disabled={deleteMutation.isPending}
            >
              {t('actions.cancel', 'Cancel')}
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {t('actions.delete', 'Delete')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
