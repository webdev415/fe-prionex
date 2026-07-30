/**
 * EditProjectModal Component
 *
 * Modal for editing an existing project.
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
import { RadioGroup, RadioItem } from '@/components/ui/Radio'
import { useUpdateProject } from '@/features/projects/hooks/useProjectMutations'
import type { ApiProjectDetail, UpdateProjectInput } from '@/features/projects/types'
import { formatPickerDateAsYMD } from '@/lib/dateUtils'
import { Icons } from '@/lib/icons'
import {
  validateAllCompanyBankingFields,
  validateCompanyBankingField,
  type CompanyBankingFieldName,
} from './companyBankingFields'

interface EditProjectModalProps {
  project: ApiProjectDetail | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

interface EditProjectFormProps {
  project: ApiProjectDetail
  onClose: () => void
  onSuccess: () => void
}

function EditProjectForm({ project, onClose, onSuccess }: EditProjectFormProps) {
  const { t } = useTranslation('common')
  const [formData, setFormData] = useState<UpdateProjectInput>({
    name: project.name,
    description: project.description || '',
    client_company: project.client_company || '',
    contract_number: project.contract_number || '',
    start_date: project.start_date || '',
    end_date: project.end_date || '',
    status: project.status === 'archived' ? 'inactive' : project.status,
    // Company legal & banking details; hydrated from the project
    // detail (NULL → '' so the inputs stay controlled).
    full_company_name: project.full_company_name ?? '',
    address: project.address ?? '',
    edrpou_code: project.edrpou_code ?? '',
    website: project.website ?? '',
    email: project.email ?? '',
    hotline_phone: project.hotline_phone ?? '',
    director_name: project.director_name ?? '',
    iban: project.iban ?? '',
    bank_name: project.bank_name ?? '',
    bank_code: project.bank_code ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [noEndDate, setNoEndDate] = useState(!project.end_date)

  const updateMutation = useUpdateProject()

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name || formData.name.length < 3) {
      newErrors.name = t('pages.projects.modals.edit.errors.nameMinLength')
    }

    if (formData.start_date && formData.end_date && !noEndDate) {
      const start = new Date(formData.start_date)
      const end = new Date(formData.end_date)
      if (end < start) {
        newErrors.end_date = t('pages.projects.modals.edit.errors.endDateAfterStart')
      }
    }

    // Validate the 10 company/banking fields (optional; the helper
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
      const updateData: UpdateProjectInput = {}
      if (formData.name !== project.name) updateData.name = formData.name
      if (formData.description !== (project.description || ''))
        updateData.description = formData.description || undefined
      if (formData.client_company !== (project.client_company || ''))
        updateData.client_company = formData.client_company || undefined
      if (formData.contract_number !== (project.contract_number || ''))
        updateData.contract_number = formData.contract_number || undefined
      if (formData.start_date !== (project.start_date || ''))
        updateData.start_date = formData.start_date || undefined
      if (noEndDate) {
        updateData.end_date = undefined
      } else if (formData.end_date !== (project.end_date || '')) {
        updateData.end_date = formData.end_date || undefined
      }
      if (formData.status !== project.status && project.status !== 'archived')
        updateData.status = formData.status

      // Diff each company/banking field against the persisted value and only
      // include it in the payload if the operator actually touched it. A
      // cleared field is sent as explicit null so the BE knows to clear
      // it — sending undefined would drop the key from the JSON payload
      // and the BE would leave the existing value untouched.
      const cbFields: CompanyBankingFieldName[] = [
        'full_company_name',
        'address',
        'edrpou_code',
        'website',
        'email',
        'hotline_phone',
        'director_name',
        'iban',
        'bank_name',
        'bank_code',
      ]
      for (const f of cbFields) {
        const formValue = (formData[f] ?? '') as string
        const projectValue = (project[f] ?? '') as string
        if (formValue !== projectValue) {
          updateData[f] = formValue === '' ? null : formValue
        }
      }

      await updateMutation.mutateAsync({
        id: project.id,
        data: updateData,
      })

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Failed to update project:', error)
    }
  }

  const handleChange = (field: keyof UpdateProjectInput, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
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

  // Per-field on-blur validation for company/banking fields.
  const handleCompanyBankingBlur = (field: CompanyBankingFieldName) => {
    const value = (formData[field] ?? '') as string
    const errorKey = validateCompanyBankingField(field, value)
    setErrors((prev) => ({ ...prev, [field]: errorKey ? t(errorKey) : '' }))
  }

  return (
    <>
      <ModalContent>
        <form id="edit-project-form" onSubmit={handleSubmit} className="space-y-6">
          {updateMutation.isError && (
            <Alert variant="error">
              <div>
                <p className="font-semibold">{t('pages.projects.modals.edit.errorUpdating')}</p>
                <p className="mt-1 text-sm">{t('pages.projects.modals.edit.failedToUpdate')}</p>
              </div>
            </Alert>
          )}

          {/* Project Information Section */}
          <div className="space-y-4">
            <h3 className="text-dark-500 text-base font-medium">
              {t('pages.projects.modals.edit.projectInformation')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="name"
                label={t('pages.projects.modals.edit.projectName')}
                value={formData.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder={t('pages.projects.modals.edit.placeholders.projectName')}
                disabled={updateMutation.isPending}
                variant={errors.name ? 'error' : 'default'}
                error={errors.name}
              />

              <div>
                <Input
                  id="code"
                  label={t('pages.projects.modals.edit.projectCode')}
                  value={project.code}
                  disabled
                  className="bg-gray-100"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t('pages.projects.modals.edit.codeCannotBeChanged')}
                </p>
              </div>
            </div>
            {project.status !== 'archived' && (
              <div>
                <Label className="mb-2 block text-sm font-light">
                  {t('pages.projects.modals.edit.status')}
                </Label>
                <RadioGroup
                  value={formData.status}
                  onValueChange={(value) => handleChange('status', value)}
                  disabled={updateMutation.isPending}
                  className="flex gap-6"
                >
                  <div className="flex items-center gap-2">
                    <RadioItem value="active" id="status-active" />
                    <Label
                      htmlFor="status-active"
                      className="mb-0 cursor-pointer text-sm font-light"
                    >
                      {t('pages.projects.modals.edit.active')}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioItem value="inactive" id="status-inactive" />
                    <Label
                      htmlFor="status-inactive"
                      className="mb-0 cursor-pointer text-sm font-light"
                    >
                      {t('pages.projects.modals.edit.inactive')}
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}
            <div className="h-px w-full bg-gray-200" />
          </div>

          {/* Client & Contract Section */}
          <div className="space-y-4">
            <h3 className="text-dark-500 text-base font-medium">
              {t('pages.projects.modals.edit.clientContract')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="client_company"
                label={t('pages.projects.modals.edit.clientCompany')}
                value={formData.client_company || ''}
                onChange={(e) => handleChange('client_company', e.target.value)}
                placeholder={t('pages.projects.modals.edit.placeholders.clientCompany')}
                disabled={updateMutation.isPending}
              />

              <Input
                id="contract_number"
                label={t('pages.projects.modals.edit.contractNumber')}
                value={formData.contract_number || ''}
                onChange={(e) => handleChange('contract_number', e.target.value)}
                placeholder={t('pages.projects.modals.edit.placeholders.contractNumber')}
                disabled={updateMutation.isPending}
              />
            </div>
            <div className="h-px w-full bg-gray-200" />
          </div>

          {/* Timeline Section */}
          <div className="space-y-4">
            <h3 className="text-dark-500 text-base font-medium">
              {t('pages.projects.modals.edit.timeline')}
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
                  disabled={updateMutation.isPending}
                  error={errors.start_date}
                  placeholder={t('pages.projects.modals.edit.startDate')}
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
                  disabled={updateMutation.isPending || noEndDate}
                  error={errors.end_date}
                  placeholder={t('pages.projects.modals.edit.endDate')}
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="no_end_date"
                  checked={noEndDate}
                  onCheckedChange={handleNoEndDateChange}
                  disabled={updateMutation.isPending}
                />
                <Label htmlFor="no_end_date" className="mb-0 cursor-pointer">
                  {t('pages.projects.modals.edit.noEndDate')}
                </Label>
              </div>
            </div>
            <div className="h-px w-full bg-gray-200" />
          </div>

          {/* Company Details Section */}
          <div className="space-y-4">
            <h3 className="text-dark-500 text-base font-medium">
              {t('pages.projects.modals.edit.companyDetails.title')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="full_company_name"
                label={t('pages.projects.modals.edit.companyDetails.fullCompanyName')}
                value={formData.full_company_name ?? ''}
                onChange={(e) => handleChange('full_company_name', e.target.value)}
                onBlur={() => handleCompanyBankingBlur('full_company_name')}
                placeholder={t('pages.projects.modals.edit.placeholders.fullCompanyName')}
                disabled={updateMutation.isPending}
                maxLength={1000}
              />
              <Input
                id="edrpou_code"
                label={t('pages.projects.modals.edit.companyDetails.edrpouCode')}
                value={formData.edrpou_code ?? ''}
                onChange={(e) => handleChange('edrpou_code', e.target.value)}
                onBlur={() => handleCompanyBankingBlur('edrpou_code')}
                placeholder={t('pages.projects.modals.edit.placeholders.edrpouCode')}
                disabled={updateMutation.isPending}
                variant={errors.edrpou_code ? 'error' : 'default'}
                error={errors.edrpou_code}
                maxLength={8}
              />
            </div>
            <Textarea
              id="address"
              label={t('pages.projects.modals.edit.companyDetails.address')}
              value={formData.address ?? ''}
              onChange={(e) => handleChange('address', e.target.value)}
              onBlur={() => handleCompanyBankingBlur('address')}
              placeholder={t('pages.projects.modals.edit.placeholders.address')}
              rows={2}
              disabled={updateMutation.isPending}
              maxLength={1000}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="website"
                label={t('pages.projects.modals.edit.companyDetails.website')}
                value={formData.website ?? ''}
                onChange={(e) => handleChange('website', e.target.value)}
                onBlur={() => handleCompanyBankingBlur('website')}
                placeholder={t('pages.projects.modals.edit.placeholders.website')}
                disabled={updateMutation.isPending}
                maxLength={1000}
              />
              <Input
                id="email"
                type="email"
                label={t('pages.projects.modals.edit.companyDetails.email')}
                value={formData.email ?? ''}
                onChange={(e) => handleChange('email', e.target.value)}
                onBlur={() => handleCompanyBankingBlur('email')}
                placeholder={t('pages.projects.modals.edit.placeholders.email')}
                disabled={updateMutation.isPending}
                variant={errors.email ? 'error' : 'default'}
                error={errors.email}
                maxLength={1000}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="hotline_phone"
                label={t('pages.projects.modals.edit.companyDetails.hotlinePhone')}
                value={formData.hotline_phone ?? ''}
                onChange={(e) => handleChange('hotline_phone', e.target.value)}
                onBlur={() => handleCompanyBankingBlur('hotline_phone')}
                placeholder={t('pages.projects.modals.edit.placeholders.hotlinePhone')}
                disabled={updateMutation.isPending}
                variant={errors.hotline_phone ? 'error' : 'default'}
                error={errors.hotline_phone}
                maxLength={1000}
              />
              <Input
                id="director_name"
                label={t('pages.projects.modals.edit.companyDetails.directorName')}
                value={formData.director_name ?? ''}
                onChange={(e) => handleChange('director_name', e.target.value)}
                onBlur={() => handleCompanyBankingBlur('director_name')}
                placeholder={t('pages.projects.modals.edit.placeholders.directorName')}
                disabled={updateMutation.isPending}
                maxLength={1000}
              />
            </div>
            <div className="h-px w-full bg-gray-200" />
          </div>

          {/* Banking Details Section */}
          <div className="space-y-4">
            <h3 className="text-dark-500 text-base font-medium">
              {t('pages.projects.modals.edit.bankingDetails.title')}
            </h3>
            <Input
              id="iban"
              label={t('pages.projects.modals.edit.bankingDetails.iban')}
              value={formData.iban ?? ''}
              onChange={(e) => handleChange('iban', e.target.value)}
              onBlur={() => handleCompanyBankingBlur('iban')}
              placeholder={t('pages.projects.modals.edit.placeholders.iban')}
              disabled={updateMutation.isPending}
              variant={errors.iban ? 'error' : 'default'}
              error={errors.iban}
              maxLength={34}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="bank_name"
                label={t('pages.projects.modals.edit.bankingDetails.bankName')}
                value={formData.bank_name ?? ''}
                onChange={(e) => handleChange('bank_name', e.target.value)}
                onBlur={() => handleCompanyBankingBlur('bank_name')}
                placeholder={t('pages.projects.modals.edit.placeholders.bankName')}
                disabled={updateMutation.isPending}
                maxLength={1000}
              />
              <Input
                id="bank_code"
                label={t('pages.projects.modals.edit.bankingDetails.bankCode')}
                value={formData.bank_code ?? ''}
                onChange={(e) => handleChange('bank_code', e.target.value)}
                onBlur={() => handleCompanyBankingBlur('bank_code')}
                placeholder={t('pages.projects.modals.edit.placeholders.bankCode')}
                disabled={updateMutation.isPending}
                maxLength={1000}
              />
            </div>
            <div className="h-px w-full bg-gray-200" />
          </div>

          {/* Description Section */}
          <div className="space-y-4">
            <Textarea
              id="description"
              label={t('pages.projects.modals.edit.description')}
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder={t('pages.projects.modals.edit.placeholders.description')}
              rows={3}
              disabled={updateMutation.isPending}
            />
          </div>

          {project.status === 'archived' && (
            <Alert variant="warning">
              <p className="text-sm">{t('pages.projects.modals.edit.archivedWarning')}</p>
            </Alert>
          )}
        </form>
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          disabled={updateMutation.isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.cancel')}
        </Button>
        <Button
          type="submit"
          form="edit-project-form"
          variant="primary"
          disabled={updateMutation.isPending}
          className="h-[45px] flex-1 text-sm"
        >
          {updateMutation.isPending
            ? t('pages.projects.modals.edit.saving')
            : t('pages.projects.modals.edit.save')}
        </Button>
      </ModalFooter>
    </>
  )
}

export function EditProjectModal({ project, open, onClose, onSuccess }: EditProjectModalProps) {
  const { t } = useTranslation('common')

  if (!project) return null

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.PencilEdit size={20} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title={t('pages.projects.modals.edit.title')}
      />
      <EditProjectForm key={project.id} project={project} onClose={onClose} onSuccess={onSuccess} />
    </Modal>
  )
}
