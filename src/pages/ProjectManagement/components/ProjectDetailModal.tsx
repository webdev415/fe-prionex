/**
 * ProjectDetailModal Component
 *
 * Modal for viewing project details.
 */

import { Dialog, DialogTitle } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useProject } from '@/features/projects/hooks/useProject'

interface ProjectDetailModalProps {
  open: boolean
  projectId: number
  onClose: () => void
}

export function ProjectDetailModal({ open, projectId, onClose }: ProjectDetailModalProps) {
  const { data: project, isLoading } = useProject(projectId)

  if (isLoading || !project) {
    return (
      <Dialog open={open} onClose={onClose}>
        <div className="w-full max-w-2xl rounded-lg bg-white px-6 py-6 shadow-xl">
          <div className="text-center text-gray-400">Loading project details...</div>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="w-full max-w-2xl rounded-lg bg-white px-6 py-6 shadow-xl">
        <DialogTitle className="mb-4 text-xl font-semibold text-gray-900">
          Project Details
        </DialogTitle>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500">Project Name</label>
            <p className="mt-1 text-base text-gray-900">{project.name}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500">Project Code</label>
            <p className="mt-1 font-mono text-base text-gray-900">{project.code}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500">Status</label>
            <span
              className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                project.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {project.is_active ? 'Active' : 'Archived'}
            </span>
          </div>

          {project.description && (
            <div>
              <label className="block text-sm font-medium text-gray-500">Description</label>
              <p className="mt-1 text-base text-gray-700">{project.description}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-6">
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
