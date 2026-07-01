import { useEffect, useMemo, useState } from 'react'
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
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type {
  LetterTypeConfig,
  MailboxProvider,
  MailboxRoutingRule,
  SettingsMailbox,
} from '../../../settings/types'
import { createRoutingRule } from '../../../settings/utils/mailboxHelpers'
import { ROUTING_MATCH_OPTIONS } from '../constants'
import { LetterTypeBadge } from '../LetterTypeBadge'

export interface MailboxFormValues {
  email: string
  displayName: string
  provider: MailboxProvider
  password: string
  imapHost: string
  imapPort: number
  imapUseSsl: boolean
  smtpHost: string
  smtpPort: number
  smtpUseTls: boolean
  defaultLetterTypeId: string | null
  isDefaultOutgoing: boolean
  routingRules: MailboxRoutingRule[]
  /** Only meaningful on create. When true, the backend will set last_imap_uid
   *  to the current max so only future emails are ingested. */
  syncFromToday: boolean
}

interface ProviderPreset {
  id: MailboxProvider
  label: string
  imapHost: string
  imapPort: number
  imapUseSsl: boolean
  smtpHost: string
  smtpPort: number
  smtpUseTls: boolean
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'ukrnet',
    label: 'ukr.net',
    imapHost: 'imap.ukr.net',
    imapPort: 993,
    imapUseSsl: true,
    smtpHost: 'smtp.ukr.net',
    smtpPort: 465,
    smtpUseTls: false,
  },
  {
    id: 'iua',
    label: 'i.ua',
    imapHost: 'imap.i.ua',
    imapPort: 993,
    imapUseSsl: true,
    smtpHost: 'smtp.i.ua',
    smtpPort: 465,
    smtpUseTls: false,
  },
  {
    id: 'google_workspace',
    label: 'Google Workspace',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapUseSsl: true,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUseTls: true,
  },
  {
    id: 'microsoft365',
    label: 'Microsoft 365',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapUseSsl: true,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpUseTls: true,
  },
  {
    id: 'gmail_oauth2',
    label: 'Gmail (OAuth2)',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapUseSsl: true,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUseTls: true,
  },
  {
    id: 'custom',
    label: 'Custom / Self-hosted',
    imapHost: '',
    imapPort: 993,
    imapUseSsl: true,
    smtpHost: '',
    smtpPort: 587,
    smtpUseTls: true,
  },
]

// Maps known email domains to their provider preset id.
// Order matters — more specific entries first.
const DOMAIN_PROVIDER_MAP: Array<{ domains: string[]; provider: MailboxProvider }> = [
  { domains: ['gmail.com', 'googlemail.com'], provider: 'gmail_oauth2' },
  { domains: ['ukr.net'], provider: 'ukrnet' },
  {
    domains: ['i.ua', 'meta.ua', 'ua.fm', 'email.ua', 'inbox.ua', 'bigmir.net', 'yandex.ua'],
    provider: 'iua',
  },
  {
    domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'live.co.uk', 'hotmail.co.uk'],
    provider: 'microsoft365',
  },
]

function detectProviderFromEmail(emailValue: string): MailboxProvider | null {
  const atIdx = emailValue.indexOf('@')
  if (atIdx === -1) return null
  const domain = emailValue
    .slice(atIdx + 1)
    .toLowerCase()
    .trim()
  if (!domain) return null
  for (const entry of DOMAIN_PROVIDER_MAP) {
    if (entry.domains.includes(domain)) return entry.provider
  }
  return null
}

const DEFAULT_EMPTY: MailboxFormValues = {
  email: '',
  displayName: '',
  provider: 'microsoft365',
  password: '',
  imapHost: 'outlook.office365.com',
  imapPort: 993,
  imapUseSsl: true,
  smtpHost: 'smtp.office365.com',
  smtpPort: 587,
  smtpUseTls: true,
  defaultLetterTypeId: null,
  isDefaultOutgoing: false,
  routingRules: [],
  syncFromToday: true,
}

function getInitialValues(mailbox: SettingsMailbox | null): MailboxFormValues {
  if (!mailbox) return { ...DEFAULT_EMPTY }

  const preset = PROVIDER_PRESETS.find((p) => p.id === mailbox.provider)

  return {
    email: mailbox.email,
    displayName: mailbox.displayNameFallback,
    provider: mailbox.provider,
    password: '',
    // Pre-fill server fields from the known preset for this provider so the
    // user can see (and optionally change) them. For Custom, leave blank so
    // the user must fill them in if they want to update credentials.
    imapHost: preset?.imapHost ?? '',
    imapPort: preset?.imapPort ?? 993,
    imapUseSsl: preset?.imapUseSsl ?? true,
    smtpHost: preset?.smtpHost ?? '',
    smtpPort: preset?.smtpPort ?? 587,
    smtpUseTls: preset?.smtpUseTls ?? true,
    defaultLetterTypeId: mailbox.defaultLetterTypeId,
    isDefaultOutgoing: mailbox.isDefaultOutgoing,
    routingRules: mailbox.routingRules.map((rule) => ({ ...rule })),
    syncFromToday: false, // no-op on edit, only relevant for create
  }
}

interface MailboxModalProps {
  open: boolean
  mailbox: SettingsMailbox | null
  letterTypes: LetterTypeConfig[]
  existingEmails: string[]
  onClose: () => void
  onSave: (values: MailboxFormValues) => void | Promise<void>
  isSubmitting?: boolean
}

export function MailboxModal({
  open,
  mailbox,
  letterTypes,
  existingEmails,
  onClose,
  onSave,
  isSubmitting = false,
}: MailboxModalProps) {
  const { t } = useTranslation('common')
  const isEditing = mailbox !== null

  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [provider, setProvider] = useState<MailboxProvider>('microsoft365')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [imapHost, setImapHost] = useState('')
  const [imapPort, setImapPort] = useState(993)
  const [imapUseSsl, setImapUseSsl] = useState(true)
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState(587)
  const [smtpUseTls, setSmtpUseTls] = useState(true)
  const [defaultLetterTypeId, setDefaultLetterTypeId] = useState<string | null>(null)
  const [isDefaultOutgoing, setIsDefaultOutgoing] = useState(false)
  const [routingRules, setRoutingRules] = useState<MailboxRoutingRule[]>([])
  const [syncFromToday, setSyncFromToday] = useState(true)
  const [newMatchType, setNewMatchType] =
    useState<MailboxRoutingRule['matchType']>('subject_keyword')
  const [newMatchValue, setNewMatchValue] = useState('')
  const [newRuleTypeId, setNewRuleTypeId] = useState('')

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      const initial = getInitialValues(mailbox)
      setEmail(initial.email)
      setDisplayName(initial.displayName)
      setProvider(initial.provider)
      setPassword('')
      setShowPassword(false)
      setImapHost(initial.imapHost)
      setImapPort(initial.imapPort)
      setImapUseSsl(initial.imapUseSsl)
      setSmtpHost(initial.smtpHost)
      setSmtpPort(initial.smtpPort)
      setSmtpUseTls(initial.smtpUseTls)
      setDefaultLetterTypeId(initial.defaultLetterTypeId)
      setIsDefaultOutgoing(initial.isDefaultOutgoing)
      setRoutingRules(initial.routingRules)
      setSyncFromToday(initial.syncFromToday)
      setNewMatchType('subject_keyword')
      setNewMatchValue('')
      setNewRuleTypeId(letterTypes[0]?.id ?? '')
    })
  }, [open, mailbox, letterTypes])

  const handleProviderChange = (next: MailboxProvider) => {
    setProvider(next)
    const preset = PROVIDER_PRESETS.find((p) => p.id === next)
    if (preset) {
      setImapHost(preset.imapHost)
      setImapPort(preset.imapPort)
      setImapUseSsl(preset.imapUseSsl)
      setSmtpHost(preset.smtpHost)
      setSmtpPort(preset.smtpPort)
      setSmtpUseTls(preset.smtpUseTls)
    }
  }

  const handleEmailChange = (value: string) => {
    setEmail(value)
    // Only auto-detect when adding a new mailbox (don't change provider on edit)
    if (isEditing) return
    const detected = detectProviderFromEmail(value)
    if (detected && detected !== provider) {
      handleProviderChange(detected)
    }
  }

  const duplicateEmail = useMemo(() => {
    const normalized = email.trim().toLowerCase()
    if (!normalized) return false
    return existingEmails.some(
      (item) =>
        item.toLowerCase() === normalized && item.toLowerCase() !== mailbox?.email.toLowerCase()
    )
  }, [email, existingEmails, mailbox?.email])

  const isGmailOAuth = provider === 'gmail_oauth2'
  const isCustom = provider === 'custom'

  // Password is required when:
  //   • Adding a new mailbox (non-OAuth2)
  //   • Editing a mailbox that currently has NO credentials (must set one now)
  // Password is optional when editing a mailbox that already HAS credentials
  // (blank = keep existing password).
  const hasExistingCredentials = isEditing && (mailbox?.hasCredentials ?? false)
  const passwordValid = isGmailOAuth
    ? true
    : hasExistingCredentials
      ? true
      : password.trim().length > 0

  const customHostsValid = !isCustom || (imapHost.trim().length > 0 && smtpHost.trim().length > 0)

  const canSave =
    email.trim().length > 0 &&
    displayName.trim().length > 0 &&
    !duplicateEmail &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    passwordValid &&
    customHostsValid

  const handleAddRule = () => {
    if (!newRuleTypeId) return
    if (newMatchType !== 'default' && !newMatchValue.trim()) return
    const rule = createRoutingRule(newRuleTypeId, newMatchType, newMatchValue)
    setRoutingRules((previous) => [...previous, rule])
    setNewMatchValue('')
  }

  const handleRemoveRule = (ruleId: string) => {
    setRoutingRules((previous) => previous.filter((rule) => rule.id !== ruleId))
  }

  const handleSave = () => {
    if (!canSave || isSubmitting) return
    void onSave({
      email: email.trim(),
      displayName: displayName.trim(),
      provider,
      password,
      imapHost,
      imapPort,
      imapUseSsl,
      smtpHost,
      smtpPort,
      smtpUseTls,
      defaultLetterTypeId,
      isDefaultOutgoing,
      routingRules,
      syncFromToday,
    })
  }

  const selectedDefaultType = letterTypes.find((type) => type.id === defaultLetterTypeId)
  const selectedProviderLabel = PROVIDER_PRESETS.find((p) => p.id === provider)?.label ?? provider

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-10 w-10 items-center justify-center rounded-full">
            <Icons.Mail size={20} strokeWidth={1.5} className="text-dark-500" />
          </div>
        }
        title={
          isEditing
            ? t('pages.lawyerWorkplace.settings.mailboxes.editTitle', 'Edit mailbox')
            : t('pages.lawyerWorkplace.settings.mailboxes.addTitle', 'Add mailbox')
        }
      />
      <ModalContent className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto px-1">
        {/* Email + Display name */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label className="text-dark-500 text-[13px] font-medium">
              {t('pages.lawyerWorkplace.settings.mailboxes.fields.email', 'Email address')}
            </Label>
            <input
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="legal@prionex.ua"
              className="text-dark-500 focus:border-primary-400 h-11 rounded-md border border-gray-200 bg-white px-4 text-[14px] outline-none"
            />
            {duplicateEmail ? (
              <p className="text-error-600 text-[11px]">
                {t(
                  'pages.lawyerWorkplace.settings.mailboxes.duplicateEmail',
                  'This mailbox is already connected'
                )}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-dark-500 text-[13px] font-medium">
              {t('pages.lawyerWorkplace.settings.mailboxes.fields.displayName', 'Display name')}
            </Label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t(
                'pages.lawyerWorkplace.settings.mailboxes.fields.displayNamePlaceholder',
                'Legal department'
              )}
              className="text-dark-500 focus:border-primary-400 h-11 rounded-md border border-gray-200 bg-white px-4 text-[14px] outline-none"
            />
          </div>
        </div>

        {/* Provider selector */}
        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[13px] font-medium">
            {t('pages.lawyerWorkplace.settings.mailboxes.fields.provider', 'Mail provider')}
          </Label>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-dark-500 flex h-11 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-4 text-[14px]"
              >
                <span>{selectedProviderLabel}</span>
                <Icons.ArrowDown size={16} strokeWidth={1.5} className="text-light-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="min-w-[var(--radix-dropdown-menu-trigger-width)] p-1.5"
            >
              {PROVIDER_PRESETS.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  className="cursor-pointer"
                  onClick={() => handleProviderChange(preset.id)}
                >
                  {preset.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Gmail OAuth2 notice */}
        {isGmailOAuth ? (
          <div className="rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-[13px] font-medium text-blue-800">
              {t(
                'pages.lawyerWorkplace.settings.mailboxes.oauth2.title',
                'Gmail requires OAuth2 authorisation'
              )}
            </p>
            <p className="mt-0.5 text-[11.5px] text-blue-600">
              {t(
                'pages.lawyerWorkplace.settings.mailboxes.oauth2.hint',
                'Save the mailbox, then click the "Connect Gmail" button in the table to authorise access via Google. No password is stored.'
              )}
            </p>
          </div>
        ) : null}

        {/* App password (non-OAuth2 providers) */}
        {!isGmailOAuth ? (
          <div className="flex flex-col gap-2">
            <Label className="text-dark-500 text-[13px] font-medium">
              {t('pages.lawyerWorkplace.settings.mailboxes.fields.password', 'App password')}
            </Label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  hasExistingCredentials
                    ? t(
                        'pages.lawyerWorkplace.settings.mailboxes.fields.passwordEditPlaceholder',
                        'Leave blank to keep current password'
                      )
                    : t(
                        'pages.lawyerWorkplace.settings.mailboxes.fields.passwordPlaceholder',
                        'Enter app password'
                      )
                }
                className="text-dark-500 focus:border-primary-400 h-11 w-full rounded-md border border-gray-200 bg-white px-4 pr-12 text-[14px] outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-light-500 hover:text-dark-500 absolute top-0 right-0 flex h-11 w-11 items-center justify-center"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <Icons.View size={16} strokeWidth={showPassword ? 1.5 : 2.5} />
              </button>
            </div>
            <p className="text-light-500 text-[11px]">
              {t(
                'pages.lawyerWorkplace.settings.mailboxes.fields.passwordHint',
                'Use an app-specific password generated in your mail account security settings, not your main login password.'
              )}
            </p>
          </div>
        ) : null}

        {/* Custom provider server settings */}
        {isCustom ? (
          <div className="space-y-4 rounded-md border border-gray-100 bg-gray-50 p-4">
            <p className="text-dark-500 text-[12px] font-semibold">
              {t(
                'pages.lawyerWorkplace.settings.mailboxes.serverSettings.title',
                'Server settings'
              )}
            </p>

            {/* IMAP */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label className="text-light-600 text-[11px]">
                  {t(
                    'pages.lawyerWorkplace.settings.mailboxes.serverSettings.imapHost',
                    'IMAP host'
                  )}
                </Label>
                <input
                  type="text"
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                  placeholder="imap.mail.prionex.ua"
                  className="text-dark-500 focus:border-primary-400 h-10 rounded-md border border-gray-200 bg-white px-3 text-[13px] outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-light-600 text-[11px]">
                  {t('pages.lawyerWorkplace.settings.mailboxes.serverSettings.imapPort', 'Port')}
                </Label>
                <input
                  type="number"
                  value={imapPort}
                  min={1}
                  max={65535}
                  onChange={(e) => setImapPort(Number(e.target.value))}
                  className="text-dark-500 focus:border-primary-400 h-10 rounded-md border border-gray-200 bg-white px-3 text-[13px] outline-none"
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={imapUseSsl}
                onChange={(e) => setImapUseSsl(e.target.checked)}
                className="accent-secondary-800 h-4 w-4 rounded border-gray-300"
              />
              <span className="text-dark-500 text-[12px]">
                {t(
                  'pages.lawyerWorkplace.settings.mailboxes.serverSettings.imapSsl',
                  'Use SSL/TLS for IMAP'
                )}
              </span>
            </label>

            {/* SMTP */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label className="text-light-600 text-[11px]">
                  {t(
                    'pages.lawyerWorkplace.settings.mailboxes.serverSettings.smtpHost',
                    'SMTP host'
                  )}
                </Label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.mail.prionex.ua"
                  className="text-dark-500 focus:border-primary-400 h-10 rounded-md border border-gray-200 bg-white px-3 text-[13px] outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-light-600 text-[11px]">
                  {t('pages.lawyerWorkplace.settings.mailboxes.serverSettings.smtpPort', 'Port')}
                </Label>
                <input
                  type="number"
                  value={smtpPort}
                  min={1}
                  max={65535}
                  onChange={(e) => setSmtpPort(Number(e.target.value))}
                  className="text-dark-500 focus:border-primary-400 h-10 rounded-md border border-gray-200 bg-white px-3 text-[13px] outline-none"
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={smtpUseTls}
                onChange={(e) => setSmtpUseTls(e.target.checked)}
                className="accent-secondary-800 h-4 w-4 rounded border-gray-300"
              />
              <span className="text-dark-500 text-[12px]">
                {t(
                  'pages.lawyerWorkplace.settings.mailboxes.serverSettings.smtpTls',
                  'Use STARTTLS for SMTP'
                )}
              </span>
            </label>
          </div>
        ) : null}

        {/* Default letter type */}
        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[13px] font-medium">
            {t(
              'pages.lawyerWorkplace.settings.mailboxes.fields.defaultType',
              'Default letter type'
            )}
          </Label>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-dark-500 flex h-11 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-4 text-[14px]"
              >
                <span className={cn(!selectedDefaultType && 'text-gray-400')}>
                  {selectedDefaultType ? (
                    <LetterTypeBadge letterType={selectedDefaultType} t={t} size="sm" />
                  ) : (
                    t('pages.lawyerWorkplace.settings.mailboxes.autoRoute', 'Auto-route')
                  )}
                </span>
                <Icons.ArrowDown size={16} strokeWidth={1.5} className="text-light-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-60 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto p-1.5"
            >
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => setDefaultLetterTypeId(null)}
              >
                {t('pages.lawyerWorkplace.settings.mailboxes.autoRoute', 'Auto-route')}
              </DropdownMenuItem>
              {letterTypes.map((type) => (
                <DropdownMenuItem
                  key={type.id}
                  className="cursor-pointer"
                  onClick={() => setDefaultLetterTypeId(type.id)}
                >
                  <LetterTypeBadge letterType={type} t={t} size="sm" />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Default outgoing */}
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={isDefaultOutgoing}
            onChange={(e) => setIsDefaultOutgoing(e.target.checked)}
            className="accent-secondary-800 h-4 w-4 rounded border-gray-300"
          />
          <span className="text-dark-500 text-[13px]">
            {t(
              'pages.lawyerWorkplace.settings.mailboxes.fields.defaultOutgoing',
              'Use as default outgoing mailbox in reply composer'
            )}
          </span>
        </label>

        {/* Sync from today — only shown when adding a new mailbox */}
        {!isEditing ? (
          <div className="flex flex-col gap-1.5">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={syncFromToday}
                onChange={(e) => setSyncFromToday(e.target.checked)}
                className="accent-secondary-800 h-4 w-4 rounded border-gray-300"
              />
              <span className="text-dark-500 text-[13px]">
                {t(
                  'pages.lawyerWorkplace.settings.mailboxes.fields.syncFromToday',
                  'Sync from today only (skip historical emails)'
                )}
              </span>
            </label>
            <p className="ml-6 text-[11px] text-gray-400">
              {t(
                'pages.lawyerWorkplace.settings.mailboxes.fields.syncFromTodayHint',
                'Recommended for mailboxes with many existing emails. Only messages arriving after this point will be imported.'
              )}
            </p>
          </div>
        ) : null}

        {/* Routing rules */}
        <div className="space-y-3">
          <div>
            <h3 className="text-dark-500 text-[13px] font-semibold">
              {t('pages.lawyerWorkplace.settings.mailboxes.routing.title', 'Routing rules')}
            </h3>
            <p className="text-light-600 mt-0.5 text-[11px]">
              {t(
                'pages.lawyerWorkplace.settings.mailboxes.routing.hint',
                'Map incoming messages to letter types by sender or subject'
              )}
            </p>
          </div>

          <div className="space-y-2">
            {routingRules.map((rule) => {
              const letterType = letterTypes.find((type) => type.id === rule.letterTypeId)
              const matchLabel = ROUTING_MATCH_OPTIONS.find((item) => item.id === rule.matchType)
              return (
                <div
                  key={rule.id}
                  className="flex flex-wrap items-center gap-2 rounded-md bg-white px-3 py-1.5"
                >
                  <span className="text-light-600 text-[11px] font-medium">
                    {matchLabel ? t(matchLabel.labelKey, matchLabel.fallback) : rule.matchType}
                  </span>
                  {rule.matchType !== 'default' ? (
                    <span className="text-dark-500 text-[12px]">"{rule.value}"</span>
                  ) : null}
                  <Icons.ArrowRight02 size={12} className="text-light-400" strokeWidth={1.5} />
                  {letterType ? <LetterTypeBadge letterType={letterType} t={t} size="sm" /> : null}
                  <button
                    type="button"
                    onClick={() => handleRemoveRule(rule.id)}
                    className="text-light-500 hover:text-dark-500 ml-auto"
                    aria-label={t('actions.remove', 'Remove')}
                  >
                    <Icons.Cancel01 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              )
            })}
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-dashed border-gray-200 p-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[140px] flex-1 space-y-1">
              <Label className="text-light-600 text-[11px]">
                {t('pages.lawyerWorkplace.settings.mailboxes.routing.matchType', 'Match')}
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-dark-500 flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 text-[12px]"
                  >
                    {t(
                      ROUTING_MATCH_OPTIONS.find((item) => item.id === newMatchType)?.labelKey ??
                        '',
                      ROUTING_MATCH_OPTIONS.find((item) => item.id === newMatchType)?.fallback ??
                        newMatchType
                    )}
                    <Icons.ArrowDown size={14} strokeWidth={1.5} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {ROUTING_MATCH_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.id}
                      className="cursor-pointer"
                      onClick={() => setNewMatchType(option.id)}
                    >
                      {t(option.labelKey, option.fallback)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {newMatchType !== 'default' ? (
              <div className="min-w-[140px] flex-1 space-y-1">
                <Label className="text-light-600 text-[11px]">
                  {t('pages.lawyerWorkplace.settings.mailboxes.routing.value', 'Value')}
                </Label>
                <input
                  type="text"
                  value={newMatchValue}
                  onChange={(e) => setNewMatchValue(e.target.value)}
                  placeholder={newMatchType === 'sender_domain' ? 'court.gov.ua' : 'complaint'}
                  className="text-dark-500 h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-[12px] outline-none"
                />
              </div>
            ) : null}
            <div className="min-w-[140px] flex-1 space-y-1">
              <Label className="text-light-600 text-[11px]">
                {t('pages.lawyerWorkplace.settings.mailboxes.routing.letterType', 'Letter type')}
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-dark-500 flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 text-[12px]"
                  >
                    <span className="truncate">
                      {letterTypes.find((type) => type.id === newRuleTypeId)?.nameFallback ??
                        t(
                          'pages.lawyerWorkplace.settings.mailboxes.routing.selectType',
                          'Select type'
                        )}
                    </span>
                    <Icons.ArrowDown size={14} strokeWidth={1.5} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-48 overflow-y-auto">
                  {letterTypes.map((type) => (
                    <DropdownMenuItem
                      key={type.id}
                      className="cursor-pointer"
                      onClick={() => setNewRuleTypeId(type.id)}
                    >
                      <LetterTypeBadge letterType={type} t={t} size="sm" />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button variant="outline" size="sm" className="h-10 rounded-md" onClick={handleAddRule}>
              {t('pages.lawyerWorkplace.settings.mailboxes.routing.addRule', 'Add rule')}
            </Button>
          </div>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="cancel" onClick={onClose} className="h-10 w-full rounded-md">
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          variant="primary"
          disabled={!canSave || isSubmitting}
          onClick={handleSave}
          className="h-10 w-full rounded-md"
        >
          {isEditing ? t('actions.save', 'Save') : t('actions.add', 'Add')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
