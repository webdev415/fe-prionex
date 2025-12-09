/**
 * EditProjectModal Component
 *
 * Modal for editing an existing project.
 * Uses Modal component pattern consistent with UserManagement and RoleManagement.
 */

import { useState } from 'react'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
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

  const updateMutation = useUpdateProject()

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name || formData.name.length < 3) {
      newErrors.name = 'Name must be at least 3 characters'
    }

    if (formData.start_date && formData.end_date) {
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
      if (formData.end_date !== (project.end_date || ''))
        updateData.end_date = formData.end_date || undefined
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

  return (
    <>
      <ModalContent>
        <form id="edit-project-form" onSubmit={handleSubmit} className="space-y-4">
          {updateMutation.isError && (
            <Alert variant="error">
              <div>
                <p className="font-semibold">Error updating project</p>
                <p className="mt-1 text-sm">Failed to update project. Please try again.</p>
              </div>
            </Alert>
          )}

          {/* Code (Read-only) */}
          <div>
            <Label htmlFor="code">Project Code:</Label>
            <Input
              id="code"
              value={project.code}
              disabled
              className="mt-1"
              style={{ backgroundColor: colors.gray[100] }}
            />
            <p className="mt-1 text-xs" style={{ color: colors.gray[500] }}>
              Code cannot be changed after creation
            </p>
          </div>

          {/* Name */}
          <div>
            <Label htmlFor="name" required>
              Project Name:
            </Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Enter project name"
              disabled={updateMutation.isPending}
              variant={errors.name ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description:</Label>
            <textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Enter project description"
              rows={3}
              disabled={updateMutation.isPending}
              className="mt-1 block w-full rounded-md border px-3 py-2 text-sm focus:ring-1 focus:outline-none disabled:opacity-50"
              style={{
                borderColor: colors.light[100],
                color: colors.neutral.dark[500],
              }}
            />
          </div>

          {/* Two-column layout for client info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="client_company">Client Company:</Label>
              <Input
                id="client_company"
                value={formData.client_company || ''}
                onChange={(e) => handleChange('client_company', e.target.value)}
                placeholder="Enter client company"
                disabled={updateMutation.isPending}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="contract_number">Contract Number:</Label>
              <Input
                id="contract_number"
                value={formData.contract_number || ''}
                onChange={(e) => handleChange('contract_number', e.target.value)}
                placeholder="Enter contract number"
                disabled={updateMutation.isPending}
                className="mt-1"
              />
            </div>
          </div>

          {/* Two-column layout for dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">Start Date:</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date || ''}
                onChange={(e) => handleChange('start_date', e.target.value)}
                disabled={updateMutation.isPending}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="end_date">End Date:</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date || ''}
                onChange={(e) => handleChange('end_date', e.target.value)}
                disabled={updateMutation.isPending}
                variant={errors.end_date ? 'error' : 'default'}
                className="mt-1"
              />
              {errors.end_date && <p className="mt-1 text-sm text-red-500">{errors.end_date}</p>}
            </div>
          </div>

          {/* Status */}
          {project.status !== 'archived' && (
            <div>
              <Label htmlFor="status">Status:</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleChange('status', value)}
                disabled={updateMutation.isPending}
              >
                <SelectTrigger
                  className="mt-1 w-full border"
                  style={{
                    borderColor: colors.light[100],
                    fontSize: '14px',
                    color: colors.neutral.dark[500],
                  }}
                >
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

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
