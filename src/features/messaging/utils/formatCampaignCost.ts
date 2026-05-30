import type { MessagingCampaignSummary } from '../api/types'

export function formatCampaignCostAmount(
  amount: string | number | null | undefined,
  currency: string | null | undefined
): string | null {
  if (amount === null || amount === undefined || amount === '') {
    return null
  }
  const numeric = typeof amount === 'number' ? amount : Number(amount)
  if (Number.isNaN(numeric)) {
    return null
  }
  const formatted = numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
  const code = (currency || '').trim()
  return code ? `${formatted} ${code}` : formatted
}

export function campaignCostStatusLabel(
  costStatus: string | null | undefined,
  t: (key: string, options?: { defaultValue?: string }) => string
): string | null {
  const key = (costStatus || '').trim().toLowerCase()
  if (!key || key === 'pending' || key === 'unavailable') {
    return null
  }
  if (key === 'calculated') {
    return t('pages.messagingCampaigns.cost.actual', { defaultValue: 'Actual' })
  }
  if (key === 'estimated') {
    return t('pages.messagingCampaigns.cost.estimated', { defaultValue: 'Est.' })
  }
  if (key === 'partial') {
    return t('pages.messagingCampaigns.cost.partial', { defaultValue: 'Partial' })
  }
  return null
}

export function formatCampaignCostDisplay(
  campaign: Pick<MessagingCampaignSummary, 'total_cost' | 'cost_currency' | 'cost_status'>,
  t: (key: string, options?: { defaultValue?: string }) => string
): { amount: string; badge: string | null } {
  const amount =
    formatCampaignCostAmount(campaign.total_cost, campaign.cost_currency) ??
    t('pages.messagingCampaigns.cost.unavailable', { defaultValue: '—' })
  return {
    amount,
    badge: campaignCostStatusLabel(campaign.cost_status, t),
  }
}
