import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link01Icon } from '@hugeicons/core-free-icons'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { searchClients, type SearchType } from '@/api/clientSearchApi'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Label } from '@/components/ui/Label'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Textarea } from '@/components/ui/Textarea'
import { useClientEmails } from '@/features/clients/hooks/useClientEmails'
import { useDebounce } from '@/hooks/useDebounce'
import {
  applyLetterTemplatePlaceholders,
  useLegalComposerReplyTemplates,
  useLegalMailboxes,
  useSendOutgoingLetter,
  type LegalMailbox,
  type LegalStagedAttachment,
} from '@/features/lawyerWorkplace'
import { legalApi } from '@/features/lawyerWorkplace/api/legalApi'
import { formatAttachmentSize } from '@/features/lawyerWorkplace/api/mappers'
import { useAuthStore } from '@/stores/authStore'
import { Icon, Icons } from '@/lib/icons'
import { getErrorMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { piiProps } from '@/lib/openreplay/pii'

type RecipientMode = 'client' | 'institution'

// Client search-by types — mirror the dashboard header search bar so the
// outgoing-letter client lookup behaves the same (project-scoped by the
// active project the user selected in their profile).
const CLIENT_SEARCH_TYPES: { value: SearchType; labelKey: string; fallback: string }[] = [
  { value: 'phone', labelKey: 'search.phoneNumber', fallback: 'Phone number' },
  { value: 'name', labelKey: 'search.fullName', fallback: 'Full name' },
  { value: 'email', labelKey: 'search.email', fallback: 'Email' },
  { value: 'tin', labelKey: 'search.tin', fallback: 'TIN' },
  { value: 'contract_number', labelKey: 'search.contractNumber', fallback: 'Contract number' },
]

function clientCode(id: number): string {
  return `CL-${String(id).padStart(5, '0')}`
}

function formatClientOption(client: { id: number; full_name: string }): {
  id: string
  name: string
} {
  const code = clientCode(client.id)
  const name = client.full_name?.trim()
  return { id: String(client.id), name: name ? `${code} · ${name}` : code }
}

function resolveDefaultMailbox(mailboxes: LegalMailbox[]): LegalMailbox | null {
  return mailboxes[0] ?? null
}

interface NewOutgoingLetterFormProps {
  onClose: () => void
  onSent?: (messageId: string) => void
}

function NewOutgoingLetterForm({ onClose, onSent }: NewOutgoingLetterFormProps) {
  const { t, i18n } = useTranslation('common')
  const currentUserId = Number(useAuthStore((state) => state.user?.id))
  const { data: mailboxesData } = useLegalMailboxes()
  const { data: replyTemplatesData } = useLegalComposerReplyTemplates(null)
  const sendMutation = useSendOutgoingLetter()

  const [stagingSessionId] = useState(() => crypto.randomUUID())
  const [stagedAttachments, setStagedAttachments] = useState<LegalStagedAttachment[]>([])
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const mailboxes = useMemo(() => mailboxesData?.items ?? [], [mailboxesData?.items])
  const replyTemplates = useMemo(() => replyTemplatesData?.items ?? [], [replyTemplatesData?.items])
  const defaultMailbox = useMemo(() => resolveDefaultMailbox(mailboxes), [mailboxes])

  const [mailboxOverrideId, setMailboxOverrideId] = useState<string | null>(null)
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('client')
  const [clientId, setClientId] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [searchType, setSearchType] = useState<SearchType>('phone')
  const [emailOverride, setEmailOverride] = useState<{ clientId: string; email: string } | null>(
    null
  )
  const [institutionEmail, setInstitutionEmail] = useState('')
  const [institutionName, setInstitutionName] = useState('')
  const [institutionEdoClientId, setInstitutionEdoClientId] = useState('')
  const [institutionEdoClientSearch, setInstitutionEdoClientSearch] = useState('')
  const [institutionEdoSearchType, setInstitutionEdoSearchType] = useState<SearchType>('phone')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [selectedClientTemplateContext, setSelectedClientTemplateContext] = useState<{
    clientName: string | null
    contract: string | null
  }>({ clientName: null, contract: null })

  const debouncedClientSearch = useDebounce(clientSearch, 300)
  const debouncedInstitutionEdoClientSearch = useDebounce(institutionEdoClientSearch, 300)
  // Project-scoped client search (active project from the JWT), with a
  // selectable search-by field — same API the dashboard header search uses.
  const { data: clientsData, isFetching: clientsLoading } = useQuery({
    queryKey: ['legal', 'outgoing-client-search', searchType, debouncedClientSearch],
    queryFn: () => searchClients({ q: debouncedClientSearch, search_type: searchType, limit: 20 }),
    enabled: recipientMode === 'client' && debouncedClientSearch.length >= 2,
    staleTime: 30_000,
  })

  const { data: institutionEdoClientsData, isFetching: institutionEdoClientsLoading } = useQuery({
    queryKey: [
      'legal',
      'outgoing-institution-edo-client-search',
      institutionEdoSearchType,
      debouncedInstitutionEdoClientSearch,
    ],
    queryFn: () =>
      searchClients({
        q: debouncedInstitutionEdoClientSearch,
        search_type: institutionEdoSearchType,
        limit: 20,
      }),
    enabled: recipientMode === 'institution' && debouncedInstitutionEdoClientSearch.length >= 2,
    staleTime: 30_000,
  })

  const clientIdNumber = Number(clientId)
  const { data: clientEmailsData } = useClientEmails(
    Number.isFinite(clientIdNumber) && clientIdNumber > 0 ? clientIdNumber : null,
    recipientMode === 'client' ? 'client' : null
  )

  const clientOptions = useMemo(
    () => (clientsData?.items ?? []).map(formatClientOption),
    [clientsData?.items]
  )

  const institutionEdoClientOptions = useMemo(
    () => (institutionEdoClientsData?.items ?? []).map(formatClientOption),
    [institutionEdoClientsData?.items]
  )

  const activeInstitutionEdoSearchType = CLIENT_SEARCH_TYPES.find(
    (opt) => opt.value === institutionEdoSearchType
  )
  const institutionEdoSearchTypeLabel = activeInstitutionEdoSearchType
    ? t(activeInstitutionEdoSearchType.labelKey, activeInstitutionEdoSearchType.fallback)
    : ''

  const activeSearchType = CLIENT_SEARCH_TYPES.find((opt) => opt.value === searchType)
  const searchTypeLabel = activeSearchType
    ? t(activeSearchType.labelKey, activeSearchType.fallback)
    : ''

  const clientEmails = useMemo(
    () => (clientEmailsData ?? []).map((item) => item.contact_value).filter(Boolean),
    [clientEmailsData]
  )

  const selectedMailboxId = mailboxOverrideId ?? defaultMailbox?.id ?? null
  const selectedMailbox =
    mailboxes.find((mailbox) => mailbox.id === selectedMailboxId) ?? defaultMailbox
  const toEmail =
    emailOverride?.clientId === clientId ? emailOverride.email : (clientEmails[0] ?? '')

  const handleClientChange = (id: string) => {
    setClientId(id)
    setClientSearch('')
    setEmailOverride(null)

    const client = clientsData?.items.find((item) => String(item.id) === id)
    if (!client) {
      setSelectedClientTemplateContext({ clientName: null, contract: null })
      return
    }

    const contract = clientCode(client.id)
    const clientName = client.full_name?.trim() || null
    setSelectedClientTemplateContext({ clientName, contract })
  }

  const applyTemplateToBody = (templateBody: string) => {
    const filled = applyLetterTemplatePlaceholders(
      templateBody,
      {
        clientName: selectedClientTemplateContext.clientName,
        contract: selectedClientTemplateContext.contract,
      },
      { language: i18n.language }
    )
    setBody((prev) => (prev.trim() ? `${prev.trim()}\n\n${filled}` : filled))
  }

  const effectiveToEmail = recipientMode === 'client' ? toEmail : institutionEmail
  // CRM client linked to the letter for the correspondence register: the picked
  // client in client mode, or the optional client link in institution mode.
  const registrationClientId = recipientMode === 'client' ? clientId : institutionEdoClientId
  const registrationClientNumber = Number(registrationClientId)

  const canSend =
    Boolean(selectedMailbox?.id) &&
    effectiveToEmail.trim() !== '' &&
    subject.trim() !== '' &&
    body.trim() !== '' &&
    (recipientMode === 'client' ? clientId !== '' : institutionName.trim() !== '') &&
    !sendMutation.isPending

  const handleSend = () => {
    if (!canSend || !selectedMailbox) return

    const clientIdForPayload =
      Number.isFinite(registrationClientNumber) && registrationClientNumber > 0
        ? registrationClientNumber
        : null
    const assignedUserId =
      Number.isFinite(currentUserId) && currentUserId > 0 ? currentUserId : null

    // Outgoing letters are always registered in the correspondence journal —
    // there is no EDO mode selector, so `edo_type` is never sent. Client/lawyer
    // are forwarded only when known; the backend assigns the outgoing number.
    sendMutation.mutate(
      {
        mailbox_id: selectedMailbox.id,
        to_addresses: [effectiveToEmail.trim()],
        subject: subject.trim(),
        body_text: body.trim(),
        ...(clientIdForPayload != null ? { client_id: clientIdForPayload } : {}),
        ...(assignedUserId != null ? { assigned_to_user_id: assignedUserId } : {}),
        institution_name: recipientMode === 'institution' ? institutionName.trim() : undefined,
        attachment_ids: stagedAttachments.map((item) => item.id),
        staging_session_id: stagingSessionId,
      },
      {
        onSuccess: (data) => {
          onSent?.(data.message_id)
          onClose()
        },
      }
    )
  }

  return (
    <>
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Sent02 size={16} className="text-foreground" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.lawyerWorkplace.newLetter.title', 'New Outgoing Letter')}
      />

      <ModalContent>
        <div className="flex flex-col gap-4">
          <div className="flex w-full flex-col gap-2">
            <Label className="text-foreground text-[12px] font-normal">
              {t('pages.lawyerWorkplace.newLetter.from', 'From')}
            </Label>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={mailboxes.length === 0}
                  className="text-foreground border-border bg-input flex h-9 w-full items-center justify-between rounded-[8px] border px-3 text-[13px] font-light outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>{selectedMailbox?.email ?? t('common.loading', 'Loading...')}</span>
                  <Icons.ArrowDown
                    size={14}
                    strokeWidth={1.5}
                    className="text-muted-foreground shrink-0"
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-[var(--radix-dropdown-menu-trigger-width)] p-1.5"
              >
                {mailboxes.map((mailbox) => (
                  <DropdownMenuItem
                    key={mailbox.id}
                    className={cn(
                      'cursor-pointer rounded-md px-2.5 py-1.5 text-[13px]',
                      mailbox.id === selectedMailbox?.id && 'bg-muted font-medium'
                    )}
                    onClick={() => setMailboxOverrideId(mailbox.id)}
                  >
                    {mailbox.email}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex w-full flex-col gap-2">
            <Label className="text-foreground text-[12px] font-normal">
              {t('pages.lawyerWorkplace.newLetter.recipientType', 'Recipient')}
            </Label>
            <div className="border-card bg-card flex w-fit rounded-[8px] border p-1 shadow-sm">
              {(
                [
                  {
                    id: 'client' as const,
                    labelKey: 'pages.lawyerWorkplace.newLetter.toClient',
                    fallback: 'CRM client',
                  },
                  {
                    id: 'institution' as const,
                    labelKey: 'pages.lawyerWorkplace.newLetter.toInstitution',
                    fallback: 'Institution / Court / NBU',
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setRecipientMode(opt.id)
                    setClientId('')
                    setEmailOverride(null)
                    setInstitutionEmail('')
                    setInstitutionName('')
                    setInstitutionEdoClientId('')
                    setInstitutionEdoClientSearch('')
                  }}
                  className={cn(
                    'rounded-[6px] px-3 py-1.5 text-[12px] font-medium transition-colors',
                    recipientMode === opt.id
                      ? 'bg-secondary-800 text-white'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  {t(opt.labelKey, opt.fallback)}
                </button>
              ))}
            </div>
          </div>

          {recipientMode === 'client' && (
            <>
              <div className="flex w-full flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-foreground text-[12px] font-normal">
                    {t('pages.lawyerWorkplace.newLetter.client', 'Client')}
                    <span className="text-error-500 ml-1">*</span>
                  </Label>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="text-foreground border-border bg-input flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[12px] font-light outline-none"
                      >
                        <Icons.Search
                          size={12}
                          strokeWidth={1.5}
                          className="text-muted-foreground"
                        />
                        {searchTypeLabel}
                        <Icons.ArrowDown
                          size={13}
                          strokeWidth={1.5}
                          className="text-muted-foreground"
                        />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[160px]">
                      {CLIENT_SEARCH_TYPES.map((opt) => (
                        <DropdownMenuItem
                          key={opt.value}
                          className="cursor-pointer text-[13px]"
                          onClick={() => {
                            setSearchType(opt.value)
                            setClientSearch('')
                          }}
                        >
                          {t(opt.labelKey, opt.fallback)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <SearchableSelect
                  obscured
                  options={clientOptions}
                  value={clientId}
                  onValueChange={handleClientChange}
                  onSearchChange={setClientSearch}
                  isLoading={clientsLoading}
                  emptySearchHint={t(
                    'pages.lawyerWorkplace.newLetter.clientSearchHint',
                    'Type 2+ characters to search…'
                  )}
                  placeholder={t(
                    'pages.lawyerWorkplace.newLetter.selectClient',
                    'Search client...'
                  )}
                />
              </div>

              {clientId && (
                <div className="flex w-full flex-col gap-2">
                  <Label className="text-foreground text-[12px] font-normal">
                    {t('pages.lawyerWorkplace.newLetter.to', 'To')}
                    <span className="text-error-500 ml-1">*</span>
                  </Label>
                  {clientEmails.length > 1 ? (
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="text-foreground border-border bg-input flex h-9 w-full items-center justify-between rounded-[8px] border px-3 text-[13px] font-light outline-none"
                        >
                          <span>
                            {toEmail ||
                              t('pages.lawyerWorkplace.newLetter.selectEmail', 'Select email...')}
                          </span>
                          <Icons.ArrowDown
                            size={14}
                            strokeWidth={1.5}
                            className="text-muted-foreground shrink-0"
                          />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="w-[var(--radix-dropdown-menu-trigger-width)] p-1.5"
                      >
                        {clientEmails.map((email) => (
                          <DropdownMenuItem
                            key={email}
                            className={cn(
                              'cursor-pointer rounded-md px-2.5 py-1.5 text-[13px]',
                              email === toEmail && 'bg-muted font-medium'
                            )}
                            onClick={() => setEmailOverride({ clientId, email })}
                          >
                            {email}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <div className="text-foreground border-border bg-muted flex h-9 w-full items-center rounded-[8px] border px-3 text-[13px] font-light">
                      {toEmail ||
                        t('pages.lawyerWorkplace.newLetter.noClientEmail', 'No email on file')}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {recipientMode === 'institution' && (
            <>
              <div className="flex w-full flex-col gap-2">
                <Label className="text-foreground text-[12px] font-normal">
                  {t('pages.lawyerWorkplace.newLetter.institutionName', 'Institution name')}
                  <span className="text-error-500 ml-1">*</span>
                </Label>
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder={t(
                    'pages.lawyerWorkplace.newLetter.institutionNamePlaceholder',
                    'e.g. National Bank of Ukraine'
                  )}
                  className="text-foreground focus:border-primary-500 border-border bg-input h-9 w-full rounded-[8px] border px-3 text-[13px] font-light outline-none"
                />
              </div>

              <div className="flex w-full flex-col gap-2">
                <Label className="text-foreground text-[12px] font-normal">
                  {t('pages.lawyerWorkplace.newLetter.to', 'To')}
                  <span className="text-error-500 ml-1">*</span>
                </Label>
                <input
                  type="email"
                  value={institutionEmail}
                  onChange={(e) => setInstitutionEmail(e.target.value)}
                  placeholder={t(
                    'pages.lawyerWorkplace.newLetter.institutionPlaceholder',
                    'e.g. consumers@bank.gov.ua'
                  )}
                  className="text-foreground focus:border-primary-500 border-border bg-input h-9 w-full rounded-[8px] border px-3 text-[13px] font-light outline-none"
                />
              </div>
            </>
          )}

          <div className="flex w-full flex-col gap-2">
            <Label className="text-foreground text-[12px] font-normal">
              {t('pages.lawyerWorkplace.newLetter.subject', 'Subject')}
              <span className="text-error-500 ml-1">*</span>
            </Label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t(
                'pages.lawyerWorkplace.newLetter.subjectPlaceholder',
                'Letter subject...'
              )}
              className="text-foreground focus:border-primary-500 border-border bg-input h-9 w-full rounded-[8px] border px-3 text-[13px] font-light outline-none"
            />
          </div>

          <div className="flex w-full flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-foreground text-[12px] font-normal">
                {t('pages.lawyerWorkplace.newLetter.body', 'Message')}
                <span className="text-error-500 ml-1">*</span>
              </Label>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px]"
                  >
                    <Icons.Files02Icon size={12} strokeWidth={1.5} />
                    {t('pages.lawyerWorkplace.reply.template', 'Template')}
                    <Icons.ArrowDown size={9} strokeWidth={2} className="text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[170px] p-1.5">
                  {replyTemplates.length === 0 ? (
                    <DropdownMenuItem disabled className="text-[12px]">
                      {t('pages.lawyerWorkplace.reply.noTemplates', 'No templates available')}
                    </DropdownMenuItem>
                  ) : (
                    replyTemplates.map((template) => (
                      <DropdownMenuItem
                        key={template.id}
                        className="cursor-pointer rounded-md px-2.5 py-1.5 text-[12px]"
                        onClick={() => applyTemplateToBody(template.body)}
                      >
                        {template.name}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              textareaSize="md"
              className="text-foreground min-h-[120px] w-full text-[13px] font-light"
              placeholder={t(
                'pages.lawyerWorkplace.newLetter.bodyPlaceholder',
                'Write your message...'
              )}
            />
          </div>

          {recipientMode === 'institution' && (
            <div className="flex w-full flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-foreground text-[12px] font-normal">
                  {t(
                    'pages.lawyerWorkplace.newLetter.clientForRegister',
                    'CRM client (optional, for the register)'
                  )}
                </Label>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="text-foreground border-border bg-input flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[12px] font-light outline-none"
                    >
                      <Icons.Search size={12} strokeWidth={1.5} className="text-muted-foreground" />
                      {institutionEdoSearchTypeLabel}
                      <Icons.ArrowDown
                        size={13}
                        strokeWidth={1.5}
                        className="text-muted-foreground"
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[160px]">
                    {CLIENT_SEARCH_TYPES.map((opt) => (
                      <DropdownMenuItem
                        key={opt.value}
                        className="cursor-pointer text-[13px]"
                        onClick={() => {
                          setInstitutionEdoSearchType(opt.value)
                          setInstitutionEdoClientSearch('')
                        }}
                      >
                        {t(opt.labelKey, opt.fallback)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <SearchableSelect
                options={institutionEdoClientOptions}
                value={institutionEdoClientId}
                onValueChange={(id) => {
                  setInstitutionEdoClientId(id)
                  setInstitutionEdoClientSearch('')
                }}
                onSearchChange={setInstitutionEdoClientSearch}
                isLoading={institutionEdoClientsLoading}
                emptySearchHint={t(
                  'pages.lawyerWorkplace.newLetter.clientSearchHint',
                  'Type 2+ characters to search…'
                )}
                placeholder={t('pages.lawyerWorkplace.newLetter.selectClient', 'Search client...')}
              />
            </div>
          )}

          {stagedAttachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {stagedAttachments.map((attachment) => (
                <span
                  key={attachment.id}
                  className="border-border text-foreground bg-card inline-flex max-w-[200px] items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]"
                >
                  <span className="truncate" {...piiProps}>
                    {attachment.filename}
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    {formatAttachmentSize(attachment.size_bytes)}
                  </span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      void legalApi
                        .deleteOutgoingStagedAttachment(stagingSessionId, attachment.id)
                        .then(() =>
                          setStagedAttachments((current) =>
                            current.filter((item) => item.id !== attachment.id)
                          )
                        )
                        .catch((error) => toast.error(getErrorMessage(error)))
                    }}
                  >
                    <Icons.Close size={10} strokeWidth={2} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = event.target.files
              if (!files?.length || !selectedMailbox?.id) return
              void (async () => {
                setIsUploadingAttachment(true)
                try {
                  for (const file of Array.from(files)) {
                    const uploaded = await legalApi.uploadOutgoingStagedAttachment(
                      stagingSessionId,
                      selectedMailbox.id,
                      file
                    )
                    setStagedAttachments((current) => [...current, uploaded])
                  }
                } catch (error) {
                  toast.error(getErrorMessage(error))
                } finally {
                  setIsUploadingAttachment(false)
                  event.target.value = ''
                }
              })()
            }}
          />

          <button
            type="button"
            disabled={!selectedMailbox?.id || isUploadingAttachment}
            onClick={() => fileInputRef.current?.click()}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-[12px] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon icon={Link01Icon} size={14} strokeWidth={1.5} />
            {isUploadingAttachment
              ? t('pages.lawyerWorkplace.reply.attaching', 'Attaching…')
              : t('pages.lawyerWorkplace.reply.attach', 'Attach')}
          </button>
        </div>
      </ModalContent>

      <ModalFooter>
        <Button type="button" variant="cancel" onClick={onClose} className="flex-1">
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSend}
          disabled={!canSend}
          className="flex-1"
        >
          <Icons.Sent02 size={16} strokeWidth={1.5} />
          {sendMutation.isPending
            ? t('pages.lawyerWorkplace.newLetter.sending', 'Sending...')
            : t('pages.lawyerWorkplace.newLetter.send', 'Send')}
        </Button>
      </ModalFooter>
    </>
  )
}

interface NewOutgoingLetterModalProps {
  open: boolean
  onClose: () => void
  onSent?: (messageId: string) => void
}

export function NewOutgoingLetterModal({ open, onClose, onSent }: NewOutgoingLetterModalProps) {
  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      {open ? <NewOutgoingLetterForm onClose={onClose} onSent={onSent} /> : null}
    </Modal>
  )
}
