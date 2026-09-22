import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DateSelect } from '@/components/ui/DateSelect'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { Icons } from '@/lib/icons'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select'
import { useQueryClient } from '@tanstack/react-query'
import { useHasPermission } from '@/hooks'
import { PERMISSIONS } from '@/constants/permissions'
import { useUbkiAvailable } from '@/features/ubki'
import { piiProps } from '@/lib/openreplay/pii'
import {
  useClientProfile,
  useUpdateClient,
  useCreateAddress,
  useUpdateAddress,
  useDeleteAddress,
  useUpdateEmployment,
  useUpdatePassport,
  clientKeys,
} from '@/features/clients/hooks/useClients'
import type {
  ClientProfileResponse,
  CreateAddressRequest,
  UpdateAddressRequest,
  UpdateClientRequest,
} from '@/features/clients/api/types'

export interface EditClientModalProps {
  open: boolean
  clientId: number
  onClose: () => void
}

const MARITAL_STATUSES = ['1', '2', '3', '4', '5'] as const

const EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'contract',
  'student',
  'self_employed',
  'unemployed',
  'retired',
  'other',
] as const

const ADDRESS_TYPES = ['registration', 'actual'] as const
const ADDRESS_TYPE_KEYS: Record<string, string> = {
  registration: 'pages.clients.detail.registrationAddress',
  actual: 'pages.clients.detail.personalAddress',
}

function extractErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as AxiosError<{ detail?: string | Array<{ msg?: string }> }>)?.response
    ?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((e) => e.msg).join(', ')
  return fallback
}

/** When first/last are missing (legacy imports), split full_name as "First [Middle…] Last". */
function legacyNamePartsFromFullName(fullName: string): {
  first: string
  middle: string
  last: string
} {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return { first: '', middle: '', last: '' }
  if (tokens.length === 1) return { first: tokens[0], middle: '', last: '' }
  if (tokens.length === 2) return { first: tokens[0], middle: '', last: tokens[1] }
  return {
    first: tokens[0],
    middle: tokens.slice(1, -1).join(' '),
    last: tokens[tokens.length - 1]!,
  }
}

function dateToYmd(date: Date | null): string {
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function ymdToDate(value?: string): Date | null {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

interface EditFormProps {
  profile: ClientProfileResponse
  clientId: number
}

function EditForm({ profile, clientId }: EditFormProps) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const { mutateAsync: updateClientAsync, isPending: isSavingPersonal } = useUpdateClient()
  const { mutate: createAddress, isPending: isCreatingAddress } = useCreateAddress()
  const { mutate: updateAddress, isPending: isUpdatingAddress } = useUpdateAddress()
  const { mutate: deleteAddress } = useDeleteAddress()
  const {
    mutate: updateEmployment,
    mutateAsync: updateEmploymentAsync,
    isPending: isSavingWork,
  } = useUpdateEmployment()
  const {
    mutate: updatePassport,
    mutateAsync: updatePassportAsync,
    isPending: isSavingPassport,
  } = useUpdatePassport()
  const [isSavingAll, setIsSavingAll] = useState(false)
  const canEditAll = useHasPermission(PERMISSIONS.CLIENTS.EDIT)

  // Personal info — initialized from profile (component remounts via key when profile changes)
  const legacyNames =
    !profile.first_name?.trim() && !profile.last_name?.trim() && profile.full_name?.trim()
      ? legacyNamePartsFromFullName(profile.full_name)
      : null
  const [firstName, setFirstName] = useState(profile.first_name?.trim() || legacyNames?.first || '')
  const [lastName, setLastName] = useState(profile.last_name?.trim() || legacyNames?.last || '')
  const [middleName, setMiddleName] = useState(
    profile.middle_name?.trim() || legacyNames?.middle || ''
  )
  const [email, setEmail] = useState(profile.email || '')
  // Moved here from the client panel, but kept as its own single-field write
  // rather than folded into the personal payload. Two reasons: the personal
  // save aborts client-side when the name is blank or the tax id is not ten
  // digits, which would leave a consent flag unsettable for those records; and
  // riding along in every save would write this mount-time value back over a
  // change someone else made while the form was open.
  const [doNotSendToUbki, setDoNotSendToUbki] = useState(profile.do_not_send_to_ubki ?? false)
  const { mutate: updateUbkiOptOut, isPending: isSavingUbkiOptOut } = useUpdateClient()
  const ubkiAvailable = useUbkiAvailable()

  const handleToggleUbkiOptOut = (checked: boolean) => {
    const previous = doNotSendToUbki
    setDoNotSendToUbki(checked)
    updateUbkiOptOut(
      { id: clientId, data: { do_not_send_to_ubki: checked } },
      {
        onSuccess: () => {
          invalidateClientCaches()
          // Direction-specific keys: the optOut/optIn pair above them is
          // bulk-phrased ("{{count}} client(s) …"), and passing a ternary as
          // i18next's defaultValue does nothing once the key resolves — every
          // toggle reported "opted out", including re-enabling.
          toast.success(
            checked
              ? t('pages.clients.detail.ubki.toasts.optOutSingle', 'Client opted out of UBKI')
              : t('pages.clients.detail.ubki.toasts.optInSingle', 'Client re-enabled for UBKI')
          )
        },
        onError: (error) => {
          setDoNotSendToUbki(previous)
          toast.error(
            extractErrorMessage(
              error,
              t('pages.clients.detail.ubki.toasts.submitError', 'Failed to update UBKI opt-out')
            )
          )
        },
      }
    )
  }
  const [dateOfBirth, setDateOfBirth] = useState(profile.date_of_birth || '')
  const [maritalStatus, setMaritalStatus] = useState(profile.marital_status || '')
  const [familyMembers, setFamilyMembers] = useState(profile.family_members_count?.toString() || '')
  const [incomeLevel, setIncomeLevel] = useState(profile.income_level || '')
  const [taxId, setTaxId] = useState(profile.tax_id || '')
  /**
   * 🔴 ИНН обязателен НЕ всегда — с ревизии 176 client-service.
   *
   * Клиента, которого кредитный модуль опознал по подтверждённому в кабинете
   * e-mail, ИНН не имеет вовсе, и заполнить поле нечем. Безусловная проверка
   * «ровно десять цифр» означала для такого человека, что его карточку нельзя
   * отредактировать совсем: не сохранить ни телефон, ни дату рождения, ни
   * e-mail, — и отказ показывался общим текстом, без причины.
   *
   * Умолчание `'tin'` — то самое, которое чужая сторона объявила
   * `server_default`: на бэкенде старее ревизии 176 поля в теле нет, и
   * поведение обязано остаться прежним.
   */
  const tinRequired = (profile.identity_key ?? 'tin') === 'tin'

  /**
   * 🔴 Необязательный — не значит «выбрасываемый».
   *
   * У человека, опознанного по e-mail, ИНН может ПОЯВИТЬСЯ, и оператор его
   * впишет. Правило «не обязателен» закрывало только снятие TIN, которое
   * client-service отвергает; молча терять введённое значение оно не
   * разрешало. Поэтому: пусто — ключ не шлём (снятия не будет), непусто —
   * шлём и проверяем теми же десятью цифрами, что и у всех.
   */
  const tinProvided = (value: string) => value.trim() !== ''
  const tinInvalid = (value: string) => {
    const trimmed = value.trim()
    if (!tinRequired && !tinProvided(trimmed)) return false
    return !/^\d{10}$/.test(trimmed)
  }

  // Passport/document info
  const [documentType, setDocumentType] = useState(profile.passport?.document_type || '')
  const [passportSeries, setPassportSeries] = useState(profile.passport?.series || '')
  const [passportNumber, setPassportNumber] = useState(profile.passport?.number || '')
  const [issuedBy, setIssuedBy] = useState(profile.passport?.issued_by || '')
  const [issuedDate, setIssuedDate] = useState(profile.passport?.issued_date || '')
  const [expiresDate, setExpiresDate] = useState(profile.passport?.expires_date || '')
  const [gender, setGender] = useState(profile.passport?.gender || '')

  // Work info — from employment sub-resource
  const [companyName, setCompanyName] = useState(profile.employment?.company_name || '')
  const [position, setPosition] = useState(profile.employment?.position || '')
  const [employmentType, setEmploymentType] = useState(profile.employment?.employment_type || '')
  const [workExperience, setWorkExperience] = useState(
    profile.employment?.work_experience_months?.toString() || ''
  )
  const [managerFullName, setManagerFullName] = useState(
    profile.employment?.manager_full_name || ''
  )
  const [workPhone, setWorkPhone] = useState(profile.employment?.work_phone || '')

  // Address form state
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [newAddress, setNewAddress] = useState<CreateAddressRequest>({
    address_type: 'actual',
    country: 'Ukraine',
    region: '',
    city: '',
    district: '',
    street: '',
    building: '',
    house_number: '',
    apartment: '',
    postal_code: '',
    housing_type: '',
    is_primary: false,
  })

  // Inline edit state for addresses
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null)
  const [editAddressData, setEditAddressData] = useState<UpdateAddressRequest>({})

  // Inline error state per section
  const [personalError, setPersonalError] = useState<string | null>(null)
  const [passportError, setPassportError] = useState<string | null>(null)
  const [workError, setWorkError] = useState<string | null>(null)
  const [addressError, setAddressError] = useState<string | null>(null)

  const emailTrimmed = email.trim()
  const emailChanged = emailTrimmed !== (profile.email ?? '').trim()

  const invalidateClientCaches = () => {
    queryClient.invalidateQueries({ queryKey: clientKeys.profile(clientId), exact: true })
    queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId), exact: true })
    queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
    queryClient.invalidateQueries({ queryKey: clientKeys.prioritySummary() })
  }

  const handleSavePersonalOnly = async () => {
    setPersonalError(null)
    if (!canEditAll) return

    const fn = firstName.trim()
    const ln = lastName.trim()
    const tid = taxId.trim()
    if (!fn || !ln) {
      setPersonalError(t('pages.clients.editModal.saveError'))
      return
    }
    if (tinInvalid(tid)) {
      setPersonalError(t('pages.clients.editModal.taxIdInvalid'))
      return
    }

    const data: UpdateClientRequest = {
      first_name: fn,
      last_name: ln,
      middle_name: middleName.trim() ? middleName.trim() : undefined,
      // Send the address only when the operator changed it: imports left
      // invalid addresses in the data and ClientUpdate validates with
      // EmailStr, so resubmitting an untouched one rejects the whole save
      // and blocks edits to unrelated fields. Clearing sends null rather
      // than undefined — the backend applies dict(exclude_unset=True), so
      // undefined would silently leave the old address in place.
      email: emailChanged ? emailTrimmed || null : undefined,
      date_of_birth: dateOfBirth || undefined,
      marital_status: maritalStatus || undefined,
      family_members_count: familyMembers.trim() !== '' ? Number(familyMembers) : undefined,
      income_level: incomeLevel.trim() ? incomeLevel.trim() : undefined,
      // Ключа в теле НЕТ вовсе только тогда, когда ИНН не обязателен И поле
      // пустое: client-service отвечает «TIN … cannot be removed» на попытку
      // снять его. Введённое значение уходит всегда — иначе оператор получил
      // бы «сохранено» на правку, которой никуда не доехала. Расширение
      // объекта, а не `undefined`: ключ со значением `undefined` невидим по
      // проводу, но виден читателю кода как «поле отправляется».
      ...(tinRequired || tinProvided(tid) ? { tax_id: tid } : {}),
    }

    try {
      await updateClientAsync({ id: clientId, data })
      toast.success(t('pages.clients.editModal.saveSuccess'))
      invalidateClientCaches()
    } catch (error) {
      setPersonalError(extractErrorMessage(error, t('pages.clients.editModal.saveError')))
    }
  }

  const handleSaveWork = () => {
    setWorkError(null)
    updateEmployment(
      {
        clientId,
        data: {
          company_name: companyName || undefined,
          position: position || undefined,
          employment_type: employmentType || undefined,
          work_experience_months: workExperience ? Number(workExperience) : undefined,
          manager_full_name: managerFullName || undefined,
          work_phone: workPhone || undefined,
        },
      },
      {
        onSuccess: async () => {
          toast.success(t('pages.clients.editModal.saveSuccess'))
          await queryClient.invalidateQueries({
            queryKey: clientKeys.profile(clientId),
            exact: true,
          })
          queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId), exact: true })
        },
        onError: (error) => {
          setWorkError(extractErrorMessage(error, t('pages.clients.editModal.saveError')))
        },
      }
    )
  }

  const handleSavePassport = () => {
    setPassportError(null)
    updatePassport(
      {
        clientId,
        data: {
          document_type: documentType || undefined,
          series: passportSeries || undefined,
          number: passportNumber || undefined,
          issued_by: issuedBy || undefined,
          issued_date: issuedDate || undefined,
          expires_date: expiresDate || undefined,
          gender: gender || undefined,
        },
      },
      {
        onSuccess: async () => {
          toast.success(t('pages.clients.editModal.saveSuccess'))
          await queryClient.invalidateQueries({
            queryKey: clientKeys.profile(clientId),
            exact: true,
          })
          queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId), exact: true })
        },
        onError: (error) => {
          setPassportError(extractErrorMessage(error, t('pages.clients.editModal.saveError')))
        },
      }
    )
  }

  /**
   * Fire Personal + Passport + Work saves in parallel via Promise.allSettled.
   *
   * Same per-section validation as the individual save buttons. Personal info
   * is the only section with synchronous validation (first/last/tax_id
   * required); if it fails, we surface the error and abort BEFORE firing any
   * mutation — same UX as the per-section Save Personal button.
   *
   * Partial-failure handling: each section's error message is rendered in its
   * own block, and the toast indicates how many sections succeeded.
   */
  const handleSaveAll = async () => {
    if (!canEditAll) return

    setPersonalError(null)
    setPassportError(null)
    setWorkError(null)

    const fn = firstName.trim()
    const ln = lastName.trim()
    const tid = taxId.trim()
    if (!fn || !ln) {
      setPersonalError(t('pages.clients.editModal.saveError'))
      return
    }
    if (tinInvalid(tid)) {
      setPersonalError(t('pages.clients.editModal.taxIdInvalid'))
      return
    }

    const personalData: UpdateClientRequest = {
      first_name: fn,
      last_name: ln,
      middle_name: middleName.trim() ? middleName.trim() : undefined,
      // Send the address only when the operator changed it: imports left
      // invalid addresses in the data and ClientUpdate validates with
      // EmailStr, so resubmitting an untouched one rejects the whole save
      // and blocks edits to unrelated fields. Clearing sends null rather
      // than undefined — the backend applies dict(exclude_unset=True), so
      // undefined would silently leave the old address in place.
      email: emailChanged ? emailTrimmed || null : undefined,
      date_of_birth: dateOfBirth || undefined,
      marital_status: maritalStatus || undefined,
      family_members_count: familyMembers.trim() !== '' ? Number(familyMembers) : undefined,
      income_level: incomeLevel.trim() ? incomeLevel.trim() : undefined,
      // Ключа в теле НЕТ вовсе только тогда, когда ИНН не обязателен И поле
      // пустое: client-service отвечает «TIN … cannot be removed» на попытку
      // снять его. Введённое значение уходит всегда — иначе оператор получил
      // бы «сохранено» на правку, которой никуда не доехала. Расширение
      // объекта, а не `undefined`: ключ со значением `undefined` невидим по
      // проводу, но виден читателю кода как «поле отправляется».
      ...(tinRequired || tinProvided(tid) ? { tax_id: tid } : {}),
    }

    setIsSavingAll(true)
    const results = await Promise.allSettled([
      updateClientAsync({ id: clientId, data: personalData }),
      updateEmploymentAsync({
        clientId,
        data: {
          company_name: companyName || undefined,
          position: position || undefined,
          employment_type: employmentType || undefined,
          work_experience_months: workExperience ? Number(workExperience) : undefined,
          manager_full_name: managerFullName || undefined,
          work_phone: workPhone || undefined,
        },
      }),
      updatePassportAsync({
        clientId,
        data: {
          document_type: documentType || undefined,
          series: passportSeries || undefined,
          number: passportNumber || undefined,
          issued_by: issuedBy || undefined,
          issued_date: issuedDate || undefined,
          expires_date: expiresDate || undefined,
          gender: gender || undefined,
        },
      }),
    ])
    setIsSavingAll(false)

    const [personalRes, workRes, passportRes] = results
    if (personalRes.status === 'rejected') {
      setPersonalError(
        extractErrorMessage(personalRes.reason, t('pages.clients.editModal.saveError'))
      )
    }
    if (workRes.status === 'rejected') {
      setWorkError(extractErrorMessage(workRes.reason, t('pages.clients.editModal.saveError')))
    }
    if (passportRes.status === 'rejected') {
      setPassportError(
        extractErrorMessage(passportRes.reason, t('pages.clients.editModal.saveError'))
      )
    }

    const failed = results.filter((r) => r.status === 'rejected').length
    if (failed === 0) {
      toast.success(t('pages.clients.editModal.saveAllSuccess'))
    } else if (failed === results.length) {
      toast.error(t('pages.clients.editModal.saveAllError'))
    } else {
      toast.error(t('pages.clients.editModal.saveAllPartial'))
    }

    if (results.some((r) => r.status === 'fulfilled')) {
      invalidateClientCaches()
    }
  }

  const handleCreateAddress = () => {
    setAddressError(null)
    createAddress(
      { clientId, data: newAddress },
      {
        onSuccess: () => {
          toast.success(t('pages.clients.editModal.addressCreated'))
          setShowAddressForm(false)
          setNewAddress({
            address_type: 'actual',
            country: 'Ukraine',
            region: '',
            city: '',
            district: '',
            street: '',
            building: '',
            house_number: '',
            apartment: '',
            postal_code: '',
            housing_type: '',
            is_primary: false,
          })
        },
        onError: (error) => {
          setAddressError(extractErrorMessage(error, 'Failed to add address'))
        },
      }
    )
  }

  const handleDeleteAddress = (addressId: number) => {
    setAddressError(null)
    deleteAddress(
      { clientId, addressId },
      {
        onSuccess: () => {
          toast.success(t('pages.clients.editModal.addressDeleted'))
        },
        onError: (error) => {
          setAddressError(extractErrorMessage(error, 'Failed to delete address'))
        },
      }
    )
  }

  const handleStartEditAddress = (address: ClientProfileResponse['addresses'][number]) => {
    setEditingAddressId(address.id)
    setEditAddressData({
      address_type: address.address_type,
      region: address.region || '',
      city: address.city || '',
      district: address.district || '',
      street: address.street || '',
      building: address.building || '',
      house_number: address.house_number || '',
      apartment: address.apartment || '',
      postal_code: address.postal_code || '',
      housing_type: address.housing_type || '',
      is_primary: address.is_primary,
    })
  }

  const handleUpdateAddress = () => {
    if (editingAddressId === null) return
    setAddressError(null)
    updateAddress(
      { clientId, addressId: editingAddressId, data: editAddressData },
      {
        onSuccess: () => {
          toast.success(t('pages.clients.editModal.addressUpdated'))
          setEditingAddressId(null)
          setEditAddressData({})
        },
        onError: (error) => {
          setAddressError(extractErrorMessage(error, t('pages.clients.editModal.saveError')))
        },
      }
    )
  }

  const isAnySectionSaving = isSavingAll || isSavingPersonal || isSavingWork || isSavingPassport

  return (
    <div className="flex flex-col gap-6">
      {/* Save All — fires Personal + Passport + Work in parallel. Faster than
          clicking each section's individual Save button sequentially when the
          operator has edited multiple sections at once. */}
      {canEditAll && (
        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={handleSaveAll}
            disabled={isAnySectionSaving}
            data-testid="edit-client-save-all"
            className="rounded-md"
          >
            {isSavingAll
              ? t('pages.clients.editModal.savingAll')
              : t('pages.clients.editModal.saveAll')}
          </Button>
        </div>
      )}

      {/* Section 1: Personal Information */}
      <div className="flex flex-col items-start gap-2 self-stretch">
        <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
          {t('pages.clients.editModal.personalInfo')}
        </span>
        <div className="border-border bg-card/50 flex flex-col items-start justify-center gap-4 self-stretch rounded-xl border p-4 sm:p-5 sm:px-6">
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.editModal.firstName')} <span className="text-error-500">*</span>
              </label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="disabled:bg-muted rounded-md"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.editModal.lastName')} <span className="text-error-500">*</span>
              </label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="disabled:bg-muted rounded-md"
              />
            </div>
          </div>

          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.editModal.middleName')}
              </label>
              <Input
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="disabled:bg-muted rounded-md"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.editModal.email')}
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="disabled:bg-muted rounded-md"
              />
            </div>
          </div>
          {ubkiAvailable && (
            <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
              <div className="flex flex-1 items-center justify-between gap-3">
                <label
                  className="text-foreground text-xs font-medium sm:text-sm"
                  title={t(
                    'pages.clients.detail.ubki.doNotSendHint',
                    'When enabled, this client is excluded from all UBKI submissions.'
                  )}
                >
                  {t('pages.clients.detail.ubki.doNotSendLabel', 'Do not send data to UBKI')}
                </label>
                <ToggleSwitch
                  checked={doNotSendToUbki}
                  onChange={handleToggleUbkiOptOut}
                  disabled={!canEditAll || isSavingUbkiOptOut}
                  ariaLabel={t(
                    'pages.clients.detail.ubki.doNotSendLabel',
                    'Do not send data to UBKI'
                  )}
                />
              </div>
            </div>
          )}
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.editModal.dateOfBirth')}
              </label>
              <DateSelect
                value={ymdToDate(dateOfBirth)}
                autoComplete="new-password"
                onChange={({ value }) => setDateOfBirth(dateToYmd(value))}
                disabled={!canEditAll}
                placeholder={t('pages.clients.modals.addNote.selectDate')}
                format="yyyy-MM-dd"
                className="border-border"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.maritalStatus')}
              </label>
              <Select value={maritalStatus} onValueChange={setMaritalStatus} disabled={!canEditAll}>
                <SelectTrigger className="text-foreground border-border bg-card disabled:bg-muted h-[45px] rounded-md border px-3 text-sm font-light disabled:cursor-not-allowed disabled:opacity-50">
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  {MARITAL_STATUSES.map((key) => (
                    <SelectItem key={key} value={key}>
                      {t(`pages.clients.detail.maritalStatuses.${key}`, { defaultValue: key })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.editModal.taxId')}
                {!tinRequired && (
                  // Подпись, а не блокировка: поле остаётся редактируемым,
                  // потому что ИНН у такого клиента может появиться.
                  <span className="text-muted-foreground ml-1 font-normal">
                    {t('credit.clientBlock.tinOptional')}
                  </span>
                )}
              </label>
              <Input
                data-testid="edit-client-tax-id"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="disabled:bg-muted rounded-md"
              />
            </div>
            <div className="hidden flex-1 sm:block" aria-hidden />
          </div>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.numberOfFamilyMembers')}
              </label>
              <Input
                type="number"
                value={familyMembers}
                onChange={(e) => setFamilyMembers(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="disabled:bg-muted rounded-md"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.incomeLevel')}
              </label>
              <Input
                value={incomeLevel}
                onChange={(e) => setIncomeLevel(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="disabled:bg-muted rounded-md"
              />
            </div>
          </div>
        </div>
      </div>
      {personalError && <p className="text-error-500 text-sm">{personalError}</p>}
      {canEditAll && (
        <div className="flex justify-end">
          <Button
            data-testid="edit-client-save-personal"
            variant="primary"
            onClick={handleSavePersonalOnly}
            disabled={
              isSavingPersonal || !firstName.trim() || !lastName.trim() || tinInvalid(taxId)
            }
            className="rounded-md"
          >
            {isSavingPersonal ? 'Saving...' : t('pages.clients.editModal.save')}
          </Button>
        </div>
      )}

      {/* Passport / document */}
      <div className="flex flex-col items-start gap-2 self-stretch">
        <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
          {t('pages.clients.detail.tabs.passport')}
        </span>
        <div className="border-border bg-card/50 flex flex-col items-start justify-center gap-4 self-stretch rounded-xl border p-4 sm:p-5 sm:px-6">
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.documentType')}
              </label>
              <Input
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="disabled:bg-muted rounded-md"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.passportSeries')}
              </label>
              <Input
                value={passportSeries}
                onChange={(e) => setPassportSeries(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="disabled:bg-muted rounded-md"
              />
            </div>
          </div>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.passportNumber')}
              </label>
              <Input
                value={passportNumber}
                onChange={(e) => setPassportNumber(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="disabled:bg-muted rounded-md"
              />
            </div>
            <div className="hidden flex-1 sm:block" aria-hidden />
          </div>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.issuedBy')}
              </label>
              <Input
                value={issuedBy}
                onChange={(e) => setIssuedBy(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="disabled:bg-muted rounded-md"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.issuedDate')}
              </label>
              <DateSelect
                value={ymdToDate(issuedDate)}
                autoComplete="new-password"
                onChange={({ value }) => setIssuedDate(dateToYmd(value))}
                disabled={!canEditAll}
                placeholder={t('pages.clients.modals.addNote.selectDate')}
                format="yyyy-MM-dd"
                className="border-border"
              />
            </div>
          </div>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.expiresDate')}
              </label>
              <DateSelect
                value={ymdToDate(expiresDate)}
                autoComplete="new-password"
                onChange={({ value }) => setExpiresDate(dateToYmd(value))}
                disabled={!canEditAll}
                placeholder={t('pages.clients.modals.addNote.selectDate')}
                format="yyyy-MM-dd"
                className="border-border"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.gender')}
              </label>
              <Input
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="disabled:bg-muted rounded-md"
              />
            </div>
          </div>
        </div>
      </div>
      {passportError && <p className="text-error-500 text-sm">{passportError}</p>}
      {canEditAll && (
        <div className="flex justify-end">
          <Button
            data-testid="edit-client-save-passport"
            variant="primary"
            onClick={handleSavePassport}
            disabled={isSavingPassport}
            className="rounded-md"
          >
            {isSavingPassport ? 'Saving...' : t('pages.clients.editModal.save')}
          </Button>
        </div>
      )}

      {/* Section 3: Work Information */}
      <div className="flex flex-col items-start gap-2 self-stretch">
        <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
          {t('pages.clients.detail.tabs.work')}
        </span>
        <div className="border-border bg-card/50 flex flex-col items-start justify-center gap-4 self-stretch rounded-xl border p-4 sm:p-5 sm:px-6">
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.organizationName')}
              </label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="disabled:bg-muted rounded-md"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.position')}
              </label>
              <Input
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="disabled:bg-muted rounded-md"
              />
            </div>
          </div>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.experience')}
              </label>
              <Input
                type="number"
                value={workExperience}
                onChange={(e) => setWorkExperience(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="disabled:bg-muted rounded-md"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.managerFullName')}
              </label>
              <Input
                value={managerFullName}
                onChange={(e) => setManagerFullName(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="disabled:bg-muted rounded-md"
              />
            </div>
          </div>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.employmentType')}
              </label>
              <Select
                value={employmentType}
                onValueChange={setEmploymentType}
                disabled={!canEditAll}
              >
                <SelectTrigger className="text-foreground border-border bg-card disabled:bg-muted h-[45px] rounded-md border px-3 text-sm font-light disabled:cursor-not-allowed disabled:opacity-50">
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map((key) => (
                    <SelectItem key={key} value={key}>
                      {t(`pages.clients.detail.employmentTypes.${key}`, { defaultValue: key })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-foreground text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.workPhone')}
              </label>
              <Input
                value={workPhone}
                onChange={(e) => setWorkPhone(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="disabled:bg-muted rounded-md"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Work Info */}
      {workError && <p className="text-error-500 text-sm">{workError}</p>}
      {canEditAll && (
        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={handleSaveWork}
            disabled={isSavingWork}
            className="rounded-md"
          >
            {isSavingWork ? 'Saving...' : t('pages.clients.editModal.save')}
          </Button>
        </div>
      )}

      {/* Section 4: Addresses */}
      <div className="flex flex-col items-start gap-2 self-stretch">
        <div className="flex w-full items-center justify-between">
          <span className="text-foreground text-sm leading-[150%] font-medium tracking-[-0.28px]">
            {t('pages.clients.editModal.addresses')}
          </span>
          {canEditAll && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Icons.PlusSignCircle size={16} />}
              onClick={() => setShowAddressForm(true)}
              className="text-xs"
            >
              {t('pages.clients.editModal.addAddress')}
            </Button>
          )}
        </div>
        {addressError && <p className="text-error-500 text-sm">{addressError}</p>}
        <div className="flex flex-col gap-3 self-stretch">
          {profile.addresses?.map((address) => (
            <div key={address.id}>
              {editingAddressId === address.id ? (
                <div className="border-border bg-card/50 flex flex-col gap-3 rounded-xl border p-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-foreground text-xs font-medium sm:text-sm">
                      {t('pages.clients.editModal.addressType')}
                    </label>
                    <Select
                      value={editAddressData.address_type || ''}
                      onValueChange={(value) =>
                        setEditAddressData({ ...editAddressData, address_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ADDRESS_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {ADDRESS_TYPE_KEYS[type] ? t(ADDRESS_TYPE_KEYS[type]) : type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                    <div className="flex flex-1 flex-col gap-1">
                      <label className="text-foreground text-xs font-medium sm:text-sm">
                        {t('pages.clients.editModal.region')}
                      </label>
                      <Input
                        value={editAddressData.region || ''}
                        onChange={(e) =>
                          setEditAddressData({ ...editAddressData, region: e.target.value })
                        }
                        inputSize="md"
                        className="rounded-md"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <label className="text-foreground text-xs font-medium sm:text-sm">
                        {t('pages.clients.editModal.city')}
                      </label>
                      <Input
                        value={editAddressData.city || ''}
                        onChange={(e) =>
                          setEditAddressData({ ...editAddressData, city: e.target.value })
                        }
                        inputSize="md"
                        className="rounded-md"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                    <div className="flex flex-1 flex-col gap-1">
                      <label className="text-foreground text-xs font-medium sm:text-sm">
                        {t('pages.clients.editModal.district')}
                      </label>
                      <Input
                        value={editAddressData.district || ''}
                        onChange={(e) =>
                          setEditAddressData({ ...editAddressData, district: e.target.value })
                        }
                        inputSize="md"
                        className="rounded-md"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <label className="text-foreground text-xs font-medium sm:text-sm">
                        {t('pages.clients.editModal.postalCode')}
                      </label>
                      <Input
                        value={editAddressData.postal_code || ''}
                        onChange={(e) =>
                          setEditAddressData({ ...editAddressData, postal_code: e.target.value })
                        }
                        inputSize="md"
                        className="rounded-md"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                    <div className="flex flex-1 flex-col gap-1">
                      <label className="text-foreground text-xs font-medium sm:text-sm">
                        {t('pages.clients.editModal.street')}
                      </label>
                      <Input
                        value={editAddressData.street || ''}
                        onChange={(e) =>
                          setEditAddressData({ ...editAddressData, street: e.target.value })
                        }
                        inputSize="md"
                        className="rounded-md"
                      />
                    </div>
                    <div className="flex w-24 flex-col gap-1">
                      <label className="text-foreground text-xs font-medium sm:text-sm">
                        {t('pages.clients.editModal.building')}
                      </label>
                      <Input
                        value={editAddressData.building || ''}
                        onChange={(e) =>
                          setEditAddressData({ ...editAddressData, building: e.target.value })
                        }
                        inputSize="md"
                        className="rounded-md"
                      />
                    </div>
                    <div className="flex w-24 flex-col gap-1">
                      <label className="text-foreground text-xs font-medium sm:text-sm">
                        {t('pages.clients.editModal.houseNumber')}
                      </label>
                      <Input
                        value={editAddressData.house_number || ''}
                        onChange={(e) =>
                          setEditAddressData({ ...editAddressData, house_number: e.target.value })
                        }
                        inputSize="md"
                        className="rounded-md"
                      />
                    </div>
                    <div className="flex w-24 flex-col gap-1">
                      <label className="text-foreground text-xs font-medium sm:text-sm">
                        {t('pages.clients.editModal.apartment')}
                      </label>
                      <Input
                        value={editAddressData.apartment || ''}
                        onChange={(e) =>
                          setEditAddressData({ ...editAddressData, apartment: e.target.value })
                        }
                        inputSize="md"
                        className="rounded-md"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                    <div className="flex flex-1 flex-col gap-1">
                      <label className="text-foreground text-xs font-medium sm:text-sm">
                        {t('pages.clients.editModal.housingType')}
                      </label>
                      <Input
                        value={editAddressData.housing_type || ''}
                        onChange={(e) =>
                          setEditAddressData({ ...editAddressData, housing_type: e.target.value })
                        }
                        inputSize="md"
                        className="rounded-md"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleUpdateAddress}
                      disabled={isUpdatingAddress}
                      className="rounded-md"
                    >
                      {isUpdatingAddress
                        ? t('pages.clients.editModal.saving')
                        : t('pages.clients.editModal.save')}
                    </Button>
                    <Button
                      variant="cancel"
                      size="sm"
                      onClick={() => {
                        setEditingAddressId(null)
                        setEditAddressData({})
                      }}
                      className="rounded-md"
                    >
                      {t('actions.close')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-border bg-card/50 flex items-center justify-between gap-3 rounded-xl border p-3 sm:p-4">
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground text-xs font-medium sm:text-sm">
                        {ADDRESS_TYPE_KEYS[address.address_type]
                          ? t(ADDRESS_TYPE_KEYS[address.address_type])
                          : address.address_type}
                      </span>
                      {address.is_primary && (
                        <span className="bg-primary-100 text-primary-700 rounded-full px-2 py-0.5 text-xs">
                          {t('pages.clients.editModal.isPrimary')}
                        </span>
                      )}
                    </div>
                    <span className="text-foreground text-xs font-light sm:text-sm" {...piiProps}>
                      {address.full_address ||
                        [address.city, address.street, address.building].filter(Boolean).join(', ')}
                    </span>
                  </div>
                  {canEditAll && (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        data-testid="edit-address-btn"
                        aria-label={t('pages.clients.editModal.editAddress')}
                        onClick={() => handleStartEditAddress(address)}
                        className="text-muted-foreground transition-colors hover:text-blue-500"
                      >
                        <Icons.PencilEdit size={16} strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        data-testid="delete-address-btn"
                        aria-label={t('pages.clients.editModal.deleteAddress')}
                        onClick={() => handleDeleteAddress(address.id)}
                        className="text-muted-foreground transition-colors hover:text-red-500"
                      >
                        <Icons.Delete size={16} strokeWidth={1.5} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Add Address Form */}
          {showAddressForm && (
            <div className="border-border bg-card/50 flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex flex-col gap-1">
                <label className="text-foreground text-xs font-medium sm:text-sm">
                  {t('pages.clients.editModal.addressType')}
                </label>
                <Select
                  value={newAddress.address_type}
                  onValueChange={(value) => setNewAddress({ ...newAddress, address_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADDRESS_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {ADDRESS_TYPE_KEYS[type] ? t(ADDRESS_TYPE_KEYS[type]) : type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-foreground text-xs font-medium sm:text-sm">
                    {t('pages.clients.editModal.region')}
                  </label>
                  <Input
                    value={newAddress.region || ''}
                    onChange={(e) => setNewAddress({ ...newAddress, region: e.target.value })}
                    inputSize="md"
                    className="rounded-md"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-foreground text-xs font-medium sm:text-sm">
                    {t('pages.clients.editModal.city')}
                  </label>
                  <Input
                    value={newAddress.city || ''}
                    onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                    inputSize="md"
                    className="rounded-md"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-foreground text-xs font-medium sm:text-sm">
                    {t('pages.clients.editModal.district')}
                  </label>
                  <Input
                    value={newAddress.district || ''}
                    onChange={(e) => setNewAddress({ ...newAddress, district: e.target.value })}
                    inputSize="md"
                    className="rounded-md"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-foreground text-xs font-medium sm:text-sm">
                    {t('pages.clients.editModal.postalCode')}
                  </label>
                  <Input
                    value={newAddress.postal_code || ''}
                    onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })}
                    inputSize="md"
                    className="rounded-md"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-foreground text-xs font-medium sm:text-sm">
                    {t('pages.clients.editModal.street')}
                  </label>
                  <Input
                    value={newAddress.street || ''}
                    onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })}
                    inputSize="md"
                    className="rounded-md"
                  />
                </div>
                <div className="flex w-24 flex-col gap-1">
                  <label className="text-foreground text-xs font-medium sm:text-sm">
                    {t('pages.clients.editModal.building')}
                  </label>
                  <Input
                    value={newAddress.building || ''}
                    onChange={(e) => setNewAddress({ ...newAddress, building: e.target.value })}
                    inputSize="md"
                    className="rounded-md"
                  />
                </div>
                <div className="flex w-24 flex-col gap-1">
                  <label className="text-foreground text-xs font-medium sm:text-sm">
                    {t('pages.clients.editModal.houseNumber')}
                  </label>
                  <Input
                    value={newAddress.house_number || ''}
                    onChange={(e) => setNewAddress({ ...newAddress, house_number: e.target.value })}
                    inputSize="md"
                    className="rounded-md"
                  />
                </div>
                <div className="flex w-24 flex-col gap-1">
                  <label className="text-foreground text-xs font-medium sm:text-sm">
                    {t('pages.clients.editModal.apartment')}
                  </label>
                  <Input
                    value={newAddress.apartment || ''}
                    onChange={(e) => setNewAddress({ ...newAddress, apartment: e.target.value })}
                    inputSize="md"
                    className="rounded-md"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-foreground text-xs font-medium sm:text-sm">
                    {t('pages.clients.editModal.housingType')}
                  </label>
                  <Input
                    value={newAddress.housing_type || ''}
                    onChange={(e) => setNewAddress({ ...newAddress, housing_type: e.target.value })}
                    inputSize="md"
                    className="rounded-md"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreateAddress}
                  disabled={isCreatingAddress}
                  className="rounded-md"
                >
                  {isCreatingAddress ? 'Adding...' : t('pages.clients.editModal.save')}
                </Button>
                <Button
                  variant="cancel"
                  size="sm"
                  onClick={() => setShowAddressForm(false)}
                  className="rounded-md"
                >
                  {t('actions.close')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function EditClientModal({ open, clientId, onClose }: EditClientModalProps) {
  const { t } = useTranslation('common')
  const { data: profile, isLoading } = useClientProfile(clientId, open)

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary flex items-center justify-center rounded-full p-2.5">
            <Icons.PencilEdit size={20} className="text-primary-foreground" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.clients.editModal.title')}
        className="pb-6"
      />
      <ModalContent className="max-h-[calc(90vh-300px)] sm:max-h-[calc(90vh-200px)]">
        {isLoading ? (
          <div data-testid="edit-modal-loading" className="flex items-center justify-center py-12">
            <div className="border-primary-500 h-8 w-8 animate-spin rounded-full border-b-2" />
          </div>
        ) : profile ? (
          <EditForm key={profile.id} profile={profile} clientId={clientId} />
        ) : null}
      </ModalContent>
      <ModalFooter className="flex flex-col gap-3 self-stretch border-none">
        <Button variant="cancel" onClick={onClose} className="h-12 w-full rounded-md">
          {t('actions.close')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
