import type { MessagingCampaignDetail, MessagingCampaignSummary } from '../api/types'

/** Prefer detail API cost; fall back to list row when detail omits cost fields. */
export function mergeCampaignCostFields(
  detail: MessagingCampaignDetail | undefined,
  listRow: MessagingCampaignSummary | null | undefined
): MessagingCampaignDetail | MessagingCampaignSummary | undefined {
  if (!detail) {
    return listRow ?? undefined
  }
  if (!listRow) {
    return detail
  }
  const detailHasCost =
    detail.total_cost != null &&
    detail.total_cost !== '' &&
    detail.cost_currency != null &&
    detail.cost_currency !== ''
  if (detailHasCost) {
    return detail
  }
  const listHasCost =
    listRow.total_cost != null &&
    listRow.total_cost !== '' &&
    listRow.cost_currency != null &&
    listRow.cost_currency !== ''
  if (!listHasCost) {
    return detail
  }
  return {
    ...detail,
    total_cost: listRow.total_cost,
    cost_currency: listRow.cost_currency,
    cost_status: listRow.cost_status ?? detail.cost_status,
  }
}
