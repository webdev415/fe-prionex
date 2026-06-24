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
