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

// Generate mock error details for existing imports
const generateMockErrorDetails = () => {
  const errorTypes = ['Missing phone', 'Invalid debt', 'Duplicate entry', 'Invalid email']
  const details: Record<
    string,
    {
      id: string | number
      file: string
      uploadedBy: string
      uploadedAt: string
      status: 'done' | 'failed' | 'completed_with_errors'
      totalRows: number
      newClients: number
      updatedClients: number
      errors: number
      processingTime: string
      errorList: Array<{ id: number; row: number; error: string }>
    }
  > = {}

  for (let i = 1; i <= 50; i++) {
    const errorCount = Math.floor(Math.random() * 200)
    const errorList: Array<{ id: number; row: number; error: string }> = []

    for (let j = 0; j < Math.min(errorCount, 100); j++) {
      errorList.push({
        id: j + 1,
        row: Math.floor(Math.random() * 10000) + 1,
        error: errorTypes[Math.floor(Math.random() * errorTypes.length)],
      })
    }

    details[i] = {
      id: i,
      file: `clients_batch_2024-11-20_${i}.csv`,
      uploadedBy: ['Olena', 'Maria', 'John', 'Anna', 'David'][Math.floor(Math.random() * 5)],
      uploadedAt: '10:03',
      status: errorCount > 0 ? (errorCount > 50 ? 'failed' : 'completed_with_errors') : 'done',
      totalRows: 10000,
      newClients: 7500,
      updatedClients: 2500,
      errors: errorCount,
      processingTime: '7 min 42 s',
      errorList: errorList.slice(0, 10), // Show first 10 errors
    }
  }

  return details
}

const importDetails = generateMockErrorDetails()

// Status Badge Component
function ImportDetailStatusBadge({
  status,
}: {
  status: 'done' | 'failed' | 'completed_with_errors'
}) {
  if (status === 'done') {
    return (
      <span className="inline-flex h-[33px] items-center gap-1.5 rounded-full bg-[#204E4D] px-3 text-xs font-medium text-white">
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

  return (
    <span className="inline-flex h-[33px] items-center gap-1.5 rounded-full bg-[#DC2626] px-3 text-xs font-medium text-white">
      <span className="h-2 w-2 rounded-full bg-white" />
      Failed
    </span>
  )
}

export function ImportDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Convert string id to number for lookup
  const importDetail = id ? importDetails[String(id)] : null

  if (!importDetail) {
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
        <div className="rounded-xl bg-white/50 p-6 shadow-sm">
          <h2 className="text-dark-500 mb-6 text-xl font-light">Last Import Summary</h2>

          <div className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-medium text-gray-600">File</p>
              <p className="text-dark-500 text-sm font-medium">{importDetail.file}</p>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-gray-600">Uploaded by</p>
              <p className="text-dark-500 text-sm font-medium">
                {importDetail.uploadedBy} at {importDetail.uploadedAt}
              </p>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-gray-600">Status</p>
              <ImportDetailStatusBadge status={importDetail.status} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="mb-1 text-xs font-medium text-gray-600">Total rows</p>
                <p className="text-dark-500 text-sm font-medium">
                  {importDetail.totalRows.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-gray-600">New clients</p>
                <p className="text-dark-500 text-sm font-medium">
                  {importDetail.newClients.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-gray-600">Updated clients</p>
                <p className="text-dark-500 text-sm font-medium">
                  {importDetail.updatedClients.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-gray-600">Errors</p>
                <p className="text-dark-500 text-sm font-medium">{importDetail.errors}</p>
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium text-gray-600">Processing time</p>
              <p className="text-dark-500 text-sm font-medium">{importDetail.processingTime}</p>
            </div>
          </div>
        </div>

        {/* Errors Card */}
        <div className="rounded-xl bg-white/50 p-6 shadow-sm">
          <h2 className="text-dark-500 mb-6 text-xl font-light">Errors</h2>

          {importDetail.errorList.length > 0 ? (
            <DataTable
              columns={errorColumns}
              data={importDetail.errorList}
              emptyMessage="No errors"
            />
          ) : (
            <p className="text-sm text-gray-600">No errors found</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImportDetailsPage
