/**
 * ImportDetailsPage Component
 *
 * Page for viewing detailed information about a specific import.
 * Shows import summary and error details.
 */

import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Icons } from '@/lib/icons'
import type { ImportHistoryItem } from './ImportHistoryPage'
import { generateImportHistoryItem } from './mockImportData'
import { SemiCircularProgress } from './components'

// Generate mock error details that match the import history data
const generateMockErrorDetails = (importHistoryItem: ImportHistoryItem) => {
  const errorTypes = ['Missing phone', 'Invalid debt', 'Duplicate entry', 'Invalid email']
  const errorCount = importHistoryItem.errors
  const errorList: Array<{ id: number; row: number; error: string }> = []

  // Generate errors based on the error count from the history item
  for (let j = 0; j < Math.min(errorCount, 100); j++) {
    errorList.push({
      id: j + 1,
      row: Math.floor(Math.random() * 10000) + 1,
      error: errorTypes[Math.floor(Math.random() * errorTypes.length)],
    })
  }

  // Determine status based on error count and history status
  let status: 'done' | 'failed' | 'completed_with_errors' | 'in_progress'
  if (importHistoryItem.status === 'failed') {
    status = 'failed'
  } else if (importHistoryItem.status === 'in_progress') {
    status = 'in_progress'
  } else if (errorCount > 0) {
    status = 'completed_with_errors'
  } else {
    status = 'done'
  }

  // Extract time from dateTime string
  const [, timePart] = importHistoryItem.dateTime.split(' ')
  const uploadedAt = timePart || '10:03'

  // Calculate progress for in_progress status (80% for demo)
  const progressPercentage = status === 'in_progress' ? 80 : 0
  const processingRow = status === 'in_progress' ? 800 : 0

  return {
    id: importHistoryItem.id,
    file: importHistoryItem.fileName,
    uploadedBy: importHistoryItem.uploadedBy,
    uploadedAt,
    status,
    totalRows: 10000,
    newClients: Math.floor(10000 * 0.75),
    updatedClients: Math.floor(10000 * 0.25),
    errors: errorCount,
    processingTime: '7 min 42 s',
    errorList: errorList.slice(0, 10), // Show first 10 errors
    progressPercentage,
    processingRow,
  }
}

// Status Badge Component
function ImportDetailStatusBadge({
  status,
}: {
  status: 'done' | 'failed' | 'completed_with_errors' | 'in_progress'
}) {
  if (status === 'done') {
    return (
      <span className="bg-secondary-800 inline-flex h-[33px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white">
        <span className="h-2 w-2 rounded-full bg-white" />
        Completed
      </span>
    )
  }

  if (status === 'completed_with_errors') {
    return (
      <span className="inline-flex h-[33px] items-center gap-1.5 rounded-full bg-gray-600 px-3 text-xs font-medium text-white">
        <Icons.Warning size={14} className="text-white" />
        Completed with errors
      </span>
    )
  }

  if (status === 'in_progress') {
    return (
      <span className="bg-secondary-800 inline-flex h-[33px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white">
        <span className="h-2 w-2 rounded-full bg-white" />
        In progress
      </span>
    )
  }

  return (
    <span className="bg-error-600 inline-flex h-[33px] items-center gap-1.5 rounded-full px-3 text-xs font-medium text-white">
      <span className="h-2 w-2 rounded-full bg-white" />
      Failed
    </span>
  )
}

// Semi-circular Progress Bar Component
function SemiCircularProgressBar({ percentage }: { percentage: number }) {
  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Semi-circular progress bar */}
      <div className="relative mb-4">
        <SemiCircularProgress percentage={percentage} size={300} />
      </div>
    </div>
  )
}

export function ImportDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Get the import history item using the same generator
  const importHistoryItem = id ? generateImportHistoryItem(Number(id)) : null

  // Generate details based on the history item
  const importDetail = importHistoryItem ? generateMockErrorDetails(importHistoryItem) : null

  if (!importDetail || !importHistoryItem) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-gray-600">Import not found</p>
        <Button
          variant="outline"
          onClick={() => navigate('/dashboard/import/history')}
          className="mt-4"
        >
          Back to History
        </Button>
      </div>
    )
  }

  const errorColumns: Column<{ id: number; row: number; error: string }>[] = [
    {
      key: 'row',
      header: 'Row',
      align: 'center',
      render: (item) => <span>{item.row}</span>,
    },
    {
      key: 'error',
      header: 'Error',
      render: (item) => <span>{item.error}</span>,
    },
  ]

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/dashboard/import/history')}
            leftIcon={<Icons.ArrowLeft02 size={20} className="text-secondary-800" />}
            className="text-secondary-800 h-12 rounded-full border-white bg-white px-4 py-2.5 text-sm font-medium"
          >
            Back to History
          </Button>
          <h1 className="text-dark-500 text-2xl font-light">Import Details</h1>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            // TODO: Implement download error CSV
            console.log('Download Error CSV clicked')
          }}
          leftIcon={<Icons.FileDownload size={20} className="text-dark-500" />}
          className="bg-primary-300 text-dark-500 h-12 rounded-full px-4 py-2.5 text-sm font-medium"
        >
          Download Error CSV
        </Button>
      </div>

      {/* Content Cards */}
      <div className="grid grid-cols-2 gap-6">
        {/* Last Import Summary Card */}
        <div className="flex flex-1 flex-col gap-3 rounded-xl border border-gray-200 bg-white/50 p-6 shadow-sm">
          <h2 className="text-dark-500 self-stretch text-xl leading-[150%] font-light tracking-[-0.4px]">
            Last Import Summary
          </h2>

          {/* Divider */}
          <div className="mb-4 h-px w-full bg-gray-200" />

          <div className="flex flex-col items-start gap-3 self-stretch">
            <div className="flex items-center gap-6 self-stretch">
              <span className="text-dark-500 w-[120px] text-base leading-[155%] font-light tracking-[-0.32px]">
                File:{' '}
              </span>
              <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                {importDetail.file}
              </span>
            </div>

            <div className="flex items-center gap-6 self-stretch">
              <span className="text-dark-500 w-[120px] text-base leading-[155%] font-light tracking-[-0.32px]">
                Uploaded by:{' '}
              </span>
              <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                {importDetail.uploadedBy} at {importDetail.uploadedAt}
              </span>
            </div>

            <div className="flex items-center gap-6 self-stretch">
              <span className="text-dark-500 w-[120px] text-base leading-[155%] font-light tracking-[-0.32px]">
                Status:{' '}
              </span>
              <div className="flex flex-1">
                <ImportDetailStatusBadge status={importDetail.status} />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 h-px w-full bg-gray-200" />

          {/* Summary Statistics - Grid Layout */}
          {importDetail.status !== 'failed' && (
            <>
              <div className="flex flex-col items-start gap-3 self-stretch">
                <div className="flex items-center gap-6 self-stretch">
                  <span className="text-dark-500 w-[120px] text-base leading-[155%] font-light tracking-[-0.32px]">
                    Total rows:
                  </span>
                  <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                    {importDetail.totalRows.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-6 self-stretch">
                  <span className="text-dark-500 w-[120px] text-base leading-[155%] font-light tracking-[-0.32px]">
                    New clients:
                  </span>
                  <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                    {importDetail.newClients.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-6 self-stretch">
                  <span className="text-dark-500 w-[120px] text-base leading-[155%] font-light tracking-[-0.32px]">
                    Updated clients:
                  </span>
                  <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                    {importDetail.updatedClients.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-6 self-stretch">
                  <span className="text-dark-500 w-[120px] text-base leading-[155%] font-light tracking-[-0.32px]">
                    Errors:
                  </span>
                  <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                    {importDetail.errors}
                  </span>
                </div>
              </div>

              {/* Processing time - separate from grid */}
              <div className="flex items-center gap-6 self-stretch">
                <span className="text-dark-500 w-[120px] text-base leading-[155%] font-light tracking-[-0.32px]">
                  Processing time:
                </span>
                <span className="text-dark-500 flex-1 text-base leading-[155%] font-medium tracking-[-0.32px]">
                  {importDetail.processingTime}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Errors Card or Progress Card */}
        {importDetail.status === 'failed' ? (
          <div className="flex min-h-[448px] flex-1 flex-col items-center gap-3 self-stretch rounded-xl border border-gray-200 bg-white/50 p-6 shadow-sm">
            <h2 className="text-dark-500 self-stretch text-xl leading-[150%] font-light tracking-[-0.4px]">
              Progress
            </h2>

            {/* Divider */}
            <div className="h-px w-full bg-gray-200" />

            <div className="flex flex-1 flex-col items-center justify-center gap-8 self-stretch">
              <Icons.SettingsError02 size={48} className="text-error-500" strokeWidth={1} />
              <div className="flex flex-col items-center gap-2">
                <span className="text-error-500 text-2xl leading-[150%] font-light tracking-[-0.28px]">
                  System error while processing file.
                </span>
                <span className="text-error-500 text-2xl leading-[150%] font-light tracking-[-0.28px]">
                  No rows imported.
                </span>
              </div>
            </div>
          </div>
        ) : importDetail.status === 'in_progress' ? (
          <div className="flex min-h-[448px] flex-1 flex-col gap-3 self-stretch rounded-xl border border-gray-200 bg-white/50 p-6 shadow-sm">
            <h2 className="text-dark-500 self-stretch text-xl leading-[150%] font-light tracking-[-0.4px]">
              Progress
            </h2>

            {/* Divider */}
            <div className="h-px w-full bg-gray-200" />

            <div className="flex flex-1 flex-col items-center justify-center gap-6 self-stretch">
              <SemiCircularProgressBar percentage={importDetail.progressPercentage} />
              <div className="flex flex-col items-center gap-1">
                <span className="text-dark-500 text-base leading-[155%] font-light tracking-[-0.32px]">
                  Processing row:{' '}
                  <span className="text-dark-500 text-base leading-[155%] font-medium tracking-[-0.32px]">
                    {importDetail.processingRow}
                  </span>
                </span>
              </div>
            </div>
          </div>
        ) : (
          importDetail.errorList.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white/50 p-6 shadow-sm">
              <h2 className="text-dark-500 mb-6 text-xl font-light">Errors</h2>

              <DataTable
                columns={errorColumns}
                data={importDetail.errorList}
                emptyMessage="No errors"
              />
            </div>
          )
        )}
      </div>
    </div>
  )
}

export default ImportDetailsPage
