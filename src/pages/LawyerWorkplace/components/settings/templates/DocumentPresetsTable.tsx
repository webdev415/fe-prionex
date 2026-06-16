import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { DOCUMENT_ASSIGNEE_OPTIONS } from '../../documents/constants'
import { useLawyerWorkplaceLayout } from '../../../context/lawyerWorkplaceLayout'
import type { SettingsDocumentPreset } from '../../../settings/types'
import { DOCUMENT_PRESET_TYPE_OPTIONS } from '../constants'

const DEFAULT_PAGE_SIZE = 5
const PAGE_SIZE_OPTIONS = [5, 10, 20]

const LAWYER_ASSIGNEES = DOCUMENT_ASSIGNEE_OPTIONS.filter(
  (option) => option.id !== 'system' && option.id !== 'emailService'
)

interface DocumentPresetsTableProps {
  presets: SettingsDocumentPreset[]
  onEdit: (preset: SettingsDocumentPreset) => void
  onToggleActive: (presetId: string) => void
  onAdd: () => void
}

export function DocumentPresetsTable({
  presets,
  onEdit,
  onToggleActive,
  onAdd,
}: DocumentPresetsTableProps) {
  const { t } = useTranslation('common')
  const { isCompact } = useLawyerWorkplaceLayout()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const assigneeById = useMemo(
    () => Object.fromEntries(LAWYER_ASSIGNEES.map((option) => [option.id, option])),
    []
  )

  const totalPages = presets.length > 0 ? Math.ceil(presets.length / pageSize) : 0
  const currentPage = totalPages > 0 ? Math.min(page, totalPages) : 1

  const paginatedPresets = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return presets.slice(start, start + pageSize)
  }, [presets, currentPage, pageSize])

  const getTypeBadge = (documentType: SettingsDocumentPreset['documentType']) => {
    const option =
      DOCUMENT_PRESET_TYPE_OPTIONS.find((item) => item.id === documentType) ??
      DOCUMENT_PRESET_TYPE_OPTIONS[0]!
    return (
      <span className="bg-light-100 text-dark-500 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium">
        {option.badge}
      </span>
    )
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
            {t('pages.lawyerWorkplace.settings.templates.documentTitle', 'Document presets')}
          </h2>
          <p className="text-light-600 mt-0.5 text-[11.5px]">
            {t(
              'pages.lawyerWorkplace.settings.templates.documentDesc',
              'Used when generating outgoing and NBU documents'
            )}
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Icons.AddCircle size={18} strokeWidth={1.5} />}
          onClick={onAdd}
          className={cn('h-9 shrink-0 rounded-md', isCompact && 'w-full')}
        >
          {t('pages.lawyerWorkplace.settings.templates.addPreset', 'Add preset')}
        </Button>
      </div>

      <div className="data-table-scroll w-full overflow-x-auto overflow-y-hidden pb-2">
        <table className="w-full min-w-[680px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-light-600 px-5 py-3 text-[11px] font-medium">
                {t('pages.lawyerWorkplace.settings.templates.columns.name', 'Name')}
              </th>
              <th className="text-light-600 px-4 py-3 text-[11px] font-medium">
                {t('pages.lawyerWorkplace.settings.templates.columns.type', 'Type')}
              </th>
              <th className="text-light-600 px-4 py-3 text-[11px] font-medium">
                {t('pages.lawyerWorkplace.settings.templates.columns.assignee', 'Default assignee')}
              </th>
              <th className="text-light-600 px-4 py-3 text-[11px] font-medium">
                {t('pages.lawyerWorkplace.settings.status', 'Status')}
              </th>
              <th className="text-light-600 px-4 py-3 text-[11px] font-medium">
                {t('pages.lawyerWorkplace.settings.mailboxes.columns.actions', 'Actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedPresets.map((preset, idx) => {
              const assignee = preset.defaultAssigneeId
                ? assigneeById[preset.defaultAssigneeId]
                : null

              return (
                <tr
                  key={preset.id}
                  className={cn(idx < paginatedPresets.length - 1 && 'border-b border-gray-100')}
                >
                  <td className="px-5 py-4">
                    <p className="text-dark-500 font-semibold">
                      {t(preset.nameKey, preset.nameFallback)}
                    </p>
                  </td>
                  <td className="px-4 py-4">{getTypeBadge(preset.documentType)}</td>
                  <td className="px-4 py-4">
                    <span className="text-dark-500 text-[13px]">
                      {assignee
                        ? t(assignee.key, assignee.fallback)
                        : t('pages.lawyerWorkplace.settings.templates.noAssignee', '—')}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium',
                        preset.isActive
                          ? 'bg-success-100 text-success-700'
                          : 'bg-light-100 text-light-600'
                      )}
                    >
                      {preset.isActive
                        ? t('pages.lawyerWorkplace.settings.templates.active', 'Active')
                        : t('pages.lawyerWorkplace.settings.templates.inactive', 'Inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(preset)}
                        className="text-light-600 hover:text-dark-500 flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
                        aria-label={t('actions.edit', 'Edit')}
                      >
                        <Icons.PencilEdit02 size={15} strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleActive(preset.id)}
                        className="text-light-600 hover:text-dark-500 flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
                        aria-label={
                          preset.isActive
                            ? t('actions.disable', 'Disable')
                            : t('actions.enable', 'Enable')
                        }
                      >
                        {preset.isActive ? (
                          <Icons.Cancel01 size={15} strokeWidth={1.5} />
                        ) : (
                          <Icons.Tick02 size={15} strokeWidth={1.5} />
                        )}
                      </button>
                    </div>
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
