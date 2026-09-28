/**
 * Bulk Upload Rules tab.
 *
 * Two independent rule sets, one per archive folder, configured once and used
 * by every later bulk upload — nobody picks a document type per upload any
 * more. The banner at the top is the same condition the upload screen blocks
 * on, said where it can be fixed: a folder without a default type has nothing
 * to fall back to for a file that matches no keyword.
 */

import { useTranslation } from 'react-i18next'

import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { Icons } from '@/lib/icons'
import { useDocumentTypes } from '@/features/documentTypes'
import { useDocumentImportRules } from '@/features/documentImportRules'
import { BulkUploadRuleSetCard } from './BulkUploadRuleSetCard'

export function BulkUploadRulesTab() {
  const { t } = useTranslation('common')

  const { data: config, isLoading, isError } = useDocumentImportRules()
  // Hidden types included on purpose: hiding a type takes it out of the
  // operator's upload dropdown, not out of the rules an admin writes here, and
  // a rule pointing at one must stay editable rather than silently unreadable.
  const { data: documentTypes, isLoading: typesLoading } = useDocumentTypes({ includeHidden: true })

  if (isLoading || typesLoading) {
    return <TableSkeleton columns={4} rows={6} />
  }

  if (isError || !config) {
    return (
      <p className="text-error-600 py-8 text-center text-sm">
        {t('pages.documentGeneration.bulkRules.loadError', 'Could not load the bulk-upload rules')}
      </p>
    )
  }

  const missing = (['credits', 'users'] as const).filter(
    (folder) => config[folder].default_document_type_id === null
  )

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-foreground text-lg font-medium">
          {t('pages.documentGeneration.bulkRules.title', 'Bulk upload rules')}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t(
            'pages.documentGeneration.bulkRules.subtitle',
            'A file gets the type of the first rule whose keyword occurs in its name; the lowest Order wins. Matching ignores case and reads the whole file name, extension included.'
          )}
        </p>
      </div>

      {missing.length > 0 && (
        <div
          role="status"
          className="border-warning-300 bg-warning-50 text-warning-800 flex items-start gap-2 rounded-lg border p-3 text-sm"
        >
          <Icons.Warning size={18} strokeWidth={2} className="mt-0.5 shrink-0" />
          <span>
            {t(
              'pages.documentGeneration.bulkRules.blockedBanner',
              'Bulk document upload is blocked until a default document type is set for {{folders}}.',
              { folders: missing.map((folder) => `${folder}/`).join(', ') }
            )}
          </span>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <BulkUploadRuleSetCard
          folder="credits"
          ruleSet={config.credits}
          documentTypes={documentTypes ?? []}
        />
        <BulkUploadRuleSetCard
          folder="users"
          ruleSet={config.users}
          documentTypes={documentTypes ?? []}
        />
      </div>
    </div>
  )
}
