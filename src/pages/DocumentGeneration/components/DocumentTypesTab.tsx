/**
 * Document Types tab content.
 *
 * Admin-managed CRUD for ``document_types`` — the classification
 * lookup that populates the client-document upload dropdown and drives
 * pill colors in the accordion. Mirrors ``DocumentTemplatesTab`` in
 * shape: DataTable rows + create/edit/hide/delete actions + a form
 * modal.
 *
 * Delete is disabled while ``doc_count > 0`` — the BE rejects with 409
 * in that case; disabling the button surfaces the constraint before
 * the user tries.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DataTable, type Column } from '@/components/ui/DataTable'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { Button } from '@/components/ui/Button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'
import { useConfirm } from '@/components/ui/useConfirm'
import { Icons } from '@/lib/icons'
import {
  useDocumentTypes,
  useDeleteDocumentType,
  useUpdateDocumentTypeVisibility,
  type DocumentType,
} from '@/features/documentTypes'
import { DocumentTypeFormModal } from './DocumentTypeFormModal'

export function DocumentTypesTab() {
  const { t } = useTranslation('common')

  // Include hidden so admins can see + un-hide them from the same table.
  // withCounts: this admin tab is the ONLY place that opts into per-type
  // ``doc_count`` (it shows the count column and gates Delete on it). The
  // count fetch scans the whole client_documents table on the BE, so it
  // must stay off everywhere else (journal filter, dropdowns, upload
  // modal). This tab is only mounted when the "types" tab is active, so
  // the expensive fetch fires only when an admin opens it.
  const { data, isLoading, isError } = useDocumentTypes({
    includeHidden: true,
    withCounts: true,
  })
  const deleteMutation = useDeleteDocumentType()
  const visibilityMutation = useUpdateDocumentTypeVisibility()
  const { confirm, confirmDialog } = useConfirm()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<DocumentType | null>(null)

  const rows = data ?? []

  const handleOpenCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const handleOpenEdit = (row: DocumentType) => {
    setEditing(row)
    setFormOpen(true)
  }

  const handleClose = () => {
    setFormOpen(false)
    setEditing(null)
  }

  const handleToggleVisibility = async (row: DocumentType) => {
    try {
      await visibilityMutation.mutateAsync({
        id: row.id,
        input: { is_hidden: !row.is_hidden },
      })
      toast.success(
        row.is_hidden
          ? t('pages.documentGeneration.types.toast.shown', 'Type shown')
          : t('pages.documentGeneration.types.toast.hidden', 'Type hidden')
      )
    } catch {
      // Hook onError already toasts a fallback.
    }
  }

  const handleDelete = async (row: DocumentType) => {
    if (row.doc_count > 0) return
    const ok = await confirm({
      title: t('pages.documentGeneration.types.confirmDeleteTitle', "Delete '{{name}}'?", {
        name: row.name,
      }),
      message: t('pages.documentGeneration.types.confirmDelete', 'This action cannot be undone.'),
      confirmLabel: t('actions.delete', 'Delete'),
      cancelLabel: t('actions.cancel', 'Cancel'),
      tone: 'danger',
      icon: <Icons.Delete size={24} className="text-error-600" strokeWidth={2} />,
    })
    if (!ok) return
    try {
      await deleteMutation.mutateAsync(row.id)
      toast.success(t('pages.documentGeneration.types.toast.deleted', 'Document type deleted'))
    } catch {
      // Hook onError toasts a fallback.
    }
  }

  const columns: Column<DocumentType>[] = useMemo(
    () => [
      {
        key: 'color',
        header: t('pages.documentGeneration.types.columns.color', 'Color'),
        align: 'center',
        className: 'w-16 text-base',
        render: (row) => (
          <span
            className="inline-block h-4 w-4 rounded-full border border-gray-300"
            style={{ backgroundColor: row.color }}
            aria-label={row.color}
          />
        ),
      },
      {
        key: 'name',
        header: t('pages.documentGeneration.types.columns.name', 'Name'),
        align: 'center',
        className: 'text-base',
        render: (row) => (
          <span
            className={row.is_hidden ? 'text-base text-gray-400 italic' : 'text-base text-gray-800'}
          >
            {row.name}
            {row.is_hidden && (
              <span className="ml-2 text-sm text-gray-400">
                ({t('pages.documentGeneration.types.hiddenLabel', 'hidden')})
              </span>
            )}
          </span>
        ),
      },
      {
        key: 'doc_count',
        header: t('pages.documentGeneration.types.columns.usage', 'Documents'),
        align: 'center',
        className: 'w-32 text-base',
        render: (row) => (
          <span className="text-base text-gray-600">{row.doc_count.toLocaleString()}</span>
        ),
      },
      {
        key: 'actions',
        header: t('pages.documentGeneration.types.columns.actions', 'Actions'),
        align: 'center',
        className: 'w-40 text-base',
        render: (row) => (
          <div className="flex items-center justify-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleOpenEdit(row)}
              title={t('actions.edit', 'Edit')}
              className="text-gray-800 hover:bg-gray-100"
            >
              <Icons.PencilEdit size={16} strokeWidth={2} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleToggleVisibility(row)}
              title={row.is_hidden ? t('actions.show', 'Show') : t('actions.hide', 'Hide')}
              disabled={visibilityMutation.isPending}
              className={
                row.is_hidden
                  ? 'text-gray-400 hover:bg-gray-100'
                  : 'text-gray-800 hover:bg-gray-100'
              }
            >
              <Icons.Eye size={16} strokeWidth={2} />
            </Button>
            {row.doc_count > 0 ? (
              <TooltipProvider>
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    {/* span wrapper: Radix Tooltip needs a hoverable
                        trigger, but disabled buttons have
                        pointer-events: none from the Button component,
                        so wrap the disabled button in a span that stays
                        interactive. */}
                    <span className="inline-block">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled
                        className="text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        <Icons.Delete size={16} strokeWidth={2} />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t(
                      'pages.documentGeneration.types.deleteBlockedMessage',
                      'This type is used by {{formattedCount}} documents. Hide it instead of deleting.',
                      { formattedCount: row.doc_count.toLocaleString() }
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(row)}
                disabled={deleteMutation.isPending}
                title={t('actions.delete', 'Delete')}
                className="text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                <Icons.Delete size={16} strokeWidth={2} />
              </Button>
            )}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, visibilityMutation.isPending, deleteMutation.isPending]
  )

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      {confirmDialog}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-800">
          {t('pages.documentGeneration.types.title', 'Document Types')}
        </h2>
        <Button onClick={handleOpenCreate} variant="primary">
          <Icons.Add size={16} strokeWidth={2} className="mr-1" />
          {t('pages.documentGeneration.types.newButton', 'New type')}
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} columns={4} />
      ) : isError ? (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {t('pages.documentGeneration.types.loadError', 'Failed to load document types.')}
        </div>
      ) : (
        <DataTable columns={columns} data={rows} />
      )}

      <DocumentTypeFormModal
        open={formOpen}
        documentType={editing ?? undefined}
        onClose={handleClose}
      />
    </div>
  )
}
