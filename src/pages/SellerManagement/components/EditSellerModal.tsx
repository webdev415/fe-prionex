/**
 * EditSellerModal Component
 *
 * Modal for editing an existing seller.
 * Based on EditProjectModal pattern.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'

interface Seller {
  id: number
  companyName: string
  taxId: string
  website?: string
  email?: string
  contactName: string
  contactPhone?: string
  streetAddress?: string
  city?: string
  stateProvince?: string
  postalCode?: string
  country?: string
  notes?: string
}

interface EditSellerModalProps {
  open: boolean
  sellerId: number | null
  seller?: Seller
  onClose: () => void
  onSuccess: () => void
}

// Common countries list - same as CreateSellerModal
const COUNTRIES = [
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Germany',
  'France',
  'Italy',
  'Spain',
  'Netherlands',
  'Belgium',
  'Switzerland',
  'Austria',
  'Sweden',
  'Norway',
  'Denmark',
  'Finland',
  'Poland',
  'Czech Republic',
  'Ukraine',
  'Russia',
  'Other',
]

interface SellerFormData {
  companyName: string
  taxId: string
  website: string
  email: string
  contactName: string
  contactPhone: string
  streetAddress: string
  city: string
  stateProvince: string
  postalCode: string
  country: string
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
  const [formData, setFormData] = useState<SellerFormData>({
    companyName: '',
    taxId: '',
    website: '',
    email: '',
    contactName: '',
    contactPhone: '',
    streetAddress: '',
    city: '',
    stateProvince: '',
    postalCode: '',
    country: '',
    notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Load seller data when modal opens or seller changes
  useEffect(() => {
    if (open && sellerId && seller) {
      setIsLoading(true)
      // In a real app, you would fetch seller data here
      // For now, use the provided seller prop
      setFormData({
        companyName: seller.companyName || '',
        taxId: seller.taxId || '',
        website: seller.website || '',
        email: seller.email || '',
        contactName: seller.contactName || '',
        contactPhone: seller.contactPhone || '',
        streetAddress: seller.streetAddress || '',
        city: seller.city || '',
        stateProvince: seller.stateProvince || '',
        postalCode: seller.postalCode || '',
        country: seller.country || '',
        notes: seller.notes || '',
      })
      setIsLoading(false)
    } else if (open && !seller) {
      // If seller is not provided, reset form
      setFormData({
        companyName: '',
        taxId: '',
        website: '',
        email: '',
        contactName: '',
        contactPhone: '',
        streetAddress: '',
        city: '',
        stateProvince: '',
        postalCode: '',
        country: '',
        notes: '',
      })
    }
  }, [open, sellerId, seller])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.companyName || formData.companyName.trim().length === 0) {
      newErrors.companyName = t('pages.sellers.modals.edit.errors.companyNameRequired')
    }

    // Email validation if provided
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('pages.sellers.modals.edit.errors.invalidEmail')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setIsSubmitting(true)
    try {
      // TODO: Replace with actual API call
      // await updateSellerMutation.mutateAsync({ id: sellerId, ...formData })
      console.log('Updating seller:', sellerId, formData)

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Failed to update seller:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (field: keyof SellerFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  if (!seller && sellerId) {
    return (
      <Modal open={open} onClose={onClose} maxWidth="2xl">
        <ModalHeader
          icon={
            <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
              <Icons.PencilEdit size={20} className="text-dark-500" strokeWidth={2} />
            </div>
          }
          title={t('pages.sellers.modals.edit.title')}
        />
        <ModalContent>
          <div className="py-8 text-center text-gray-500">
            {t('pages.sellers.modals.edit.sellerNotFound')}
          </div>
        </ModalContent>
        <ModalFooter>
          <Button
            type="button"
            variant="cancel"
            onClick={onClose}
            className="h-[45px] flex-1 text-sm"
          >
            {t('actions.close')}
          </Button>
        </ModalFooter>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.PencilEdit size={20} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title={t('pages.sellers.modals.edit.title')}
      />
      <ModalContent>
        {isLoading ? (
          <div className="py-8 text-center text-gray-500">
            {t('pages.sellers.modals.edit.loadingSellerData')}
          </div>
        ) : (
          <form id="edit-seller-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Company Information Section */}
            <div className="space-y-4">
              <h3 className="text-dark-500 text-base font-medium">
                {t('pages.sellers.modals.edit.companyInformation')}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="companyName"
                  label={t('pages.sellers.modals.edit.companyName')}
                  value={formData.companyName}
                  onChange={(e) => handleChange('companyName', e.target.value)}
                  placeholder={t('pages.sellers.modals.edit.placeholders.companyName')}
                  disabled={isSubmitting}
                  variant={errors.companyName ? 'error' : 'default'}
                  error={errors.companyName}
                  required
                />

                <Input
                  id="taxId"
                  label={t('pages.sellers.modals.edit.taxId')}
                  value={formData.taxId}
                  onChange={(e) => handleChange('taxId', e.target.value)}
                  placeholder={t('pages.sellers.modals.edit.placeholders.taxId')}
                  disabled={isSubmitting}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="website"
                  label={t('pages.sellers.modals.edit.website')}
                  value={formData.website}
                  onChange={(e) => handleChange('website', e.target.value)}
                  placeholder={t('pages.sellers.modals.edit.placeholders.website')}
                  disabled={isSubmitting}
                />

                <Input
                  id="email"
                  label={t('pages.sellers.modals.edit.email')}
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder={t('pages.sellers.modals.edit.placeholders.email')}
                  disabled={isSubmitting}
                  variant={errors.email ? 'error' : 'default'}
                  error={errors.email}
                />
              </div>
              <div className="h-px w-full bg-gray-200" />
            </div>

            {/* Contact Person Section */}
            <div className="space-y-4">
              <h3 className="text-dark-500 text-base font-medium">
                {t('pages.sellers.modals.edit.contactPerson')}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="contactName"
                  label={t('pages.sellers.modals.edit.contactName')}
                  value={formData.contactName}
                  onChange={(e) => handleChange('contactName', e.target.value)}
                  placeholder={t('pages.sellers.modals.edit.placeholders.contactName')}
                  disabled={isSubmitting}
                />

                <Input
                  id="contactPhone"
                  label={t('pages.sellers.modals.edit.contactPhone')}
                  value={formData.contactPhone}
                  onChange={(e) => handleChange('contactPhone', e.target.value)}
                  placeholder={t('pages.sellers.modals.edit.placeholders.contactPhone')}
                  disabled={isSubmitting}
                />
              </div>
              <div className="h-px w-full bg-gray-200" />
            </div>

            {/* Address Section (Optional) */}
            <div className="space-y-4">
              <h3 className="text-dark-500 text-base font-medium">
                {t('pages.sellers.modals.edit.address')}
                <span className="text-sm font-normal text-gray-500">
                  {' '}
                  ({t('pages.sellers.modals.edit.optional')})
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="streetAddress"
                  label={t('pages.sellers.modals.edit.streetAddress')}
                  value={formData.streetAddress}
                  onChange={(e) => handleChange('streetAddress', e.target.value)}
                  placeholder={t('pages.sellers.modals.edit.placeholders.streetAddress')}
                  disabled={isSubmitting}
                />

                <Input
                  id="city"
                  label={t('pages.sellers.modals.edit.city')}
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder={t('pages.sellers.modals.edit.placeholders.city')}
                  disabled={isSubmitting}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  id="stateProvince"
                  label={t('pages.sellers.modals.edit.stateProvince')}
                  value={formData.stateProvince}
                  onChange={(e) => handleChange('stateProvince', e.target.value)}
                  placeholder={t('pages.sellers.modals.edit.placeholders.stateProvince')}
                  disabled={isSubmitting}
                />

                <Input
                  id="postalCode"
                  label={t('pages.sellers.modals.edit.postalCode')}
                  value={formData.postalCode}
                  onChange={(e) => handleChange('postalCode', e.target.value)}
                  placeholder={t('pages.sellers.modals.edit.placeholders.postalCode')}
                  disabled={isSubmitting}
                />
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <label className="text-dark-500 block text-sm font-light">
                    {t('pages.sellers.modals.edit.country')}
                  </label>
                  <Select
                    value={formData.country}
                    onValueChange={(value) => handleChange('country', value)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t('pages.sellers.modals.edit.placeholders.country')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="h-px w-full bg-gray-200" />
            </div>

            {/* Notes Section (Optional) */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-dark-500 block text-sm font-light">
                  {t('pages.sellers.modals.edit.notes')}{' '}
                  <span className="text-sm font-normal text-gray-500">
                    ({t('pages.sellers.modals.edit.optional')})
                  </span>
                </label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder={t('pages.sellers.modals.edit.placeholders.notes')}
                  rows={4}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </form>
        )}
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          disabled={isSubmitting || isLoading}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="submit"
          form="edit-seller-form"
          variant="primary"
          disabled={isSubmitting || isLoading}
          className="h-[45px] flex-1 text-sm"
        >
          {isSubmitting
            ? t('pages.sellers.modals.edit.saving')
            : t('pages.sellers.modals.edit.saveSeller')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default EditSellerModal
