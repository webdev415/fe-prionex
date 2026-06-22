import { useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useHasPermission } from '@/hooks'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import {
  useArchiveCourse,
  useCourses,
  useCreateCourse,
  useEnrollCourse,
  useUpdateCourse,
} from '@/features/training/hooks/useCourses'
import { exportCourses } from '@/features/training/api/coursesService'
import type {
  CourseCardData,
  CourseLevel,
  CourseStatus,
  MaterialType,
} from '@/features/training/types/courses'
import { TrainingFilterChips, TrainingPrimaryButton, TrainingSearchBar } from './TrainingToolbar'

const STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'published', label: 'Published' },
  { id: 'archived', label: 'Archived' },
]

const CATEGORY_OPTIONS = [
  'Scripts',
  'Hard Collection',
  'Soft Skills',
  'Tone',
  'Analytics',
  'Compliance',
  'Product',
  'Tools',
]

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
const MATERIAL_TYPES: MaterialType[] = ['pdf', 'docx', 'video', 'audio', 'link']

function formatDuration(minutes?: number | null): string {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function CoursesCatalogTab() {
  const { t } = useTranslation('common')
  const canManage = useHasPermission('manage_courses')
  const [query, setQuery] = useState('')
  const [statusChip, setStatusChip] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [assignCourse, setAssignCourse] = useState<CourseCardData | null>(null)

  const filters = useMemo(
    () => ({
      q: query || undefined,
      status: statusChip === 'all' ? undefined : (statusChip as CourseStatus),
    }),
    [query, statusChip]
  )
  const { data, isLoading, isError } = useCourses(filters)
  const courses = data?.data ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#05040D]">
          {t('pages.training.training.courses.title', 'Course Catalog')}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportCourses(filters).then((b) => triggerDownload(b, 'courses.xlsx'))}
            className="inline-flex items-center gap-1 rounded-md border border-[#EDEDED] bg-white px-3 py-2 text-xs font-medium text-[#05040D] hover:bg-[#F7F7F7]"
          >
            {t('common.export', 'Export')}
          </button>
          {canManage ? (
            <TrainingPrimaryButton
              onClick={() => setCreateOpen(true)}
              leftIcon={<Icons.Add size={14} className="text-white" />}
            >
              {t('pages.training.training.courses.addCourse', 'Create a Course')}
            </TrainingPrimaryButton>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <TrainingSearchBar
          value={query}
          onChange={setQuery}
          placeholder={t('pages.training.training.courses.searchPlaceholder', 'Search...')}
        />
        <TrainingFilterChips items={STATUS_CHIPS} activeId={statusChip} onChange={setStatusChip} />
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-xs text-[#676767]">{t('common.loading', 'Loading…')}</p>
      ) : isError ? (
        <p className="py-8 text-center text-xs text-[#EF4444]">
          {t('pages.training.training.courses.loadFailed', 'Failed to load courses.')}
        </p>
      ) : courses.length === 0 ? (
        <p className="py-8 text-center text-xs text-[#676767]">
          {t('pages.training.training.courses.empty', 'No courses yet.')}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              canManage={canManage}
              onAssign={() => setAssignCourse(course)}
            />
          ))}
        </div>
      )}

      {createOpen ? <CreateCoursePanel onClose={() => setCreateOpen(false)} /> : null}
      {assignCourse ? (
        <AssignCourseDialog course={assignCourse} onClose={() => setAssignCourse(null)} />
      ) : null}
    </div>
  )
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

function CourseCard({
  course,
  canManage,
  onAssign,
}: {
  course: CourseCardData
  canManage: boolean
  onAssign: () => void
}) {
  const { t } = useTranslation('common')
  const updateCourse = useUpdateCourse()
  const archiveCourse = useArchiveCourse()
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
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-semibold text-[#05040D]">{course.title}</h3>
            {course.status !== 'published' ? (
              <span className="rounded-full bg-[#FEF9C3] px-2 py-0.5 text-[10px] font-medium text-[#A16207] capitalize">
                {course.status}
              </span>
            ) : null}
          </div>
          {course.author_name || course.category ? (
            <p className="text-xs text-[#4B5563]">
              {course.author_name
                ? `${t('pages.training.training.courses.author', 'Author')}: ${course.author_name}`
                : ''}
              {course.author_name && course.category ? ' · ' : ''}
              {course.category ?? ''}
            </p>
          ) : null}
        </div>

        <div className="flex gap-2">
          <StatTile
            icon={Icons.Clock01}
            label={t('pages.training.training.courses.duration', 'Duration')}
            value={formatDuration(course.duration_minutes)}
          />
          <StatTile
            icon={Icons.File}
            label={t('pages.training.training.courses.modules', 'Modules')}
            value={course.lesson_count}
          />
          <StatTile
            icon={Icons.Users}
            label={t('pages.training.training.courses.students', 'Students')}
            value={course.enrolled_count}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[#4B5563]">
              {t('pages.training.training.courses.avgCompletion', 'Average Performance')}
            </span>
            <span className="font-bold text-[#05040D]">{course.avg_completion_pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#EBECE8]">
            <div
              className="h-full rounded-full bg-[#EAB308]"
              style={{ width: `${course.avg_completion_pct}%` }}
            />
          </div>
        </div>

        <div className="flex gap-3">
          {canManage && course.status === 'draft' ? (
            <button
              type="button"
              onClick={() =>
                updateCourse.mutate({ id: course.id, payload: { status: 'published' } })
              }
              className="flex flex-1 items-center justify-center rounded-md border border-[#EDEDED] bg-white px-3 py-2.5 text-xs font-medium text-[#05040D] transition-colors hover:bg-[#F7F7F7]"
            >
              {t('pages.training.training.courses.publish', 'Publish')}
            </button>
          ) : canManage && course.status !== 'archived' ? (
            <button
              type="button"
              onClick={() => archiveCourse.mutate(course.id)}
              className="flex flex-1 items-center justify-center rounded-md border border-[#EDEDED] bg-white px-3 py-2.5 text-xs font-medium text-[#05040D] transition-colors hover:bg-[#F7F7F7]"
            >
              {t('common.archive', 'Archive')}
            </button>
          ) : (
            <span className="flex-1" />
          )}
          <button
            type="button"
            onClick={onAssign}
            disabled={!canManage}
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-[#204E4D] px-3 py-2.5 text-xs font-medium text-white transition-colors hover:bg-[#1a3f3e] disabled:opacity-50"
          >
            <Icons.Users size={14} className="text-white" />
            {t('pages.training.training.courses.assign', 'Assign')}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ModuleDraft {
  title: string
}
interface MaterialDraft {
  type: MaterialType
  name: string
}

function CreateCoursePanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('common')
  const createCourse = useCreateCourse()
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const projectIdNum = activeProjectId ? Number(activeProjectId) : null
  const { data: operators = [] } = useOperators(projectIdNum)

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0])
  const [level, setLevel] = useState<CourseLevel>('beginner')
  const [author, setAuthor] = useState('')
  const [duration, setDuration] = useState('')
  const [description, setDescription] = useState('')
  const [modules, setModules] = useState<ModuleDraft[]>([])
  const [materials, setMaterials] = useState<MaterialDraft[]>([])

  const submit = () => {
    if (!title.trim()) return
    createCourse.mutate(
      {
        title: title.trim(),
        category,
        level,
        author_name: author.trim() || null,
        duration_minutes: duration ? Number(duration) : null,
        description: description.trim() || null,
        status: 'draft',
        lessons: modules
          .filter((m) => m.title.trim())
          .map((m, i) => ({ ordinal: i, title: m.title.trim(), content_type: 'text' as const })),
        materials: materials
          .filter((m) => m.name.trim())
          .map((m) => ({ type: m.type, name: m.name.trim() })),
      },
      { onSuccess: onClose }
    )
  }

  const field =
    'h-9 rounded-lg border border-[#EBECE8] px-3 text-xs text-[#05040D] focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
      <div className="flex h-full w-full max-w-[480px] flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#EBECE8] px-5 py-4">
          <h3 className="text-base font-semibold text-[#05040D]">
            {t('pages.training.training.courses.addCourse', 'Create a Course')}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close">
            <Icons.Close size={18} className="text-[#676767]" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#05040D]">
              {t('pages.training.training.courses.fieldName', 'Course name')}
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t(
                'pages.training.training.courses.fieldNamePlaceholder',
                'Working with objections: basic'
              )}
              className={field}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#05040D]">
                {t('pages.training.training.courses.fieldCategory', 'Category')}
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={field}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#05040D]">
                {t('pages.training.training.courses.fieldLevel', 'Level')}
              </span>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as CourseLevel)}
                className={field}
              >
                {(['beginner', 'intermediate', 'advanced'] as CourseLevel[]).map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_LABEL[l]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#05040D]">
                {t('pages.training.training.courses.fieldAuthor', 'Author')}
              </span>
              <select value={author} onChange={(e) => setAuthor(e.target.value)} className={field}>
                <option value="">{t('common.none', '—')}</option>
                {operators.map((op) => (
                  <option key={op.id} value={op.full_name}>
                    {op.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[#05040D]">
                {t('pages.training.training.courses.fieldDuration', 'Duration (min)')}
              </span>
              <input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                type="number"
                placeholder="45"
                className={field}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[#05040D]">
              {t('pages.training.training.courses.fieldDescription', 'Description')}
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={t(
                'pages.training.training.courses.fieldDescriptionPlaceholder',
                'A course for operators who are just starting to work with objections'
              )}
              className="rounded-lg border border-[#EBECE8] px-3 py-2 text-xs text-[#05040D] focus:outline-none"
            />
          </label>

          {/* Modules */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#05040D]">
                {t('pages.training.training.courses.modules', 'Modules')}
              </span>
              <button
                type="button"
                onClick={() => setModules((m) => [...m, { title: '' }])}
                className="inline-flex items-center gap-1 rounded-md bg-[#204E4D] px-2.5 py-1 text-[11px] font-medium text-white"
              >
                <Icons.Add size={12} className="text-white" />
                {t('common.add', 'Add')}
              </button>
            </div>
            {modules.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-4 text-center text-[11px] text-[#9CA3AF]">{i + 1}</span>
                <input
                  value={m.title}
                  onChange={(e) =>
                    setModules((arr) =>
                      arr.map((x, j) => (j === i ? { title: e.target.value } : x))
                    )
                  }
                  placeholder={t('pages.training.training.courses.moduleName', 'Module name')}
                  className={`flex-1 ${field}`}
                />
                <button
                  type="button"
                  onClick={() => setModules((arr) => arr.filter((_, j) => j !== i))}
                  aria-label="Remove module"
                >
                  <Icons.Close size={14} className="text-[#9CA3AF]" />
                </button>
              </div>
            ))}
          </div>

          {/* Materials */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#05040D]">
                {t('pages.training.training.courses.materials', 'Materials')}
              </span>
              <button
                type="button"
                onClick={() => setMaterials((m) => [...m, { type: 'pdf', name: '' }])}
                className="inline-flex items-center gap-1 rounded-md bg-[#204E4D] px-2.5 py-1 text-[11px] font-medium text-white"
              >
                <Icons.Add size={12} className="text-white" />
                {t('common.add', 'Add')}
              </button>
            </div>
            {materials.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={m.type}
                  onChange={(e) =>
                    setMaterials((arr) =>
                      arr.map((x, j) =>
                        j === i ? { ...x, type: e.target.value as MaterialType } : x
                      )
                    )
                  }
                  className={`w-24 ${field} uppercase`}
                >
                  {MATERIAL_TYPES.map((mt) => (
                    <option key={mt} value={mt}>
                      {mt.toUpperCase()}
                    </option>
                  ))}
                </select>
                <input
                  value={m.name}
                  onChange={(e) =>
                    setMaterials((arr) =>
                      arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))
                    )
                  }
                  placeholder={t('pages.training.training.courses.materialName', 'Material name')}
                  className={`flex-1 ${field}`}
                />
                <button
                  type="button"
                  onClick={() => setMaterials((arr) => arr.filter((_, j) => j !== i))}
                  aria-label="Remove material"
                >
                  <Icons.Close size={14} className="text-[#9CA3AF]" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#EBECE8] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#EDEDED] bg-white px-4 py-2 text-xs font-medium text-[#05040D] hover:bg-[#F7F7F7]"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim() || createCourse.isPending}
            className="rounded-md bg-[#BBFB5B] px-4 py-2 text-xs font-semibold text-[#05040D] hover:bg-[#a9e94f] disabled:opacity-50"
          >
            {t('pages.training.training.courses.createCta', 'Create a course')}
          </button>
        </div>
      </div>
    </div>
  )
}

function AssignCourseDialog({ course, onClose }: { course: CourseCardData; onClose: () => void }) {
  const { t } = useTranslation('common')
  const enroll = useEnrollCourse()
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const projectIdNum = activeProjectId ? Number(activeProjectId) : null
  const { data: operators = [] } = useOperators(projectIdNum)
  const [selected, setSelected] = useState<number[]>([])

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const submit = () => {
    if (selected.length === 0) return
    enroll.mutate({ courseId: course.id, operatorIds: selected }, { onSuccess: onClose })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl bg-white p-5 shadow-xl">
        <h3 className="mb-1 text-sm font-semibold text-[#05040D]">
          {t('pages.training.training.courses.assign', 'Assign')}: {course.title}
        </h3>
        <p className="mb-3 text-[11px] text-[#676767]">
          {t('pages.training.training.courses.assignHint', 'Select operators to enroll.')}
        </p>
        <div className="flex-1 overflow-y-auto rounded-lg border border-[#EBECE8]">
          {operators.map((op) => (
            <label
              key={op.id}
              className="flex cursor-pointer items-center gap-2 border-b border-[#F3F4F6] px-3 py-2 text-xs last:border-b-0 hover:bg-[#FAFAFA]"
            >
              <input
                type="checkbox"
                checked={selected.includes(op.id)}
                onChange={() => toggle(op.id)}
              />
              <span className="text-[#05040D]">{op.full_name}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#EDEDED] bg-white px-3 py-2 text-xs font-medium text-[#05040D] hover:bg-[#F7F7F7]"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={selected.length === 0 || enroll.isPending}
            className="rounded-md bg-[#204E4D] px-3 py-2 text-xs font-medium text-white hover:bg-[#1a3f3e] disabled:opacity-50"
          >
            {t('pages.training.training.courses.assignCta', 'Assign')} ({selected.length})
          </button>
        </div>
      </div>
    </div>
  )
}

export default CoursesCatalogTab
