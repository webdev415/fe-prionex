/**
 * RestoreProjectModal Component
 *
 * Confirmation modal for restoring an archived project.
 */

import { Dialog, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { useRestoreProject } from '../hooks/useProjectMutations'
import type { ApiProject } from '../types'

interface RestoreProjectModalProps {
  open: boolean
  project: Pick<ApiProject, 'id' | 'name' | 'code'>
  onSuccess: () => void
  onClose: () => void
}

export function RestoreProjectModal({
  open,
  project,
  onSuccess,
  onClose,
}: RestoreProjectModalProps) {
  const { mutate, isPending, isError, error } = useRestoreProject()

  const handleRestore = () => {
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
      <DialogTitle>Restore Project</DialogTitle>
      <DialogDescription>Are you sure you want to restore this project?</DialogDescription>

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

      {/* Info Message */}
      <div className="mt-4">
        <Alert variant="info">
          <p className="text-sm">
            This project will be restored and visible in active project lists again.
          </p>
        </Alert>
      </div>

      {/* API Error */}
      {isError && (
        <div className="mt-4">
          <Alert variant="error">
            <p className="text-sm">{error?.message || 'Failed to restore project'}</p>
          </Alert>
        </div>
      )}

      {/* Actions */}
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button onClick={handleRestore} disabled={isPending}>
          {isPending ? 'Restoring...' : 'Restore'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
