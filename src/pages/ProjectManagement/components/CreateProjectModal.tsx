/**
 * CreateProjectModal Component
 *
 * Modal for creating a new project.
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
import { useCreateProject } from '@/features/projects/hooks/useProjectMutations'
import type { CreateProjectInput } from '@/features/projects/types'
import { Icons } from '@/lib/icons'

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
  const [noEndDate, setNoEndDate] = useState(true)

  const createMutation = useCreateProject()

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name || formData.name.length < 3) {
      newErrors.name = 'Name must be at least 3 characters'
    }

    if (!formData.code || formData.code.length < 2) {
      newErrors.code = 'Code must be at least 2 characters'
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
      await createMutation.mutateAsync({
        name: formData.name,
        code: formData.code,
        description: formData.description || undefined,
        client_company: formData.client_company || undefined,
        contract_number: formData.contract_number || undefined,
        start_date: formData.start_date || undefined,
        end_date: noEndDate ? undefined : formData.end_date || undefined,
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
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#A7E8BD]">
            <Icons.Add size={20} color="#1A1A1A" strokeWidth={2} />
          </div>
        }
        title="Create New Project"
      />
      <ModalContent>
        <form id="create-project-form" onSubmit={handleSubmit} className="space-y-6">
          {createMutation.isError && (
            <Alert variant="error">
              <div>
                <p className="font-semibold">Error creating project</p>
                <p className="mt-1 text-sm">Failed to create project. Please try again.</p>
              </div>
            </Alert>
          )}

          {/* Project Information Section */}
          <div className="space-y-4">
            <h3 className="text-dark-950 text-base font-medium">Project Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="name"
                label="Project Name:"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Enter Project Name"
                disabled={createMutation.isPending}
                variant={errors.name ? 'error' : 'default'}
                error={errors.name}
              />

              <Input
                id="code"
                label="Project Code:"
                value={formData.code}
                onChange={(e) => handleChange('code', e.target.value)}
                placeholder="Enter Project Code"
                disabled={createMutation.isPending}
                variant={errors.code ? 'error' : 'default'}
                error={errors.code}
              />
            </div>
            <div className="h-px w-full bg-gray-200" />
          </div>

          {/* Client & Contract Section */}
          <div className="space-y-4">
            <h3 className="text-dark-950 text-base font-medium">Client & Contract</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                id="client_company"
                label="Client Company:"
                value={formData.client_company}
                onChange={(e) => handleChange('client_company', e.target.value)}
                placeholder="Client Company"
                disabled={createMutation.isPending}
              />

              <Input
                id="contract_number"
                label="Contract Number:"
                value={formData.contract_number}
                onChange={(e) => handleChange('contract_number', e.target.value)}
                placeholder="Contract Number"
                disabled={createMutation.isPending}
              />
            </div>
            <div className="h-px w-full bg-gray-200" />
          </div>

          {/* Timeline Section */}
          <div className="space-y-4">
            <h3 className="text-dark-950 text-base font-medium">Timeline</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <DateSelect
                  id="start_date"
                  value={formData.start_date}
                  onChange={(args) => {
                    const dateStr = args.value ? args.value.toISOString().split('T')[0] : ''
                    handleChange('start_date', dateStr)
                  }}
                  disabled={createMutation.isPending}
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
                  disabled={createMutation.isPending || noEndDate}
                  error={errors.end_date}
                  placeholder="End Date"
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
                  No end date
                </Label>
              </div>
            </div>
            <div className="h-px w-full bg-gray-200" />
          </div>

          {/* Description Section */}
          <div className="space-y-4">
            <Textarea
              id="description"
              label="Description:"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Placeholder text"
              rows={3}
              disabled={createMutation.isPending}
            />
          </div>
        </form>
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={createMutation.isPending}
          className="h-[45px] flex-1 rounded-md border-none bg-gray-500 text-sm font-medium text-white"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="create-project-form"
          variant="primary"
          disabled={createMutation.isPending}
          className="text-dark-950 h-[45px] flex-1 rounded-md border-none bg-[#A7E8BD] text-sm font-medium"
        >
          {createMutation.isPending ? 'Creating...' : 'Create Project'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
