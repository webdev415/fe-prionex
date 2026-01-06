/**
 * Seller Config Table Component
 *
 * Displays list of seller-specific scoring configurations with edit/delete actions.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { configApi, type SellerConfig } from '@/features/clients/api/configApi'

interface SellerConfigTableProps {
  configs: SellerConfig[]
  onEdit: (config: SellerConfig) => void
  onDelete: () => void
}

export function SellerConfigTable({ configs, onEdit, onDelete }: SellerConfigTableProps) {
  const { t } = useTranslation('common')
  const [deletingSellerId, setDeletingSellerId] = useState<number | null>(null)

  const handleDelete = async (config: SellerConfig) => {
    if (
      !window.confirm(
        t(
          'pages.scoringConfiguration.confirmDeleteSeller',
          `Are you sure you want to delete the custom configuration for "${config.seller_name}"? This will revert to project-level thresholds for this seller.`
        )
      )
    ) {
      return
    }

    try {
      setDeletingSellerId(config.seller_id)
      await configApi.deleteSellerConfig(config.seller_id)
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
    }
  }

  if (configs.length === 0) {
    return (
      <div className="bg-light-100 text-dark-400 rounded-lg p-6 text-center text-sm">
        {t(
          'pages.scoringConfiguration.noSellerConfigs',
          'No seller-specific configurations yet. Click "Add Seller-Specific Configuration" to create one.'
        )}
      </div>
    )
  }

  return (
    <div className="border-light-200 overflow-x-auto rounded-lg border">
      <table className="w-full">
        <thead className="bg-light-100">
          <tr>
            <th className="text-dark-500 px-4 py-3 text-left text-sm font-semibold">
              {t('pages.scoringConfiguration.seller', 'Seller')}
            </th>
            <th className="text-dark-500 px-4 py-3 text-center text-sm font-semibold">
              {t('pages.scoringConfiguration.criticalThreshold', 'Critical')}
            </th>
            <th className="text-dark-500 px-4 py-3 text-center text-sm font-semibold">
              {t('pages.scoringConfiguration.highThreshold', 'High')}
            </th>
            <th className="text-dark-500 px-4 py-3 text-center text-sm font-semibold">
              {t('pages.scoringConfiguration.mediumThreshold', 'Medium')}
            </th>
            <th className="text-dark-500 px-4 py-3 text-center text-sm font-semibold">
              {t('pages.scoringConfiguration.clientsAffected', 'Clients Affected')}
            </th>
            <th className="text-dark-500 px-4 py-3 text-center text-sm font-semibold">
              {t('pages.scoringConfiguration.lastUpdated', 'Last Updated')}
            </th>
            <th className="text-dark-500 px-4 py-3 text-center text-sm font-semibold">
              {t('common.actions', 'Actions')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-light-200 divide-y">
          {configs.map((config) => (
            <tr key={config.seller_id} className="hover:bg-light-50 transition-colors">
              <td className="text-dark-500 px-4 py-3 text-sm font-medium">{config.seller_name}</td>
              <td className="text-dark-400 px-4 py-3 text-center text-sm">
                {config.priority_thresholds.critical}
              </td>
              <td className="text-dark-400 px-4 py-3 text-center text-sm">
                {config.priority_thresholds.high}
              </td>
              <td className="text-dark-400 px-4 py-3 text-center text-sm">
                {config.priority_thresholds.medium}
              </td>
              <td className="text-dark-400 px-4 py-3 text-center text-sm">
                {config.clients_affected}
              </td>
              <td className="text-dark-400 px-4 py-3 text-center text-sm">
                {new Date(config.updated_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onEdit(config)}
                    className="rounded-md"
                  >
                    <Icons.PencilEdit02 size={16} />
                    {t('common.edit', 'Edit')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(config)}
                    disabled={deletingSellerId === config.seller_id}
                    className="rounded-md"
                  >
                    <Icons.Delete size={16} />
                    {deletingSellerId === config.seller_id
                      ? t('common.deleting', 'Deleting...')
                      : t('common.delete', 'Delete')}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
