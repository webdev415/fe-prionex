import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MdEdit, MdKeyboardArrowDown } from 'react-icons/md'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import {
  buildCredentialsPayload,
  canTestMessagingIntegration,
  credentialFormFromPlaintext,
  emptyCredentialForm,
  formCredentialsComplete,
  getIntegrationCredentialFields,
  getSupportedChannelsForService,
  getMessagingServiceLabel,
  isMessagingProviderImplemented,
  KNOWN_MESSAGING_SERVICES,
  useMessagingIntegrations,
  useRevealMessagingIntegrationCredentials,
  useTestMessagingIntegration,
  useUpdateMessagingIntegration,
} from '@/features/messaging'
import type {
  IntegrationCredentialFieldDef,
  MessagingChannel,
  MessagingIntegration,
} from '@/features/messaging'
import { formatDateTime } from '@/lib/formatters'
import { MessagingIntegrationsPageSkeleton } from './components/MessagingIntegrationsPageSkeleton'

const formatStatusFallback = (status: string) =>
  status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'configured':
      return 'border-success-200 bg-success-50 text-success-700'
    case 'error':
      return 'border-error-200 bg-error-50 text-error-700'
    case 'unconfigured':
    case 'not_configured':
      return 'border-warning-200 bg-warning-50 text-warning-700'
    default:
      return 'border-gray-200 bg-gray-50 text-gray-700'
  }
}

const normaliseChannels = (channels: MessagingChannel[]) => [...channels].sort().join('|')

type IntegrationRow = {
  id: string
  service: string
  label: string
  integration: MessagingIntegration | null
  supported_channels: MessagingChannel[]
  enabled_channels: MessagingChannel[]
  status: string
  last_tested_at: string | null
  credentials_preview: Record<string, unknown>
}

interface IntegrationCardProps {
  row: IntegrationRow
  animationIndex?: number
}

function IntegrationCard({ row, animationIndex = 0 }: IntegrationCardProps) {
  const { t } = useTranslation('common')
  const updateIntegrationMutation = useUpdateMessagingIntegration()
  const testIntegrationMutation = useTestMessagingIntegration()
  const revealCredentialsMutation = useRevealMessagingIntegrationCredentials()

  const [channelsTouched, setChannelsTouched] = useState(false)
  const [enabledChannels, setEnabledChannels] = useState<MessagingChannel[]>(row.enabled_channels)
  const [isEditingCredentials, setIsEditingCredentials] = useState(false)
  const [credentialForm, setCredentialForm] = useState<Record<string, string>>(() =>
    emptyCredentialForm(row.service)
  )
  const [credentialBaseline, setCredentialBaseline] = useState<Record<string, string>>(() =>
    emptyCredentialForm(row.service)
  )
  const [isTesting, setIsTesting] = useState(false)

  const preview = row.credentials_preview ?? {}
  const credentialFields = getIntegrationCredentialFields(row.service)

  // Follow server channel toggles until the user edits locally; then keep
  // draft state so background refetches do not reset an in-progress change.
  const activeEnabledChannels = channelsTouched ? enabledChannels : row.enabled_channels

  const isSaving = updateIntegrationMutation.isPending
  const isRevealing = revealCredentialsMutation.isPending

  const channelsChanged =
    channelsTouched &&
    normaliseChannels(enabledChannels) !== normaliseChannels(row.enabled_channels)
  const credentialsChanged = useMemo(
    () =>
      credentialFields.some(
        (field) => (credentialForm[field.key] ?? '') !== (credentialBaseline[field.key] ?? '')
      ),
    [credentialFields, credentialForm, credentialBaseline]
  )
  const credentialsComplete = formCredentialsComplete(row.service, credentialForm, preview)

  const hasUnsavedChanges =
    channelsChanged ||
    credentialsChanged ||
    (!row.integration && (channelsTouched || credentialsChanged || credentialsComplete))

  const canSave = !isSaving && hasUnsavedChanges
  const showSaveButton = hasUnsavedChanges

  const canTest =
    row.integration &&
    canTestMessagingIntegration(row.service, {
      credentialsPreview: preview,
      formComplete: credentialsComplete,
    })

  const buildPayload = () => buildCredentialsPayload(row.service, credentialForm)

  const closeCredentialEditor = () => {
    const empty = emptyCredentialForm(row.service)
    setIsEditingCredentials(false)
    setCredentialForm(empty)
    setCredentialBaseline(empty)
    revealCredentialsMutation.reset()
  }

  // The collapse is opened only by the edit button (never toggled by the
  // header). Once open, only Save / Cancel can close it again.
  //
  // When opening, fetch the plaintext stored credentials from the reveal
  // endpoint so every input — including secrets like API key / password —
  // is pre-filled with the actual stored value rather than a "***" hint.
  // The reveal is audited server-side; if it fails (e.g. permission denied
  // or no stored value yet) we still open the editor with empty inputs.
  const openCredentialEditor = async () => {
    if (isEditingCredentials || isRevealing) return
    if (!row.integration) {
      const empty = emptyCredentialForm(row.service)
      setCredentialForm(empty)
      setCredentialBaseline(empty)
      setIsEditingCredentials(true)
      return
    }
    try {
      const result = await revealCredentialsMutation.mutateAsync(row.service)
      const hydrated = credentialFormFromPlaintext(row.service, result.credentials ?? {})
      setCredentialForm(hydrated)
      setCredentialBaseline(hydrated)
      setIsEditingCredentials(true)
    } catch {
      // Mutation hook already surfaces the error toast; leave editor closed
      // so the user can retry rather than landing in a confusingly empty form.
    }
  }

  const handleSave = async () => {
    if (!canSave) return

    const wasEditing = isEditingCredentials
    const wasCredentialsChanged = credentialsChanged
    await updateIntegrationMutation.mutateAsync({
      service: row.service,
      payload: {
        enabled_channels: activeEnabledChannels,
        ...(wasCredentialsChanged ? { credentials: buildPayload() } : {}),
      },
    })
    setChannelsTouched(false)
    // Save closes the credentials editor (one of the two allowed close paths).
    if (wasEditing) closeCredentialEditor()
  }

  const handleTest = async () => {
    if (!canTest || !row.integration || isTesting) return

    setIsTesting(true)
    try {
      const wasCredentialsChanged = credentialsChanged && credentialsComplete
      if (wasCredentialsChanged) {
        await updateIntegrationMutation.mutateAsync({
          service: row.service,
          payload: {
            enabled_channels: activeEnabledChannels,
            credentials: buildPayload(),
          },
        })
        setChannelsTouched(false)
        // Saving inside Test counts as a Save click → close the editor.
        closeCredentialEditor()
      }

      await testIntegrationMutation.mutateAsync(row.service)
    } finally {
      setIsTesting(false)
    }
  }

  const updateCredentialField = (key: string, value: string) => {
    setCredentialForm((current) => ({ ...current, [key]: value }))
  }

  const credentialFieldLabel = (field: IntegrationCredentialFieldDef) => {
    const base = t(
      `pages.messagingIntegrations.credentials.${row.service}.${field.key}.label`,
      field.label
    )
    return field.required ? `${base} *` : base
  }

  const credentialFieldPlaceholder = (
    field: IntegrationCredentialFieldDef,
    hasStored: boolean,
    storedHint: string
  ) => {
    if (hasStored) {
      return t('pages.messagingIntegrations.form.storedValuePlaceholder', {
        hint: storedHint,
        defaultValue: `Saved (${storedHint}) — leave blank to keep`,
      })
    }
    if (!field.placeholder) return undefined
    return t(
      `pages.messagingIntegrations.credentials.${row.service}.${field.key}.placeholder`,
      field.placeholder
    )
  }

  return (
    <div
      className="animate-in fade-in-0 slide-in-from-bottom-3 fill-mode-both rounded-2xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur-sm transition-shadow duration-300 ease-out hover:shadow-md motion-reduce:animate-none"
      style={{ animationDelay: `${animationIndex * 80}ms`, animationDuration: '450ms' }}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="text-dark-500 text-lg font-semibold">{row.label}</div>
        </div>
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getStatusBadgeClass(
            row.status
          )}`}
        >
          {t(`pages.messagingIntegrations.status.${row.status}`, formatStatusFallback(row.status))}
        </span>
      </div>

      <div className="bg-light-50/70 mt-4 rounded-2xl border border-gray-200 p-4 transition-colors duration-300 ease-out">
        <div className="text-xs font-medium tracking-wide text-gray-500 uppercase">
          {t('pages.messagingIntegrations.table.channels', 'Channels')}
        </div>
        <div className="mt-3 flex flex-col gap-3">
          {row.supported_channels.map((channel) => {
            const enabled = activeEnabledChannels.includes(channel)
            return (
              <div
                key={channel}
                className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-3 py-2.5"
              >
                <span className="text-dark-500 text-sm font-medium">{channel.toUpperCase()}</span>
                <ToggleSwitch
                  checked={enabled}
                  onChange={(checked) => {
                    setChannelsTouched(true)
                    setEnabledChannels((current) => {
                      const base = channelsTouched ? current : row.enabled_channels
                      return checked
                        ? base.includes(channel)
                          ? base
                          : [...base, channel]
                        : base.filter((item) => item !== channel)
                    })
                  }}
                  disabled={isSaving || isTesting}
                  ariaLabel={t('pages.messagingIntegrations.channelToggleAria', {
                    channel: channel.toUpperCase(),
                    defaultValue: `Enable ${channel.toUpperCase()} channel`,
                  })}
                />
              </div>
            )
          })}
        </div>
        <div className="mt-3 text-xs text-gray-500">
          {t(
            'pages.messagingIntegrations.channelToggleHint',
            'Use these toggles to enable or disable the service channels supported by this provider.'
          )}
        </div>
        {!isMessagingProviderImplemented(row.service) && (
          <p className="text-warning-700 mt-2 text-xs">
            {t(
              'pages.messagingIntegrations.providerNotImplemented',
              'Live API connection is not available for this provider yet. Save credentials for later; Test and messaging are disabled.'
            )}
          </p>
        )}
      </div>

      <div
        className={`bg-light-50/40 mt-4 overflow-hidden rounded-2xl border transition-[border-color,box-shadow] duration-300 ease-out ${
          isEditingCredentials ? 'border-primary-200 shadow-sm' : 'border-gray-200 shadow-none'
        }`}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={openCredentialEditor}
            disabled={isEditingCredentials || isSaving || isTesting || isRevealing}
            aria-expanded={isEditingCredentials}
            aria-controls={`credentials-${row.service}`}
            aria-busy={isRevealing}
            aria-label={t('pages.messagingIntegrations.form.editCredentials', 'Edit credentials')}
            title={t('pages.messagingIntegrations.form.editCredentials', 'Edit credentials')}
            className={`focus-visible:ring-primary-500 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              isEditingCredentials
                ? 'border-primary-500 bg-primary-50 text-primary-600 cursor-default'
                : 'hover:border-primary-500 hover:text-primary-600 border-gray-300 bg-white text-gray-500 disabled:cursor-not-allowed disabled:opacity-60'
            }`}
          >
            {isRevealing ? (
              <span
                className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
            ) : (
              <MdEdit size={14} />
            )}
          </button>
          <span className="text-xs font-medium tracking-wide text-gray-500 uppercase">
            {t('pages.messagingIntegrations.form.credentials', 'Credentials')}
          </span>
          <MdKeyboardArrowDown
            size={20}
            className={`ml-auto text-gray-400 transition-transform duration-300 ease-in-out motion-reduce:transition-none ${
              isEditingCredentials ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </div>
        <div
          id={`credentials-${row.service}`}
          className={`grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none ${
            isEditingCredentials ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
          aria-hidden={!isEditingCredentials}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className={`space-y-3 border-t border-gray-200 px-4 py-4 transition-opacity duration-300 ease-in-out motion-reduce:transition-none ${
                isEditingCredentials ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {credentialFields.map((field) => {
                const storedHint = preview[field.key]
                const hasStored =
                  typeof storedHint === 'string' &&
                  storedHint.length > 0 &&
                  storedHint.startsWith('***')
                return (
                  <Input
                    key={field.key}
                    label={credentialFieldLabel(field)}
                    type={field.type ?? 'text'}
                    value={credentialForm[field.key] ?? ''}
                    onChange={(event) => updateCredentialField(field.key, event.target.value)}
                    placeholder={credentialFieldPlaceholder(field, hasStored, String(storedHint))}
                    disabled={isSaving || isTesting}
                    autoComplete="off"
                    required={field.required}
                    aria-required={field.required}
                  />
                )
              })}
              <p className="text-xs text-gray-500">
                {t(
                  'pages.messagingIntegrations.form.staticConfigHint',
                  'API URL and callback URL are configured by your administrator in the server environment, not here.'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4 border-t border-gray-200 pt-4 transition-opacity duration-300 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-medium tracking-wide text-gray-500 uppercase">
            {t('pages.messagingIntegrations.table.lastTested', 'Last tested')}
          </div>
          <div className="text-dark-500 mt-1 text-sm">
            {formatDateTime(row.last_tested_at ?? undefined)}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {row.integration && (
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={handleTest}
              disabled={!canTest || isTesting || isSaving}
              isLoading={isTesting}
              className="rounded-md"
              title={
                !canTest
                  ? t(
                      'pages.messagingIntegrations.testDisabledHint',
                      'Enter and save complete credentials for a supported provider before testing.'
                    )
                  : undefined
              }
            >
              {t('pages.messagingIntegrations.actions.test', 'Test')}
            </Button>
          )}
          {isEditingCredentials && (
            <Button
              type="button"
              variant="cancel"
              className="rounded-md"
              size="xs"
              onClick={closeCredentialEditor}
              disabled={isSaving || isTesting}
            >
              {t('actions.cancel', 'Cancel')}
            </Button>
          )}
          {showSaveButton && (
            <Button
              type="button"
              variant="primary"
              size="xs"
              className="rounded-md"
              onClick={handleSave}
              disabled={!canSave}
              isLoading={isSaving}
            >
              {row.integration
                ? t('actions.save', 'Save')
                : t('pages.messagingIntegrations.actions.configure', 'Configure')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export function MessagingIntegrationsPage() {
  const { t } = useTranslation('common')
  const { data: integrations = [], isLoading } = useMessagingIntegrations()

  const integrationRows = useMemo<IntegrationRow[]>(
    () =>
      KNOWN_MESSAGING_SERVICES.map((service) => {
        const integration = integrations.find((item) => item.service === service) ?? null
        return {
          id: service,
          service,
          label: t(
            `pages.messagingIntegrations.services.${service}`,
            getMessagingServiceLabel(service)
          ),
          integration,
          supported_channels: getSupportedChannelsForService(service),
          enabled_channels: integration?.enabled_channels ?? [],
          status: integration?.status ?? 'not_configured',
          last_tested_at: integration?.last_tested_at ?? null,
          credentials_preview: integration?.credentials_preview ?? {},
        }
      }),
    [integrations, t]
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div>
          <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
            {t('navigation.messagingIntegrations', 'Messaging Integrations')}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t(
              'pages.messagingIntegrations.description',
              'Configure provider credentials, enable channels per service, and verify connection health.'
            )}
          </p>
        </div>
      </div>

      {isLoading ? (
        <MessagingIntegrationsPageSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {integrationRows.map((row, index) => (
            <IntegrationCard key={row.id} row={row} animationIndex={index} />
          ))}
        </div>
      )}
    </div>
  )
}

export default MessagingIntegrationsPage
