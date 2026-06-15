import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pagination } from '@/components/ui/Pagination'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../context/lawyerWorkplaceLayout'
import { formatDocumentDateLines } from '../../utils/formatters'
import type { LegalDocumentRow } from '../../documents/types'
import { getDocumentAssigneeLabel, getDocumentDisplayName } from './constants'
import { DocumentTypeBadge } from './DocumentTypeBadge'

interface DocumentsTableProps {
  documents: LegalDocumentRow[]
  currentPage: number
  totalPages: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
}

export function DocumentsTable({
  documents,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: DocumentsTableProps) {
  const { t, i18n } = useTranslation('common')
  const { isCompact } = useLawyerWorkplaceLayout()

  const columns: Column<LegalDocumentRow>[] = useMemo(
    () => [
      {
        key: 'number',
        header: t('pages.lawyerWorkplace.documents.columns.number', 'Number'),
        className: 'whitespace-nowrap',
        render: (row) => (
          <span className="text-light-600 text-[13px] font-medium">{row.number}</span>
        ),
      },
      {
        key: 'name',
        header: t('pages.lawyerWorkplace.documents.columns.documentName', 'Document name'),
        render: (row) => (
          <span className="text-dark-500 text-[13px] font-medium">
            {getDocumentDisplayName(row, t)}
          </span>
        ),
      },
      {
        key: 'type',
        header: t('pages.lawyerWorkplace.documents.columns.type', 'Type'),
        render: (row) => <DocumentTypeBadge type={row.type} />,
      },
      {
        key: 'client',
        header: t('pages.lawyerWorkplace.documents.columns.clientContract', 'Client - Contract'),
        render: (row) => (
          <div className="min-w-[140px]">
            <p className="text-dark-500 text-[13px] font-medium">{row.clientName}</p>
            <p className="text-light-600 text-[11px]">{row.contractId}</p>
          </div>
        ),
      },
      {
        key: 'action',
        header: t('pages.lawyerWorkplace.documents.columns.action', 'Action'),
        render: (row) => (
          <span className="text-light-600 text-[13px] lowercase">
            {t(`pages.lawyerWorkplace.documents.actions.${row.action}`, row.action)}
          </span>
        ),
      },
      {
        key: 'assignee',
        header: t('pages.lawyerWorkplace.documents.columns.assignee', 'Assignee'),
        render: (row) => (
          <span className="text-dark-500 text-[13px]">
            {getDocumentAssigneeLabel(row.assigneeId, t)}
          </span>
        ),
      },
      {
        key: 'date',
        header: t('pages.lawyerWorkplace.documents.columns.date', 'Date'),
        render: (row) => {
          const { dateLine, timeLine } = formatDocumentDateLines(row.createdAt, t, i18n.language)
          return (
            <div className="min-w-[100px]">
              <p className="text-dark-500 text-[13px]">{dateLine}</p>
              <p className="text-light-600 text-[11px]">{timeLine}</p>
            </div>
          )
        },
      },
    ],
    [t, i18n.language]
  )

  return (
    <div className="min-w-0 px-4 pb-6 sm:px-5 lg:px-7">
      <DataTable
        columns={columns}
        data={documents}
        emptyMessage={t('pages.lawyerWorkplace.documents.empty', 'No documents found')}
        tableClassName="whitespace-normal"
        className={cn(isCompact && 'rounded-lg')}
      />
      {totalPages > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          className={cn('px-1', isCompact && 'py-3')}
        />
      )}
    </div>
  )
}
