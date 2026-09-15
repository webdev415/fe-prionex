import { useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
import { useHasPermission } from '@/hooks'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import {
  useArchiveCourse,
  useCourse,
  useCourses,
  useCreateCourse,
  useEnrollCourse,
  useUpdateCourse,
} from '@/features/training/hooks/useCourses'
import type { CourseCardData, CourseLevel } from '@/features/training/types/courses'
import { safeHttpUrl } from '@/lib/safeUrl'
import {
  useAttachMaterial,
  useDetachMaterial,
  useMaterialsForTarget,
} from '@/features/training/hooks/useMaterials'
import { CourseMaterialSelect } from './CourseMaterialSelect'
import { EmployeeSearchList } from '../dialogue/EmployeeMultiSelect'
import { TrainingPrimaryButton, TrainingSearchBar } from './TrainingToolbar'

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

type TFn = (key: string, fallback: string) => string

/** Deterministic i18n-key segment for a display category ("Soft Skills" → "soft_skills"). */
function categorySlug(category: string): string {
  return category.toLowerCase().replace(/\s+/g, '_')
}
/** Localized category label; the raw category value stays the BE contract. */
function categoryLabel(t: TFn, category: string): string {
  return t(`pages.training.training.catalog.categories.${categorySlug(category)}`, category)
}

const LEVEL_EN: Record<CourseLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}
function levelLabel(t: TFn, level: CourseLevel): string {
  return t(`pages.training.training.courses.level.${level}`, LEVEL_EN[level])
}
const LEVEL_STARS: Record<CourseLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
}

function formatDuration(t: TFn, minutes?: number | null): string {
  if (!minutes) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const hu = t('common.hours', 'h')
  const mu = t('common.minutes', 'min')
  if (h === 0) return `${m} ${mu}`
  if (m === 0) return `${h}${hu}`
  return `${h}${hu} ${m}${mu}`
}

export function CoursesCatalogTab() {
  const { t } = useTranslation('common')
  const canManage = useHasPermission('manage_courses')
  const [createOpen, setCreateOpen] = useState(false)
  const [assignCourse, setAssignCourse] = useState<CourseCardData | null>(null)
  const [detailsCourse, setDetailsCourse] = useState<CourseCardData | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')

  const filters = useMemo(
    () => ({ q: query || undefined, category: category || undefined }),
    [query, category]
  )
  const { data, isLoading, isError } = useCourses(filters)
  const courses = data?.data ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#05040D]">
          {t('pages.training.training.courses.title', 'Course Catalog')}
        </h2>
        {canManage ? (
          <TrainingPrimaryButton
            onClick={() => setCreateOpen(true)}
            leftIcon={<Icons.Add size={14} className="text-white" />}
          >
            {t('pages.training.training.courses.addCourse', 'Add Course')}
          </TrainingPrimaryButton>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <TrainingSearchBar
          value={query}
          onChange={setQuery}
          placeholder={t('pages.training.training.courses.searchPlaceholder', 'Search by title…')}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-lg border border-[#DFDFDF] bg-white px-3 text-xs text-[#05040D] focus:outline-none"
        >
          <option value="">
            {t('pages.training.training.courses.allCategories', 'All categories')}
          </option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {categoryLabel(t, c)}
            </option>
          ))}
        </select>
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
              onDetails={() => setDetailsCourse(course)}
            />
          ))}
        </div>
      )}

      {createOpen ? <CreateCoursePanel onClose={() => setCreateOpen(false)} /> : null}
      {assignCourse ? (
        <AssignCourseDialog course={assignCourse} onClose={() => setAssignCourse(null)} />
      ) : null}
      {detailsCourse ? (
        <CourseDetailsDialog
          course={detailsCourse}
          canManage={canManage}
          onClose={() => setDetailsCourse(null)}
        />
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
  onDetails,
}: {
  course: CourseCardData
  canManage: boolean
  onAssign: () => void
  onDetails: () => void
}) {
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
            {levelLabel(t, course.level)}
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
              <span className="rounded-full bg-[#FEF9C3] px-2 py-0.5 text-[10px] font-medium text-[#A16207]">
                {t(`pages.training.training.courses.status.${course.status}`, course.status)}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-[#4B5563]">
              {t('pages.training.training.courses.author', 'Author')}:{' '}
              {course.author_name ?? t('pages.training.training.courses.noAuthor', 'No author')}
            </p>
            {course.category ? (
              <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-medium text-[#374151]">
                {course.category}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex gap-2">
          <StatTile
            icon={Icons.Clock01}
            label={t('pages.training.training.courses.duration', 'Duration')}
            value={formatDuration(t, course.duration_minutes)}
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
          <button
            type="button"
            onClick={onDetails}
            className="flex flex-1 items-center justify-center rounded-md border border-[#EDEDED] bg-white px-3 py-2.5 text-xs font-medium text-[#05040D] transition-colors hover:bg-[#F7F7F7]"
          >
            {t('pages.training.training.courses.details', 'Details')}
          </button>
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
function CreateCoursePanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('common')
  const createCourse = useCreateCourse()
  const attachMaterial = useAttachMaterial()
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
  const [materialIds, setMaterialIds] = useState<number[]>([])
  // createCourse.isPending goes false the moment the course exists — the attach
  // round-trips are still in flight after that, and a second click there makes a
  // duplicate course. This covers the whole submission, not just the mutation.
  const [submitting, setSubmitting] = useState(false)

  const submit = () => {
    if (!title.trim() || submitting) return
    setSubmitting(true)
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
      },
      {
        onSuccess: async (created) => {
          // The course has no id until it exists, so the picked materials are
          // attached here rather than sent with the payload. allSettled, not a
          // loop that throws: one failure must not skip the materials after it.
          const results = await Promise.allSettled(
            materialIds.map((materialId) =>
              attachMaterial.mutateAsync({
                materialId,
                targetType: 'course',
                targetId: created.id,
              })
            )
          )
          const failed = results.filter((r) => r.status === 'rejected').length
          if (failed > 0) {
            // Says how many, because the rest did attach and the trainer can
            // add the missing ones from the course itself.
            toast.error(
              t('pages.training.training.courses.attachFailed', {
                defaultValue:
                  '{{count}} material(s) could not be attached. Add them from the course.',
                count: failed,
              })
            )
          }
          setSubmitting(false)
          onClose()
        },
        onError: () => {
          setSubmitting(false)
          toast.error(
            t('pages.training.training.courses.createFailed', 'Could not create the course.')
          )
        },
      }
    )
  }

  const field =
    'h-9 rounded-lg border border-[#EBECE8] px-3 text-xs text-[#05040D] focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#EBECE8] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#BBFB5B]">
              <Icons.File size={18} className="text-[#05040D]" />
            </span>
            <h3 className="text-xl font-semibold text-[#05040D]">
              {t('pages.training.training.courses.addCourse', 'Create a Course')}
            </h3>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close', 'Close')}>
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
                    {categoryLabel(t, c)}
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
                    {levelLabel(t, l)}
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
                  aria-label={t('pages.training.training.courses.removeModule', 'Remove module')}
                >
                  <Icons.Close size={14} className="text-[#9CA3AF]" />
                </button>
              </div>
            ))}
          </div>

          {/* Materials — picked from the library (KAN-1049). Typing a name in
              place is gone: that list belonged to one course and could be reused
              nowhere, which is what the library replaces. */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-[#05040D]">
              {t('pages.training.training.courses.materials', 'Materials')}
            </span>
            <CourseMaterialSelect selectedIds={materialIds} onChange={setMaterialIds} />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#EBECE8] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-[#9CA3AF] px-5 py-2 text-xs font-medium text-white hover:bg-[#8b909c]"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim() || submitting}
            className="rounded-md bg-[#BBFB5B] px-4 py-2 text-xs font-semibold text-[#05040D] hover:bg-[#a9e94f] disabled:opacity-50"
          >
            {t('pages.training.training.courses.createCta', 'Create a course')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function CourseDetailsDialog({
  course,
  canManage,
  onClose,
}: {
  course: CourseCardData
  canManage: boolean
  onClose: () => void
}) {
  const { t } = useTranslation('common')
  const { data: full } = useCourse(course.id)
  const updateCourse = useUpdateCourse()
  const attachMaterial = useAttachMaterial()
  const detachMaterial = useDetachMaterial()
  const [addingMaterials, setAddingMaterials] = useState(false)
  const archiveCourse = useArchiveCourse()
  const detail = full ?? course
  const lessons = detail.lessons ?? []
  // Attachments, not `detail.materials`: the course's own list is legacy and
  // migration 047 moved its contents into the library. It is still populated so
  // that migration stays reversible, so reading it here would show each
  // material twice once a trainer attaches anything new.
  //
  // DEPLOY ORDER: this needs api 047 applied first. Until it is, a course
  // created before the change shows no materials here.
  //
  // Falling back to `detail.materials` when this list is empty looks like the
  // fix and is not: on a migrated course whose materials a trainer has since
  // detached, the list is legitimately empty and the fallback would resurrect
  // every one of them, with no way to remove them again.
  const { data: attached, isFetching: attachedFetching } = useMaterialsForTarget(
    'course',
    course.id
  )
  const materials = attached?.data ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-[#EBECE8] px-5 py-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold text-[#05040D]">{detail.title}</h3>
            <p className="text-xs text-[#4B5563]">
              {detail.author_name
                ? `${t('pages.training.training.courses.author', 'Author')}: ${detail.author_name}`
                : ''}
              {detail.author_name && detail.category ? ' · ' : ''}
              {detail.category ?? ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#F0FDF4] px-2 py-0.5 text-[10px] font-medium text-[#15803D]">
              {t(`pages.training.training.courses.status.${detail.status}`, detail.status)}
            </span>
            <button type="button" onClick={onClose} aria-label={t('common.close', 'Close')}>
              <Icons.Close size={18} className="text-[#676767]" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <div className="flex gap-2">
            <StatTile
              icon={Icons.Clock01}
              label={t('pages.training.training.courses.duration', 'Duration')}
              value={formatDuration(t, detail.duration_minutes)}
            />
            <StatTile
              icon={Icons.File}
              label={t('pages.training.training.courses.modules', 'Modules')}
              value={detail.lesson_count}
            />
            <StatTile
              icon={Icons.Users}
              label={t('pages.training.training.courses.students', 'Students')}
              value={detail.enrolled_count}
            />
          </div>

          {detail.description ? (
            <p className="text-xs leading-relaxed text-[#4B5563]">{detail.description}</p>
          ) : null}

          {lessons.length > 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-[#05040D]">
                {t('pages.training.training.courses.modules', 'Modules')}
              </span>
              {lessons.map((l, i) => (
                <div
                  key={l.id}
                  className="flex items-center gap-2 rounded-lg bg-[#F7F7F7] px-3 py-2"
                >
                  <span className="w-4 text-center text-[11px] text-[#9CA3AF]">{i + 1}</span>
                  <span className="flex-1 truncate text-xs text-[#05040D]">{l.title}</span>
                </div>
              ))}
            </div>
          ) : null}

          {materials.length > 0 || canManage ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#05040D]">
                  {t('pages.training.training.courses.materials', 'Materials')}
                </span>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => setAddingMaterials((v) => !v)}
                    className="rounded-md border border-[#EDEDED] bg-white px-2.5 py-1 text-[11px] font-medium text-[#05040D] hover:bg-[#F7F7F7]"
                  >
                    {addingMaterials
                      ? t('pages.training.training.courses.doneAdding', 'Done')
                      : t('pages.training.training.courses.addMaterials', 'Add materials')}
                  </button>
                ) : null}
              </div>
              {/* Without this the only repair for a half-attached course is to
                  delete and recreate it: creation attaches, and nothing else did. */}
              {addingMaterials ? (
                <CourseMaterialSelect
                  selectedIds={materials.map((m) => m.id)}
                  // `selectedIds` comes from the server list, so a click is
                  // refused until that list is authoritative again — which is
                  // after the refetch, not after the mutation: isPending clears
                  // the moment the server answers, and in that window the box
                  // still looks unchecked and a second click repeats the attach.
                  disabled={
                    attachMaterial.isPending || detachMaterial.isPending || attachedFetching
                  }
                  onChange={(ids) => {
                    const current = new Set(materials.map((m) => m.id))
                    const next = new Set(ids)
                    // Failures are reported, not swallowed. Without this the
                    // checkbox just springs back and the trainer is told
                    // nothing — the silent shape this control was added to fix.
                    const onError = (key: 'attach' | 'detach') => () =>
                      toast.error(
                        key === 'attach'
                          ? t(
                              'pages.training.training.materials.errors.attach',
                              'Could not attach the material.'
                            )
                          : t(
                              'pages.training.training.materials.errors.detach',
                              'Could not detach the material.'
                            )
                      )
                    for (const id of next) {
                      if (!current.has(id)) {
                        attachMaterial.mutate(
                          { materialId: id, targetType: 'course', targetId: course.id },
                          { onError: onError('attach') }
                        )
                      }
                    }
                    for (const id of current) {
                      if (!next.has(id)) {
                        detachMaterial.mutate(
                          { materialId: id, targetType: 'course', targetId: course.id },
                          { onError: onError('detach') }
                        )
                      }
                    }
                  }}
                />
              ) : null}
              {materials.map((m) => {
                const href = m.kind === 'link' ? safeHttpUrl(m.url) : undefined
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 rounded-lg bg-[#F7F7F7] px-3 py-2"
                  >
                    <span className="rounded bg-white px-1.5 py-0.5 text-[9px] font-semibold text-[#204E4D] uppercase">
                      {m.type}
                    </span>
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 truncate text-xs font-medium text-[#204E4D] hover:underline"
                      >
                        {m.title}
                      </a>
                    ) : (
                      <span className="flex-1 truncate text-xs text-[#05040D]">{m.title}</span>
                    )}
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>

        {canManage ? (
          <div className="flex justify-end gap-2 border-t border-[#EBECE8] px-5 py-4">
            {detail.status === 'draft' ? (
              <button
                type="button"
                onClick={() =>
                  updateCourse.mutate(
                    { id: course.id, payload: { status: 'published' } },
                    { onSuccess: onClose }
                  )
                }
                disabled={updateCourse.isPending}
                className="rounded-md bg-[#204E4D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1a3f3e] disabled:opacity-50"
              >
                {t('pages.training.training.courses.publish', 'Publish')}
              </button>
            ) : null}
            {detail.status !== 'archived' ? (
              <button
                type="button"
                onClick={() => archiveCourse.mutate(course.id, { onSuccess: onClose })}
                disabled={archiveCourse.isPending}
                className="rounded-md border border-[#EDEDED] bg-white px-4 py-2 text-xs font-medium text-[#05040D] hover:bg-[#F7F7F7] disabled:opacity-50"
              >
                {t('common.archive', 'Archive')}
              </button>
            ) : null}
          </div>
        ) : null}
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
        <div className="min-h-0 flex-1 rounded-lg border border-[#EBECE8]">
          <EmployeeSearchList
            operators={operators}
            selectedIds={selected}
            onSelect={toggle}
            listClassName="max-h-[45vh]"
          />
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
