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
import { TbInfoTriangle, TbTrash, TbEdit, TbCheck, TbX } from 'react-icons/tb'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'

import {
  ipWhitelistFormSchema,
  type IpWhitelistFormData,
  useIpWhitelist,
  useCreateIpWhitelistEntry,
  useDeleteIpWhitelistEntry,
  useUpdateIpWhitelistEntry,
  type IpWhitelistEntry,
} from '@/features/ipWhitelist'
import {
  useIpWhitelistSettings,
  useUpdateIpWhitelistSettings,
} from '@/features/users/hooks/useIpWhitelistSettings'
import { CallQaSettingsSection } from '@/features/quality'

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
}

function EntryRow({ entry }: EntryRowProps) {
  const { t } = useTranslation('common')
  const updateMutation = useUpdateIpWhitelistEntry()
  const deleteMutation = useDeleteIpWhitelistEntry()

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

  const handleDelete = async () => {
    if (!window.confirm(t('pages.ipWhitelist.confirmDelete', { ip: entry.ip_address }))) {
      return
    }
    try {
      await deleteMutation.mutateAsync(entry.id)
      toast.success(t('pages.ipWhitelist.toastDeleted'))
    } catch (err) {
      toast.error(extractApiError(err, t('pages.ipWhitelist.errorDelete')))
    }
  }

  if (editing) {
    return (
      <tr className="border-b border-gray-100">
        <td className="px-3 py-2">
          <Input
            value={ipValue}
            onChange={(e) => setIpValue(e.target.value)}
            placeholder="203.0.113.5"
          />
        </td>
        <td className="px-3 py-2">
          <Input
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
            placeholder={t('pages.ipWhitelist.labelPlaceholder')}
          />
        </td>
        <td className="px-3 py-2 text-xs text-gray-500">
          {new Date(entry.updated_at).toLocaleString()}
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('pages.ipWhitelist.saveAria')}
              disabled={updateMutation.isPending}
              onClick={handleSave}
            >
              <TbCheck className="text-success-500 h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('pages.ipWhitelist.cancelAria')}
              onClick={handleCancel}
            >
              <TbX className="h-4 w-4 text-gray-500" />
            </Button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-gray-100">
      <td className="text-dark-500 px-3 py-2 font-mono text-sm">{entry.ip_address}</td>
      <td className="px-3 py-2 text-sm text-gray-700">{entry.label || '—'}</td>
      <td className="px-3 py-2 text-xs text-gray-500">
        {new Date(entry.updated_at).toLocaleString()}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('pages.ipWhitelist.editAria', { ip: entry.ip_address })}
            onClick={handleStartEdit}
          >
            <TbEdit className="h-4 w-4 text-gray-600" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('pages.ipWhitelist.deleteAria', { ip: entry.ip_address })}
            disabled={deleteMutation.isPending}
            onClick={handleDelete}
          >
            <TbTrash className="text-error-500 h-4 w-4" />
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
      <div className="space-y-4">
        {/* Page header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
            {t('pages.ipWhitelist.title')}
          </h1>
          <p className="text-sm text-gray-500">{t('pages.ipWhitelist.helper')}</p>
        </div>

        {/* Global enforcement gate */}
        <div className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            {enforcementEnabled ? null : (
              <TbInfoTriangle className="text-warning-500 mt-0.5 h-4 w-4 flex-shrink-0" />
            )}
            <div>
              <div className="text-dark-500 text-sm font-medium">
                {t('pages.ipWhitelist.gateTitle')}
              </div>
              <div className="text-xs text-gray-500">
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

        {/* Global Call QA (AI call analysis) switch — the second system-wide
            admin toggle, guarded by manage_call_qa on its own. */}
        <CallQaSettingsSection />

        {/* Add new entry */}
        <form
          onSubmit={onAdd}
          className="grid grid-cols-1 gap-3 rounded-md border border-gray-200 bg-white p-3 sm:grid-cols-[1fr_1fr_auto]"
        >
          <div>
            <Label htmlFor="new-ip" className="text-xs">
              {t('pages.ipWhitelist.ipLabel')}
            </Label>
            <Input
              id="new-ip"
              placeholder="203.0.113.5"
              {...register('ip_address')}
              aria-invalid={!!errors.ip_address}
              variant={errors.ip_address ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.ip_address && (
              <p className="mt-1 text-xs text-red-500">{errors.ip_address.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="new-label" className="text-xs">
              {t('pages.ipWhitelist.labelHeading')}
            </Label>
            <Input
              id="new-label"
              placeholder={t('pages.ipWhitelist.labelPlaceholder')}
              {...register('label')}
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting || createMutation.isPending}
            >
              {t('pages.ipWhitelist.addButton')}
            </Button>
          </div>
        </form>

        {/* Entries table */}
        <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2">{t('pages.ipWhitelist.colIp')}</th>
                <th className="px-3 py-2">{t('pages.ipWhitelist.colLabel')}</th>
                <th className="px-3 py-2">{t('pages.ipWhitelist.colUpdated')}</th>
                <th className="w-32 px-3 py-2">{t('pages.ipWhitelist.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="px-3 py-3 text-sm text-gray-500" colSpan={4}>
                    {t('pages.ipWhitelist.loading')}
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td className="text-error-500 px-3 py-3 text-sm" colSpan={4}>
                    {t('pages.ipWhitelist.errorLoading')}
                  </td>
                </tr>
              )}
              {!isLoading && !isError && entries.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-sm text-gray-500" colSpan={4}>
                    {t('pages.ipWhitelist.emptyState')}
                  </td>
                </tr>
              )}
              {entries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PermissionGuard>
  )
}
