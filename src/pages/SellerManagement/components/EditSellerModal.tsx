/**
 * EditSellerModal Component
 *
 * Modal for editing an existing seller.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import {
  useUpdateSeller,
  type Seller,
  type UpdateSellerInput,
  type SellerType,
} from '@/features/sellers'

interface EditSellerModalProps {
  open: boolean
  sellerId: number | null
  seller?: Seller
  onClose: () => void
  onSuccess: () => void
}

// Seller type raw DB values
const SELLER_TYPE_VALUES: SellerType[] = [
  'bank',
  'mfo',
  'collection_agency',
  'retail',
  'telecom',
  'utilities',
  'other',
]

interface SellerFormData {
  seller_name: string
  seller_type: SellerType | ''
  legal_name: string
  contact_person: string
  contact_email: string
  contact_phone: string
  address: string
  tax_id: string
  notes: string
}

export function EditSellerModal({
  open,
  sellerId,
  seller,
  onClose,
  onSuccess,
}: EditSellerModalProps) {
  const { t } = useTranslation('common')
  const updateSellerMutation = useUpdateSeller()

  const [formData, setFormData] = useState<SellerFormData>({
    seller_name: '',
    seller_type: '',
    legal_name: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    tax_id: '',
    notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Populate form when seller data loads
  useEffect(() => {
    if (seller) {
      // Defer setState to avoid cascading renders
      queueMicrotask(() => {
        setFormData({
          seller_name: seller.seller_name || '',
          seller_type: seller.seller_type || '',
          legal_name: seller.legal_name || '',
          contact_person: seller.contact_person || '',
          contact_email: seller.contact_email || '',
          contact_phone: seller.contact_phone || '',
          address: seller.address || '',
          tax_id: seller.tax_id || '',
          notes: seller.notes || '',
        })
      })
    }
  }, [seller])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.seller_name || formData.seller_name.trim().length === 0) {
      newErrors.seller_name = t('pages.sellers.modals.edit.errors.sellerNameRequired')
    }

    if (!formData.seller_type) {
      newErrors.seller_type = t('pages.sellers.modals.edit.errors.sellerTypeRequired')
    }

    // Email validation if provided
    if (formData.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
      newErrors.contact_email = t('pages.sellers.modals.edit.errors.invalidEmail')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!sellerId || !validateForm()) return

    try {
      // Build update data - only include fields that have values
      const updateData: UpdateSellerInput = {}

      if (formData.seller_name) updateData.seller_name = formData.seller_name
      if (formData.seller_type) updateData.seller_type = formData.seller_type as SellerType

      // Optional fields - include even if empty to allow clearing
      updateData.legal_name = formData.legal_name || undefined
      updateData.contact_person = formData.contact_person || undefined
      updateData.contact_email = formData.contact_email || undefined
      updateData.contact_phone = formData.contact_phone || undefined
      updateData.address = formData.address || undefined
      updateData.tax_id = formData.tax_id || undefined
      updateData.notes = formData.notes || undefined

      await updateSellerMutation.mutateAsync({ id: sellerId, data: updateData })

      onSuccess()
      onClose()
      setErrors({})
    } catch (error) {
      console.error('Failed to update seller:', error)
    }
  }

  const handleChange = (field: keyof SellerFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.PencilEdit size={18} className="text-foreground" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.sellers.modals.edit.title')}
      />
      <ModalContent>
        <form id="edit-seller-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information Section */}
          <div className="space-y-4">
            <h3 className="text-foreground text-base font-medium">
              {t('pages.sellers.modals.edit.basicInformation')}
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-sm font-light">
                  {t('pages.sellers.modals.edit.sellerCode')}
                </Label>
                <p className="text-foreground text-sm font-medium">{seller?.seller_code}</p>
                <p className="text-muted-foreground text-xs">
                  {t('pages.sellers.modals.edit.sellerCodeReadOnly')}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                id="seller_name"
                label={t('pages.sellers.modals.edit.sellerName')}
                value={formData.seller_name}
                onChange={(e) => handleChange('seller_name', e.target.value)}
                placeholder={t('pages.sellers.modals.edit.placeholders.sellerName')}
                disabled={updateSellerMutation.isPending}
                variant={errors.seller_name ? 'error' : 'default'}
                error={errors.seller_name}
                required
              />

              <div className="space-y-2">
                <Label htmlFor="seller_type" required>
                  {t('pages.sellers.modals.edit.sellerType')}
                </Label>
                <Select
                  value={formData.seller_type}
                  onValueChange={(value) => handleChange('seller_type', value)}
                  disabled={updateSellerMutation.isPending}
                >
                  <SelectTrigger id="seller_type">
                    <SelectValue
                      placeholder={t('pages.sellers.modals.edit.placeholders.sellerType')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {SELLER_TYPE_VALUES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`pages.sellers.types.${value}`, { defaultValue: value })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.seller_type && <p className="text-xs text-red-500">{errors.seller_type}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <Input
                id="legal_name"
                label={t('pages.sellers.modals.edit.legalName')}
                value={formData.legal_name}
                onChange={(e) => handleChange('legal_name', e.target.value)}
                placeholder={t('pages.sellers.modals.edit.placeholders.legalName')}
                disabled={updateSellerMutation.isPending}
              />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <Input
                id="tax_id"
                label={t('pages.sellers.modals.edit.taxId')}
                value={formData.tax_id}
                onChange={(e) => handleChange('tax_id', e.target.value)}
                placeholder={t('pages.sellers.modals.edit.placeholders.taxId')}
                disabled={updateSellerMutation.isPending}
              />
            </div>
            <div className="bg-border h-px w-full" />
          </div>

          {/* Contact Information Section */}
          <div className="space-y-4">
            <h3 className="text-foreground text-base font-medium">
              {t('pages.sellers.modals.edit.contactInformation')}
              <span className="text-muted-foreground text-sm font-normal">
                {' '}
                ({t('pages.sellers.modals.edit.optional')})
              </span>
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                id="contact_person"
                label={t('pages.sellers.modals.edit.contactPerson')}
                value={formData.contact_person}
                onChange={(e) => handleChange('contact_person', e.target.value)}
                placeholder={t('pages.sellers.modals.edit.placeholders.contactPerson')}
                disabled={updateSellerMutation.isPending}
              />

              <Input
                id="contact_phone"
                label={t('pages.sellers.modals.edit.contactPhone')}
                value={formData.contact_phone}
                onChange={(e) => handleChange('contact_phone', e.target.value)}
                placeholder={t('pages.sellers.modals.edit.placeholders.contactPhone')}
                disabled={updateSellerMutation.isPending}
              />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <Input
                id="contact_email"
                label={t('pages.sellers.modals.edit.contactEmail')}
                type="email"
                value={formData.contact_email}
                onChange={(e) => handleChange('contact_email', e.target.value)}
                placeholder={t('pages.sellers.modals.edit.placeholders.contactEmail')}
                disabled={updateSellerMutation.isPending}
                variant={errors.contact_email ? 'error' : 'default'}
                error={errors.contact_email}
              />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <Input
                id="address"
                label={t('pages.sellers.modals.edit.address')}
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder={t('pages.sellers.modals.edit.placeholders.address')}
                disabled={updateSellerMutation.isPending}
              />
            </div>
            <div className="bg-border h-px w-full" />
          </div>

          {/* Notes Section (Optional) */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-foreground block text-sm font-light">
                {t('pages.sellers.modals.edit.notes')}{' '}
                <span className="text-muted-foreground text-sm font-normal">
                  ({t('pages.sellers.modals.edit.optional')})
                </span>
              </label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder={t('pages.sellers.modals.edit.placeholders.notes')}
                rows={4}
                disabled={updateSellerMutation.isPending}
              />
            </div>
          </div>
        </form>
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          disabled={updateSellerMutation.isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="submit"
          form="edit-seller-form"
          variant="primary"
          disabled={updateSellerMutation.isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {updateSellerMutation.isPending
            ? t('pages.sellers.modals.edit.saving')
            : t('pages.sellers.modals.edit.saveChanges')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default EditSellerModal
