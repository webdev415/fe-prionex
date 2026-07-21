/**
 * Operator active-call workspace (KAN-379, design: operator-02).
 *
 * Shown while a live call is routed to the operator: a call bar with a live
 * timer, the client-info block (identity, link to the client card, 5 recent
 * interactions), the standard interaction-creation form, and the TA-chain
 * stepper. Reuses AddNoteModal (interaction form), ChainExecutor (TA chain),
 * and useClientActivities — the same components used across the CRM.
 *
 * NOTE (§7.3): the design shows the interaction form inline; this reuses the
 * canonical AddNoteModal (opened from the panel) so the form stays identical to
 * the rest of the CRM. The phone is pre-filled and read-only.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { useCreateInteraction } from '@/features/clients/hooks/useNoteInteraction'
import type { RoutedCall } from '@/features/dialer'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  AddNoteModal,
  type InteractionCreateData,
} from '@/pages/ClientManagement/components/AddNoteModal'
import { ChainExecutor } from '@/pages/ClientManagement/components/taChains/ChainExecutor'

import { ClientInfoPopup } from './ClientInfoPopup'
import { RecentInteractions } from './RecentInteractions'

interface ActiveCallPanelProps {
  routedCall: RoutedCall
  campaignName: string
  autoConnect: boolean
  onToggleAutoConnect: (value: boolean) => void
  onLeave: () => void
  leaving?: boolean
  onHangup: () => void
}

function fmtClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function ActiveCallPanel({
  routedCall,
  campaignName,
  autoConnect,
  onToggleAutoConnect,
  onLeave,
  leaving,
  onHangup,
}: ActiveCallPanelProps) {
  const { t } = useTranslation('common')

  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const elapsed = Math.max(
    0,
    Math.floor((nowMs - new Date(routedCall.started_at).getTime()) / 1000)
  )

  const [noteOpen, setNoteOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const createInteraction = useCreateInteraction()

  const handleSaveInteraction = async (data: InteractionCreateData) => {
    try {
      await createInteraction.mutateAsync({ clientId: routedCall.client_id, data })
      toast.success(t('dialer.call.interactionSaved', 'Interaction saved'))
      setNoteOpen(false)
    } catch {
      // useCreateInteraction handles its own error surface.
    }
  }

  const lineLabel =
    routedCall.line_type === 'white'
      ? t('dialer.call.white', 'WHITE')
      : t('dialer.call.grey', 'GREY')

  return (
    <section className="border-border flex min-h-[420px] flex-col rounded-xl border bg-white p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="bg-success-500 h-2 w-2 rounded-full" />
          <h3 className="text-foreground text-sm font-semibold">
            {t('dialer.call.activeCall', 'Active Call')} · {campaignName}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-muted-foreground flex items-center gap-2 text-xs">
            {t('dialer.call.autoConnection', 'Auto-connection')}
            <ToggleSwitch checked={autoConnect} onChange={onToggleAutoConnect} />
          </label>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Icons.CallEnd size={16} />}
            onClick={onLeave}
            isLoading={leaving}
          >
            {t('dialer.operator.leaveDialer', 'Leave Dialer')}
          </Button>
        </div>
      </div>

      {/* Call bar */}
      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-[#1f3d3a] px-4 py-3 text-white">
        <span className="text-base font-medium">{routedCall.phone}</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm">
            <Icons.Clock01 size={16} />
            {fmtClock(elapsed)}
          </span>
          <span className="rounded bg-white/15 px-2 py-0.5 text-xs font-semibold">{lineLabel}</span>
          <button
            type="button"
            onClick={onHangup}
            aria-label={t('dialer.call.hangUp', 'Hang up')}
            className="bg-error-500 hover:bg-error-600 flex h-8 w-8 items-center justify-center rounded-md transition-colors"
          >
            <Icons.CallEnd size={18} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left: client info + interaction */}
        <div className="flex flex-col gap-4">
          <div className="border-border rounded-lg border p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-foreground truncate text-base font-semibold">
                  {routedCall.client_name}
                </p>
                <p className="text-muted-foreground mt-0.5 text-sm">{routedCall.phone}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="sm" onClick={() => setInfoOpen(true)}>
                  {t('dialer.call.clientInfo', 'Client info')}
                </Button>
                <a
                  href={`/dashboard/clients/${routedCall.client_id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="ghost" size="sm" rightIcon={<Icons.ArrowRight02 size={16} />}>
                    {t('dialer.call.viewClient', 'View Client')}
                  </Button>
                </a>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-muted-foreground mb-2 text-xs font-medium">
                {t('dialer.call.recentInteractions', 'Recent interactions with this client')}
              </p>
              <RecentInteractions clientId={routedCall.client_id} />
            </div>
          </div>

          <Button
            variant="primary"
            leftIcon={<Icons.Add size={16} />}
            onClick={() => setNoteOpen(true)}
            className={cn('self-start')}
          >
            {t('dialer.call.addInteraction', 'Add interaction')}
          </Button>
        </div>

        {/* Right: TA chain */}
        <div className="border-border rounded-lg border p-4">
          <ChainExecutor
            clientId={routedCall.client_id}
            clientName={routedCall.client_name}
            contactSource="client"
            prefilledPhone={routedCall.phone}
          />
        </div>
      </div>

      {/* Interaction form (canonical) — phone pre-filled + read-only */}
      <AddNoteModal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        phoneNumber={routedCall.phone}
        clientId={routedCall.client_id}
        onSave={handleSaveInteraction}
      />

      <ClientInfoPopup
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        clientId={routedCall.client_id}
        clientName={routedCall.client_name}
        phone={routedCall.phone}
      />
    </section>
  )
}

export default ActiveCallPanel
