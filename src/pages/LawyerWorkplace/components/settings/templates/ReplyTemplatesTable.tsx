import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../../context/lawyerWorkplaceLayout'
import type { LetterTypeConfig, SettingsReplyTemplate } from '../../../settings/types'
import { LetterTypeBadge } from '../LetterTypeBadge'

const DEFAULT_PAGE_SIZE = 5
const PAGE_SIZE_OPTIONS = [5, 10, 20]

interface ReplyTemplatesTableProps {
  templates: SettingsReplyTemplate[]
  letterTypes: LetterTypeConfig[]
  onEdit: (template: SettingsReplyTemplate) => void
  onDelete: (template: SettingsReplyTemplate) => void
  onAdd: () => void
  readOnly?: boolean
}

export function ReplyTemplatesTable({
  templates,
  letterTypes,
  onEdit,
  onDelete,
  onAdd,
  readOnly = false,
}: ReplyTemplatesTableProps) {
  const { t } = useTranslation('common')
  const { isCompact } = useLawyerWorkplaceLayout()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const letterTypeById = Object.fromEntries(letterTypes.map((type) => [type.id, type]))
  const totalPages = templates.length > 0 ? Math.ceil(templates.length / pageSize) : 0
  const currentPage = totalPages > 0 ? Math.min(page, totalPages) : 1
  const isEmpty = templates.length === 0

  const paginatedTemplates = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return templates.slice(start, start + pageSize)
  }, [templates, currentPage, pageSize])

  return (
    <div className="bg-card min-w-0 overflow-hidden rounded-xl border border-gray-100">
      <div
        className={cn(
          'flex gap-3 border-b border-gray-100 px-4 py-4 sm:px-5 lg:px-6',
          isCompact ? 'flex-col' : 'flex-row items-center justify-between'
        )}
      >
        <div className="min-w-0">
          <h2 className="text-dark-500 text-[13px] font-semibold">
            {t('pages.lawyerWorkplace.settings.templates.replyTitle', 'Letter templates')}
          </h2>
          <p className="text-light-600 mt-0.5 text-[11.5px]">
            {t(
              'pages.lawyerWorkplace.settings.templates.replyDesc',
              'Used in the thread and new letter composer template menus'
            )}
          </p>
        </div>
        {!readOnly && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Icons.AddCircle size={18} strokeWidth={1.5} />}
            onClick={onAdd}
            className={cn('h-9 shrink-0 rounded-md', isCompact && 'w-full')}
          >
            {t('pages.lawyerWorkplace.settings.templates.addReply', 'Add template')}
          </Button>
        )}
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <div className="bg-light-100 mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <Icons.File size={22} strokeWidth={1.5} className="text-light-500" />
          </div>
          <p className="text-dark-500 text-[14px] font-medium">
            {t(
              'pages.lawyerWorkplace.settings.templates.emptyReply.title',
              'No letter templates yet'
            )}
          </p>
          <p className="text-light-600 mt-1 max-w-sm text-[12px] leading-relaxed">
            {t(
              'pages.lawyerWorkplace.settings.templates.emptyReply.description',
              'Add templates with reusable letter text and variables for the thread and new letter composer.'
            )}
          </p>
        </div>
      ) : (
        <>
          <div className="data-table-scroll w-full overflow-x-auto overflow-y-hidden pb-2">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-light-600 px-5 py-3 text-[11px] font-medium">
                    {t('pages.lawyerWorkplace.settings.templates.columns.name', 'Name')}
                  </th>
                  <th className="text-light-600 px-4 py-3 text-[11px] font-medium">
                    {t('pages.lawyerWorkplace.settings.lawyers.letterTypesColumn', 'Letter types')}
                  </th>
                  <th className="text-light-600 px-4 py-3 text-[11px] font-medium">
                    {t('pages.lawyerWorkplace.settings.templates.columns.preview', 'Preview')}
                  </th>
                  <th className="text-light-600 px-4 py-3 text-[11px] font-medium">
                    {t('pages.lawyerWorkplace.settings.mailboxes.columns.actions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedTemplates.map((template, idx) => (
                  <tr
                    key={template.id}
                    className={cn(
                      idx < paginatedTemplates.length - 1 && 'border-b border-gray-100'
                    )}
                  >
                    <td className="px-5 py-4">
                      <p className="text-dark-500 font-semibold">
                        {t(template.nameKey, template.nameFallback)}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex min-w-[120px] flex-wrap gap-1.5">
                        {template.letterTypeIds.length === 0 ? (
                          <span className="text-light-600 text-[11px]">
                            {t('pages.lawyerWorkplace.settings.templates.allTypes', 'All types')}
                          </span>
                        ) : (
                          template.letterTypeIds.map((typeId) => {
                            const letterType = letterTypeById[typeId]
                            if (!letterType) return null
                            return (
                              <LetterTypeBadge
                                key={typeId}
                                letterType={letterType}
                                t={t}
                                size="sm"
                              />
                            )
                          })
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-light-600 max-w-[240px] truncate text-[12px]">
                        {t(template.bodyKey, template.bodyFallback).replace(/\n/g, ' ')}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      {!readOnly ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEdit(template)}
                            className="text-light-600 hover:text-dark-500 flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
                            aria-label={t('actions.edit', 'Edit')}
                          >
                            <Icons.PencilEdit02 size={15} strokeWidth={1.5} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(template)}
                            className="text-light-600 hover:text-error-600 flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
                            aria-label={t('actions.delete', 'Delete')}
                          >
                            <Icons.Delete size={15} strokeWidth={1.5} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-light-500 text-[12px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
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
        </>
      )}
    </div>
  )
}
