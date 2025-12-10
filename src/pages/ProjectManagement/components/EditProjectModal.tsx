/**
 * EditProjectModal Component
 *
 * Modal for editing an existing project.
 * Uses Modal component pattern consistent with UserManagement and RoleManagement.
 */

import { useState } from 'react'
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
import { Icons } from '@/lib/icons'
import { colors } from '@/lib/colors'

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
      newErrors.name = 'Name must be at least 3 characters'
    }

    if (formData.start_date && formData.end_date && !noEndDate) {
      const start = new Date(formData.start_date)
      const end = new Date(formData.end_date)
      if (end < start) {
        newErrors.end_date = 'End date must be after start date'
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
                <p className="font-semibold">Error updating project</p>
                <p className="mt-1 text-sm">Failed to update project. Please try again.</p>
              </div>
            </Alert>
          )}

          {/* Project Information Section */}
          <div className="space-y-4">
            <h3
              className="text-base font-medium"
              style={{ color: colors.neutral.dark[500] }}
            >
              Project Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="name"
                label="Project Name:"
                value={formData.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Enter Project Name"
                disabled={updateMutation.isPending}
                variant={errors.name ? 'error' : 'default'}
                error={errors.name}
              />

              <div>
                <Input
                  id="code"
                  label="Project Code:"
                  value={project.code}
                  disabled
                  style={{ backgroundColor: colors.gray[100] }}
                />
                <p className="mt-1 text-xs" style={{ color: colors.gray[500] }}>
                  Code cannot be changed after creation
                </p>
              </div>
            </div>
            {project.status !== 'archived' && (
              <div>
                <Label className="mb-2 block" style={{ fontWeight: 300, fontSize: '14px' }}>
                  Status:
                </Label>
                <RadioGroup
                  value={formData.status}
                  onValueChange={(value) => handleChange('status', value)}
                  disabled={updateMutation.isPending}
                  className="flex gap-6"
                >
                  <div className="flex items-center gap-2">
                    <RadioItem value="active" id="status-active" />
                    <Label htmlFor="status-active" className="mb-0 cursor-pointer" style={{ fontWeight: 300, fontSize: '14px' }}>
                      Active
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioItem value="inactive" id="status-inactive" />
                    <Label htmlFor="status-inactive" className="mb-0 cursor-pointer" style={{ fontWeight: 300, fontSize: '14px' }}>
                      Inactive
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}
            <div className="h-px w-full" style={{ backgroundColor: colors.gray[200] }} />
          </div>

          {/* Client & Contract Section */}
          <div className="space-y-4">
            <h3
              className="text-base font-medium"
              style={{ color: colors.neutral.dark[500] }}
            >
              Client & Contract
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="client_company"
                label="Client Company:"
                value={formData.client_company || ''}
                onChange={(e) => handleChange('client_company', e.target.value)}
                placeholder="Client Company"
                disabled={updateMutation.isPending}
              />

              <Input
                id="contract_number"
                label="Contract Number:"
                value={formData.contract_number || ''}
                onChange={(e) => handleChange('contract_number', e.target.value)}
                placeholder="Contract Number"
                disabled={updateMutation.isPending}
              />
            </div>
            <div className="h-px w-full" style={{ backgroundColor: colors.gray[200] }} />
          </div>

          {/* Timeline Section */}
          <div className="space-y-4">
            <h3
              className="text-base font-medium"
              style={{ color: colors.neutral.dark[500] }}
            >
              Timeline
            </h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <DateSelect
                  id="start_date"
                  value={formData.start_date}
                  onChange={(args) => {
                    const dateStr = args.value ? args.value.toISOString().split('T')[0] : ''
                    handleChange('start_date', dateStr)
                  }}
                  disabled={updateMutation.isPending}
                  error={errors.start_date}
                  placeholder="Start Date"
                />
              </div>
              <div className="flex-1">
                <DateSelect
                  id="end_date"
                  value={formData.end_date}
                  onChange={(args) => {
                    const dateStr = args.value ? args.value.toISOString().split('T')[0] : ''
                    handleChange('end_date', dateStr)
                  }}
                  disabled={updateMutation.isPending || noEndDate}
                  error={errors.end_date}
                  placeholder="End Date"
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
                  No end date
                </Label>
              </div>
            </div>
            <div className="h-px w-full" style={{ backgroundColor: colors.gray[200] }} />
          </div>

          {/* Description Section */}
          <div className="space-y-4">
            <Textarea
              id="description"
              label="Description:"
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Placeholder text"
              rows={3}
              disabled={updateMutation.isPending}
            />
          </div>

          {project.status === 'archived' && (
            <Alert variant="warning">
              <p className="text-sm">
                This project is archived. Use the Restore action to reactivate it.
              </p>
            </Alert>
          )}
        </form>
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={updateMutation.isPending}
          className="flex-1 rounded-md text-sm font-medium"
          style={{
            border: 'none',
            backgroundColor: colors.gray[500],
            color: '#FFFFFF',
            height: '45px',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="edit-project-form"
          variant="primary"
          disabled={updateMutation.isPending}
          className="flex-1 rounded-md text-sm font-medium"
          style={{
            border: 'none',
            backgroundColor: colors.primary[300],
            color: colors.neutral.dark[500],
            height: '45px',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          {updateMutation.isPending ? 'Saving...' : 'Save'}
        </Button>
      </ModalFooter>
    </>
  )
}

export function EditProjectModal({ project, open, onClose, onSuccess }: EditProjectModalProps) {
  if (!project) return null

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.primary[300] }}
          >
            <Icons.PencilEdit size={20} color={colors.neutral.dark[500]} strokeWidth={2} />
          </div>
        }
        title="Edit Project"
      />
      <EditProjectForm key={project.id} project={project} onClose={onClose} onSuccess={onSuccess} />
    </Modal>
  )
}
