import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { downloadLegalDocument, exportLegalDocumentPdf } from '@/features/lawyerWorkplace'
import { Icons } from '@/lib/icons'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { formatDocumentDateLines } from '../../utils/formatters'
import type { LegalDocumentRow } from '../../documents/types'
import { DOCUMENT_TYPE_I18N_KEYS, getDocumentDisplayName } from './constants'
import { DocumentDetailField } from './DocumentDetailField'
import { DocumentTypeBadge } from './DocumentTypeBadge'

interface DocumentDetailDrawerProps {
  document: LegalDocumentRow | null
  onClose: () => void
}

export function DocumentDetailDrawer({ document, onClose }: DocumentDetailDrawerProps) {
  const { t, i18n } = useTranslation('common')
  const isOpen = document !== null

  // "generated" reply-EDO docs (ВИХ / НБУ) have no stored file — export a PDF
  // rendered from the sent letter instead of hitting the (404) download route.
  const isGenerated = document?.action === 'generated'

  const handleDownload = async () => {
    if (!document) return
    try {
      await downloadLegalDocument(document.id, document.filename ?? `${document.number}.bin`)
      toast.success(
        t('pages.lawyerWorkplace.documents.modals.detail.downloadStarted', 'Download started'),
        {
          description: getDocumentDisplayName(document, t),
        }
      )
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const handleExport = async () => {
    if (!document) return
    try {
      const { dateLine, timeLine } = formatDocumentDateLines(document.createdAt, t, i18n.language)
      await exportLegalDocumentPdf({
        number: document.number,
        fallbackSubject: getDocumentDisplayName(document, t),
        sourceMessageId: document.sourceMessageId,
        meta: [
          {
            label: t('pages.lawyerWorkplace.documents.columns.type', 'Type'),
            value: t(DOCUMENT_TYPE_I18N_KEYS[document.type], document.type),
          },
          {
            label: t('pages.lawyerWorkplace.documents.columns.clientContract', 'Client - Contract'),
            value: [document.clientName, document.contractId].filter(Boolean).join(' · '),
          },
          {
            label: t('pages.lawyerWorkplace.documents.columns.assignee', 'Assignee'),
            value: document.assigneeName || '',
          },
          {
            label: t('pages.lawyerWorkplace.documents.columns.date', 'Date'),
            value: [dateLine, timeLine].filter(Boolean).join(' '),
          },
        ],
      })
      toast.success(
        t('pages.lawyerWorkplace.documents.modals.detail.exportStarted', 'Export started'),
        {
          description: getDocumentDisplayName(document, t),
        }
      )
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label={t('pages.lawyerWorkplace.documents.modals.detail.close', 'Close document')}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
          onClick={onClose}
        />
      )}

      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl transition-transform duration-200 ease-out sm:w-[min(480px,92vw)]',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        aria-hidden={!isOpen}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
          <span className="text-dark-500 text-[13px] font-medium">
            {t('pages.lawyerWorkplace.documents.modals.detail.title', 'Document details')}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('pages.lawyerWorkplace.documents.modals.detail.close', 'Close document')}
            className="text-light-700 hover:text-dark-500 flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-gray-100"
          >
            <Icons.Cancel01 size={18} strokeWidth={1.5} />
          </button>
        </div>

        {document && (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
            <div className="mb-5 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <DocumentTypeBadge type={document.type} />
                <span className="text-light-600 text-[12px] font-medium">{document.number}</span>
              </div>
              <h2 className="text-dark-500 text-lg leading-snug font-light">
                {getDocumentDisplayName(document, t)}
              </h2>
            </div>

            <div className="flex flex-col gap-4">
              <DocumentDetailField
                label={t(
                  'pages.lawyerWorkplace.documents.columns.clientContract',
                  'Client - Contract'
                )}
              >
                <p className="font-medium">{document.clientName}</p>
                <p className="text-light-600 text-[12px]">{document.contractId}</p>
              </DocumentDetailField>

              <DocumentDetailField
                label={t('pages.lawyerWorkplace.documents.columns.type', 'Type')}
              >
                {t(DOCUMENT_TYPE_I18N_KEYS[document.type], document.type)}
              </DocumentDetailField>

              <DocumentDetailField
                label={t('pages.lawyerWorkplace.documents.columns.action', 'Action')}
              >
                {t(`pages.lawyerWorkplace.documents.actions.${document.action}`, document.action)}
              </DocumentDetailField>

              <DocumentDetailField
                label={t('pages.lawyerWorkplace.documents.columns.assignee', 'Assignee')}
              >
                {document.assigneeName || '—'}
              </DocumentDetailField>

              <DocumentDetailField
                label={t('pages.lawyerWorkplace.documents.columns.date', 'Date')}
              >
                {(() => {
                  const { dateLine, timeLine } = formatDocumentDateLines(
                    document.createdAt,
                    t,
                    i18n.language
                  )
                  return (
                    <>
                      <p>{dateLine}</p>
                      <p className="text-light-600 text-[12px]">{timeLine}</p>
                    </>
                  )
                })()}
              </DocumentDetailField>
            </div>

            <div className="mt-8 flex flex-col gap-2 sm:flex-row">
              {isGenerated ? (
                <Button
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  leftIcon={<Icons.Download size={18} strokeWidth={1.5} />}
                  onClick={handleExport}
                >
                  {t('pages.lawyerWorkplace.documents.modals.detail.export', 'Export')}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="md"
                  className="flex-1"
                  leftIcon={<Icons.Download size={18} strokeWidth={1.5} />}
                  onClick={handleDownload}
                >
                  {t('pages.lawyerWorkplace.documents.modals.detail.download', 'Download')}
                </Button>
              )}
              <Button variant="outline" size="md" className="flex-1" onClick={onClose}>
                {t('actions.close', 'Close')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
