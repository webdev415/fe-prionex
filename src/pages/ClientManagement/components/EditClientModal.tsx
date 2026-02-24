import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
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
import {
  useClientProfile,
  useUpdateClient,
  useCreateAddress,
  useUpdateAddress,
  useDeleteAddress,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  useUpdateEmployment,
  useUpdatePassport,
  clientKeys,
} from '@/features/clients/hooks/useClients'
import type {
  ClientProfileResponse,
  CreateAddressRequest,
  UpdateAddressRequest,
  CreateContactRequest,
  UpdateContactRequest,
} from '@/features/clients/api/types'

export interface EditClientModalProps {
  open: boolean
  clientId: number
  onClose: () => void
}

const MARITAL_STATUSES = ['1', '2', '3', '4', '5'] as const
const MARITAL_STATUS_LABELS: Record<string, string> = {
  '1': 'Неодружений/Незаміжня',
  '2': 'Одружений/Заміжня',
  '3': 'Розлучений/Розлучена',
  '4': 'Вдівець/Вдова',
  '5': 'Цивільний шлюб',
}

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
const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: 'Повна зайнятість',
  part_time: 'Часткова зайнятість',
  contract: 'Контракт',
  student: 'Студент',
  self_employed: 'ФОП',
  unemployed: 'Безробітний',
  retired: 'Пенсіонер',
  other: 'Інше',
}

const ADDRESS_TYPES = ['registration', 'actual'] as const
const ADDRESS_TYPE_KEYS: Record<string, string> = {
  registration: 'pages.clients.detail.registrationAddress',
  actual: 'pages.clients.detail.personalAddress',
}

const CONTACT_TYPES = [
  'phone_mobile_third_party',
  'phone_home_third_party',
  'phone_work_third_party',
  'phone_mobile_guarantor',
  'phone_work_guarantor',
  'phone_home_guarantor',
  'phone_other',
  'phone_mobile_other',
  'phone_work_other',
  'phone_home_other',
  'phone_home_client',
  'phone_fax',
] as const

const CONTACT_TYPE_LABELS: Record<string, string> = {
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

interface EditFormProps {
  profile: ClientProfileResponse
  clientId: number
}

function EditForm({ profile, clientId }: EditFormProps) {
  const { t } = useTranslation('common')
  const queryClient = useQueryClient()
  const { mutate: updateClient, isPending: isSavingPersonal } = useUpdateClient()
  const { mutate: createAddress, isPending: isCreatingAddress } = useCreateAddress()
  const { mutate: updateAddress, isPending: isUpdatingAddress } = useUpdateAddress()
  const { mutate: deleteAddress } = useDeleteAddress()
  const { mutate: createContact, isPending: isCreatingContact } = useCreateContact()
  const { mutate: updateContact, isPending: isUpdatingContact } = useUpdateContact()
  const { mutate: deleteContact } = useDeleteContact()
  const { mutate: updateEmployment, isPending: isSavingWork } = useUpdateEmployment()
  const { mutate: updatePassport, isPending: isSavingPassport } = useUpdatePassport()
  const canEditAll = useHasPermission(PERMISSIONS.CLIENTS.EDIT)

  // Personal info — initialized from profile (component remounts via key when profile changes)
  // Fallback: parse full_name if first_name/last_name are empty (legacy import data)
  const parsedNames =
    !profile.first_name && !profile.last_name && profile.full_name
      ? profile.full_name.split(' ')
      : null
  const [firstName, setFirstName] = useState(profile.first_name || parsedNames?.[0] || '')
  const [lastName, setLastName] = useState(profile.last_name || parsedNames?.[1] || '')
  const [middleName, setMiddleName] = useState(profile.middle_name || parsedNames?.[2] || '')
  const [email, setEmail] = useState(profile.email || '')
  const [phonePrimary, setPhonePrimary] = useState(profile.phone_primary || '')
  const [phoneSecondary, setPhoneSecondary] = useState(profile.phone_secondary || '')
  const [dateOfBirth, setDateOfBirth] = useState(profile.date_of_birth || '')
  const [maritalStatus, setMaritalStatus] = useState(profile.marital_status || '')
  const [familyMembers, setFamilyMembers] = useState(profile.family_members_count?.toString() || '')
  const [incomeLevel, setIncomeLevel] = useState(profile.income_level || '')
  const [taxId, setTaxId] = useState(profile.tax_id || '')

  // Passport/document info
  const [documentType, setDocumentType] = useState(profile.passport?.document_type || '')
  const [passportSeries, setPassportSeries] = useState(profile.passport?.series || '')
  const [passportNumber, setPassportNumber] = useState(profile.passport?.number || '')
  const [issuedBy, setIssuedBy] = useState(profile.passport?.issued_by || '')
  const [issuedDate, setIssuedDate] = useState(profile.passport?.issued_date || '')
  const [expiresDate, setExpiresDate] = useState(profile.passport?.expires_date || '')
  const [gender, setGender] = useState(profile.passport?.gender || '')
  const [recordNumber, setRecordNumber] = useState(profile.passport?.record_number || '')

  // Work info — from employment sub-resource
  const [companyName, setCompanyName] = useState(profile.employment?.company_name || '')
  const [position, setPosition] = useState(profile.employment?.position || '')
  const [employmentType, setEmploymentType] = useState(profile.employment?.employment_type || '')
  const [workExperience, setWorkExperience] = useState(
    profile.employment?.work_experience_years?.toString() || ''
  )
  const [managerFullName, setManagerFullName] = useState(
    profile.employment?.manager_full_name || profile.employment?.manager_name || ''
  )
  const [workPhone, setWorkPhone] = useState(profile.employment?.work_phone || '')

  // Address form state
  const [showAddressForm, setShowAddressForm] = useState(false)
  const [newAddress, setNewAddress] = useState<CreateAddressRequest>({
    address_type: 'actual',
    country: 'Ukraine',
    region: '',
    city: '',
    street: '',
    building: '',
    apartment: '',
    postal_code: '',
    is_primary: false,
  })

  // Contact form state
  const [showContactForm, setShowContactForm] = useState(false)
  const [newContact, setNewContact] = useState<CreateContactRequest>({
    contact_type: 'phone_mobile_third_party',
    relationship: '',
    first_name: '',
    last_name: '',
    phone: '',
    notes: '',
  })

  // Inline edit state for addresses
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null)
  const [editAddressData, setEditAddressData] = useState<UpdateAddressRequest>({})

  // Inline edit state for contacts
  const [editingContactId, setEditingContactId] = useState<number | null>(null)
  const [editContactData, setEditContactData] = useState<UpdateContactRequest>({})

  const handleSavePersonalInfo = () => {
    const data = canEditAll
      ? {
          first_name: firstName,
          last_name: lastName,
          middle_name: middleName || undefined,
          email: email.trim() || undefined,
          date_of_birth: dateOfBirth || undefined,
          phone_primary: phonePrimary,
          phone_secondary: phoneSecondary || undefined,
          tax_id: taxId || undefined,
          marital_status: maritalStatus || undefined,
          family_members_count: familyMembers ? Number(familyMembers) : undefined,
          income_level: incomeLevel || undefined,
        }
      : {
          phone_primary: phonePrimary,
          phone_secondary: phoneSecondary || undefined,
        }
    updateClient(
      {
        id: clientId,
        data,
      },
      {
        onSuccess: async () => {
          toast.success(t('pages.clients.editModal.saveSuccess'))
          await queryClient.invalidateQueries({ queryKey: clientKeys.profile(clientId) })
          queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) })
          queryClient.invalidateQueries({ queryKey: clientKeys.lists() })
          queryClient.invalidateQueries({ queryKey: clientKeys.prioritySummary() })
        },
        onError: (error) => {
          const detail = (error as AxiosError<{ detail?: string | Array<{ msg?: string }> }>)
            ?.response?.data?.detail
          const message =
            typeof detail === 'string'
              ? detail
              : Array.isArray(detail)
                ? detail.map((e) => e.msg).join(', ')
                : t('pages.clients.editModal.saveError')
          toast.error(message)
        },
      }
    )
  }

  const handleSaveWork = () => {
    updateEmployment(
      {
        clientId,
        data: {
          company_name: companyName || undefined,
          position: position || undefined,
          employment_type: employmentType || undefined,
          work_experience_years: workExperience ? Number(workExperience) : undefined,
          manager_full_name: managerFullName || undefined,
          work_phone: workPhone || undefined,
        },
      },
      {
        onSuccess: async () => {
          toast.success(t('pages.clients.editModal.saveSuccess'))
          await queryClient.invalidateQueries({ queryKey: clientKeys.profile(clientId) })
          queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) })
        },
        onError: (error) => {
          const detail = (error as AxiosError<{ detail?: string | Array<{ msg?: string }> }>)
            ?.response?.data?.detail
          const message =
            typeof detail === 'string'
              ? detail
              : Array.isArray(detail)
                ? detail.map((e) => e.msg).join(', ')
                : t('pages.clients.editModal.saveError')
          toast.error(message)
        },
      }
    )
  }

  const handleSavePassport = () => {
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
          record_number: recordNumber || undefined,
        },
      },
      {
        onSuccess: async () => {
          toast.success(t('pages.clients.editModal.saveSuccess'))
          await queryClient.invalidateQueries({ queryKey: clientKeys.profile(clientId) })
          queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) })
        },
        onError: (error) => {
          const detail = (error as AxiosError<{ detail?: string | Array<{ msg?: string }> }>)
            ?.response?.data?.detail
          const message =
            typeof detail === 'string'
              ? detail
              : Array.isArray(detail)
                ? detail.map((e) => e.msg).join(', ')
                : t('pages.clients.editModal.saveError')
          toast.error(message)
        },
      }
    )
  }

  const handleCreateAddress = () => {
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
            street: '',
            building: '',
            apartment: '',
            postal_code: '',
            is_primary: false,
          })
        },
        onError: (error) => {
          const message =
            (error as AxiosError<{ detail?: string }>)?.response?.data?.detail ||
            'Failed to add address'
          toast.error(message)
        },
      }
    )
  }

  const handleDeleteAddress = (addressId: number) => {
    deleteAddress(
      { clientId, addressId },
      {
        onSuccess: () => {
          toast.success(t('pages.clients.editModal.addressDeleted'))
        },
        onError: (error) => {
          const message =
            (error as AxiosError<{ detail?: string }>)?.response?.data?.detail ||
            'Failed to delete address'
          toast.error(message)
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
      street: address.street || '',
      building: address.building || '',
      apartment: address.apartment || '',
      postal_code: address.postal_code || '',
      is_primary: address.is_primary,
    })
  }

  const handleUpdateAddress = () => {
    if (editingAddressId === null) return
    updateAddress(
      { clientId, addressId: editingAddressId, data: editAddressData },
      {
        onSuccess: () => {
          toast.success(t('pages.clients.editModal.addressUpdated'))
          setEditingAddressId(null)
          setEditAddressData({})
        },
        onError: (error) => {
          const message =
            (error as AxiosError<{ detail?: string }>)?.response?.data?.detail ||
            t('pages.clients.editModal.saveError')
          toast.error(message)
        },
      }
    )
  }

  const handleStartEditContact = (contact: ClientProfileResponse['recommenders'][number]) => {
    setEditingContactId(contact.id)
    setEditContactData({
      contact_type: contact.contact_type,
      relationship: contact.relationship || '',
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      phone: contact.phone || '',
      notes: contact.notes || '',
    })
  }

  const handleUpdateContact = () => {
    if (editingContactId === null) return
    updateContact(
      { clientId, contactId: editingContactId, data: editContactData },
      {
        onSuccess: () => {
          toast.success(t('pages.clients.editModal.contactUpdated'))
          setEditingContactId(null)
          setEditContactData({})
        },
        onError: (error) => {
          const message =
            (error as AxiosError<{ detail?: string }>)?.response?.data?.detail ||
            t('pages.clients.editModal.saveError')
          toast.error(message)
        },
      }
    )
  }

  const handleCreateContact = () => {
    createContact(
      { clientId, data: newContact },
      {
        onSuccess: () => {
          toast.success(t('pages.clients.editModal.contactCreated'))
          setShowContactForm(false)
          setNewContact({
            contact_type: 'phone_mobile_third_party',
            relationship: '',
            first_name: '',
            last_name: '',
            phone: '',
            notes: '',
          })
        },
        onError: (error) => {
          const message =
            (error as AxiosError<{ detail?: string }>)?.response?.data?.detail ||
            'Failed to add contact'
          toast.error(message)
        },
      }
    )
  }

  const handleDeleteContact = (contactId: number) => {
    deleteContact(
      { clientId, contactId },
      {
        onSuccess: () => {
          toast.success(t('pages.clients.editModal.contactDeleted'))
        },
        onError: (error) => {
          const message =
            (error as AxiosError<{ detail?: string }>)?.response?.data?.detail ||
            'Failed to delete contact'
          toast.error(message)
        },
      }
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Section 1: Personal Information */}
      <div className="flex flex-col items-start gap-2 self-stretch">
        <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
          {t('pages.clients.editModal.personalInfo')}
        </span>
        <div className="flex flex-col items-start justify-center gap-4 self-stretch rounded-xl border border-white bg-white/50 p-4 sm:p-5 sm:px-6">
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.editModal.firstName')} <span className="text-error-500">*</span>
              </label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="rounded-md disabled:bg-gray-50"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.editModal.lastName')} <span className="text-error-500">*</span>
              </label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="rounded-md disabled:bg-gray-50"
              />
            </div>
          </div>

          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.editModal.middleName')}
              </label>
              <Input
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="rounded-md disabled:bg-gray-50"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.editModal.email')}
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="rounded-md disabled:bg-gray-50"
              />
            </div>
          </div>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.editModal.dateOfBirth')}
              </label>
              <Input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="rounded-md disabled:bg-gray-50"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.maritalStatus')}
              </label>
              <Select value={maritalStatus} onValueChange={setMaritalStatus} disabled={!canEditAll}>
                <SelectTrigger className="text-dark-500 h-[42px] rounded-lg border border-gray-400 bg-white px-3 text-sm font-light disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-50">
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  {MARITAL_STATUSES.map((key) => (
                    <SelectItem key={key} value={key}>
                      {MARITAL_STATUS_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.editModal.taxId')}
              </label>
              <Input
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="rounded-md disabled:bg-gray-50"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.documentType')}
              </label>
              <Input
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="rounded-md disabled:bg-gray-50"
              />
            </div>
          </div>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.passportSeries')}
              </label>
              <Input
                value={passportSeries}
                onChange={(e) => setPassportSeries(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="rounded-md disabled:bg-gray-50"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.passportNumber')}
              </label>
              <Input
                value={passportNumber}
                onChange={(e) => setPassportNumber(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="rounded-md disabled:bg-gray-50"
              />
            </div>
          </div>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.issuedBy')}
              </label>
              <Input
                value={issuedBy}
                onChange={(e) => setIssuedBy(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="rounded-md disabled:bg-gray-50"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.issuedDate')}
              </label>
              <Input
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="rounded-md disabled:bg-gray-50"
              />
            </div>
          </div>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.expiresDate')}
              </label>
              <Input
                type="date"
                value={expiresDate}
                onChange={(e) => setExpiresDate(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="rounded-md disabled:bg-gray-50"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.gender')}
              </label>
              <Input
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="rounded-md disabled:bg-gray-50"
              />
            </div>
          </div>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.recordNumber')}
              </label>
              <Input
                value={recordNumber}
                onChange={(e) => setRecordNumber(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="rounded-md disabled:bg-gray-50"
              />
            </div>
            <div className="flex flex-1" />
          </div>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.numberOfFamilyMembers')}
              </label>
              <Input
                type="number"
                value={familyMembers}
                onChange={(e) => setFamilyMembers(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="rounded-md disabled:bg-gray-50"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.incomeLevel')}
              </label>
              <Input
                value={incomeLevel}
                onChange={(e) => setIncomeLevel(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="rounded-md disabled:bg-gray-50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Document Info */}
      {canEditAll && (
        <div className="flex justify-end">
          <Button
            variant="primary"
            onClick={handleSavePassport}
            disabled={isSavingPassport}
            className="rounded-md"
          >
            {isSavingPassport ? 'Saving...' : t('pages.clients.editModal.save')}
          </Button>
        </div>
      )}

      {/* Section 2: Phone Numbers */}
      <div className="flex flex-col items-start gap-2 self-stretch">
        <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
          {t('pages.clients.editModal.phoneNumbers')}
        </span>
        <div className="flex flex-col items-start justify-center gap-4 self-stretch rounded-xl border border-white bg-white/50 p-4 sm:p-5 sm:px-6">
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.editModal.phonePrimary')}{' '}
                <span className="text-error-500">*</span>
              </label>
              <Input
                value={phonePrimary}
                onChange={(e) => setPhonePrimary(e.target.value)}
                inputSize="md"
                className="rounded-md"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.editModal.phoneSecondary')}
              </label>
              <Input
                value={phoneSecondary}
                onChange={(e) => setPhoneSecondary(e.target.value)}
                inputSize="md"
                className="rounded-md"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Personal Info + Phones */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={handleSavePersonalInfo}
          disabled={
            isSavingPersonal ||
            !phonePrimary.trim() ||
            (canEditAll && (!firstName.trim() || !lastName.trim()))
          }
          className="rounded-md"
        >
          {isSavingPersonal ? 'Saving...' : t('pages.clients.editModal.save')}
        </Button>
      </div>

      {/* Section 3: Work Information */}
      <div className="flex flex-col items-start gap-2 self-stretch">
        <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
          {t('pages.clients.detail.tabs.work')}
        </span>
        <div className="flex flex-col items-start justify-center gap-4 self-stretch rounded-xl border border-white bg-white/50 p-4 sm:p-5 sm:px-6">
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.organizationName')}
              </label>
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="rounded-md disabled:bg-gray-50"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.position')}
              </label>
              <Input
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="rounded-md disabled:bg-gray-50"
              />
            </div>
          </div>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.experience')}
              </label>
              <Input
                type="number"
                value={workExperience}
                onChange={(e) => setWorkExperience(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="rounded-md disabled:bg-gray-50"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.managerFullName')}
              </label>
              <Input
                value={managerFullName}
                onChange={(e) => setManagerFullName(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="rounded-md disabled:bg-gray-50"
              />
            </div>
          </div>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:gap-5">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.detail.employmentType')}
              </label>
              <Select
                value={employmentType}
                onValueChange={setEmploymentType}
                disabled={!canEditAll}
              >
                <SelectTrigger className="text-dark-500 h-[42px] rounded-lg border border-gray-400 bg-white px-3 text-sm font-light disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-50">
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map((key) => (
                    <SelectItem key={key} value={key}>
                      {EMPLOYMENT_TYPE_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-dark-500 text-xs font-medium sm:text-sm">
                {t('pages.clients.editModal.workPhone')}
              </label>
              <Input
                value={workPhone}
                onChange={(e) => setWorkPhone(e.target.value)}
                disabled={!canEditAll}
                inputSize="md"
                className="rounded-md disabled:bg-gray-50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Work Info */}
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

      {/* Section 4: Contacts & Referrals */}
      <div className="flex flex-col items-start gap-2 self-stretch">
        <div className="flex w-full items-center justify-between">
          <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
            {t('pages.clients.editModal.contacts')}
          </span>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Icons.PlusSignCircle size={16} />}
            onClick={() => setShowContactForm(true)}
            className="text-xs"
          >
            {t('pages.clients.editModal.addContact')}
          </Button>
        </div>
        <div className="flex flex-col gap-3 self-stretch">
          {profile.recommenders?.map((contact, index) => (
            <div key={contact.id}>
              {editingContactId === contact.id ? (
                <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white/50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                    <div className="flex flex-1 flex-col gap-1">
                      <label className="text-dark-500 text-xs font-medium sm:text-sm">
                        {t('pages.clients.editModal.contactType')}
                      </label>
                      <Select
                        value={editContactData.contact_type || ''}
                        onValueChange={(value) =>
                          setEditContactData({ ...editContactData, contact_type: value })
                        }
                      >
                        <SelectTrigger className="text-dark-500 h-[42px] rounded-lg border border-gray-400 bg-white px-3 text-sm font-light">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONTACT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {CONTACT_TYPE_LABELS[type] || type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <label className="text-dark-500 text-xs font-medium sm:text-sm">
                        {t('pages.clients.editModal.relationship')}
                      </label>
                      <Input
                        value={editContactData.relationship || ''}
                        onChange={(e) =>
                          setEditContactData({ ...editContactData, relationship: e.target.value })
                        }
                        inputSize="md"
                        className="rounded-md"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                    <div className="flex flex-1 flex-col gap-1">
                      <label className="text-dark-500 text-xs font-medium sm:text-sm">
                        {t('pages.clients.editModal.firstName')}{' '}
                        <span className="text-error-500">*</span>
                      </label>
                      <Input
                        value={editContactData.first_name || ''}
                        onChange={(e) =>
                          setEditContactData({ ...editContactData, first_name: e.target.value })
                        }
                        inputSize="md"
                        className="rounded-md"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <label className="text-dark-500 text-xs font-medium sm:text-sm">
                        {t('pages.clients.editModal.lastName')}
                      </label>
                      <Input
                        value={editContactData.last_name || ''}
                        onChange={(e) =>
                          setEditContactData({ ...editContactData, last_name: e.target.value })
                        }
                        inputSize="md"
                        className="rounded-md"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-dark-500 text-xs font-medium sm:text-sm">
                      {t('pages.clients.editModal.phone')} <span className="text-error-500">*</span>
                    </label>
                    <Input
                      value={editContactData.phone || ''}
                      onChange={(e) =>
                        setEditContactData({ ...editContactData, phone: e.target.value })
                      }
                      inputSize="md"
                      className="rounded-md"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-dark-500 text-xs font-medium sm:text-sm">
                      {t('pages.clients.editModal.notes')}
                    </label>
                    <Input
                      value={editContactData.notes || ''}
                      onChange={(e) =>
                        setEditContactData({ ...editContactData, notes: e.target.value })
                      }
                      inputSize="md"
                      className="rounded-md"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleUpdateContact}
                      disabled={
                        isUpdatingContact ||
                        !(editContactData.first_name || '').trim() ||
                        !(editContactData.phone || '').trim()
                      }
                      className="rounded-md"
                    >
                      {isUpdatingContact
                        ? t('pages.clients.editModal.saving')
                        : t('pages.clients.editModal.save')}
                    </Button>
                    <Button
                      variant="cancel"
                      size="sm"
                      onClick={() => {
                        setEditingContactId(null)
                        setEditContactData({})
                      }}
                      className="rounded-md"
                    >
                      {t('actions.close')}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-white bg-white/50 p-3 sm:p-4">
                    <div className="flex flex-1 flex-col gap-1.5">
                      <span className="text-dark-500 text-xs font-medium sm:text-sm">
                        {contact.full_name}
                      </span>
                      <span className="text-xs font-light text-gray-700">
                        {CONTACT_TYPE_LABELS[contact.contact_type] ?? contact.contact_type}
                      </span>
                      <span className="text-xs font-light text-gray-700">
                        {contact.relationship}
                      </span>
                      <span className="text-xs font-light text-gray-700">{contact.phone}</span>
                      <span className="text-xs font-light text-gray-500">{contact.notes}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        data-testid="edit-contact-btn"
                        aria-label={t('pages.clients.editModal.editContact')}
                        onClick={() => handleStartEditContact(contact)}
                        className="text-gray-600 transition-colors hover:text-blue-500"
                      >
                        <Icons.PencilEdit size={16} strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        data-testid="delete-contact-btn"
                        aria-label={t('pages.clients.editModal.deleteContact')}
                        onClick={() => handleDeleteContact(contact.id)}
                        className="text-gray-600 transition-colors hover:text-red-500"
                      >
                        <Icons.Delete size={16} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                  {index < (profile.recommenders?.length ?? 0) - 1 && (
                    <div className="mx-2 h-px self-stretch bg-gray-200"></div>
                  )}
                </>
              )}
            </div>
          ))}

          {/* Add Contact Form */}
          {showContactForm && (
            <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white/50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-dark-500 text-xs font-medium sm:text-sm">
                    {t('pages.clients.editModal.contactType')}
                  </label>
                  <Select
                    value={newContact.contact_type}
                    onValueChange={(value) => setNewContact({ ...newContact, contact_type: value })}
                  >
                    <SelectTrigger className="text-dark-500 h-[42px] rounded-lg border border-gray-400 bg-white px-3 text-sm font-light">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {CONTACT_TYPE_LABELS[type] || type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-dark-500 text-xs font-medium sm:text-sm">
                    {t('pages.clients.editModal.relationship')}
                  </label>
                  <Input
                    value={newContact.relationship || ''}
                    onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
                    inputSize="md"
                    className="rounded-md"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-dark-500 text-xs font-medium sm:text-sm">
                    {t('pages.clients.editModal.firstName')}{' '}
                    <span className="text-error-500">*</span>
                  </label>
                  <Input
                    value={newContact.first_name}
                    onChange={(e) => setNewContact({ ...newContact, first_name: e.target.value })}
                    inputSize="md"
                    className="rounded-md"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <label className="text-dark-500 text-xs font-medium sm:text-sm">
                    {t('pages.clients.editModal.lastName')}
                  </label>
                  <Input
                    value={newContact.last_name || ''}
                    onChange={(e) => setNewContact({ ...newContact, last_name: e.target.value })}
                    inputSize="md"
                    className="rounded-md"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-dark-500 text-xs font-medium sm:text-sm">
                  {t('pages.clients.editModal.phone')} <span className="text-error-500">*</span>
                </label>
                <Input
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  inputSize="md"
                  className="rounded-md"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-dark-500 text-xs font-medium sm:text-sm">
                  {t('pages.clients.editModal.notes')}
                </label>
                <Input
                  value={newContact.notes || ''}
                  onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })}
                  inputSize="md"
                  className="rounded-md"
                />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreateContact}
                  disabled={
                    isCreatingContact || !newContact.first_name.trim() || !newContact.phone.trim()
                  }
                  className="rounded-md"
                >
                  {isCreatingContact ? 'Adding...' : t('pages.clients.editModal.save')}
                </Button>
                <Button
                  variant="cancel"
                  size="sm"
                  onClick={() => setShowContactForm(false)}
                  className="rounded-md"
                >
                  {t('actions.close')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 5: Addresses */}
      <div className="flex flex-col items-start gap-2 self-stretch">
        <div className="flex w-full items-center justify-between">
          <span className="text-dark-500 text-sm leading-[150%] font-medium tracking-[-0.28px]">
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
        <div className="flex flex-col gap-3 self-stretch">
          {profile.addresses?.map((address) => (
            <div key={address.id}>
              {editingAddressId === address.id ? (
                <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white/50 p-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-dark-500 text-xs font-medium sm:text-sm">
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
                      <label className="text-dark-500 text-xs font-medium sm:text-sm">
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
                      <label className="text-dark-500 text-xs font-medium sm:text-sm">
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
                      <label className="text-dark-500 text-xs font-medium sm:text-sm">
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
                      <label className="text-dark-500 text-xs font-medium sm:text-sm">
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
                      <label className="text-dark-500 text-xs font-medium sm:text-sm">
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
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white bg-white/50 p-3 sm:p-4">
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-dark-500 text-xs font-medium sm:text-sm">
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
                    <span className="text-xs font-light text-gray-700 sm:text-sm">
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
                        className="text-gray-600 transition-colors hover:text-blue-500"
                      >
                        <Icons.PencilEdit size={16} strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        data-testid="delete-address-btn"
                        aria-label={t('pages.clients.editModal.deleteAddress')}
                        onClick={() => handleDeleteAddress(address.id)}
                        className="text-gray-600 transition-colors hover:text-red-500"
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
            <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white/50 p-4">
              <div className="flex flex-col gap-1">
                <label className="text-dark-500 text-xs font-medium sm:text-sm">
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
                  <label className="text-dark-500 text-xs font-medium sm:text-sm">
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
                  <label className="text-dark-500 text-xs font-medium sm:text-sm">
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
                  <label className="text-dark-500 text-xs font-medium sm:text-sm">
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
                  <label className="text-dark-500 text-xs font-medium sm:text-sm">
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
                  <label className="text-dark-500 text-xs font-medium sm:text-sm">
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
          <div className="bg-primary-300 flex items-center justify-center rounded-full p-2.5">
            <Icons.PencilEdit size={20} className="text-dark-500" strokeWidth={1.5} />
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
