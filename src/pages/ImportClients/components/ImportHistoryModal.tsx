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
import { colors } from '@/lib/colors'

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
      <div style={{ display: 'flex', flex: '1 0 0' }}>
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{
            backgroundColor: colors.secondary[800], // Dark green
            color: '#FFFFFF',
          }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor: '#FFFFFF',
            }}
          />
          <span
            style={{
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            Completed
          </span>
        </div>
      </div>
    )
  }

  if (status === 'completed_with_errors') {
    return (
      <div style={{ display: 'flex', flex: '1 0 0' }}>
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{
            backgroundColor: colors.gray[600],
            color: '#FFFFFF',
          }}
        >
          <Icons.Warning size={14} color="#FFFFFF" />
          <span
            style={{
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            Completed with errors
          </span>
        </div>
      </div>
    )
  }

  // Failed status
  return (
    <div style={{ display: 'flex', flex: '1 0 0' }}>
      <div
        className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
        style={{
          backgroundColor: '#EF4444', // Red
          color: '#FFFFFF',
        }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{
            backgroundColor: '#FFFFFF',
          }}
        />
        <span
          style={{
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          Failed
        </span>
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
        icon={<Icons.CloudDownload size={24} color={colors.neutral.dark[500]} strokeWidth={1.5} />}
        title="Last Import Summary"
      />

      <ModalContent>
        <div className="space-y-6">
          {/* Import Details */}
          <div className="space-y-4">
            <div className="flex flex-row justify-between">
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 300,
                  color: colors.neutral.dark[500],
                  lineHeight: '155%',
                  letterSpacing: '-0.32px',
                  width: '160px',
                }}
              >
                File:{' '}
              </span>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 500,
                  color: colors.neutral.dark[500],
                  lineHeight: '155%',
                  letterSpacing: '-0.32px',
                  flex: '1 0 0',
                }}
              >
                {data.file}
              </span>
            </div>

            <div className="flex flex-row justify-between">
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 300,
                  color: colors.neutral.dark[500],
                  lineHeight: '155%',
                  letterSpacing: '-0.32px',
                  width: '160px',
                }}
              >
                Uploaded by:{' '}
              </span>
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 500,
                  color: colors.neutral.dark[500],
                  lineHeight: '155%',
                  letterSpacing: '-0.32px',
                  flex: '1 0 0',
                }}
              >
                {data.uploadedBy} at {data.uploadedAt}
              </span>
            </div>

            <div className="flex flex-row justify-between">
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: 300,
                  color: colors.neutral.dark[500],
                  lineHeight: '155%',
                  letterSpacing: '-0.32px',
                  width: '160px',
                }}
              >
                Status:{' '}
              </span>
              <StatusBadge status={status} />
            </div>
          </div>

          {/* Summary Statistics - Only show if not failed */}
          {status !== 'failed' && data.totalRows !== undefined && (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 300,
                    color: colors.neutral.dark[500],
                    lineHeight: '155%',
                    letterSpacing: '-0.32px',
                    width: '160px',
                  }}
                >
                  Total rows:
                </span>
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: colors.neutral.dark[500],
                    lineHeight: '155%',
                    letterSpacing: '-0.32px',
                    flex: '1 0 0',
                  }}
                >
                  {data.totalRows.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between">
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 300,
                    color: colors.neutral.dark[500],
                    lineHeight: '155%',
                    letterSpacing: '-0.32px',
                    width: '160px',
                  }}
                >
                  New clients:
                </span>
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: colors.neutral.dark[500],
                    lineHeight: '155%',
                    letterSpacing: '-0.32px',
                    flex: '1 0 0',
                  }}
                >
                  {data.newClients?.toLocaleString() || 0}
                </span>
              </div>

              <div className="flex justify-between">
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 300,
                    color: colors.neutral.dark[500],
                    lineHeight: '155%',
                    letterSpacing: '-0.32px',
                    width: '160px',
                  }}
                >
                  Updated clients:
                </span>
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: colors.neutral.dark[500],
                    lineHeight: '155%',
                    letterSpacing: '-0.32px',
                    flex: '1 0 0',
                  }}
                >
                  {data.updatedClients?.toLocaleString() || 0}
                </span>
              </div>

              <div className="flex justify-between">
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 300,
                    color: colors.neutral.dark[500],
                    lineHeight: '155%',
                    letterSpacing: '-0.32px',
                    width: '160px',
                  }}
                >
                  Error:
                </span>
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: colors.neutral.dark[500],
                    lineHeight: '155%',
                    letterSpacing: '-0.32px',
                    flex: '1 0 0',
                  }}
                >
                  {data.errors || 0}
                </span>
              </div>

              <div className="flex justify-between">
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 300,
                    color: colors.neutral.dark[500],
                    lineHeight: '155%',
                    letterSpacing: '-0.32px',
                    width: '160px',
                  }}
                >
                  Processing time:
                </span>
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 500,
                    color: colors.neutral.dark[500],
                    lineHeight: '155%',
                    letterSpacing: '-0.32px',
                    flex: '1 0 0',
                  }}
                >
                  {data.processingTime || 'N/A'}
                </span>
              </div>
            </div>
          )}

          {/* Error Messages */}
          {status === 'failed' && (
            <div
              className="flex items-center justify-center"
              style={{
                padding: '24px',
                gap: '8px',
                alignSelf: 'stretch',
                borderRadius: '12px',
                border: '1px solid #FFFFFF',
                background: 'rgba(255, 255, 255, 0.50)',
              }}
            >
              <Icons.Warning size={20} color="#EF4444" />
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#EF4444',
                  lineHeight: '150%',
                  letterSpacing: '-0.28px',
                }}
              >
                The import failed due to a system error. No rows were processed.
              </span>
            </div>
          )}

          {status === 'completed_with_errors' && (
            <div
              className="flex items-center justify-center"
              style={{
                padding: '24px',
                gap: '8px',
                alignSelf: 'stretch',
                borderRadius: '12px',
                border: '1px solid #FFFFFF',
                background: 'rgba(255, 255, 255, 0.50)',
              }}
            >
              <Icons.Warning size={24} color="#EF4444" />
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#EF4444',
                  lineHeight: '150%',
                  letterSpacing: '-0.28px',
                }}
              >
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#FFFFFF',
                  color: colors.neutral.dark[500],
                  borderRadius: '8px',
                  borderColor: '#FFFFFF',
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  flex: '1 0 0',
                }}
              >
                View Details
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  // TODO: Implement download error report functionality
                  console.log('Download Error Report CSV clicked')
                }}
                leftIcon={<Icons.FileDownload size={20} color={colors.neutral.dark[500]} />}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#BBFB5B',
                  color: colors.neutral.dark[500],
                  borderRadius: '8px',
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  flex: '1 0 0',
                }}
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
              style={{
                backgroundColor: '#BBFB5B',
                color: colors.neutral.dark[500],
                borderRadius: '8px',
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: 500,
                width: '100%',
              }}
            >
              View Details
            </Button>
          )}
        </div>
      </ModalFooter>
    </Modal>
  )
}
