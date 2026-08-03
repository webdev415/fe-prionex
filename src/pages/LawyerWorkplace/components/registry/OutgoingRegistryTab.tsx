import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { downloadBlob } from '@/features/messaging'
import {
  legalRegistryApi,
  useOutgoingRegistry,
  type OutgoingRegistryFilters,
} from '@/features/lawyerWorkplace'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuthStore } from '@/stores/authStore'
import { CorrespondenceRegistryTable } from './CorrespondenceRegistryTable'
import { RegistryFiltersBar } from './RegistryFiltersBar'
import { buildOutgoingColumns } from './registryColumns'
import { todayStamp } from './registryExport'

const PAGE_SIZE = 25

export function OutgoingRegistryTab() {
  const { t } = useTranslation('common')
  const timezone = useAuthStore((s) => s.user?.timezone)

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [letterTypeId, setLetterTypeId] = useState('')
  const [lawyerId, setLawyerId] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [isExporting, setIsExporting] = useState(false)

  const debouncedSearch = useDebounce(search, 300)

  const baseFilters = useMemo<OutgoingRegistryFilters>(() => {
    const lawyerIdNumber = Number(lawyerId)
    return {
      ...(dateFrom ? { date_from: dateFrom } : {}),
      ...(dateTo ? { date_to: dateTo } : {}),
      ...(letterTypeId ? { letter_type_id: letterTypeId } : {}),
      ...(lawyerId && Number.isFinite(lawyerIdNumber) ? { lawyer_id: lawyerIdNumber } : {}),
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
    }
  }, [dateFrom, dateTo, letterTypeId, lawyerId, debouncedSearch])

  const filters = useMemo<OutgoingRegistryFilters>(
    () => ({ ...baseFilters, page, limit: pageSize }),
    [baseFilters, page, pageSize]
  )

  const { data, isLoading, isError, refetch } = useOutgoingRegistry(filters)

  const columns = useMemo(() => buildOutgoingColumns(t, timezone), [t, timezone])
  const items = data?.items ?? []
  const total = data?.total ?? 0

  const resetToFirstPage = () => setPage(1)

  const handleExport = async () => {
    try {
      setIsExporting(true)
      const blob = await legalRegistryApi.exportOutgoing(baseFilters)
      downloadBlob(
        blob,
        t('pages.lawyerWorkplace.registry.export.outgoingFileName', {
          date: todayStamp(),
          defaultValue: `журнал-вихідної-${todayStamp()}.csv`,
        })
      )
    } catch {
      toast.error(t('pages.lawyerWorkplace.registry.export.failed', 'Export failed'))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <RegistryFiltersBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={(v) => {
          setDateFrom(v)
          resetToFirstPage()
        }}
        onDateToChange={(v) => {
          setDateTo(v)
          resetToFirstPage()
        }}
        letterTypeId={letterTypeId}
        onLetterTypeIdChange={(v) => {
          setLetterTypeId(v)
          resetToFirstPage()
        }}
        search={search}
        onSearchChange={(v) => {
          setSearch(v)
          resetToFirstPage()
        }}
        showLawyerFilter
        lawyerId={lawyerId}
        onLawyerIdChange={(v) => {
          setLawyerId(v)
          resetToFirstPage()
        }}
        onExport={handleExport}
        isExporting={isExporting}
        exportDisabled={total === 0}
      />

      <CorrespondenceRegistryTable
        columns={columns}
        data={items}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          resetToFirstPage()
        }}
        emptyMessage={t(
          'pages.lawyerWorkplace.registry.outgoing.empty',
          'No outgoing correspondence yet'
        )}
      />
    </div>
  )
}
