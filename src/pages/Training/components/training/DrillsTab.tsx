import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { MOCK_DRILLS, type MockDrill } from '../../mocks/trainerWorkplaceMocks'
import { PendingFeatureDialog } from '../inbox/PendingFeatureDialog'
import { TrainingPrimaryButton } from './TrainingToolbar'

export function DrillsTab() {
  const { t } = useTranslation('common')
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#05040D]">
          {t('pages.training.drills.title', 'Short drills')}
        </h2>
        <TrainingPrimaryButton
          onClick={() => setCreateOpen(true)}
          leftIcon={<Icons.Add size={14} className="text-white" />}
        >
          {t('pages.training.drills.create', 'Create a drill')}
        </TrainingPrimaryButton>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_DRILLS.map((d) => (
          <DrillCard key={d.id} drill={d} />
        ))}
      </div>

      <PendingFeatureDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        titleKey="pages.training.drills.create"
        titleFallback="Create a drill"
        descriptionKey="pages.training.training.pending.createDrill"
        descriptionFallback="Build a short practice drill for operators to complete in under 10 minutes."
        dependsOnIssue="KAN-416"
      />
    </div>
  )
}

function DrillCard({ drill }: { drill: MockDrill }) {
  const { t } = useTranslation('common')
  return (
    <div className="overflow-hidden rounded-xl border border-[#EBECE8] bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      <div
        className="h-[60px] w-full bg-gradient-to-br from-[#F3FAF9] to-[#E3F6F3]"
        style={{ background: drill.coverGradient }}
      />
      <div className="flex flex-col gap-3 p-4">
        <h3 className="text-sm font-semibold text-[#05040D]">{drill.title}</h3>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col items-center rounded-lg bg-[#F7F7F7] py-2">
            <span className="text-xs font-semibold text-[#05040D]">
              {drill.durationMinutes} min
            </span>
            <span className="text-[9px] text-[#6B7280] uppercase">
              {t('pages.training.drills.duration', 'Duration')}
            </span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-[#F7F7F7] py-2">
            <span className="text-xs font-semibold text-[#05040D]">{drill.attempts}</span>
            <span className="text-[9px] text-[#6B7280] uppercase">
              {t('pages.training.drills.attempts', 'Attempts')}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center gap-1 rounded-md bg-[#204E4D] px-3 py-2 text-xs font-medium text-white hover:bg-[#1a3f3e]"
        >
          <Icons.Play size={12} className="text-white" />
          {t('pages.training.drills.start', 'Start')}
        </button>
      </div>
    </div>
  )
}

export default DrillsTab
