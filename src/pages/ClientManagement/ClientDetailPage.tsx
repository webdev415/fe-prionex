/**
 * Client Detail Page
 *
 * Full page view for displaying detailed client information.
 */
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { AddNoteModal } from './components/AddNoteModal'
import { AddTaskModal } from './components/AddTaskModal'
// import { DeleteClientModal } from './components/DeleteClientModal'
import { EditClientModal } from './components/EditClientModal'
import { AssignRoleModal, type AssignRoleMode } from './components/AssignRoleModal'
import { PriorityBadge } from './components/PriorityBadge'
import type { Priority } from './types'
import { TagBadge } from '@/components/ui/TagBadge'
import { CallDialogModal, type CallType, type CallStatus } from './components/CallDialogModal'
import { CallRecordingModal } from './components/CallRecordingModal'
import { ViewSMSModal } from './components/ViewSMSModal'
import { SendSMSModal } from './components/SendSMSModal'
import { CallLogCard } from './components/CallLogCard'
import { cn } from '@/lib/utils'
// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuTrigger,
// } from '@/components/ui/DropdownMenu'
// import { useUserRole } from '@/hooks/usePermissions'
import {
  useClientProfile,
  useClientLoans,
  useClientPaymentsSection,
  useClientCallSmsHistory,
  useClientTasks,
  useClientOperatorsSection,
  useClientDocuments,
  useClientActivities,
  useClientDialHistory,
  useAssignClient,
  useClientRestructuringAgreements,
  useRestructuringAgreementDetail,
} from '@/features/clients/hooks/useClients'
import type { RestructuringPaymentEntry } from '@/features/clients/api/types'
import { useCreateNoteInteraction } from '@/features/clients/hooks/useNoteInteraction'
import { LinkButton } from '@/components/ui/LinkButton'
import { ClientDetailPageSkeleton } from './components/ClientDetailPageSkeleton'
import { useCallStore } from '@/stores/callStore'
import { useClientTags } from '@/features/tags/hooks/useTags'
import { TagSelectorModal } from './components/TagSelectorModal'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useOriginateCall } from '@/features/calls/hooks/useCall'
import { useCallWebSocket } from '@/features/calls/hooks/useCallWebSocket'
import { useAuthStore } from '@/stores/authStore'
import { useUserDepartment } from '@/features/users'

// Extended types for SMS and Call items with API-specific properties
type ExtendedSMSItem = {
  id: number
  date: string
  time: string
  message: string
  template: string
  operator: string
  status: string
  phone?: string
  sent_at?: string
  delivered_at?: string
}

type ExtendedCallItem = {
  id: number
  date: string
  time: string
  type: 'Incoming' | 'Outgoing'
  duration: string
  status: string
  operator: string
  phone: string
  phoneLabel: string
  line: string
  call_id?: string
  initiated_at?: string
}

// Legacy numeric code mappings (from old CRM database)
const MARITAL_STATUS_MAP: Record<string, string> = {
  '1': 'Неодружений/Незаміжня',
  '2': 'Одружений/Заміжня',
  '3': 'Розлучений/Розлучена',
  '4': 'Вдівець/Вдова',
  '5': 'Цивільний шлюб',
}

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  full_time: 'Повна зайнятість',
  part_time: 'Часткова зайнятість',
  contract: 'Контракт',
  student: 'Студент',
  self_employed: 'ФОП',
  unemployed: 'Безробітний',
  retired: 'Пенсіонер',
  other: 'Інше',
}

const CONTACT_TYPE_MAP: Record<string, string> = {
  phone_mobile_third_party: 'Третя особа (моб.)',
  phone_home_third_party: 'Третя особа (дом.)',
  phone_work_third_party: 'Третя особа (роб.)',
  phone_mobile_guarantor: 'Поручитель (моб.)',
  phone_work_guarantor: 'Поручитель (роб.)',
  phone_home_guarantor: 'Поручитель (дом.)',
  phone_other: 'Інший телефон',
  phone_mobile_other: 'Інший (моб.)',
  phone_work_other: 'Інший (роб.)',
  phone_home_other: 'Інший (дом.)',
  phone_home_client: 'Клієнт (дом.)',
  phone_fax: 'Факс',
}

// Client data loaded via useClientProfile + section-specific hooks (real API endpoints)

export function ClientDetailPage() {
  const { t } = useTranslation('common')
  const { isCallActive, setOpenCallModal } = useCallStore()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeLoanTab, setActiveLoanTab] = useState<'process' | 'closed' | 'rr'>('process')
  const [selectedRaId, setSelectedRaId] = useState<number | null>(null)
  const [activeCommentTab, setActiveCommentTab] = useState<'comments' | 'primary' | 'dial-history'>(
    'comments'
  )

  // Get current user for call integration
  const { user } = useAuth()
  const userTimezone = useAuthStore((state) => state.user?.timezone)
  const { mutate: originateCall, isPending: isOriginatingCall } = useOriginateCall()

  // Track call error state for displaying in modal
  const [callError, setCallError] = useState<string | null>(null)

  // Enable WebSocket for real-time call updates
  useCallWebSocket(user?.asterisk_extension || null)

  // Clear call error when modal opens
  const handleClearCallError = () => {
    setCallError(null)
  }

  // Handle call origination with custom success handler
  const handleOriginateCall = (phoneNumber: string, clientName: string, clientId: string) => {
    if (!user?.asterisk_extension) {
      setCallError('Your account is not configured for calling. Please contact administrator.')
      return
    }

    // Clear any previous error
    setCallError(null)

    originateCall(
      {
        agent_extension: user.asterisk_extension,
        customer_number: phoneNumber,
        caller_id_name: 'CRM Call',
        client_id: Number(clientId),
        campaign_id: user.active_project_id ?? undefined,
        metadata: {
          client_name: clientName,
        },
      },
      {
        onSuccess: (data) => {
          // Store the call ID to track this call with backend
          setCurrentCallId(data.call_id)
          // Modal is already open and will transition to 'dialing' state
          // No need to re-open it
        },
        onError: (err: unknown) => {
          // Extract error message from response
          let message: string | undefined
          if (err && typeof err === 'object' && 'response' in err) {
            const response = (
              err as { response?: { data?: { message?: string; detail?: unknown } } }
            ).response
            const data = response?.data
            if (data?.message) {
              message = data.message
            } else if (data?.detail) {
              // detail can be a string or an object with message property
              if (typeof data.detail === 'string') {
                message = data.detail
              } else if (typeof data.detail === 'object' && data.detail !== null) {
                message = (data.detail as { message?: string }).message
              }
            }
          }
          setCallError(message || 'Failed to initiate call. Please try again.')
        },
      }
    )
  }

  // Client detail: one profile + section endpoints
  const clientId = id ? Number(id) : 0
  const isValidClientId = clientId > 0 && !isNaN(clientId)

  const {
    data: profile,
    isLoading: isProfileLoading,
    isError: isProfileError,
    error: profileError,
  } = useClientProfile(clientId, isValidClientId)
  const { data: loans = [], isLoading: isLoansLoading } = useClientLoans(clientId, isValidClientId)
  const { data: restructuringAgreements = [], isLoading: isRrLoading } =
    useClientRestructuringAgreements(clientId, isValidClientId)
  const { data: rrDetail } = useRestructuringAgreementDetail(
    clientId,
    selectedRaId ?? 0,
    !!selectedRaId
  )
  const { data: paymentsSection, isLoading: isPaymentsLoading } = useClientPaymentsSection(
    clientId,
    isValidClientId
  )
  const { data: callSmsHistory, isLoading: isCallSmsLoading } = useClientCallSmsHistory(
    clientId,
    isValidClientId
  )
  const { data: tasks = [], isLoading: isTasksLoading } = useClientTasks(clientId, isValidClientId)
  const { data: operatorsSection, isLoading: isOperatorsLoading } = useClientOperatorsSection(
    clientId,
    isValidClientId
  )
  const { data: documents = [], isLoading: isDocumentsLoading } = useClientDocuments(
    clientId,
    isValidClientId
  )
  const { data: activities = [], isLoading: isActivitiesLoading } = useClientActivities(
    clientId,
    isValidClientId
  )
  const { data: dialHistory = [], isLoading: isDialHistoryLoading } = useClientDialHistory(
    clientId,
    isValidClientId
  )
  // Fetch client tags from API (real)
  const { data: clientTags } = useClientTags(clientId)

  // Fetch department of responsible employee
  const { data: responsibleEmployeeDepartment } = useUserDepartment(
    profile?.responsible_employee_id || 0
  )

  // Note creation mutation (via interaction API)
  const { mutate: createNote } = useCreateNoteInteraction()

  // Assign client mutation (used by AssignRoleModal)
  const assignClientMutation = useAssignClient()

  // Compose single client object from profile + sections for the rest of the page
  // Maps backend response fields to UI-expected shape for backward compatibility
  const client = useMemo(() => {
    if (!profile) return null

    // Build phones array from profile fields
    // Filter out placeholder "000000000000" phones from legacy data migration
    const isValidPhone = (p: string | null | undefined): p is string => !!p && !/^0+$/.test(p)
    const phones: Array<{ number: string; type: string }> = []
    if (isValidPhone(profile.phone_primary))
      phones.push({ number: profile.phone_primary, type: 'primary' })
    if (isValidPhone(profile.phone_secondary))
      phones.push({ number: profile.phone_secondary, type: 'secondary' })
    if (profile.additional_phones) {
      profile.additional_phones
        .filter((p) => isValidPhone(p.number))
        .forEach((p) => phones.push({ number: p.number, type: p.type }))
    }

    // Address type label map
    const ADDRESS_TYPE_LABEL_MAP: Record<string, string> = {
      registration: t('pages.clients.detail.registrationAddress'),
      actual: t('pages.clients.detail.personalAddress'),
    }

    return {
      ...profile,
      // Header fields
      fullName: profile.full_name,
      score: profile.priority_score ?? 0,
      priority: profile.priority_level
        ? profile.priority_level.charAt(0).toUpperCase() + profile.priority_level.slice(1)
        : 'Low',
      phoneNumber: isValidPhone(profile.phone_primary) ? profile.phone_primary : '-',
      taxIdNumber: profile.tax_id,
      // Card fields
      department: responsibleEmployeeDepartment || '-',
      responsibleEmployee: profile.responsible_employee_name ?? '-',
      responsibleResearcher: profile.responsible_searcher_name ?? '-',
      phones,
      // Personal details (nested for compatibility)
      personalDetails: {
        tin: profile.tax_id,
        dateOfBirth: profile.date_of_birth ?? '',
        age: profile.age ?? '',
        documentType: profile.passport?.document_type ?? '',
        passportSeries: profile.passport?.series ?? '',
        passportNumber: profile.passport?.number ?? '',
        issuedBy: profile.passport?.issued_by ?? '',
        issuedDate: profile.passport?.issued_date ?? '',
        expiresDate: profile.passport?.expires_date ?? '',
        gender: profile.passport?.gender ?? '',
        recordNumber: profile.passport?.record_number ?? '',
        maritalStatus: profile.marital_status
          ? (MARITAL_STATUS_MAP[profile.marital_status] ?? profile.marital_status)
          : '',
        familyMembers: profile.family_members_count ?? '',
        incomeLevel: profile.income_level ?? '',
      },
      // Work
      work: profile.employment
        ? {
            organizationName: profile.employment.company_name ?? '-',
            position: profile.employment.position ?? '-',
            experience:
              profile.employment.work_experience_years != null
                ? `${profile.employment.work_experience_years} р.`
                : (profile.employment.employment_date ?? '-'),
            managerFullName:
              profile.employment.manager_full_name ?? profile.employment.manager_name ?? '-',
            employmentType: profile.employment.employment_type
              ? (EMPLOYMENT_TYPE_MAP[profile.employment.employment_type] ??
                profile.employment.employment_type)
              : '-',
            workPhone: profile.employment.work_phone ?? '-',
          }
        : null,
      recommenders: (profile.recommenders ?? []).map((r) => ({
        id: r.id,
        fullName: r.full_name ?? '',
        contactType: CONTACT_TYPE_MAP[r.contact_type] ?? r.contact_type ?? '',
        relationship: r.relationship ?? '',
        phoneNumber: r.phone ?? '',
        comment: r.notes ?? '',
      })),
      addresses: (profile.addresses ?? []).map((a) => ({
        id: a.id,
        type: ADDRESS_TYPE_LABEL_MAP[a.address_type] ?? a.address_type,
        fullAddress: a.full_address ?? '',
      })),
      // Comments mapped
      comments: (profile.comments ?? []).map((c) => ({
        id: c.id,
        date: c.created_at ? new Date(c.created_at).toLocaleDateString() : '-',
        text: c.content,
        author: c.created_by_name ?? `User #${c.created_by}`,
      })),
      tags: profile.tags,
      // Loans mapped from DebtDetail to UI shape
      loans: (loans ?? []).map((d) => ({
        id: d.id,
        loanNumber: d.contract_number,
        counterparty: d.seller_company,
        saleDate: d.purchase_date ?? '-',
        principalAmount: Number(d.principal_amount ?? 0),
        principalDebt: Number(d.principal_debt ?? d.principal_amount ?? 0),
        remainingDebtAmount: Number(d.remaining_debt_amount ?? 0),
        totalToReturn: Number(d.total_to_return ?? d.remaining_debt_amount ?? 0),
        status: d.status,
      })),
      // Payments mapped from PaymentResponse to UI shape
      payments: (paymentsSection?.payments ?? []).map((p) => ({
        id: p.id,
        loanNumber: p.debt_contract_number ?? p.payment_number,
        counterparty: p.seller_name ?? '-',
        saleDate: '-',
        paymentDate: p.payment_date,
        amount: Number(p.amount),
        paymentMethod: p.payment_method,
        status: p.status,
        paymentDistribution: `${p.principal_paid} principal, ${p.interest_paid} interest`,
        employee: p.recorded_by_username ?? '-',
      })),
      // Write-offs mapped
      writesOffs: (paymentsSection?.writesOffs ?? []).map((w) => ({
        id: w.id,
        loanNumber: w.contract_number ?? '-',
        counterparty: w.seller_name ?? '-',
        saleDate: '-',
        writeOffDate: w.writeoff_date ?? '-',
        amount: Number(w.amount),
        writeOffMethod: w.writeoff_type,
        employee: w.submitted_by_name ?? '-',
      })),
      // Primary Creditor Payments - Not yet implemented (Phase 8)
      // Backend API endpoint pending - will be added when primary creditor payment service is implemented
      paymentsToPrimaryCreditor: [] as Array<{
        id: number
        loanNumber: string
        counterparty: string
        saleDate: string
        paymentDate: string
        amount: number
        distributionMethod: string
      }>,
      callSmsHistory: callSmsHistory ?? { all: [], calls: [], sms: [] },
      // Tasks mapped from TaskResponse to UI shape
      tasks: (tasks ?? []).map((t) => ({
        id: t.id,
        loanNumber: '-',
        creationDate: t.created_at ? new Date(t.created_at).toLocaleDateString() : '-',
        whoCreated: t.created_by_name ?? '-',
        description: t.title + (t.description ? `: ${t.description}` : ''),
        reminderDate: t.due_date ? new Date(t.due_date).toLocaleDateString() : '-',
        reminderRecipient: t.assigned_to_username ?? '-',
      })),
      // Operators/searchers from assignment history
      operators: (operatorsSection?.operators ?? []).map((o) => ({
        id: o.id,
        date: o.assigned_at ? new Date(o.assigned_at).toLocaleDateString() : '-',
        whoAppointed: o.assigned_by_name ?? '-',
        whoIsResponsible: o.new_employee_name ?? '-',
        note: o.assignment_reason ?? '-',
      })),
      searchers: (operatorsSection?.searchers ?? []).map((s) => ({
        id: s.id,
        date: s.assigned_at ? new Date(s.assigned_at).toLocaleDateString() : '-',
        whoAppointed: s.assigned_by_name ?? '-',
        whoIsResponsible: s.new_searcher_name ?? '-',
        note: s.assignment_reason ?? '-',
      })),
      documents,
      // Activities mapped from InteractionResponse to UI shape
      activities: (activities ?? []).map((a) => ({
        id: a.id,
        date: a.interaction_date ? new Date(a.interaction_date).toLocaleDateString() : '-',
        number: a.number_k ?? '-',
        type: a.type_name ?? '-',
        subtype: a.subtype_name ?? '-',
        result: a.result_name ?? a.status,
        promisedAmount: a.promise_to_pay_amount ? Number(a.promise_to_pay_amount) : 0,
        promisedDate: a.promise_to_pay_date ?? '-',
        comment: a.summary ?? a.notes ?? '-',
        employee: a.user_name ?? '-',
      })),
      // Primary Creditor Payments - Not yet implemented (Phase 8)
      primaryCreditorPayments: [] as Array<{
        id: number
        loanNumber: string
        counterparty: string
        saleDate: string
        paymentDate: string
        amount: number
        distributionMethod: string
      }>,
    }
  }, [
    profile,
    loans,
    paymentsSection,
    callSmsHistory,
    tasks,
    operatorsSection,
    documents,
    activities,
    responsibleEmployeeDepartment,
    t,
  ])

  // Tags are now fetched from useClientTags hook instead of local state
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [isCallModalOpen, setIsCallModalOpen] = useState(false)
  const [currentCallId, setCurrentCallId] = useState<string | null>(null)
  const [isCallRecordingModalOpen, setIsCallRecordingModalOpen] = useState(false)
  const [isTagModalOpen, setIsTagModalOpen] = useState(false)
  // const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [assignRoleModalMode, setAssignRoleModalMode] = useState<AssignRoleMode | null>(null)
  // const userRole = useUserRole()
  // const canDelete = userRole === 'Admin' || userRole === 'Supervisor'
  const [selectedCallData, setSelectedCallData] = useState<{
    type: string
    clientName: string
    date: string
    time: string
    operator: string
    duration: string
    phone: string
    call_id?: string
  } | null>(null)
  const [isViewSMSModalOpen, setIsViewSMSModalOpen] = useState(false)
  const [selectedSMSData, setSelectedSMSData] = useState<{
    date: string
    time: string
    template: string
    operator: string
    status: string
    message: string
    phone: string
    sent_at?: string // UTC timestamp from API
    delivered_at?: string // UTC timestamp from API
  } | null>(null)
  const [isSendSMSModalOpen, setIsSendSMSModalOpen] = useState(false)
  const [selectedPhoneForSMS, setSelectedPhoneForSMS] = useState<string>('')
  const [selectedPhoneForCall, setSelectedPhoneForCall] = useState<string>('')
  const [selectedPhoneForNote, setSelectedPhoneForNote] = useState<string>('')
  const [activeClientCardTab, setActiveClientCardTab] = useState<
    'personal' | 'recommenders' | 'addresses' | 'work'
  >('personal')
  const [activeRightCardTab, setActiveRightCardTab] = useState<
    'loans' | 'payments' | 'operators' | 'call-sms-history' | 'tasks' | 'documents'
  >('loans')
  const [activePaymentTab, setActivePaymentTab] = useState<
    'payments' | 'writes-off' | 'primary-creditor'
  >('payments')
  const [activeOperatorTab, setActiveOperatorTab] = useState<'operators' | 'searchers'>('operators')
  const [activeCallSmsTab, setActiveCallSmsTab] = useState<'all' | 'calls' | 'sms'>('all')

  // Tab navigation scroll state
  const tabContainerRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)

  // Client card tab navigation scroll state
  const clientCardTabContainerRef = useRef<HTMLDivElement>(null)
  const [showClientCardLeftArrow, setShowClientCardLeftArrow] = useState(false)
  const [showClientCardRightArrow, setShowClientCardRightArrow] = useState(false)

  // Check scroll position and show/hide arrows
  const checkScrollPosition = () => {
    if (!tabContainerRef.current) return

    const container = tabContainerRef.current
    const { scrollLeft, scrollWidth, clientWidth } = container

    setShowLeftArrow(scrollLeft > 0)
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1) // -1 for rounding errors
  }

  // Scroll handlers
  const scrollTabs = (direction: 'left' | 'right') => {
    if (!tabContainerRef.current) return

    const container = tabContainerRef.current
    const scrollAmount = 200 // Adjust scroll amount as needed
    const newScrollLeft =
      direction === 'left'
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount

    container.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth',
    })
  }

  // Check scroll position for client card tabs
  const checkClientCardTabScrollPosition = () => {
    if (!clientCardTabContainerRef.current) return

    const container = clientCardTabContainerRef.current
    const { scrollLeft, scrollWidth, clientWidth } = container

    setShowClientCardLeftArrow(scrollLeft > 0)
    setShowClientCardRightArrow(scrollLeft < scrollWidth - clientWidth - 1) // -1 for rounding errors
  }

  // Scroll handlers for client card tabs
  const scrollClientCardTabs = (direction: 'left' | 'right') => {
    if (!clientCardTabContainerRef.current) return

    const container = clientCardTabContainerRef.current
    const scrollAmount = 200 // Adjust scroll amount as needed
    const newScrollLeft =
      direction === 'left'
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount

    container.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth',
    })
  }

  // Check scroll position on mount and resize
  useEffect(() => {
    checkScrollPosition()
    const container = tabContainerRef.current
    if (container) {
      container.addEventListener('scroll', checkScrollPosition)
      window.addEventListener('resize', checkScrollPosition)

      return () => {
        container.removeEventListener('scroll', checkScrollPosition)
        window.removeEventListener('resize', checkScrollPosition)
      }
    }
  }, [activeRightCardTab]) // Re-check when tab changes

  // Check scroll position for client card tabs on mount and resize
  useEffect(() => {
    checkClientCardTabScrollPosition()
    const container = clientCardTabContainerRef.current
    if (container) {
      container.addEventListener('scroll', checkClientCardTabScrollPosition)
      window.addEventListener('resize', checkClientCardTabScrollPosition)

      return () => {
        container.removeEventListener('scroll', checkClientCardTabScrollPosition)
        window.removeEventListener('resize', checkClientCardTabScrollPosition)
      }
    }
  }, [activeClientCardTab]) // Re-check when tab changes

  // Scroll active tab into view when it changes
  useEffect(() => {
    if (!tabContainerRef.current) return

    const container = tabContainerRef.current
    const activeTab = container.querySelector(`[data-tab="${activeRightCardTab}"]`) as HTMLElement

    if (activeTab) {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        activeTab.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        })
        // Re-check scroll position after scrolling
        setTimeout(checkScrollPosition, 300)
      }, 0)
    }
  }, [activeRightCardTab])

  // Scroll active client card tab into view when it changes
  useEffect(() => {
    if (!clientCardTabContainerRef.current) return

    const container = clientCardTabContainerRef.current
    const activeTab = container.querySelector(`[data-tab="${activeClientCardTab}"]`) as HTMLElement

    if (activeTab) {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        activeTab.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        })
        // Re-check scroll position after scrolling
        setTimeout(checkClientCardTabScrollPosition, 300)
      }, 0)
    }
  }, [activeClientCardTab])

  // Show loading skeleton
  if (isProfileLoading) {
    return <ClientDetailPageSkeleton />
  }

  // Show error state
  if (isProfileError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <Icons.Warning className="text-error-500 h-8 w-8" strokeWidth={2} />
        <p className="font-medium text-gray-900">Failed to load client</p>
        <p className="text-sm text-gray-600">{profileError?.message || 'An error occurred'}</p>
        <Button variant="outline" onClick={() => navigate('/dashboard/client')} className="mt-4">
          Back to Clients
        </Button>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-gray-600">{t('pages.clients.detail.clientNotFound')}</p>
        <Button variant="outline" onClick={() => navigate('/dashboard')} className="mt-4">
          {t('pages.clients.detail.backToClients')}
        </Button>
      </div>
    )
  }

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return '0'
    return new Intl.NumberFormat('uk-UA', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    })
      .format(num)
      .replace(/,/g, ' ')
  }

  const formatCurrencyWithDecimals = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(num)) return '0'
    return new Intl.NumberFormat('uk-UA', {
      minimumFractionDigits: num % 1 !== 0 ? 1 : 0,
      maximumFractionDigits: 1,
      useGrouping: true,
    })
      .format(num)
      .replace(/,/g, ' ')
  }

  const loanColumns: Column<(typeof client.loans)[0]>[] = [
    { key: 'loanNumber', header: t('pages.clients.detail.tableHeaders.loanNumber'), align: 'left' },
    {
      key: 'counterparty',
      header: t('pages.clients.detail.tableHeaders.counterparty'),
      align: 'left',
    },
    { key: 'saleDate', header: t('pages.clients.detail.tableHeaders.saleDate'), align: 'left' },
    {
      key: 'principalAmount',
      header: t('pages.clients.detail.tableHeaders.principalAmount'),
      align: 'right',
      render: (loan) => `₴ ${formatCurrency(loan.principalAmount)}`,
    },
    {
      key: 'principalDebt',
      header: t('pages.clients.detail.tableHeaders.principalDebt'),
      align: 'right',
      render: (loan) => `₴ ${formatCurrency(loan.principalDebt)}`,
    },
    {
      key: 'remainingDebtAmount',
      header: t('pages.clients.detail.tableHeaders.remainingDebtAmount'),
      align: 'right',
      render: (loan) => `₴ ${formatCurrency(loan.remainingDebtAmount)}`,
    },
    {
      key: 'totalToReturn',
      header: t('pages.clients.detail.tableHeaders.totalToReturn'),
      align: 'right',
      render: (loan) => `₴ ${formatCurrency(loan.totalToReturn)}`,
    },
  ]

  type RrRow = (typeof restructuringAgreements)[0]
  const rrColumns: Column<RrRow>[] = [
    {
      key: 'contract_number',
      header: t('pages.clients.detail.tableHeaders.loanNumber'),
      align: 'left',
    },
    {
      key: 'seller_company',
      header: t('pages.clients.detail.tableHeaders.counterparty'),
      align: 'left',
    },
    {
      key: 'purchase_date',
      header: t('pages.clients.detail.tableHeaders.saleDate'),
      align: 'left',
    },
    {
      key: 'restructuring_amount',
      header: t('pages.clients.detail.tableHeaders.rrAmount'),
      align: 'right',
      render: (row) => `₴ ${formatCurrency(Number(row.restructuring_amount ?? 0))}`,
    },
    {
      key: 'first_payment_date',
      header: t('pages.clients.detail.tableHeaders.rrConnectionDate'),
      align: 'left',
    },
    {
      key: 'remaining_debt_amount',
      header: t('pages.clients.detail.tableHeaders.totalToBeRepaid'),
      align: 'right',
      render: (row) => `₴ ${formatCurrency(Number(row.remaining_debt_amount ?? 0))}`,
    },
    {
      key: 'id',
      header: t('pages.clients.detail.tableHeaders.actions'),
      align: 'center',
      render: (row) => (
        <button
          onClick={() => setSelectedRaId(row.id)}
          className="text-secondary-800 hover:text-secondary-600 p-1"
          title={t('pages.clients.detail.viewDetail')}
        >
          <Icons.Eye size={18} />
        </button>
      ),
    },
  ]

  const activityColumns: Column<(typeof client.activities)[0]>[] = [
    {
      key: 'date',
      header: t('pages.clients.activity.tableHeaders.date'),
      align: 'left',
      className: 'w-[90px] overflow-hidden whitespace-normal',
    },
    {
      key: 'number',
      header: t('pages.clients.activity.tableHeaders.loanNumber'),
      align: 'left',
      className: 'w-[120px] overflow-hidden whitespace-normal break-words',
    },
    {
      key: 'type',
      header: t('pages.clients.activity.tableHeaders.type'),
      align: 'left',
      className: 'w-[120px] overflow-hidden whitespace-normal break-words',
    },
    {
      key: 'subtype',
      header: t('pages.clients.activity.tableHeaders.subtype'),
      align: 'left',
      className: 'w-[100px] overflow-hidden whitespace-normal break-words',
    },
    {
      key: 'result',
      header: t('pages.clients.activity.tableHeaders.result'),
      align: 'left',
      className: 'w-[100px] overflow-hidden whitespace-normal break-words',
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
      key: 'comment',
      header: t('pages.clients.activity.tableHeaders.comment'),
      align: 'left',
      className: 'whitespace-normal break-words',
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
      className: 'w-[120px] overflow-hidden whitespace-normal break-words',
    },
  ]

  const dialHistoryColumns: Column<(typeof dialHistory)[0]>[] = [
    {
      key: 'interaction_date',
      header: t('pages.clients.activity.tableHeaders.date'),
      align: 'left',
      className: 'w-[100px]',
      render: (row) =>
        row.interaction_date ? new Date(row.interaction_date).toLocaleDateString() : '-',
    },
    {
      key: 'phone',
      header: t('pages.clients.activity.tableHeaders.phone'),
      align: 'left',
      className: 'w-[120px]',
    },
    {
      key: 'number_k',
      header: t('pages.clients.activity.tableHeaders.loanNumber'),
      align: 'left',
      className: 'w-[140px]',
    },
    {
      key: 'should_dial',
      header: t('pages.clients.activity.tableHeaders.shouldDial'),
      align: 'center',
      className: 'w-[90px]',
      render: (row) => (row.should_dial === 1 ? 'Yes' : row.should_dial === 2 ? 'No' : '-'),
    },
  ]

  const paymentColumns: Column<(typeof client.payments)[0]>[] = [
    { key: 'loanNumber', header: t('pages.clients.detail.tableHeaders.loanNumber'), align: 'left' },
    {
      key: 'counterparty',
      header: t('pages.clients.detail.tableHeaders.counterparty'),
      align: 'left',
    },
    { key: 'saleDate', header: t('pages.clients.detail.tableHeaders.saleDate'), align: 'left' },
    {
      key: 'paymentDate',
      header: t('pages.clients.detail.tableHeaders.paymentDate'),
      align: 'left',
    },
    {
      key: 'amount',
      header: t('pages.clients.detail.tableHeaders.amount'),
      align: 'right',
      render: (payment) => `₴ ${formatCurrency(payment.amount)}`,
    },
    {
      key: 'paymentMethod',
      header: t('pages.clients.detail.tableHeaders.paymentMethod'),
      align: 'left',
    },
    {
      key: 'status',
      header: t('pages.clients.detail.tableHeaders.status'),
      align: 'left',
      render: (payment) => {
        const statusColors = {
          Done: 'bg-success-500',
          Pending: 'bg-gray-500',
          Failed: 'bg-error-500',
        }
        const statusColor =
          statusColors[payment.status as keyof typeof statusColors] || 'bg-gray-500'
        const textColor =
          payment.status === 'Done'
            ? 'text-success-500'
            : payment.status === 'Failed'
              ? 'text-error-500'
              : 'text-gray-500'
        return (
          <div className="flex items-center gap-2">
            <span className={cn('h-2.5 w-2.5 flex-shrink-0 rounded-full', statusColor)} />
            <span className={cn('text-xs font-medium', textColor)}>
              {t(`pages.clients.detail.paymentStatuses.${payment.status.toLowerCase()}`)}
            </span>
          </div>
        )
      },
    },
    {
      key: 'paymentDistribution',
      header: t('pages.clients.detail.tableHeaders.paymentDistribution'),
      align: 'left',
    },
    {
      key: 'employee',
      header: t('pages.clients.detail.tableHeaders.fixationOnEmployee'),
      align: 'left',
    },
  ]

  const writeOffColumns: Column<(typeof client.writesOffs)[0]>[] = [
    { key: 'loanNumber', header: t('pages.clients.detail.tableHeaders.loanNumber'), align: 'left' },
    {
      key: 'counterparty',
      header: t('pages.clients.detail.tableHeaders.counterparty'),
      align: 'left',
    },
    { key: 'saleDate', header: t('pages.clients.detail.tableHeaders.saleDate'), align: 'left' },
    {
      key: 'writeOffDate',
      header: t('pages.clients.detail.tableHeaders.writeOffDate'),
      align: 'left',
    },
    {
      key: 'amount',
      header: t('pages.clients.detail.tableHeaders.amount'),
      align: 'right',
      render: (writeOff) => `₴ ${formatCurrency(writeOff.amount)}`,
    },
    {
      key: 'writeOffMethod',
      header: t('pages.clients.detail.tableHeaders.writeOffMethod'),
      align: 'left',
    },
    {
      key: 'employee',
      header: t('pages.clients.detail.tableHeaders.fixationOnEmployee'),
      align: 'left',
    },
  ]

  const primaryCreditorPaymentColumns: Column<(typeof client.paymentsToPrimaryCreditor)[0]>[] = [
    { key: 'loanNumber', header: t('pages.clients.detail.tableHeaders.loanNumber'), align: 'left' },
    {
      key: 'counterparty',
      header: t('pages.clients.detail.tableHeaders.counterparty'),
      align: 'left',
    },
    { key: 'saleDate', header: t('pages.clients.detail.tableHeaders.saleDate'), align: 'left' },
    {
      key: 'paymentDate',
      header: t('pages.clients.detail.tableHeaders.paymentDate'),
      align: 'left',
    },
    {
      key: 'amount',
      header: t('pages.clients.detail.tableHeaders.amount'),
      align: 'right',
      render: (payment) => `₴ ${formatCurrency(payment.amount)}`,
    },
    {
      key: 'distributionMethod',
      header: t('pages.clients.detail.tableHeaders.writeOffMethod'),
      align: 'left',
    },
  ]

  const operatorColumns: Column<(typeof client.operators)[0]>[] = [
    {
      key: 'date',
      header: t('pages.clients.detail.tableHeaders.date'),
      align: 'left',
    },
    {
      key: 'whoAppointed',
      header: t('pages.clients.detail.tableHeaders.whoAppointed'),
      align: 'left',
    },
    {
      key: 'whoIsResponsible',
      header: t('pages.clients.detail.tableHeaders.whoIsResponsible'),
      align: 'left',
    },
    {
      key: 'note',
      header: t('pages.clients.detail.tableHeaders.note'),
      align: 'left',
    },
  ]

  const searcherColumns: Column<(typeof client.searchers)[0]>[] = [
    {
      key: 'date',
      header: t('pages.clients.detail.tableHeaders.date'),
      align: 'left',
    },
    {
      key: 'whoAppointed',
      header: t('pages.clients.detail.tableHeaders.whoAppointed'),
      align: 'left',
    },
    {
      key: 'whoIsResponsible',
      header: t('pages.clients.detail.tableHeaders.whoIsResponsible'),
      align: 'left',
    },
    {
      key: 'note',
      header: t('pages.clients.detail.tableHeaders.note'),
      align: 'left',
    },
  ]

  const taskColumns: Column<(typeof client.tasks)[0]>[] = [
    {
      key: 'creationDate',
      header: t('pages.clients.detail.tableHeaders.creationDate'),
      align: 'left',
    },
    { key: 'whoCreated', header: t('pages.clients.detail.tableHeaders.whoCreated'), align: 'left' },
    {
      key: 'description',
      header: t('pages.clients.detail.tableHeaders.description'),
      align: 'left',
    },
    {
      key: 'reminderDate',
      header: t('pages.clients.detail.tableHeaders.dateOfReminder'),
      align: 'left',
    },
    {
      key: 'reminderRecipient',
      header: t('pages.clients.detail.tableHeaders.whoWillReceiveReminder'),
      align: 'left',
    },
  ]

  const documentColumns: Column<(typeof client.documents)[0]>[] = [
    { key: 'name', header: t('pages.clients.detail.tableHeaders.documentName'), align: 'left' },
    { key: 'type', header: t('pages.clients.detail.tableHeaders.documentType'), align: 'left' },
    { key: 'uploadDate', header: t('pages.clients.detail.tableHeaders.uploadDate'), align: 'left' },
    { key: 'size', header: t('pages.clients.detail.tableHeaders.documentSize'), align: 'left' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Client Header */}
      <div className="flex flex-col gap-4 self-stretch xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-row items-center gap-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex h-6 w-6 shrink-0 items-center justify-center"
            >
              <Icons.ArrowLeft02 size={24} className="text-secondary-800" strokeWidth={1.5} />
            </button>
            <h1 className="text-dark-500 truncate text-xl leading-[150%] font-light md:text-2xl">
              {client.fullName}
            </h1>
          </div>
          <div className="flex flex-row items-center gap-2">
            <span className="text-dark-500 flex items-center rounded-[16px] bg-white/10 px-3 py-0 text-sm">
              {client.score} {t('pages.clients.activity.score')}
            </span>
            <PriorityBadge priority={client.priority as Priority} />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 md:gap-3 xl:flex-nowrap">
          <Button
            size="md"
            variant="outline"
            className="flex w-full flex-1 flex-row rounded-full text-xs font-medium md:text-sm xl:w-auto xl:flex-none"
            onClick={() => navigate(`/dashboard/clients/${id}/debt-summary`)}
          >
            {t('pages.clients.debtSummary.title')}
          </Button>
          <Button
            size="md"
            variant="outline"
            leftIcon={<Icons.PencilEdit size={20} />}
            className="flex w-full flex-1 flex-row rounded-full text-xs font-medium md:text-sm xl:w-auto xl:flex-none"
            onClick={() => setIsNoteModalOpen(true)}
          >
            {t('pages.clients.activity.addNote')}
          </Button>
          <Button
            size="md"
            variant="outline"
            leftIcon={<Icons.Clock01 size={20} />}
            className="flex w-full flex-1 flex-row rounded-full text-xs font-medium md:text-sm xl:w-auto xl:flex-none"
            onClick={() => setIsTaskModalOpen(true)}
          >
            {t('pages.clients.tasks.addTask', 'Add Task')}
          </Button>
          <Button
            size="md"
            leftIcon={<Icons.Headset size={20} />}
            className="w-full flex-1 rounded-full xl:w-auto xl:flex-none"
            disabled={!user?.asterisk_extension}
            onClick={() => {
              const phoneNumber = client.phones?.[0]?.number
              if (!phoneNumber) {
                toast.error('Client has no phone number')
                return
              }

              if (isCallActive()) {
                toast.warning(
                  t('pages.clients.modals.callDialog.callInProgress') ||
                    'Another call or recording is already in progress. Please finish or close it first.'
                )
                return
              }

              // Open modal in 'initial' state to let user select call type
              setSelectedPhoneForCall(phoneNumber)
              setOpenCallModal('call-dialog')
              setIsCallModalOpen(true)
            }}
          >
            {t('pages.clients.activity.call')}
          </Button>
          <Button
            size="md"
            variant="primary"
            leftIcon={<Icons.PencilEdit size={20} />}
            className="w-full flex-1 rounded-full xl:w-auto xl:flex-none"
            onClick={() => setIsEditModalOpen(true)}
          >
            {t('pages.clients.activity.editClient')}
          </Button>
          {/* {canDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="text-dark-500 flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white transition-colors hover:bg-gray-100"
                  aria-label="More actions"
                >
                  <Icons.FilterVertical size={18} strokeWidth={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-white">
                <DropdownMenuItem
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="flex cursor-pointer items-center gap-2 text-sm text-red-600 hover:text-red-700"
                >
                  <Icons.Delete size={16} strokeWidth={1.5} />
                  <span>{t('pages.clients.activity.deleteClient')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )} */}
        </div>
      </div>
      <div className="flex flex-col items-start gap-4 self-stretch xl:flex-row xl:gap-5">
        {/* Client Card */}
        <div className="flex min-h-[44px] w-full flex-col items-start justify-center gap-0 rounded-lg bg-white/50 p-0 xl:w-[30%]">
          {/* Credit Details (top part of card) */}
          <div className="flex flex-col items-start gap-3 self-stretch px-4 py-4 md:px-6 md:py-5">
            <div className="flex flex-col gap-2 self-stretch">
              <div className="flex items-center justify-between gap-2 self-stretch">
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  {clientTags && clientTags.length > 0 ? (
                    clientTags.map((tag) => (
                      <TagBadge key={tag.id} name={tag.name} color={tag.color} size="sm" />
                    ))
                  ) : (
                    <span className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                      {t('pages.clients.detail.noTagsAssigned')}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setIsTagModalOpen(true)}
                  className="shrink-0 text-gray-500 transition-colors hover:text-gray-700"
                  title="Manage tags"
                  type="button"
                >
                  <Icons.PencilEdit02 size={16} strokeWidth={1.5} />
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1 self-stretch">
              <div className="flex min-h-8 items-center self-stretch p-0">
                <label className="flex-1 text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                  {t('pages.clients.detail.department')}
                </label>
                <p className="text-dark-500 ml-2 flex-1 truncate text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                  {client.department || '-'}
                </p>
              </div>
              <div className="flex min-h-8 items-center self-stretch p-0">
                <label className="flex-1 text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                  {t('pages.clients.filters.responsibleEmployee')}
                </label>
                <div className="ml-2 flex flex-1 items-center justify-end gap-1">
                  {profile?.responsible_employee_id && (
                    <p className="text-dark-500 truncate text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.responsibleEmployee}
                    </p>
                  )}
                  <button
                    onClick={() => setAssignRoleModalMode('employee')}
                    className="shrink-0 text-gray-400 transition-colors hover:text-gray-700"
                    title="Assign employee"
                    type="button"
                  >
                    <Icons.PencilEdit02 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
              <div className="flex min-h-8 items-center self-stretch p-0">
                <label className="flex-1 text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                  {t('pages.clients.filters.responsibleSearcher')}
                </label>
                <div className="ml-2 flex flex-1 items-center justify-end gap-1">
                  {profile?.responsible_searcher_id && (
                    <p className="text-dark-500 truncate text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.responsibleResearcher}
                    </p>
                  )}
                  <button
                    onClick={() => setAssignRoleModalMode('searcher')}
                    className="shrink-0 text-gray-400 transition-colors hover:text-gray-700"
                    title="Assign searcher"
                    type="button"
                  >
                    <Icons.PencilEdit02 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-row items-center justify-between gap-2 self-stretch p-0">
              <div className="flex flex-1 shrink-0 items-center gap-2.5">
                <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                  {t('pages.clients.detail.phones')}
                </label>
              </div>
              <div className="flex w-full flex-1 flex-col items-start justify-center gap-2">
                {client.phones.map((phone, index) => (
                  <div key={index} className="flex items-center gap-2 self-stretch md:gap-3">
                    <span className="text-dark-500 flex-1 truncate text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {phone.number}
                    </span>
                    <div className="flex shrink-0 items-center gap-1 md:gap-2">
                      <button
                        onClick={() => {
                          if (isCallActive()) {
                            toast.warning(
                              t('pages.clients.modals.callDialog.callInProgress') ||
                                'Another call or recording is already in progress. Please finish or close it first.'
                            )
                            return
                          }
                          setSelectedPhoneForCall(phone.number)
                          setOpenCallModal('call-dialog')
                          setIsCallModalOpen(true)
                        }}
                        className="text-primary-500 flex h-[24px] w-[24px] cursor-pointer items-center justify-center hover:opacity-80 md:h-[20px] md:w-[20px]"
                      >
                        <Icons.Headset size={16} className="flex-shrink-0" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPhoneForSMS(phone.number)
                          setIsSendSMSModalOpen(true)
                        }}
                        className="text-primary-500 flex h-[24px] w-[24px] cursor-pointer items-center justify-center hover:opacity-80 md:h-[20px] md:w-[20px]"
                      >
                        <Icons.ChatFeedback01 size={16} className="flex-shrink-0" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPhoneForNote(phone.number)
                          setIsNoteModalOpen(true)
                        }}
                        className="text-primary-500 flex h-[24px] w-[24px] cursor-pointer items-center justify-center hover:opacity-80 md:h-[20px] md:w-[20px]"
                      >
                        <Icons.PencilEdit size={16} className="flex-shrink-0" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mx-2 flex h-px flex-col items-start gap-2.5 self-stretch bg-gray-200 p-0"></div>

          {/* Personal & Contact Details - 4 left tabs inside client card */}
          <div className="flex flex-col items-start gap-4 self-stretch pr-0 md:flex-row md:items-center md:gap-6 md:pr-6">
            {/* Vertical tab icons - horizontal scroll on mobile */}
            <div className="relative flex min-h-[44px] w-full items-start gap-1 self-stretch rounded-bl-lg border-gray-200 p-4 md:my-2.5 md:w-auto md:flex-col md:border-r-1 md:border-b md:border-b-0 md:px-2.5 md:pb-0">
              {/* Left Arrow Button - only show on mobile when scrolling */}
              {showClientCardLeftArrow && (
                <button
                  onClick={() => scrollClientCardTabs('left')}
                  className="absolute top-0 left-0 z-10 flex h-full w-10 items-center justify-center bg-gradient-to-r from-white via-white/95 to-transparent shadow-sm transition-opacity hover:opacity-100 md:hidden"
                  aria-label="Scroll tabs left"
                  type="button"
                >
                  <Icons.ArrowLeft size={20} className="text-secondary-800" />
                </button>
              )}

              {/* Right Arrow Button - only show on mobile when scrolling */}
              {showClientCardRightArrow && (
                <button
                  onClick={() => scrollClientCardTabs('right')}
                  className="absolute top-0 right-0 z-10 flex h-full w-10 items-center justify-center bg-gradient-to-l from-white via-white/95 to-transparent shadow-sm transition-opacity hover:opacity-100 md:hidden"
                  aria-label="Scroll tabs right"
                  type="button"
                >
                  <Icons.ArrowRight size={20} className="text-secondary-800" />
                </button>
              )}

              {/* Tab Container */}
              <div
                ref={clientCardTabContainerRef}
                className="scrollbar-hide flex w-full items-start gap-1 self-stretch overflow-x-auto md:w-auto md:flex-col md:overflow-x-visible"
                style={{
                  scrollbarWidth: 'none', // Firefox
                  msOverflowStyle: 'none', // IE/Edge
                }}
              >
                <button
                  type="button"
                  data-tab="personal"
                  onClick={() => setActiveClientCardTab('personal')}
                  title={t('pages.clients.detail.tabs.personal')}
                  className={cn(
                    'md:hover:bg-primary-200/10 hover:bg-secondary-800/20 flex shrink-0 cursor-pointer flex-row items-center justify-center self-stretch rounded-md p-2 md:justify-start md:rounded-none md:border-b-0 md:border-l-2 md:p-2.5',
                    activeClientCardTab === 'personal'
                      ? 'md:border-primary-300 md:bg-primary-200/10 bg-secondary-800/10'
                      : 'md:border-transparent'
                  )}
                >
                  <Icons.UserAccount
                    size={24}
                    className={cn(
                      'shrink-0',
                      activeClientCardTab === 'personal' ? 'text-secondary-800' : 'text-gray-700'
                    )}
                  />
                </button>
                <button
                  type="button"
                  data-tab="work"
                  onClick={() => setActiveClientCardTab('work')}
                  title={t('pages.clients.detail.tabs.work')}
                  className={cn(
                    'md:hover:bg-primary-200/10 hover:bg-secondary-800/20 flex shrink-0 cursor-pointer flex-row items-center justify-center self-stretch rounded-md p-2 md:justify-start md:rounded-none md:border-b-0 md:border-l-2 md:p-2.5',
                    activeClientCardTab === 'work'
                      ? 'md:border-primary-300 md:bg-primary-200/10 bg-secondary-800/10'
                      : 'md:border-transparent'
                  )}
                >
                  <Icons.Briefcase01
                    size={24}
                    className={cn(
                      'shrink-0',
                      activeClientCardTab === 'work' ? 'text-secondary-800' : 'text-gray-700'
                    )}
                  />
                </button>
                <button
                  type="button"
                  data-tab="recommenders"
                  onClick={() => setActiveClientCardTab('recommenders')}
                  title={t('pages.clients.detail.tabs.recommenders')}
                  className={cn(
                    'md:hover:bg-primary-200/10 hover:bg-secondary-800/20 flex shrink-0 cursor-pointer flex-row items-center justify-center self-stretch rounded-md p-2 md:justify-start md:rounded-none md:border-b-0 md:border-l-2 md:p-2.5',
                    activeClientCardTab === 'recommenders'
                      ? 'md:border-primary-300 md:bg-primary-200/10 bg-secondary-800/10'
                      : 'md:border-transparent'
                  )}
                >
                  <Icons.UserCheck01
                    size={24}
                    className={cn(
                      'shrink-0',
                      activeClientCardTab === 'recommenders'
                        ? 'text-secondary-800'
                        : 'text-gray-700'
                    )}
                  />
                </button>
                <button
                  type="button"
                  data-tab="addresses"
                  onClick={() => setActiveClientCardTab('addresses')}
                  title={t('pages.clients.detail.tabs.addresses')}
                  className={cn(
                    'md:hover:bg-primary-200/10 hover:bg-secondary-800/20 flex shrink-0 cursor-pointer flex-row items-center justify-center self-stretch rounded-md p-2 md:justify-start md:rounded-none md:border-b-0 md:border-l-2 md:p-2.5',
                    activeClientCardTab === 'addresses'
                      ? 'md:border-primary-300 md:bg-primary-200/10 bg-secondary-800/10'
                      : 'md:border-transparent'
                  )}
                >
                  <Icons.Location01
                    size={24}
                    className={cn(
                      'shrink-0',
                      activeClientCardTab === 'addresses' ? 'text-secondary-800' : 'text-gray-700'
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Right side content for selected client card tab */}
            <div className="flex w-full flex-col items-center gap-6 self-stretch px-4 py-4 md:px-0">
              {activeClientCardTab === 'personal' && (
                <>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.tin')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.tin}
                    </p>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.dateOfBirth')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.dateOfBirth}
                    </p>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.age')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.age}
                    </p>
                  </div>
                  <div className="mx-2 h-px self-stretch bg-gray-200"></div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.documentType')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.documentType}
                    </p>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.passportSeries')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.passportSeries}
                    </p>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.passportNumber')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.passportNumber}
                    </p>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.issuedBy')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.issuedBy}
                    </p>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.issuedDate')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.issuedDate}
                    </p>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.expiresDate')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.expiresDate}
                    </p>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.gender')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.gender}
                    </p>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.recordNumber')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.recordNumber}
                    </p>
                  </div>
                  <div className="mx-2 h-px self-stretch bg-gray-200"></div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.maritalStatus')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.maritalStatus}
                    </p>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.numberOfFamilyMembers')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.familyMembers}
                    </p>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.incomeLevel')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.personalDetails.incomeLevel}
                    </p>
                  </div>
                </>
              )}

              {activeClientCardTab === 'recommenders' && (
                <>
                  {client.recommenders.map((friend, index) => (
                    <React.Fragment key={friend.id}>
                      <div className="flex items-center self-stretch p-0">
                        <div className="flex flex-1 items-center gap-2.5">
                          <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                            {t('pages.clients.detail.fullName')}
                          </label>
                        </div>
                        <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                          {friend.fullName}
                        </p>
                      </div>
                      <div className="flex items-center self-stretch p-0">
                        <div className="flex flex-1 items-center gap-2.5">
                          <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                            {t('pages.clients.editModal.contactType')}
                          </label>
                        </div>
                        <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                          {friend.contactType}
                        </p>
                      </div>
                      <div className="flex items-center self-stretch p-0">
                        <div className="flex flex-1 items-center gap-2.5">
                          <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                            {t('pages.clients.detail.relationshipTo')}
                          </label>
                        </div>
                        <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                          {friend.relationship}
                        </p>
                      </div>
                      <div className="flex items-center self-stretch p-0">
                        <div className="flex flex-1 items-center gap-2.5">
                          <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                            {t('pages.clients.detail.phoneNumber')}
                          </label>
                        </div>
                        <div className="flex flex-1 items-center justify-end gap-2 md:gap-3">
                          <span className="text-dark-500 truncate text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                            {friend.phoneNumber}
                          </span>
                          {friend.phoneNumber && (
                            <div className="flex shrink-0 items-center gap-1 md:gap-2">
                              <button
                                onClick={() => {
                                  if (isCallActive()) {
                                    toast.warning(
                                      t('pages.clients.modals.callDialog.callInProgress') ||
                                        'Another call or recording is already in progress. Please finish or close it first.'
                                    )
                                    return
                                  }
                                  setSelectedPhoneForCall(friend.phoneNumber)
                                  setOpenCallModal('call-dialog')
                                  setIsCallModalOpen(true)
                                }}
                                className="text-primary-500 flex h-[24px] w-[24px] cursor-pointer items-center justify-center hover:opacity-80 md:h-[20px] md:w-[20px]"
                              >
                                <Icons.Headset size={16} className="flex-shrink-0" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPhoneForSMS(friend.phoneNumber)
                                  setIsSendSMSModalOpen(true)
                                }}
                                className="text-primary-500 flex h-[24px] w-[24px] cursor-pointer items-center justify-center hover:opacity-80 md:h-[20px] md:w-[20px]"
                              >
                                <Icons.ChatFeedback01 size={16} className="flex-shrink-0" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedPhoneForNote(friend.phoneNumber)
                                  setIsNoteModalOpen(true)
                                }}
                                className="text-primary-500 flex h-[24px] w-[24px] cursor-pointer items-center justify-center hover:opacity-80 md:h-[20px] md:w-[20px]"
                              >
                                <Icons.PencilEdit size={16} className="flex-shrink-0" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start self-stretch p-0">
                        <div className="flex flex-1 items-center gap-2.5">
                          <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                            {t('pages.clients.detail.comment')}
                          </label>
                        </div>
                        <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                          {friend.comment}
                        </p>
                      </div>
                      {index < client.recommenders.length - 1 && (
                        <div className="mx-2 h-px self-stretch bg-gray-200"></div>
                      )}
                    </React.Fragment>
                  ))}
                </>
              )}

              {activeClientCardTab === 'addresses' && (
                <>
                  {client.addresses.map((addr, index) => (
                    <React.Fragment key={addr.id}>
                      <div className="flex items-start self-stretch p-0">
                        <div className="flex flex-1 items-center gap-2.5">
                          <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                            {addr.type}
                          </label>
                        </div>
                        <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                          {addr.fullAddress}
                        </p>
                      </div>
                      {index < client.addresses.length - 1 && (
                        <div className="mx-2 h-px self-stretch bg-gray-200"></div>
                      )}
                    </React.Fragment>
                  ))}
                </>
              )}

              {activeClientCardTab === 'work' && (
                <>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.organizationName')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.work?.organizationName || '-'}
                    </p>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.position')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.work?.position || '-'}
                    </p>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.experience')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.work?.experience || '-'}
                    </p>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.managerFullName')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.work?.managerFullName || '-'}
                    </p>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.employmentType')}
                      </label>
                    </div>
                    <p className="text-dark-500 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                      {client.work?.employmentType || '-'}
                    </p>
                  </div>
                  <div className="flex items-center self-stretch p-0">
                    <div className="flex flex-1 items-center gap-2.5">
                      <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.editModal.workPhone')}
                      </label>
                    </div>
                    <div className="flex flex-1 items-center justify-end gap-2 md:gap-3">
                      <span className="text-dark-500 truncate text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                        {client.work?.workPhone || '-'}
                      </span>
                      {client.work?.workPhone && client.work.workPhone !== '-' && (
                        <div className="flex shrink-0 items-center gap-1 md:gap-2">
                          <button
                            onClick={() => {
                              if (isCallActive()) {
                                toast.warning(
                                  t('pages.clients.modals.callDialog.callInProgress') ||
                                    'Another call or recording is already in progress. Please finish or close it first.'
                                )
                                return
                              }
                              setSelectedPhoneForCall(client.work?.workPhone || '')
                              setOpenCallModal('call-dialog')
                              setIsCallModalOpen(true)
                            }}
                            className="text-primary-500 flex h-[24px] w-[24px] cursor-pointer items-center justify-center hover:opacity-80 md:h-[20px] md:w-[20px]"
                          >
                            <Icons.Headset size={16} className="flex-shrink-0" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPhoneForSMS(client.work?.workPhone || '')
                              setIsSendSMSModalOpen(true)
                            }}
                            className="text-primary-500 flex h-[24px] w-[24px] cursor-pointer items-center justify-center hover:opacity-80 md:h-[20px] md:w-[20px]"
                          >
                            <Icons.ChatFeedback01 size={16} className="flex-shrink-0" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPhoneForNote(client.work?.workPhone || '')
                              setIsNoteModalOpen(true)
                            }}
                            className="text-primary-500 flex h-[24px] w-[24px] cursor-pointer items-center justify-center hover:opacity-80 md:h-[20px] md:w-[20px]"
                          >
                            <Icons.PencilEdit size={16} className="flex-shrink-0" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Data + Comments Card with 6 horizontal top tabs */}
        <div className="flex w-full flex-1 flex-col items-start gap-5 self-stretch xl:w-[64%]">
          <div className="flex flex-1 flex-col items-start gap-0 self-stretch rounded-lg bg-white/50 p-0">
            {/* Horizontal tab bar - 6 tabs at the top - scrollable on mobile */}
            <div className="relative mx-3 flex items-center gap-0 self-stretch border-b border-gray-200">
              {/* Left Arrow Button */}
              {showLeftArrow && (
                <button
                  onClick={() => scrollTabs('left')}
                  className="absolute top-0 left-0 z-10 flex h-full w-10 items-center justify-center bg-gradient-to-r from-white via-white/95 to-transparent shadow-sm transition-opacity hover:opacity-100"
                  aria-label="Scroll tabs left"
                  type="button"
                >
                  <Icons.ArrowLeft size={20} className="text-secondary-800" />
                </button>
              )}

              {/* Right Arrow Button */}
              {showRightArrow && (
                <button
                  onClick={() => scrollTabs('right')}
                  className="absolute top-0 right-0 z-10 flex h-full w-10 items-center justify-center bg-gradient-to-l from-white via-white/95 to-transparent shadow-sm transition-opacity hover:opacity-100"
                  aria-label="Scroll tabs right"
                  type="button"
                >
                  <Icons.ArrowRight size={20} className="text-secondary-800" />
                </button>
              )}

              {/* Tab Container */}
              <div
                ref={tabContainerRef}
                className="scrollbar-hide flex items-center gap-0 self-stretch overflow-x-auto"
                style={{
                  scrollbarWidth: 'none', // Firefox
                  msOverflowStyle: 'none', // IE/Edge
                }}
              >
                {/* Tab 1: Loans */}
                <button
                  type="button"
                  data-tab="loans"
                  onClick={() => setActiveRightCardTab('loans')}
                  className={cn(
                    'hover:bg-primary-200/10 flex shrink-0 cursor-pointer items-center justify-center gap-2 border-b-2 px-3 py-4 transition-colors md:px-4',
                    activeRightCardTab === 'loans'
                      ? 'border-primary-300 text-secondary-800 bg-primary-300/10'
                      : 'hover:text-secondary-800 border-transparent text-gray-600'
                  )}
                >
                  <Icons.Folder size={20} className="shrink-0 text-current" />
                  <span className="text-xs font-medium whitespace-nowrap md:text-sm">
                    {t('pages.clients.detail.tabs.loans')}
                  </span>
                </button>
                {/* Tab 2: Payments */}
                <button
                  type="button"
                  data-tab="payments"
                  onClick={() => setActiveRightCardTab('payments')}
                  className={cn(
                    'hover:bg-primary-200/10 flex shrink-0 cursor-pointer items-center justify-center gap-2 border-b-2 px-3 py-4 transition-colors md:px-4',
                    activeRightCardTab === 'payments'
                      ? 'border-primary-300 text-secondary-800 bg-primary-300/10'
                      : 'hover:text-secondary-800 border-transparent text-gray-600'
                  )}
                >
                  <Icons.Wallet01 size={20} className="shrink-0 text-current" />
                  <span className="text-xs font-medium whitespace-nowrap md:text-sm">
                    {t('pages.clients.detail.payments')}
                  </span>
                </button>
                {/* Tab 3: Operators */}
                <button
                  type="button"
                  data-tab="operators"
                  onClick={() => setActiveRightCardTab('operators')}
                  className={cn(
                    'hover:bg-primary-200/10 flex shrink-0 cursor-pointer items-center justify-center gap-2 border-b-2 px-3 py-4 transition-colors md:px-4',
                    activeRightCardTab === 'operators'
                      ? 'border-primary-300 text-secondary-800 bg-primary-300/10'
                      : 'hover:text-secondary-800 border-transparent text-gray-600'
                  )}
                >
                  <Icons.UserMultiple02 size={20} className="shrink-0 text-current" />
                  <span className="text-xs font-medium whitespace-nowrap md:text-sm">
                    {t('pages.clients.detail.operators')}
                  </span>
                </button>
                {/* Tab 4: Call/SMS */}
                <button
                  type="button"
                  data-tab="call-sms-history"
                  onClick={() => setActiveRightCardTab('call-sms-history')}
                  className={cn(
                    'hover:bg-primary-200/10 flex shrink-0 cursor-pointer items-center justify-center gap-2 border-b-2 px-3 py-4 transition-colors md:px-4',
                    activeRightCardTab === 'call-sms-history'
                      ? 'border-primary-300 text-secondary-800 bg-primary-300/10'
                      : 'hover:text-secondary-800 border-transparent text-gray-600'
                  )}
                >
                  <Icons.Clock01 size={20} className="shrink-0 text-current" />
                  <span className="text-xs font-medium whitespace-nowrap md:text-sm">
                    {t('pages.clients.detail.tabs.callSms')}
                  </span>
                </button>
                {/* Tab 5: Tasks */}
                <button
                  type="button"
                  data-tab="tasks"
                  onClick={() => setActiveRightCardTab('tasks')}
                  className={cn(
                    'hover:bg-primary-200/10 flex shrink-0 cursor-pointer items-center justify-center gap-2 border-b-2 px-3 py-4 transition-colors md:px-4',
                    activeRightCardTab === 'tasks'
                      ? 'border-primary-300 text-secondary-800 bg-primary-300/10'
                      : 'hover:text-secondary-800 border-transparent text-gray-600'
                  )}
                >
                  <Icons.CheckmarkSquare03 size={20} className="shrink-0 text-current" />
                  <span className="text-xs font-medium whitespace-nowrap md:text-sm">
                    {t('pages.clients.detail.tabs.tasks')}
                  </span>
                </button>
                {/* Tab 6: Docs */}
                <button
                  type="button"
                  data-tab="documents"
                  onClick={() => setActiveRightCardTab('documents')}
                  className={cn(
                    'hover:bg-primary-200/10 flex shrink-0 cursor-pointer items-center justify-center gap-2 border-b-2 px-3 py-4 transition-colors md:px-4',
                    activeRightCardTab === 'documents'
                      ? 'border-primary-300 text-secondary-800 bg-primary-300/10'
                      : 'hover:text-secondary-800 border-transparent text-gray-600'
                  )}
                >
                  <Icons.File size={20} className="shrink-0 text-current" />
                  <span className="text-xs font-medium whitespace-nowrap md:text-sm">
                    {t('pages.clients.detail.tabs.docs')}
                  </span>
                </button>
              </div>
            </div>

            {/* Content area for selected tab */}
            <div className="flex w-full flex-col items-start gap-0 self-stretch p-0">
              {/* Tab 1: Loans */}
              {activeRightCardTab === 'loans' && (
                <div className="flex w-full flex-col gap-0">
                  {/* Secondary filters below primary tabs */}
                  <div className="mx-3 flex flex-col items-center gap-3 self-stretch overflow-x-auto pt-4 pb-0 sm:flex-row md:mx-6 md:gap-6 md:pt-6">
                    <button
                      onClick={() => setActiveLoanTab('process')}
                      className={cn(
                        'hover:bg-secondary-800/20 flex w-full shrink-0 cursor-pointer items-center justify-center gap-2.5 rounded-md p-2 text-xs font-medium tracking-[-0.28px] sm:w-auto md:p-3',
                        activeLoanTab === 'process'
                          ? 'bg-secondary-800/10 text-secondary-800'
                          : 'hover:text-secondary-800 text-gray-600'
                      )}
                    >
                      {t('pages.clients.detail.loansInProcess')}
                    </button>
                    <button
                      onClick={() => setActiveLoanTab('closed')}
                      className={cn(
                        'hover:bg-secondary-800/20 flex w-full shrink-0 cursor-pointer items-center justify-center gap-2.5 rounded-md p-2 text-xs font-medium tracking-[-0.28px] sm:w-auto md:p-3',
                        activeLoanTab === 'closed'
                          ? 'bg-secondary-800/10 text-secondary-800'
                          : 'hover:text-secondary-800 text-gray-600'
                      )}
                    >
                      {t('pages.clients.detail.closedLoans')}
                    </button>
                    <button
                      onClick={() => setActiveLoanTab('rr')}
                      className={cn(
                        'hover:bg-secondary-800/20 flex w-full shrink-0 cursor-pointer items-center justify-center gap-2.5 rounded-md p-2 text-xs font-medium tracking-[-0.28px] sm:w-auto md:p-3',
                        activeLoanTab === 'rr'
                          ? 'bg-secondary-800/10 text-secondary-800'
                          : 'hover:text-secondary-800 text-gray-600'
                      )}
                    >
                      {t('pages.clients.detail.loansOnRR')}
                    </button>
                  </div>
                  {/* Data table filtered by sub-tab */}
                  <div className="flex flex-col items-start gap-2.5 self-stretch px-3 py-4 md:px-6">
                    {activeLoanTab === 'rr' ? (
                      isRrLoading ? (
                        <TableSkeleton columns={7} rows={3} />
                      ) : (
                        <DataTable
                          columns={rrColumns}
                          data={restructuringAgreements}
                          className="w-full"
                        />
                      )
                    ) : isLoansLoading ? (
                      <TableSkeleton columns={7} rows={3} />
                    ) : (
                      <DataTable
                        columns={loanColumns}
                        data={client.loans.filter((loan) => {
                          if (activeLoanTab === 'process') return loan.status === 'active'
                          if (activeLoanTab === 'closed') return loan.status === 'closed'
                          return true
                        })}
                        className="w-full"
                      />
                    )}
                  </div>
                  {/* Action buttons at the bottom */}
                  <div className="flex flex-wrap items-center gap-2 self-stretch px-3 py-4 md:gap-3 md:px-6">
                    <Button
                      variant="secondary"
                      leftIcon={<Icons.MoneyRemove01 size={20} />}
                      className="rounded text-xs md:text-sm"
                      size="sm"
                    >
                      {t('pages.clients.detail.writeOff')}
                    </Button>
                    <Button
                      variant="secondary"
                      leftIcon={<Icons.MoneyNotFound04 size={20} />}
                      className="rounded text-xs md:text-sm"
                      size="sm"
                    >
                      {t('pages.clients.detail.reversal')}
                    </Button>
                    <Button
                      variant="secondary"
                      leftIcon={<Icons.CancelCircle size={20} />}
                      className="rounded text-xs md:text-sm"
                      size="sm"
                    >
                      {t('pages.clients.detail.closeLoan')}
                    </Button>
                    <Button
                      variant="secondary"
                      leftIcon={<Icons.MailSend01 size={20} />}
                      className="rounded text-xs md:text-sm"
                      size="sm"
                    >
                      {t('pages.clients.detail.sendToUBCI')}
                    </Button>
                    <Button
                      variant="secondary"
                      leftIcon={<Icons.Calculate size={20} />}
                      className="rounded text-xs md:text-sm"
                      size="sm"
                    >
                      {t('pages.clients.detail.rrCalculator')}
                    </Button>
                    <Button
                      variant="secondary"
                      leftIcon={<Icons.PlusSignCircle size={20} />}
                      className="rounded text-xs md:text-sm"
                      size="sm"
                    >
                      {t('pages.clients.detail.makePayment')}
                    </Button>
                  </div>
                </div>
              )}

              {/* Tab 2: Payments */}
              {activeRightCardTab === 'payments' && (
                <div className="flex w-full flex-col gap-4">
                  <div className="mx-3 flex min-h-[44px] items-center gap-3 self-stretch overflow-x-auto pt-4 pb-0 md:mx-6 md:gap-6 md:pt-6">
                    <button
                      onClick={() => setActivePaymentTab('payments')}
                      className={cn(
                        'text-dark-500 flex shrink-0 cursor-pointer items-center justify-center gap-2.5 rounded-md p-2 text-xs leading-[150%] font-medium tracking-[-0.28px] md:p-3',
                        activePaymentTab === 'payments'
                          ? 'bg-secondary-800/10 text-secondary-800'
                          : 'hover:bg-secondary-800/20 hover:text-secondary-800 text-gray-600'
                      )}
                    >
                      {t('pages.clients.detail.payments')}
                    </button>
                    <button
                      onClick={() => setActivePaymentTab('writes-off')}
                      className={cn(
                        'text-dark-500 flex shrink-0 cursor-pointer items-center justify-center gap-2.5 rounded-md p-2 text-xs leading-[150%] font-medium tracking-[-0.28px] md:p-3',
                        activePaymentTab === 'writes-off'
                          ? 'bg-secondary-800/10 text-secondary-800'
                          : 'hover:bg-secondary-800/20 hover:text-secondary-800 text-gray-600'
                      )}
                    >
                      {t('pages.clients.detail.writesOff')}
                    </button>
                    <button
                      onClick={() => setActivePaymentTab('primary-creditor')}
                      className={cn(
                        'text-dark-500 flex shrink-0 cursor-pointer items-center justify-center gap-2.5 rounded-md p-2 text-xs leading-[150%] font-medium tracking-[-0.28px] md:p-3',
                        activePaymentTab === 'primary-creditor'
                          ? 'bg-secondary-800/10 text-secondary-800'
                          : 'hover:bg-secondary-800/20 hover:text-secondary-800 text-gray-600'
                      )}
                    >
                      {t('pages.clients.detail.paymentToPrimaryCreditor')}
                    </button>
                  </div>
                  <div className="flex flex-col items-start gap-2.5 self-stretch px-3 pb-4 md:px-6">
                    {isPaymentsLoading ? (
                      <TableSkeleton columns={7} rows={3} />
                    ) : (
                      <>
                        {activePaymentTab === 'payments' && (
                          <DataTable
                            columns={paymentColumns}
                            data={client.payments}
                            className="w-full"
                          />
                        )}
                        {activePaymentTab === 'writes-off' && (
                          <DataTable
                            columns={writeOffColumns}
                            data={client.writesOffs}
                            className="w-full"
                          />
                        )}
                        {activePaymentTab === 'primary-creditor' && (
                          <DataTable
                            columns={primaryCreditorPaymentColumns}
                            data={client.paymentsToPrimaryCreditor}
                            className="w-full"
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Operators/Searchers */}
              {activeRightCardTab === 'operators' && (
                <div className="flex w-full flex-col gap-4">
                  <div className="mx-3 flex min-h-[44px] items-center gap-3 self-stretch overflow-x-auto pt-4 pb-0 md:mx-6 md:gap-6 md:pt-6">
                    <button
                      onClick={() => setActiveOperatorTab('operators')}
                      className={cn(
                        'flex shrink-0 cursor-pointer items-center justify-center gap-2.5 rounded-md p-2 text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-600 md:p-3',
                        activeOperatorTab === 'operators'
                          ? 'bg-secondary-800/10 text-secondary-800'
                          : 'hover:bg-secondary-800/20 hover:text-secondary-800'
                      )}
                    >
                      {t('pages.clients.detail.operators')}
                    </button>
                    <button
                      onClick={() => setActiveOperatorTab('searchers')}
                      className={cn(
                        'flex shrink-0 cursor-pointer items-center justify-center gap-2.5 rounded-md p-2 text-xs leading-[150%] font-medium tracking-[-0.28px] text-gray-600 md:p-3',
                        activeOperatorTab === 'searchers'
                          ? 'bg-secondary-800/10 text-secondary-800'
                          : 'hover:bg-secondary-800/20 hover:text-secondary-800'
                      )}
                    >
                      {t('pages.clients.detail.searchers')}
                    </button>
                  </div>
                  <div className="flex flex-col items-start gap-2.5 self-stretch px-3 pb-4 md:px-6">
                    {isOperatorsLoading ? (
                      <TableSkeleton columns={5} rows={3} />
                    ) : (
                      <>
                        {activeOperatorTab === 'operators' && (
                          <DataTable
                            columns={operatorColumns}
                            data={client.operators}
                            className="w-full"
                          />
                        )}
                        {activeOperatorTab === 'searchers' && (
                          <DataTable
                            columns={searcherColumns}
                            data={client.searchers}
                            className="w-full"
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 4: Call and SMS History */}
              {activeRightCardTab === 'call-sms-history' && (
                <div className="flex flex-1 flex-col items-start gap-4 self-stretch p-3 md:gap-5 md:p-6">
                  <div className="flex h-auto flex-col items-start gap-3 self-stretch p-0 md:h-[41px] md:flex-row md:items-center md:gap-5">
                    <div className="flex flex-1 items-center gap-2.5">
                      <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                        {activeCallSmsTab === 'calls'
                          ? t('pages.clients.detail.latestCalls')
                          : activeCallSmsTab === 'sms'
                            ? t('pages.clients.detail.latestSms')
                            : t('pages.clients.detail.latestCallsAndSms')}
                      </span>
                    </div>
                    <div className="flex w-full flex-1 items-center justify-between gap-1 rounded-lg bg-white/50 p-1 shadow-sm md:w-auto">
                      <button
                        onClick={() => setActiveCallSmsTab('all')}
                        className={cn(
                          'flex max-w-[120px] flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs transition-colors md:px-4 md:text-sm',
                          activeCallSmsTab === 'all'
                            ? 'bg-secondary-800/10 text-secondary-800'
                            : 'hover:text-secondary-800 hover:bg-secondary-800/20 cursor-pointer text-gray-600'
                        )}
                      >
                        {t('pages.clients.activity.all')}
                      </button>
                      <button
                        onClick={() => setActiveCallSmsTab('calls')}
                        className={cn(
                          'flex max-w-[120px] flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs transition-colors md:px-4 md:text-sm',
                          activeCallSmsTab === 'calls'
                            ? 'bg-secondary-800/10 text-secondary-800'
                            : 'hover:text-secondary-800 hover:bg-secondary-800/20 cursor-pointer text-gray-600'
                        )}
                      >
                        {t('pages.clients.activity.calls')}
                      </button>
                      <button
                        onClick={() => setActiveCallSmsTab('sms')}
                        className={cn(
                          'flex max-w-[120px] flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs transition-colors md:px-4 md:text-sm',
                          activeCallSmsTab === 'sms'
                            ? 'bg-secondary-800/10 text-secondary-800'
                            : 'hover:text-secondary-800 hover:bg-secondary-800/20 cursor-pointer text-gray-600'
                        )}
                      >
                        {t('pages.clients.activity.sms')}
                      </button>
                    </div>
                    <div className="flex w-full flex-1 flex-col items-start gap-2.5 md:w-auto md:flex-col md:items-end">
                      <Button
                        leftIcon={<Icons.Download size={20} />}
                        className="bg-secondary-800 flex w-full flex-row items-center gap-1 rounded px-3 py-2 text-xs leading-[140%] font-medium tracking-[-0.24px] text-white md:w-auto md:px-4 md:py-2.5"
                        size="sm"
                      >
                        {t('pages.clients.detail.exportCSV')}
                      </Button>
                    </div>
                  </div>
                  {isCallSmsLoading ? (
                    <div className="flex w-full flex-col gap-4">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-200" />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {activeCallSmsTab === 'all' && (
                        <div className="flex flex-col items-start gap-6 self-stretch">
                          {/* Date-grouped Calls and SMS */}
                          {(() => {
                            // Combine calls and SMS, group by date
                            const allItems = [
                              ...client.callSmsHistory.calls.map((item) => ({
                                ...item,
                                itemType: 'call' as const,
                              })),
                              ...client.callSmsHistory.sms.map((item) => ({
                                ...item,
                                itemType: 'sms' as const,
                              })),
                            ]

                            const grouped = allItems.reduce(
                              (acc, item) => {
                                // Use original UTC timestamp (sent_at for SMS, initiated_at for calls) instead of date string
                                const timestamp =
                                  item.itemType === 'sms'
                                    ? (item as unknown as ExtendedSMSItem & { itemType: 'sms' })
                                        .sent_at || item.date
                                    : (item as unknown as ExtendedCallItem & { itemType: 'call' })
                                        .initiated_at || item.date
                                const date = new Date(String(timestamp)).toLocaleDateString(
                                  'en-US',
                                  {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    timeZone: userTimezone || undefined,
                                  }
                                )
                                if (!acc[date]) acc[date] = { calls: [], sms: [] }
                                if (item.itemType === 'call') {
                                  acc[date].calls.push(
                                    item as unknown as ExtendedCallItem & { itemType: 'call' }
                                  )
                                } else {
                                  acc[date].sms.push(
                                    item as unknown as ExtendedSMSItem & { itemType: 'sms' }
                                  )
                                }
                                return acc
                              },
                              {} as Record<
                                string,
                                {
                                  calls: (ExtendedCallItem & { itemType: 'call' })[]
                                  sms: (ExtendedSMSItem & { itemType: 'sms' })[]
                                }
                              >
                            )

                            return Object.entries(grouped)
                              .sort(
                                ([a], [b]) =>
                                  new Date(b as string).getTime() - new Date(a as string).getTime()
                              )
                              .map(([date, items]) => (
                                <div key={date} className="w-full space-y-4">
                                  <h3 className="text-dark-500 text-sm font-semibold md:text-base">
                                    {date}
                                  </h3>
                                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                                    {/* Calls for this date */}
                                    {items.calls.map((call) => (
                                      <CallLogCard
                                        key={`call-${call.id}`}
                                        clientName={client.fullName}
                                        title={`${t('pages.clients.detail.play')} (${call.duration})`}
                                        time={call.time}
                                        date={call.date}
                                        duration={call.duration}
                                        status={call.status}
                                        type={call.type}
                                        phone={call.phone}
                                        line={call.line}
                                        operator={call.operator}
                                        call_id={
                                          'call_id' in call ? (call.call_id as string) : undefined
                                        }
                                        recording_path={
                                          'recording_path' in call
                                            ? (call.recording_path as string | null)
                                            : null
                                        }
                                        icon={
                                          <Icons.Play size={24} className="text-secondary-800" />
                                        }
                                        setSelectedCallData={setSelectedCallData}
                                        setIsCallRecordingModalOpen={setIsCallRecordingModalOpen}
                                      />
                                    ))}
                                    {/* SMS for this date */}
                                    {items.sms.map((sms) => (
                                      <CallLogCard
                                        key={`sms-${sms.id}`}
                                        clientName={client.fullName}
                                        title={t('pages.clients.detail.viewSms')}
                                        time={sms.time}
                                        date={sms.date}
                                        status={sms.status}
                                        template={sms.template}
                                        message={sms.message}
                                        operator={sms.operator}
                                        phone={sms.phone}
                                        sent_at={sms.sent_at}
                                        delivered_at={sms.delivered_at}
                                        icon={
                                          <Icons.Chat size={24} className="text-secondary-800" />
                                        }
                                        setSelectedSMSData={setSelectedSMSData}
                                        setIsViewSMSModalOpen={setIsViewSMSModalOpen}
                                      />
                                    ))}
                                  </div>
                                </div>
                              ))
                          })()}
                        </div>
                      )}
                      {activeCallSmsTab === 'calls' && (
                        <div className="flex flex-col items-start gap-4 self-stretch">
                          {/* Summary Statistics */}
                          <div className="flex h-auto w-full flex-col items-start gap-3 p-0 md:h-14 md:flex-row md:gap-5">
                            <div className="flex w-full flex-1 items-center justify-between rounded-xl border border-white bg-white/50 px-4 py-2 pl-3 md:w-auto md:px-5">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2.5 rounded-full bg-white p-2">
                                  <Icons.Call02 size={24} className="text-gray-700" />
                                </div>
                                <div className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                                  {t('pages.clients.detail.totalCalls')}
                                </div>
                              </div>
                              <div className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                                {client.callSmsHistory.calls.length}
                              </div>
                            </div>
                            <div className="flex w-full flex-1 items-center justify-between rounded-xl border border-white bg-white/50 px-4 py-2 pl-3 md:w-auto md:px-5">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2.5 rounded-full bg-white p-2">
                                  <Icons.CallDone02 size={24} className="text-gray-700" />
                                </div>
                                <div className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                                  {t('pages.clients.statuses.answered')}
                                </div>
                              </div>
                              <div className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                                {(() => {
                                  const answered = client.callSmsHistory.calls.filter(
                                    (c) => c.status === 'COMPLETED'
                                  ).length
                                  const total = client.callSmsHistory.calls.length
                                  const percentage =
                                    total > 0 ? Math.round((answered / total) * 100) : 0
                                  return `${answered} (${percentage}%)`
                                })()}
                              </div>
                            </div>
                            <div className="flex w-full flex-1 items-center justify-between rounded-xl border border-white bg-white/50 px-4 py-2 pl-3 md:w-auto md:px-5">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2.5 rounded-full bg-white p-2">
                                  <Icons.Clock01 size={24} className="text-gray-700" />
                                </div>
                                <div className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                                  {t('pages.clients.detail.avgDuration')}
                                </div>
                              </div>
                              <div className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                                {(() => {
                                  const durations = client.callSmsHistory.calls
                                    .filter((c) => c.duration && c.duration !== '-')
                                    .map((c) => {
                                      const match = c.duration?.match(/(\d+)m (\d+)s/)
                                      if (match) {
                                        return parseInt(match[1]) * 60 + parseInt(match[2])
                                      }
                                      return 0
                                    })
                                  if (durations.length === 0) return '-'
                                  const avg = Math.round(
                                    durations.reduce((a, b) => a + b, 0) / durations.length
                                  )
                                  const minutes = Math.floor(avg / 60)
                                  const seconds = avg % 60
                                  return `${minutes}m ${seconds}s`
                                })()}
                              </div>
                            </div>
                          </div>

                          {/* Date-grouped Calls */}
                          <div className="w-full space-y-6">
                            {(() => {
                              const groupedCalls = client.callSmsHistory.calls.reduce(
                                (acc, call) => {
                                  // Use initiated_at (full UTC timestamp) instead of date string for correct timezone conversion
                                  const timestamp =
                                    'initiated_at' in call && call.initiated_at
                                      ? call.initiated_at
                                      : call.date
                                  const date = new Date(String(timestamp)).toLocaleDateString(
                                    'en-US',
                                    {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                      timeZone: userTimezone || undefined,
                                    }
                                  )
                                  if (!acc[date]) acc[date] = []
                                  acc[date].push(call as unknown as ExtendedCallItem)
                                  return acc
                                },
                                {} as Record<string, ExtendedCallItem[]>
                              )

                              return Object.entries(groupedCalls)
                                .sort(
                                  ([a], [b]) =>
                                    new Date(b as string).getTime() -
                                    new Date(a as string).getTime()
                                )
                                .map(([date, calls]) => (
                                  <div key={date} className="space-y-4">
                                    <h3 className="text-dark-500 text-sm font-semibold md:text-base">
                                      {date}
                                    </h3>
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                                      {calls.map((call) => (
                                        <CallLogCard
                                          key={call.id}
                                          clientName={client.fullName}
                                          title={`${t('pages.clients.detail.play')} (${call.duration})`}
                                          time={call.time}
                                          date={call.date}
                                          duration={call.duration}
                                          status={call.status}
                                          type={call.type}
                                          phone={call.phone}
                                          line={call.line}
                                          operator={call.operator}
                                          call_id={
                                            'call_id' in call ? (call.call_id as string) : undefined
                                          }
                                          recording_path={
                                            'recording_path' in call
                                              ? (call.recording_path as string | null)
                                              : null
                                          }
                                          icon={
                                            <Icons.PlayCircle02
                                              size={20}
                                              className="text-secondary-800"
                                            />
                                          }
                                          setSelectedCallData={setSelectedCallData}
                                          setIsCallRecordingModalOpen={setIsCallRecordingModalOpen}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                ))
                            })()}
                          </div>
                        </div>
                      )}
                      {activeCallSmsTab === 'sms' && (
                        <div className="flex flex-col items-start gap-4 self-stretch">
                          {/* Summary Statistics */}
                          <div className="flex h-auto w-full flex-col items-start gap-3 p-0 md:h-14 md:flex-row md:gap-5">
                            <div className="flex w-full flex-1 items-center justify-between rounded-xl border border-white bg-white/50 px-4 py-4 pl-3 md:w-auto md:px-5">
                              <div className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                                {t('pages.clients.detail.totalCost')}
                              </div>

                              <div className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                                {(() => {
                                  const totalCost = client.callSmsHistory.sms.reduce(
                                    (sum, s) => sum + (s.cost || 0),
                                    0
                                  )
                                  return `₴${totalCost.toFixed(2)} (${client.callSmsHistory.sms.length} ${t('pages.clients.modals.viewSMS.smsParts')})`
                                })()}
                              </div>
                            </div>
                            <div className="flex w-full flex-1 items-center justify-between rounded-xl border border-white bg-white/50 px-4 py-4 pl-3 md:w-auto md:px-5">
                              <div className="text-dark-500 text-sm leading-[150%] font-light tracking-[-0.28px]">
                                {t('pages.clients.detail.deliveryRate')}
                              </div>

                              <div className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
                                {(() => {
                                  const delivered = client.callSmsHistory.sms.filter(
                                    (s) => s.status === 'Delivered'
                                  ).length
                                  const failed = client.callSmsHistory.sms.filter(
                                    (s) => (s.status as string) === 'Failed'
                                  ).length
                                  const pending = client.callSmsHistory.sms.filter(
                                    (s) => (s.status as string) === 'Pending'
                                  ).length
                                  const total = client.callSmsHistory.sms.length
                                  const rate = total > 0 ? Math.round((delivered / total) * 100) : 0
                                  return `${rate}% (${delivered} ${t('pages.clients.detail.delivered')}, ${failed} ${t('pages.clients.detail.failed')}, ${pending} ${t('pages.clients.detail.pending')})`
                                })()}
                              </div>
                            </div>
                          </div>

                          {/* Date-grouped SMS */}
                          <div className="w-full space-y-6">
                            {(() => {
                              const groupedSms = client.callSmsHistory.sms.reduce(
                                (acc, sms) => {
                                  // Use sent_at (full UTC timestamp) instead of date string for correct timezone conversion
                                  const timestamp =
                                    'sent_at' in sms && sms.sent_at ? sms.sent_at : sms.date
                                  const date = new Date(String(timestamp)).toLocaleDateString(
                                    'en-US',
                                    {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                      timeZone: userTimezone || undefined,
                                    }
                                  )
                                  if (!acc[date]) acc[date] = []
                                  acc[date].push(sms as unknown as ExtendedSMSItem)
                                  return acc
                                },
                                {} as Record<string, ExtendedSMSItem[]>
                              )

                              return Object.entries(groupedSms)
                                .sort(
                                  ([a], [b]) =>
                                    new Date(b as string).getTime() -
                                    new Date(a as string).getTime()
                                )
                                .map(([date, smsList]) => (
                                  <div key={date} className="space-y-4">
                                    <h3 className="text-dark-500 text-sm font-semibold md:text-base">
                                      {date}
                                    </h3>
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                                      {smsList.map((sms) => (
                                        <CallLogCard
                                          key={sms.id}
                                          clientName={client.fullName}
                                          title={t('pages.clients.detail.viewSms')}
                                          time={sms.time}
                                          date={sms.date}
                                          status={sms.status}
                                          template={sms.template}
                                          message={sms.message}
                                          operator={sms.operator}
                                          phone={sms.phone}
                                          sent_at={sms.sent_at}
                                          delivered_at={sms.delivered_at}
                                          icon={
                                            <Icons.ChatFeedback01
                                              size={20}
                                              className="text-secondary-800"
                                            />
                                          }
                                          setSelectedSMSData={setSelectedSMSData}
                                          setIsViewSMSModalOpen={setIsViewSMSModalOpen}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                ))
                            })()}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Tab 5: Tasks */}
              {activeRightCardTab === 'tasks' && (
                <div className="flex flex-1 flex-col items-start gap-2.5 self-stretch p-3 md:p-6">
                  {isTasksLoading ? (
                    <TableSkeleton columns={5} rows={3} />
                  ) : (
                    <DataTable columns={taskColumns} data={client.tasks} className="w-full" />
                  )}
                </div>
              )}

              {/* Tab 6: Documents (no backend infrastructure yet - shows empty) */}
              {activeRightCardTab === 'documents' && (
                <div className="flex flex-1 flex-col items-start gap-2.5 self-stretch p-3 md:p-6">
                  {isDocumentsLoading ? (
                    <TableSkeleton columns={4} rows={3} />
                  ) : (
                    <DataTable
                      columns={documentColumns}
                      data={client.documents}
                      className="w-full"
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Comments / Activity Section - Merged per Marina's request */}
      <div className="flex flex-col items-start gap-3 self-stretch rounded-xl bg-white/50 p-3 md:p-6">
        {/* Header with tabs and View All */}
        <div className="flex w-full flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          {/* Tabs */}
          <div className="flex items-center rounded-lg border border-white bg-white p-1 shadow-sm">
            <button
              onClick={() => setActiveCommentTab('comments')}
              className={cn(
                'text-dark-500 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-xs leading-[140%] font-medium tracking-[-0.24px]',
                activeCommentTab === 'comments'
                  ? 'bg-secondary-800 text-white'
                  : 'hover:bg-primary-200/10 hover:text-secondary-800'
              )}
            >
              {t('pages.clients.detail.comments')}
            </button>
            <button
              onClick={() => setActiveCommentTab('primary')}
              className={cn(
                'text-dark-500 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-xs leading-[140%] font-medium tracking-[-0.24px]',
                activeCommentTab === 'primary'
                  ? 'bg-secondary-800 text-white'
                  : 'hover:bg-primary-200/10 hover:text-secondary-800'
              )}
            >
              {t('pages.clients.detail.commentsFromPrimaryCreditor')}
            </button>
            <button
              onClick={() => setActiveCommentTab('dial-history')}
              className={cn(
                'text-dark-500 flex items-center justify-center gap-2 rounded-md px-4 py-2 text-xs leading-[140%] font-medium tracking-[-0.24px]',
                activeCommentTab === 'dial-history'
                  ? 'bg-secondary-800 text-white'
                  : 'hover:bg-primary-200/10 hover:text-secondary-800'
              )}
            >
              {t('pages.clients.detail.dialHistory')}
            </button>
          </div>
          {/* View All link */}
          <LinkButton
            variant="regular-secondary"
            size="xs"
            onClick={() => navigate(`/dashboard/clients/${client.id}/activity`)}
            rightIcon={<Icons.ArrowRight size={18} />}
          >
            {t('pages.clients.detail.viewAll')}
          </LinkButton>
        </div>

        {/* Content based on active tab */}
        {activeCommentTab === 'comments' &&
          (isActivitiesLoading ? (
            <TableSkeleton columns={9} rows={3} className="w-full" />
          ) : client.activities.length === 0 ? (
            <div className="flex flex-col items-center gap-4 self-stretch md:gap-6">
              <div className="flex flex-col items-center justify-center gap-4 self-stretch sm:flex-row md:gap-6">
                <Icons.FileRemove size={48} className="text-gray-500" strokeWidth={0.5} />
                <p className="text-dark-500 text-center text-xl leading-tight font-light tracking-[-0.48px] md:text-2xl">
                  {t('pages.clients.detail.noHistoryYet')}
                </p>
              </div>
              <p className="text-dark-500 text-center text-sm leading-[155%] font-medium tracking-[-0.32px] md:text-base">
                {t('pages.clients.detail.startByCallingSendingSMSOrAddingNote')}
              </p>
              <button
                onClick={() => setIsNoteModalOpen(true)}
                className="bg-secondary-800 flex items-center rounded-full shadow-md transition-all duration-200 hover:shadow-lg"
                aria-label={t('pages.clients.detail.addFirstNote')}
              >
                <div className="bg-primary-300 ml-1 flex h-10 w-10 items-center justify-center rounded-full">
                  <Icons.Add size={20} className="text-dark-500" strokeWidth={2} />
                </div>
                <span className="px-4 py-3 text-sm font-medium text-white">
                  {t('pages.clients.detail.addFirstNote')}
                </span>
              </button>
            </div>
          ) : (
            <DataTable
              columns={activityColumns}
              data={client.activities.slice(0, 10)}
              className="w-full"
              tableClassName="table-fixed w-full"
            />
          ))}

        {activeCommentTab === 'primary' &&
          (isProfileLoading ? (
            <TableSkeleton columns={1} rows={3} className="w-full" />
          ) : !profile?.sale_notes?.trim() ? (
            <div className="flex flex-col items-center gap-4 self-stretch py-8 md:gap-6">
              <div className="flex flex-col items-center justify-center gap-4 self-stretch sm:flex-row md:gap-6">
                <Icons.FileRemove size={48} className="text-gray-500" strokeWidth={0.5} />
                <p className="text-dark-500 text-center text-xl leading-tight font-light tracking-[-0.48px] md:text-2xl">
                  {t('pages.clients.detail.noPrimaryCreditorComments')}
                </p>
              </div>
              <p className="text-dark-500 text-center text-sm leading-[155%] font-medium tracking-[-0.32px] md:text-base">
                {t('pages.clients.detail.primaryCreditorCommentsDescription')}
              </p>
            </div>
          ) : (
            <div className="w-full p-4">
              <p className="text-dark-500 text-sm leading-relaxed break-words whitespace-pre-wrap">
                {profile.sale_notes}
              </p>
            </div>
          ))}

        {activeCommentTab === 'dial-history' &&
          (isDialHistoryLoading ? (
            <TableSkeleton columns={4} rows={3} className="w-full" />
          ) : dialHistory.length === 0 ? (
            <div className="flex flex-col items-center gap-4 self-stretch py-8 md:gap-6">
              <div className="flex flex-col items-center justify-center gap-4 self-stretch sm:flex-row md:gap-6">
                <Icons.FileRemove size={48} className="text-gray-500" strokeWidth={0.5} />
                <p className="text-dark-500 text-center text-xl leading-tight font-light tracking-[-0.48px] md:text-2xl">
                  {t('pages.clients.detail.noDialHistory')}
                </p>
              </div>
            </div>
          ) : (
            <DataTable columns={dialHistoryColumns} data={dialHistory} className="w-full" />
          ))}
      </div>

      {/* Add Note Modal */}
      <AddNoteModal
        open={isNoteModalOpen}
        onClose={() => {
          setIsNoteModalOpen(false)
          setSelectedPhoneForNote('')
        }}
        phoneNumber={selectedPhoneForNote || client.phones?.[0]?.number || ''}
        clientId={clientId}
        onSave={(data) => {
          createNote({
            clientId,
            data,
          })
          setIsNoteModalOpen(false)
        }}
      />

      {/* Add Task Modal */}
      <AddTaskModal
        open={isTaskModalOpen}
        clientId={clientId}
        onClose={() => setIsTaskModalOpen(false)}
      />

      {/* Call Dialog Modal */}
      <CallDialogModal
        open={isCallModalOpen}
        onClose={() => {
          setOpenCallModal(null)
          setIsCallModalOpen(false)
          setCurrentCallId(null)
          setSelectedPhoneForCall('')
          handleClearCallError()
        }}
        clientName={client.fullName}
        phoneNumber={selectedPhoneForCall || client.phones?.[0]?.number || ''}
        callId={currentCallId}
        initialState="initial"
        error={callError}
        isLoading={isOriginatingCall}
        onCallStart={(_callType: CallType) => {
          const phoneNumber = selectedPhoneForCall || client.phones?.[0]?.number
          if (!phoneNumber) {
            setCallError('Client has no phone number')
            return
          }

          handleOriginateCall(phoneNumber, client.fullName, client.id.toString())
        }}
        onCallEnd={(duration: number, status: CallStatus) => {
          console.log('Call ended:', { duration, status })
          setOpenCallModal(null)
          setCurrentCallId(null)
        }}
        onRetry={() => {
          handleClearCallError()
        }}
      />

      {/* Call Recording Modal */}
      {selectedCallData && (
        <CallRecordingModal
          open={isCallRecordingModalOpen}
          onClose={() => {
            setOpenCallModal(null)
            setIsCallRecordingModalOpen(false)
            setSelectedCallData(null)
          }}
          callData={selectedCallData}
        />
      )}

      {/* View SMS Modal */}
      {selectedSMSData && (
        <ViewSMSModal
          open={isViewSMSModalOpen}
          onClose={() => {
            setIsViewSMSModalOpen(false)
            setSelectedSMSData(null)
          }}
          smsData={selectedSMSData}
        />
      )}

      {/* Send SMS Modal */}
      <SendSMSModal
        open={isSendSMSModalOpen}
        onClose={() => {
          setIsSendSMSModalOpen(false)
          setSelectedPhoneForSMS('')
        }}
        clientId={clientId}
        clientName={client.fullName}
        phoneNumber={selectedPhoneForSMS || client.phones?.[0]?.number || ''}
        loans={client.loans?.map((l) => ({
          id: l.id,
          loanNumber: l.loanNumber,
          totalToRepay: l.remainingDebtAmount,
        }))}
        onSent={() => {
          // SMS sent successfully - history will refresh automatically via query invalidation
        }}
      />

      {/* Tag Selector Modal */}
      <TagSelectorModal
        open={isTagModalOpen}
        clientId={clientId}
        clientName={client.fullName}
        projectId={1}
        onClose={() => setIsTagModalOpen(false)}
      />

      {/* Edit Client Modal */}
      <EditClientModal
        open={isEditModalOpen}
        clientId={clientId}
        onClose={() => setIsEditModalOpen(false)}
      />

      {/* Delete Client Modal
      <DeleteClientModal
        open={isDeleteModalOpen}
        client={{
          id: client.id,
          full_name: client.fullName,
          tax_id: client.taxIdNumber,
          phone_primary: client.phoneNumber,
          total_debt: client.loans?.reduce((sum, loan) => sum + (loan.totalToRepay || 0), 0) || 0,
          debt_count: client.loans?.length || 0,
        }}
        onClose={() => setIsDeleteModalOpen(false)}
        onSuccess={() => {
          // Success callback - navigation happens in the modal
          setIsDeleteModalOpen(false)
        }}
      /> */}

      {/* Assign Role Modal (Employee / Searcher) */}
      {assignRoleModalMode && (
        <AssignRoleModal
          open={true}
          mode={assignRoleModalMode}
          currentUserId={
            assignRoleModalMode === 'employee'
              ? (profile?.responsible_employee_id ?? null)
              : (profile?.responsible_searcher_id ?? null)
          }
          onClose={() => setAssignRoleModalMode(null)}
          onAssign={({ userId, reason }) => {
            assignClientMutation.mutate(
              {
                clientId,
                data: {
                  responsible_employee_id:
                    assignRoleModalMode === 'employee' ? parseInt(userId) : undefined,
                  responsible_searcher_id:
                    assignRoleModalMode === 'searcher' ? parseInt(userId) : undefined,
                  assignment_reason: reason,
                },
              },
              {
                onSuccess: () => setAssignRoleModalMode(null),
              }
            )
          }}
        />
      )}

      {/* RR Detail Modal */}
      <Modal open={!!selectedRaId} onClose={() => setSelectedRaId(null)} maxWidth="lg">
        <ModalHeader
          icon={
            <div className="bg-primary-300 flex h-10 w-10 items-center justify-center rounded-full sm:h-12 sm:w-12">
              <Icons.Calculate size={20} className="text-dark-500 sm:size-6" strokeWidth={1.5} />
            </div>
          }
          title={t('pages.clients.detail.rrDetail')}
        />
        <ModalContent>
          {rrDetail ? (
            <div className="flex flex-col gap-4">
              {/* Two fields per row */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-dark-500 text-xs font-light sm:text-sm">
                    {t('pages.clients.detail.rrLoanNumber')}
                  </span>
                  <span className="text-dark-500 text-xs font-medium sm:text-sm">
                    {rrDetail.contract_number ?? '-'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-dark-500 text-xs font-light sm:text-sm">
                    {t('pages.clients.detail.rrClientNumber')}
                  </span>
                  <span className="text-dark-500 text-xs font-medium sm:text-sm">
                    {rrDetail.client_id ?? '-'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-dark-500 text-xs font-light sm:text-sm">
                    {t('pages.clients.detail.rrRestructuringAmount')}
                  </span>
                  <span className="text-dark-500 text-xs font-medium sm:text-sm">
                    ₴ {formatCurrency(Number(rrDetail.restructuring_amount ?? 0))}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-dark-500 text-xs font-light sm:text-sm">
                    {t('pages.clients.detail.rrFirstPaymentDate')}
                  </span>
                  <span className="text-dark-500 text-xs font-medium sm:text-sm">
                    {rrDetail.first_payment_date ?? '-'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-dark-500 text-xs font-light sm:text-sm">
                    {t('pages.clients.detail.rrFirstPaymentAmount')}
                  </span>
                  <span className="text-dark-500 text-xs font-medium sm:text-sm">
                    ₴ {formatCurrency(Number(rrDetail.first_payment_amount ?? 0))}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-dark-500 text-xs font-light sm:text-sm">
                    {t('pages.clients.detail.rrResponsibleEmployee')}
                  </span>
                  <span className="text-dark-500 text-xs font-medium sm:text-sm">
                    {rrDetail.responsible_user_name ?? '-'}
                  </span>
                </div>
              </div>
              {/* Payment schedule with vertical scroll */}
              {rrDetail.payments.length > 0 && (
                <div className="pt-2">
                  <h3 className="text-dark-500 mb-2 text-sm font-medium sm:text-base">
                    {t('pages.clients.detail.rrPaymentSchedule')}
                  </h3>
                  <div className="max-h-48 overflow-y-auto">
                    <DataTable<RestructuringPaymentEntry & { id: number }>
                      columns={[
                        {
                          key: 'date',
                          header: t('pages.clients.detail.rrPaymentDate'),
                          render: (p) => p.date ?? '-',
                        },
                        {
                          key: 'amount',
                          header: t('pages.clients.detail.rrPaymentAmount'),
                          align: 'right',
                          render: (p) => `₴ ${formatCurrency(Number(p.amount ?? 0))}`,
                        },
                      ]}
                      data={rrDetail.payments.map((p, idx) => ({ ...p, id: idx }))}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
            </div>
          )}
        </ModalContent>
        <ModalFooter>
          <Button
            variant="cancel"
            size="sm"
            onClick={() => setSelectedRaId(null)}
            className="w-full rounded-md sm:w-auto"
          >
            {t('actions.close')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default ClientDetailPage
