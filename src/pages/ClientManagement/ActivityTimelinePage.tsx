/**
 * Activity Timeline Page
 *
 * Full page view for displaying all client activities with filters.
 */

import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { useURLState, useAutoPersistedState } from '@/hooks'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { DateSelect } from '@/components/ui/DateSelect'
import { RadioGroup, RadioItem } from '@/components/ui/Radio'
import { Pagination } from '@/components/ui/Pagination'
import { AddNoteModal } from '@/pages/ClientManagement/components/AddNoteModal'
import { PriorityBadge } from './components/PriorityBadge'
import { CallDialogModal, type CallType, type CallStatus } from './components/CallDialogModal'
import { mockClientsDetail } from './mockClientDetails'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { ActivityTimelinePageSkeleton } from './components/ActivityTimelinePageSkeleton'
import { useCallStore } from '@/stores/callStore'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/DropdownMenu'

type CommunicationType = 'calls' | 'sms' | 'notes' | 'all'

export function ActivityTimelinePage() {
  const { t } = useTranslation('common')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isCallActive, setOpenCallModal } = useCallStore()
  const clientId = id ? Number(id) : 1
  const client = mockClientsDetail.find((c) => c.id === clientId) || mockClientsDetail[0]

  // URL state for pagination
  const [currentPage, setCurrentPage] = useURLState<number>('page', 1)
  const [rowsPerPage, setRowsPerPage] = useURLState<number>('pageSize', 10)

  // URL state for filters
  const [communicationTypeUrl, setCommunicationTypeUrl] = useURLState<string>('type', 'calls')
  const [dateFromUrl, setDateFromUrl] = useURLState<string>('date_from', '2024-11-20')
  const [dateToUrl, setDateToUrl] = useURLState<string>('date_to', '2024-11-27')

  // Add persistence for state
  useAutoPersistedState(
    'activity-timeline-state',
    {
      currentPage,
      rowsPerPage,
      communicationTypeUrl,
      dateFromUrl,
      dateToUrl,
    },
    {
      currentPage: setCurrentPage,
      rowsPerPage: setRowsPerPage,
      communicationTypeUrl: setCommunicationTypeUrl,
      dateFromUrl: setDateFromUrl,
      dateToUrl: setDateToUrl,
    }
  )

  // Convert URL state to component state
  const communicationType = communicationTypeUrl as CommunicationType
  const dateFrom = useMemo(() => (dateFromUrl ? new Date(dateFromUrl) : null), [dateFromUrl])
  const dateTo = useMemo(() => (dateToUrl ? new Date(dateToUrl) : null), [dateToUrl])

  // Create setters that update URL state
  const setCommunicationType = (value: CommunicationType) => setCommunicationTypeUrl(value)
  const setDateFrom = (value: Date | null) =>
    setDateFromUrl(value ? value.toISOString().split('T')[0] : '')
  const setDateTo = (value: Date | null) =>
    setDateToUrl(value ? value.toISOString().split('T')[0] : '')

  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false)
  const [isCallModalOpen, setIsCallModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Local editable activities state so UI can update result statuses
  const [activitiesState, setActivitiesState] = useState(() => client.activities || [])

  // Reset activities when client changes (only update when different to avoid cascading renders)
  useEffect(() => {
    const newIds = (client.activities || []).map((a) => a.id).join(',')
    const currentIds = (activitiesState || []).map((a) => a.id).join(',')
    if (newIds !== currentIds) {
      const timer = setTimeout(() => setActivitiesState(client.activities || []), 0)
      return () => clearTimeout(timer)
    }
  }, [client, activitiesState])

  const updateActivityResult = (activityId: number, newResult: string) => {
    setActivitiesState((prev) =>
      prev.map((a) => (a.id === activityId ? { ...a, result: newResult } : a))
    )
  }

  // Simulate loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [id])

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
  const RESULT_OPTIONS = [
    {
      value: 'refusal',
      label: 'Refusal to pay',
      textClass: 'text-error-500',
      outerClass: 'bg-error-200',
      innerClass: 'bg-error-500',
    },
    {
      value: 'agreement_full',
      label: 'Agreement for full payment',
      textClass: 'text-success-500',
      outerClass: 'bg-success-200',
      innerClass: 'bg-success-500',
    },
    {
      value: 'agreement_partial',
      label: 'Agreement for partial payment',
      textClass: 'text-success-500',
      outerClass: 'bg-success-200',
      innerClass: 'bg-success-500',
    },
    {
      value: 'callback',
      label: 'Call back later',
      textClass: 'text-dark-500',
      outerClass: 'bg-black/20',
      innerClass: 'bg-dark-500',
    },
  ]

  const getResultClasses = (label?: string) => {
    if (!label) return { text: 'text-dark-500', outer: 'bg-black/20', inner: 'bg-dark-500' }
    if (label === 'Refusal to pay')
      return { text: 'text-error-500', outer: 'bg-error-200', inner: 'bg-error-500' }
    if (label === 'Agreement for full payment')
      return { text: 'text-success-500', outer: 'bg-success-200', inner: 'bg-success-500' }
    if (label === 'Agreement for partial payment')
      return { text: 'text-success-500', outer: 'bg-success-200', inner: 'bg-success-500' }
    if (label === 'Call back later')
      return { text: 'text-dark-500', outer: 'bg-black/20', inner: 'bg-dark-500' }
    return { text: 'text-dark-500', outer: 'bg-black/20', inner: 'bg-dark-500' }
  }

  const filteredActivities = useMemo(() => {
    let result = [...(activitiesState || [])]

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
  }, [activitiesState, communicationType, dateFrom, dateTo])

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
    { key: 'date', header: t('pages.clients.activity.tableHeaders.date'), align: 'left' },
    { key: 'number', header: t('pages.clients.activity.tableHeaders.number'), align: 'left' },
    {
      key: 'contactType',
      header: t('pages.clients.activity.tableHeaders.contactType'),
      align: 'left',
    },
    {
      key: 'result',
      header: t('pages.clients.activity.tableHeaders.result'),
      align: 'left',
      render: (activity) => {
        const {
          text: textClass,
          outer: outerClass,
          inner: innerClass,
        } = getResultClasses(activity.result as string)
        return (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`flex w-full cursor-pointer items-center justify-between rounded px-3 py-2 text-sm font-medium ${textClass}`}
                aria-label={`Result for activity ${activity.id}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-3 w-3 items-center justify-center rounded-full ${outerClass}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${innerClass}`} />
                  </span>
                  <span className="min-w-0 truncate">{activity.result || '-'}</span>
                </div>
                <Icons.ArrowDown size={14} className="text-dark-500 ml-2" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent sideOffset={8} align="start" className="min-w-[220px]">
              {RESULT_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onSelect={() => updateActivityResult(activity.id as number, opt.label)}
                >
                  <div
                    className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${opt.textClass}`}
                  >
                    <span
                      className={`flex h-3 w-3 items-center justify-center rounded-full ${opt.outerClass}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${opt.innerClass}`} />
                    </span>
                    <span className="text-sm">{opt.label}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
    {
      key: 'promisedAmount',
      header: t('pages.clients.activity.tableHeaders.promisedAmount'),
      align: 'right',
      render: (activity) =>
        activity.promisedAmount ? `${formatCurrencyWithDecimals(activity.promisedAmount)} ₴` : '-',
    },
    {
      key: 'promisedDate',
      header: t('pages.clients.activity.tableHeaders.promisedDate'),
      align: 'left',
      render: (activity) => activity.promisedDate || '-',
    },
    { key: 'comment', header: t('pages.clients.activity.tableHeaders.comment'), align: 'left' },
    { key: 'employee', header: t('pages.clients.activity.tableHeaders.employee'), align: 'left' },
  ]

  const hasFilters = communicationType !== 'all' || dateFrom || dateTo

  // Show loading skeleton
  if (isLoading) {
    return <ActivityTimelinePageSkeleton />
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Client Header */}
      <div className="flex items-center justify-between self-stretch">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/dashboard/clients/${client.id}`)}
            className="flex h-6 w-6 items-center justify-center"
          >
            <Icons.ArrowLeft02 size={24} className="text-secondary-800" strokeWidth={1.5} />
          </button>
          <h1 className="text-dark-500 text-center text-2xl leading-[150%] font-light">
            {client.fullName}
          </h1>
          <span className="text-dark-500 flex items-center rounded-[16px] bg-white/10 px-3 py-0">
            {client.score} {t('pages.clients.activity.score')}
          </span>
          <PriorityBadge priority={client.priority} />
        </div>
        <div className="flex items-center gap-5">
          <Button
            size="md"
            variant="transparent-black"
            leftIcon={<Icons.PencilEdit size={20} />}
            className="rounded-full text-sm font-medium"
            onClick={() => setIsNoteModalOpen(true)}
          >
            {t('pages.clients.activity.addNoteAboutClient')}
          </Button>
          <Button
            size="md"
            leftIcon={<Icons.Headset size={20} />}
            className="rounded-full"
            onClick={() => {
              if (isCallActive()) {
                toast.warning(
                  t('pages.clients.modals.callDialog.callInProgress') ||
                    'Another call or recording is already in progress. Please finish or close it first.'
                )
                return
              }
              setOpenCallModal('call-dialog')
              setIsCallModalOpen(true)
            }}
          >
            {t('pages.clients.activity.call')}
          </Button>
          <Button
            size="md"
            variant="secondary"
            leftIcon={<Icons.RemoveMale size={20} />}
            className="rounded-full"
          >
            {t('pages.clients.activity.deleteClient')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col items-start gap-5 self-stretch rounded-xl bg-white/50 p-6">
        <div className="flex items-center justify-between self-stretch">
          {/* Type of communication */}
          <div className="flex flex-1 items-center gap-6">
            <label className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
              {t('pages.clients.activity.typeOfCommunication')}:
            </label>
            <RadioGroup
              value={communicationType}
              onValueChange={(value) => setCommunicationType(value as CommunicationType)}
              className="flex flex-1 items-center gap-2"
            >
              <div className="flex items-center gap-2">
                <RadioItem value="calls" id="calls" />
                <label htmlFor="calls" className="text-dark-500 cursor-pointer text-sm font-light">
                  {t('pages.clients.activity.calls')}
                </label>
              </div>
              <div className="flex items-center gap-2">
                <RadioItem value="sms" id="sms" />
                <label htmlFor="sms" className="text-dark-500 cursor-pointer text-sm font-light">
                  {t('pages.clients.activity.sms')}
                </label>
              </div>
              <div className="flex items-center gap-2">
                <RadioItem value="notes" id="notes" />
                <label htmlFor="notes" className="text-dark-500 cursor-pointer text-sm font-light">
                  {t('pages.clients.activity.notes')}
                </label>
              </div>
              <div className="flex items-center gap-2">
                <RadioItem value="all" id="all" />
                <label htmlFor="all" className="text-dark-500 cursor-pointer text-sm font-light">
                  {t('pages.clients.activity.all')}
                </label>
              </div>
            </RadioGroup>
          </div>

          {/* Date range */}
          <div className="flex flex-1 items-center gap-3">
            <label className="text-dark-500 text-xs leading-[140%] font-medium tracking-[-0.24px]">
              {t('pages.clients.activity.dateRange')}:
            </label>
            <div className="flex flex-1 items-start gap-2">
              <DateSelect
                value={dateFrom}
                onChange={({ value }) => setDateFrom(value)}
                placeholder={t('pages.clients.activity.fromDate')}
                format="yyyy-MM-dd"
              />
            </div>
            <span className="text-dark-500">-</span>
            <div className="flex flex-1 items-start gap-2">
              <DateSelect
                value={dateTo}
                onChange={({ value }) => setDateTo(value)}
                placeholder={t('pages.clients.activity.toDate')}
                format="yyyy-MM-dd"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-5">
            {hasFilters && (
              <button
                onClick={handleClearFilters}
                className="ml-auto flex cursor-pointer items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-gray-700 transition-colors hover:bg-white/10"
              >
                <Icons.Close size={16} className="text-gray-700" />
                <span className="text-xs font-medium">{t('pages.clients.activity.clearAll')}</span>
              </button>
            )}
          </div>
        </div>
        {/* Activity Table or Empty State */}
        {filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-6 self-stretch">
            <Icons.FileRemove size={48} className="text-gray-500" strokeWidth={0.5} />
            <p className="text-dark-500 text-center text-2xl font-light tracking-[-0.48px]">
              {t('pages.clients.activity.noActivityRecordedYet')}
            </p>
            {hasFilters && (
              <DoubleButton
                size="md"
                onClick={handleClearFilters}
                icon={<Icons.Close size={20} className="text-dark-500" strokeWidth={2} />}
              >
                {t('pages.clients.activity.resetFilters')}
              </DoubleButton>
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
            pageSize={rowsPerPage}
            pageSizeOptions={[10, 20, 50, 100]}
            onPageChange={setCurrentPage}
            onPageSizeChange={setRowsPerPage}
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
        onClose={() => {
          setOpenCallModal(null)
          setIsCallModalOpen(false)
        }}
        clientName={client.fullName}
        phoneNumber={client.phones?.[0]?.number || ''}
        initialState="initial"
        onCallStart={(callType: CallType) => {
          console.log('Call started with type:', callType)
        }}
        onCallEnd={(duration: number, status: CallStatus) => {
          console.log('Call ended:', { duration, status })
          setOpenCallModal(null)
        }}
      />
    </div>
  )
}

export default ActivityTimelinePage
