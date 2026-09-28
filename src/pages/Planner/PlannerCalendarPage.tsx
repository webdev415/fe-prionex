/**
 * «Календар» before stories 5.13–5.14: an empty state (planner story 1.9, AC6, E-3).
 */
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'

export function PlannerCalendarPage() {
  const { t } = useTranslation('planner')
  return (
    <div className="border-border bg-card flex flex-col items-center gap-3 rounded-xl border p-10 text-center">
      <Icons.Calendar size={40} className="text-muted-foreground" />
      <p className="text-foreground text-sm">{t('calendar.empty')}</p>
    </div>
  )
}

export default PlannerCalendarPage
