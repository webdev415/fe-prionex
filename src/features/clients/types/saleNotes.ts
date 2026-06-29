/**
 * Sale-note types — used by the per-client "Comments from the primary
 * creditor" tab (KAN-617).
 *
 * `sale_date` is null only for legacy-migrated rows. The FE treats a null
 * sale_date as the "(migrated)" label per the Q3 heuristic.
 */

export interface SaleNote {
  id: number
  client_id: number
  sale_date: string | null
  content: string
  added_by_user_id: number
  added_by_name: string | null
  created_at: string
}
