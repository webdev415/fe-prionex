import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalContent, ModalHeader } from '@/components/ui/Modal'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useClientDocuments } from '@/features/clients/hooks/useClients'
import { ClientSearchSelect } from '@/features/clients/components/ClientSearchSelect'
import type { ClientDocument } from '@/features/clients/api/documentApi'
import { formatAttachmentSize } from '@/features/lawyerWorkplace/api/mappers'
import { getFilenameExtensionLabel } from '@/features/lawyerWorkplace/utils/attachmentExtension'

interface AttachClientDocumentModalProps {
  open: boolean
  /** Client the current letter is bound to — pre-selected when the picker opens. */
  clientId: number | null
  /** Display label for the pre-selected client (`CL-xxxxx · Name`), if known. */
  clientLabel?: string | null
  onClose: () => void
  /** Fires with the picked document and the client it belongs to; the parent downloads + attaches it. */
  onSelect: (doc: ClientDocument, clientId: number) => void
  /** Id of the document currently being downloaded/attached (row spinner). */
  attachingDocId?: number | null
}

/**
 * Picker for a document that lives on ANY client in CRM. The picker opens on the
 * letter's client (when there is one) but a search box lets the lawyer switch to
 * any other client and attach one of their documents. The list comes from the
 * existing `GET /clients/{id}/documents` endpoint; the parent turns the chosen row
 * into a `File` and stages it on the reply exactly like a file picked from disk.
 */
export function AttachClientDocumentModal({
  open,
  clientId,
  clientLabel = null,
  onClose,
  onSelect,
  attachingDocId = null,
}: AttachClientDocumentModalProps) {
  const { t } = useTranslation('common')

  const [selectedClientId, setSelectedClientId] = useState<number | null>(clientId)
  const [selectedLabel, setSelectedLabel] = useState<string>(clientLabel ?? '')

  // Re-seed the picker with the letter's client every time it (re)opens, so a
  // previous search does not leak into the next letter. Done by adjusting state
  // during render on the open-transition (React's recommended pattern) rather
  // than in an effect, which would trigger a cascading render.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSelectedClientId(clientId)
      setSelectedLabel(clientLabel ?? '')
    }
  }

  const {
    data: documents = [],
    isLoading,
    isError,
  } = useClientDocuments(selectedClientId ?? 0, open && (selectedClientId ?? 0) > 0)

  const isBusy = attachingDocId != null

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-10 w-10 items-center justify-center rounded-full">
            <Icons.File size={20} strokeWidth={1.5} className="text-foreground" />
          </div>
        }
        title={t('pages.lawyerWorkplace.reply.attachClientModal.title', 'Client documents')}
      />
      <ModalContent className="px-1">
        <div className="px-1 pb-3">
          <ClientSearchSelect
            value={selectedClientId != null ? String(selectedClientId) : ''}
            label={selectedLabel}
            enabled={open}
            onChange={(id, label) => {
              const parsed = Number(id)
              setSelectedClientId(Number.isFinite(parsed) && parsed > 0 ? parsed : null)
              setSelectedLabel(label)
            }}
            placeholder={t(
              'pages.lawyerWorkplace.reply.attachClientModal.selectClient',
              'Select a client'
            )}
          />
        </div>

        {selectedClientId == null ? (
          <p className="text-muted-foreground px-1 py-8 text-center text-[13px]">
            {t(
              'pages.lawyerWorkplace.reply.attachClientModal.pickClient',
              'Choose a client to see their documents'
            )}
          </p>
        ) : isLoading ? (
          <p className="text-muted-foreground px-1 py-8 text-center text-[13px]">
            {t('status.loading', 'Loading…')}
          </p>
        ) : isError ? (
          <p className="text-error-500 px-1 py-8 text-center text-[13px]">
            {t(
              'pages.lawyerWorkplace.reply.attachClientModal.error',
              'Could not load client documents'
            )}
          </p>
        ) : documents.length === 0 ? (
          <p className="text-muted-foreground px-1 py-8 text-center text-[13px]">
            {t(
              'pages.lawyerWorkplace.reply.attachClientModal.empty',
              'This client has no documents'
            )}
          </p>
        ) : (
          <ul className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto py-1">
            {documents.map((doc) => {
              const extensionLabel = getFilenameExtensionLabel(doc.original_filename)
              const isRowAttaching = attachingDocId === doc.id
              return (
                <li key={doc.id}>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => onSelect(doc, selectedClientId)}
                    className={cn(
                      'border-border hover:border-primary-400 hover:bg-primary-50/40 flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60'
                    )}
                  >
                    <span
                      className="text-secondary-800 bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-center font-medium tracking-wide uppercase"
                      title={extensionLabel}
                    >
                      <span
                        className={cn(
                          'max-w-full truncate px-0.5 leading-none',
                          extensionLabel.length > 3 ? 'text-[9px]' : 'text-[11px]'
                        )}
                      >
                        {extensionLabel}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-foreground block truncate text-[13px] font-medium">
                        {doc.original_filename}
                      </span>
                      <span className="text-muted-foreground block text-[11px]">
                        {formatAttachmentSize(doc.file_size)}
                        {doc.document_type_ref ? ` · ${doc.document_type_ref.name}` : ''}
                      </span>
                    </span>
                    {isRowAttaching ? (
                      <Icons.Spinner className="h-4 w-4 shrink-0" />
                    ) : (
                      <Icons.Link01
                        size={16}
                        strokeWidth={1.5}
                        className="text-muted-foreground shrink-0"
                      />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </ModalContent>
    </Modal>
  )
}
