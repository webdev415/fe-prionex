import { useEffect, useState } from 'react'
import { Attachment01Icon } from '@hugeicons/core-free-icons'
import { useTranslation } from 'react-i18next'
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
import { Icon, Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_MAILBOXES = [
  'legal@prionex.ua',
  'court@prionex.ua',
  'nbu@prionex.ua',
  'accounting@prionex.ua',
]

/** Each client has an id, display name, and their known contact email(s). */
interface ClientOption {
  id: string
  name: string
  emails: string[]
}

const CLIENT_OPTIONS: ClientOption[] = [
  { id: 'cl-08114', name: 'CL-08114 · I. Petrenko', emails: ['petrenko.iv@gmail.com'] },
  { id: 'cl-12409', name: 'CL-12409 · O. Kovalenko', emails: ['o.kovalenko@ukr.net'] },
  { id: 'cl-06441', name: 'CL-06441 · P. Melnyk', emails: ['p.melnyk@gmail.com'] },
  { id: 'cl-09908', name: 'CL-09908 · V. Khomenko', emails: ['v.khomenko@meta.ua'] },
  { id: 'cl-03305', name: 'CL-03305 · M. Bondarenko', emails: ['m.bondarenko@ukr.net'] },
  { id: 'cl-07750', name: 'CL-07750 · L. Savchenko', emails: ['l.savchenko@meta.ua'] },
  { id: 'cl-04412', name: 'CL-04412 · T. Romaniuk', emails: ['romaniuk.t@i.ua'] },
]

type EdoType = 'outgoing' | 'nbu' | 'none'

const EDO_OPTIONS: { id: EdoType; labelKey: string; fallback: string; badge?: string }[] = [
  {
    id: 'outgoing',
    labelKey: 'pages.lawyerWorkplace.reply.edoOutgoing',
    fallback: 'Outgoing (ВИХ)',
    badge: 'ВИХ',
  },
  {
    id: 'nbu',
    labelKey: 'pages.lawyerWorkplace.reply.edoNbu',
    fallback: 'NBU reply (НБУ)',
    badge: 'НБУ',
  },
  { id: 'none', labelKey: 'pages.lawyerWorkplace.reply.edoNone', fallback: 'Do not register' },
]

const TEMPLATES = [
  {
    id: 'complaint',
    labelKey: 'pages.lawyerWorkplace.reply.templates.complaintResponse',
    fallback: 'Complaint response',
  },
  {
    id: 'nbu_ack',
    labelKey: 'pages.lawyerWorkplace.reply.templates.nbuAcknowledgement',
    fallback: 'NBU acknowledgement',
  },
  {
    id: 'extension',
    labelKey: 'pages.lawyerWorkplace.reply.templates.extensionRequest',
    fallback: 'Extension request',
  },
]

// ─── Recipient mode ───────────────────────────────────────────────────────────

type RecipientMode = 'client' | 'institution'

interface NewOutgoingLetterModalProps {
  open: boolean
  onClose: () => void
}

export function NewOutgoingLetterModal({ open, onClose }: NewOutgoingLetterModalProps) {
  const { t } = useTranslation('common')

  const [fromMailbox, setFromMailbox] = useState(MOCK_MAILBOXES[0]!)
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('client')

  // Client mode
  const [clientId, setClientId] = useState('')
  const [toEmail, setToEmail] = useState('')

  // Institution mode
  const [institutionEmail, setInstitutionEmail] = useState('')

  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [edoType, setEdoType] = useState<EdoType>('none')

  // Reset on open
  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      setFromMailbox(MOCK_MAILBOXES[0]!)
      setRecipientMode('client')
      setClientId('')
      setToEmail('')
      setInstitutionEmail('')
      setSubject('')
      setBody('')
      setEdoType('none')
    })
  }, [open])

  const selectedClient = CLIENT_OPTIONS.find((c) => c.id === clientId) ?? null

  // When client changes → auto-select first email, reset if cleared
  const handleClientChange = (id: string) => {
    setClientId(id)
    const client = CLIENT_OPTIONS.find((c) => c.id === id)
    setToEmail(client?.emails[0] ?? '')
  }

  const effectiveToEmail = recipientMode === 'client' ? toEmail : institutionEmail

  const canSend =
    effectiveToEmail.trim() !== '' &&
    subject.trim() !== '' &&
    body.trim() !== '' &&
    (recipientMode === 'institution' || clientId !== '')

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.Sent02 size={16} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title={t('pages.lawyerWorkplace.newLetter.title', 'New Outgoing Letter')}
      />

      <ModalContent>
        <div className="flex flex-col gap-4">
          {/* From mailbox */}
          <div className="flex w-full flex-col gap-2">
            <Label className="text-dark-500 text-[12px] font-normal">
              {t('pages.lawyerWorkplace.newLetter.from', 'From')}
            </Label>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="text-dark-500 flex h-9 w-full items-center justify-between rounded-[8px] border border-gray-200 bg-white px-3 text-[13px] font-light outline-none"
                >
                  <span>{fromMailbox}</span>
                  <Icons.ArrowDown size={14} strokeWidth={1.5} className="shrink-0 text-gray-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-[var(--radix-dropdown-menu-trigger-width)] p-1.5"
              >
                {MOCK_MAILBOXES.map((mb) => (
                  <DropdownMenuItem
                    key={mb}
                    className={cn(
                      'cursor-pointer rounded-md px-2.5 py-1.5 text-[13px]',
                      mb === fromMailbox && 'bg-gray-50 font-medium'
                    )}
                    onClick={() => setFromMailbox(mb)}
                  >
                    {mb}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Recipient type toggle */}
          <div className="flex w-full flex-col gap-2">
            <Label className="text-dark-500 text-[12px] font-normal">
              {t('pages.lawyerWorkplace.newLetter.recipientType', 'Recipient')}
            </Label>
            <div className="flex w-fit rounded-[8px] border border-white bg-white p-1 shadow-sm">
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
                    setToEmail('')
                    setInstitutionEmail('')
                  }}
                  className={cn(
                    'rounded-[6px] px-3 py-1.5 text-[12px] font-medium transition-colors',
                    recipientMode === opt.id
                      ? 'bg-secondary-800 text-white'
                      : 'text-dark-500 hover:bg-gray-50'
                  )}
                >
                  {t(opt.labelKey, opt.fallback)}
                </button>
              ))}
            </div>
          </div>

          {/* ── CLIENT MODE ── */}
          {recipientMode === 'client' && (
            <>
              {/* Client selector */}
              <div className="flex w-full flex-col gap-2">
                <Label className="text-dark-500 text-[12px] font-normal">
                  {t('pages.lawyerWorkplace.newLetter.client', 'Client')}
                  <span className="text-error-500 ml-1">*</span>
                </Label>
                <SearchableSelect
                  options={CLIENT_OPTIONS}
                  value={clientId}
                  onValueChange={handleClientChange}
                  placeholder={t(
                    'pages.lawyerWorkplace.newLetter.selectClient',
                    'Search client...'
                  )}
                />
              </div>

              {/* To: email dropdown — only shown once a client is selected */}
              {selectedClient && (
                <div className="flex w-full flex-col gap-2">
                  <Label className="text-dark-500 text-[12px] font-normal">
                    {t('pages.lawyerWorkplace.newLetter.to', 'To')}
                    <span className="text-error-500 ml-1">*</span>
                  </Label>
                  {selectedClient.emails.length > 1 ? (
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="text-dark-500 flex h-9 w-full items-center justify-between rounded-[8px] border border-gray-200 bg-white px-3 text-[13px] font-light outline-none"
                        >
                          <span>
                            {toEmail ||
                              t('pages.lawyerWorkplace.newLetter.selectEmail', 'Select email...')}
                          </span>
                          <Icons.ArrowDown
                            size={14}
                            strokeWidth={1.5}
                            className="shrink-0 text-gray-400"
                          />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="w-[var(--radix-dropdown-menu-trigger-width)] p-1.5"
                      >
                        {selectedClient.emails.map((email) => (
                          <DropdownMenuItem
                            key={email}
                            className={cn(
                              'cursor-pointer rounded-md px-2.5 py-1.5 text-[13px]',
                              email === toEmail && 'bg-gray-50 font-medium'
                            )}
                            onClick={() => setToEmail(email)}
                          >
                            {email}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <div className="text-dark-500 flex h-9 w-full items-center rounded-[8px] border border-gray-100 bg-gray-50 px-3 text-[13px] font-light">
                      {toEmail}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── INSTITUTION MODE ── */}
          {recipientMode === 'institution' && (
            <div className="flex w-full flex-col gap-2">
              <Label className="text-dark-500 text-[12px] font-normal">
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
                className="text-dark-500 focus:border-primary-500 h-9 w-full rounded-[8px] border border-gray-200 bg-white px-3 text-[13px] font-light outline-none"
              />
            </div>
          )}

          {/* Subject */}
          <div className="flex w-full flex-col gap-2">
            <Label className="text-dark-500 text-[12px] font-normal">
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
              className="text-dark-500 focus:border-primary-500 h-9 w-full rounded-[8px] border border-gray-200 bg-white px-3 text-[13px] font-light outline-none"
            />
          </div>

          {/* Message */}
          <div className="flex w-full flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-dark-500 text-[12px] font-normal">
                {t('pages.lawyerWorkplace.newLetter.body', 'Message')}
                <span className="text-error-500 ml-1">*</span>
              </Label>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-light-600 flex items-center gap-1 text-[11px] hover:text-gray-700"
                  >
                    <Icons.Files02Icon size={12} strokeWidth={1.5} />
                    {t('pages.lawyerWorkplace.reply.template', 'Template')}
                    <Icons.ArrowDown size={9} strokeWidth={2} className="text-gray-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[170px] p-1.5">
                  {TEMPLATES.map((tmpl) => (
                    <DropdownMenuItem
                      key={tmpl.id}
                      className="cursor-pointer rounded-md px-2.5 py-1.5 text-[12px]"
                      onClick={() =>
                        setBody(
                          (prev) => (prev ? `${prev}\n\n` : '') + t(tmpl.labelKey, tmpl.fallback)
                        )
                      }
                    >
                      {t(tmpl.labelKey, tmpl.fallback)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              textareaSize="md"
              className="text-dark-500 min-h-[120px] w-full text-[13px] font-light"
              placeholder={t(
                'pages.lawyerWorkplace.newLetter.bodyPlaceholder',
                'Write your message...'
              )}
            />
          </div>

          {/* EDO type */}
          <div className="flex w-full flex-col gap-2">
            <Label className="text-dark-500 text-[12px] font-normal">
              {t('pages.lawyerWorkplace.newLetter.edoType', 'EDO document type')}
            </Label>
            <div className="flex flex-wrap gap-2">
              {EDO_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setEdoType(opt.id)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors',
                    edoType === opt.id
                      ? 'border-secondary-400 bg-secondary-50 text-secondary-800'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  )}
                >
                  {opt.badge && <span className="mr-1.5 font-bold">{opt.badge}</span>}
                  {t(opt.labelKey, opt.fallback)}
                </button>
              ))}
            </div>
          </div>

          {/* Attachment */}
          <button
            type="button"
            className="text-light-600 flex items-center gap-1.5 text-[12px] hover:text-gray-700"
          >
            <Icon icon={Attachment01Icon} size={14} strokeWidth={1.5} />
            {t('pages.lawyerWorkplace.reply.attach', 'Attach')}
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
          onClick={onClose}
          disabled={!canSend}
          className="flex-1"
        >
          <Icons.Sent02 size={16} strokeWidth={1.5} />
          {t('pages.lawyerWorkplace.newLetter.send', 'Send')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
