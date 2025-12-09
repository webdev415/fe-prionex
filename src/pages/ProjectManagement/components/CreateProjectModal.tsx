/**
 * CreateProjectModal Component
 *
 * Modal for creating a new project.
 * Uses Modal component pattern consistent with UserManagement and RoleManagement.
 */

import { useState } from 'react'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useCreateProject } from '@/features/projects/hooks/useProjectMutations'
import type { CreateProjectInput } from '@/features/projects/types'
import { Icons } from '@/lib/icons'
import { colors } from '@/lib/colors'

interface CreateProjectModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateProjectModal({ open, onClose, onSuccess }: CreateProjectModalProps) {
  const [formData, setFormData] = useState<CreateProjectInput>({
    name: '',
    code: '',
    description: '',
    client_company: '',
    contract_number: '',
    start_date: '',
    end_date: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const createMutation = useCreateProject()

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name || formData.name.length < 3) {
      newErrors.name = 'Name must be at least 3 characters'
    }

    if (!formData.code || formData.code.length < 2) {
      newErrors.code = 'Code must be at least 2 characters'
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
      await createMutation.mutateAsync({
        name: formData.name,
        code: formData.code,
        description: formData.description || undefined,
        client_company: formData.client_company || undefined,
        contract_number: formData.contract_number || undefined,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
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
      })
      setErrors({})
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

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.primary[300] }}
          >
            <Icons.Add size={20} color={colors.neutral.dark[500]} strokeWidth={2} />
          </div>
        }
        title="Create New Project"
      />
      <ModalContent>
        <form id="create-project-form" onSubmit={handleSubmit} className="space-y-4">
          {createMutation.isError && (
            <Alert variant="error">
              <div>
                <p className="font-semibold">Error creating project</p>
                <p className="mt-1 text-sm">Failed to create project. Please try again.</p>
              </div>
            </Alert>
          )}

          {/* Two-column layout for name and code */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name" required>
                Project Name:
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Enter project name"
                disabled={createMutation.isPending}
                variant={errors.name ? 'error' : 'default'}
                className="mt-1"
              />
              {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
            </div>

            <div>
              <Label htmlFor="code" required>
                Project Code:
              </Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => handleChange('code', e.target.value)}
                placeholder="e.g., PROJ_001"
                disabled={createMutation.isPending}
                variant={errors.code ? 'error' : 'default'}
                className="mt-1"
              />
              {errors.code ? (
                <p className="mt-1 text-sm text-red-500">{errors.code}</p>
              ) : (
                <p className="mt-1 text-xs" style={{ color: colors.gray[500] }}>
                  Alphanumeric and underscores only
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description:</Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Enter project description"
              rows={3}
              disabled={createMutation.isPending}
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
                value={formData.client_company}
                onChange={(e) => handleChange('client_company', e.target.value)}
                placeholder="Enter client company"
                disabled={createMutation.isPending}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="contract_number">Contract Number:</Label>
              <Input
                id="contract_number"
                value={formData.contract_number}
                onChange={(e) => handleChange('contract_number', e.target.value)}
                placeholder="e.g., CN-2024-001"
                disabled={createMutation.isPending}
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
                value={formData.start_date}
                onChange={(e) => handleChange('start_date', e.target.value)}
                disabled={createMutation.isPending}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="end_date">End Date:</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => handleChange('end_date', e.target.value)}
                disabled={createMutation.isPending}
                variant={errors.end_date ? 'error' : 'default'}
                className="mt-1"
              />
              {errors.end_date && <p className="mt-1 text-sm text-red-500">{errors.end_date}</p>}
            </div>
          </div>
        </form>
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={createMutation.isPending}
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
          form="create-project-form"
          variant="primary"
          disabled={createMutation.isPending}
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
          {createMutation.isPending ? 'Creating...' : 'Create Project'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
