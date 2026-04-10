/**
 * Client Detail Page
 *
 * Full page view for displaying detailed client information.
 */
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
import { DocumentsAccordion } from './components/DocumentsAccordion'
import { formatDate, formatDateTime } from '@/lib/formatters'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { DateSelect } from '@/components/ui/DateSelect'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { AddNoteModal } from './components/AddNoteModal'
import { EditInteractionModal } from './components/EditInteractionModal'
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
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/Tooltip'
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
  useAddSpamCallHistory,
  useAssignClient,
  useClientRestructuringAgreements,
  useRestructuringAgreementDetail,
  useCreateRestructuringAgreement,
  useCloseDebt,
  useCompleteRestructuringAgreement,
  useUpdateTask,
  useDeleteTask,
} from '@/features/clients/hooks/useClients'
import type { RestructuringPaymentEntry } from '@/features/clients/api/types'
import {
  useCreateNoteInteraction,
  useUpdateInteraction,
} from '@/features/clients/hooks/useNoteInteraction'
import type { InteractionResponse } from '@/features/clients/api/types'
import { LinkButton } from '@/components/ui/LinkButton'
import { ClientDetailPageSkeleton } from './components/ClientDetailPageSkeleton'
import { useCallStore } from '@/stores/callStore'
import { useClientTags } from '@/features/tags/hooks/useTags'
import { TagSelectorModal } from './components/TagSelectorModal'
import { useCallOrigination } from '@/features/calls/hooks/useCallOrigination'
import { useAuthStore } from '@/stores/authStore'
import { backendToFrontendPaymentMethod } from '@/features/payments/utils'
import { useUserDepartment } from '@/features/users'
import { PermissionGuard } from '@/components/auth'
import { useHasPermission } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/constants/permissions'
import { searchClientsByPhoneExact } from '@/api/clientSearchApi'
import { formatUkrainePhoneForDisplay, normalizeUkrainePhoneToDb } from '@/lib/phone'

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

// Contact type names are now returned by the backend from client_contact_types lookup table

// Client data loaded via useClientProfile + section-specific hooks (real API endpoints)

/** Strip formatting for phone match / API lookup (backend normalizes further). */
const stripPhoneFormat = (value: string) => value.replace(/[\s\-().]/g, '')

/** True if value looks like a Ukrainian mobile/phone number (incl. 380… without +). */
const looksLikeUkrainePhone = (value: string) =>
  /^(\+?38)?0\d{9}$/.test(stripPhoneFormat(value)) || /^380\d{9}$/.test(stripPhoneFormat(value))

export function ClientDetailPage() {
  const { t, i18n } = useTranslation('common')
  const { isCallActive, setOpenCallModal } = useCallStore()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Returns true if the value looks like a Ukrainian phone number,
  // regardless of the contact type's isPhone flag
  const looksLikePhone = (value: string) => looksLikeUkrainePhone(value)
  const [activeLoanTab, setActiveLoanTab] = useState<'process' | 'closed' | 'rr'>('process')
  const [selectedRaId, setSelectedRaId] = useState<number | null>(null)
  const [isConnectRrOpen, setIsConnectRrOpen] = useState(false)
  const [connectRrForm, setConnectRrForm] = useState({
    debtId: '' as string,
    connectionDate: null as Date | null,
    totalAmount: '',
    numPayments: 1,
    payments: [{ date: null as Date | null, amount: '' }] as Array<{
      date: Date | null
      amount: string
    }>,
  })
  const [connectRrError, setConnectRrError] = useState<string | null>(null)
  const [closeLoanConfirm, setCloseLoanConfirm] = useState<number | null>(null) // debtId to close
  const [completeRrConfirm, setCompleteRrConfirm] = useState<number | null>(null) // raId to complete
  const [activeCommentTab, setActiveCommentTab] = useState<'comments' | 'primary' | 'dial-history'>(
    'comments'
  )

  // Call origination hook (provides user, call state, handlers)
  const userTimezone = useAuthStore((state) => state.user?.timezone)
  const {
    user,
    isCallModalOpen,
    setIsCallModalOpen,
    currentCallId,
    activeCallType,
    callError,
    isOriginatingCall,
    isCallCooldown,
    cooldownSecondsRemaining,
    isTelephonyUnavailable,
    handleOriginateCall,
    handleClearCallError,
    handleCloseCallModal,
    handleCallEnd,
  } = useCallOrigination()

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
  const { mutate: createRr, isPending: isCreatingRr } = useCreateRestructuringAgreement()
  const { mutate: closeDebt, isPending: isClosingDebt } = useCloseDebt()
  const { mutate: completeRa, isPending: isCompletingRa } = useCompleteRestructuringAgreement()
  const { data: paymentsSection, isLoading: isPaymentsLoading } = useClientPaymentsSection(
    clientId,
    isValidClientId
  )
  const { data: callSmsHistory, isLoading: isCallSmsLoading } = useClientCallSmsHistory(
    clientId,
    isValidClientId
  )
  const canViewTasks = useHasPermission(PERMISSIONS.CLIENTS.VIEW_TASKS)
  const { data: tasks = [], isLoading: isTasksLoading } = useClientTasks(
    clientId,
    isValidClientId && canViewTasks
  )
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
  const { mutate: addSpamCall } = useAddSpamCallHistory(clientId)
  const canCreateTasks = useHasPermission(PERMISSIONS.CLIENTS.CREATE_TASKS)
  const updateTaskMutation = useUpdateTask(clientId)
  const deleteTaskMutation = useDeleteTask(clientId)
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

    // Build phones array from additional_phones (sourced from client_contacts types 1, 2, 29)
    const isValidPhone = (p: string | null | undefined): p is string => !!p && !/^0+$/.test(p)
    const phones: Array<{
      number: string
      type: string
      created_at?: string | null
      added_by_user_name?: string | null
    }> = []
    if (profile.additional_phones && profile.additional_phones.length > 0) {
      profile.additional_phones
        .filter((p) => isValidPhone(p.number))
        .forEach((p) =>
          phones.push({
            number: p.number,
            type: p.type,
            created_at: p.created_at,
            added_by_user_name: p.added_by_user_name,
          })
        )
    } else if (isValidPhone(profile.phone_primary)) {
      // Fallback for backward compat
      phones.push({ number: profile.phone_primary, type: 'mobile' })
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
        gender: profile.passport?.gender
          ? t(`pages.clients.detail.genderOptions.${profile.passport.gender}`, {
              defaultValue: profile.passport.gender,
            })
          : '',
        maritalStatus: profile.marital_status
          ? t(`pages.clients.detail.maritalStatuses.${profile.marital_status}`, {
              defaultValue: profile.marital_status,
            })
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
              profile.employment.work_experience_months != null
                ? `${profile.employment.work_experience_months} міс.`
                : '-',
            managerFullName: profile.employment.manager_full_name ?? '-',
            employmentType: profile.employment.employment_type
              ? t(`pages.clients.detail.employmentTypes.${profile.employment.employment_type}`, {
                  defaultValue: profile.employment.employment_type,
                })
              : '-',
            workPhone: profile.employment.work_phone ?? '-',
          }
        : null,
      recommenders: (profile.recommenders ?? []).map((r) => ({
        id: r.id,
        contactValue: r.contact_value ?? '',
        contactType: r.contact_type_name ?? '',
        contactTypeCode: r.contact_type_code ?? null,
        isPhone: r.is_phone ?? false,
        comment: r.comment ?? '',
        created_at: r.created_at,
        added_by_user_name: r.added_by_user_name,
      })),
      addresses: (profile.addresses ?? []).map((a) => ({
        id: a.id,
        addressType: a.address_type,
        fullAddress: a.full_address ?? '-',
      })),
      // Comments mapped
      comments: (profile.comments ?? []).map((c) => ({
        id: c.id,
        date: formatDate(c.created_at ?? undefined),
        text: c.content,
        author: c.created_by_name ?? `User #${c.created_by}`,
      })),
      tags: profile.tags,
      // Loans mapped from DebtDetail to UI shape
      loans: (loans ?? []).map((d) => ({
        id: d.id,
        loanNumber: d.contract_number,
        issueDate: formatDate(d.credit_issued_date ?? undefined),
        counterparty: d.seller_company,
        saleDate: formatDate(d.purchase_date ?? undefined),
        principalAmount: Number(d.principal_amount ?? 0),
        principalDebt: Number(d.principal_debt ?? d.principal_amount ?? 0),
        remainingDebtAmount: Number(d.remaining_debt_amount ?? 0),
        totalToReturn: Number(d.total_to_return ?? 0),
        status: d.status,
      })),
      // Payments mapped from PaymentResponse to UI shape
      // Split into system payments (payment_date >= purchase_date) and
      // primary creditor payments (payment_date < purchase_date).
      ...(() => {
        // Build lookups from loan contract_number -> formatted sale date & raw purchase_date
        const loanSaleDateMap = new Map<string, string>()
        const loanPurchaseDateMap = new Map<string, string>()
        ;(loans ?? []).forEach((d) => {
          if (d.contract_number) {
            loanSaleDateMap.set(d.contract_number, formatDate(d.purchase_date ?? undefined))
            if (d.purchase_date) loanPurchaseDateMap.set(d.contract_number, d.purchase_date)
          }
        })

        const systemPayments: Array<{
          id: number
          loanNumber: string
          counterparty: string
          saleDate: string
          paymentDate: string
          amount: number
          paymentMethod: string
          status: string
          paymentDistribution: string
          employee: string
        }> = []
        const creditorPayments: Array<{
          id: number
          loanNumber: string
          counterparty: string
          saleDate: string
          paymentDate: string
          amount: number
          distributionMethod: string
        }> = []

        ;(paymentsSection?.payments ?? []).forEach((p) => {
          const contractNum = p.debt_contract_number ?? ''
          const purchaseDate = loanPurchaseDateMap.get(contractNum)
          const isBeforePurchase = purchaseDate && p.payment_date && p.payment_date < purchaseDate

          const mapped = {
            id: p.id,
            loanNumber: p.debt_contract_number ?? p.payment_number,
            counterparty: p.seller_name ?? '-',
            saleDate: loanSaleDateMap.get(contractNum) ?? '-',
            paymentDate: formatDate(p.payment_date ?? undefined),
            amount: Number(p.amount),
          }

          if (isBeforePurchase) {
            creditorPayments.push({
              ...mapped,
              distributionMethod: p.payment_type ?? '-',
            })
          } else {
            systemPayments.push({
              ...mapped,
              paymentMethod: p.payment_method,
              status: p.status,
              paymentDistribution: p.payment_type ?? '-',
              employee: p.recorded_by_username ?? '-',
            })
          }
        })

        return { payments: systemPayments, paymentsToPrimaryCreditor: creditorPayments }
      })(),
      // Write-offs mapped
      writesOffs: (paymentsSection?.writesOffs ?? []).map((w) => ({
        id: w.id,
        loanNumber: w.contract_number ?? '-',
        counterparty: w.seller_name ?? '-',
        saleDate: formatDate(w.purchase_date ?? undefined),
        writeOffDate: formatDate(w.writeoff_date ?? undefined),
        amount: Number(w.amount || 0),
        writeOffMethod: w.writeoff_type ?? '-',
        employee: w.submitted_by_name ?? '-',
      })),
      callSmsHistory: callSmsHistory ?? { all: [], calls: [], sms: [] },
      // Tasks mapped from TaskResponse to UI shape
      tasks: (tasks ?? []).map((t) => ({
        id: t.id,
        loanNumber: '-',
        creationDate: formatDate(t.created_at ?? undefined),
        whoCreated: t.created_by_name ?? '-',
        description: t.title + (t.description ? `: ${t.description}` : ''),
        reminderDate: formatDate(t.due_date ?? undefined),
        reminderRecipient: t.assigned_to_username ?? '-',
        status: t.status,
        priority: t.priority,
      })),
      // Operators/searchers from assignment history
      operators: (operatorsSection?.operators ?? []).map((o) => ({
        id: o.id,
        date: formatDate(o.assigned_at ?? undefined),
        whoAppointed: o.assigned_by_name ?? '-',
        whoIsResponsible: o.new_employee_name ?? '-',
        note: o.assignment_reason ?? '-',
      })),
      searchers: (operatorsSection?.searchers ?? []).map((s) => ({
        id: s.id,
        date: formatDate(s.assigned_at ?? undefined),
        whoAppointed: s.assigned_by_name ?? '-',
        whoIsResponsible: s.new_searcher_name ?? '-',
        note: s.assignment_reason ?? '-',
      })),
      documents,
      // Activities mapped from InteractionResponse to UI shape
      // Deduplicate + filter invalid interactions to keep stable keys for the DataTable
      activities: (activities ?? [])
        .reduce<{ seen: Set<string>; items: typeof activities }>(
          (acc, a) => {
            const key = a?.id != null ? String(a.id) : null
            if (!key) return acc
            if (acc.seen.has(key)) return acc
            acc.seen.add(key)
            acc.items.push(a)
            return acc
          },
          { seen: new Set<string>(), items: [] }
        )
        .items.map((a) => {
          const loan = (loans ?? []).find((d) => d.id === a.debt_id)
          return {
            id: a.id,
            date: formatDateTime(a.created_at),
            phoneNumber: formatUkrainePhoneForDisplay(a.phone_used),
            type: a.type_code
              ? t(`interactionTypes.${a.type_code}`, { defaultValue: a.type_name ?? '-' })
              : (a.type_name ?? '-'),
            subtype: a.subtype_code
              ? t(`interactionChannels.${a.subtype_code}`, {
                  defaultValue: a.subtype_name ?? '-',
                })
              : (a.subtype_name ?? '-'),
            contactType: a.contact_type_code
              ? t(`interactionContactTypes.${a.contact_type_code}`, {
                  defaultValue: a.contact_type_name ?? '-',
                })
              : (a.contact_type_name ?? '-'),
            result: a.result_code
              ? t(`interactionResults.${a.result_code}`, {
                  defaultValue: a.result_name ?? a.status,
                })
              : (a.result_name ?? a.status),
            promisedAmount: a.promise_to_pay_amount ? Number(a.promise_to_pay_amount) : 0,
            promisedDate: formatDate(a.promise_to_pay_date ?? undefined),
            callbackDate: formatDate(a.next_action_date ?? undefined),
            creditNumber: loan?.contract_number ?? '-',
            comment: a.summary ?? a.notes ?? '-',
            employee: a.user_name ?? '-',
            updated_at: a.updated_at ?? a.created_at,
            _raw: a,
          }
        }),
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

  const normalizePhoneForLookup = (value: string) => stripPhoneFormat(value)

  const phoneLookupValues = useMemo(() => {
    if (!client) return []
    const set = new Set<string>()
    const add = (raw: string | null | undefined) => {
      if (!raw) return
      const k = normalizePhoneForLookup(raw)
      if (k.length > 0) set.add(k)
    }
    client.phones?.forEach((p) => add(p.number))
    // Recommenders / contacts: referrer, third-party phones, etc. (not only types 1,2,29)
    client.recommenders?.forEach((r) => {
      if (r.isPhone || looksLikeUkrainePhone(r.contactValue)) add(r.contactValue)
    })
    const wp = client.work?.workPhone
    if (wp && wp !== '-' && looksLikeUkrainePhone(wp)) add(wp)
    return Array.from(set)
  }, [client])

  const linkedContactQueries = useQueries({
    queries: phoneLookupValues.map((phone) => ({
      queryKey: ['clients', 'linked-contacts', clientId, phone],
      queryFn: async () => {
        const results = await searchClientsByPhoneExact(phone)
        return results.filter((linkedClient) => linkedClient.id !== clientId)
      },
      enabled: isValidClientId && !!phone,
      staleTime: 60_000,
    })),
  })

  const linkedContactsByPhone = useMemo(() => {
    const map = new Map<string, Array<{ id: number; fullName: string; clientNumber: string }>>()

    phoneLookupValues.forEach((phone, index) => {
      const linkedClients = linkedContactQueries[index]?.data ?? []
      const dedupedByClientId = new Map<
        number,
        { id: number; fullName: string; clientNumber: string }
      >()

      linkedClients.forEach((linkedClient) => {
        const fullName = [linkedClient.first_name, linkedClient.middle_name, linkedClient.last_name]
          .filter(Boolean)
          .join(' ')
          .trim()

        dedupedByClientId.set(linkedClient.id, {
          id: linkedClient.id,
          fullName: fullName || `ID ${linkedClient.id}`,
          clientNumber: `№${linkedClient.id}`,
        })
      })

      map.set(phone, Array.from(dedupedByClientId.values()))
    })

    return map
  }, [linkedContactQueries, phoneLookupValues])

  const renderLinkedContactBadges = (rawPhone: string, align: 'end' | 'start' = 'end') => {
    const phoneKey = normalizePhoneForLookup(rawPhone)
    const linkedContacts = linkedContactsByPhone.get(phoneKey) ?? []
    if (linkedContacts.length === 0) return null
    return (
      <div
        className={cn('flex flex-wrap gap-1', align === 'end' ? 'justify-end' : 'justify-start')}
      >
        {linkedContacts.map((linkedContact) => (
          <Link
            key={linkedContact.id}
            to={`/dashboard/clients/${linkedContact.id}`}
            className="border-primary-200 bg-primary-50 text-primary-700 hover:border-primary-300 hover:bg-primary-100 inline-flex max-w-full items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] leading-3 font-medium"
            title={linkedContact.fullName}
          >
            <span aria-hidden="true">🔗</span>
            <span>{linkedContact.clientNumber}</span>
          </Link>
        ))}
      </div>
    )
  }

  // Tags are now fetched from useClientTags hook instead of local state
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false)
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  // isCallModalOpen, currentCallId managed by useCallOrigination hook
  const [isCallRecordingModalOpen, setIsCallRecordingModalOpen] = useState(false)
  const [isTagModalOpen, setIsTagModalOpen] = useState(false)
  // const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isEditInteractionModalOpen, setIsEditInteractionModalOpen] = useState(false)
  const { mutate: updateInteraction, isPending: isUpdating } = useUpdateInteraction()
  const [editingInteraction, setEditingInteraction] = useState<InteractionResponse | null>(null)
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
  const [activeClientCardTab, setActiveClientCardTab] = useState<'personal' | 'passport' | 'work'>(
    'personal'
  )
  const [activeRightCardTab, setActiveRightCardTab] = useState<
    'loans' | 'payments' | 'recommenders' | 'operators' | 'call-sms-history' | 'tasks' | 'documents'
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
    { key: 'issueDate', header: t('pages.clients.detail.tableHeaders.issueDate'), align: 'left' },
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
    {
      key: 'actions',
      header: t('pages.clients.detail.tableHeaders.actions'),
      align: 'center',
      render: (loan) =>
        loan.status === 'active' ? (
          <PermissionGuard permission={PERMISSIONS.CLIENTS.CLOSE_DEBT}>
            <button
              onClick={() => setCloseLoanConfirm(loan.id)}
              disabled={isClosingDebt}
              className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50"
              title={t('pages.clients.detail.closeLoan')}
            >
              <Icons.Success size={18} />
            </button>
          </PermissionGuard>
        ) : null,
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
      render: (row) => formatDate(row.purchase_date ?? undefined),
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
      render: (row) => formatDate(row.first_payment_date ?? undefined),
    },
    {
      key: 'remaining_debt_amount',
      header: t('pages.clients.detail.tableHeaders.totalToBeRepaid'),
      align: 'right',
      render: (row) => `₴ ${formatCurrency(Number(row.remaining_debt_amount ?? 0))}`,
    },
    {
      key: 'status_name',
      header: t('pages.clients.detail.tableHeaders.status', 'Статус'),
      align: 'center',
      render: (row) => {
        const sid = row.status_id
        const label = row.status_name ?? '-'
        const cls =
          sid === 4
            ? 'bg-green-100 text-green-800'
            : sid === 1
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-600'
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}
          >
            {label}
          </span>
        )
      },
    },
    {
      key: 'id',
      header: t('pages.clients.detail.tableHeaders.actions'),
      align: 'center',
      render: (row) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => setSelectedRaId(row.id)}
            className="text-secondary-800 hover:text-secondary-600 p-1"
            title={t('pages.clients.detail.viewDetail')}
          >
            <Icons.Eye size={18} />
          </button>
          {row.status_id !== 4 && (
            <button
              onClick={() => setCompleteRrConfirm(row.id)}
              disabled={isCompletingRa}
              className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50"
              title={t('pages.clients.detail.completeRR', 'Complete RR')}
            >
              <Icons.Success size={18} />
            </button>
          )}
        </div>
      ),
    },
  ]

  const activityColumns: Column<(typeof client.activities)[0]>[] = [
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
      className: 'w-[180px] min-w-[180px] overflow-visible',
      render: (activity) => {
        const v = activity.phoneNumber
        return (
          <span className="block whitespace-nowrap tabular-nums" title={v !== '-' ? v : undefined}>
            {v}
          </span>
        )
      },
    },
    {
      key: 'type',
      header: t('pages.clients.activity.tableHeaders.type'),
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
      key: 'creditNumber',
      header: t('pages.clients.activity.tableHeaders.creditNumber', 'Credit Number'),
      align: 'left',
      className: 'w-[140px] overflow-hidden whitespace-normal break-words',
    },
    {
      key: 'comment',
      header: t('pages.clients.activity.tableHeaders.comment'),
      align: 'left',
      className: 'min-w-[300px] max-w-[500px] whitespace-normal break-words',
      render: (activity) => (
        <div className="py-1 leading-tight break-words whitespace-normal">
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
              setIsEditInteractionModalOpen(true)
            }}
            className="flex items-center justify-center rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <Icons.PencilEdit size={16} strokeWidth={1.5} />
          </button>
        </PermissionGuard>
      ),
    },
  ]

  const dialHistoryColumns: Column<(typeof dialHistory)[0]>[] = [
    {
      key: 'interaction_date',
      header: t('pages.clients.activity.tableHeaders.date'),
      align: 'left',
      className: 'w-[100px]',
      render: (row) => formatDate(row.interaction_date ?? undefined),
    },
    {
      key: 'phone',
      header: t('pages.clients.activity.tableHeaders.phone'),
      align: 'left',
      className: 'w-[120px]',
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
      render: (payment) =>
        backendToFrontendPaymentMethod(
          payment.paymentMethod as Parameters<typeof backendToFrontendPaymentMethod>[0]
        ),
    },
    {
      key: 'status',
      header: t('pages.clients.detail.tableHeaders.status'),
      align: 'left',
      render: (payment) => {
        const s = (payment.status ?? '').toLowerCase().trim()
        const isVerified = s === 'verified' || s === 'done'
        const isPending = s === 'pending'
        const isCancelled =
          s === 'cancelled' || s === 'canceled' || s === 'failed' || s === 'rejected'

        const dotInner = isVerified
          ? 'bg-success-500'
          : isPending
            ? 'bg-gray-500'
            : isCancelled
              ? 'bg-error-500'
              : 'bg-gray-400'
        const dotOuter = isVerified
          ? 'bg-success-200'
          : isPending
            ? 'bg-gray-200'
            : isCancelled
              ? 'bg-error-200'
              : 'bg-gray-200'
        const textClass = isVerified
          ? 'text-success-500'
          : isPending
            ? 'text-gray-500'
            : isCancelled
              ? 'text-error-500'
              : 'text-gray-500'

        // Use debtSummary.paymentStatus keys (verified/pending/cancelled) for consistency
        const labelKey = isVerified
          ? 'pages.clients.debtSummary.paymentStatus.verified'
          : isPending
            ? 'pages.clients.debtSummary.paymentStatus.pending'
            : 'pages.clients.debtSummary.paymentStatus.cancelled'
        const label = t(labelKey)

        return (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-full',
                dotOuter
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', dotInner)} />
            </span>
            <span className={cn('text-xs font-medium', textClass)}>{label}</span>
          </div>
        )
      },
    },
    {
      key: 'paymentDistribution',
      header: t('pages.clients.detail.tableHeaders.paymentType'),
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
    {
      key: 'status',
      header: t('pages.clients.detail.tableHeaders.status', 'Status'),
      align: 'center',
      render: (item) => (
        <span
          className={cn(
            'inline-block rounded px-2 py-0.5 text-[10px] font-medium capitalize',
            item.status === 'pending' && 'bg-yellow-100 text-yellow-600',
            item.status === 'in_progress' && 'bg-blue-100 text-blue-600',
            item.status === 'completed' && 'bg-green-100 text-green-600',
            item.status === 'cancelled' && 'bg-gray-100 text-gray-500'
          )}
        >
          {item.status.replace(/_/g, ' ')}
        </span>
      ),
    },
    ...(canCreateTasks
      ? [
          {
            key: 'actions' as const,
            header: t('pages.clients.detail.tableHeaders.actions', 'Actions'),
            align: 'center' as const,
            render: (item: (typeof client.tasks)[0]) => (
              <div className="flex items-center justify-center gap-1">
                {item.status !== 'completed' && item.status !== 'cancelled' && (
                  <button
                    type="button"
                    title="Complete task"
                    onClick={(e) => {
                      e.stopPropagation()
                      updateTaskMutation.mutate({
                        taskId: item.id,
                        data: { status: 'completed' },
                      })
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded text-green-500 transition-colors hover:bg-green-50 hover:text-green-700"
                  >
                    <Icons.Tick02 size={14} strokeWidth={2} />
                  </button>
                )}
                {item.status !== 'cancelled' && item.status !== 'completed' && (
                  <button
                    type="button"
                    title="Cancel task"
                    onClick={(e) => {
                      e.stopPropagation()
                      updateTaskMutation.mutate({
                        taskId: item.id,
                        data: { status: 'cancelled' },
                      })
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded text-yellow-500 transition-colors hover:bg-yellow-50 hover:text-yellow-700"
                  >
                    <Icons.Cancel01 size={14} strokeWidth={2} />
                  </button>
                )}
                <button
                  type="button"
                  title="Delete task"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (window.confirm('Are you sure you want to delete this task?')) {
                      deleteTaskMutation.mutate(item.id)
                    }
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Icons.Delete size={14} strokeWidth={2} />
                </button>
              </div>
            ),
          },
        ]
      : []),
  ]

  // documentColumns removed — replaced by DocumentsAccordion component

  return (
    <TooltipProvider>
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
            <PermissionGuard permission={PERMISSIONS.CLIENTS.CREATE_INTERACTIONS}>
              <Button
                size="md"
                variant="outline"
                leftIcon={<Icons.PencilEdit size={20} />}
                className="flex w-full flex-1 flex-row rounded-full text-xs font-medium md:text-sm xl:w-auto xl:flex-none"
                onClick={() => setIsNoteModalOpen(true)}
              >
                {t('pages.clients.activity.addNote')}
              </Button>
            </PermissionGuard>
            <PermissionGuard permission={PERMISSIONS.CLIENTS.CREATE_TASKS}>
              <Button
                size="md"
                variant="outline"
                leftIcon={<Icons.Clock01 size={20} />}
                className="flex w-full flex-1 flex-row rounded-full text-xs font-medium md:text-sm xl:w-auto xl:flex-none"
                onClick={() => setIsTaskModalOpen(true)}
              >
                {t('pages.clients.tasks.addTask', 'Add Task')}
              </Button>
            </PermissionGuard>
            <PermissionGuard permission={PERMISSIONS.COMMUNICATION.MAKE_CALLS}>
              <Button
                size="md"
                leftIcon={<Icons.Headset size={20} />}
                className="w-full flex-1 rounded-full xl:w-auto xl:flex-none"
                disabled={!user?.is_agent || !user?.asterisk_extension}
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
            </PermissionGuard>
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
          <div className="client-panel-scroll flex min-h-[44px] w-full flex-col items-start justify-start gap-0 rounded-lg bg-white/50 p-0 xl:max-h-[70vh] xl:w-[30%] xl:overflow-y-auto">
            {/* Credit Details (top part of card) */}
            <div className="flex flex-col items-start gap-3 self-stretch px-4 py-4 md:px-6 md:py-5">
              <div className="flex flex-col gap-2 self-stretch">
                <div className="flex items-center justify-between gap-2 self-stretch">
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    {clientTags && clientTags.length > 0 ? (
                      <>
                        {clientTags.slice(0, 3).map((tag) => (
                          <TagBadge
                            key={tag.id}
                            name={tag.name}
                            color={tag.color}
                            size="sm"
                            isProtected={tag.is_protected}
                            expiryType={tag.expiry_type}
                          />
                        ))}
                        {clientTags.length > 3 && (
                          <button
                            type="button"
                            onClick={() => setIsTagModalOpen(true)}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200"
                          >
                            {t('pages.tags.showMore', '+{{count}} more', {
                              count: clientTags.length - 3,
                            })}
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                        {t('pages.clients.detail.noTagsAssigned')}
                      </span>
                    )}
                  </div>
                  <PermissionGuard permission={PERMISSIONS.CLIENTS.EDIT}>
                    <button
                      onClick={() => setIsTagModalOpen(true)}
                      className="shrink-0 text-gray-500 transition-colors hover:text-gray-700"
                      title="Manage tags"
                      type="button"
                    >
                      <Icons.PencilEdit02 size={16} strokeWidth={1.5} />
                    </button>
                  </PermissionGuard>
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
                    <PermissionGuard permission={PERMISSIONS.CLIENTS.EDIT}>
                      <button
                        onClick={() => setAssignRoleModalMode('employee')}
                        className="shrink-0 text-gray-400 transition-colors hover:text-gray-700"
                        title="Assign employee"
                        type="button"
                      >
                        <Icons.PencilEdit02 size={14} strokeWidth={1.5} />
                      </button>
                    </PermissionGuard>
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
                    <PermissionGuard permission={PERMISSIONS.CLIENTS.EDIT}>
                      <button
                        onClick={() => setAssignRoleModalMode('searcher')}
                        className="shrink-0 text-gray-400 transition-colors hover:text-gray-700"
                        title="Assign searcher"
                        type="button"
                      >
                        <Icons.PencilEdit02 size={14} strokeWidth={1.5} />
                      </button>
                    </PermissionGuard>
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
                      <div className="flex flex-1 items-center justify-end gap-1.5">
                        <div className="flex min-w-0 flex-col items-end gap-1">
                          <span className="text-dark-500 truncate text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                            {phone.number}
                          </span>
                          {renderLinkedContactBadges(phone.number, 'end')}
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="flex h-[20px] w-[20px] shrink-0 items-center justify-center text-gray-400 hover:text-gray-600"
                            >
                              <Icons.Info size={14} strokeWidth={1.5} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            {phone.type && (
                              <div>
                                {t('pages.clients.detail.phoneType')}:{' '}
                                {phone.type === 'mobile'
                                  ? t('pages.clients.editModal.phoneMobile')
                                  : phone.type === 'home'
                                    ? t('pages.clients.editModal.phoneHome')
                                    : phone.type === 'register'
                                      ? t('pages.clients.editModal.phoneRegister')
                                      : phone.type}
                              </div>
                            )}
                            {phone.added_by_user_name && (
                              <div>
                                {t('pages.clients.detail.addedBy')}: {phone.added_by_user_name}
                              </div>
                            )}
                            {phone.created_at && (
                              <div>
                                {t('pages.clients.detail.addedDate')}:{' '}
                                {formatDate(phone.created_at ?? undefined)}
                              </div>
                            )}
                            {!phone.added_by_user_name && !phone.created_at && <div>-</div>}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 md:gap-2">
                        <PermissionGuard permission={PERMISSIONS.COMMUNICATION.MAKE_CALLS}>
                          <button
                            disabled={!user?.is_agent || !user?.asterisk_extension}
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
                            className="text-primary-500 flex h-[24px] w-[24px] cursor-pointer items-center justify-center hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 md:h-[20px] md:w-[20px]"
                          >
                            <Icons.Headset size={16} className="flex-shrink-0" />
                          </button>
                        </PermissionGuard>
                        <PermissionGuard permission={PERMISSIONS.COMMUNICATION.SEND_SMS}>
                          <button
                            onClick={() => {
                              setSelectedPhoneForSMS(phone.number)
                              setIsSendSMSModalOpen(true)
                            }}
                            className="text-primary-500 flex h-[24px] w-[24px] cursor-pointer items-center justify-center hover:opacity-80 md:h-[20px] md:w-[20px]"
                          >
                            <Icons.ChatFeedback01 size={16} className="flex-shrink-0" />
                          </button>
                        </PermissionGuard>
                        <PermissionGuard permission={PERMISSIONS.CLIENTS.CREATE_INTERACTIONS}>
                          <button
                            onClick={() => {
                              setSelectedPhoneForNote(phone.number)
                              setIsNoteModalOpen(true)
                            }}
                            className="text-primary-500 flex h-[24px] w-[24px] cursor-pointer items-center justify-center hover:opacity-80 md:h-[20px] md:w-[20px]"
                          >
                            <Icons.PencilEdit size={16} className="flex-shrink-0" />
                          </button>
                        </PermissionGuard>
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
                    data-tab="passport"
                    onClick={() => setActiveClientCardTab('passport')}
                    title={t('pages.clients.detail.tabs.passport')}
                    className={cn(
                      'md:hover:bg-primary-200/10 hover:bg-secondary-800/20 flex shrink-0 cursor-pointer flex-row items-center justify-center self-stretch rounded-md p-2 md:justify-start md:rounded-none md:border-b-0 md:border-l-2 md:p-2.5',
                      activeClientCardTab === 'passport'
                        ? 'md:border-primary-300 md:bg-primary-200/10 bg-secondary-800/10'
                        : 'md:border-transparent'
                    )}
                  >
                    <Icons.File
                      size={24}
                      className={cn(
                        'shrink-0',
                        activeClientCardTab === 'passport' ? 'text-secondary-800' : 'text-gray-700'
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* Right side content for selected client card tab */}
              <div className="flex w-full min-w-0 flex-col items-center gap-6 self-stretch overflow-hidden px-4 py-4 md:px-0">
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
                    {client.addresses.map((address) => (
                      <React.Fragment key={address.id}>
                        <div className="flex items-start self-stretch p-0">
                          <div className="flex shrink-0 items-start gap-2.5">
                            <label className="text-xs leading-[140%] font-light tracking-[-0.24px] text-gray-700">
                              {address.addressType === 'registration'
                                ? t('pages.clients.detail.registrationAddress')
                                : t('pages.clients.detail.personalAddress')}
                            </label>
                          </div>
                          <p className="text-dark-500 min-w-0 flex-1 text-right text-xs leading-[140%] font-medium tracking-[-0.24px] break-words">
                            {address.fullAddress}
                          </p>
                        </div>
                      </React.Fragment>
                    ))}
                    {client.addresses.length === 0 && <p className="text-xs text-gray-500">-</p>}
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

                {activeClientCardTab === 'passport' && (
                  <>
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
                          {t('pages.clients.detail.workPhone')}
                        </label>
                      </div>
                      <div className="flex flex-1 items-center justify-end gap-2 md:gap-3">
                        <div className="flex min-w-0 flex-col items-end gap-1">
                          <span className="text-dark-500 truncate text-right text-xs leading-[140%] font-medium tracking-[-0.24px]">
                            {client.work?.workPhone || '-'}
                          </span>
                          {client.work?.workPhone &&
                            client.work.workPhone !== '-' &&
                            looksLikePhone(client.work.workPhone) &&
                            renderLinkedContactBadges(client.work.workPhone, 'end')}
                        </div>
                        {client.work?.workPhone && client.work.workPhone !== '-' && (
                          <div className="flex shrink-0 items-center gap-1 md:gap-2">
                            <PermissionGuard permission={PERMISSIONS.COMMUNICATION.MAKE_CALLS}>
                              <button
                                disabled={!user?.is_agent || !user?.asterisk_extension}
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
                                className="text-primary-500 flex h-[24px] w-[24px] cursor-pointer items-center justify-center hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 md:h-[20px] md:w-[20px]"
                              >
                                <Icons.Headset size={16} className="flex-shrink-0" />
                              </button>
                            </PermissionGuard>
                            <PermissionGuard permission={PERMISSIONS.COMMUNICATION.SEND_SMS}>
                              <button
                                onClick={() => {
                                  setSelectedPhoneForSMS(client.work?.workPhone || '')
                                  setIsSendSMSModalOpen(true)
                                }}
                                className="text-primary-500 flex h-[24px] w-[24px] cursor-pointer items-center justify-center hover:opacity-80 md:h-[20px] md:w-[20px]"
                              >
                                <Icons.ChatFeedback01 size={16} className="flex-shrink-0" />
                              </button>
                            </PermissionGuard>
                            <PermissionGuard permission={PERMISSIONS.CLIENTS.CREATE_INTERACTIONS}>
                              <button
                                onClick={() => {
                                  setSelectedPhoneForNote(client.work?.workPhone || '')
                                  setIsNoteModalOpen(true)
                                }}
                                className="text-primary-500 flex h-[24px] w-[24px] cursor-pointer items-center justify-center hover:opacity-80 md:h-[20px] md:w-[20px]"
                              >
                                <Icons.PencilEdit size={16} className="flex-shrink-0" />
                              </button>
                            </PermissionGuard>
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
          <div className="client-panel-scroll flex w-full flex-1 flex-col items-start gap-5 self-stretch xl:max-h-[70vh] xl:w-[64%] xl:overflow-y-auto">
            <div className="flex min-h-0 flex-1 flex-col items-start gap-0 self-stretch overflow-y-auto rounded-lg bg-white/50 p-0">
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
                  {/* Tab 3: Recommenders */}
                  <button
                    type="button"
                    data-tab="recommenders"
                    onClick={() => setActiveRightCardTab('recommenders')}
                    className={cn(
                      'hover:bg-primary-200/10 flex shrink-0 cursor-pointer items-center justify-center gap-2 border-b-2 px-3 py-4 transition-colors md:px-4',
                      activeRightCardTab === 'recommenders'
                        ? 'border-primary-300 text-secondary-800 bg-primary-300/10'
                        : 'hover:text-secondary-800 border-transparent text-gray-600'
                    )}
                  >
                    <Icons.UserCheck01 size={20} className="shrink-0 text-current" />
                    <span className="text-xs font-medium whitespace-nowrap md:text-sm">
                      {t('pages.clients.detail.tabs.recommenders')}
                    </span>
                  </button>
                  {/* Tab 4: Operators */}
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
                      {/* <Button
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
                    </Button> */}
                      <Button
                        variant="secondary"
                        leftIcon={<Icons.Calculate size={20} />}
                        className="rounded text-xs md:text-sm"
                        size="sm"
                        onClick={() => {
                          setConnectRrForm({
                            debtId: '',
                            connectionDate: null,
                            totalAmount: '',
                            numPayments: 1,
                            payments: [{ date: null, amount: '' }],
                          })
                          setConnectRrError(null)
                          setIsConnectRrOpen(true)
                        }}
                      >
                        {t('pages.clients.detail.connectRR')}
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

                {/* Tab 3: Recommenders */}
                {activeRightCardTab === 'recommenders' && (
                  <div className="self-stretch overflow-x-auto p-3 md:p-6">
                    {client.recommenders.length === 0 ? (
                      <p className="text-xs text-gray-500">-</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="pb-2 text-left font-light tracking-[-0.24px] text-gray-700">
                              {t('pages.clients.detail.contactValue')}
                            </th>
                            <th className="pb-2"></th>
                            <th className="pb-2 text-left font-light tracking-[-0.24px] text-gray-700">
                              {t('pages.clients.detail.contactType')}
                            </th>
                            <th className="pb-2 text-left font-light tracking-[-0.24px] text-gray-700">
                              {t('pages.clients.detail.comment')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {client.recommenders.map((contact) => (
                            <tr key={contact.id} className="border-b border-gray-100 last:border-0">
                              <td className="py-2 pr-3">
                                <div className="flex flex-col items-start gap-1">
                                  <div className="flex items-center gap-0.5">
                                    <span className="text-dark-500 font-medium tracking-[-0.24px] break-all">
                                      {contact.contactValue}
                                    </span>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          type="button"
                                          className="flex h-[20px] w-[20px] shrink-0 items-center justify-center text-gray-400 hover:text-gray-600"
                                        >
                                          <Icons.Info size={14} strokeWidth={1.5} />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-xs">
                                        {contact.added_by_user_name && (
                                          <div>
                                            {t('pages.clients.detail.addedBy')}:{' '}
                                            {contact.added_by_user_name}
                                          </div>
                                        )}
                                        {contact.created_at && (
                                          <div>
                                            {t('pages.clients.detail.addedDate')}:{' '}
                                            {formatDate(contact.created_at ?? undefined)}
                                          </div>
                                        )}
                                        {!contact.added_by_user_name && !contact.created_at && (
                                          <div>-</div>
                                        )}
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                  {(contact.isPhone || looksLikePhone(contact.contactValue)) &&
                                    renderLinkedContactBadges(contact.contactValue, 'start')}
                                </div>
                              </td>
                              <td className="py-2 pr-3">
                                {(contact.isPhone || looksLikePhone(contact.contactValue)) &&
                                  contact.contactValue && (
                                    <div className="flex items-center gap-1 md:gap-2">
                                      <PermissionGuard
                                        permission={PERMISSIONS.COMMUNICATION.MAKE_CALLS}
                                      >
                                        <button
                                          disabled={!user?.is_agent || !user?.asterisk_extension}
                                          onClick={() => {
                                            if (isCallActive()) {
                                              toast.warning(
                                                t(
                                                  'pages.clients.modals.callDialog.callInProgress'
                                                ) ||
                                                  'Another call or recording is already in progress. Please finish or close it first.'
                                              )
                                              return
                                            }
                                            setSelectedPhoneForCall(contact.contactValue)
                                            setOpenCallModal('call-dialog')
                                            setIsCallModalOpen(true)
                                          }}
                                          className="text-primary-500 flex h-[20px] w-[20px] cursor-pointer items-center justify-center hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                          <Icons.Headset size={16} className="flex-shrink-0" />
                                        </button>
                                      </PermissionGuard>
                                      <PermissionGuard
                                        permission={PERMISSIONS.COMMUNICATION.SEND_SMS}
                                      >
                                        <button
                                          onClick={() => {
                                            setSelectedPhoneForSMS(contact.contactValue)
                                            setIsSendSMSModalOpen(true)
                                          }}
                                          className="text-primary-500 flex h-[20px] w-[20px] cursor-pointer items-center justify-center hover:opacity-80"
                                        >
                                          <Icons.ChatFeedback01
                                            size={16}
                                            className="flex-shrink-0"
                                          />
                                        </button>
                                      </PermissionGuard>
                                      <PermissionGuard
                                        permission={PERMISSIONS.CLIENTS.CREATE_INTERACTIONS}
                                      >
                                        <button
                                          onClick={() => {
                                            setSelectedPhoneForNote(contact.contactValue)
                                            setIsNoteModalOpen(true)
                                          }}
                                          className="text-primary-500 flex h-[20px] w-[20px] cursor-pointer items-center justify-center hover:opacity-80"
                                        >
                                          <Icons.PencilEdit size={16} className="flex-shrink-0" />
                                        </button>
                                      </PermissionGuard>
                                    </div>
                                  )}
                              </td>
                              <td className="py-2 pr-3">
                                <span className="text-dark-500 font-medium tracking-[-0.24px]">
                                  {contact.contactTypeCode
                                    ? t(`contactTypes.${contact.contactTypeCode}`, {
                                        defaultValue: contact.contactType,
                                      })
                                    : contact.contactType}
                                </span>
                              </td>
                              <td className="py-2 pr-3">
                                <span className="text-dark-500 font-medium tracking-[-0.24px]">
                                  {contact.comment}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* Tab 4: Operators/Searchers */}
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
                                  const locale =
                                    i18n.language === 'uk'
                                      ? 'uk-UA'
                                      : i18n.language === 'ru'
                                        ? 'ru-RU'
                                        : 'en-GB'
                                  const date = new Date(String(timestamp)).toLocaleDateString(
                                    locale,
                                    {
                                      year: 'numeric',
                                      month: '2-digit',
                                      day: '2-digit',
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
                                    new Date(b as string).getTime() -
                                    new Date(a as string).getTime()
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
                                    const locale =
                                      i18n.language === 'uk'
                                        ? 'uk-UA'
                                        : i18n.language === 'ru'
                                          ? 'ru-RU'
                                          : 'en-GB'
                                    const date = new Date(String(timestamp)).toLocaleDateString(
                                      locale,
                                      {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
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
                                              'call_id' in call
                                                ? (call.call_id as string)
                                                : undefined
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
                                            setIsCallRecordingModalOpen={
                                              setIsCallRecordingModalOpen
                                            }
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
                                    const rate =
                                      total > 0 ? Math.round((delivered / total) * 100) : 0
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
                                    const locale =
                                      i18n.language === 'uk'
                                        ? 'uk-UA'
                                        : i18n.language === 'ru'
                                          ? 'ru-RU'
                                          : 'en-GB'
                                    const date = new Date(String(timestamp)).toLocaleDateString(
                                      locale,
                                      {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
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

                {/* Tab 6: Documents — accordion grouped by debt */}
                {activeRightCardTab === 'documents' && (
                  <div className="flex flex-1 flex-col items-start gap-2.5 self-stretch p-3 md:p-6">
                    {isDocumentsLoading ? (
                      <TableSkeleton columns={4} rows={3} />
                    ) : (
                      <DocumentsAccordion
                        documents={client.documents}
                        loans={client.loans}
                        clientId={clientId}
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
                {t('pages.clients.detail.spamCallHistory')}
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
              <TableSkeleton columns={12} rows={3} className="w-full" />
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
              <div className="w-full overflow-x-auto">
                <DataTable
                  columns={activityColumns}
                  data={client.activities.slice(0, 10)}
                  className="w-full"
                  tableClassName="w-max min-w-full"
                />
              </div>
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
              <TableSkeleton columns={2} rows={3} className="w-full" />
            ) : dialHistory.length === 0 ? (
              <div className="flex flex-col items-center gap-4 self-stretch py-8 md:gap-6">
                <div className="flex flex-col items-center justify-center gap-4 self-stretch sm:flex-row md:gap-6">
                  <Icons.FileRemove size={48} className="text-gray-500" strokeWidth={0.5} />
                  <p className="text-dark-500 text-center text-xl leading-tight font-light tracking-[-0.48px] md:text-2xl">
                    {t('pages.clients.detail.noSpamCallHistory')}
                  </p>
                </div>
              </div>
            ) : (
              <DataTable columns={dialHistoryColumns} data={dialHistory} className="w-full" />
            ))}
        </div>

        {/* Edit Interaction Modal */}
        <EditInteractionModal
          open={isEditInteractionModalOpen}
          onClose={() => {
            setIsEditInteractionModalOpen(false)
            setEditingInteraction(null)
          }}
          interaction={editingInteraction}
          loanOptions={loans
            .filter((loan) => loan.status.toLowerCase() !== 'closed')
            .map((loan) => ({
              id: loan.id,
              contractNumber: loan.contract_number ?? String(loan.id),
            }))}
          isSaving={isUpdating}
          onSave={(data) => {
            if (!editingInteraction) return
            updateInteraction(
              { clientId, interactionId: editingInteraction.id, data },
              {
                onSuccess: () => {
                  setIsEditInteractionModalOpen(false)
                  setEditingInteraction(null)
                },
              }
            )
          }}
        />

        {/* Add Note Modal */}
        <AddNoteModal
          open={isNoteModalOpen}
          onClose={() => {
            setIsNoteModalOpen(false)
            setSelectedPhoneForNote('')
          }}
          phoneNumber={formatUkrainePhoneForDisplay(
            selectedPhoneForNote || client.phones?.[0]?.number || '',
            ''
          )}
          clientId={clientId}
          loanOptions={loans
            .filter((loan) => loan.status.toLowerCase() !== 'closed')
            .map((loan) => ({
              id: loan.id,
              contractNumber: loan.contract_number ?? String(loan.id),
            }))}
          onSave={(data) => {
            const selectedPhone = selectedPhoneForNote || client.phones?.[0]?.number || ''
            const fallbackPhone = selectedPhone.trim() || undefined
            const normalizedPhoneForPayload =
              normalizeUkrainePhoneToDb(selectedPhone) ?? fallbackPhone
            createNote({
              clientId,
              data: {
                ...data,
                // Persist phone in canonical DB format so interaction history always has it.
                phone_used: normalizedPhoneForPayload,
              },
            })
            setIsNoteModalOpen(false)
          }}
        />

        {/* Add Task Modal */}
        {isTaskModalOpen && (
          <AddTaskModal
            open={isTaskModalOpen}
            clientId={clientId}
            onClose={() => setIsTaskModalOpen(false)}
          />
        )}

        {/* Call Dialog Modal */}
        <CallDialogModal
          open={isCallModalOpen}
          onClose={() => {
            handleCloseCallModal()
            setSelectedPhoneForCall('')
          }}
          clientName={client.fullName}
          phoneNumber={selectedPhoneForCall || client.phones?.[0]?.number || ''}
          callId={currentCallId}
          initialCallType={activeCallType}
          initialState="initial"
          error={callError}
          isLoading={isOriginatingCall}
          isCallCooldown={isCallCooldown}
          cooldownSecondsRemaining={cooldownSecondsRemaining}
          telephonyUnavailable={isTelephonyUnavailable}
          onCallStart={(callType: CallType, dialPhone: string) => {
            if (!dialPhone?.trim()) return
            handleOriginateCall(dialPhone, client.fullName, client.id.toString(), callType)
          }}
          onCallEnd={(_duration: number, _status: CallStatus) => {
            handleCallEnd()
          }}
          onRetry={handleClearCallError}
          onSpamCall={(phone) => addSpamCall(phone)}
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

        {/* Close Loan Confirmation Modal */}
        <Modal
          open={closeLoanConfirm !== null}
          onClose={() => setCloseLoanConfirm(null)}
          maxWidth="md"
        >
          <ModalHeader
            icon={
              <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
                <Icons.CancelCircle size={20} className="text-dark-500" strokeWidth={2} />
              </div>
            }
            title={t('pages.clients.detail.closeLoan')}
          />
          <ModalContent>
            <p className="text-dark-500 text-base font-light">
              {t(
                'pages.clients.detail.confirmCloseLoan',
                'Are you sure you want to close this loan? This action cannot be undone.'
              )}
            </p>
          </ModalContent>
          <ModalFooter>
            <Button
              type="button"
              variant="cancel"
              onClick={() => setCloseLoanConfirm(null)}
              disabled={isClosingDebt}
              className="h-[45px] flex-1 text-sm"
            >
              {t('actions.cancel')}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                if (closeLoanConfirm !== null) {
                  closeDebt({ clientId, debtId: closeLoanConfirm })
                  setCloseLoanConfirm(null)
                }
              }}
              disabled={isClosingDebt}
              className="h-[45px] flex-1 text-sm"
            >
              {isClosingDebt
                ? t('actions.saving', 'Saving...')
                : t('pages.clients.detail.closeLoan')}
            </Button>
          </ModalFooter>
        </Modal>

        {/* Complete RR Confirmation Modal */}
        <Modal
          open={completeRrConfirm !== null}
          onClose={() => setCompleteRrConfirm(null)}
          maxWidth="md"
        >
          <ModalHeader
            icon={
              <div className="bg-primary-400 flex h-8 w-8 items-center justify-center rounded-full">
                <Icons.Success size={20} className="text-dark-500" strokeWidth={2} />
              </div>
            }
            title={t('pages.clients.detail.completeRR', 'Complete RR')}
          />
          <ModalContent>
            <p className="text-dark-500 text-base font-light">
              {t(
                'pages.clients.detail.confirmCompleteRR',
                'Are you sure you want to mark this restructuring agreement as completed?'
              )}
            </p>
          </ModalContent>
          <ModalFooter>
            <Button
              type="button"
              variant="cancel"
              onClick={() => setCompleteRrConfirm(null)}
              disabled={isCompletingRa}
              className="h-[45px] flex-1 text-sm"
            >
              {t('actions.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (completeRrConfirm !== null) {
                  completeRa({ clientId, raId: completeRrConfirm })
                  setCompleteRrConfirm(null)
                }
              }}
              disabled={isCompletingRa}
              className="h-[45px] flex-1 text-sm"
            >
              {isCompletingRa
                ? t('actions.saving', 'Saving...')
                : t('pages.clients.detail.completeRR', 'Complete RR')}
            </Button>
          </ModalFooter>
        </Modal>

        {/* Connect RR Modal */}
        <Modal open={isConnectRrOpen} onClose={() => setIsConnectRrOpen(false)} maxWidth="lg">
          <ModalHeader
            icon={
              <div className="bg-primary-300 flex h-10 w-10 items-center justify-center rounded-full sm:h-12 sm:w-12">
                <Icons.Calculate size={20} className="text-dark-500 sm:size-6" strokeWidth={1.5} />
              </div>
            }
            title={t('pages.clients.detail.connectRR')}
          />
          <ModalContent>
            <div className="flex flex-col gap-4">
              {/* Loan Selection */}
              <div>
                <label className="text-dark-500 mb-1 block text-sm font-medium">
                  {t('pages.clients.detail.rrSelectLoan')} *
                </label>
                <Select
                  value={connectRrForm.debtId}
                  onValueChange={(val) => setConnectRrForm((prev) => ({ ...prev, debtId: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('pages.clients.detail.rrSelectLoanPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {loans.map((loan) => (
                      <SelectItem key={loan.id} value={String(loan.id)}>
                        {loan.contract_number} — {loan.seller_company}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Connection Date & Total RR Amount */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <DateSelect
                  label={`${t('pages.clients.detail.rrConnectionDate')} *`}
                  value={connectRrForm.connectionDate}
                  onChange={({ value }) =>
                    setConnectRrForm((prev) => ({ ...prev, connectionDate: value }))
                  }
                  format="dd-MM-yyyy"
                  placeholder={t('pages.clients.detail.rrConnectionDate')}
                />
                <Input
                  label={`${t('pages.clients.detail.rrRestructuringAmount')} *`}
                  type="number"
                  min={0}
                  step={0.01}
                  value={connectRrForm.totalAmount}
                  onChange={(e) =>
                    setConnectRrForm((prev) => ({ ...prev, totalAmount: e.target.value }))
                  }
                  placeholder="0.00"
                />
              </div>
              {/* Number of Payments */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <Input
                  label={`${t('pages.clients.detail.rrNumPayments')} *`}
                  type="number"
                  min={1}
                  max={12}
                  value={connectRrForm.numPayments}
                  onChange={(e) => {
                    const num = Math.max(1, Math.min(12, Number(e.target.value) || 1))
                    setConnectRrForm((prev) => {
                      const payments = [...prev.payments]
                      while (payments.length < num) payments.push({ date: null, amount: '' })
                      return { ...prev, numPayments: num, payments: payments.slice(0, num) }
                    })
                  }}
                />
              </div>
              {/* Payment Schedule */}
              <div className="pt-2">
                <h3 className="text-dark-500 mb-2 text-sm font-medium sm:text-base">
                  {t('pages.clients.detail.rrPaymentSchedule')}
                </h3>
                <div className="flex flex-col gap-3">
                  {connectRrForm.payments.map((payment, idx) => (
                    <div key={idx} className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                      <DateSelect
                        label={`${t('pages.clients.detail.rrPaymentDate')} ${idx + 1} *`}
                        value={payment.date}
                        onChange={({ value }) => {
                          setConnectRrForm((prev) => {
                            const payments = [...prev.payments]
                            payments[idx] = { ...payments[idx], date: value }
                            return { ...prev, payments }
                          })
                        }}
                        format="dd-MM-yyyy"
                        placeholder={t('pages.clients.detail.rrPaymentDate')}
                      />
                      <Input
                        label={`${t('pages.clients.detail.rrPaymentAmount')} ${idx + 1} *`}
                        type="number"
                        min={0}
                        step={0.01}
                        value={payment.amount}
                        onChange={(e) => {
                          setConnectRrForm((prev) => {
                            const payments = [...prev.payments]
                            payments[idx] = { ...payments[idx], amount: e.target.value }
                            return { ...prev, payments }
                          })
                        }}
                        placeholder="0.00"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {connectRrError && (
              <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                {connectRrError}
              </div>
            )}
          </ModalContent>
          <ModalFooter>
            <Button
              variant="cancel"
              size="sm"
              onClick={() => setIsConnectRrOpen(false)}
              className="w-full rounded-md sm:w-auto"
            >
              {t('actions.cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={isCreatingRr}
              onClick={() => {
                const d = 'pages.clients.detail'
                setConnectRrError(null)
                // Validation
                if (!connectRrForm.debtId) {
                  setConnectRrError(t(`${d}.rrValidationLoanRequired`))
                  return
                }
                if (!connectRrForm.connectionDate) {
                  setConnectRrError(t(`${d}.rrValidationConnectionDateRequired`))
                  return
                }
                if (!connectRrForm.totalAmount || parseFloat(connectRrForm.totalAmount) <= 0) {
                  setConnectRrError(t(`${d}.rrValidationAmountRequired`))
                  return
                }
                for (let i = 0; i < connectRrForm.payments.length; i++) {
                  if (!connectRrForm.payments[i].date) {
                    setConnectRrError(t(`${d}.rrValidationPaymentDateRequired`, { num: i + 1 }))
                    return
                  }
                  if (
                    !connectRrForm.payments[i].amount ||
                    parseFloat(connectRrForm.payments[i].amount) <= 0
                  ) {
                    setConnectRrError(t(`${d}.rrValidationPaymentAmountRequired`, { num: i + 1 }))
                    return
                  }
                }
                const totalAmount = parseFloat(connectRrForm.totalAmount)
                const paymentsSum = connectRrForm.payments.reduce(
                  (sum, p) => sum + (parseFloat(p.amount) || 0),
                  0
                )
                if (Math.abs(paymentsSum - totalAmount) > 0.01) {
                  setConnectRrError(
                    t(`${d}.rrValidationSumMismatch`, {
                      sum: paymentsSum.toFixed(2),
                      total: totalAmount.toFixed(2),
                    })
                  )
                  return
                }

                const formatDate = (dt: Date | null) => {
                  if (!dt) return null
                  const y = dt.getFullYear()
                  const m = String(dt.getMonth() + 1).padStart(2, '0')
                  const day = String(dt.getDate()).padStart(2, '0')
                  return `${y}-${m}-${day}`
                }
                createRr(
                  {
                    clientId,
                    data: {
                      debt_id: parseInt(connectRrForm.debtId),
                      connection_date: formatDate(connectRrForm.connectionDate),
                      restructuring_amount: totalAmount,
                      num_payments: connectRrForm.numPayments,
                      payments: connectRrForm.payments.map((p) => ({
                        payment_date: formatDate(p.date),
                        payment_amount: parseFloat(p.amount),
                      })),
                    },
                  },
                  {
                    onSuccess: () => {
                      toast.success(t(`${d}.connectRRSuccess`))
                      setIsConnectRrOpen(false)
                    },
                    onError: (error) => {
                      const detail = (
                        error as import('axios').AxiosError<{
                          detail?: string | Array<{ msg?: string }>
                        }>
                      )?.response?.data?.detail
                      let message = t(
                        `${d}.connectRRError`,
                        t('errors.somethingWentWrong', 'Something went wrong')
                      )
                      if (typeof detail === 'string') {
                        message = detail
                      } else if (Array.isArray(detail) && detail.length > 0) {
                        message = detail
                          .map((e) => e.msg || '')
                          .filter(Boolean)
                          .join('; ')
                      }
                      setConnectRrError(message)
                    },
                  }
                )
              }}
              className="w-full rounded-md sm:w-auto"
            >
              {isCreatingRr ? '...' : t('pages.clients.detail.connectRR')}
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </TooltipProvider>
  )
}

export default ClientDetailPage
