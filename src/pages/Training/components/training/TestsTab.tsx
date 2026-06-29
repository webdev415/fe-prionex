import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { MOCK_TESTS, type MockTest, type TestStatus } from '../../mocks/trainerWorkplaceMocks'
import { PendingFeatureDialog } from '../inbox/PendingFeatureDialog'
import { TrainingFilterChips, TrainingPrimaryButton } from './TrainingToolbar'

const STATUS_TONE: Record<TestStatus, { label: string; tone: string }> = {
  passed: { label: 'Passed', tone: 'bg-[#F0FDF4] text-[#15803D]' },
  failed: { label: 'Failed', tone: 'bg-[#FEF2F2] text-[#B91C1C]' },
  in_progress: { label: 'In progress', tone: 'bg-[#FFFBEB] text-[#D97706]' },
  not_started: { label: 'Not started', tone: 'bg-[#F3F4F6] text-[#4B5563]' },
}

const FILTERS = [
  { id: 'all', label: 'All tests' },
  { id: 'passed', label: 'Passed' },
  { id: 'failed', label: 'Failed' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'not_started', label: 'Not started' },
]

export function TestsTab() {
  const { t } = useTranslation('common')
  const [filter, setFilter] = useState<TestStatus | 'all'>('all')
  const [createOpen, setCreateOpen] = useState(false)

  const filtered = filter === 'all' ? MOCK_TESTS : MOCK_TESTS.filter((tt) => tt.status === filter)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#05040D]">
          {t('pages.training.tests.title', 'Tests')}
        </h2>
        <TrainingPrimaryButton
          onClick={() => setCreateOpen(true)}
          leftIcon={<Icons.Add size={14} className="text-white" />}
        >
          {t('pages.training.tests.create', 'Create a test')}
        </TrainingPrimaryButton>
      </div>

      <TrainingFilterChips
        items={FILTERS}
        activeId={filter}
        onChange={(id) => setFilter(id as TestStatus | 'all')}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((tt) => (
          <TestCard key={tt.id} test={tt} />
        ))}
      </div>

      <PendingFeatureDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        titleKey="pages.training.tests.create"
        titleFallback="Create a test"
        descriptionKey="pages.training.training.pending.createTest"
        descriptionFallback="Create a post-course test with scoring and retake rules."
        dependsOnIssue="KAN-416"
      />
    </div>
  )
}

function TestCard({ test }: { test: MockTest }) {
  const { t } = useTranslation('common')
  const status = STATUS_TONE[test.status]

  return (
    <div className="overflow-hidden rounded-xl border border-[#EBECE8] bg-white shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      <div
        className="relative h-[70px] w-full bg-gradient-to-br from-[#F3FAF9] to-[#E3F6F3]"
        style={{ background: test.coverGradient }}
      >
        {/* Heart/favorite toggle — Figma test cards have a heart on the top
            left of the cover, opposite the status badge. */}
        <button
          type="button"
          aria-label={t('pages.training.tests.favorite', 'Favorite')}
          className="absolute top-3 left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-[#9CA3AF] shadow-sm transition-colors hover:text-[#EF4444]"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
        <span
          className={`absolute top-3 right-3 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${status.tone}`}
        >
          {status.label}
        </span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-[#05040D]">{test.title}</h3>
          <span className="text-[11px] text-[#6B7280]">
            {t('pages.training.tests.course', 'Course')}: {test.course}
          </span>
          <span className="text-[11px] text-[#9CA3AF]">{test.category}</span>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-[#F7F7F7] px-3 py-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-[#05040D]"
            style={{ backgroundColor: test.authorAvatar }}
          >
            {test.authorInitials}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[11px] font-medium text-[#05040D]">
              {test.authorName}
            </span>
            <span className="text-[10px] text-[#6B7280]">
              {t('pages.training.tests.deadline', 'Deadline')}: {test.deadlineLabel}
            </span>
          </div>
          <span
            className={`text-xs font-semibold ${
              test.status === 'passed'
                ? 'text-[#15803D]'
                : test.status === 'failed'
                  ? 'text-[#B91C1C]'
                  : 'text-[#6B7280]'
            }`}
          >
            {test.scoreLabel}
          </span>
        </div>

        <button
          type="button"
          className={`rounded-md px-3 py-2 text-[11px] font-medium ${
            test.status === 'failed'
              ? 'bg-[#204E4D] text-white'
              : 'border border-[#EDEDED] bg-white text-[#05040D]'
          }`}
        >
          {test.status === 'passed'
            ? t('pages.training.tests.viewResults', 'View results')
            : test.status === 'failed'
              ? t('pages.training.tests.retake', 'Retake')
              : t('pages.training.tests.start', 'Start')}
        </button>
      </div>
    </div>
  )
}

export default TestsTab
