import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { MOCK_MATERIALS, type MaterialType } from '../../mocks/trainerWorkplaceMocks'
import { PendingFeatureDialog } from '../inbox/PendingFeatureDialog'
import { TrainingFilterChips, TrainingPrimaryButton, TrainingSearchBar } from './TrainingToolbar'

const TYPE_BADGE: Record<MaterialType, { label: string; tone: string; iconBg: string }> = {
  pdf: { label: 'PDF', tone: 'text-[#B91C1C]', iconBg: 'bg-[#FEF2F2]' },
  docx: { label: 'DOCX', tone: 'text-[#2563EB]', iconBg: 'bg-[#EFF6FF]' },
  video: { label: 'VIDEO', tone: 'text-[#7C3AED]', iconBg: 'bg-[#F5F3FF]' },
  audio: { label: 'AUDIO', tone: 'text-[#D97706]', iconBg: 'bg-[#FFFBEB]' },
}

const TYPE_FILTERS = [
  { id: 'all', label: 'All types' },
  { id: 'pdf', label: 'PDF' },
  { id: 'docx', label: 'DOCX' },
  { id: 'video', label: 'VIDEO' },
  { id: 'audio', label: 'AUDIO' },
]

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

export function MaterialsLibraryTab() {
  const { t } = useTranslation('common')
  const [typeFilter, setTypeFilter] = useState<MaterialType | 'all'>('all')
  const [query, setQuery] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)

  const filtered = MOCK_MATERIALS.filter((m) => {
    const matchesType = typeFilter === 'all' || m.type === typeFilter
    const matchesQuery = !query || m.name.toLowerCase().includes(query.toLowerCase())
    return matchesType && matchesQuery
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#05040D]">
          {t('pages.training.training.materials.title', 'Materials library')}
        </h2>
        <TrainingPrimaryButton
          onClick={() => setUploadOpen(true)}
          leftIcon={<Icons.CloudDownload size={14} className="text-white" />}
        >
          {t('pages.training.training.materials.upload', 'Upload material')}
        </TrainingPrimaryButton>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <TrainingSearchBar
          value={query}
          onChange={setQuery}
          placeholder={t('pages.training.training.materials.searchPlaceholder', 'Search...')}
        />
        <TrainingFilterChips
          items={TYPE_FILTERS}
          activeId={typeFilter}
          onChange={(id) => setTypeFilter(id as MaterialType | 'all')}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((m) => {
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
                <span className="truncate text-sm font-medium text-[#05040D]">{m.name}</span>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-[#6B7280]">
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${badge.iconBg} ${badge.tone}`}
                  >
                    {badge.label}
                  </span>
                  <span>{formatSize(m.sizeBytes)}</span>
                  <span>·</span>
                  <span>{m.updatedLabel}</span>
                </div>
                <span className="text-[10px] text-[#9CA3AF]">
                  {t('pages.training.training.materials.uploadedBy', 'by')} {m.uploadedBy}
                </span>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#F0FDF4] text-[#204E4D] hover:bg-[#BBFB5B]/40"
                aria-label="download"
              >
                <Icons.Download size={16} />
              </button>
            </div>
          )
        })}
      </div>

      <PendingFeatureDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        titleKey="pages.training.training.materials.upload"
        titleFallback="Upload material"
        descriptionKey="pages.training.training.pending.uploadMaterial"
        descriptionFallback="Upload PDF, DOCX, video, or audio files to the shared materials library."
        dependsOnIssue="KAN-499"
      />
    </div>
  )
}

export default MaterialsLibraryTab
