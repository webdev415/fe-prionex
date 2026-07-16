import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
import { useConfirm } from '@/components/ui/useConfirm'
import { useHasPermission } from '@/hooks'
import { downloadMaterial } from '@/features/training/api/materialsService'
import {
  useArchiveMaterial,
  useMaterialCategories,
  useMaterials,
} from '@/features/training/hooks/useMaterials'
import {
  MATERIAL_TYPES,
  isPreviewable,
  type Material,
  type MaterialType,
} from '@/features/training/types/materials'
import { TrainingFilterChips, TrainingPrimaryButton, TrainingSearchBar } from './TrainingToolbar'
import { MaterialUploadDialog } from './MaterialUploadDialog'
import { MaterialEditDialog } from './MaterialEditDialog'
import { MaterialPreviewModal } from './MaterialPreviewModal'
import { AttachMaterialToCallDialog } from './AttachMaterialToCallDialog'

const TYPE_BADGE: Record<MaterialType, { label: string; tone: string; iconBg: string }> = {
  pdf: { label: 'PDF', tone: 'text-[#B91C1C]', iconBg: 'bg-[#FEF2F2]' },
  docx: { label: 'DOCX', tone: 'text-[#2563EB]', iconBg: 'bg-[#EFF6FF]' },
  video: { label: 'VIDEO', tone: 'text-[#7C3AED]', iconBg: 'bg-[#F5F3FF]' },
  audio: { label: 'AUDIO', tone: 'text-[#D97706]', iconBg: 'bg-[#FFFBEB]' },
  other: { label: 'FILE', tone: 'text-[#4B5563]', iconBg: 'bg-[#F3F4F6]' },
}

const PAGE_SIZE = 48

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function formatUpdated(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return new Date(iso).toLocaleDateString()
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function MaterialsLibraryTab() {
  const { t } = useTranslation('common')
  const canView = useHasPermission('view_materials')
  const canManage = useHasPermission('manage_materials')
  const { confirm, confirmDialog } = useConfirm()

  const [typeFilter, setTypeFilter] = useState<MaterialType | 'all'>('all')
  const [query, setQuery] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Material | null>(null)
  const [previewTarget, setPreviewTarget] = useState<Material | null>(null)
  const [attachTarget, setAttachTarget] = useState<Material | null>(null)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const listFilters = useMemo(
    () => ({
      type: typeFilter === 'all' ? undefined : typeFilter,
      q: query || undefined,
      limit: PAGE_SIZE,
      offset: 0,
    }),
    [typeFilter, query]
  )

  const { data, isLoading, isError } = useMaterials(listFilters, canView)
  const { data: categories } = useMaterialCategories(canView)
  const archive = useArchiveMaterial()

  const materials = data?.data ?? []
  const total = data?.total ?? 0

  const categoryName = useMemo(() => {
    const map = new Map<number, string>()
    ;(categories ?? []).forEach((c) => map.set(c.id, c.name))
    return map
  }, [categories])

  const typeFilters = useMemo(
    () => [
      { id: 'all', label: t('pages.training.training.materials.filters.all', 'All types') },
      ...MATERIAL_TYPES.map((tp) => ({
        id: tp,
        label: t(`pages.training.training.materials.type.${tp}`, TYPE_BADGE[tp].label),
      })),
    ],
    [t]
  )

  const handleDownload = async (m: Material) => {
    setDownloadingId(m.id)
    try {
      const blob = await downloadMaterial(m.id)
      triggerBlobDownload(blob, m.original_filename)
    } catch {
      toast.error(
        t('pages.training.training.materials.errors.download', 'Could not download the file.')
      )
    } finally {
      setDownloadingId(null)
    }
  }

  const handleArchive = async (m: Material) => {
    const ok = await confirm({
      title: t('pages.training.training.materials.confirmArchiveTitle', 'Archive material'),
      message: t(
        'pages.training.training.materials.confirmArchive',
        'Archive "{{title}}"? It will be hidden from the library, but existing links keep working.',
        { title: m.title }
      ),
      confirmLabel: t('pages.training.training.materials.archive', 'Archive'),
      tone: 'danger',
    })
    if (!ok) return
    archive.mutate(m.id, {
      onError: () =>
        toast.error(
          t('pages.training.training.materials.errors.archive', 'Could not archive the material.')
        ),
    })
  }

  if (!canView) {
    return (
      <div className="rounded-xl border border-dashed border-[#EBECE8] bg-white p-8 text-center text-xs text-[#6B7280]">
        {t(
          'pages.training.training.materials.noAccess',
          'You do not have access to the materials library.'
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-semibold text-[#05040D]">
            {t('pages.training.training.materials.title', 'Materials library')}
          </h2>
          <span className="text-xs text-[#6B7280]">{total}</span>
        </div>
        {canManage && (
          <TrainingPrimaryButton
            onClick={() => setUploadOpen(true)}
            leftIcon={<Icons.FileImport size={14} className="text-white" />}
          >
            {t('pages.training.training.materials.upload', 'Upload material')}
          </TrainingPrimaryButton>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <TrainingSearchBar
          value={query}
          onChange={setQuery}
          placeholder={t('pages.training.training.materials.searchPlaceholder', 'Search...')}
        />
        <TrainingFilterChips
          items={typeFilters}
          activeId={typeFilter}
          onChange={(id) => setTypeFilter(id as MaterialType | 'all')}
        />
      </div>

      {isLoading && (
        <div className="rounded-xl border border-[#EBECE8] bg-white p-8 text-center text-xs text-[#6B7280]">
          {t('pages.training.training.materials.loading', 'Loading materials...')}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-4 text-xs text-[#B91C1C]">
          {t(
            'pages.training.training.materials.loadError',
            'Failed to load materials. Try refreshing.'
          )}
        </div>
      )}

      {!isLoading && !isError && materials.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#EBECE8] bg-white p-8 text-center text-xs text-[#6B7280]">
          {t(
            'pages.training.training.materials.empty',
            'No materials yet. Upload a PDF, document, video, or audio file.'
          )}
        </div>
      )}

      {materials.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((m) => {
            const badge = TYPE_BADGE[m.type]
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-[#EBECE8] bg-white p-4 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]"
              >
                <div
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${badge.iconBg}`}
                >
                  <Icons.File size={20} className={badge.tone} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-[#05040D]">{m.title}</span>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-[#6B7280]">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${badge.iconBg} ${badge.tone}`}
                    >
                      {t(`pages.training.training.materials.type.${m.type}`, badge.label)}
                    </span>
                    <span>{formatSize(m.size_bytes)}</span>
                    <span>·</span>
                    <span>{formatUpdated(m.updated_at)}</span>
                    {m.category_id != null && categoryName.has(m.category_id) && (
                      <>
                        <span>·</span>
                        <span>{categoryName.get(m.category_id)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1">
                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditTarget(m)}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-[#6B7280] hover:bg-[#F7F7F7]"
                        aria-label={t('actions.edit', 'Edit')}
                      >
                        <Icons.Edit size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setAttachTarget(m)}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-[#6B7280] hover:bg-[#F7F7F7]"
                        aria-label={t(
                          'pages.training.training.materials.attachToCall',
                          'Attach to a call'
                        )}
                      >
                        <Icons.Attachment01 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchive(m)}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-[#6B7280] hover:bg-[#F7F7F7] hover:text-[#B91C1C]"
                        aria-label={t('pages.training.training.materials.archive', 'Archive')}
                      >
                        <Icons.Delete size={16} />
                      </button>
                    </>
                  )}
                  {isPreviewable(m.type) && (
                    <button
                      type="button"
                      onClick={() => setPreviewTarget(m)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[#6B7280] hover:bg-[#F7F7F7]"
                      aria-label={t('pages.training.training.materials.preview', 'Preview')}
                    >
                      <Icons.Eye size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDownload(m)}
                    disabled={downloadingId === m.id}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F0FDF4] text-[#204E4D] hover:bg-[#BBFB5B]/40 disabled:opacity-50"
                    aria-label={t('actions.download', 'Download')}
                  >
                    <Icons.Download size={16} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <MaterialUploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <MaterialEditDialog material={editTarget} onClose={() => setEditTarget(null)} />
      <MaterialPreviewModal material={previewTarget} onClose={() => setPreviewTarget(null)} />
      <AttachMaterialToCallDialog material={attachTarget} onClose={() => setAttachTarget(null)} />
      {confirmDialog}
    </div>
  )
}

export default MaterialsLibraryTab
