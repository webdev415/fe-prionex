import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

interface CorrespondenceRegistryTableProps<T extends { id: number | string }> {
  columns: Column<T>[]
  data: T[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  total: number
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  emptyMessage: string
  /** Number of skeleton rows to show while the first page loads. */
  skeletonRows?: number
}

/**
 * Shared DataTable wrapper for the correspondence registries (вхідний /
 * вихідний). Owns the loading / error / empty presentation and pagination so
 * the incoming & outgoing tabs only supply columns, data, and filters.
 */
export function CorrespondenceRegistryTable<T extends { id: number | string }>({
  columns,
  data,
  isLoading,
  isError,
  onRetry,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  emptyMessage,
  skeletonRows = 8,
}: CorrespondenceRegistryTableProps<T>) {
  const { t } = useTranslation('common')
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0

  if (isError) {
    return (
      <div
        className="border-border bg-card/50 flex flex-col items-center justify-center rounded-xl border px-6 py-14 text-center"
        role="alert"
      >
        <div className="bg-error-50 mb-4 flex h-12 w-12 items-center justify-center rounded-full">
          <Icons.Warning size={22} strokeWidth={1.5} className="text-error-500" />
        </div>
        <p className="text-foreground text-[14px] font-medium">
          {t('pages.lawyerWorkplace.registry.loadError.title', 'Could not load the registry')}
        </p>
        <p className="text-muted-foreground mt-1 max-w-sm text-[12px] leading-relaxed">
          {t(
            'pages.lawyerWorkplace.registry.loadError.description',
            'Check your connection and try again.'
          )}
        </p>
        <Button
          type="button"
          variant="cancel"
          size="sm"
          onClick={onRetry}
          className="mt-5 h-9 rounded-md"
        >
          {t('actions.retry', 'Retry')}
        </Button>
      </div>
    )
  }

  if (isLoading && data.length === 0) {
    return (
      <div
        className="border-border bg-border overflow-hidden rounded-xl border"
        aria-busy="true"
        aria-label={t('common.loading', 'Loading...')}
      >
        {Array.from({ length: skeletonRows }).map((_, index) => (
          <div
            key={index}
            className={cn(
              'flex h-[49px] items-center gap-4 px-4',
              index % 2 === 0 ? 'bg-muted' : 'bg-card'
            )}
          >
            <div className="bg-muted-foreground/15 h-3 w-full max-w-[420px] animate-pulse rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        columns={columns}
        data={data}
        emptyMessage={emptyMessage}
        tableClassName="whitespace-normal"
        className="w-full"
      />
      {totalPages > 0 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  )
}
