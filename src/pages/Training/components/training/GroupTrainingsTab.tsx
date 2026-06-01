import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { MOCK_GROUP_TRAININGS, type MockGroupTraining } from '../../mocks/trainerWorkplaceMocks'

/**
 * Group Trainings sub-tab — Figma step 2. Card grid showing scheduled
 * group sessions (webinar / workshop / masterclass) with register CTA per
 * card. Per the implementation plan §3.4 the LMS expansion is deferred to
 * Phase C; the UI ships now on mock data for design completeness.
 */
const TYPE_TONE: Record<MockGroupTraining['type'], string> = {
  webinar: 'bg-blue-50 text-blue-700',
  workshop: 'bg-emerald-50 text-emerald-700',
  masterclass: 'bg-violet-50 text-violet-700',
}

const TYPE_LABEL: Record<MockGroupTraining['type'], string> = {
  webinar: 'Webinar',
  workshop: 'Workshop',
  masterclass: 'Masterclass',
}

const CATEGORY_CHIPS = ['All', 'Hard Collection', 'Soft Skills', 'Analytics', 'Product', 'Tools']

export function GroupTrainingsTab() {
  const { t } = useTranslation('common')
  const [category, setCategory] = useState('All')

  const filtered =
    category === 'All'
      ? MOCK_GROUP_TRAININGS
      : MOCK_GROUP_TRAININGS.filter((g) => g.category === category)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-dark-500 text-base font-semibold">
          {t('pages.training.groupTrainings.title', 'Group trainings')}
        </h2>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Icons.Add size={14} className="text-white" />}
          className="h-[40px] rounded-full px-4 text-xs"
        >
          {t('pages.training.groupTrainings.schedule', 'Schedule a training')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {CATEGORY_CHIPS.map((c) => {
          const isActive = c === category
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 border-primary-300 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              {c}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((g) => (
          <GroupTrainingCard key={g.id} training={g} />
        ))}
      </div>
    </div>
  )
}

function GroupTrainingCard({ training }: { training: MockGroupTraining }) {
  const { t } = useTranslation('common')
  const seatsLeft = training.participantsCapacity - training.participantsRegistered

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="relative h-[80px] w-full" style={{ background: training.coverGradient }}>
        <span
          className={`absolute top-3 right-3 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${TYPE_TONE[training.type]}`}
        >
          {TYPE_LABEL[training.type]}
        </span>
        <div className="absolute top-3 left-3 flex flex-col">
          <span className="text-dark-500 text-2xl leading-none font-semibold">
            {training.dateLabel.split('.')[0]}
          </span>
          <span className="text-[10px] text-gray-600">{training.dateLabel.split('.')[1]}.06</span>
        </div>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col">
          <h3 className="text-dark-500 text-sm font-semibold">{training.title}</h3>
          <span className="text-[11px] text-gray-500">
            {t('pages.training.groupTrainings.trainer', 'Trainer')}: {training.trainer}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex flex-col items-center rounded-lg bg-gray-50 py-1.5">
            <span className="text-dark-500 text-xs font-semibold">{training.timeLabel}</span>
            <span className="text-[9px] text-gray-500 uppercase">
              {t('pages.training.groupTrainings.time', 'Time')}
            </span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-gray-50 py-1.5">
            <span className="text-dark-500 text-xs font-semibold">
              {training.participantsRegistered}/{training.participantsCapacity}
            </span>
            <span className="text-[9px] text-gray-500 uppercase">
              {t('pages.training.groupTrainings.participants', 'Participants')}
            </span>
          </div>
        </div>

        {seatsLeft > 0 && seatsLeft <= 5 ? (
          <span className="text-[10px] font-medium text-amber-600">
            {t('pages.training.groupTrainings.seatsLeft', '{{count}} seats left', {
              count: seatsLeft,
            })}
          </span>
        ) : null}

        <Button
          variant={training.isRegistered ? 'secondary' : 'primary'}
          size="sm"
          className="rounded-full text-[11px]"
          leftIcon={
            training.isRegistered ? (
              <Icons.Success size={12} />
            ) : (
              <Icons.Add size={12} className="text-white" />
            )
          }
        >
          {training.isRegistered
            ? t('pages.training.groupTrainings.registered', 'Registered')
            : t('pages.training.groupTrainings.register', 'Register')}
        </Button>
      </div>
    </div>
  )
}

export default GroupTrainingsTab
