/**
 * Seller Config Table Component
 *
 * Displays list of seller-specific scoring configurations with edit/delete actions.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Icons } from '@/lib/icons'
import { configApi, type SellerConfig } from '@/features/clients/api/configApi'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'

interface SellerConfigTableProps {
  configs: SellerConfig[]
  onEdit: (config: SellerConfig) => void
  onDelete: () => void
}

export function SellerConfigTable({ configs, onEdit, onDelete }: SellerConfigTableProps) {
  const { t, i18n } = useTranslation('common')
  const [deletingSellerId, setDeletingSellerId] = useState<number | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<SellerConfig | null>(null)
  const isDeleteModalOpen = !!deleteCandidate

  const handleRequestDelete = (config: SellerConfig) => {
    setDeleteCandidate(config)
  }

  const handleCancelDelete = () => {
    if (deletingSellerId !== null) return
    setDeleteCandidate(null)
  }

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return
    try {
      setDeletingSellerId(deleteCandidate.seller_id)
      await configApi.deleteSellerConfig(deleteCandidate.seller_id)
      toast.success(
        t(
          'pages.scoringConfiguration.sellerConfigDeleted',
          'Seller configuration deleted successfully'
        )
      )
      onDelete()
    } catch (error) {
      console.error('Delete failed:', error)
      toast.error(t('pages.scoringConfiguration.deleteFailed', 'Failed to delete configuration'))
    } finally {
      setDeletingSellerId(null)
      setDeleteCandidate(null)
    }
  }

  const tableData = useMemo(() => {
    // DataTable requires `id`
    return configs.map((c) => ({ ...c, id: c.seller_id }))
  }, [configs])

  const columns: Column<SellerConfig & { id: number }>[] = useMemo(
    () => [
      {
        key: 'seller_name',
        header: t('pages.scoringConfiguration.seller', 'Seller'),
        align: 'left',
        render: (item) => (
          <span className="text-dark-500 text-sm font-medium">{item.seller_name}</span>
        ),
      },
      {
        key: 'critical',
        header: t('pages.scoringConfiguration.criticalThreshold', 'Critical'),
        align: 'center',
        render: (item) => (
          <span className="text-dark-400 text-sm">{item.priority_thresholds.critical}</span>
        ),
      },
      {
        key: 'high',
        header: t('pages.scoringConfiguration.highThreshold', 'High'),
        align: 'center',
        render: (item) => (
          <span className="text-dark-400 text-sm">{item.priority_thresholds.high}</span>
        ),
      },
      {
        key: 'medium',
        header: t('pages.scoringConfiguration.mediumThreshold', 'Medium'),
        align: 'center',
        render: (item) => (
          <span className="text-dark-400 text-sm">{item.priority_thresholds.medium}</span>
        ),
      },
      {
        key: 'clients_affected',
        header: t('pages.scoringConfiguration.clientsAffected', 'Clients Affected'),
        align: 'center',
        render: (item) => <span className="text-dark-400 text-sm">{item.clients_affected}</span>,
      },
      {
        key: 'updated_at',
        header: t('pages.scoringConfiguration.lastUpdated', 'Last Updated'),
        align: 'center',
        render: (item) => (
          <span className="text-dark-400 text-sm">
            {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '-'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: t('common.actions', 'Actions'),
        align: 'center',
        render: (item) => (
          <div className="flex items-center justify-center gap-2">
            <PermissionGuard permission={PERMISSIONS.SCORING_CONFIG.MANAGE_SELLER_CONFIG}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(item)
                }}
                className="rounded-md"
              >
                <Icons.PencilEdit02 size={16} />
                {t('actions.edit', 'Edit')}
              </Button>
            </PermissionGuard>
            <PermissionGuard permission={PERMISSIONS.SCORING_CONFIG.MANAGE_SELLER_CONFIG}>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRequestDelete(item)
                }}
                disabled={deletingSellerId === item.seller_id || deletingSellerId !== null}
                className="rounded-md"
              >
                <Icons.Delete size={16} />
                {deletingSellerId === item.seller_id
                  ? t('common.deleting', 'Deleting...')
                  : t('actions.delete', 'Delete')}
              </Button>
            </PermissionGuard>
          </div>
        ),
      },
    ],
    // i18n.language is needed to recalculate columns when language changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language, deletingSellerId, onEdit]
  )

  return (
    <>
      <DataTable
        columns={columns}
        data={tableData}
        emptyMessage={t(
          'pages.scoringConfiguration.noSellerConfigs',
          'No seller-specific configurations yet. Click "Add Seller-Specific Configuration" to create one.'
        )}
      />

      {/* Delete confirmation (consistent modal style) */}
      <Modal open={isDeleteModalOpen} onClose={handleCancelDelete} maxWidth="md">
        <ModalHeader
          icon={
            <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
              <Icons.Delete size={20} className="text-dark-500" strokeWidth={2} />
            </div>
          }
          title={t(
            'pages.scoringConfiguration.deleteSellerConfigTitle',
            'Delete seller configuration'
          )}
        />
        <ModalContent>
          <div className="text-dark-500 space-y-2 text-base font-light">
            <p>
              {t(
                'pages.scoringConfiguration.confirmDeleteSeller',
                'Are you sure you want to delete the custom configuration for "{{sellerName}}"? This will revert to project-level thresholds for this seller.',
                {
                  sellerName: deleteCandidate?.seller_name || '',
                }
              )}
            </p>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button
            type="button"
            variant="cancel"
            onClick={handleCancelDelete}
            disabled={deletingSellerId !== null}
            className="h-[45px] flex-1 text-sm"
          >
            {t('actions.cancel', 'Cancel')}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleConfirmDelete}
            disabled={deletingSellerId !== null}
            className="h-[45px] flex-1 text-sm"
          >
            {deletingSellerId !== null
              ? t('common.deleting', 'Deleting...')
              : t('actions.delete', 'Delete')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
