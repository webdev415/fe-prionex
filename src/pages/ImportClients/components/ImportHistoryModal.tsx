/**
 * ImportHistoryModal Component
 *
 * Modal that displays the last import summary with different states:
 * - Completed (success)
 * - Completed with errors
 * - Failed
 */

import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { useNavigate } from 'react-router-dom'
import { useExportImportErrors } from '@/features/imports'
import { ImportModalStatusBadge } from './ImportBadges'

export type ImportStatus = 'completed' | 'completed_with_errors' | 'failed'

export interface ImportHistoryData {
  file: string
  uploadedBy: string
  uploadedAt: string
  status: ImportStatus
  totalRows?: number
  newClients?: number
  updatedClients?: number
  errors?: number
  processingTime?: string
  jobId?: number | string
}

export interface ImportHistoryModalProps {
  open: boolean
  onClose: () => void
  data: ImportHistoryData | null
}

function StatusBadge({ status }: { status: ImportStatus }) {
  return <ImportModalStatusBadge status={status} />
}

export function ImportHistoryModal({ open, onClose, data }: ImportHistoryModalProps) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const exportErrorsMutation = useExportImportErrors()

  if (!data) return null

  const { status, jobId } = data

  const handleViewDetails = () => {
    if (jobId) {
      navigate(`/dashboard/import/history/${jobId}`)
      onClose()
    }
  }

  const handleDownloadErrors = () => {
    if (jobId) {
      exportErrorsMutation.mutate(jobId)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="lg"
      className="w-[95%] max-w-[600px] sm:w-[600px]"
    >
      <ModalHeader
        icon={<Icons.CloudDownload size={24} className="text-foreground" strokeWidth={1.5} />}
        title={t('pages.imports.modal.lastImportSummary')}
      />

      <ModalContent>
        <div className="space-y-6">
          {/* Import Details */}
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <span className="text-foreground w-full text-sm leading-[155%] font-light tracking-[-0.32px] sm:w-40 sm:text-base">
                {t('pages.imports.modal.file')}{' '}
              </span>
              <span className="text-foreground flex-1 text-sm leading-[155%] font-medium tracking-[-0.32px] break-words sm:text-base">
                {data.file}
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <span className="text-foreground w-full text-sm leading-[155%] font-light tracking-[-0.32px] sm:w-40 sm:text-base">
                {t('pages.imports.modal.uploadedBy')}{' '}
              </span>
              <span className="text-foreground flex-1 text-sm leading-[155%] font-medium tracking-[-0.32px] break-words sm:text-base">
                {t('pages.imports.uploadedByAt', { user: data.uploadedBy, time: data.uploadedAt })}
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <span className="text-foreground w-full text-sm leading-[155%] font-light tracking-[-0.32px] sm:w-40 sm:text-base">
                {t('pages.imports.modal.status')}{' '}
              </span>
              <StatusBadge status={status} />
            </div>
          </div>

          {/* Summary Statistics - Only show if not failed */}
          {status !== 'failed' && data.totalRows !== undefined && (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <span className="text-foreground w-full text-sm leading-[155%] font-light tracking-[-0.32px] sm:w-40 sm:text-base">
                  {t('pages.imports.modal.totalRows')}
                </span>
                <span className="text-foreground flex-1 text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                  {data.totalRows.toLocaleString()}
                </span>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <span className="text-foreground w-full text-sm leading-[155%] font-light tracking-[-0.32px] sm:w-40 sm:text-base">
                  {t('pages.imports.modal.newClients')}
                </span>
                <span className="text-foreground flex-1 text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                  {data.newClients?.toLocaleString() || 0}
                </span>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <span className="text-foreground w-full text-sm leading-[155%] font-light tracking-[-0.32px] sm:w-40 sm:text-base">
                  {t('pages.imports.modal.updatedClients')}
                </span>
                <span className="text-foreground flex-1 text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                  {data.updatedClients?.toLocaleString() || 0}
                </span>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <span className="text-foreground w-full text-sm leading-[155%] font-light tracking-[-0.32px] sm:w-40 sm:text-base">
                  {t('pages.imports.modal.error')}
                </span>
                <span className="text-foreground flex-1 text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                  {data.errors || 0}
                </span>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <span className="text-foreground w-full text-sm leading-[155%] font-light tracking-[-0.32px] sm:w-40 sm:text-base">
                  {t('pages.imports.modal.processingTime')}
                </span>
                <span className="text-foreground flex-1 text-sm leading-[155%] font-medium tracking-[-0.32px] sm:text-base">
                  {data.processingTime || 'N/A'}
                </span>
              </div>
            </div>
          )}

          {/* Error Messages */}
          {status === 'failed' && (
            <div className="border-border bg-card/50 flex items-center justify-center gap-2 self-stretch rounded-xl border p-6">
              <Icons.Warning size={20} className="text-error-500" />
              <span className="text-error-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.imports.modal.messages.importFailed')}
              </span>
            </div>
          )}

          {status === 'completed_with_errors' && (
            <div className="border-border bg-card/50 flex items-center justify-center gap-2 self-stretch rounded-xl border p-6">
              <Icons.Warning size={24} className="text-error-500" />
              <span className="text-error-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                {t('pages.imports.modal.messages.someRowsFailed')}
              </span>
            </div>
          )}
        </div>
      </ModalContent>

      <ModalFooter>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          {status === 'completed_with_errors' ? (
            <>
              <Button
                variant="white-secondary"
                onClick={handleViewDetails}
                disabled={!jobId}
                className="flex w-full flex-1 items-center text-sm font-medium sm:w-auto"
              >
                {t('pages.imports.modal.viewDetails')}
              </Button>
              <Button
                variant="primary"
                onClick={handleDownloadErrors}
                disabled={!jobId || exportErrorsMutation.isPending}
                leftIcon={<Icons.FileDownload size={20} className="text-primary-foreground" />}
                className="flex w-full flex-1 items-center text-sm font-medium sm:w-auto"
              >
                {exportErrorsMutation.isPending
                  ? t('pages.imports.modal.exporting')
                  : t('pages.imports.modal.downloadErrorReport')}
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              onClick={handleViewDetails}
              disabled={!jobId}
              className="w-full text-sm font-medium"
            >
              {t('pages.imports.modal.viewDetails')}
            </Button>
          )}
        </div>
      </ModalFooter>
    </Modal>
  )
}
