/**
 * CreateProjectModal Component
 *
 * Modal for creating a new project.
 * Uses Modal component pattern consistent with UserManagement and RoleManagement.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { DateSelect } from '@/components/ui/DateSelect'
import { Checkbox } from '@/components/ui/Checkbox'
import { Label } from '@/components/ui/Label'
import { useCreateProject } from '@/features/projects/hooks/useProjectMutations'
import {
  PROJECT_COUNTRIES,
  PROJECT_CURRENCIES,
  type CreateProjectInput,
} from '@/features/projects/types'
import { formatPickerDateAsYMD } from '@/lib/dateUtils'
import { Icons } from '@/lib/icons'
import {
  serializeCompanyBankingFields,
  validateAllCompanyBankingFields,
  validateCompanyBankingField,
  type CompanyBankingFieldName,
} from './companyBankingFields'
import { ProjectChoiceField } from './ProjectChoiceField'

interface CreateProjectModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateProjectModal({ open, onClose, onSuccess }: CreateProjectModalProps) {
  const { t } = useTranslation('common')
  const [formData, setFormData] = useState<CreateProjectInput>({
    name: '',
    code: '',
    description: '',
    client_company: '',
    contract_number: '',
    start_date: '',
    end_date: '',
    currency: 'UAH',
    country: 'UA',
    // Company legal & banking details, all optional
    full_company_name: '',
    address: '',
    edrpou_code: '',
    website: '',
    email: '',
    hotline_phone: '',
    director_name: '',
    iban: '',
    bank_name: '',
    bank_code: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [noEndDate, setNoEndDate] = useState(true)

  const createMutation = useCreateProject()

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name || formData.name.length < 3) {
      newErrors.name = t('pages.projects.modals.create.errors.nameMinLength')
    }

    if (!formData.code || formData.code.length < 2) {
      newErrors.code = t('pages.projects.modals.create.errors.codeMinLength')
    }

    if (formData.start_date && formData.end_date && !noEndDate) {
      const start = new Date(formData.start_date)
      const end = new Date(formData.end_date)
      if (end < start) {
        newErrors.end_date = t('pages.projects.modals.create.errors.endDateAfterStart')
      }
    }

    // Validate the 10 company/banking fields (each is optional; the helper
    // returns errors only for non-empty values that fail their regex).
    const cbErrors = validateAllCompanyBankingFields(formData)
    for (const [field, key] of Object.entries(cbErrors)) {
      newErrors[field] = t(key)
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    try {
      await createMutation.mutateAsync({
        name: formData.name,
        code: formData.code,
        description: formData.description || undefined,
        client_company: formData.client_company || undefined,
        contract_number: formData.contract_number || undefined,
        start_date: formData.start_date || undefined,
        end_date: noEndDate ? undefined : formData.end_date || undefined,
        currency: formData.currency,
        country: formData.country,
        // Spread the serialized company/banking payload (undefined for
        // empty fields so the BE stores NULL, not "").
        ...serializeCompanyBankingFields(formData),
      })
      onSuccess()
      onClose()
      setFormData({
        name: '',
        code: '',
        description: '',
        client_company: '',
        contract_number: '',
        start_date: '',
        end_date: '',
        currency: 'UAH',
        country: 'UA',
        full_company_name: '',
        address: '',
        edrpou_code: '',
        website: '',
        email: '',
        hotline_phone: '',
        director_name: '',
        iban: '',
        bank_name: '',
        bank_code: '',
      })
      setErrors({})
      setNoEndDate(false)
    } catch (error) {
      console.error('Failed to create project:', error)
    }
  }

  const handleChange = (field: keyof CreateProjectInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  // Per-field on-blur validation for company/banking fields.
  const handleCompanyBankingBlur = (field: CompanyBankingFieldName) => {
    const errorKey = validateCompanyBankingField(field, formData[field])
    setErrors((prev) => ({ ...prev, [field]: errorKey ? t(errorKey) : '' }))
  }

  const handleNoEndDateChange = (checked: boolean) => {
    setNoEndDate(checked)
    if (checked) {
      setFormData((prev) => ({ ...prev, end_date: '' }))
      if (errors.end_date) {
        setErrors((prev) => ({ ...prev, end_date: '' }))
      }
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.Add size={18} className="text-foreground" strokeWidth={2} />
          </div>
        }
        title={t('pages.projects.modals.create.title')}
      />
      <ModalContent>
        <form id="create-project-form" onSubmit={handleSubmit} className="space-y-6">
          {createMutation.isError && (
            <Alert variant="error">
              <div>
                <p className="font-semibold">{t('pages.projects.modals.create.errorCreating')}</p>
                <p className="mt-1 text-sm">{t('pages.projects.modals.create.failedToCreate')}</p>
              </div>
            </Alert>
          )}

          {/* Project Information Section */}
          <div className="space-y-4">
            <h3 className="text-foreground text-base font-medium">
              {t('pages.projects.modals.create.projectInformation')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="name"
                label={t('pages.projects.modals.create.projectName')}
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder={t('pages.projects.modals.create.placeholders.projectName')}
                disabled={createMutation.isPending}
                variant={errors.name ? 'error' : 'default'}
                error={errors.name}
              />

              <Input
                id="code"
                label={t('pages.projects.modals.create.projectCode')}
                value={formData.code}
                onChange={(e) => handleChange('code', e.target.value)}
                placeholder={t('pages.projects.modals.create.placeholders.projectCode')}
                disabled={createMutation.isPending}
                variant={errors.code ? 'error' : 'default'}
                error={errors.code}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ProjectChoiceField
                name="country"
                label={t('pages.projects.modals.country.label')}
                options={PROJECT_COUNTRIES.map((country) => ({
                  value: country,
                  label: t(`pages.projects.modals.country.${country}`),
                }))}
                value={formData.country}
                onChange={(value) => handleChange('country', value)}
                disabled={createMutation.isPending}
              />
              <ProjectChoiceField
                name="currency"
                label={t('pages.projects.modals.currency.label')}
                options={PROJECT_CURRENCIES.map((currency) => ({
                  value: currency,
                  label: t(`pages.projects.modals.currency.${currency}`),
                }))}
                value={formData.currency}
                onChange={(value) => handleChange('currency', value)}
                disabled={createMutation.isPending}
                hint={t('pages.projects.modals.currency.hint')}
              />
            </div>
            <div className="bg-border h-px w-full" />
          </div>

          {/* Client & Contract Section */}
          <div className="space-y-4">
            <h3 className="text-foreground text-base font-medium">
              {t('pages.projects.modals.create.clientContract')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="client_company"
                label={t('pages.projects.modals.create.clientCompany')}
                value={formData.client_company}
                onChange={(e) => handleChange('client_company', e.target.value)}
                placeholder={t('pages.projects.modals.create.placeholders.clientCompany')}
                disabled={createMutation.isPending}
              />

              <Input
                id="contract_number"
                label={t('pages.projects.modals.create.contractNumber')}
                value={formData.contract_number}
                onChange={(e) => handleChange('contract_number', e.target.value)}
                placeholder={t('pages.projects.modals.create.placeholders.contractNumber')}
                disabled={createMutation.isPending}
              />
            </div>
            <div className="bg-border h-px w-full" />
          </div>

          {/* Timeline Section */}
          <div className="space-y-4">
            <h3 className="text-foreground text-base font-medium">
              {t('pages.projects.modals.create.timeline')}
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <DateSelect
                  id="start_date"
                  value={formData.start_date}
                  onChange={(args) => {
                    const dateStr = args.value ? formatPickerDateAsYMD(args.value) : ''
                    handleChange('start_date', dateStr)
                  }}
                  disabled={createMutation.isPending}
                  error={errors.start_date}
                  placeholder={t('pages.projects.modals.create.startDate')}
                />
              </div>
              <div className="flex-1">
                <DateSelect
                  id="end_date"
                  value={formData.end_date}
                  onChange={(args) => {
                    const dateStr = args.value ? formatPickerDateAsYMD(args.value) : ''
                    handleChange('end_date', dateStr)
                  }}
                  disabled={createMutation.isPending || noEndDate}
                  error={errors.end_date}
                  placeholder={t('pages.projects.modals.create.endDate')}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="no_end_date"
                  checked={noEndDate}
                  onCheckedChange={handleNoEndDateChange}
                  disabled={createMutation.isPending}
                />
                <Label htmlFor="no_end_date" className="mb-0 cursor-pointer">
                  {t('pages.projects.modals.create.noEndDate')}
                </Label>
              </div>
            </div>
            <div className="bg-border h-px w-full" />
          </div>

          {/* Company Details Section */}
          <div className="space-y-4">
            <h3 className="text-dark-500 text-base font-medium">
              {t('pages.projects.modals.create.companyDetails.title')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="full_company_name"
                label={t('pages.projects.modals.create.companyDetails.fullCompanyName')}
                value={formData.full_company_name ?? ''}
                onChange={(e) => handleChange('full_company_name', e.target.value)}
                onBlur={() => handleCompanyBankingBlur('full_company_name')}
                placeholder={t('pages.projects.modals.create.placeholders.fullCompanyName')}
                disabled={createMutation.isPending}
                maxLength={1000}
              />
              <Input
                id="edrpou_code"
                label={t('pages.projects.modals.create.companyDetails.edrpouCode')}
                value={formData.edrpou_code ?? ''}
                onChange={(e) => handleChange('edrpou_code', e.target.value)}
                onBlur={() => handleCompanyBankingBlur('edrpou_code')}
                placeholder={t('pages.projects.modals.create.placeholders.edrpouCode')}
                disabled={createMutation.isPending}
                variant={errors.edrpou_code ? 'error' : 'default'}
                error={errors.edrpou_code}
                maxLength={9}
              />
            </div>
            <Textarea
              id="address"
              label={t('pages.projects.modals.create.companyDetails.address')}
              value={formData.address ?? ''}
              onChange={(e) => handleChange('address', e.target.value)}
              onBlur={() => handleCompanyBankingBlur('address')}
              placeholder={t('pages.projects.modals.create.placeholders.address')}
              rows={2}
              disabled={createMutation.isPending}
              maxLength={1000}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="website"
                label={t('pages.projects.modals.create.companyDetails.website')}
                value={formData.website ?? ''}
                onChange={(e) => handleChange('website', e.target.value)}
                onBlur={() => handleCompanyBankingBlur('website')}
                placeholder={t('pages.projects.modals.create.placeholders.website')}
                disabled={createMutation.isPending}
                maxLength={1000}
              />
              <Input
                id="email"
                type="email"
                label={t('pages.projects.modals.create.companyDetails.email')}
                value={formData.email ?? ''}
                onChange={(e) => handleChange('email', e.target.value)}
                onBlur={() => handleCompanyBankingBlur('email')}
                placeholder={t('pages.projects.modals.create.placeholders.email')}
                disabled={createMutation.isPending}
                variant={errors.email ? 'error' : 'default'}
                error={errors.email}
                maxLength={1000}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="hotline_phone"
                label={t('pages.projects.modals.create.companyDetails.hotlinePhone')}
                value={formData.hotline_phone ?? ''}
                onChange={(e) => handleChange('hotline_phone', e.target.value)}
                onBlur={() => handleCompanyBankingBlur('hotline_phone')}
                placeholder={t('pages.projects.modals.create.placeholders.hotlinePhone')}
                disabled={createMutation.isPending}
                variant={errors.hotline_phone ? 'error' : 'default'}
                error={errors.hotline_phone}
                maxLength={1000}
              />
              <Input
                id="director_name"
                label={t('pages.projects.modals.create.companyDetails.directorName')}
                value={formData.director_name ?? ''}
                onChange={(e) => handleChange('director_name', e.target.value)}
                onBlur={() => handleCompanyBankingBlur('director_name')}
                placeholder={t('pages.projects.modals.create.placeholders.directorName')}
                disabled={createMutation.isPending}
                maxLength={1000}
              />
            </div>
            <div className="h-px w-full bg-gray-200" />
          </div>

          {/* Banking Details Section */}
          <div className="space-y-4">
            <h3 className="text-dark-500 text-base font-medium">
              {t('pages.projects.modals.create.bankingDetails.title')}
            </h3>
            <Input
              id="iban"
              label={t('pages.projects.modals.create.bankingDetails.iban')}
              value={formData.iban ?? ''}
              onChange={(e) => handleChange('iban', e.target.value)}
              onBlur={() => handleCompanyBankingBlur('iban')}
              placeholder={t('pages.projects.modals.create.placeholders.iban')}
              disabled={createMutation.isPending}
              variant={errors.iban ? 'error' : 'default'}
              error={errors.iban}
              maxLength={34}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="bank_name"
                label={t('pages.projects.modals.create.bankingDetails.bankName')}
                value={formData.bank_name ?? ''}
                onChange={(e) => handleChange('bank_name', e.target.value)}
                onBlur={() => handleCompanyBankingBlur('bank_name')}
                placeholder={t('pages.projects.modals.create.placeholders.bankName')}
                disabled={createMutation.isPending}
                maxLength={1000}
              />
              <Input
                id="bank_code"
                label={t('pages.projects.modals.create.bankingDetails.bankCode')}
                value={formData.bank_code ?? ''}
                onChange={(e) => handleChange('bank_code', e.target.value)}
                onBlur={() => handleCompanyBankingBlur('bank_code')}
                placeholder={t('pages.projects.modals.create.placeholders.bankCode')}
                disabled={createMutation.isPending}
                maxLength={1000}
              />
            </div>
            <div className="h-px w-full bg-gray-200" />
          </div>

          {/* Description Section */}
          <div className="space-y-4">
            <Textarea
              id="description"
              label={t('pages.projects.modals.create.description')}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder={t('pages.projects.modals.create.placeholders.description')}
              rows={3}
              disabled={createMutation.isPending}
            />
          </div>
        </form>
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          disabled={createMutation.isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="submit"
          form="create-project-form"
          variant="primary"
          disabled={createMutation.isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {createMutation.isPending
            ? t('pages.projects.modals.create.creating')
            : t('actions.create')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
