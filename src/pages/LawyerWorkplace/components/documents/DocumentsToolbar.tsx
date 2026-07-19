import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../context/lawyerWorkplaceLayout'
import type { LegalDocumentTypeFilter } from '../../documents/types'
import { DOCUMENT_TYPE_FILTERS } from './constants'
import { FilterCountBadge } from './FilterCountBadge'

interface DocumentsToolbarProps {
  typeFilter: LegalDocumentTypeFilter
  onTypeFilterChange: (filter: LegalDocumentTypeFilter) => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  filterCounts: Record<LegalDocumentTypeFilter, number>
  onGenerateDocument: () => void
  onAddIncoming: () => void
}

export function DocumentsToolbar({
  typeFilter,
  onTypeFilterChange,
  searchQuery,
  onSearchQueryChange,
  filterCounts,
  onGenerateDocument,
  onAddIncoming,
}: DocumentsToolbarProps) {
  const { t } = useTranslation('common')
  const { isCompact, isWide } = useLawyerWorkplaceLayout()

  return (
    <div
      className={cn('min-w-0 shrink-0 px-4 sm:px-5 lg:px-7', isCompact ? 'pt-3' : 'pt-4 lg:pt-5')}
    >
      <div className="mb-3 flex items-start justify-between gap-2 sm:mb-4 sm:gap-3">
        <div
          className={cn(
            'flex min-w-0 gap-0.5',
            isCompact ? 'flex-col' : 'flex-row items-center gap-3'
          )}
        >
          <h1
            className={cn(
              'text-dark-500 truncate font-light',
              isCompact ? 'text-lg' : 'text-xl lg:text-2xl'
            )}
          >
            {t('pages.lawyerWorkplace.documents.title', 'Documents')}
          </h1>
          <span
            className={cn(
              'font-light whitespace-nowrap text-gray-500',
              isCompact ? 'text-xs' : 'text-sm'
            )}
          >
            {t('pages.lawyerWorkplace.documents.department', 'Legal department')}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isCompact ? (
            <>
              <button
                type="button"
                onClick={onGenerateDocument}
                aria-label={t(
                  'pages.lawyerWorkplace.documents.generateDocument',
                  'Generate document'
                )}
                className="bg-secondary-800 hover:bg-secondary-600 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-white transition-colors"
              >
                <Icons.ArtificialIntelligence08 size={18} strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={onAddIncoming}
                aria-label={t('pages.lawyerWorkplace.documents.addIncoming', 'Add incoming')}
                className="bg-primary-300 text-dark-500 hover:bg-primary-400 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors"
              >
                <Icons.Add size={20} strokeWidth={2} />
              </button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                size="md"
                leftIcon={<Icons.ArtificialIntelligence08 size={18} strokeWidth={1.5} />}
                className={cn('rounded-md', isWide ? 'h-[45px]' : 'h-10 px-4 text-xs')}
                onClick={onGenerateDocument}
              >
                {t('pages.lawyerWorkplace.documents.generateDocument', 'Generate document')}
              </Button>
              <Button
                variant="primary"
                size="md"
                leftIcon={<Icons.AddCircle size={18} strokeWidth={1.5} />}
                className={cn('rounded-md', isWide ? 'h-[45px]' : 'h-10 px-4 text-xs')}
                onClick={onAddIncoming}
              >
                {t('pages.lawyerWorkplace.documents.addIncoming', 'Add incoming')}
              </Button>
            </>
          )}
        </div>
      </div>

      <div
        className={cn(
          'mb-4 flex min-w-0 gap-3',
          isCompact ? 'flex-col items-stretch' : 'flex-row items-start'
        )}
      >
        <div className={cn('w-full max-w-full min-w-0', !isCompact && 'flex-1')}>
          <div className="flex flex-wrap items-center gap-1.5">
            {DOCUMENT_TYPE_FILTERS.map((filter) => {
              const isActive = typeFilter === filter.id
              const count = filterCounts[filter.id]
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => onTypeFilterChange(filter.id)}
                  className={cn(
                    'flex shrink-0 cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors sm:px-4 sm:py-2 sm:text-[12px]',
                    isActive
                      ? 'bg-secondary-800 text-white'
                      : 'text-dark-500 bg-filter-bar hover:bg-card'
                  )}
                >
                  <span className="whitespace-nowrap">{t(filter.labelKey, filter.fallback)}</span>
                  <FilterCountBadge count={count} active={isActive} />
                </button>
              )
            })}
          </div>
        </div>

        <div
          className={cn(
            'relative shrink-0',
            isCompact ? 'w-full' : 'ml-auto w-full max-w-[280px]',
            !isCompact && isWide && 'max-w-[340px]'
          )}
        >
          <Icons.Search
            size={14}
            strokeWidth={1.5}
            className="text-light-500 pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder={t(
              'pages.lawyerWorkplace.documents.searchPlaceholder',
              'Search by name, client, document #...'
            )}
            className="text-dark-500 focus:border-primary-400 border-border bg-input placeholder:text-muted-foreground h-9 w-full rounded-full border py-2 pr-3 pl-9 text-[12px] outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchQueryChange('')}
              className="text-light-500 hover:text-dark-500 absolute top-1/2 right-3 -translate-y-1/2"
              aria-label={t('actions.close', 'Close')}
            >
              <Icons.Cancel01 size={12} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
