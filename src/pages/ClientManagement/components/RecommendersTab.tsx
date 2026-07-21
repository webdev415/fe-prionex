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
  contactTypePillToneClass,
  sortContactsByTypeOrder,
} from '@/features/clients/utils/contactTypeVisualHelpers'
import type { ContactTypeOption } from '@/features/clients/api/types'
import { formatDate } from '@/lib/formatters'
import { useHasAnyPermission, useHasPermission } from '@/hooks/usePermissions'

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
  onOpenTagModal: (contactId: number, phone: string) => void
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
    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#2b2f36]">
      <span className="text-primary-500 inline-flex shrink-0">{icon}</span>
      <span>{title}</span>
      <span
        data-testid="section-contact-count"
        data-count={count}
        className="rounded-full bg-[#f2f4f2] px-2.5 py-0.5 text-xs font-normal text-[#9b9fa6]"
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
          className="bg-primary-50 text-primary-500 hover:bg-primary-500 ml-1 inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full transition-colors hover:text-white"
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
  onChange,
  onSave,
  onCancel,
  isSaving,
}: {
  formData: ContactFormData
  contactTypes: ContactTypeOption[]
  onChange: (patch: Partial<ContactFormData>) => void
  onSave: () => void
  onCancel: () => void
  isSaving: boolean
}) {
  const { t, i18n } = useTranslation('common')
  return (
    <div
      data-testid="recommender-contact-form"
      className="flex flex-col gap-2.5 rounded-xl border border-[#e8e9eb] bg-white p-3.5 shadow-sm"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[140px] flex-1">
          <Input
            value={formData.contact_value}
            onChange={(e) => onChange({ contact_value: e.target.value })}
            label={t('pages.clients.detail.contactValue')}
          />
        </div>
        <div className="flex min-w-[160px] flex-1 flex-col gap-1">
          <label className="text-dark-500 text-xs font-medium sm:text-sm">
            {t('pages.clients.detail.contactType')}
          </label>
          <Select
            value={String(formData.contact_type_id)}
            onValueChange={(value) => onChange({ contact_type_id: Number(value) })}
          >
            <SelectTrigger className="h-[42px] rounded-lg border border-gray-300 bg-white">
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
        <div className="flex gap-1.5 pb-0.5">
          <Button
            size="sm"
            onClick={onSave}
            disabled={isSaving || !formData.contact_value.trim()}
            className="h-[30px] rounded-md"
          >
            {isSaving
              ? t('actions.saving', 'Saving...')
              : t('pages.clients.editModal.save', 'Save')}
          </Button>
          <Button size="sm" variant="cancel" onClick={onCancel} className="h-[30px] rounded-md">
            {t('actions.cancel')}
          </Button>
        </div>
      </div>
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
            'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#b9bdc3] text-[10px] font-semibold text-[#9b9fa6] transition-colors hover:border-[#7c8189] hover:text-[#7c8189]',
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
        <Link
          key={item.id}
          to={`/dashboard/clients/${item.id}`}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#d7ebc6] bg-[#ecf6e4] px-2 py-0.5 text-[11px] leading-3 font-semibold text-[#519a3d] no-underline hover:border-[#c5e0b0] hover:bg-[#e3f2d6]"
          title={item.fullName}
        >
          <Icons.Link01 size={9} strokeWidth={2.2} className="shrink-0" />
          <span className="truncate">{item.clientNumber}</span>
        </Link>
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
          ? 'text-[#f0a0a0] hover:bg-[#fef2f2] hover:text-[#d64545]'
          : primary
            ? 'text-primary-500 hover:bg-primary-50 hover:text-primary-700'
            : 'text-[#9b9fa6] hover:bg-[#f2f4f2] hover:text-[#6b7077]',
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
  smsBlocked,
  blockReason,
  onSendSms,
  onSendMessage,
}: {
  phone: string
  smsBlocked?: boolean
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
        disabled={smsBlocked}
        title={smsBlocked ? blockedTitle : t('pages.clients.detail.sendSms', 'Send SMS')}
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
        disabled={smsBlocked}
        title={smsBlocked ? blockedTitle : t('pages.clients.detail.sendMessage', 'Send message')}
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
          disabled={smsBlocked}
          title={smsBlocked ? blockedTitle : messageTitle}
          aria-label={messageTitle}
          data-testid="action-message"
        >
          <Icons.Message01 size={15} className="shrink-0" />
        </ActionIconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px] bg-white">
        <DropdownMenuItem
          disabled={smsBlocked}
          className="cursor-pointer text-sm"
          data-testid="action-message-sms"
          onClick={() => onSendSms(phone)}
        >
          {t('pages.clients.detail.sendSms', 'Send SMS')}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={smsBlocked}
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
  contact,
  contactTypesById,
  canEditClient,
  canMakeCalls,
  linkedContacts,
  onStartEdit,
  onDelete,
  onOpenTagHistory,
  onOpenTagModal,
  onCall,
  onSendSms,
  onSendMessage,
  onStartInteraction,
}: {
  contact: RecommenderContact
  contactTypesById: Map<number, ContactTypeOption>
  canEditClient: boolean
  canMakeCalls: boolean
  linkedContacts: LinkedContactBadge[]
  onStartEdit: (contact: RecommenderContact) => void
  onDelete: (contactId: number) => void
  onOpenTagHistory: (contactId: number, phone: string) => void
  onOpenTagModal: (contactId: number, phone: string) => void
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
  const smsBlockReason = contact.blocking?.reasons
    .filter((r) => r.toLowerCase().includes('sms'))
    .join('; ')

  return (
    <div
      data-testid={isPhone ? 'recommender-phone-card' : 'recommender-other-card'}
      className="flex flex-col gap-1.5 rounded-xl border border-[#e8e9eb] bg-white px-3.5 py-2.5 transition-[border-color,box-shadow] hover:border-[#d7ebc6] hover:shadow-[0_2px_10px_rgba(63,157,91,0.07)]"
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
                    'text-dark-500 min-w-0 text-xs font-medium tracking-[-0.24px] break-all',
                    isPhone && 'tabular-nums'
                  )}
                >
                  {contact.contactValue}
                </span>
                <ContactInfoButton contact={contact} onOpenTagHistory={onOpenTagHistory} />
              </div>
            </div>
            <div className="w-[190px] shrink-0 pt-0.5">
              <span
                data-testid="contact-type-pill"
                className={cn(
                  'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] leading-[1.4] font-semibold whitespace-nowrap',
                  contactTypePillToneClass(contact.contactTypeCode, isPhone)
                )}
              >
                <ContactTypePillIcon
                  contactSource={typeMeta?.contact_source}
                  isPhone={isPhone}
                  code={contact.contactTypeCode}
                />
                <span className="truncate">{typeLabel || '—'}</span>
              </span>
            </div>
            <div className="ml-auto flex shrink-0 items-center">
              <div className="flex items-center gap-px" data-testid="contact-actions">
                {showPhoneActions && (
                  <>
                    <PermissionGuard permission={PERMISSIONS.COMMUNICATION.MAKE_CALLS}>
                      <ActionIconButton
                        primary
                        disabled={!canMakeCalls}
                        title={t('pages.clients.detail.call', 'Call')}
                        data-testid="action-call"
                        onClick={() => onCall(contact.contactValue, contact.contactTypeId)}
                      >
                        <Icons.Headset size={15} className="shrink-0" />
                      </ActionIconButton>
                    </PermissionGuard>
                    <MessageActionsButton
                      phone={contact.contactValue}
                      smsBlocked={contact.blocking?.blocks_sms}
                      blockReason={smsBlockReason}
                      onSendSms={onSendSms}
                      onSendMessage={onSendMessage}
                    />
                    <ActionIconButton
                      primary
                      title={t('pages.contactTags.tags', 'Tags')}
                      data-testid="action-tag"
                      onClick={() => onOpenTagModal(contact.id, contact.contactValue)}
                    >
                      <Icons.Tag01 size={15} className="shrink-0" />
                    </ActionIconButton>
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
                        className="mx-1 h-[18px] w-px shrink-0 bg-[#eceef0]"
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
          {isPhone && linkedContacts.length > 0 && (
            <div className="ml-0 md:ml-[156px]">
              <LinkedContactPills linked={linkedContacts} />
            </div>
          )}
          {isPhone && contact.contactTags.length > 0 && (
            <div
              className="ml-0 flex flex-wrap gap-1.5 md:ml-[156px]"
              data-testid="contact-tag-chips"
            >
              {contact.contactTags.map((tag) => (
                <button
                  key={tag.value_id}
                  type="button"
                  className="cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
                  title={tag.category_name}
                  onClick={() => onOpenTagModal(contact.id, contact.contactValue)}
                >
                  <TagBadge
                    name={tag.name}
                    color={tag.color || '#64748b'}
                    size="sm"
                    isProtected={tag.is_protected}
                    isSystem={tag.is_system}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
        <div
          data-testid="contact-comment"
          className="w-[320px] max-w-[36%] shrink-0 border-l border-[#eceef0] py-0.5 pl-3.5 text-xs leading-[1.35] break-words text-[#7c8189] md:max-w-none"
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
  ...shared
}: {
  isPhone: boolean
  contacts: RecommenderContact[]
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
              contact={contact}
              contactTypesById={contactTypesById}
              canEditClient={canEditClient}
              canMakeCalls={shared.canMakeCalls}
              linkedContacts={linked}
              onStartEdit={shared.onStartEdit}
              onDelete={shared.onDelete}
              onOpenTagHistory={shared.onOpenTagHistory}
              onOpenTagModal={shared.onOpenTagModal}
              onCall={shared.onCall}
              onSendSms={shared.onSendSms}
              onSendMessage={shared.onSendMessage}
              onStartInteraction={shared.onStartInteraction}
            />
          )
        })}
        {contacts.length === 0 && !showAddForm && <p className="py-2 text-xs text-gray-500">—</p>}
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
      <ContactSection isPhone {...sectionProps} contacts={phoneContacts} />
      <ContactSection isPhone={false} {...sectionProps} contacts={otherContacts} />
    </div>
  )
}
