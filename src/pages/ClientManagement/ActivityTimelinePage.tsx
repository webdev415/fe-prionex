/**
 * Activity Timeline Page
 *
 * Full page view for displaying all client activities with filters.
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { DateSelect } from '@/components/ui/DateSelect'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Pagination } from '@/components/ui/Pagination'
import { AddNoteModal } from '@/pages/ClientManagement/components/AddNoteModal'
import { EditInteractionModal } from '@/pages/ClientManagement/components/EditInteractionModal'
import { PriorityBadge } from './components/PriorityBadge'
import { CallDialogModal, type CallType, type CallStatus } from './components/CallDialogModal'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { ActivityTimelinePageSkeleton } from './components/ActivityTimelinePageSkeleton'
import { formatDate, formatDateTime } from '@/lib/formatters'
import { getDateStringInTimezone } from '@/lib/dateUtils'
import { useCallStore } from '@/stores/callStore'
import { useClientProfile, useClientActivitiesPaginated } from '@/features/clients/hooks/useClients'
import {
  useCreateNoteInteraction,
  useUpdateInteraction,
} from '@/features/clients/hooks/useNoteInteraction'
import { useInteractionTypes } from '@/features/clients/hooks/useNoteInteraction'
import type { InteractionResponse } from '@/features/clients/api/types'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { useAuth } from '@/features/auth/hooks/useAuth'

export function ActivityTimelinePage() {
  const { t } = useTranslation('common')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { isCallActive, setOpenCallModal } = useCallStore()
  const { user } = useAuth()
  const userTimezone = user?.timezone
  const clientId = Number(id) || 0

  // Fetch real data from API
  const { data: profile, isLoading: isProfileLoading } = useClientProfile(clientId, clientId > 0)

  // Build client object from profile
  const client = useMemo(() => {
    if (!profile) return null
    // Build phones array from additional_phones (sourced from contacts)
    const phones =
      profile.additional_phones && profile.additional_phones.length > 0
        ? profile.additional_phones
        : profile.phone_primary
          ? [{ number: profile.phone_primary, type: 'mobile', label: 'Mobile' }]
          : []
    return {
      id: profile.id,
      fullName: profile.full_name,
      priorityScore: profile.priority_score ?? 0,
      priorityLevel: profile.priority_level ?? 'Low',
      phones,
    }
  }, [profile])

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // Filter state
  const [selectedTypeId, setSelectedTypeId] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<Date | null>(null)
  const [dateTo, setDateTo] = useState<Date | null>(null)

  // Build API params from filter/pagination state
  const apiParams = useMemo(() => {
    const params: {
      page?: number
      page_size?: number
      type_id?: number
      date_from?: string
      date_to?: string
    } = {
      page: currentPage,
      page_size: rowsPerPage,
    }
    if (selectedTypeId !== 'all') {
      params.type_id = Number(selectedTypeId)
    }
    if (dateFrom) {
      params.date_from = getDateStringInTimezone(dateFrom, userTimezone)
    }
    if (dateTo) {
      params.date_to = getDateStringInTimezone(dateTo, userTimezone)
    }
    return params
  }, [currentPage, rowsPerPage, selectedTypeId, dateFrom, dateTo, userTimezone])

  // Fetch interaction types for the filter dropdown
  const { data: interactionTypes } = useInteractionTypes()

  // Fetch activities with server-side pagination
  const { data: activitiesResponse, isLoading: isActivitiesLoading } = useClientActivitiesPaginated(
    clientId,
    apiParams,
    clientId > 0
  )

  const { mutate: createNote } = useCreateNoteInteraction()
  const { mutate: updateInteraction, isPending: isUpdating } = useUpdateInteraction()

  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false)
  const [isCallModalOpen, setIsCallModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingInteraction, setEditingInteraction] = useState<InteractionResponse | null>(null)

  // Combined loading state
  const isLoading = isProfileLoading || isActivitiesLoading

  // Map activities from API to display format
  const activitiesState = useMemo(() => {
    const items = activitiesResponse?.items ?? []
    return items.map((a) => ({
      id: a.id,
      date: formatDateTime(a.created_at),
      phoneNumber: a.phone_used?.trim() ? a.phone_used : '-',
      type_id: a.type_id,
      type: a.type_code
        ? t(`interactionTypes.${a.type_code}`, { defaultValue: a.type_name ?? '-' })
        : (a.type_name ?? '-'),
      subtype: a.subtype_code
        ? t(`interactionChannels.${a.subtype_code}`, { defaultValue: a.subtype_name ?? '-' })
        : (a.subtype_name ?? '-'),
      contactType: a.contact_type_code
        ? t(`interactionContactTypes.${a.contact_type_code}`, {
            defaultValue: a.contact_type_name ?? '-',
          })
        : (a.contact_type_name ?? '-'),
      result: a.result_code
        ? t(`interactionResults.${a.result_code}`, {
            defaultValue: a.result_name ?? a.status ?? '-',
          })
        : (a.result_name ?? a.status ?? '-'),
      promisedAmount: a.promise_to_pay_amount ? parseFloat(a.promise_to_pay_amount) : 0,
      promisedDate: formatDate(a.promise_to_pay_date ?? undefined),
      callbackDate: formatDate(a.next_action_date ?? undefined),
      comment: a.summary ?? a.notes ?? '-',
      employee: a.user_name ?? '-',
      updated_at: a.updated_at ?? a.created_at,
      _raw: a,
    }))
  }, [activitiesResponse, t])

  const totalCount = activitiesResponse?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage))

  const formatCurrencyWithDecimals = (amount: number) => {
    return new Intl.NumberFormat('uk-UA', {
      minimumFractionDigits: amount % 1 !== 0 ? 1 : 0,
      maximumFractionDigits: 1,
      useGrouping: true,
    })
      .format(amount)
      .replace(/,/g, ' ')
  }

  const handleClearFilters = () => {
    setSelectedTypeId('all')
    setDateFrom(null)
    setDateTo(null)
    setCurrentPage(1)
  }

  const activityColumns: Column<(typeof activitiesState)[0]>[] = [
    {
      key: 'date',
      header: t('pages.clients.activity.tableHeaders.dateAndTime', 'Date & Time'),
      align: 'left',
      className: 'min-w-[118px] w-[128px] overflow-hidden whitespace-normal',
    },
    {
      key: 'phoneNumber',
      header: t('pages.clients.activity.tableHeaders.phoneNumber', 'Phone number'),
      align: 'left',
      className: 'w-[12ch] min-w-[12ch] max-w-[12ch] overflow-hidden',
      render: (activity) => {
        const v = activity.phoneNumber
        return (
          <span
            className="block truncate font-mono text-xs tabular-nums"
            title={v !== '-' ? v : undefined}
          >
            {v}
          </span>
        )
      },
    },
    {
      key: 'type',
      header: t('pages.clients.activity.tableHeaders.type', 'Type'),
      align: 'left',
      className: 'w-[120px] overflow-hidden whitespace-normal break-words',
    },
    {
      key: 'subtype',
      header: t('pages.clients.activity.tableHeaders.channel', 'Channel'),
      align: 'left',
      className: 'w-[100px] overflow-hidden whitespace-normal break-words',
    },
    {
      key: 'contactType',
      header: t('pages.clients.activity.tableHeaders.contactType', 'Contact Type'),
      align: 'left',
      className: 'w-[120px] overflow-hidden whitespace-normal break-words',
    },
    {
      key: 'result',
      header: t('pages.clients.activity.tableHeaders.result'),
      align: 'left',
      className: 'w-[120px] overflow-hidden whitespace-normal break-words',
    },
    {
      key: 'promisedAmount',
      header: t('pages.clients.activity.tableHeaders.promisedAmount'),
      align: 'right',
      className: 'w-[140px] overflow-hidden whitespace-normal break-words',
      render: (activity) =>
        activity.promisedAmount ? `${formatCurrencyWithDecimals(activity.promisedAmount)}₴` : '-',
    },
    {
      key: 'promisedDate',
      header: t('pages.clients.activity.tableHeaders.promisedDate'),
      align: 'left',
      className: 'w-[120px] overflow-hidden whitespace-normal break-words',
    },
    {
      key: 'callbackDate',
      header: t('pages.clients.activity.tableHeaders.callbackDate', 'Callback Date'),
      align: 'left',
      className: 'w-[120px] overflow-hidden whitespace-normal break-words',
    },
    {
      key: 'comment',
      header: t('pages.clients.activity.tableHeaders.comment'),
      align: 'left',
      className: 'min-w-[300px] max-w-[500px] whitespace-normal break-words',
      render: (activity) => (
        <div className="py-1 text-sm leading-tight break-words whitespace-normal">
          {activity.comment || '-'}
        </div>
      ),
    },
    {
      key: 'employee',
      header: t('pages.clients.activity.tableHeaders.employee'),
      align: 'left',
      className: 'w-[200px] whitespace-normal',
      render: (activity) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-dark-500 text-xs font-medium">{activity.employee}</span>
          {activity.updated_at && (
            <span className="text-[10px] text-gray-400">{formatDateTime(activity.updated_at)}</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'center',
      className: 'w-[48px]',
      render: (activity) => (
        <PermissionGuard permission={PERMISSIONS.CLIENTS.CREATE_INTERACTIONS}>
          <button
            title={t('actions.edit', 'Edit')}
            onClick={() => {
              setEditingInteraction(activity._raw)
              setIsEditModalOpen(true)
            }}
            className="flex items-center justify-center rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <Icons.PencilEdit size={16} strokeWidth={1.5} />
          </button>
        </PermissionGuard>
      ),
    },
  ]

  const hasFilters = selectedTypeId !== 'all' || dateFrom || dateTo

  // Show loading skeleton while loading or if client data not available
  if (isLoading || !client) {
    return <ActivityTimelinePageSkeleton />
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Client Header */}
      <div className="flex flex-col gap-4 self-stretch 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-row items-center gap-2">
            <button
              onClick={() => navigate(`/dashboard/clients/${client?.id ?? clientId}`)}
              className="flex h-6 w-6 items-center justify-center"
            >
              <Icons.ArrowLeft02 size={24} className="text-secondary-800" strokeWidth={1.5} />
            </button>
            <h1 className="text-dark-500 text-center text-xl leading-[150%] font-light md:text-2xl">
              {client?.fullName ?? '-'}
            </h1>
          </div>
          <div className="flex flex-row items-center gap-2">
            <span className="text-dark-500 flex items-center rounded-[16px] bg-white/10 px-3 py-0 text-sm">
              {client?.priorityScore ?? 0} {t('pages.clients.activity.score')}
            </span>
            <PriorityBadge
              priority={(client?.priorityLevel ?? 'Low') as 'Critical' | 'High' | 'Medium' | 'Low'}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-5">
          <PermissionGuard permission={PERMISSIONS.CLIENTS.CREATE_INTERACTIONS}>
            <Button
              size="md"
              variant="outline"
              leftIcon={<Icons.PencilEdit size={20} />}
              className="flex w-full flex-row rounded-full text-xs font-medium md:w-auto md:text-sm"
              onClick={() => setIsNoteModalOpen(true)}
            >
              {t('pages.clients.activity.addNote')}
            </Button>
          </PermissionGuard>
          <PermissionGuard permission={PERMISSIONS.COMMUNICATION.MAKE_CALLS}>
            <Button
              size="md"
              leftIcon={<Icons.Headset size={20} />}
              className="flex w-full flex-row rounded-full text-xs font-medium md:w-auto md:text-sm"
              disabled={!user?.is_agent || !user?.asterisk_extension}
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
          </PermissionGuard>
        </div>
      </div>

      <div className="flex flex-col items-start gap-5 self-stretch rounded-xl bg-white/50 p-3 md:p-6">
        <div className="flex flex-col gap-4 self-stretch lg:flex-row lg:items-center lg:justify-between">
          {/* Type filter */}
          <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center lg:flex-1">
            <label className="text-dark-500 shrink-0 text-xs leading-[140%] font-medium tracking-[-0.24px]">
              {t('pages.clients.activity.tableHeaders.type', 'Type')}:
            </label>
            <Select
              value={selectedTypeId}
              onValueChange={(value) => {
                setSelectedTypeId(value)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]" aria-label="Type">
                <SelectValue placeholder={t('pages.clients.activity.all')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pages.clients.activity.all')}</SelectItem>
                {interactionTypes?.map((type) => (
                  <SelectItem key={type.id} value={type.id.toString()}>
                    {t(`interactionTypes.${type.code}`, { defaultValue: type.name })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="flex flex-col gap-2 self-stretch sm:flex-row sm:items-center lg:flex-1 lg:justify-end">
            <label className="text-dark-500 shrink-0 text-xs leading-[140%] font-medium tracking-[-0.24px]">
              {t('pages.clients.activity.dateRange')}:
            </label>
            <div className="flex flex-1 items-center gap-2">
              <DateSelect
                value={dateFrom}
                onChange={({ value }) => {
                  setDateFrom(value)
                  setCurrentPage(1)
                }}
                placeholder={t('pages.clients.activity.fromDate')}
                format="yyyy-MM-dd"
              />
              <span className="text-dark-500 shrink-0">-</span>
              <DateSelect
                value={dateTo}
                onChange={({ value }) => {
                  setDateTo(value)
                  setCurrentPage(1)
                }}
                placeholder={t('pages.clients.activity.toDate')}
                format="yyyy-MM-dd"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 self-stretch sm:justify-end lg:w-auto lg:flex-none">
            {hasFilters && (
              <button
                onClick={handleClearFilters}
                className="flex cursor-pointer items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-gray-700 transition-colors hover:bg-white/10 sm:px-4"
              >
                <Icons.Close size={16} className="text-gray-700" />
                <span className="text-xs font-medium">{t('pages.clients.activity.clearAll')}</span>
              </button>
            )}
          </div>
        </div>
        {/* Activity Table or Empty State */}
        {activitiesState.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 self-stretch md:gap-6">
            <Icons.FileRemove size={48} className="text-gray-500" strokeWidth={0.5} />
            <p className="text-dark-500 text-center text-xl leading-tight font-light tracking-[-0.48px] md:text-2xl">
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
          <div className="w-full overflow-x-auto">
            <DataTable
              columns={activityColumns}
              data={activitiesState}
              className="w-full"
              tableClassName="w-max min-w-full"
            />
          </div>
        )}
      </div>

      {activitiesState.length > 0 && (
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
        phoneNumber={client?.phones?.[0]?.number || ''}
        clientId={clientId}
        onSave={(data) => {
          createNote({ clientId, data })
        }}
      />

      {/* Call Dialog Modal */}
      <CallDialogModal
        open={isCallModalOpen}
        onClose={() => {
          setOpenCallModal(null)
          setIsCallModalOpen(false)
        }}
        clientName={client?.fullName ?? ''}
        phoneNumber={client?.phones?.[0]?.number || ''}
        initialState="initial"
        onCallStart={(_callType: CallType, _dialPhone: string) => {}}
        onCallEnd={(_duration: number, _status: CallStatus) => {
          setOpenCallModal(null)
        }}
      />

      {/* Edit Interaction Modal */}
      <EditInteractionModal
        open={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingInteraction(null)
        }}
        interaction={editingInteraction}
        isSaving={isUpdating}
        onSave={(data) => {
          if (!editingInteraction) return
          updateInteraction(
            { clientId, interactionId: editingInteraction.id, data },
            {
              onSuccess: () => {
                setIsEditModalOpen(false)
                setEditingInteraction(null)
              },
            }
          )
        }}
      />
    </div>
  )
}

export default ActivityTimelinePage
