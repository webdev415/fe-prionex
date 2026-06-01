import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { MOCK_TESTS, type MockTest, type TestStatus } from '../../mocks/trainerWorkplaceMocks'

/**
 * Tests sub-tab — Figma step 5. Card grid of post-course tests with pass /
 * fail status and per-card retake CTA.
 */
const STATUS_TONE: Record<TestStatus, { label: string; tone: string }> = {
  passed: { label: 'Passed', tone: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'Failed', tone: 'bg-red-100 text-red-700' },
  in_progress: { label: 'In progress', tone: 'bg-amber-100 text-amber-700' },
  not_started: { label: 'Not started', tone: 'bg-gray-100 text-gray-600' },
}

const FILTERS: { id: TestStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All tests' },
  { id: 'passed', label: 'Passed' },
  { id: 'failed', label: 'Failed' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'not_started', label: 'Not started' },
]

export function TestsTab() {
  const { t } = useTranslation('common')
  const [filter, setFilter] = useState<TestStatus | 'all'>('all')

  const filtered = filter === 'all' ? MOCK_TESTS : MOCK_TESTS.filter((tt) => tt.status === filter)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-dark-500 text-base font-semibold">
          {t('pages.training.tests.title', 'Tests')}
        </h2>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Icons.Add size={14} className="text-white" />}
          className="h-[40px] rounded-full px-4 text-xs"
        >
          {t('pages.training.tests.create', 'Create a test')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const isActive = f.id === filter
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'bg-primary-500 border-primary-500 text-white'
                  : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((tt) => (
          <TestCard key={tt.id} test={tt} />
        ))}
      </div>
    </div>
  )
}

function TestCard({ test }: { test: MockTest }) {
  const { t } = useTranslation('common')
  const status = STATUS_TONE[test.status]

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="relative h-[70px] w-full" style={{ background: test.coverGradient }}>
        <span
          className={`absolute top-3 right-3 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${status.tone}`}
        >
          {status.label}
        </span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col">
          <h3 className="text-dark-500 text-sm font-semibold">{test.title}</h3>
          <span className="text-[11px] text-gray-500">
            {t('pages.training.tests.course', 'Course')}: {test.course}
          </span>
          <span className="text-[11px] text-gray-400">{test.category}</span>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-gray-50/60 px-3 py-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-gray-700"
            style={{ backgroundColor: test.authorAvatar }}
          >
            {test.authorInitials}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-dark-500 truncate text-[11px] font-medium">
              {test.authorName}
            </span>
            <span className="text-[10px] text-gray-500">
              {t('pages.training.tests.deadline', 'Deadline')}: {test.deadlineLabel}
            </span>
          </div>
          <span
            className={`text-xs font-semibold ${
              test.status === 'passed'
                ? 'text-emerald-600'
                : test.status === 'failed'
                  ? 'text-red-600'
                  : 'text-gray-500'
            }`}
          >
            {test.scoreLabel}
          </span>
        </div>

        <Button
          variant={test.status === 'failed' ? 'primary' : 'secondary'}
          size="sm"
          className="rounded-full text-[11px]"
          leftIcon={
            test.status === 'passed' ? (
              <Icons.View size={12} />
            ) : (
              <Icons.Play size={12} className={test.status === 'failed' ? 'text-white' : ''} />
            )
          }
        >
          {test.status === 'passed'
            ? t('pages.training.tests.viewResults', 'View results')
            : test.status === 'failed'
              ? t('pages.training.tests.retake', 'Retake')
              : t('pages.training.tests.start', 'Start')}
        </Button>
      </div>
    </div>
  )
}

export default TestsTab
