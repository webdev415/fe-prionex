import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
import { formatDateTime } from '@/lib/localeFormat'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import {
  useAutoFlagRules,
  useBulkDismissFlags,
  useConfirmFlag,
  useConvertFlagToTask,
  useDismissFlag,
  useFlags,
} from '@/features/training'
import type { AutoFlagRule, FlagEventCard, FlagEventStatus } from '@/features/training'
import { Pii } from '@/lib/openreplay/pii'

const STATUS_TABS: { id: FlagEventStatus; key: string; fallback: string }[] = [
  { id: 'pending', key: 'pages.training.autoFlags.status.pending', fallback: 'Pending' },
  { id: 'confirmed', key: 'pages.training.autoFlags.status.confirmed', fallback: 'Confirmed' },
  { id: 'dismissed', key: 'pages.training.autoFlags.status.dismissed', fallback: 'Dismissed' },
]

const PAGE_SIZE = 50

/**
 * Auto-flag trainer review queue (KAN-411 Feature 3.3).
 *
 * Filters: status, rule. Bulk-dismiss collapses every pending flag for
 * one rule into a single trainer action; the per-row reason is stamped
 * `bulk:{rule}:{window}` so the audit trail stays granular even with the
 * single summary action.
 */
export function AutoFlagsSubTab() {
  const { t } = useTranslation('common')
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)
  const nameByOp = useMemo(() => {
    const out = new Map<number, string>()
    operators.forEach((o) => out.set(Number(o.id), o.full_name || `#${o.id}`))
    return out
  }, [operators])

  const [status, setStatus] = useState<FlagEventStatus>('pending')
  const [ruleCode, setRuleCode] = useState<string | undefined>(undefined)

  const filters = useMemo(
    () => ({
      status,
      rule_code: ruleCode,
      limit: PAGE_SIZE,
      offset: 0,
    }),
    [status, ruleCode]
  )

  const { data, isLoading, isError } = useFlags(filters)
  const { data: rules = [] } = useAutoFlagRules()
  const ruleByCode = useMemo(() => {
    const out = new Map<string, AutoFlagRule>()
    rules.forEach((r) => out.set(r.code, r))
    return out
  }, [rules])

  const confirmMut = useConfirmFlag()
  const dismissMut = useDismissFlag()
  const bulkDismissMut = useBulkDismissFlags()
  const convertMut = useConvertFlagToTask()

  const handleConfirm = async (flagId: number) => {
    try {
      await confirmMut.mutateAsync(flagId)
      toast.success(t('pages.training.autoFlags.toast.confirmed', 'Flag confirmed'))
    } catch (err) {
      toast.error(extractError(err, t('pages.training.autoFlags.toast.error', 'Action failed')))
    }
  }
  const handleDismiss = async (flagId: number) => {
    const reason = window.prompt(
      t('pages.training.autoFlags.dismissPrompt', 'Why dismiss this flag? (Optional)') ??
        'Reason (optional)'
    )
    try {
      await dismissMut.mutateAsync({
        flagId,
        payload: { reason: reason?.trim() || undefined },
      })
      toast.success(t('pages.training.autoFlags.toast.dismissed', 'Flag dismissed'))
    } catch (err) {
      toast.error(extractError(err, t('pages.training.autoFlags.toast.error', 'Action failed')))
    }
  }
  const handleConvert = async (flagId: number) => {
    try {
      const result = await convertMut.mutateAsync({ flagId, payload: {} })
      toast.success(
        t('pages.training.autoFlags.toast.converted', 'Correction task created and flag confirmed')
      )
      return result
    } catch (err) {
      toast.error(extractError(err, t('pages.training.autoFlags.toast.error', 'Action failed')))
    }
  }
  const handleBulkDismiss = async () => {
    if (!ruleCode) {
      toast.error(
        t('pages.training.autoFlags.bulkRequiresRule', 'Pick a single rule before bulk-dismissing.')
      )
      return
    }
    if (
      !window.confirm(
        t('pages.training.autoFlags.bulkConfirm', 'Dismiss every pending flag for this rule?')
      )
    ) {
      return
    }
    try {
      const result = await bulkDismissMut.mutateAsync({ rule_code: ruleCode })
      toast.success(
        t('pages.training.autoFlags.toast.bulkDismissed', {
          defaultValue: 'Dismissed {{count}} flags',
          count: result.dismissed_count,
        })
      )
    } catch (err) {
      toast.error(extractError(err, t('pages.training.autoFlags.toast.error', 'Action failed')))
    }
  }

  const flags = data?.data ?? []
  const total = data?.total ?? 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-[#EBECE8] bg-white p-1 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
          {STATUS_TABS.map((tab) => {
            const isActive = tab.id === status
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatus(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium tracking-[-0.02em] transition-colors ${
                  isActive ? 'bg-[#204E4D] text-white' : 'text-[#545454] hover:bg-[#F7F7F7]'
                }`}
              >
                {t(tab.key, tab.fallback)}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={ruleCode ?? ''}
            onChange={(e) => setRuleCode(e.target.value || undefined)}
            className="h-9 rounded-md border border-[#DFDFDF] bg-white px-3 text-xs text-[#545454]"
          >
            <option value="">{t('pages.training.autoFlags.allRules', 'All rules')}</option>
            {rules.map((rule) => (
              <option key={rule.code} value={rule.code}>
                {rule.name}
                {rule.is_local_evaluable
                  ? ''
                  : ` · ${t('pages.training.autoFlags.pendingDataSource', 'Pending data source')}`}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleBulkDismiss}
            disabled={!ruleCode || bulkDismissMut.isPending}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[#DFDFDF] bg-white px-3 text-xs text-[#545454] hover:bg-[#F7F7F7] disabled:opacity-50"
          >
            <Icons.Delete size={12} />
            {bulkDismissMut.isPending
              ? t('pages.training.autoFlags.bulkDismissing', 'Dismissing…')
              : t('pages.training.autoFlags.bulkDismiss', 'Bulk dismiss')}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-[#6B7280]">
        {t('pages.training.autoFlags.total', { defaultValue: '{{count}} flags', count: total })}
      </p>

      {isLoading ? (
        <div className="rounded-xl border border-[#EBECE8] bg-white p-6 text-center text-xs text-[#6B7280]">
          {t('pages.training.autoFlags.loading', 'Loading flags…')}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-4 text-xs text-[#B91C1C]">
          {t('pages.training.autoFlags.loadError', 'Could not load auto-flags.')}
        </div>
      ) : flags.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#EBECE8] bg-white p-8 text-center text-xs text-[#6B7280]">
          {t(
            'pages.training.autoFlags.empty',
            'No flags match the current filter. The scanner runs every 10 minutes.'
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {flags.map((flag) => (
            <FlagRow
              key={flag.id}
              flag={flag}
              operatorName={nameByOp.get(flag.operator_id) ?? `#${flag.operator_id}`}
              ruleName={ruleByCode.get(flag.rule_code)?.name ?? flag.rule_code}
              isLocalEvaluable={ruleByCode.get(flag.rule_code)?.is_local_evaluable ?? false}
              onConfirm={() => handleConfirm(flag.id)}
              onDismiss={() => handleDismiss(flag.id)}
              onConvert={() => handleConvert(flag.id)}
              isMutating={confirmMut.isPending || dismissMut.isPending || convertMut.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface FlagRowProps {
  flag: FlagEventCard
  operatorName: string
  ruleName: string
  isLocalEvaluable: boolean
  onConfirm: () => void
  onDismiss: () => void
  onConvert: () => void
  isMutating: boolean
}

function FlagRow({
  flag,
  operatorName,
  ruleName,
  isLocalEvaluable,
  onConfirm,
  onDismiss,
  onConvert,
  isMutating,
}: FlagRowProps) {
  const { t, i18n } = useTranslation('common')
  const detected = new Date(flag.detected_at)
  const detectedLabel = Number.isNaN(detected.getTime())
    ? '—'
    : formatDateTime(detected, i18n.language)
  const isPending = flag.status === 'pending'
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[#EBECE8] bg-white p-4 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[#05040D]">{ruleName}</span>
            <StatusBadge status={flag.status} />
            {!isLocalEvaluable ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                {t('pages.training.autoFlags.pendingDataSource', 'Pending data source')}
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-[#6B7280]">
            {t('pages.training.autoFlags.operator', 'Operator')}: <Pii>{operatorName}</Pii>
            {flag.call_id ? (
              <>
                {' · '}
                <span title={flag.call_id}>
                  {t('pages.training.autoFlags.call', 'Call')}: {flag.call_id.slice(0, 8)}…
                </span>
              </>
            ) : null}
            {' · '}
            <span>{detectedLabel}</span>
          </p>
          {flag.dismiss_reason ? (
            <p className="text-[11px] text-[#6B7280]">
              {t('pages.training.autoFlags.dismissReason', 'Reason')}: {flag.dismiss_reason}
            </p>
          ) : null}
        </div>
        {isPending ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onConfirm}
              disabled={isMutating}
              className="inline-flex h-8 items-center gap-1 rounded-md bg-[#204E4D] px-3 text-[11px] font-medium text-white hover:bg-[#1a3f3e] disabled:opacity-50"
            >
              {t('pages.training.autoFlags.confirm', 'Confirm')}
            </button>
            <button
              type="button"
              onClick={onConvert}
              disabled={isMutating || !flag.call_id}
              title={
                flag.call_id
                  ? undefined
                  : (t('pages.training.autoFlags.noCallTitle', 'Flag has no associated call') ?? '')
              }
              className="inline-flex h-8 items-center gap-1 rounded-md border border-[#204E4D] bg-white px-3 text-[11px] font-medium text-[#204E4D] hover:bg-[#F0FDF4] disabled:opacity-50"
            >
              {t('pages.training.autoFlags.convert', 'Convert to task')}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              disabled={isMutating}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-[#DFDFDF] bg-white px-3 text-[11px] text-[#545454] hover:bg-[#F7F7F7] disabled:opacity-50"
            >
              {t('pages.training.autoFlags.dismiss', 'Dismiss')}
            </button>
          </div>
        ) : null}
      </div>

      {Object.keys(flag.context || {}).length > 0 ? (
        <pre className="overflow-x-auto rounded-md bg-[#F9FAFB] p-2 text-[10px] text-[#374151]">
          {JSON.stringify(flag.context, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}

function StatusBadge({ status }: { status: FlagEventStatus }) {
  const { t } = useTranslation('common')
  if (status === 'pending')
    return (
      <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-medium text-[#B45309]">
        {t('pages.training.autoFlags.status.pending', 'Pending')}
      </span>
    )
  if (status === 'confirmed')
    return (
      <span className="rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[10px] font-medium text-[#B91C1C]">
        {t('pages.training.autoFlags.status.confirmed', 'Confirmed')}
      </span>
    )
  return (
    <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-medium text-[#374151]">
      {t('pages.training.autoFlags.status.dismissed', 'Dismissed')}
    </span>
  )
}

function extractError(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message
  return fallback
}

export default AutoFlagsSubTab
