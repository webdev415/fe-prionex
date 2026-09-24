/**
 * Recommenders tab — Phones / Others sections with wide row-cards (variant 5).
 * Preserves all existing contact actions; redesigns layout only.
 */

import type { ReactNode, ButtonHTMLAttributes } from 'react'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { TagBadge } from '@/components/ui/TagBadge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { ALL_MESSAGING_SEND_PERMISSIONS } from '@/features/messaging/utils/messagingPermissions'
import { contactTypeLabel } from '@/features/clients/utils/contactTypeLabel'
import { ContactTypePillIcon } from '@/features/clients/utils/contactTypeVisual'
import {
  contactTypePillStyle,
  contactTypePillToneClass,
  sortContactsByTypeOrder,
} from '@/features/clients/utils/contactTypeVisualHelpers'
import type { ContactTypeOption } from '@/features/clients/api/types'
import { ContactTagDropdown } from './ContactTagDropdown'
import {
  requiresDigitsOnly,
  hasNonDigitChars,
  isDuplicateContactValue,
} from '@/features/clients/utils/contactValueValidation'
import {
  isCallBlocked,
  isMessageBlocked,
  callBlockReason,
  messageBlockReason,
} from '@/features/clients/utils/contactBlocking'
import { formatDate } from '@/lib/formatters'
import { piiProps } from '@/lib/openreplay/pii'
import { useHasAnyPermission, useHasPermission } from '@/hooks/usePermissions'
import { PiiTooltip } from '@/components/ui/PiiTooltip'

export type RecommenderContactTag = {
  value_id: number
  category_id: number
  category_name: string
  category_code: string
  selection_type: 'single' | 'multi'
  is_protected: boolean
  is_system: boolean
  name: string
  color?: string | null
  blocks_calls: boolean
  blocks_sms: boolean
  blocks_spam: boolean
  can_edit: boolean
}

export type RecommenderContact = {
  id: number
  contactValue: string
  contactTypeId: number | null
  contactType: string
  contactTypeCode: string | null
  isPhone: boolean
  comment: string
  created_at?: string | null
  added_by_user_name?: string | null
  updated_at?: string | null
  updated_by_user_name?: string | null
  defaultCallLine?: string
  spamAllowed?: boolean
  contactTags: RecommenderContactTag[]
  blocking?: {
    blocks_calls: boolean
    blocks_sms: boolean
    blocks_spam: boolean
    reasons: string[]
  }
}

export type LinkedContactBadge = {
  id: number
  clientNumber: string
  fullName: string
}

type ContactFormData = {
  contact_value: string
  contact_type_id: number
  comment: string
}

type RecommendersTabProps = {
  clientId: number
  contacts: RecommenderContact[]
  contactTypesForSelect: ContactTypeOption[]
  contactTypesById: Map<number, ContactTypeOption>
  contactError: string | null
  contactEditorMode: 'add' | 'edit' | null
  contactEditorIsPhone: boolean | null
  editingContactId: number | null
  contactFormData: ContactFormData
  isCreatingContact: boolean
  isUpdatingContact: boolean
  canEditClient: boolean
  canMakeCalls: boolean
  linkedContactsByPhone: Map<string, LinkedContactBadge[]>
  normalizePhoneForLookup: (raw: string) => string
  onFormChange: (patch: Partial<ContactFormData>) => void
  onStartAdd: (isPhone: boolean) => void
  onStartEdit: (contact: RecommenderContact) => void
  onSave: () => void
  onCancelEditor: () => void
  onDelete: (contactId: number) => void
  onOpenTagHistory: (contactId: number, phone: string) => void
  openContactId: number | null
  onOpenContactTagDropdown: (contactId: number) => void
  onCloseContactTagDropdown: () => void
  onCall: (phone: string, contactTypeId: number | null) => void
  onSendSms: (phone: string) => void
  onSendMessage: (phone: string) => void
  onStartInteraction: (phone: string, contactTypeId: number | null) => void
}

function SectionHeader({
  icon,
  title,
  count,
  countLabel,
  onAdd,
  addTitle,
  canAdd,
}: {
  icon: ReactNode
  title: string
  count: number
  countLabel: string
  onAdd: () => void
  addTitle: string
  canAdd: boolean
}) {
  return (
    <div className="text-foreground mb-3 flex items-center gap-2 text-sm font-semibold">
      <span className="text-primary-500 inline-flex shrink-0">{icon}</span>
      <span>{title}</span>
      <span
        data-testid="section-contact-count"
        data-count={count}
        className="bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 text-xs font-normal"
      >
        {countLabel}
      </span>
      {canAdd && (
        <button
          type="button"
          title={addTitle}
          aria-label={addTitle}
          data-testid="section-add-contact"
          onClick={onAdd}
          className="bg-primary/10 text-primary-500 hover:bg-primary-500 ml-1 inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full transition-colors hover:text-white"
        >
          <Icons.Add size={16} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}

function ContactEditorForm({
  formData,
  contactTypes,
  contactTypesById,
  allContacts,
  editingContactId,
  onChange,
  onSave,
  onCancel,
  isSaving,
}: {
  formData: ContactFormData
  contactTypes: ContactTypeOption[]
  contactTypesById: Map<number, ContactTypeOption>
  allContacts: RecommenderContact[]
  editingContactId: number | null
  onChange: (patch: Partial<ContactFormData>) => void
  onSave: () => void
  onCancel: () => void
  isSaving: boolean
}) {
  const { t, i18n } = useTranslation('common')

  // Requirement 1 — digits-only for Client/Recommender (phone) contact sources.
  const selectedSource = contactTypesById.get(formData.contact_type_id)?.contact_source
  const digitsOnly = requiresDigitsOnly(selectedSource)
  const hasValue = formData.contact_value.trim().length > 0
  const nonDigit = digitsOnly && hasValue && hasNonDigitChars(formData.contact_value)

  // Requirement 2 — duplicate value across every Contact Source of this client,
  // excluding the contact being edited from the comparison against itself.
  const duplicate =
    hasValue && isDuplicateContactValue(allContacts, formData.contact_value, editingContactId)

  const validationMessage = nonDigit
    ? t(
        'pages.clients.editModal.contactDigitsOnly',
        'Only digits are allowed for this contact type'
      )
    : duplicate
      ? t('pages.clients.editModal.contactDuplicate', 'This value already exists for this client')
      : null

  const saveDisabled = isSaving || !hasValue || nonDigit || duplicate

  return (
    <div
      data-testid="recommender-contact-form"
      className="border-border bg-card flex flex-col gap-2.5 rounded-xl border p-3.5 shadow-sm"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[140px] flex-1">
          <Input
            value={formData.contact_value}
            onChange={(e) => onChange({ contact_value: e.target.value })}
            label={t('pages.clients.detail.contactValue')}
            aria-invalid={validationMessage ? true : undefined}
          />
        </div>
        <div className="flex min-w-[160px] flex-1 flex-col gap-1">
          <label className="text-foreground text-xs font-medium sm:text-sm">
            {t('pages.clients.detail.contactType')}
          </label>
          <Select
            value={String(formData.contact_type_id)}
            onValueChange={(value) => onChange({ contact_type_id: Number(value) })}
          >
            <SelectTrigger className="border-border bg-card h-[42px] rounded-lg border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {contactTypes.map((ct) => (
                <SelectItem key={ct.id} value={String(ct.id)}>
                  {contactTypeLabel(ct, t, i18n.language)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[140px] flex-[1.5]">
          <Input
            value={formData.comment}
            onChange={(e) => onChange({ comment: e.target.value })}
            label={t('pages.clients.detail.comment')}
          />
        </div>
        <div className="flex gap-1.5 self-end pb-0.5">
          <Button
            size="sm"
            onClick={onSave}
            disabled={saveDisabled}
            className="h-[42px] min-w-[7rem] rounded-lg"
          >
            {isSaving
              ? t('actions.saving', 'Saving...')
              : t('pages.clients.editModal.save', 'Save')}
          </Button>
          <Button
            size="sm"
            variant="cancel"
            onClick={onCancel}
            className="h-[42px] min-w-[5.5rem] rounded-lg"
          >
            {t('actions.cancel')}
          </Button>
        </div>
      </div>
      {validationMessage && (
        <p className="text-error-500 text-xs" data-testid="contact-value-error">
          {validationMessage}
        </p>
      )}
    </div>
  )
}

function ContactInfoButton({
  contact,
  onOpenTagHistory,
}: {
  contact: RecommenderContact
  onOpenTagHistory: (contactId: number, phone: string) => void
}) {
  const { t } = useTranslation('common')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={t('pages.clients.detail.contactInfo', 'Details')}
          className={cn(
            'border-border text-muted-foreground hover:border-border hover:text-muted-foreground inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors',
            contact.id > 0 && 'cursor-pointer'
          )}
          onClick={() => {
            if (contact.id > 0) {
              onOpenTagHistory(contact.id, contact.contactValue)
            }
          }}
        >
          i
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {contact.added_by_user_name && (
          <div>
            {t('pages.clients.detail.addedBy')}: {contact.added_by_user_name}
          </div>
        )}
        {contact.created_at && (
          <div>
            {t('pages.clients.detail.addedDate')}: {formatDate(contact.created_at ?? undefined)}
          </div>
        )}
        {contact.updated_by_user_name && (
          <>
            <div>
              {t('pages.clients.detail.updatedBy')}: {contact.updated_by_user_name}
            </div>
            {contact.updated_at && (
              <div>
                {t('pages.clients.detail.updatedDate')}:{' '}
                {formatDate(contact.updated_at ?? undefined)}
              </div>
            )}
          </>
        )}
        {!contact.added_by_user_name && !contact.created_at && <div>-</div>}
      </TooltipContent>
    </Tooltip>
  )
}

function LinkedContactPills({ linked }: { linked: LinkedContactBadge[] }) {
  if (linked.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="related-contact-pills">
      {linked.map((item) => (
        <PiiTooltip key={item.id} label={item.fullName}>
          <Link
            to={`/dashboard/clients/${item.id}`}
            className="border-success-200 bg-success-50 text-success-700 hover:border-success-300 hover:bg-success-100 inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-3 font-semibold no-underline"
          >
            <Icons.Link01 size={9} strokeWidth={2.2} className="shrink-0" />
            <span className="truncate">{item.clientNumber}</span>
          </Link>
        </PiiTooltip>
      ))}
    </div>
  )
}

const ActionIconButton = forwardRef<
  HTMLButtonElement,
  {
    title?: string
    disabled?: boolean
    danger?: boolean
    primary?: boolean
    children: ReactNode
    'aria-label'?: string
    className?: string
    'data-testid'?: string
  } & ButtonHTMLAttributes<HTMLButtonElement>
>(function ActionIconButton(
  {
    title,
    disabled,
    danger,
    primary,
    children,
    'aria-label': ariaLabel,
    className,
    'data-testid': dataTestId,
    type = 'button',
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      title={title}
      aria-label={ariaLabel ?? title}
      data-testid={dataTestId}
      disabled={disabled}
      className={cn(
        'inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md border-none bg-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        danger
          ? 'text-error-400 hover:bg-error-100 hover:text-error-600'
          : primary
            ? 'text-primary-500 hover:bg-primary/10 hover:text-primary-700'
            : 'text-muted-foreground hover:bg-muted hover:text-muted-foreground',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
})

/**
 * Single Message slot (mockup): SMS + Viber/messaging preserved behind one control.
 * One available channel → direct click; both → dropdown.
 */
function MessageActionsButton({
  phone,
  blocked,
  blockReason,
  onSendSms,
  onSendMessage,
}: {
  phone: string
  blocked?: boolean
  blockReason?: string
  onSendSms: (phone: string) => void
  onSendMessage: (phone: string) => void
}) {
  const { t } = useTranslation('common')
  const canSms = useHasPermission(PERMISSIONS.COMMUNICATION.SEND_SMS)
  const canMessage = useHasAnyPermission(ALL_MESSAGING_SEND_PERMISSIONS)
  const blockedTitle = blockReason || t('pages.contactTags.smsBlocked', 'SMS blocked')
  const messageTitle = t('pages.clients.detail.sendMessageSmsViber', 'Message (SMS / Viber)')

  if (!canSms && !canMessage) return null

  if (canSms && !canMessage) {
    return (
      <ActionIconButton
        primary
        disabled={blocked}
        title={blocked ? blockedTitle : t('pages.clients.detail.sendSms', 'Send SMS')}
        aria-label={messageTitle}
        data-testid="action-message"
        onClick={() => onSendSms(phone)}
      >
        <Icons.Message01 size={15} className="shrink-0" />
      </ActionIconButton>
    )
  }

  if (!canSms && canMessage) {
    return (
      <ActionIconButton
        primary
        disabled={blocked}
        title={blocked ? blockedTitle : t('pages.clients.detail.sendMessage', 'Send message')}
        aria-label={messageTitle}
        data-testid="action-message"
        onClick={() => onSendMessage(phone)}
      >
        <Icons.Message01 size={15} className="shrink-0" />
      </ActionIconButton>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ActionIconButton
          primary
          disabled={blocked}
          title={blocked ? blockedTitle : messageTitle}
          aria-label={messageTitle}
          data-testid="action-message"
        >
          <Icons.Message01 size={15} className="shrink-0" />
        </ActionIconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-border bg-card min-w-[160px]">
        <DropdownMenuItem
          disabled={blocked}
          className="cursor-pointer text-sm"
          data-testid="action-message-sms"
          onClick={() => onSendSms(phone)}
        >
          {t('pages.clients.detail.sendSms', 'Send SMS')}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={blocked}
          className="cursor-pointer text-sm"
          data-testid="action-message-viber"
          onClick={() => onSendMessage(phone)}
        >
          {t('pages.clients.detail.sendMessage', 'Send message')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ContactCard({
  clientId,
  contact,
  contactTypesById,
  canEditClient,
  canMakeCalls,
  linkedContacts,
  onStartEdit,
  onDelete,
  onOpenTagHistory,
  openContactId,
  onOpenContactTagDropdown,
  onCloseContactTagDropdown,
  onCall,
  onSendSms,
  onSendMessage,
  onStartInteraction,
}: {
  clientId: number
  contact: RecommenderContact
  contactTypesById: Map<number, ContactTypeOption>
  canEditClient: boolean
  canMakeCalls: boolean
  linkedContacts: LinkedContactBadge[]
  onStartEdit: (contact: RecommenderContact) => void
  onDelete: (contactId: number) => void
  onOpenTagHistory: (contactId: number, phone: string) => void
  openContactId: number | null
  onOpenContactTagDropdown: (contactId: number) => void
  onCloseContactTagDropdown: () => void
  onCall: (phone: string, contactTypeId: number | null) => void
  onSendSms: (phone: string) => void
  onSendMessage: (phone: string) => void
  onStartInteraction: (phone: string, contactTypeId: number | null) => void
}) {
  const { t, i18n } = useTranslation('common')
  const typeMeta =
    contact.contactTypeId != null ? contactTypesById.get(contact.contactTypeId) : undefined
  const typeLabel =
    i18n.language === 'uk'
      ? contact.contactType
      : contact.contactTypeCode
        ? t(`contactTypes.${contact.contactTypeCode}`, { defaultValue: contact.contactType })
        : contact.contactType
  const isPhone = contact.isPhone
  const showPhoneActions = isPhone && Boolean(contact.contactValue) && contact.id > 0
  const callBlocked = isCallBlocked(contact.blocking)
  const callBlockedTitle =
    callBlockReason(contact.blocking) || t('pages.contactTags.callsBlocked', 'Calls blocked')
  const messageBlocked = isMessageBlocked(contact.blocking)
  const messageBlockedReason = messageBlockReason(contact.blocking)

  return (
    <div
      data-testid={isPhone ? 'recommender-phone-card' : 'recommender-other-card'}
      className="border-border bg-card hover:border-success-200 flex flex-col gap-1.5 rounded-xl border px-3.5 py-2.5 transition-[border-color,box-shadow] hover:shadow-[0_2px_10px_rgba(63,157,91,0.07)]"
    >
      <div className="flex min-w-0 items-stretch gap-3.5">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 items-start gap-3.5">
            <div
              className={cn(
                'min-w-0 shrink-0',
                isPhone ? 'w-[140px] flex-none' : 'w-full max-w-none flex-none md:w-[480px]'
              )}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'text-foreground min-w-0 text-xs font-medium tracking-[-0.24px] break-all',
                    isPhone && 'tabular-nums',
                    contact.blocking?.blocks_calls && 'line-through opacity-70'
                  )}
                >
                  {contact.contactValue}
                </span>
                <ContactInfoButton contact={contact} onOpenTagHistory={onOpenTagHistory} />
              </div>
            </div>
            <div className="w-auto max-w-full shrink-0 pt-0.5">
              <span
                data-testid="contact-type-pill"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] leading-[1.4] font-semibold whitespace-nowrap',
                  !typeMeta?.color && contactTypePillToneClass(contact.contactTypeCode, isPhone)
                )}
                style={contactTypePillStyle(typeMeta?.color) ?? undefined}
              >
                <ContactTypePillIcon
                  contactSource={typeMeta?.contact_source}
                  isPhone={isPhone}
                  code={contact.contactTypeCode}
                />
                <span>{typeLabel || '—'}</span>
              </span>
            </div>
            <div className="ml-auto flex shrink-0 items-center">
              <div className="flex items-center gap-px" data-testid="contact-actions">
                {showPhoneActions && (
                  <>
                    <PermissionGuard permission={PERMISSIONS.COMMUNICATION.MAKE_CALLS}>
                      <ActionIconButton
                        primary
                        disabled={!canMakeCalls || callBlocked}
                        title={
                          callBlocked ? callBlockedTitle : t('pages.clients.detail.call', 'Call')
                        }
                        data-testid="action-call"
                        onClick={() => onCall(contact.contactValue, contact.contactTypeId)}
                      >
                        <Icons.Headset size={15} className="shrink-0" />
                      </ActionIconButton>
                    </PermissionGuard>
                    <MessageActionsButton
                      phone={contact.contactValue}
                      blocked={messageBlocked}
                      blockReason={messageBlockedReason}
                      onSendSms={onSendSms}
                      onSendMessage={onSendMessage}
                    />
                    <ContactTagDropdown
                      clientId={clientId}
                      contactId={contact.id}
                      isOpen={openContactId === contact.id}
                      onOpen={() => onOpenContactTagDropdown(contact.id)}
                      onClose={onCloseContactTagDropdown}
                      data-testid="action-tag"
                    />
                    <PermissionGuard permission={PERMISSIONS.CLIENTS.CREATE_INTERACTIONS}>
                      <ActionIconButton
                        primary
                        title={t('pages.clients.detail.logInteraction', 'Log interaction')}
                        data-testid="action-interaction"
                        onClick={() =>
                          onStartInteraction(contact.contactValue, contact.contactTypeId)
                        }
                      >
                        <Icons.PencilEdit size={15} className="shrink-0" />
                      </ActionIconButton>
                    </PermissionGuard>
                    {canEditClient && contact.id > 0 && (
                      <span
                        data-testid="action-separator"
                        className="bg-border mx-1 h-[18px] w-px shrink-0"
                        aria-hidden
                      />
                    )}
                  </>
                )}
                {canEditClient && contact.id > 0 && (
                  <>
                    <ActionIconButton
                      title={t('pages.clients.editModal.editContact', 'Edit contact')}
                      data-testid="action-edit"
                      onClick={() => onStartEdit(contact)}
                    >
                      <Icons.Edit size={15} className="shrink-0" />
                    </ActionIconButton>
                    <ActionIconButton
                      danger
                      title={t('pages.clients.editModal.deleteContact', 'Delete contact')}
                      data-testid="action-delete"
                      onClick={() => onDelete(contact.id)}
                    >
                      <Icons.Delete size={15} className="shrink-0" />
                    </ActionIconButton>
                  </>
                )}
              </div>
            </div>
          </div>
          {isPhone && (linkedContacts.length > 0 || contact.contactTags.length > 0) && (
            <div className="ml-0 flex flex-col gap-1.5 md:ml-[156px]">
              {linkedContacts.length > 0 && <LinkedContactPills linked={linkedContacts} />}
              {contact.contactTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5" data-testid="contact-tag-chips">
                  {contact.contactTags.map((tag) => (
                    <button
                      key={tag.value_id}
                      type="button"
                      className="inline-flex cursor-pointer items-center rounded-full border-0 bg-transparent p-0 leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
                      title={tag.category_name}
                      onClick={() => onOpenContactTagDropdown(contact.id)}
                    >
                      <TagBadge
                        name={tag.name}
                        color={tag.color || '#64748b'}
                        size="xs"
                        isProtected={tag.is_protected}
                        isSystem={tag.is_system}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div
          data-testid="contact-comment"
          className="border-border text-muted-foreground w-[320px] max-w-[36%] shrink-0 border-l py-0.5 pl-3.5 text-xs leading-[1.35] break-words md:max-w-none"
          {...piiProps}
        >
          {contact.comment || '\u00A0'}
        </div>
      </div>
    </div>
  )
}

function ContactSection({
  isPhone,
  contacts,
  allContacts,
  ...shared
}: {
  isPhone: boolean
  contacts: RecommenderContact[]
  allContacts: RecommenderContact[]
} & Omit<RecommendersTabProps, 'contacts' | 'contactError'>) {
  const { t } = useTranslation('common')
  const {
    contactTypesForSelect,
    contactTypesById,
    contactEditorMode,
    contactEditorIsPhone,
    editingContactId,
    contactFormData,
    isCreatingContact,
    isUpdatingContact,
    canEditClient,
    linkedContactsByPhone,
    normalizePhoneForLookup,
    onFormChange,
    onStartAdd,
    onCancelEditor,
    onSave,
  } = shared

  const sortedContacts = sortContactsByTypeOrder(contacts, contactTypesById)

  const showAddForm = contactEditorMode === 'add' && contactEditorIsPhone === isPhone
  const isSaving = isCreatingContact || isUpdatingContact
  const countLabel = t('pages.clients.detail.contactsCount', '{{count}} contacts', {
    count: contacts.length,
  })
  const sectionTitle = isPhone
    ? t('pages.clients.detail.phones', 'Phones')
    : t('pages.clients.detail.otherContacts', 'Others')

  return (
    <section
      className="mb-5"
      data-testid={isPhone ? 'recommenders-phones-section' : 'recommenders-others-section'}
      aria-label={sectionTitle}
    >
      <SectionHeader
        icon={
          isPhone ? (
            <Icons.Headset size={15} strokeWidth={2} />
          ) : (
            <Icons.Mail size={15} strokeWidth={2} />
          )
        }
        title={sectionTitle}
        count={contacts.length}
        countLabel={countLabel}
        canAdd={canEditClient}
        addTitle={
          isPhone
            ? t('pages.clients.editModal.addPhone', 'Add phone')
            : t('pages.clients.editModal.addContact', 'Add contact')
        }
        onAdd={() => onStartAdd(isPhone)}
      />
      <div className="flex min-w-[720px] flex-col gap-1.5 md:min-w-[980px]">
        {showAddForm && (
          <ContactEditorForm
            formData={contactFormData}
            contactTypes={contactTypesForSelect}
            contactTypesById={contactTypesById}
            allContacts={allContacts}
            editingContactId={editingContactId}
            onChange={onFormChange}
            onSave={onSave}
            onCancel={onCancelEditor}
            isSaving={isSaving}
          />
        )}
        {sortedContacts.map((contact, index) => {
          const isEditing =
            contactEditorMode === 'edit' &&
            editingContactId === contact.id &&
            contactEditorIsPhone === isPhone
          if (isEditing) {
            return (
              <ContactEditorForm
                key={contact.id ?? `edit-${index}`}
                formData={contactFormData}
                contactTypes={contactTypesForSelect}
                contactTypesById={contactTypesById}
                allContacts={allContacts}
                editingContactId={editingContactId}
                onChange={onFormChange}
                onSave={onSave}
                onCancel={onCancelEditor}
                isSaving={isSaving}
              />
            )
          }
          const phoneKey = normalizePhoneForLookup(contact.contactValue)
          const linked = linkedContactsByPhone.get(phoneKey) ?? []
          return (
            <ContactCard
              key={contact.id ?? `recommender-${index}-${contact.contactValue}`}
              clientId={shared.clientId}
              contact={contact}
              contactTypesById={contactTypesById}
              canEditClient={canEditClient}
              canMakeCalls={shared.canMakeCalls}
              linkedContacts={linked}
              onStartEdit={shared.onStartEdit}
              onDelete={shared.onDelete}
              onOpenTagHistory={shared.onOpenTagHistory}
              openContactId={shared.openContactId}
              onOpenContactTagDropdown={shared.onOpenContactTagDropdown}
              onCloseContactTagDropdown={shared.onCloseContactTagDropdown}
              onCall={shared.onCall}
              onSendSms={shared.onSendSms}
              onSendMessage={shared.onSendMessage}
              onStartInteraction={shared.onStartInteraction}
            />
          )
        })}
        {contacts.length === 0 && !showAddForm && (
          <p className="text-muted-foreground py-2 text-xs">—</p>
        )}
      </div>
    </section>
  )
}

export function RecommendersTab(props: RecommendersTabProps) {
  const { contactError, contacts, ...sectionProps } = props
  const phoneContacts = contacts.filter((c) => c.isPhone)
  const otherContacts = contacts.filter((c) => !c.isPhone)

  return (
    <div className="self-stretch overflow-x-auto p-3 md:p-6" data-testid="recommenders-tab">
      {contactError && <p className="text-error-500 mb-3 text-sm">{contactError}</p>}
      <ContactSection isPhone {...sectionProps} contacts={phoneContacts} allContacts={contacts} />
      <ContactSection
        isPhone={false}
        {...sectionProps}
        contacts={otherContacts}
        allContacts={contacts}
      />
    </div>
  )
}
