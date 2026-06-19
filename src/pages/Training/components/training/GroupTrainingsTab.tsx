import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { MOCK_GROUP_TRAININGS, type MockGroupTraining } from '../../mocks/trainerWorkplaceMocks'
import { PendingFeatureDialog } from '../inbox/PendingFeatureDialog'
import { TrainingFilterChips, TrainingPrimaryButton } from './TrainingToolbar'

const TYPE_TONE: Record<MockGroupTraining['type'], string> = {
  webinar: 'bg-[#EFF6FF] text-[#2563EB]',
  workshop: 'bg-[#F0FDF4] text-[#15803D]',
  masterclass: 'bg-[#F5F3FF] text-[#7C3AED]',
}

const TYPE_LABEL: Record<MockGroupTraining['type'], string> = {
  webinar: 'Webinar',
  workshop: 'Workshop',
  masterclass: 'Masterclass',
}

const CATEGORY_CHIPS = [
  { id: 'All', label: 'All' },
  { id: 'Hard Collection', label: 'Hard Collection' },
  { id: 'Soft Skills', label: 'Soft Skills' },
  { id: 'Analytics', label: 'Analytics' },
  { id: 'Product', label: 'Product' },
  { id: 'Tools', label: 'Tools' },
]

export function GroupTrainingsTab() {
  const { t } = useTranslation('common')
  const [category, setCategory] = useState('All')
  const [scheduleOpen, setScheduleOpen] = useState(false)

  const filtered =
    category === 'All'
      ? MOCK_GROUP_TRAININGS
      : MOCK_GROUP_TRAININGS.filter((g) => g.category === category)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#05040D]">
          {t('pages.training.groupTrainings.title', 'Group trainings')}
        </h2>
        <TrainingPrimaryButton
          onClick={() => setScheduleOpen(true)}
          leftIcon={<Icons.Add size={14} className="text-white" />}
        >
          {t('pages.training.groupTrainings.schedule', 'Schedule a training')}
        </TrainingPrimaryButton>
      </div>

      <TrainingFilterChips items={CATEGORY_CHIPS} activeId={category} onChange={setCategory} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((g) => (
          <GroupTrainingCard key={g.id} training={g} />
        ))}
      </div>

      <PendingFeatureDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        titleKey="pages.training.groupTrainings.schedule"
        titleFallback="Schedule a training"
        descriptionKey="pages.training.training.pending.scheduleGroup"
        descriptionFallback="Plan a group webinar, workshop, or masterclass session."
        dependsOnIssue="KAN-416"
      />
    </div>
  )
}

function GroupTrainingCard({ training }: { training: MockGroupTraining }) {
  const { t } = useTranslation('common')
  const seatsLeft = training.participantsCapacity - training.participantsRegistered

  return (
    <div className="overflow-hidden rounded-xl border border-[#EBECE8] bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      <div
        className="relative h-20 w-full bg-gradient-to-br from-[#F3FAF9] to-[#E3F6F3]"
        style={{ background: training.coverGradient }}
      >
        <span
          className={`absolute top-3 right-3 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${TYPE_TONE[training.type]}`}
        >
          {TYPE_LABEL[training.type]}
        </span>
        <div className="absolute top-3 left-3 flex flex-col text-[#204E4D]">
          <span className="text-2xl leading-none font-semibold">
            {training.dateLabel.split('.')[0]}
          </span>
          <span className="text-[10px]">{training.dateLabel.split('.')[1]}.06</span>
        </div>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-[#05040D]">{training.title}</h3>
          <span className="text-[11px] text-[#6B7280]">
            {t('pages.training.groupTrainings.trainer', 'Trainer')}: {training.trainer}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col items-center rounded-lg bg-[#F7F7F7] py-2">
            <span className="text-xs font-semibold text-[#05040D]">{training.timeLabel}</span>
            <span className="text-[9px] text-[#6B7280] uppercase">
              {t('pages.training.groupTrainings.time', 'Time')}
            </span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-[#F7F7F7] py-2">
            <span className="text-xs font-semibold text-[#05040D]">
              {training.participantsRegistered}/{training.participantsCapacity}
            </span>
            <span className="text-[9px] text-[#6B7280] uppercase">
              {t('pages.training.groupTrainings.participants', 'Participants')}
            </span>
          </div>
        </div>

        {seatsLeft > 0 && seatsLeft <= 5 ? (
          <span className="text-[10px] font-medium text-[#D97706]">
            {t('pages.training.groupTrainings.seatsLeft', '{{count}} seats left', {
              count: seatsLeft,
            })}
          </span>
        ) : null}

        <button
          type="button"
          className={`rounded-md px-3 py-2 text-xs font-medium ${
            training.isRegistered
              ? 'border border-[#EDEDED] bg-white text-[#05040D]'
              : 'bg-[#204E4D] text-white'
          }`}
        >
          {training.isRegistered
            ? t('pages.training.groupTrainings.registered', 'Registered')
            : t('pages.training.groupTrainings.register', 'Register')}
        </button>
      </div>
    </div>
  )
}

export default GroupTrainingsTab
