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
import type {
  LetterTypeConfig,
  MailboxProvider,
  MailboxRoutingRule,
  SettingsMailbox,
} from '../../../settings/types'

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
  routingRules: MailboxRoutingRule[]
  /** Only meaningful on create. When true, the backend will set last_imap_uid
   *  to the current max so only future emails are ingested. */
  syncFromToday: boolean
}

interface ProviderPreset {
  id: MailboxProvider
  label: string
  /** i18n key for non-brand labels (e.g. "Custom / Self-hosted"); brands keep raw label. */
  labelKey?: string
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
    id: 'custom',
    label: 'Custom / Self-hosted',
    labelKey: 'pages.lawyerWorkplace.settings.mailboxes.customProvider',
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
  { domains: ['gmail.com', 'googlemail.com'], provider: 'google_workspace' },
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

function extractEmailDomain(emailValue: string): string | null {
  const atIdx = emailValue.indexOf('@')
  if (atIdx === -1) return null
  const domain = emailValue
    .slice(atIdx + 1)
    .toLowerCase()
    .trim()
  return domain || null
}

function detectProviderFromEmail(emailValue: string): MailboxProvider | null {
  const domain = extractEmailDomain(emailValue)
  if (!domain) return null
  for (const entry of DOMAIN_PROVIDER_MAP) {
    if (entry.domains.includes(domain)) return entry.provider
  }
  return null
}

function getAcceptableProviderIds(emailValue: string): MailboxProvider[] {
  const domain = extractEmailDomain(emailValue)
  if (!domain) {
    return PROVIDER_PRESETS.map((preset) => preset.id)
  }
  const detected = detectProviderFromEmail(emailValue)
  if (detected) {
    return [detected, 'custom']
  }
  // Unknown domains might still run on Google/Microsoft hosted infra.
  // Allow explicit provider choice instead of forcing custom server settings.
  return PROVIDER_PRESETS.map((preset) => preset.id)
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
  onTestConnection: (values: MailboxFormValues) => void | Promise<void>
  requireConnectionTest?: boolean
  isTestingConnection?: boolean
  isSubmitting?: boolean
}

export function MailboxModal({
  open,
  mailbox,
  letterTypes: _letterTypes,
  existingEmails,
  onClose,
  onSave,
  onTestConnection,
  requireConnectionTest = false,
  isTestingConnection = false,
  isSubmitting = false,
}: MailboxModalProps) {
  const { t } = useTranslation('common')
  const providerLabel = (preset: ProviderPreset) =>
    preset.labelKey ? t(preset.labelKey, preset.label) : preset.label
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
  const [syncFromToday, setSyncFromToday] = useState(true)
  const [connectionTestPassed, setConnectionTestPassed] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const resetConnectionTest = () => {
    setConnectionTestPassed(false)
    setConnectionError(null)
  }

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      const initial = getInitialValues(mailbox)
      const acceptable = getAcceptableProviderIds(initial.email)
      const initialProvider = acceptable.includes(initial.provider)
        ? initial.provider
        : (detectProviderFromEmail(initial.email) ?? 'custom')
      const preset = PROVIDER_PRESETS.find((p) => p.id === initialProvider)
      setEmail(initial.email)
      setDisplayName(initial.displayName)
      setProvider(initialProvider)
      setPassword('')
      setShowPassword(false)
      setImapHost(preset?.imapHost ?? initial.imapHost)
      setImapPort(preset?.imapPort ?? initial.imapPort)
      setImapUseSsl(preset?.imapUseSsl ?? initial.imapUseSsl)
      setSmtpHost(preset?.smtpHost ?? initial.smtpHost)
      setSmtpPort(preset?.smtpPort ?? initial.smtpPort)
      setSmtpUseTls(preset?.smtpUseTls ?? initial.smtpUseTls)
      setSyncFromToday(initial.syncFromToday)
      setConnectionTestPassed(false)
      setConnectionError(null)
    })
  }, [open, mailbox])

  const handleProviderChange = (next: MailboxProvider) => {
    setProvider(next)
    resetConnectionTest()
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

  const acceptableProviderIds = useMemo(() => getAcceptableProviderIds(email), [email])

  const availableProviderPresets = useMemo(
    () => PROVIDER_PRESETS.filter((preset) => acceptableProviderIds.includes(preset.id)),
    [acceptableProviderIds]
  )

  const handleEmailChange = (value: string) => {
    setEmail(value)
    resetConnectionTest()
    const acceptable = getAcceptableProviderIds(value)
    if (!acceptable.includes(provider)) {
      const detected = detectProviderFromEmail(value)
      handleProviderChange(detected ?? 'custom')
      return
    }
    if (!isEditing) {
      const detected = detectProviderFromEmail(value)
      if (detected && detected !== provider) {
        handleProviderChange(detected)
      }
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

  const isCustom = provider === 'custom'

  // Password is required when adding, or when editing a mailbox without credentials.
  // Optional when editing a mailbox that already has credentials (blank = keep existing).
  const hasExistingCredentials = isEditing && (mailbox?.hasCredentials ?? false)
  const passwordValid = hasExistingCredentials ? true : password.trim().length > 0

  const customHostsValid = !isCustom || (imapHost.trim().length > 0 && smtpHost.trim().length > 0)

  const canSave =
    email.trim().length > 0 &&
    displayName.trim().length > 0 &&
    !duplicateEmail &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    passwordValid &&
    customHostsValid
  const canTestConnection = canSave

  const handleSave = () => {
    if (!canSave || isSubmitting) return
    if (requireConnectionTest && !connectionTestPassed) return
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
      defaultLetterTypeId: null,
      // Letter type auto-assignment uses letter-type keyword hints, not mailbox routing.
      routingRules: [],
      syncFromToday,
    })
  }

  const handleTestConnection = async () => {
    if (!canTestConnection || isTestingConnection || isSubmitting) return
    setConnectionError(null)
    try {
      await onTestConnection({
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
        defaultLetterTypeId: null,
        routingRules: [],
        syncFromToday,
      })
      setConnectionTestPassed(true)
      setConnectionError(null)
    } catch (error) {
      setConnectionTestPassed(false)
      setConnectionError(error instanceof Error ? error.message : null)
    }
  }

  const selectedProviderPreset = PROVIDER_PRESETS.find((p) => p.id === provider)
  const selectedProviderLabel = selectedProviderPreset
    ? providerLabel(selectedProviderPreset)
    : provider

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-10 w-10 items-center justify-center rounded-full">
            <Icons.Mail size={20} strokeWidth={1.5} className="text-foreground" />
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
            <Label className="text-foreground text-[13px] font-medium">
              {t('pages.lawyerWorkplace.settings.mailboxes.fields.email', 'Email address')}
            </Label>
            <input
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder="legal@prionex.ua"
              className="text-foreground focus:border-primary-400 border-border bg-input h-11 rounded-md border px-4 text-[14px] outline-none"
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
            <Label className="text-foreground text-[13px] font-medium">
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
              className="text-foreground focus:border-primary-400 border-border bg-input h-11 rounded-md border px-4 text-[14px] outline-none"
            />
          </div>
        </div>

        {/* Provider selector */}
        <div className="flex flex-col gap-2">
          <Label className="text-foreground text-[13px] font-medium">
            {t('pages.lawyerWorkplace.settings.mailboxes.fields.provider', 'Mail provider')}
          </Label>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-foreground border-border bg-input flex h-11 w-full items-center justify-between rounded-md border px-4 text-[14px]"
              >
                <span>{selectedProviderLabel}</span>
                <Icons.ArrowDown size={16} strokeWidth={1.5} className="text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="min-w-[var(--radix-dropdown-menu-trigger-width)] p-1.5"
            >
              {availableProviderPresets.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  className="cursor-pointer"
                  onClick={() => handleProviderChange(preset.id)}
                >
                  {providerLabel(preset)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-foreground text-[13px] font-medium">
            {t('pages.lawyerWorkplace.settings.mailboxes.fields.password', 'App password')}
          </Label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                resetConnectionTest()
              }}
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
              className="text-foreground focus:border-primary-400 border-border bg-input h-11 w-full rounded-md border px-4 pr-12 text-[14px] outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-muted-foreground hover:text-foreground absolute top-0 right-0 flex h-11 w-11 items-center justify-center"
              tabIndex={-1}
              aria-label={
                showPassword
                  ? t('pages.lawyerWorkplace.settings.mailboxes.hidePassword', 'Hide password')
                  : t('pages.lawyerWorkplace.settings.mailboxes.showPassword', 'Show password')
              }
            >
              <Icons.View size={16} strokeWidth={showPassword ? 1.5 : 2.5} />
            </button>
          </div>
          <p className="text-muted-foreground text-[11px]">
            {t(
              'pages.lawyerWorkplace.settings.mailboxes.fields.passwordHint',
              'Use an app-specific password generated in your mail account security settings, not your main login password.'
            )}
          </p>
          {connectionError ? (
            <p className="text-error-600 text-[12px]" role="alert">
              {connectionError}
            </p>
          ) : null}
        </div>

        {/* Custom provider server settings */}
        {isCustom ? (
          <div className="border-border bg-muted space-y-4 rounded-md border p-4">
            <p className="text-foreground text-[12px] font-semibold">
              {t(
                'pages.lawyerWorkplace.settings.mailboxes.serverSettings.title',
                'Server settings'
              )}
            </p>

            {/* IMAP */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label className="text-muted-foreground text-[11px]">
                  {t(
                    'pages.lawyerWorkplace.settings.mailboxes.serverSettings.imapHost',
                    'IMAP host'
                  )}
                </Label>
                <input
                  type="text"
                  value={imapHost}
                  onChange={(e) => {
                    setImapHost(e.target.value)
                    resetConnectionTest()
                  }}
                  placeholder="imap.mail.prionex.ua"
                  className="text-foreground focus:border-primary-400 border-border bg-input h-10 rounded-md border px-3 text-[13px] outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-muted-foreground text-[11px]">
                  {t('pages.lawyerWorkplace.settings.mailboxes.serverSettings.imapPort', 'Port')}
                </Label>
                <input
                  type="number"
                  value={imapPort}
                  min={1}
                  max={65535}
                  onChange={(e) => {
                    setImapPort(Number(e.target.value))
                    resetConnectionTest()
                  }}
                  className="text-foreground focus:border-primary-400 border-border bg-input h-10 rounded-md border px-3 text-[13px] outline-none"
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={imapUseSsl}
                onChange={(e) => {
                  setImapUseSsl(e.target.checked)
                  resetConnectionTest()
                }}
                className="accent-secondary-800 border-border h-4 w-4 rounded"
              />
              <span className="text-foreground text-[12px]">
                {t(
                  'pages.lawyerWorkplace.settings.mailboxes.serverSettings.imapSsl',
                  'Use SSL/TLS for IMAP'
                )}
              </span>
            </label>

            {/* SMTP */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label className="text-muted-foreground text-[11px]">
                  {t(
                    'pages.lawyerWorkplace.settings.mailboxes.serverSettings.smtpHost',
                    'SMTP host'
                  )}
                </Label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => {
                    setSmtpHost(e.target.value)
                    resetConnectionTest()
                  }}
                  placeholder="smtp.mail.prionex.ua"
                  className="text-foreground focus:border-primary-400 border-border bg-input h-10 rounded-md border px-3 text-[13px] outline-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-muted-foreground text-[11px]">
                  {t('pages.lawyerWorkplace.settings.mailboxes.serverSettings.smtpPort', 'Port')}
                </Label>
                <input
                  type="number"
                  value={smtpPort}
                  min={1}
                  max={65535}
                  onChange={(e) => {
                    setSmtpPort(Number(e.target.value))
                    resetConnectionTest()
                  }}
                  className="text-foreground focus:border-primary-400 border-border bg-input h-10 rounded-md border px-3 text-[13px] outline-none"
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={smtpUseTls}
                onChange={(e) => {
                  setSmtpUseTls(e.target.checked)
                  resetConnectionTest()
                }}
                className="accent-secondary-800 border-border h-4 w-4 rounded"
              />
              <span className="text-foreground text-[12px]">
                {t(
                  'pages.lawyerWorkplace.settings.mailboxes.serverSettings.smtpTls',
                  'Use STARTTLS for SMTP'
                )}
              </span>
            </label>
          </div>
        ) : null}

        {/* Sync from today — only shown when adding a new mailbox */}
        {!isEditing ? (
          <div className="flex flex-col gap-1.5">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={syncFromToday}
                onChange={(e) => setSyncFromToday(e.target.checked)}
                className="accent-secondary-800 border-border h-4 w-4 rounded"
              />
              <span className="text-foreground text-[13px]">
                {t(
                  'pages.lawyerWorkplace.settings.mailboxes.fields.syncFromToday',
                  'Sync from today only (skip historical emails)'
                )}
              </span>
            </label>
            <p className="text-muted-foreground ml-6 text-[11px]">
              {t(
                'pages.lawyerWorkplace.settings.mailboxes.fields.syncFromTodayHint',
                'Recommended for mailboxes with many existing emails. Only messages arriving after this point will be imported.'
              )}
            </p>
          </div>
        ) : null}
      </ModalContent>
      <ModalFooter>
        <Button variant="cancel" onClick={onClose} className="h-10 w-full rounded-md">
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          variant="outline"
          disabled={!canTestConnection || isTestingConnection || isSubmitting}
          onClick={() => void handleTestConnection()}
          className="h-10 w-full rounded-md"
        >
          {isTestingConnection
            ? t('pages.lawyerWorkplace.settings.mailboxes.testConnectionRunning', 'Testing…')
            : t('pages.lawyerWorkplace.settings.mailboxes.testConnection', 'Test connection')}
        </Button>
        <Button
          variant="primary"
          disabled={!canSave || isSubmitting || (requireConnectionTest && !connectionTestPassed)}
          onClick={handleSave}
          className="h-10 w-full rounded-md"
        >
          {isEditing ? t('actions.save', 'Save') : t('actions.add', 'Add')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
