import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { useSaleNotesExecute, useSaleNotesUpload } from '@/features/imports/hooks/useSaleNotes'
import type { SaleNotePreviewResponse } from '@/features/imports/types/saleNotes'
import { SaleNotesUpload } from './components/SaleNotesUpload'
import { SaleNotesPreview } from './components/SaleNotesPreview'
import { SaleNotesProgress } from './components/SaleNotesProgress'
import { BulkJobBanner } from './components/BulkJobBanner'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { toast } from 'sonner'

type PageState = 'upload' | 'preview' | 'processing'

export function BulkSaleNotesImportPage() {
  const { t } = useTranslation('common')
  const [state, setState] = useState<PageState>('upload')
  const [preview, setPreview] = useState<SaleNotePreviewResponse | null>(null)
  const [activeJobId, setActiveJobId] = useState<number | null>(null)
  const navigate = useNavigate()

  const activeProjectId = useAuthStore((s) =>
    s.user?.active_project_id ? Number(s.user.active_project_id) : null
  )

  const uploadMutation = useSaleNotesUpload()
  const executeMutation = useSaleNotesExecute()

  const handleFileSelected = (file: File) => {
    if (!activeProjectId) {
      toast.error(t('pages.imports.saleNotes.noProjectToast', 'Select a project before uploading.'))
      return
    }

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

  const handleConfirm = () => {
    if (!preview) return
    executeMutation.mutate(
      { jobId: preview.job_id },
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
    navigate('/dashboard/import/history?import_type=sale_notes')
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-foreground text-xl font-light sm:text-2xl">
          {t('pages.imports.saleNotes.title', 'Bulk Sales Note Import')}
        </h1>

        <Button
          variant="primary"
          onClick={handleViewHistory}
          leftIcon={<Icons.TransactionHistory size={20} className="text-primary-foreground" />}
          className="flex h-10 w-full flex-row items-center justify-center rounded-full text-xs leading-[150%] font-medium sm:h-12 sm:w-auto"
        >
          {t('pages.imports.saleNotes.viewHistory', 'Import History')}
        </Button>
      </div>

      <div className="border-border bg-card/50 rounded-xl border p-4 shadow-sm sm:p-6">
        {state === 'upload' && (
          <SaleNotesUpload
            onFileSelected={handleFileSelected}
            isUploading={uploadMutation.isPending}
          />
        )}

        {state === 'preview' && preview && (
          <SaleNotesPreview
            preview={preview}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            isExecuting={executeMutation.isPending}
          />
        )}

        {state === 'processing' && activeJobId && (
          <SaleNotesProgress jobId={activeJobId} onComplete={handleComplete} />
        )}
      </div>

      <BulkJobBanner
        importType="sale_notes"
        label={t('pages.imports.saleNotes.bannerInProgress', 'Sale notes import in progress')}
        onViewHistory={handleViewHistory}
        hidden={state === 'processing'}
      />
    </div>
  )
}
