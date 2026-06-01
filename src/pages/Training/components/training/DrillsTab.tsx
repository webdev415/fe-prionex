import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { MOCK_DRILLS, type MockDrill } from '../../mocks/trainerWorkplaceMocks'

/**
 * Short Drills sub-tab — Figma step 3. Card grid of 1-10 minute practice
 * drills with attempt count and a Start button per card.
 */
export function DrillsTab() {
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-dark-500 text-base font-semibold">
          {t('pages.training.drills.title', 'Short drills')}
        </h2>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Icons.Add size={14} className="text-white" />}
          className="h-[40px] rounded-full px-4 text-xs"
        >
          {t('pages.training.drills.create', 'Create a drill')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MOCK_DRILLS.map((d) => (
          <DrillCard key={d.id} drill={d} />
        ))}
      </div>
    </div>
  )
}

function DrillCard({ drill }: { drill: MockDrill }) {
  const { t } = useTranslation('common')
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="h-[60px] w-full" style={{ background: drill.coverGradient }} />
      <div className="flex flex-col gap-3 p-4">
        <h3 className="text-dark-500 text-sm font-semibold">{drill.title}</h3>

        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex flex-col items-center rounded-lg bg-gray-50 py-1.5">
            <span className="text-dark-500 text-xs font-semibold">{drill.durationMinutes} min</span>
            <span className="text-[9px] text-gray-500 uppercase">
              {t('pages.training.drills.duration', 'Duration')}
            </span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-gray-50 py-1.5">
            <span className="text-dark-500 text-xs font-semibold">{drill.attempts}</span>
            <span className="text-[9px] text-gray-500 uppercase">
              {t('pages.training.drills.attempts', 'Attempts')}
            </span>
          </div>
        </div>

        <Button
          variant="primary"
          size="sm"
          className="rounded-full text-[11px]"
          leftIcon={<Icons.Play size={12} className="text-white" />}
        >
          {t('pages.training.drills.start', 'Start')}
        </Button>
      </div>
    </div>
  )
}

export default DrillsTab
