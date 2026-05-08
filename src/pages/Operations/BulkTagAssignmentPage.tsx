import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import {
  useTagAssignmentExecute,
  useTagAssignmentUpload,
} from '@/features/imports/hooks/useTagAssignment'
import type { TagAssignmentMode, TagPreviewResponse } from '@/features/imports/types/tagAssignment'
import { TagAssignmentUpload } from './components/TagAssignmentUpload'
import { TagAssignmentPreview } from './components/TagAssignmentPreview'
import { TagAssignmentProgress } from './components/TagAssignmentProgress'
import { BulkJobBanner } from './components/BulkJobBanner'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { toast } from 'sonner'

type PageState = 'upload' | 'preview' | 'processing'

export function BulkTagAssignmentPage() {
  const { t } = useTranslation('common')
  const [state, setState] = useState<PageState>('upload')
  const [mode, setMode] = useState<TagAssignmentMode>('assign')
  const [preview, setPreview] = useState<TagPreviewResponse | null>(null)
  const [activeJobId, setActiveJobId] = useState<number | null>(null)
  const navigate = useNavigate()

  const activeProjectId = useAuthStore((s) =>
    s.user?.active_project_id ? Number(s.user.active_project_id) : null
  )

  const uploadMutation = useTagAssignmentUpload()
  const executeMutation = useTagAssignmentExecute()

  const handleFileSelected = (file: File) => {
    if (!activeProjectId) {
      toast.error(
        t('pages.imports.tagAssignment.noProjectToast', 'Select a project before uploading.')
      )
      return
    }

    uploadMutation.mutate(
      { file, projectId: activeProjectId, mode },
      {
        onSuccess: (data) => {
          setPreview(data)
          setState('preview')
        },
      }
    )
  }

  const handleConfirm = () => {
    if (!preview) return
    executeMutation.mutate(
      { jobId: preview.job_id, request: {} },
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
    navigate('/dashboard/import/history?import_type=tag_assignment')
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
          {t('pages.imports.tagAssignment.title', 'Bulk Tag Assignment')}
        </h1>

        <Button
          variant="primary"
          onClick={handleViewHistory}
          leftIcon={<Icons.TransactionHistory size={20} className="text-dark-500" />}
          className="flex h-10 w-full flex-row items-center justify-center rounded-full text-xs leading-[150%] font-medium sm:h-12 sm:w-auto"
        >
          {t('pages.imports.tagAssignment.viewHistory', 'Import History')}
        </Button>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white/50 p-4 shadow-sm sm:p-6">
        {state === 'upload' && (
          <TagAssignmentUpload
            mode={mode}
            onModeChange={setMode}
            onFileSelected={handleFileSelected}
            isUploading={uploadMutation.isPending}
          />
        )}

        {state === 'preview' && preview && (
          <TagAssignmentPreview
            preview={preview}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            isExecuting={executeMutation.isPending}
          />
        )}

        {state === 'processing' && activeJobId && (
          <TagAssignmentProgress jobId={activeJobId} onComplete={handleComplete} />
        )}
      </div>

      <BulkJobBanner
        importType="tag_assignment"
        label={t('pages.imports.tagAssignment.bannerInProgress', 'Tag operation in progress')}
        onViewHistory={handleViewHistory}
        hidden={state === 'processing'}
      />
    </div>
  )
}
