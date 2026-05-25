/**
 * Table skeleton for Messaging Drafts while the draft list is loading.
 */

import { TableSkeleton } from '@/components/ui/TableSkeleton'

const TABLE_COLUMNS = 5

export function MessagingDraftsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return <TableSkeleton columns={TABLE_COLUMNS} rows={rows} className="w-full" />
}

export default MessagingDraftsTableSkeleton
