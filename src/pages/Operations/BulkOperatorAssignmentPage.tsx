import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import {
  useOperatorAssignmentUpload,
  useOperatorAssignmentExecute,
} from '@/features/imports/hooks/useOperatorAssignment'
import type { OAPreviewResponse } from '@/features/imports/types/operatorAssignment'
import { OperatorAssignmentUpload } from './components/OperatorAssignmentUpload'
import { OperatorAssignmentPreview } from './components/OperatorAssignmentPreview'
import { OperatorAssignmentProgress } from './components/OperatorAssignmentProgress'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'

type PageState = 'upload' | 'preview' | 'processing'

export function BulkOperatorAssignmentPage() {
  const { t } = useTranslation('common')
  const [state, setState] = useState<PageState>('upload')
  const [preview, setPreview] = useState<OAPreviewResponse | null>(null)
  const [activeJobId, setActiveJobId] = useState<number | null>(null)
  const navigate = useNavigate()

  const activeProjectId = useAuthStore((s) =>
    s.user?.active_project_id ? Number(s.user.active_project_id) : null
  )

  const uploadMutation = useOperatorAssignmentUpload()
  const executeMutation = useOperatorAssignmentExecute()

  const handleFileSelected = (file: File) => {
    if (!activeProjectId) return

    uploadMutation.mutate(
      { file, projectId: activeProjectId },
      {
        onSuccess: (data) => {
          setPreview(data)
          setState('preview')
        },
      }
    )
  }

  const handleConfirm = (reason?: string) => {
    if (!preview) return

    executeMutation.mutate(
      {
        jobId: preview.job_id,
        request: { assignment_reason: reason },
      },
      {
        onSuccess: () => {
          setActiveJobId(preview.job_id)
          setState('processing')
        },
      }
    )
  }

  const handleCancel = () => {
    setPreview(null)
    setState('upload')
  }

  const handleComplete = () => {
    setPreview(null)
    setActiveJobId(null)
    setState('upload')
  }

  const handleViewHistory = () => {
    navigate('/dashboard/import/history?import_type=operator_assignment')
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
          {t('pages.imports.operatorAssignment.title')}
        </h1>

        <Button
          variant="primary"
          onClick={handleViewHistory}
          leftIcon={<Icons.TransactionHistory size={20} className="text-dark-500" />}
          className="flex h-10 w-full flex-row items-center justify-center rounded-full text-xs leading-[150%] font-medium sm:h-12 sm:w-auto"
        >
          {t('pages.imports.operatorAssignment.viewHistory')}
        </Button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white/50 p-4 shadow-sm sm:p-6">
        {state === 'upload' && (
          <OperatorAssignmentUpload
            onFileSelected={handleFileSelected}
            isUploading={uploadMutation.isPending}
          />
        )}

        {state === 'preview' && preview && (
          <OperatorAssignmentPreview
            preview={preview}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            isExecuting={executeMutation.isPending}
          />
        )}

        {state === 'processing' && activeJobId && (
          <OperatorAssignmentProgress jobId={activeJobId} onComplete={handleComplete} />
        )}
      </div>
    </div>
  )
}
