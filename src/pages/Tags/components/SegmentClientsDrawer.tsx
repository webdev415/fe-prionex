/**
 * SegmentClientsDrawer
 *
 * Modal showing paginated client IDs for a segment,
 * with navigation links to individual client pages.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { Icons } from '@/lib/icons'
import { useSegmentClients } from '@/features/tags'
import type { Segment } from '@/features/tags'

interface SegmentClientsDrawerProps {
  segment: Segment
  onClose: () => void
}

const PAGE_SIZE = 50

export function SegmentClientsDrawer({ segment, onClose }: SegmentClientsDrawerProps) {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)

  const skip = (currentPage - 1) * pageSize
  const { data, isLoading, isError, error, refetch } = useSegmentClients(segment.id, skip, pageSize)

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1

  const handleClientClick = (clientId: number) => {
    onClose()
    navigate(`/dashboard/clients/${clientId}`)
  }

  return (
    <Modal open onClose={onClose} maxWidth="xl">
      <ModalHeader
        icon={
          <div className="bg-information-100 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Users size={18} className="text-information-600" strokeWidth={1.5} />
          </div>
        }
        title={
          <span>
            {t('pages.tags.segments.clientsDrawerTitle', 'Clients in "{{name}}"', {
              name: segment.name,
            })}
            {data && (
              <span className="text-muted-foreground ml-2 text-sm font-normal">({data.total})</span>
            )}
          </span>
        }
      />

      <ModalContent>
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <span className="text-muted-foreground text-sm">
              {t('common.loading', 'Loading...')}
            </span>
          </div>
        )}

        {!isLoading && isError && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-error-600 text-sm">
              {t('pages.tags.segments.clientsLoadError', 'Failed to load segment clients')}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {(error as Error)?.message ||
                t('pages.tags.segments.clientsLoadErrorHint', 'Please try again')}
            </p>
            <Button variant="cancel" className="mt-4 h-9 text-sm" onClick={() => refetch()}>
              {t('actions.retry', 'Retry')}
            </Button>
          </div>
        )}

        {!isLoading && !isError && data && data.client_ids.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icons.Users size={40} className="text-muted-foreground mb-3" strokeWidth={1} />
            <p className="text-muted-foreground text-sm">
              {t('pages.tags.segments.noClientsInSegment', 'No clients match this segment')}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('pages.tags.segments.noClientsHint', 'Try refreshing the segment count first')}
            </p>
          </div>
        )}

        {!isLoading && !isError && data && data.client_ids.length > 0 && (
          <div className="space-y-1">
            {data.client_ids.map((clientId) => (
              <button
                key={clientId}
                onClick={() => handleClientClick(clientId)}
                className="hover:bg-muted active:bg-muted flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-sm transition-colors"
              >
                <span className="text-foreground font-medium">
                  {t('pages.tags.segments.clientId', 'Client #{{id}}', { id: clientId })}
                </span>
                <Icons.ArrowRight size={14} className="text-muted-foreground" strokeWidth={1.5} />
              </button>
            ))}
          </div>
        )}

        {!isLoading && !isError && data && data.total > pageSize && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            pageSizeOptions={[20, 50, 100]}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setCurrentPage(1)
            }}
            className="border-border mt-4 border-t pt-4"
          />
        )}
      </ModalContent>

      <ModalFooter>
        <Button variant="cancel" onClick={onClose} className="h-[45px] flex-1 text-sm">
          {t('actions.close', 'Close')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
