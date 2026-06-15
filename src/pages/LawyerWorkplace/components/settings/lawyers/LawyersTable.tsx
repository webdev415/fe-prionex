import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { LetterTypeConfig } from '../../../settings/types'
import type { SettingsLawyer } from '../../../settings/types'
import { getWorkloadLabel } from '../../../settings/utils/lawyerHelpers'
import { LetterTypeBadge } from '../LetterTypeBadge'

interface LawyersTableProps {
  lawyers: SettingsLawyer[]
  letterTypes: LetterTypeConfig[]
  onLawyersChange: (lawyers: SettingsLawyer[]) => void
  onAddLawyer: () => void
}

export function LawyersTable({
  lawyers,
  letterTypes,
  onLawyersChange,
  onAddLawyer,
}: LawyersTableProps) {
  const { t } = useTranslation('common')

  const letterTypeById = Object.fromEntries(letterTypes.map((type) => [type.id, type]))

  const updateMaxInFlight = (lawyerId: string, delta: number) => {
    onLawyersChange(
      lawyers.map((lawyer) =>
        lawyer.id === lawyerId
          ? { ...lawyer, maxInFlight: Math.max(1, lawyer.maxInFlight + delta) }
          : lawyer
      )
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-100 bg-white">
      <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-row items-center gap-4">
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
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Icons.FileDownload size={16} strokeWidth={1.5} />}
            className="h-9 rounded-md"
            onClick={() =>
              toast.info(
                t('pages.lawyerWorkplace.settings.lawyers.exportSoon', 'Export coming soon')
              )
            }
          >
            {t('pages.lawyerWorkplace.settings.lawyers.export', 'Export')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Icons.AddCircle size={18} strokeWidth={1.5} />}
            onClick={onAddLawyer}
            className="h-9 rounded-md"
          >
            {t('pages.lawyerWorkplace.settings.lawyers.addLawyer', 'Add lawyer')}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-light-600 px-5 py-3 text-[11px] font-medium">
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
            {lawyers.map((lawyer, idx) => {
              const progress =
                lawyer.maxInFlight > 0 ? (lawyer.currentActive / lawyer.maxInFlight) * 100 : 0

              return (
                <tr
                  key={lawyer.id}
                  className={cn(idx < lawyers.length - 1 && 'border-b border-gray-100')}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-secondary-100 text-secondary-800 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
                        {lawyer.initials}
                      </div>
                      <div>
                        <p className="text-dark-500 text-[13px] font-semibold">
                          {t(lawyer.nameKey, lawyer.nameFallback)}
                        </p>
                        <p className="text-light-600 text-[11px]">
                          {t(lawyer.roleKey, lawyer.roleFallback)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1.5">
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
                    <div className="bg-light-100 inline-flex items-center rounded-full px-1">
                      <button
                        type="button"
                        onClick={() => updateMaxInFlight(lawyer.id, -1)}
                        className="text-light-600 hover:text-dark-500 flex h-8 w-8 items-center justify-center"
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
                        className="text-light-600 hover:text-dark-500 flex h-8 w-8 items-center justify-center"
                        aria-label={t('actions.increase', 'Increase')}
                      >
                        <Icons.Add size={14} strokeWidth={1} />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium',
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
    </div>
  )
}
