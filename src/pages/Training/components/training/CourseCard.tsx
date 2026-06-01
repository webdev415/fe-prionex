import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import type { MockCourse } from '../../mocks/trainerWorkplaceMocks'

/**
 * Course card â€” title, author, category, level, duration, module count,
 * enrolled count, avg completion. Used in the Courses Catalogue grid.
 */
export interface CourseCardProps {
  course: MockCourse
}

const STATUS_BADGE: Record<MockCourse['status'], { label: string; tone: string }> = {
  published: { label: 'Published', tone: 'bg-emerald-50 text-emerald-700' },
  draft: { label: 'Draft', tone: 'bg-amber-50 text-amber-700' },
  archived: { label: 'Archived', tone: 'bg-gray-100 text-gray-600' },
}

const LEVEL_LABEL: Record<MockCourse['level'], string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

export function CourseCard({ course }: CourseCardProps) {
  const { t } = useTranslation('common')
  const status = STATUS_BADGE[course.status]

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="relative h-[100px] w-full" style={{ background: course.coverGradient }}>
        <span
          className={`absolute top-3 right-3 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${status.tone}`}
        >
          {status.label}
        </span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col">
          <h3 className="text-dark-500 text-sm font-semibold">{course.title}</h3>
          <span className="text-[11px] text-gray-500">
            {t('pages.training.training.courses.author', 'Author')}: {course.author}
          </span>
          <span className="text-[11px] text-gray-400">
            {course.category} Â· {LEVEL_LABEL[course.level]}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <div className="flex flex-col items-center rounded-lg bg-gray-50 py-1.5">
            <span className="text-dark-500 text-xs font-semibold">
              {Math.floor(course.durationMinutes / 60)}h {course.durationMinutes % 60}m
            </span>
            <span className="text-[9px] text-gray-500 uppercase">
              {t('pages.training.training.courses.duration', 'Duration')}
            </span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-gray-50 py-1.5">
            <span className="text-dark-500 text-xs font-semibold">{course.moduleCount}</span>
            <span className="text-[9px] text-gray-500 uppercase">
              {t('pages.training.training.courses.modules', 'Modules')}
            </span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-gray-50 py-1.5">
            <span className="text-dark-500 text-xs font-semibold">{course.enrolledCount}</span>
            <span className="text-[9px] text-gray-500 uppercase">
              {t('pages.training.training.courses.enrolled', 'Enrolled')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div
              className="bg-primary-500 h-full rounded-full"
              style={{ width: `${course.avgCompletionPct}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-gray-600">{course.avgCompletionPct}%</span>
        </div>

        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 rounded-full text-[11px]"
            leftIcon={<Icons.View size={12} />}
          >
            {t('pages.training.training.courses.details', 'Details')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="flex-1 rounded-full text-[11px]"
            leftIcon={<Icons.Add size={12} className="text-white" />}
          >
            {t('pages.training.training.courses.assign', 'Assign')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default CourseCard
