import type { ReactNode } from 'react'
import { ANALYTICS_TABLE, ANALYTICS_TABLE_WRAP } from './analyticsTableStyles'

export function AnalyticsMockTable({ children }: { children: ReactNode }) {
  return (
    <div className={ANALYTICS_TABLE_WRAP}>
      <div className="overflow-x-auto">
        <table className={ANALYTICS_TABLE}>{children}</table>
      </div>
    </div>
  )
}

export default AnalyticsMockTable
