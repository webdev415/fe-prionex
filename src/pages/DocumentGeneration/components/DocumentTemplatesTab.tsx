/**
 * Document Templates tab content (KAN-403 Tab 2).
 *
 * Renders a table of templates with create/edit/delete actions and hosts the
 * editor + delete modals.
 */

import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  useDocumentTemplates,
  downloadDocumentTemplateFile,
  type DocumentTemplate,
} from '@/features/documents'
import { downloadBlob } from '@/features/messaging/utils/downloadBlob'
import { intlLocaleForUiLanguage } from '@/lib/i18n'
import { useHasPermission } from '@/hooks'
import { PERMISSIONS } from '@/constants/permissions'
import { DocumentTemplateEditor } from './DocumentTemplateEditor'
import { DeleteDocumentTemplateModal } from './DeleteDocumentTemplateModal'

const PREVIEW_LENGTH = 100

function htmlToPreview(html: string, max = PREVIEW_LENGTH): string {
  const text = (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= max) return text
  return `${text.slice(0, max).trim()}…`
}

export function DocumentTemplatesTab() {
  const { t, i18n } = useTranslation('common')
  const canCreateEdit = useHasPermission(PERMISSIONS.DOCUMENT_GENERATION.CREATE_EDIT_TEMPLATES)
  const canDelete = useHasPermission(PERMISSIONS.DOCUMENT_GENERATION.DELETE_TEMPLATES)
  const { data, isLoading, isError } = useDocumentTemplates(false)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null)
  const [deleting, setDeleting] = useState<DocumentTemplate | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const items = data?.items ?? []

  const handleDownloadFile = useCallback(
    async (row: DocumentTemplate) => {
      setDownloadingId(row.id)
      try {
        const blob = await downloadDocumentTemplateFile(row.id)
        downloadBlob(blob, row.file_name ?? `${row.name}.docx`)
      } catch {
        toast.error(
          t('pages.documentGeneration.templates.messages.downloadError', 'Failed to download file')
        )
      } finally {
        setDownloadingId(null)
      }
    },
    [t]
  )

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(intlLocaleForUiLanguage(i18n.language), {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    [i18n.language]
  )

  const columns: Column<DocumentTemplate>[] = useMemo(
    () => [
      {
        key: 'name',
        header: t('pages.documentGeneration.templates.columns.name', 'Template name'),
        render: (row) => (
          <div className="flex flex-col">
            <span className="text-foreground font-medium">{row.name}</span>
            {row.description && (
              <span className="text-muted-foreground text-xs">{row.description}</span>
            )}
          </div>
        ),
      },
      {
        key: 'kind',
        header: t('pages.documentGeneration.templates.columns.type', 'Type'),
        render: (row) => (
          <div className="flex flex-col gap-1">
            <span
              className={cn(
                'inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium',
                row.template_kind === 'docx'
                  ? 'bg-info-100 text-info-700'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {t(
                `pages.documentGeneration.templates.templateKind.${row.template_kind}`,
                row.template_kind === 'docx' ? '.docx file' : 'Text template'
              )}
            </span>
            {row.template_kind === 'docx' && row.file_name && (
              <span
                className="text-muted-foreground max-w-[180px] truncate text-xs"
                title={row.file_name}
              >
                {row.file_name}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'body',
        header: t('pages.documentGeneration.templates.columns.preview', 'Preview'),
        render: (row) => <span className="text-foreground text-sm">{htmlToPreview(row.body)}</span>,
      },
      {
        key: 'variables',
        header: t('pages.documentGeneration.templates.columns.variables', 'Variables'),
        render: (row) => (
          <span className="text-foreground text-sm">
            {row.available_variables ? row.available_variables.length : 0}
          </span>
        ),
      },
      {
        key: 'updated_at',
        header: t('pages.documentGeneration.templates.columns.updated', 'Updated'),
        render: (row) => (
          <span className="text-foreground text-sm">
            {dateFormatter.format(new Date(row.updated_at))}
          </span>
        ),
      },
      {
        key: 'actions',
        header: t('pages.documentGeneration.templates.columns.actions', 'Actions'),
        align: 'right',
        render: (row) => (
          <div className="flex items-center justify-end gap-2">
            {row.template_kind === 'docx' && (
              <button
                type="button"
                title={t('pages.documentGeneration.templates.form.downloadFile', 'Download file')}
                onClick={() => handleDownloadFile(row)}
                disabled={downloadingId === row.id}
                className="text-foreground hover:bg-muted inline-flex h-8 w-8 items-center justify-center rounded-md disabled:opacity-50"
              >
                <Icons.Download size={16} strokeWidth={1.5} />
              </button>
            )}
            {canCreateEdit && (
              <button
                type="button"
                title={t('actions.edit', 'Edit')}
                onClick={() => {
                  setEditingTemplate(row)
                  setEditorOpen(true)
                }}
                className="text-foreground hover:bg-muted inline-flex h-8 w-8 items-center justify-center rounded-md"
              >
                <Icons.PencilEdit size={16} strokeWidth={1.5} />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                title={t('actions.delete', 'Delete')}
                onClick={() => setDeleting(row)}
                className="text-error-600 hover:bg-error-100 inline-flex h-8 w-8 items-center justify-center rounded-md"
              >
                <Icons.Delete size={16} strokeWidth={1.5} />
              </button>
            )}
          </div>
        ),
      },
    ],
    [t, dateFormatter, canCreateEdit, canDelete, handleDownloadFile, downloadingId]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground min-w-0 flex-1 text-sm">
          {t(
            'pages.documentGeneration.templates.intro',
            'Reusable document bodies with variable placeholders.'
          )}
        </p>
        {canCreateEdit && (
          <>
            <div className="hidden shrink-0 sm:block">
              <Button
                onClick={() => {
                  setEditingTemplate(null)
                  setEditorOpen(true)
                }}
              >
                <Icons.Add size={16} strokeWidth={2} className="mr-1" />
                {t('pages.documentGeneration.templates.create', 'Create template')}
              </Button>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingTemplate(null)
                setEditorOpen(true)
              }}
              className="bg-primary-300 text-primary-foreground hover:bg-primary-500 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors focus:outline-none sm:hidden"
              aria-label={t('pages.documentGeneration.templates.create', 'Create template')}
            >
              <Icons.Add size={20} strokeWidth={2} />
            </button>
          </>
        )}
      </div>

      {isError ? (
        <div className="border-error-200 bg-error-50 text-error-700 rounded-xl border p-4 text-sm">
          {t('pages.documentGeneration.templates.loadError', 'Failed to load templates.')}
        </div>
      ) : isLoading ? (
        <section
          className="min-h-[200px]"
          aria-busy="true"
          aria-label={t('pages.documentGeneration.templates.loading', 'Loading…')}
        >
          <TableSkeleton columns={columns.length} rows={5} className="shadow-sm" />
        </section>
      ) : (
        <DataTable<DocumentTemplate>
          columns={columns}
          data={items}
          emptyMessage={t('pages.documentGeneration.templates.empty', 'No templates yet.')}
        />
      )}

      {editorOpen && (
        <DocumentTemplateEditor
          open={editorOpen}
          template={editingTemplate}
          onClose={() => {
            setEditorOpen(false)
            setEditingTemplate(null)
          }}
        />
      )}

      {deleting && (
        <DeleteDocumentTemplateModal
          open={!!deleting}
          template={deleting}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
