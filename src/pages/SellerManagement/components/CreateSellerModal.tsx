/**
 * CreateSellerModal Component
 *
 * Modal for creating a new seller.
 * Based on CreateProjectModal pattern.
 */

import { useState } from 'react'
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
import { useCreateSeller, type CreateSellerInput, type SellerType } from '@/features/sellers'

interface CreateSellerModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

// Seller type options
const SELLER_TYPES: { value: SellerType; label: string }[] = [
  { value: 'bank', label: 'Bank' },
  { value: 'mfo', label: 'MFO (Microfinance Organization)' },
  { value: 'collection_agency', label: 'Collection Agency' },
  { value: 'retail', label: 'Retail' },
  { value: 'telecom', label: 'Telecom' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'other', label: 'Other' },
]

interface SellerFormData extends Omit<CreateSellerInput, 'seller_type'> {
  seller_type: SellerType | ''
}

export function CreateSellerModal({ open, onClose, onSuccess }: CreateSellerModalProps) {
  const { t } = useTranslation('common')
  const createSellerMutation = useCreateSeller()

  const [formData, setFormData] = useState<SellerFormData>({
    seller_code: '',
    seller_name: '',
    seller_type: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    tax_id: '',
    notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.seller_code || formData.seller_code.trim().length === 0) {
      newErrors.seller_code = t('pages.sellers.modals.create.errors.sellerCodeRequired')
    }

    if (!formData.seller_name || formData.seller_name.trim().length === 0) {
      newErrors.seller_name = t('pages.sellers.modals.create.errors.sellerNameRequired')
    }

    if (!formData.seller_type) {
      newErrors.seller_type = t('pages.sellers.modals.create.errors.sellerTypeRequired')
    }

    // Email validation if provided
    if (formData.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
      newErrors.contact_email = t('pages.sellers.modals.create.errors.invalidEmail')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    try {
      // Filter out empty optional fields
      const submitData: CreateSellerInput = {
        seller_code: formData.seller_code,
        seller_name: formData.seller_name,
        seller_type: formData.seller_type as SellerType,
      }

      // Add optional fields only if they have values
      if (formData.contact_person) submitData.contact_person = formData.contact_person
      if (formData.contact_email) submitData.contact_email = formData.contact_email
      if (formData.contact_phone) submitData.contact_phone = formData.contact_phone
      if (formData.address) submitData.address = formData.address
      if (formData.tax_id) submitData.tax_id = formData.tax_id
      if (formData.notes) submitData.notes = formData.notes

      await createSellerMutation.mutateAsync(submitData)

      onSuccess()
      onClose()

      // Reset form
      setFormData({
        seller_code: '',
        seller_name: '',
        seller_type: '',
        contact_person: '',
        contact_email: '',
        contact_phone: '',
        address: '',
        tax_id: '',
        notes: '',
      })
      setErrors({})
    } catch (error) {
      console.error('Failed to create seller:', error)
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
            <Icons.Add size={18} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title={t('pages.sellers.modals.create.title')}
      />
      <ModalContent>
        <form id="create-seller-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information Section */}
          <div className="space-y-4">
            <h3 className="text-dark-500 text-base font-medium">
              {t('pages.sellers.modals.create.basicInformation')}
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                id="seller_code"
                label={t('pages.sellers.modals.create.sellerCode')}
                value={formData.seller_code}
                onChange={(e) => handleChange('seller_code', e.target.value)}
                placeholder={t('pages.sellers.modals.create.placeholders.sellerCode')}
                disabled={createSellerMutation.isPending}
                variant={errors.seller_code ? 'error' : 'default'}
                error={errors.seller_code}
                required
              />

              <Input
                id="seller_name"
                label={t('pages.sellers.modals.create.sellerName')}
                value={formData.seller_name}
                onChange={(e) => handleChange('seller_name', e.target.value)}
                placeholder={t('pages.sellers.modals.create.placeholders.sellerName')}
                disabled={createSellerMutation.isPending}
                variant={errors.seller_name ? 'error' : 'default'}
                error={errors.seller_name}
                required
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="seller_type" required>
                  {t('pages.sellers.modals.create.sellerType')}
                </Label>
                <Select
                  value={formData.seller_type}
                  onValueChange={(value) => handleChange('seller_type', value)}
                  disabled={createSellerMutation.isPending}
                >
                  <SelectTrigger id="seller_type">
                    <SelectValue
                      placeholder={t('pages.sellers.modals.create.placeholders.sellerType')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {SELLER_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.seller_type && <p className="text-xs text-red-500">{errors.seller_type}</p>}
              </div>

              <Input
                id="tax_id"
                label={t('pages.sellers.modals.create.taxId')}
                value={formData.tax_id || ''}
                onChange={(e) => handleChange('tax_id', e.target.value)}
                placeholder={t('pages.sellers.modals.create.placeholders.taxId')}
                disabled={createSellerMutation.isPending}
              />
            </div>
            <div className="h-px w-full bg-gray-200" />
          </div>

          {/* Contact Information Section */}
          <div className="space-y-4">
            <h3 className="text-dark-500 text-base font-medium">
              {t('pages.sellers.modals.create.contactInformation')}
              <span className="text-sm font-normal text-gray-500">
                {' '}
                ({t('pages.sellers.modals.create.optional')})
              </span>
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                id="contact_person"
                label={t('pages.sellers.modals.create.contactPerson')}
                value={formData.contact_person || ''}
                onChange={(e) => handleChange('contact_person', e.target.value)}
                placeholder={t('pages.sellers.modals.create.placeholders.contactPerson')}
                disabled={createSellerMutation.isPending}
              />

              <Input
                id="contact_phone"
                label={t('pages.sellers.modals.create.contactPhone')}
                value={formData.contact_phone || ''}
                onChange={(e) => handleChange('contact_phone', e.target.value)}
                placeholder={t('pages.sellers.modals.create.placeholders.contactPhone')}
                disabled={createSellerMutation.isPending}
              />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <Input
                id="contact_email"
                label={t('pages.sellers.modals.create.contactEmail')}
                type="email"
                value={formData.contact_email || ''}
                onChange={(e) => handleChange('contact_email', e.target.value)}
                placeholder={t('pages.sellers.modals.create.placeholders.contactEmail')}
                disabled={createSellerMutation.isPending}
                variant={errors.contact_email ? 'error' : 'default'}
                error={errors.contact_email}
              />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <Input
                id="address"
                label={t('pages.sellers.modals.create.address')}
                value={formData.address || ''}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder={t('pages.sellers.modals.create.placeholders.address')}
                disabled={createSellerMutation.isPending}
              />
            </div>
            <div className="h-px w-full bg-gray-200" />
          </div>

          {/* Notes Section (Optional) */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-dark-500 block text-sm font-light">
                {t('pages.sellers.modals.create.notes')}{' '}
                <span className="text-sm font-normal text-gray-500">
                  ({t('pages.sellers.modals.create.optional')})
                </span>
              </label>
              <Textarea
                id="notes"
                value={formData.notes || ''}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder={t('pages.sellers.modals.create.placeholders.notes')}
                rows={4}
                disabled={createSellerMutation.isPending}
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
          disabled={createSellerMutation.isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="submit"
          form="create-seller-form"
          variant="primary"
          disabled={createSellerMutation.isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {createSellerMutation.isPending
            ? t('pages.sellers.modals.create.saving')
            : t('pages.sellers.modals.create.saveSeller')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default CreateSellerModal
