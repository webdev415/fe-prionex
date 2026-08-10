import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import {
  useContactTagAssignmentExecute,
  useContactTagAssignmentUpload,
} from '@/features/imports/hooks/useContactTagAssignment'
import type {
  ContactTagAssignmentMode,
  ContactTagAssignmentPreviewResponse,
} from '@/features/imports/types/contactTagAssignment'
import { ContactTagAssignmentUpload } from './components/ContactTagAssignmentUpload'
import { ContactTagAssignmentPreview } from './components/ContactTagAssignmentPreview'
import { TagAssignmentProgress } from './components/TagAssignmentProgress'
import { BulkJobBanner } from './components/BulkJobBanner'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { toast } from 'sonner'

type PageState = 'upload' | 'preview' | 'processing'

export function BulkContactTagAssignmentPage() {
  const { t } = useTranslation('common')
  const [state, setState] = useState<PageState>('upload')
  const [mode, setMode] = useState<ContactTagAssignmentMode>('assign')
  const [preview, setPreview] = useState<ContactTagAssignmentPreviewResponse | null>(null)
  const [activeJobId, setActiveJobId] = useState<number | null>(null)
  const navigate = useNavigate()

  const activeProjectId = useAuthStore((s) =>
    s.user?.active_project_id ? Number(s.user.active_project_id) : null
  )

  const uploadMutation = useContactTagAssignmentUpload()
  const executeMutation = useContactTagAssignmentExecute()

  const handleFileSelected = (file: File) => {
    if (!activeProjectId) {
      toast.error(
        t('pages.imports.contactTagAssignment.noProjectToast', 'Select a project before uploading.')
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
    navigate('/dashboard/import/history?import_type=contact_tag_assignment')
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-foreground text-xl font-light sm:text-2xl">
          {t('pages.imports.contactTagAssignment.title', 'Bulk Contact Tag Assignment')}
        </h1>

        <Button
          variant="primary"
          onClick={handleViewHistory}
          leftIcon={<Icons.TransactionHistory size={20} className="text-primary-foreground" />}
          className="flex h-10 w-full flex-row items-center justify-center rounded-full text-xs leading-[150%] font-medium sm:h-12 sm:w-auto"
        >
          {t('pages.imports.contactTagAssignment.viewHistory', 'Import History')}
        </Button>
      </div>

      <div className="border-border bg-card/50 rounded-xl border p-4 shadow-sm sm:p-6">
        {state === 'upload' && (
          <ContactTagAssignmentUpload
            mode={mode}
            onModeChange={setMode}
            onFileSelected={handleFileSelected}
            isUploading={uploadMutation.isPending}
          />
        )}

        {state === 'preview' && preview && (
          <ContactTagAssignmentPreview
            preview={preview}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            isExecuting={executeMutation.isPending}
          />
        )}

        {/* Reused as-is: the progress view reads only the generic import job. */}
        {state === 'processing' && activeJobId && (
          <TagAssignmentProgress jobId={activeJobId} onComplete={handleComplete} />
        )}
      </div>

      <BulkJobBanner
        importType="contact_tag_assignment"
        label={t(
          'pages.imports.contactTagAssignment.bannerInProgress',
          'Contact tag operation in progress'
        )}
        onViewHistory={handleViewHistory}
        hidden={state === 'processing'}
      />
    </div>
  )
}
