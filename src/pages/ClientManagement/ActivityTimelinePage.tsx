/**
 * Activity Timeline Page
 *
 * Full page view for displaying all client activities with filters.
 */

import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { DateSelect } from '@/components/ui/DateSelect'
import { RadioGroup, RadioItem } from '@/components/ui/Radio'
import { Pagination } from '@/components/ui/Pagination'
import { AddNoteModal } from '@/pages/ClientManagement/components/AddNoteModal'
import { CallDialogModal, type CallType, type CallStatus } from './components/CallDialogModal'
import { mockClientsDetail } from './mockClientDetails'
import { cn } from '@/lib/utils'

type CommunicationType = 'calls' | 'sms' | 'notes' | 'all'

export function ActivityTimelinePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const clientId = id ? Number(id) : 1
  const client = mockClientsDetail.find((c) => c.id === clientId) || mockClientsDetail[0]

  const [communicationType, setCommunicationType] = useState<CommunicationType>('calls')
  const [dateFrom, setDateFrom] = useState<Date | null>(new Date('2024-11-20'))
  const [dateTo, setDateTo] = useState<Date | null>(new Date('2024-11-27'))
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage] = useState(15)
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false)
  const [isCallModalOpen, setIsCallModalOpen] = useState(false)

  const formatCurrencyWithDecimals = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      minimumFractionDigits: amount % 1 !== 0 ? 1 : 0,
      maximumFractionDigits: 1,
      useGrouping: true,
    })
      .format(amount)
      .replace(/,/g, ' ')
  }

  // Filter activities based on communication type and date range
  const filteredActivities = useMemo(() => {
    let result = [...(client.activities || [])]

    // Filter by communication type
    if (communicationType !== 'all') {
      result = result.filter((activity) => {
        const contactType = activity.contactType as string
        if (communicationType === 'calls') {
          return contactType === 'Outgoing' || contactType === 'Incoming'
        }
        if (communicationType === 'sms') {
          return contactType === 'SMS'
        }
        if (communicationType === 'notes') {
          return contactType === 'Note'
        }
        return true
      })
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      result = result.filter((activity) => {
        // Parse date in format MM/DD/YYYY
        const [month, day, year] = activity.date.split('/')
        const activityDate = new Date(Number(year), Number(month) - 1, Number(day))

        if (dateFrom) {
          const fromDate = new Date(dateFrom)
          fromDate.setHours(0, 0, 0, 0)
          if (activityDate < fromDate) return false
        }
        if (dateTo) {
          const toDate = new Date(dateTo)
          toDate.setHours(23, 59, 59, 999) // Include the entire end date
          if (activityDate > toDate) return false
        }
        return true
      })
    }

    return result
  }, [client.activities, communicationType, dateFrom, dateTo])

  // Paginate activities
  const paginatedActivities = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    const end = start + rowsPerPage
    return filteredActivities.slice(start, end)
  }, [filteredActivities, currentPage, rowsPerPage])

  const totalPages = Math.ceil(filteredActivities.length / rowsPerPage)

  const handleClearFilters = () => {
    setCommunicationType('all')
    setDateFrom(null)
    setDateTo(null)
    setCurrentPage(1)
  }

  const activityColumns: Column<(typeof client.activities)[0]>[] = [
    { key: 'date', header: 'Date', align: 'left' },
    { key: 'number', header: 'Number', align: 'left' },
    { key: 'contactType', header: 'Contact Type', align: 'left' },
    { key: 'result', header: 'Result', align: 'left' },
    {
      key: 'promisedAmount',
      header: 'Promised Amount',
      align: 'right',
      render: (activity) =>
        activity.promisedAmount ? `${formatCurrencyWithDecimals(activity.promisedAmount)} ₴` : '-',
    },
    {
      key: 'promisedDate',
      header: 'Promised Date',
      align: 'left',
      render: (activity) => activity.promisedDate || '-',
    },
    { key: 'comment', header: 'Comment', align: 'left' },
    { key: 'employee', header: 'Employee', align: 'left' },
  ]

  const hasFilters = communicationType !== 'all' || dateFrom || dateTo

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return 'bg-error-500'
      case 'High':
        return 'bg-warning-500'
      case 'Medium':
        return 'bg-success-500'
      case 'Low':
        return 'bg-gray-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Client Header */}
      <div className="flex items-center justify-between self-stretch">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/dashboard/client/${client.id}`)}
            className="flex h-6 w-6 items-center justify-center"
          >
            <Icons.ArrowLeft02 size={24} className="text-secondary-800" strokeWidth={1.5} />
          </button>
          <h1 className="text-dark-500 text-center text-2xl leading-[150%] font-medium">
            {client.fullName}
          </h1>
          <span className="text-dark-500 flex items-center rounded-[16px] bg-white/10 px-3 py-0">
            {client.score} Score
          </span>
          <span
            className={cn(
              'flex h-[25px] items-center rounded-[16px] px-3 py-2 text-center text-xs leading-[140%] font-medium tracking-[-0.24px]',
              getPriorityColor(client.priority)
            )}
          >
            {client.priority}
          </span>
        </div>
        <div className="flex items-center gap-5">
          <Button
            size="md"
            leftIcon={<Icons.PencilEdit size={20} />}
            className="text-dark-500 flex flex-row items-start gap-2.5 rounded-full border-none bg-white/5 p-[10px_16px] text-sm font-medium"
            onClick={() => setIsNoteModalOpen(true)}
          >
            Add Note about Client
          </Button>
          <Button
            size="md"
            leftIcon={<Icons.Headset size={20} />}
            className="bg-primary-300 flex flex-row items-center gap-1 rounded-full px-4 py-2.5"
            onClick={() => setIsCallModalOpen(true)}
          >
            Call
          </Button>
          <Button
            size="md"
            leftIcon={<Icons.RemoveMale size={20} />}
            className="bg-secondary-800 flex flex-row items-center gap-2.5 rounded-full px-4 py-2.5 text-white"
          >
            Delete Client
          </Button>
        </div>
      </div>

      <div className="flex flex-col items-start gap-5 self-stretch rounded-xl bg-white/50 p-6">
        <div className="flex items-center justify-between self-stretch">
          {/* Type of communication */}
          <div className="flex flex-1 items-center gap-6">
            <label className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
              Type of communication:
            </label>
            <RadioGroup
              value={communicationType}
              onValueChange={(value) => setCommunicationType(value as CommunicationType)}
              className="flex flex-1 items-center gap-2"
            >
              <div className="flex items-center gap-2">
                <RadioItem value="calls" id="calls" />
                <label htmlFor="calls" className="text-dark-500 cursor-pointer text-sm font-light">
                  Calls
                </label>
              </div>
              <div className="flex items-center gap-2">
                <RadioItem value="sms" id="sms" />
                <label htmlFor="sms" className="text-dark-500 cursor-pointer text-sm font-light">
                  SMS
                </label>
              </div>
              <div className="flex items-center gap-2">
                <RadioItem value="notes" id="notes" />
                <label htmlFor="notes" className="text-dark-500 cursor-pointer text-sm font-light">
                  Notes
                </label>
              </div>
              <div className="flex items-center gap-2">
                <RadioItem value="all" id="all" />
                <label htmlFor="all" className="text-dark-500 cursor-pointer text-sm font-light">
                  All
                </label>
              </div>
            </RadioGroup>
          </div>

          {/* Date range */}
          <div className="flex flex-1 items-center gap-3">
            <label className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
              Date range:
            </label>
            <div className="flex flex-1 items-start gap-2">
              <DateSelect
                value={dateFrom}
                onChange={({ value }) => setDateFrom(value)}
                placeholder="From date"
                format="yyyy-MM-dd"
              />
            </div>
            <span className="text-dark-500">-</span>
            <div className="flex flex-1 items-start gap-2">
              <DateSelect
                value={dateTo}
                onChange={({ value }) => setDateTo(value)}
                placeholder="To date"
                format="yyyy-MM-dd"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-5">
            {hasFilters && (
              <button
                onClick={handleClearFilters}
                className="ml-auto flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-gray-700 transition-colors hover:bg-white/10"
              >
                <Icons.Close size={16} className="text-gray-700" />
                <span className="text-xs font-medium">Clear All</span>
              </button>
            )}
          </div>
        </div>
        {/* Activity Table or Empty State */}
        {filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-6 self-stretch">
            <Icons.FileRemove size={48} className="text-gray-500" strokeWidth={0.5} />
            <p className="text-dark-500 text-center text-2xl font-light tracking-[-0.48px]">
              No activity recorded yet
            </p>
            {hasFilters && (
              <button
                onClick={handleClearFilters}
                className="bg-secondary-800 flex items-center rounded-full shadow-md transition-all duration-200 hover:shadow-lg"
              >
                <div className="bg-primary-300 ml-1 flex h-10 w-10 items-center justify-center rounded-full">
                  <Icons.Close size={20} className="text-dark-500" strokeWidth={2} />
                </div>
                <span className="px-4 py-3 text-sm font-medium text-white">Reset filters</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-6 self-stretch">
            <DataTable columns={activityColumns} data={paginatedActivities} className="w-full" />
          </div>
        )}
      </div>

      {filteredActivities.length > 0 && (
        <div className="flex w-full items-center justify-center">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Add Note Modal */}
      <AddNoteModal
        open={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        phoneNumber={client.phones?.[0]?.number || ''}
        onSave={(data) => {
          // TODO: Save note to API
          console.log('Note saved:', data)
        }}
      />

      {/* Call Dialog Modal */}
      <CallDialogModal
        open={isCallModalOpen}
        onClose={() => setIsCallModalOpen(false)}
        clientName={client.fullName}
        phoneNumber={client.phones?.[0]?.number || ''}
        initialState="initial"
        onCallStart={(callType: CallType) => {
          console.log('Call started with type:', callType)
        }}
        onCallEnd={(duration: number, status: CallStatus) => {
          console.log('Call ended:', { duration, status })
        }}
      />
    </div>
  )
}

export default ActivityTimelinePage
