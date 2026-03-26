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
  const { data, isLoading } = useSegmentClients(segment.id, skip, pageSize)

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1

  const handleClientClick = (clientId: number) => {
    onClose()
    navigate(`/dashboard/clients/${clientId}`)
  }

  return (
    <Modal open onClose={onClose} maxWidth="xl">
      <ModalHeader
        icon={
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
            <Icons.Users size={18} className="text-blue-600" strokeWidth={1.5} />
          </div>
        }
        title={
          <span>
            {t('pages.tags.segments.clientsDrawerTitle', 'Clients in "{{name}}"', {
              name: segment.name,
            })}
            {data && <span className="ml-2 text-sm font-normal text-gray-500">({data.total})</span>}
          </span>
        }
      />

      <ModalContent>
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-gray-400">{t('common.loading', 'Loading...')}</span>
          </div>
        )}

        {!isLoading && data && data.client_ids.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icons.Users size={40} className="mb-3 text-gray-300" strokeWidth={1} />
            <p className="text-sm text-gray-500">
              {t('pages.tags.segments.noClientsInSegment', 'No clients match this segment')}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {t('pages.tags.segments.noClientsHint', 'Try refreshing the segment count first')}
            </p>
          </div>
        )}

        {!isLoading && data && data.client_ids.length > 0 && (
          <div className="space-y-1">
            {data.client_ids.map((clientId) => (
              <button
                key={clientId}
                onClick={() => handleClientClick(clientId)}
                className="flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 active:bg-gray-100"
              >
                <span className="text-dark-500 font-medium">
                  {t('pages.tags.segments.clientId', 'Client #{{id}}', { id: clientId })}
                </span>
                <Icons.ArrowRight size={14} className="text-gray-400" strokeWidth={1.5} />
              </button>
            ))}
          </div>
        )}

        {!isLoading && data && data.total > pageSize && (
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
            className="mt-4 border-t border-gray-100 pt-4"
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
