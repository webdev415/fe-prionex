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
import { colors } from '@/lib/colors'

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
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 text-xs font-medium"
        style={{
          height: '33px',
          backgroundColor: '#204E4D',
          color: '#FFFFFF',
        }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{
            backgroundColor: '#FFFFFF',
          }}
        />
        Completed
      </span>
    )
  }

  if (status === 'completed_with_errors') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 text-xs font-medium"
        style={{
          height: '33px',
          backgroundColor: colors.gray[600],
          color: '#FFFFFF',
        }}
      >
        <Icons.Warning size={14} color="#FFFFFF" />
        Completed with errors
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 text-xs font-medium"
      style={{
        height: '33px',
        backgroundColor: '#DC2626',
        color: '#FFFFFF',
      }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{
          backgroundColor: '#FFFFFF',
        }}
      />
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
        <p style={{ color: colors.gray[600] }}>Import not found</p>
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
            leftIcon={<Icons.ArrowLeft02 size={20} color={colors.secondary[800]} />}
            style={{
              padding: '10px 16px',
              borderRadius: '9999px',
              borderColor: '#FFFFFF',
              backgroundColor: '#FFFFFF',
              color: colors.secondary[800],
              fontSize: '14px',
              fontWeight: 500,
              height: '48px',
            }}
          >
            Back to History
          </Button>
          <h1
            className="font-light"
            style={{
              fontSize: '24px',
              fontWeight: 300,
              color: colors.neutral.dark[500],
            }}
          >
            Import Details
          </h1>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            // TODO: Implement download error CSV
            console.log('Download Error CSV clicked')
          }}
          leftIcon={<Icons.FileDownload size={20} color={colors.neutral.dark[500]} />}
          style={{
            backgroundColor: colors.primary[300],
            color: colors.neutral.dark[500],
            borderRadius: '9999px',
            height: '48px',
            padding: '10px 16px',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          Download Error CSV
        </Button>
      </div>

      {/* Content Cards */}
      <div className="grid grid-cols-2 gap-6">
        {/* Last Import Summary Card */}
        <div
          className="rounded-xl p-6 shadow-sm"
          style={{
            backgroundColor: '#FFFFFF80',
          }}
        >
          <h2
            className="mb-6 font-light"
            style={{
              fontSize: '20px',
              fontWeight: 300,
              color: colors.neutral.dark[500],
            }}
          >
            Last Import Summary
          </h2>

          <div className="space-y-4">
            <div>
              <p
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: colors.gray[600],
                  marginBottom: '4px',
                }}
              >
                File
              </p>
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: colors.neutral.dark[500],
                }}
              >
                {importDetail.file}
              </p>
            </div>

            <div>
              <p
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: colors.gray[600],
                  marginBottom: '4px',
                }}
              >
                Uploaded by
              </p>
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: colors.neutral.dark[500],
                }}
              >
                {importDetail.uploadedBy} at {importDetail.uploadedAt}
              </p>
            </div>

            <div>
              <p
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: colors.gray[600],
                  marginBottom: '4px',
                }}
              >
                Status
              </p>
              <ImportDetailStatusBadge status={importDetail.status} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: colors.gray[600],
                    marginBottom: '4px',
                  }}
                >
                  Total rows
                </p>
                <p
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: colors.neutral.dark[500],
                  }}
                >
                  {importDetail.totalRows.toLocaleString()}
                </p>
              </div>
              <div>
                <p
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: colors.gray[600],
                    marginBottom: '4px',
                  }}
                >
                  New clients
                </p>
                <p
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: colors.neutral.dark[500],
                  }}
                >
                  {importDetail.newClients.toLocaleString()}
                </p>
              </div>
              <div>
                <p
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: colors.gray[600],
                    marginBottom: '4px',
                  }}
                >
                  Updated clients
                </p>
                <p
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: colors.neutral.dark[500],
                  }}
                >
                  {importDetail.updatedClients.toLocaleString()}
                </p>
              </div>
              <div>
                <p
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: colors.gray[600],
                    marginBottom: '4px',
                  }}
                >
                  Errors
                </p>
                <p
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: colors.neutral.dark[500],
                  }}
                >
                  {importDetail.errors}
                </p>
              </div>
            </div>

            <div>
              <p
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: colors.gray[600],
                  marginBottom: '4px',
                }}
              >
                Processing time
              </p>
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: colors.neutral.dark[500],
                }}
              >
                {importDetail.processingTime}
              </p>
            </div>
          </div>
        </div>

        {/* Errors Card */}
        <div
          className="rounded-xl p-6 shadow-sm"
          style={{
            backgroundColor: '#FFFFFF80',
          }}
        >
          <h2
            className="mb-6 font-light"
            style={{
              fontSize: '20px',
              fontWeight: 300,
              color: colors.neutral.dark[500],
            }}
          >
            Errors
          </h2>

          {importDetail.errorList.length > 0 ? (
            <DataTable
              columns={errorColumns}
              data={importDetail.errorList}
              emptyMessage="No errors"
            />
          ) : (
            <p
              style={{
                fontSize: '14px',
                color: colors.gray[600],
              }}
            >
              No errors found
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImportDetailsPage
