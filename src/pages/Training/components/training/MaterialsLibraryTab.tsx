import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/lib/icons'
import { MOCK_MATERIALS, type MaterialType } from '../../mocks/trainerWorkplaceMocks'

/**
 * Materials Library sub-tab (KAN-499). Cards with type badge + download +
 * upload button on top toolbar.
 */
const TYPE_BADGE: Record<MaterialType, { label: string; tone: string }> = {
  pdf: { label: 'PDF', tone: 'bg-red-50 text-red-700' },
  docx: { label: 'DOCX', tone: 'bg-blue-50 text-blue-700' },
  video: { label: 'VIDEO', tone: 'bg-violet-50 text-violet-700' },
  audio: { label: 'AUDIO', tone: 'bg-amber-50 text-amber-700' },
}

const TYPE_FILTERS: (MaterialType | 'all')[] = ['all', 'pdf', 'docx', 'video', 'audio']

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

  const filtered = MOCK_MATERIALS.filter((m) => {
    const matchesType = typeFilter === 'all' || m.type === typeFilter
    const matchesQuery = !query || m.name.toLowerCase().includes(query.toLowerCase())
    return matchesType && matchesQuery
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-dark-500 text-base font-semibold">
          {t('pages.training.training.materials.title', 'Materials library')}
        </h2>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Icons.CloudDownload size={14} className="text-white" />}
          className="h-[40px] rounded-full px-4 text-xs"
        >
          {t('pages.training.training.materials.upload', 'Upload material')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Icons.Search
            size={14}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('pages.training.training.materials.searchPlaceholder', 'Search...')}
            className="h-[36px] w-[240px] rounded-full bg-white pl-9 text-xs"
          />
        </div>
        {TYPE_FILTERS.map((tp) => {
          const isActive = tp === typeFilter
          const label = tp === 'all' ? 'All types' : TYPE_BADGE[tp].label
          return (
            <button
              key={tp}
              type="button"
              onClick={() => setTypeFilter(tp)}
              className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 border-primary-300 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((m) => {
          const badge = TYPE_BADGE[m.type]
          return (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <div
                className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${badge.tone}`}
              >
                <Icons.File size={20} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-dark-500 truncate text-sm font-medium">{m.name}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-500">
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${badge.tone}`}
                  >
                    {badge.label}
                  </span>
                  <span>{formatSize(m.sizeBytes)}</span>
                  <span>·</span>
                  <span>{m.updatedLabel}</span>
                </div>
                <span className="text-[10px] text-gray-400">
                  {t('pages.training.training.materials.uploadedBy', 'by')} {m.uploadedBy}
                </span>
              </div>
              <button
                type="button"
                className="bg-primary-50 text-primary-700 hover:bg-primary-100 flex h-9 w-9 items-center justify-center rounded-full"
                aria-label="download"
              >
                <Icons.Download size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default MaterialsLibraryTab
