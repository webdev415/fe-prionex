/**
 * Operator dialer surface (KAN-379, design: operator-01/02).
 *
 * Left: the operator's campaigns (department-scoped by the backend, §13).
 * Right: campaign detail with join/leave and the operator's session status.
 *
 * The active-call workspace (routed live calls, interaction form, TA chain) is
 * layered on in the next slice; this slice covers campaign selection, joining /
 * leaving a queue, and reflecting the operator's session status.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { useDialerQueues, useJoinQueue, useLeaveQueue, useMyDialerSession } from '@/features/dialer'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

import { CampaignList } from './CampaignList'

export function OperatorDialerView() {
  const { t } = useTranslation('common')

  const { data: campaigns, isLoading } = useDialerQueues()
  const { data: session } = useMyDialerSession()
  const joinMutation = useJoinQueue()
  const leaveMutation = useLeaveQueue()

  const joinedQueueId = session?.queue_id ?? null
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // Default the right pane to the joined campaign, else the operator's pick.
  const activeId = selectedId ?? joinedQueueId
  const activeCampaign = useMemo(
    () => campaigns?.find((c) => c.id === activeId) ?? null,
    [campaigns, activeId]
  )
  const isJoinedHere = activeCampaign != null && activeCampaign.id === joinedQueueId

  const handleJoin = async () => {
    if (!activeCampaign) return
    try {
      await joinMutation.mutateAsync({ queueId: activeCampaign.id, autoConnect: false })
      toast.success(t('dialer.operator.joinedToast', 'Joined the dialer'))
    } catch {
      // onError toast handled by the mutation.
    }
  }

  const handleLeave = async () => {
    try {
      await leaveMutation.mutateAsync()
      toast.success(t('dialer.operator.leftToast', 'Left the dialer'))
    } catch {
      // onError toast handled by the mutation.
    }
  }

  const statusLabel = (() => {
    switch (session?.status) {
      case 'active':
        return t('dialer.operator.statusActive', 'Active')
      case 'paused':
        return t('dialer.operator.statusPaused', 'Paused')
      default:
        return t('dialer.operator.statusNotConnected', 'Not connected')
    }
  })()

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      {/* Campaign list (left) */}
      {isLoading ? (
        <aside className="border-border text-muted-foreground rounded-xl border bg-white p-4 text-sm">
          {t('common.loading', 'Loading...')}
        </aside>
      ) : (
        <CampaignList
          campaigns={campaigns ?? []}
          selectedId={activeId}
          joinedId={joinedQueueId}
          onSelect={setSelectedId}
        />
      )}

      {/* Right pane */}
      {!activeCampaign ? (
        <section className="border-border flex min-h-[420px] items-center justify-center rounded-xl border bg-white">
          <div className="flex flex-col items-center text-center">
            <Icons.Phone size={40} className="text-muted-foreground/60" strokeWidth={1.5} />
            <h3 className="text-foreground mt-4 text-xl font-medium">
              {t('dialer.operator.selectCampaignTitle', 'Select a campaign')}
            </h3>
            <p className="text-muted-foreground mt-1 max-w-xs text-sm">
              {t(
                'dialer.operator.selectCampaignHint',
                'Select a campaign from the list on the left to start the dialer.'
              )}
            </p>
          </div>
        </section>
      ) : (
        <section className="border-border flex min-h-[420px] flex-col rounded-xl border bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-foreground text-lg font-semibold">{activeCampaign.name}</h3>
              <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
                    session?.status === 'active'
                      ? 'bg-success-50 text-success-600'
                      : session?.status === 'paused'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  {statusLabel}
                </span>
              </div>
            </div>
            {isJoinedHere ? (
              <Button
                variant="danger"
                leftIcon={<Icons.CallEnd size={18} />}
                onClick={handleLeave}
                isLoading={leaveMutation.isPending}
              >
                {t('dialer.operator.leaveDialer', 'Leave Dialer')}
              </Button>
            ) : (
              <Button
                variant="primary"
                leftIcon={<Icons.Phone size={18} />}
                onClick={handleJoin}
                isLoading={joinMutation.isPending}
                disabled={joinedQueueId != null && joinedQueueId !== activeCampaign.id}
              >
                {t('dialer.operator.joinDialer', 'Join Dialer')}
              </Button>
            )}
          </div>

          {/* Campaign facts */}
          <div className="text-muted-foreground mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs">{t('dialer.operator.inQueue', 'In queue')}</p>
              <p className="text-foreground text-base font-semibold">
                {(activeCampaign.total_in_queue ?? 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs">{t('dialer.operator.operators', 'Operators')}</p>
              <p className="text-foreground text-base font-semibold">
                {activeCampaign.operators_connected ?? 0}
              </p>
            </div>
            <div>
              <p className="text-xs">{t('dialer.operator.aggressiveness', 'Aggressiveness')}</p>
              <p className="text-foreground text-base font-semibold">
                {activeCampaign.aggressiveness}×
              </p>
            </div>
            {activeCampaign.calling_hours_start && activeCampaign.calling_hours_end && (
              <div>
                <p className="text-xs">{t('dialer.operator.hours', 'Hours')}</p>
                <p className="text-foreground text-base font-semibold">
                  {activeCampaign.calling_hours_start}–{activeCampaign.calling_hours_end}
                </p>
              </div>
            )}
          </div>

          {/* Connected placeholder — the active-call workspace lands next slice. */}
          <div className="border-border text-muted-foreground mt-6 flex flex-1 items-center justify-center rounded-lg border border-dashed text-center text-sm">
            {isJoinedHere
              ? t('dialer.operator.waitingForCall', 'Connected — waiting for the next call…')
              : t('dialer.operator.joinToStart', 'Join the dialer to start receiving calls.')}
          </div>
        </section>
      )}
    </div>
  )
}

export default OperatorDialerView
