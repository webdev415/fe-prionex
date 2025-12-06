/**
 * ArchiveProjectModal Component
 *
 * Confirmation modal for archiving a project.
 */

import { Dialog, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useArchiveProject } from '../hooks/useProjectMutations'
import type { ApiProject } from '../types'

interface ArchiveProjectModalProps {
  open: boolean
  project: Pick<ApiProject, 'id' | 'name' | 'code'>
  onSuccess: () => void
  onClose: () => void
}

export function ArchiveProjectModal({
  open,
  project,
  onSuccess,
  onClose,
}: ArchiveProjectModalProps) {
  const { mutate, isPending, isError, error } = useArchiveProject()

  const handleArchive = () => {
    mutate(
      { projectId: project.id },
      {
        onSuccess: () => {
          onSuccess()
          onClose()
        },
      }
    )
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Archive Project</DialogTitle>
      <DialogDescription>Are you sure you want to archive this project?</DialogDescription>

      {/* Project Information */}
      <div className="mt-4 rounded-lg bg-gray-50 p-4">
        <div className="space-y-1">
          <p className="text-sm">
            <span className="font-medium">Name:</span> {project.name}
          </p>
          <p className="text-sm">
            <span className="font-medium">Code:</span> {project.code}
          </p>
        </div>
      </div>

      {/* Warning Message */}
      <div className="mt-4">
        <Alert variant="warning">
          <p className="text-sm">
            This project will be hidden from active lists. You can restore it later if needed.
          </p>
        </Alert>
      </div>

      {/* API Error */}
      {isError && (
        <div className="mt-4">
          <Alert variant="error">
            <p className="text-sm">{error?.message || 'Failed to archive project'}</p>
          </Alert>
        </div>
      )}

      {/* Actions */}
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button variant="destructive" onClick={handleArchive} disabled={isPending}>
          {isPending ? 'Archiving...' : 'Archive'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
