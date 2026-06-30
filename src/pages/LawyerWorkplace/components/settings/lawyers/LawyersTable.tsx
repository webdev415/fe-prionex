import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../../context/lawyerWorkplaceLayout'
import type { LetterTypeConfig } from '../../../settings/types'
import type { SettingsLawyer } from '../../../settings/types'
import { getWorkloadLabel, exportLawyersToCsv } from '../../../settings/utils/lawyerHelpers'
import { LetterTypeBadge } from '../LetterTypeBadge'

const DEFAULT_PAGE_SIZE = 10
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50]

interface LawyersTableProps {
  lawyers: SettingsLawyer[]
  letterTypes: LetterTypeConfig[]
  onUpdateLawyerMaxInFlight: (lawyerId: string, maxInFlight: number) => Promise<void>
  isSaving?: boolean
  onAddLawyer: () => void
  readOnly?: boolean
}

export function LawyersTable({
  lawyers,
  letterTypes,
  onUpdateLawyerMaxInFlight,
  isSaving = false,
  onAddLawyer,
  readOnly = false,
}: LawyersTableProps) {
  const { t } = useTranslation('common')
  const { isCompact } = useLawyerWorkplaceLayout()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const letterTypeById = Object.fromEntries(letterTypes.map((type) => [type.id, type]))

  const totalPages = lawyers.length > 0 ? Math.ceil(lawyers.length / pageSize) : 0
  const currentPage = totalPages > 0 ? Math.min(page, totalPages) : 1

  const paginatedLawyers = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return lawyers.slice(start, start + pageSize)
  }, [lawyers, currentPage, pageSize])

  const updateMaxInFlight = async (lawyerId: string, delta: number) => {
    if (readOnly) return
    const lawyer = lawyers.find((item) => item.id === lawyerId)
    if (!lawyer || isSaving) return
    const nextValue = Math.max(1, lawyer.maxInFlight + delta)
    if (nextValue === lawyer.maxInFlight) return
    try {
      await onUpdateLawyerMaxInFlight(lawyerId, nextValue)
    } catch {
      toast.error(
        t('pages.lawyerWorkplace.settings.lawyers.updateError', 'Could not update lawyer workload')
      )
    }
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-gray-100 bg-white">
      <div
        className={cn(
          'flex gap-3 border-b border-gray-100 px-4 py-4 sm:px-5 lg:px-6',
          isCompact ? 'flex-col' : 'flex-row items-center justify-between'
        )}
      >
        <div className="min-w-0">
          <h2 className="text-dark-500 text-[13px] font-semibold">
            {t('pages.lawyerWorkplace.settings.lawyers.departmentTitle', {
              count: lawyers.length,
              defaultValue: `Legal department · ${lawyers.length} lawyers`,
            })}
          </h2>
          <p className="text-light-600 mt-0.5 text-[11.5px]">
            {t(
              'pages.lawyerWorkplace.settings.lawyers.departmentDesc',
              'Adjust max workload and specializations per person'
            )}
          </p>
        </div>
        <div className={cn('flex shrink-0 items-center gap-2', isCompact && 'w-full')}>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Icons.FileDownload size={16} strokeWidth={1.5} />}
            className={cn('h-9 rounded-md', isCompact && 'flex-1')}
            onClick={() => {
              if (lawyers.length === 0) {
                toast.info(
                  t('pages.lawyerWorkplace.settings.lawyers.exportEmpty', 'No lawyers to export')
                )
                return
              }
              exportLawyersToCsv(lawyers, letterTypes, t)
            }}
          >
            {t('pages.lawyerWorkplace.settings.lawyers.export', 'Export')}
          </Button>
          {!readOnly && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Icons.AddCircle size={18} strokeWidth={1.5} />}
              onClick={onAddLawyer}
              className={cn('h-9 rounded-md', isCompact && 'flex-1')}
            >
              {t('pages.lawyerWorkplace.settings.lawyers.addLawyer', 'Add lawyer')}
            </Button>
          )}
        </div>
      </div>

      <div className="data-table-scroll w-full overflow-x-auto overflow-y-hidden pb-2">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th
                className={cn(
                  'text-light-600 py-3 text-[11px] font-medium',
                  isCompact ? 'px-4' : 'px-5'
                )}
              >
                {t('pages.lawyerWorkplace.settings.lawyer', 'Lawyer')}
              </th>
              <th className="text-light-600 px-4 py-3 text-[11px] font-medium">
                {t('pages.lawyerWorkplace.settings.lawyers.letterTypesColumn', 'Letter types')}
              </th>
              <th className="text-light-600 px-4 py-3 text-[11px] font-medium">
                {t('pages.lawyerWorkplace.settings.lawyers.currentWorkload', 'Current workload')}
              </th>
              <th className="text-light-600 px-4 py-3 text-[11px] font-medium">
                {t('pages.lawyerWorkplace.settings.lawyers.maxInFlight', 'Max in flight')}
              </th>
              <th className="text-light-600 px-4 py-3 text-[11px] font-medium">
                {t('pages.lawyerWorkplace.settings.status', 'Status')}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedLawyers.map((lawyer, idx) => {
              const progress =
                lawyer.maxInFlight > 0 ? (lawyer.currentActive / lawyer.maxInFlight) * 100 : 0

              return (
                <tr
                  key={lawyer.id}
                  className={cn(idx < paginatedLawyers.length - 1 && 'border-b border-gray-100')}
                >
                  <td className={cn('py-4', isCompact ? 'px-4' : 'px-5')}>
                    <div className="flex items-center gap-3">
                      <div className="bg-secondary-100 text-secondary-800 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
                        {lawyer.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="text-dark-500 truncate text-[13px] font-semibold">
                          {t(lawyer.nameKey, lawyer.nameFallback)}
                        </p>
                        <p className="text-light-600 truncate text-[11px]">
                          {t(lawyer.roleKey, lawyer.roleFallback)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex min-w-[140px] flex-wrap gap-1.5">
                      {lawyer.letterTypeIds.map((typeId) => {
                        const letterType = letterTypeById[typeId]
                        if (!letterType) return null
                        return (
                          <LetterTypeBadge key={typeId} letterType={letterType} t={t} size="sm" />
                        )
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="min-w-[132px]">
                      <p className="flex flex-row items-center justify-between text-[13px] leading-none">
                        <span className="text-dark-500 font-semibold">{lawyer.currentActive}</span>
                        <span className="text-light-500 font-normal">
                          {' '}
                          {t('pages.lawyerWorkplace.settings.lawyers.ofActiveSuffix', {
                            max: lawyer.maxInFlight,
                            defaultValue: `of ${lawyer.maxInFlight}`,
                          })}
                        </span>
                      </p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="bg-secondary-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                      <p className="text-light-600 mt-1.5 text-[11px]">
                        {getWorkloadLabel(lawyer.currentActive, lawyer.maxInFlight, t)}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {readOnly ? (
                      <span className="text-dark-500 text-[13px] font-semibold">
                        {lawyer.maxInFlight}
                      </span>
                    ) : (
                      <div className="bg-light-100 inline-flex items-center rounded-full px-1">
                        <button
                          type="button"
                          onClick={() => updateMaxInFlight(lawyer.id, -1)}
                          disabled={isSaving}
                          className="text-light-600 hover:text-dark-500 flex h-8 w-8 items-center justify-center disabled:opacity-50"
                          aria-label={t('actions.decrease', 'Decrease')}
                        >
                          <Icons.Remove02 size={14} strokeWidth={1} />
                        </button>
                        <span className="text-dark-500 min-w-[32px] px-1 text-center text-[13px] font-semibold">
                          {lawyer.maxInFlight}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateMaxInFlight(lawyer.id, 1)}
                          disabled={isSaving}
                          className="text-light-600 hover:text-dark-500 flex h-8 w-8 items-center justify-center disabled:opacity-50"
                          aria-label={t('actions.increase', 'Increase')}
                        >
                          <Icons.Add size={14} strokeWidth={1} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap',
                        lawyer.status === 'online'
                          ? 'bg-success-100 text-success-700'
                          : 'bg-warning-100 text-warning-700'
                      )}
                    >
                      {t(
                        `pages.lawyerWorkplace.settings.lawyers.status.${lawyer.status}`,
                        lawyer.status
                      )}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          className={cn('border-t border-gray-100 px-4 sm:px-5 lg:px-6', isCompact && 'py-3')}
        />
      )}
    </div>
  )
}
