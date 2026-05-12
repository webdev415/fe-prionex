/**
 * Document Templates tab content (KAN-403 Tab 2).
 *
 * Renders a table of templates with create/edit/delete actions and hosts the
 * editor + delete modals.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { useDocumentTemplates, type DocumentTemplate } from '@/features/documents'
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

  const items = data?.items ?? []

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
            <span className="text-dark-500 font-medium">{row.name}</span>
            {row.description && <span className="text-xs text-gray-500">{row.description}</span>}
          </div>
        ),
      },
      {
        key: 'body',
        header: t('pages.documentGeneration.templates.columns.preview', 'Preview'),
        render: (row) => <span className="text-sm text-gray-700">{htmlToPreview(row.body)}</span>,
      },
      {
        key: 'variables',
        header: t('pages.documentGeneration.templates.columns.variables', 'Variables'),
        render: (row) => (
          <span className="text-sm text-gray-700">
            {row.available_variables ? row.available_variables.length : 0}
          </span>
        ),
      },
      {
        key: 'updated_at',
        header: t('pages.documentGeneration.templates.columns.updated', 'Updated'),
        render: (row) => (
          <span className="text-sm text-gray-700">
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
            {canCreateEdit && (
              <button
                type="button"
                title={t('actions.edit', 'Edit')}
                onClick={() => {
                  setEditingTemplate(row)
                  setEditorOpen(true)
                }}
                className="text-dark-500 hover:bg-primary-50 inline-flex h-8 w-8 items-center justify-center rounded-md"
              >
                <Icons.PencilEdit size={16} strokeWidth={1.5} />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                title={t('actions.delete', 'Delete')}
                onClick={() => setDeleting(row)}
                className="text-error-600 hover:bg-error-50 inline-flex h-8 w-8 items-center justify-center rounded-md"
              >
                <Icons.Delete size={16} strokeWidth={1.5} />
              </button>
            )}
          </div>
        ),
      },
    ],
    [t, dateFormatter, canCreateEdit, canDelete]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {t(
            'pages.documentGeneration.templates.intro',
            'Reusable document bodies with variable placeholders.'
          )}
        </p>
        {canCreateEdit && (
          <Button
            onClick={() => {
              setEditingTemplate(null)
              setEditorOpen(true)
            }}
          >
            <Icons.Add size={16} strokeWidth={2} className="mr-1" />
            {t('pages.documentGeneration.templates.create', 'Create template')}
          </Button>
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
