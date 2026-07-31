import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { Modal, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { useClientCallSummary } from '@/features/dialer'
import type { MoneyStat } from '@/features/dialer'
import { Icons } from '@/lib/icons'

import { CallProgressRing } from './CallProgressRing'
import { RecentInteractions } from './RecentInteractions'

interface ClientInfoPopupProps {
  open: boolean
  onClose: () => void
  clientId: number
  clientName: string
  phone: string
}

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

interface PaymentTileProps {
  icon: React.ReactNode
  label: string
  stat: MoneyStat
  currency: string
  countLabel: string
  highlight?: boolean
}

function PaymentTile({ icon, label, stat, currency, countLabel, highlight }: PaymentTileProps) {
  return (
    <div className="border-border bg-card relative flex flex-col gap-2 overflow-hidden rounded-xl border p-4">
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        {icon}
        {label}
      </div>
      <p className="text-foreground text-lg font-semibold">{formatMoney(stat.amount, currency)}</p>
      <div className="border-border mt-1 border-t pt-2">
        <p className="text-muted-foreground text-xs">{countLabel}</p>
        <p className="text-foreground text-base font-semibold">{stat.count}</p>
      </div>
      {highlight && <span className="bg-primary-400 absolute inset-x-0 bottom-0 h-1" />}
    </div>
  )
}

export function ClientInfoPopup({
  open,
  onClose,
  clientId,
  clientName,
  phone,
}: ClientInfoPopupProps) {
  const { t } = useTranslation('common')
  const { data: summary, isLoading } = useClientCallSummary(clientId, open)

  const currency = summary?.currency ?? '₴'
  const isActive = (summary?.status ?? 'active') === 'active'

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <ModalContent>
        <div className="flex flex-col items-center gap-5">
          <span
            className={
              isActive
                ? 'bg-success-50 text-success-600 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium'
                : 'bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium'
            }
          >
            <span
              className={
                isActive
                  ? 'bg-success-500 h-2 w-2 rounded-full'
                  : 'bg-muted-foreground h-2 w-2 rounded-full'
              }
            />
            {isActive
              ? t('dialer.call.statusActive', 'Active')
              : t('dialer.call.statusInactive', 'Inactive')}
          </span>

          <div className="flex items-center gap-3">
            <span className="bg-card border-border flex h-9 w-9 shrink-0 items-center justify-center rounded-full border shadow-sm">
              <Icons.UserCircle02Icon size={20} className="text-muted-foreground" />
            </span>
            <h2 className="text-foreground text-xl font-semibold">{clientName}</h2>
          </div>

          {isLoading ? (
            <p className="text-muted-foreground py-6 text-sm">
              {t('common.loading', 'Loading...')}
            </p>
          ) : (
            <>
              <CallProgressRing percent={summary?.progress_pct ?? 0} />

              <p className="text-foreground text-lg">
                {t('dialer.call.totalPaid', 'Total Paid')}:{' '}
                <span className="font-semibold">
                  {formatMoney(summary?.total_paid ?? 0, currency)}
                </span>
              </p>

              <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
                <PaymentTile
                  icon={<Icons.Wallet01 size={16} />}
                  label={t('dialer.call.totalPayments', 'Total Payments')}
                  stat={summary?.total_payments ?? { amount: 0, count: 0 }}
                  currency={currency}
                  countLabel={t('dialer.call.numberOfPayments', 'Number of Payments')}
                  highlight
                />
                <PaymentTile
                  icon={<Icons.Invoice01 size={16} />}
                  label={t('dialer.call.verified', 'Verified')}
                  stat={summary?.verified ?? { amount: 0, count: 0 }}
                  currency={currency}
                  countLabel={t('dialer.call.numberOfPayments', 'Number of Payments')}
                />
                <PaymentTile
                  icon={<Icons.Invoice01 size={16} />}
                  label={t('dialer.call.pending', 'Pending')}
                  stat={summary?.pending ?? { amount: 0, count: 0 }}
                  currency={currency}
                  countLabel={t('dialer.call.numberOfPayments', 'Number of Payments')}
                />
              </div>

              <div className="w-full">
                <p className="text-muted-foreground mb-1 text-sm">
                  {t('dialer.call.phoneNumber', 'Phone Number')}:
                </p>
                <div className="border-border bg-muted/40 text-foreground flex items-center justify-between rounded-lg border px-4 py-3 text-sm">
                  <span>{phone}</span>
                  <Icons.Lock size={16} className="text-muted-foreground" />
                </div>
              </div>

              <hr className="border-border w-full" />

              <div className="w-full">
                <p className="text-foreground mb-2 text-center text-sm font-medium">
                  {t('dialer.call.recentInteractions', 'Recent interactions with this client')}
                </p>
                <RecentInteractions items={summary?.recent_interactions ?? []} />
              </div>
            </>
          )}
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose} className="w-full">
          {t('actions.close', 'Close')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default ClientInfoPopup
