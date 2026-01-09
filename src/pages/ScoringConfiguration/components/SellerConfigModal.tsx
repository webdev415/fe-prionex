/**
 * Seller Config Modal Component
 *
 * Modal for creating/editing seller-specific scoring configurations.
 * Allows setting custom priority thresholds for specific sellers.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import {
  configApi,
  type SellerConfig,
  type PriorityThresholds,
} from '@/features/clients/api/configApi'

interface SellerConfigModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  editConfig?: SellerConfig | null
  sellers: Array<{ id: number; name: string }>
  defaultThresholds?: PriorityThresholds // Current project thresholds to use as defaults
}

export function SellerConfigModal({
  open,
  onClose,
  onSuccess,
  editConfig,
  sellers,
  defaultThresholds,
}: SellerConfigModalProps) {
  const { t } = useTranslation('common')
  const isEditMode = !!editConfig

  // Form state
  const [sellerId, setSellerId] = useState<number | null>(null)
  const [thresholds, setThresholds] = useState<PriorityThresholds>({
    critical: 25,
    high: 18,
    medium: 10,
    low: 0,
  })

  // UI state
  const [isSaving, setIsSaving] = useState(false)

  // Initialize form with editConfig data or default thresholds
  useEffect(() => {
    if (editConfig) {
      setSellerId(editConfig.seller_id)
      setThresholds(editConfig.priority_thresholds)
    } else {
      // Reset form for create mode - use current project thresholds as defaults
      setSellerId(null)
      setThresholds(
        defaultThresholds || {
          critical: 25,
          high: 18,
          medium: 10,
          low: 0,
        }
      )
    }
  }, [editConfig, open, defaultThresholds])

  const handleSave = async () => {
    if (!sellerId) {
      toast.error(t('pages.scoringConfiguration.selectSeller', 'Please select a seller'))
      return
    }

    // Validation
    if (thresholds.critical <= thresholds.high) {
      toast.error(
        t(
          'pages.scoringConfiguration.criticalMustBeHigher',
          'Critical threshold must be higher than High'
        )
      )
      return
    }
    if (thresholds.high <= thresholds.medium) {
      toast.error(
        t(
          'pages.scoringConfiguration.highMustBeHigher',
          'High threshold must be higher than Medium'
        )
      )
      return
    }
    if (thresholds.medium <= thresholds.low) {
      toast.error(
        t(
          'pages.scoringConfiguration.mediumMustBeHigher',
          'Medium threshold must be higher than Low'
        )
      )
      return
    }

    try {
      setIsSaving(true)

      const configData = {
        priority_thresholds: thresholds,
        change_reason: isEditMode
          ? `Updated seller-specific config for seller ${sellerId}`
          : `Created seller-specific config for seller ${sellerId}`,
      }

      if (isEditMode) {
        await configApi.updateSellerConfig(sellerId, configData)
        toast.success(
          t(
            'pages.scoringConfiguration.sellerConfigUpdated',
            'Seller configuration updated successfully'
          )
        )
      } else {
        await configApi.createSellerConfig(sellerId, configData)
        toast.success(
          t(
            'pages.scoringConfiguration.sellerConfigCreated',
            'Seller configuration created successfully'
          )
        )
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Save failed:', error)
      toast.error(t('pages.scoringConfiguration.saveFailed', 'Failed to save configuration'))
    } finally {
      setIsSaving(false)
    }
  }

  const availableSellers = sellers.filter(
    (seller) => !editConfig || seller.id === editConfig.seller_id
  )

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Add size={20} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title={
          isEditMode
            ? t('pages.scoringConfiguration.editSellerConfig', 'Edit Seller Configuration')
            : t('pages.scoringConfiguration.addSellerConfig', 'Add Seller Configuration')
        }
      />

      <ModalContent>
        <div className="flex flex-col gap-6">
          {/* Seller Selection */}
          <div>
            <label className="text-dark-500 mb-2 block text-sm font-medium">
              {t('pages.scoringConfiguration.seller', 'Seller')}
            </label>
            <Select
              value={sellerId?.toString() || ''}
              onValueChange={(value) => setSellerId(Number(value))}
              disabled={isEditMode}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t('pages.scoringConfiguration.selectSeller', 'Select seller')}
                />
              </SelectTrigger>
              <SelectContent>
                {availableSellers.map((seller) => (
                  <SelectItem key={seller.id} value={seller.id.toString()}>
                    {seller.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Threshold Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-dark-500 mb-2 block text-sm font-medium">
                {t('pages.scoringConfiguration.criticalThreshold', 'Critical Threshold')}
              </label>
              <Input
                type="number"
                value={thresholds.critical}
                onChange={(e) =>
                  setThresholds((prev) => ({ ...prev, critical: Number(e.target.value) }))
                }
                min={0}
                max={100}
              />
              <p className="text-dark-300 mt-1 text-xs">
                {t(
                  'pages.scoringConfiguration.criticalHelp',
                  'Clients with score ≥ this value are Critical'
                )}
              </p>
            </div>

            <div>
              <label className="text-dark-500 mb-2 block text-sm font-medium">
                {t('pages.scoringConfiguration.highThreshold', 'High Threshold')}
              </label>
              <Input
                type="number"
                value={thresholds.high}
                onChange={(e) =>
                  setThresholds((prev) => ({ ...prev, high: Number(e.target.value) }))
                }
                min={0}
                max={100}
              />
              <p className="text-dark-300 mt-1 text-xs">
                {t(
                  'pages.scoringConfiguration.highHelp',
                  'Clients with score ≥ this value are High priority'
                )}
              </p>
            </div>

            <div>
              <label className="text-dark-500 mb-2 block text-sm font-medium">
                {t('pages.scoringConfiguration.mediumThreshold', 'Medium Threshold')}
              </label>
              <Input
                type="number"
                value={thresholds.medium}
                onChange={(e) =>
                  setThresholds((prev) => ({ ...prev, medium: Number(e.target.value) }))
                }
                min={0}
                max={100}
              />
              <p className="text-dark-300 mt-1 text-xs">
                {t(
                  'pages.scoringConfiguration.mediumHelp',
                  'Clients with score ≥ this value are Medium priority'
                )}
              </p>
            </div>

            <div>
              <label className="text-dark-500 mb-2 block text-sm font-medium">
                {t('pages.scoringConfiguration.lowThreshold', 'Low Threshold')}
              </label>
              <Input
                type="number"
                value={thresholds.low}
                onChange={(e) =>
                  setThresholds((prev) => ({ ...prev, low: Number(e.target.value) }))
                }
                min={0}
                max={100}
                disabled
              />
              <p className="text-dark-300 mt-1 text-xs">
                {t(
                  'pages.scoringConfiguration.lowHelp',
                  'Clients below Medium are Low priority (usually 0)'
                )}
              </p>
            </div>
          </div>
        </div>
      </ModalContent>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose} disabled={isSaving}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button onClick={handleSave} disabled={isSaving || !sellerId}>
          {isSaving
            ? t('common.saving', 'Saving...')
            : isEditMode
              ? t('common.update', 'Update')
              : t('common.create', 'Create')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
