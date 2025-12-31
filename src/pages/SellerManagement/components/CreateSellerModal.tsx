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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'

interface CreateSellerModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

// Common countries list - can be expanded
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

export function CreateSellerModal({ open, onClose, onSuccess }: CreateSellerModalProps) {
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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.companyName || formData.companyName.trim().length === 0) {
      newErrors.companyName = t('pages.sellers.modals.create.errors.companyNameRequired')
    }

    // Email validation if provided
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('pages.sellers.modals.create.errors.invalidEmail')
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
      // await createSellerMutation.mutateAsync(formData)
      console.log('Creating seller:', formData)

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500))

      onSuccess()
      onClose()
      // Reset form
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
      setErrors({})
    } catch (error) {
      console.error('Failed to create seller:', error)
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

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Add size={20} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title={t('pages.sellers.modals.create.title')}
      />
      <ModalContent>
        <form id="create-seller-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Company Information Section */}
          <div className="space-y-4">
            <h3 className="text-dark-500 text-base font-medium">
              {t('pages.sellers.modals.create.companyInformation')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="companyName"
                label={t('pages.sellers.modals.create.companyName')}
                value={formData.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
                placeholder={t('pages.sellers.modals.create.placeholders.companyName')}
                disabled={isSubmitting}
                variant={errors.companyName ? 'error' : 'default'}
                error={errors.companyName}
                required
              />

              <Input
                id="taxId"
                label={t('pages.sellers.modals.create.taxId')}
                value={formData.taxId}
                onChange={(e) => handleChange('taxId', e.target.value)}
                placeholder={t('pages.sellers.modals.create.placeholders.taxId')}
                disabled={isSubmitting}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="website"
                label={t('pages.sellers.modals.create.website')}
                value={formData.website}
                onChange={(e) => handleChange('website', e.target.value)}
                placeholder={t('pages.sellers.modals.create.placeholders.website')}
                disabled={isSubmitting}
              />

              <Input
                id="email"
                label={t('pages.sellers.modals.create.email')}
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder={t('pages.sellers.modals.create.placeholders.email')}
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
              {t('pages.sellers.modals.create.contactPerson')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="contactName"
                label={t('pages.sellers.modals.create.contactName')}
                value={formData.contactName}
                onChange={(e) => handleChange('contactName', e.target.value)}
                placeholder={t('pages.sellers.modals.create.placeholders.contactName')}
                disabled={isSubmitting}
              />

              <Input
                id="contactPhone"
                label={t('pages.sellers.modals.create.contactPhone')}
                value={formData.contactPhone}
                onChange={(e) => handleChange('contactPhone', e.target.value)}
                placeholder={t('pages.sellers.modals.create.placeholders.contactPhone')}
                disabled={isSubmitting}
              />
            </div>
            <div className="h-px w-full bg-gray-200" />
          </div>

          {/* Address Section (Optional) */}
          <div className="space-y-4">
            <h3 className="text-dark-500 text-base font-medium">
              {t('pages.sellers.modals.create.address')}
              <span className="text-sm font-normal text-gray-500">
                {' '}
                ({t('pages.sellers.modals.create.optional')})
              </span>
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="streetAddress"
                label={t('pages.sellers.modals.create.streetAddress')}
                value={formData.streetAddress}
                onChange={(e) => handleChange('streetAddress', e.target.value)}
                placeholder={t('pages.sellers.modals.create.placeholders.streetAddress')}
                disabled={isSubmitting}
              />

              <Input
                id="city"
                label={t('pages.sellers.modals.create.city')}
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder={t('pages.sellers.modals.create.placeholders.city')}
                disabled={isSubmitting}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="stateProvince"
                label={t('pages.sellers.modals.create.stateProvince')}
                value={formData.stateProvince}
                onChange={(e) => handleChange('stateProvince', e.target.value)}
                placeholder={t('pages.sellers.modals.create.placeholders.stateProvince')}
                disabled={isSubmitting}
              />

              <Input
                id="postalCode"
                label={t('pages.sellers.modals.create.postalCode')}
                value={formData.postalCode}
                onChange={(e) => handleChange('postalCode', e.target.value)}
                placeholder={t('pages.sellers.modals.create.placeholders.postalCode')}
                disabled={isSubmitting}
              />
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-dark-500 block text-sm font-light">
                  {t('pages.sellers.modals.create.country')}
                </label>
                <Select
                  value={formData.country}
                  onValueChange={(value) => handleChange('country', value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t('pages.sellers.modals.create.placeholders.country')}
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
                {t('pages.sellers.modals.create.notes')}{' '}
                <span className="text-sm font-normal text-gray-500">
                  ({t('pages.sellers.modals.create.optional')})
                </span>
              </label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder={t('pages.sellers.modals.create.placeholders.notes')}
                rows={4}
                disabled={isSubmitting}
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
          disabled={isSubmitting}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="submit"
          form="create-seller-form"
          variant="primary"
          disabled={isSubmitting}
          className="h-[45px] flex-1 text-sm"
        >
          {isSubmitting
            ? t('pages.sellers.modals.create.saving')
            : t('pages.sellers.modals.create.saveSeller')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default CreateSellerModal
