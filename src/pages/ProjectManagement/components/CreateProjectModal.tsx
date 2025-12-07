/**
 * CreateProjectModal Component
 *
 * Modal for creating a new project.
 */

import { useState } from 'react'
import { Dialog, DialogTitle } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useCreateProject } from '@/features/projects/hooks/useProjectMutations'

interface CreateProjectModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateProjectModal({ open, onClose, onSuccess }: CreateProjectModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
  })

  const createMutation = useCreateProject()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await createMutation.mutateAsync({
        name: formData.name,
        code: formData.code,
        description: formData.description || undefined,
      })
      onSuccess()
      onClose()
      setFormData({ name: '', code: '', description: '' })
    } catch (error) {
      console.error('Failed to create project:', error)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="w-full max-w-2xl rounded-lg bg-white px-6 py-6 shadow-xl">
        <DialogTitle className="mb-4 text-xl font-semibold text-gray-900">
          Create New Project
        </DialogTitle>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
              Project Name *
            </label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Enter project name"
              required
              disabled={createMutation.isPending}
            />
          </div>

          <div>
            <label htmlFor="code" className="mb-1 block text-sm font-medium text-gray-700">
              Project Code *
            </label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => handleChange('code', e.target.value)}
              placeholder="Enter project code (e.g., PROJ_001)"
              required
              disabled={createMutation.isPending}
            />
            <p className="mt-1 text-xs text-gray-500">
              Alphanumeric characters and underscores only
            </p>
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Enter project description"
              rows={4}
              disabled={createMutation.isPending}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          {createMutation.isError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-800">Failed to create project. Please try again.</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  )
}
