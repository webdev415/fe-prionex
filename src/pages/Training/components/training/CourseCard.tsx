import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import type { CourseLevel, MockCourse } from '../../mocks/trainerWorkplaceMocks'

export interface CourseCardProps {
  course: MockCourse
  onDetails?: (course: MockCourse) => void
  onAssign?: (course: MockCourse) => void
}

const LEVEL_LABEL: Record<CourseLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

const LEVEL_STARS: Record<CourseLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: (props: { size?: number; className?: string }) => ReactElement
  label: string
  value: string | number
}) {
  return (
    <div className="flex flex-1 flex-col gap-2 rounded-lg bg-[#F7F7F7] p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0px_1px_6px_rgba(0,0,0,0.05)]">
        <Icon size={18} className="text-[#204E4D]" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-light tracking-[-0.02em] text-[#4B5563]">{label}</span>
        <span className="text-base font-semibold text-[#05040D]">{value}</span>
      </div>
    </div>
  )
}

/** Figma `Card Course` — teal shell, gradient header, white body, stat tiles, amber progress. */
export function CourseCard({ course, onDetails, onAssign }: CourseCardProps) {
  const { t } = useTranslation('common')
  const filledStars = LEVEL_STARS[course.level]

  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-[#E3F6F3]">
      <div className="relative flex h-24 items-start justify-between px-4 py-5">
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#F3FAF9] via-white to-[#D5F2ED]/50"
          aria-hidden
        />
        <div className="relative z-[2] flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0px_1px_6px_rgba(0,0,0,0.05)]">
          <Icons.File size={22} className="text-[#7ACEC5]" />
        </div>
        <div className="relative z-[2] flex flex-col items-end gap-1">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#204E4D]">
            {LEVEL_LABEL[course.level]}
          </span>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3].map((n) => (
              <span
                key={n}
                className={`h-2 w-2 rounded-sm ${n <= filledStars ? 'bg-[#204E4D]' : 'bg-[#DFDFDF]'}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 rounded-t-xl bg-white p-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-[#05040D]">{course.title}</h3>
          <p className="text-xs text-[#4B5563]">
            {t('pages.training.training.courses.author', 'Author')}: {course.author} ·{' '}
            {course.category}
          </p>
        </div>

        <div className="flex gap-2">
          <StatTile
            icon={Icons.Clock01}
            label={t('pages.training.training.courses.duration', 'Duration')}
            value={formatDuration(course.durationMinutes)}
          />
          <StatTile
            icon={Icons.File}
            label={t('pages.training.training.courses.modules', 'Modules')}
            value={course.moduleCount}
          />
          <StatTile
            icon={Icons.Users}
            label={t('pages.training.training.courses.enrolled', 'Enrolled')}
            value={course.enrolledCount}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[#4B5563]">
              {t('pages.training.training.courses.avgCompletion', 'Average completion')}
            </span>
            <span className="font-bold text-[#05040D]">{course.avgCompletionPct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#EBECE8]">
            <div
              className="h-full rounded-full bg-[#EAB308]"
              style={{ width: `${course.avgCompletionPct}%` }}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onDetails?.(course)}
            className="flex flex-1 items-center justify-center rounded-md border border-[#EDEDED] bg-white px-3 py-2.5 text-xs font-medium text-[#05040D] transition-colors hover:bg-[#F7F7F7]"
          >
            {t('pages.training.training.courses.details', 'Details')}
          </button>
          <button
            type="button"
            onClick={() => onAssign?.(course)}
            className="flex flex-1 items-center justify-center rounded-md bg-[#204E4D] px-3 py-2.5 text-xs font-medium text-white transition-colors hover:bg-[#1a3f3e]"
          >
            {t('pages.training.training.courses.assign', 'Assign')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CourseCard
