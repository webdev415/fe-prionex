/**
 * ImportHistoryModal Component
 *
 * Modal that displays the last import summary with different states:
 * - Completed (success)
 * - Completed with errors
 * - Failed
 */

import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'

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
}

export interface ImportHistoryModalProps {
  open: boolean
  onClose: () => void
  data: ImportHistoryData | null
}

function StatusBadge({ status }: { status: ImportStatus }) {
  if (status === 'completed') {
    return (
      <div className="flex flex-1">
        <div className="bg-secondary-800 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-white">
          <span className="h-2 w-2 rounded-full bg-white" />
          <span className="text-xs font-medium">Completed</span>
        </div>
      </div>
    )
  }

  if (status === 'completed_with_errors') {
    return (
      <div className="flex flex-1">
        <div className="inline-flex items-center gap-2 rounded-full bg-gray-600 px-3 py-1.5 text-white">
          <Icons.Warning size={14} color="#FFFFFF" />
          <span className="text-xs font-medium">Completed with errors</span>
        </div>
      </div>
    )
  }

  // Failed status
  return (
    <div className="flex flex-1">
      <div className="bg-error-500 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-white">
        <span className="h-2 w-2 rounded-full bg-white" />
        <span className="text-xs font-medium">Failed</span>
      </div>
    </div>
  )
}

export function ImportHistoryModal({ open, onClose, data }: ImportHistoryModalProps) {
  if (!data) return null

  const { status } = data

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg" className="w-[600px] max-w-none">
      <ModalHeader
        icon={<Icons.CloudDownload size={24} className="text-dark-500" strokeWidth={1.5} />}
        title="Last Import Summary"
      />

      <ModalContent>
        <div className="space-y-6">
          {/* Import Details */}
          <div className="space-y-4">
            <div className="flex flex-row justify-between">
              <span className="text-dark-500 w-40 text-base leading-[155%] font-light tracking-[-0.32px]">
                File:{' '}
              </span>
              <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                {data.file}
              </span>
            </div>

            <div className="flex flex-row justify-between">
              <span className="text-dark-500 w-40 text-base leading-[155%] font-light tracking-[-0.32px]">
                Uploaded by:{' '}
              </span>
              <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                {data.uploadedBy} at {data.uploadedAt}
              </span>
            </div>

            <div className="flex flex-row justify-between">
              <span className="text-dark-500 w-40 text-base leading-[155%] font-light tracking-[-0.32px]">
                Status:{' '}
              </span>
              <StatusBadge status={status} />
            </div>
          </div>

          {/* Summary Statistics - Only show if not failed */}
          {status !== 'failed' && data.totalRows !== undefined && (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-dark-500 w-40 text-base leading-[155%] font-light tracking-[-0.32px]">
                  Total rows:
                </span>
                <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                  {data.totalRows.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-dark-500 w-40 text-base leading-[155%] font-light tracking-[-0.32px]">
                  New clients:
                </span>
                <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                  {data.newClients?.toLocaleString() || 0}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-dark-500 w-40 text-base leading-[155%] font-light tracking-[-0.32px]">
                  Updated clients:
                </span>
                <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                  {data.updatedClients?.toLocaleString() || 0}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-dark-500 w-40 text-base leading-[155%] font-light tracking-[-0.32px]">
                  Error:
                </span>
                <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                  {data.errors || 0}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-dark-500 w-40 text-base leading-[155%] font-light tracking-[-0.32px]">
                  Processing time:
                </span>
                <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                  {data.processingTime || 'N/A'}
                </span>
              </div>
            </div>
          )}

          {/* Error Messages */}
          {status === 'failed' && (
            <div className="flex items-center justify-center gap-2 self-stretch rounded-xl border border-white bg-white/50 p-6">
              <Icons.Warning size={20} color="#EF4444" />
              <span className="text-error-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                The import failed due to a system error. No rows were processed.
              </span>
            </div>
          )}

          {status === 'completed_with_errors' && (
            <div className="flex items-center justify-center gap-2 self-stretch rounded-xl border border-white bg-white/50 p-6">
              <Icons.Warning size={24} color="#EF4444" />
              <span className="text-error-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                Some rows failed. Download error report for details.
              </span>
            </div>
          )}
        </div>
      </ModalContent>

      <ModalFooter>
        <div className="flex w-full items-center gap-3">
          {status === 'completed_with_errors' ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  // TODO: Implement view details functionality
                  console.log('View Details clicked')
                }}
                className="text-dark-500 flex flex-1 items-center rounded-lg border-white bg-white px-5 py-3 text-sm font-medium"
              >
                View Details
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  // TODO: Implement download error report functionality
                  console.log('Download Error Report CSV clicked')
                }}
                leftIcon={<Icons.FileDownload size={20} className="text-dark-500" />}
                className="bg-primary-300 text-dark-500 flex flex-1 items-center rounded-lg px-5 py-3 text-sm font-medium"
              >
                Download Error Report CSV
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              onClick={() => {
                // TODO: Implement view details functionality
                console.log('View Details clicked')
              }}
              className="bg-primary-300 text-dark-500 w-full rounded-lg px-5 py-3 text-sm font-medium"
            >
              View Details
            </Button>
          )}
        </div>
      </ModalFooter>
    </Modal>
  )
}
