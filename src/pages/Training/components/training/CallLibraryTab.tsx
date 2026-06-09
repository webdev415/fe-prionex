import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useHasPermission } from '@/hooks'
import {
  useArchiveLibraryCall,
  useBumpLibraryView,
  useLibraryCalls,
  useLibraryTags,
  useToggleLibraryHelpful,
} from '@/features/training/hooks/useLibraryCalls'
import {
  LIBRARY_CATEGORIES,
  type LibraryCallCard,
  type LibraryCategory,
} from '@/features/training/types/library'
import { TrainingFilterChips, TrainingPrimaryButton, TrainingSearchBar } from './TrainingToolbar'
import { CreateLibraryCallDialog } from './CreateLibraryCallDialog'

const CATEGORY_BADGE: Record<LibraryCategory, { label: string; tone: string; bg: string }> = {
  ideal: { label: 'Ideal', tone: 'text-[#15803D]', bg: 'bg-[#DCFCE7]' },
  mistake: { label: 'Mistake', tone: 'text-[#B91C1C]', bg: 'bg-[#FEE2E2]' },
  complex: { label: 'Complex', tone: 'text-[#B45309]', bg: 'bg-[#FEF3C7]' },
  non_standard: { label: 'Non-standard', tone: 'text-[#4338CA]', bg: 'bg-[#E0E7FF]' },
}

const PAGE_SIZE = 24

export function CallLibraryTab() {
  const { t } = useTranslation('common')
  const canManage = useHasPermission('manage_call_library')
  const [categoryFilter, setCategoryFilter] = useState<LibraryCategory | 'all'>('all')
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const listFilters = useMemo(
    () => ({
      category: categoryFilter === 'all' ? undefined : categoryFilter,
      q: query || undefined,
      limit: PAGE_SIZE,
      offset: 0,
    }),
    [categoryFilter, query]
  )

  const { data, isLoading, isError } = useLibraryCalls(listFilters)
  const { data: tags } = useLibraryTags()
  const toggleHelpful = useToggleLibraryHelpful()
  const archive = useArchiveLibraryCall()
  const bumpView = useBumpLibraryView()

  const cards = data?.data ?? []
  const total = data?.total ?? 0

  const categoryChips = useMemo(
    () => [
      { id: 'all', label: t('pages.training.training.library.filters.all', 'All') },
      ...LIBRARY_CATEGORIES.map((c) => ({
        id: c,
        label: t(
          `pages.training.training.library.categories.${c}`,
          CATEGORY_BADGE[c].label
        ),
      })),
    ],
    [t]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-semibold text-[#05040D]">
            {t('pages.training.training.library.title', 'Call library')}
          </h2>
          <span className="text-xs text-[#6B7280]">{total}</span>
        </div>
        {canManage && (
          <TrainingPrimaryButton
            onClick={() => setCreateOpen(true)}
            leftIcon={<Icons.Add size={14} className="text-white" />}
          >
            {t('pages.training.training.library.add', 'Add to library')}
          </TrainingPrimaryButton>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <TrainingSearchBar
          value={query}
          onChange={setQuery}
          placeholder={t(
            'pages.training.training.library.searchPlaceholder',
            'Search by title or description...'
          )}
        />
        <TrainingFilterChips
          items={categoryChips}
          activeId={categoryFilter}
          onChange={(id) => setCategoryFilter(id as LibraryCategory | 'all')}
        />
      </div>

      {isLoading && (
        <div className="rounded-xl border border-[#EBECE8] bg-white p-8 text-center text-xs text-[#6B7280]">
          {t('pages.training.training.library.loading', 'Loading library...')}
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-4 text-xs text-[#B91C1C]">
          {t(
            'pages.training.training.library.loadError',
            'Failed to load the library. Try refreshing.'
          )}
        </div>
      )}

      {!isLoading && !isError && cards.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#EBECE8] bg-white p-8 text-center text-xs text-[#6B7280]">
          {t(
            'pages.training.training.library.empty',
            'No library calls yet. Promote a marker from a call recording or click "Add to library".'
          )}
        </div>
      )}

      {cards.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <LibraryCardTile
              key={card.id}
              card={card}
              canManage={canManage}
              onOpen={() => bumpView.mutate(card.id)}
              onToggleHelpful={() => toggleHelpful.mutate(card.id)}
              onArchive={() => {
                if (window.confirm(t('pages.training.training.library.confirmArchive', 'Remove this call from the library?'))) {
                  archive.mutate(card.id)
                }
              }}
            />
          ))}
        </div>
      )}

      <CreateLibraryCallDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        existingTags={tags ?? []}
      />
    </div>
  )
}

interface LibraryCardTileProps {
  card: LibraryCallCard
  canManage: boolean
  onOpen: () => void
  onToggleHelpful: () => void
  onArchive: () => void
}

function LibraryCardTile({
  card,
  canManage,
  onOpen,
  onToggleHelpful,
  onArchive,
}: LibraryCardTileProps) {
  const { t } = useTranslation('common')
  const badge = CATEGORY_BADGE[card.category]
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#EBECE8] bg-white p-4 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.bg} ${badge.tone}`}
        >
          {t(
            `pages.training.training.library.categories.${card.category}`,
            badge.label
          )}
        </span>
        {canManage && (
          <button
            type="button"
            onClick={onArchive}
            className="rounded-full p-1 text-[#6B7280] hover:bg-[#F7F7F7] hover:text-[#B91C1C]"
            aria-label={t(
              'pages.training.training.library.archive',
              'Remove from library'
            )}
          >
            <Icons.Delete size={14} />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-col items-start gap-1 text-left"
      >
        <span className="line-clamp-2 text-sm font-medium text-[#05040D]">
          {card.title}
        </span>
        {card.description && (
          <span className="line-clamp-3 text-[11px] text-[#6B7280]">
            {card.description}
          </span>
        )}
      </button>
      {card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] text-[#374151]"
            >
              #{tag}
            </span>
          ))}
          {card.tags.length > 4 && (
            <span className="text-[10px] text-[#9CA3AF]">+{card.tags.length - 4}</span>
          )}
        </div>
      )}
      <div className="mt-auto flex items-center justify-between border-t border-[#F1F1EE] pt-2 text-[10px] text-[#6B7280]">
        <div className="inline-flex items-center gap-1">
          <Icons.Eye size={12} />
          <span>{card.view_count}</span>
        </div>
        <button
          type="button"
          onClick={onToggleHelpful}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 transition-colors ${
            card.voted_helpful
              ? 'bg-[#F0FDF4] text-[#15803D]'
              : 'text-[#6B7280] hover:bg-[#F7F7F7]'
          }`}
        >
          <Icons.Star size={12} />
          <span>{card.helpful_count}</span>
        </button>
      </div>
    </div>
  )
}

export default CallLibraryTab
