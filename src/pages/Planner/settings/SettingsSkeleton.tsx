/**
 * The shape of the board settings while they load (planner stories 5.10 and
 * 5.1 AC4 — no full-screen spinner in the section): the column preview, the
 * menu of sections on the left and rows on the right. Imported directly by the
 * route table, not through the `@/pages/Planner` barrel.
 */
import { useTranslation } from 'react-i18next'

const BLOCK = 'bg-muted motion-safe:animate-pulse rounded'

export function SettingsSkeleton() {
  const { t } = useTranslation('planner')
  return (
    <div aria-busy="true" className="space-y-4">
      <span className="sr-only">{t('state.loading')}</span>
      <div aria-hidden="true" className="flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`${BLOCK} h-12 w-36`} />
        ))}
      </div>
      <div aria-hidden="true" className="flex gap-6">
        <div className="w-56 shrink-0 space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={`${BLOCK} h-7`} />
          ))}
        </div>
        <div className="flex-1 space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`${BLOCK} h-16`} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default SettingsSkeleton
