/**
 * Loading skeleton for Contact Types — mirrors the DataTable layout.
 */

import { TableSkeleton } from '@/components/ui/TableSkeleton'

export function ContactTypesPageSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <TableSkeleton columns={9} rows={6} />
    </div>
  )
}

export default ContactTypesPageSkeleton
