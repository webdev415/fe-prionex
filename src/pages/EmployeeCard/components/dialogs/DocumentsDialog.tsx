import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { deleteDocument, uploadDocument } from '@/features/employeeCard/api/employeeCardApi'
import { employeeCardKeys } from '@/features/employeeCard/hooks/useEmployeeCard'
import type { EmployeeCard } from '@/features/employeeCard/types.card'

export interface DocumentsDialogProps {
  card: EmployeeCard
  projectId: number | null
  open: boolean
  onClose: () => void
}

/**
 * Attaching and removing an employee's documents.
 *
 * Unlike the other dialogs this one acts immediately rather than on save: an
 * upload is a file that either arrived or did not, and holding it behind a
 * Save button would leave somebody wondering which of the two happened.
 *
 * The server refuses anything whose bytes are not a document it accepts, and
 * that message is shown as it came rather than replaced with a general one,
 * because the specific reason is what tells somebody what to send instead.
 */
export function DocumentsDialog({ card, projectId, open, onClose }: DocumentsDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: employeeCardKeys.one(card.header.id, projectId),
    })

  const report = (caught: unknown) => {
    const detail = (caught as { response?: { data?: { detail?: unknown } } })?.response?.data
      ?.detail
    setError(typeof detail === 'string' ? detail : t('pages.employeeCard.saveFailed'))
  }

  const attach = async (file: File) => {
    setBusy(true)
    setError(null)
    try {
      await uploadDocument(card.header.id, file)
      await refresh()
    } catch (caught) {
      report(caught)
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const remove = async (documentId: number) => {
    setBusy(true)
    setError(null)
    try {
      await deleteDocument(card.header.id, documentId)
      await refresh()
    } catch (caught) {
      report(caught)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader title={t('pages.employeeCard.dialogs.documents')} />
      <ModalContent>
        {error && (
          <p role="alert" className="text-destructive mb-4 text-sm">
            {error}
          </p>
        )}

        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-muted-foreground text-xs">
              {t('pages.employeeCard.dialogs.attachFile')}
            </span>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.doc,.docx"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void attach(file)
              }}
              className="text-foreground file:border-border file:bg-muted file:text-foreground block w-full text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5"
            />
          </label>

          {card.documents.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t('pages.employeeCard.documents.none')}
            </p>
          ) : (
            <ul className="space-y-2">
              {card.documents.map((document) => (
                <li
                  key={document.id}
                  className="border-border flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
                >
                  <span className="text-foreground truncate text-sm">
                    {document.original_filename}
                  </span>
                  <Button
                    type="button"
                    variant="cancel"
                    size="sm"
                    disabled={busy}
                    onClick={() => void remove(document.id)}
                  >
                    {t('actions.delete')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="primary"
          onClick={onClose}
          disabled={busy}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.close')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
