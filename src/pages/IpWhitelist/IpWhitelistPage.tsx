/**
 * IP Whitelist Management Page
 *
 * Global allowlist of source IPs for login. When the enforcement
 * toggle is ON, every login must come from an IP listed here.
 * Per the agreed scope this is NOT per-user.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

import {
  ipWhitelistFormSchema,
  type IpWhitelistFormData,
  useIpWhitelist,
  useCreateIpWhitelistEntry,
  useUpdateIpWhitelistEntry,
  type IpWhitelistEntry,
} from '@/features/ipWhitelist'
import {
  useIpWhitelistSettings,
  useUpdateIpWhitelistSettings,
} from '@/features/users/hooks/useIpWhitelistSettings'
import { DeleteIpWhitelistEntryModal } from './DeleteIpWhitelistEntryModal'

function extractApiError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { detail?: unknown } } }
  const detail = e?.response?.data?.detail
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (typeof detail === 'object' && detail !== null) {
    const obj = detail as { message?: string; code?: string }
    if (obj.message) return obj.message
    if (obj.code) return obj.code
  }
  return fallback
}

interface EntryRowProps {
  entry: IpWhitelistEntry
  onRequestDelete: (entry: IpWhitelistEntry) => void
}

function EntryRow({ entry, onRequestDelete }: EntryRowProps) {
  const { t } = useTranslation('common')
  const updateMutation = useUpdateIpWhitelistEntry()

  const [editing, setEditing] = useState(false)
  const [ipValue, setIpValue] = useState(entry.ip_address)
  const [labelValue, setLabelValue] = useState(entry.label ?? '')

  const handleStartEdit = () => {
    // Re-seed from latest entry props so we always edit current values.
    setIpValue(entry.ip_address)
    setLabelValue(entry.label ?? '')
    setEditing(true)
  }

  const handleCancel = () => {
    setIpValue(entry.ip_address)
    setLabelValue(entry.label ?? '')
    setEditing(false)
  }

  const handleSave = async () => {
    const parsed = ipWhitelistFormSchema.safeParse({
      ip_address: ipValue,
      label: labelValue || '',
    })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }
    try {
      await updateMutation.mutateAsync({
        id: entry.id,
        input: {
          ip_address: parsed.data.ip_address,
          label: parsed.data.label || null,
        },
      })
      toast.success(t('pages.ipWhitelist.toastUpdated'))
      setEditing(false)
    } catch (err) {
      toast.error(extractApiError(err, t('pages.ipWhitelist.errorUpdate')))
    }
  }

  if (editing) {
    return (
      <tr className="border-border border-b">
        <td className="px-4 py-3">
          <Input
            value={ipValue}
            onChange={(e) => setIpValue(e.target.value)}
            placeholder="203.0.113.5"
          />
        </td>
        <td className="px-4 py-3">
          <Input
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
            placeholder={t('pages.ipWhitelist.labelPlaceholder')}
          />
        </td>
        <td className="text-muted-foreground px-4 py-3 text-xs">
          {new Date(entry.updated_at).toLocaleString()}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('pages.ipWhitelist.saveAria')}
              disabled={updateMutation.isPending}
              onClick={handleSave}
              className="text-success-600 hover:bg-success-100"
            >
              <Icons.Tick01 size={16} strokeWidth={2} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('pages.ipWhitelist.cancelAria')}
              onClick={handleCancel}
              className="text-muted-foreground hover:bg-muted"
            >
              <Icons.Cancel01 size={16} strokeWidth={2} />
            </Button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-border hover:bg-muted/40 border-b transition-colors">
      <td className="text-foreground px-4 py-3 font-mono text-sm">{entry.ip_address}</td>
      <td className="text-foreground px-4 py-3 text-sm">{entry.label || '—'}</td>
      <td className="text-muted-foreground px-4 py-3 text-xs">
        {new Date(entry.updated_at).toLocaleString()}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('pages.ipWhitelist.editAria', { ip: entry.ip_address })}
            onClick={handleStartEdit}
            className="text-foreground hover:bg-muted"
          >
            <Icons.PencilEdit size={16} strokeWidth={1.5} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('pages.ipWhitelist.deleteAria', { ip: entry.ip_address })}
            onClick={() => onRequestDelete(entry)}
            className="text-error-600 hover:bg-error-100"
          >
            <Icons.Delete size={16} strokeWidth={1.5} />
          </Button>
        </div>
      </td>
    </tr>
  )
}

export function IpWhitelistPage() {
  const { t } = useTranslation('common')

  const { data, isLoading, isError } = useIpWhitelist()
  const { data: settings } = useIpWhitelistSettings()
  const createMutation = useCreateIpWhitelistEntry()
  const settingsMutation = useUpdateIpWhitelistSettings()
  const [deletingEntry, setDeletingEntry] = useState<IpWhitelistEntry | null>(null)

  const enforcementEnabled = !!settings?.enabled
  const entries = data?.entries ?? []

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IpWhitelistFormData>({
    resolver: zodResolver(ipWhitelistFormSchema),
    defaultValues: { ip_address: '', label: '' },
  })

  const onAdd = handleSubmit(async (formData) => {
    try {
      await createMutation.mutateAsync({
        ip_address: formData.ip_address,
        label: formData.label || undefined,
      })
      toast.success(t('pages.ipWhitelist.toastAdded'))
      reset({ ip_address: '', label: '' })
    } catch (err) {
      toast.error(extractApiError(err, t('pages.ipWhitelist.errorAdd')))
    }
  })

  const handleToggle = async (next: boolean) => {
    try {
      await settingsMutation.mutateAsync({ enabled: next })
      toast.success(
        next ? t('pages.ipWhitelist.gateToastEnabled') : t('pages.ipWhitelist.gateToastDisabled')
      )
    } catch {
      toast.error(t('pages.ipWhitelist.gateToastError'))
    }
  }

  return (
    <PermissionGuard permission={PERMISSIONS.USERS.EDIT}>
      <div className="flex w-full flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-foreground text-xl font-light sm:text-2xl">
            {t('pages.ipWhitelist.title')}
          </h1>
          <p className="text-muted-foreground text-sm font-light">
            {t('pages.ipWhitelist.helper')}
          </p>
        </div>

        {/* Global enforcement gate */}
        <div
          className={cn(
            'border-border bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between',
            !enforcementEnabled && 'border-warning-200 bg-warning-100/40'
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            {!enforcementEnabled ? (
              <div className="bg-warning-100 text-warning-700 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                <Icons.Warning size={16} strokeWidth={2} />
              </div>
            ) : (
              <div className="bg-success-100 text-success-700 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                <Icons.Tick01 size={16} strokeWidth={2} />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-foreground text-sm font-medium">
                {t('pages.ipWhitelist.gateTitle')}
              </div>
              <div className="text-muted-foreground mt-0.5 text-xs">
                {enforcementEnabled
                  ? t('pages.ipWhitelist.gateDescriptionEnabled')
                  : t('pages.ipWhitelist.gateDescriptionDisabled')}
              </div>
            </div>
          </div>
          <ToggleSwitch
            checked={enforcementEnabled}
            onChange={handleToggle}
            disabled={settingsMutation.isPending}
            ariaLabel={t('pages.ipWhitelist.gateToggleAria')}
          />
        </div>

        {/* Add new entry */}
        <form
          onSubmit={onAdd}
          className="border-border bg-card grid grid-cols-1 gap-3 rounded-xl border p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto]"
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-ip" className="text-muted-foreground text-xs font-medium">
              {t('pages.ipWhitelist.ipLabel')}
            </Label>
            <Input
              id="new-ip"
              placeholder="203.0.113.5"
              {...register('ip_address')}
              aria-invalid={!!errors.ip_address}
              variant={errors.ip_address ? 'error' : 'default'}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="new-label" className="text-muted-foreground text-xs font-medium">
              {t('pages.ipWhitelist.labelHeading')}
            </Label>
            <Input
              id="new-label"
              placeholder={t('pages.ipWhitelist.labelPlaceholder')}
              {...register('label')}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting || createMutation.isPending}
              className="h-[45px] w-full sm:w-auto"
            >
              <Icons.Add size={16} strokeWidth={2} className="mr-1" />
              {t('pages.ipWhitelist.addButton')}
            </Button>
          </div>
        </form>

        {/* Entries table */}
        <div className="border-border bg-card overflow-x-auto rounded-xl border shadow-sm">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-border bg-muted border-b">
                <th className="text-muted-foreground px-4 py-3 text-xs font-semibold tracking-wide uppercase">
                  {t('pages.ipWhitelist.colIp')}
                </th>
                <th className="text-muted-foreground px-4 py-3 text-xs font-semibold tracking-wide uppercase">
                  {t('pages.ipWhitelist.colLabel')}
                </th>
                <th className="text-muted-foreground px-4 py-3 text-xs font-semibold tracking-wide uppercase">
                  {t('pages.ipWhitelist.colUpdated')}
                </th>
                <th className="text-muted-foreground w-28 px-4 py-3 text-right text-xs font-semibold tracking-wide uppercase">
                  {t('pages.ipWhitelist.colActions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="text-muted-foreground px-4 py-6 text-sm" colSpan={4}>
                    {t('pages.ipWhitelist.loading')}
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td className="text-error-700 px-4 py-6 text-sm" colSpan={4}>
                    {t('pages.ipWhitelist.errorLoading')}
                  </td>
                </tr>
              )}
              {!isLoading && !isError && entries.length === 0 && (
                <tr>
                  <td className="text-muted-foreground px-4 py-6 text-center text-sm" colSpan={4}>
                    {t('pages.ipWhitelist.emptyState')}
                  </td>
                </tr>
              )}
              {entries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} onRequestDelete={setDeletingEntry} />
              ))}
            </tbody>
          </table>
        </div>

        <DeleteIpWhitelistEntryModal
          open={!!deletingEntry}
          entry={deletingEntry}
          onClose={() => setDeletingEntry(null)}
        />
      </div>
    </PermissionGuard>
  )
}
