import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import type { MockCourse } from '../../mocks/trainerWorkplaceMocks'
import { MOCK_COURSES } from '../../mocks/trainerWorkplaceMocks'
import { PendingFeatureDialog } from '../inbox/PendingFeatureDialog'
import { CourseCard } from './CourseCard'
import { TrainingFilterChips, TrainingPrimaryButton, TrainingSearchBar } from './TrainingToolbar'

const CATEGORY_CHIPS = [
  { id: 'all', label: 'All categories' },
  { id: 'Hard Collection', label: 'Hard Collection' },
  { id: 'Soft Skills', label: 'Soft Skills' },
  { id: 'Tone', label: 'Tone' },
  { id: 'Analytics', label: 'Analytics' },
  { id: 'Compliance', label: 'Compliance' },
]

type DialogKind = 'add' | 'details' | 'assign' | null

export function CoursesCatalogTab() {
  const { t } = useTranslation('common')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [selectedCourse, setSelectedCourse] = useState<MockCourse | null>(null)

  const filtered = MOCK_COURSES.filter((c) => {
    const matchesQuery = !query || c.title.toLowerCase().includes(query.toLowerCase())
    const matchesCategory = category === 'all' || c.category === category
    return matchesQuery && matchesCategory
  })

  const openDetails = (course: MockCourse) => {
    setSelectedCourse(course)
    setDialog('details')
  }

  const openAssign = (course: MockCourse) => {
    setSelectedCourse(course)
    setDialog('assign')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#05040D]">
          {t('pages.training.training.courses.title', 'Course catalog')}
        </h2>
        <TrainingPrimaryButton
          onClick={() => setDialog('add')}
          leftIcon={<Icons.Add size={14} className="text-white" />}
        >
          {t('pages.training.training.courses.addCourse', 'Add a course')}
        </TrainingPrimaryButton>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <TrainingSearchBar
          value={query}
          onChange={setQuery}
          placeholder={t('pages.training.training.courses.searchPlaceholder', 'Search...')}
        />
        <TrainingFilterChips items={CATEGORY_CHIPS} activeId={category} onChange={setCategory} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            onDetails={openDetails}
            onAssign={openAssign}
          />
        ))}
      </div>

      <PendingFeatureDialog
        open={dialog === 'add'}
        onClose={() => setDialog(null)}
        titleKey="pages.training.training.courses.addCourse"
        titleFallback="Add a course"
        descriptionKey="pages.training.training.pending.addCourse"
        descriptionFallback="Create a new course with modules, materials, and assignment rules."
        dependsOnIssue="KAN-416"
      />

      <PendingFeatureDialog
        open={dialog === 'details'}
        onClose={() => {
          setDialog(null)
          setSelectedCourse(null)
        }}
        titleKey="pages.training.training.courses.details"
        titleFallback="Course details"
        descriptionKey="pages.training.training.pending.courseDetails"
        descriptionFallback="Open the full course outline, modules, and enrollment stats."
        dependsOnIssue="KAN-416"
        operatorName={selectedCourse?.title}
      />

      <PendingFeatureDialog
        open={dialog === 'assign'}
        onClose={() => {
          setDialog(null)
          setSelectedCourse(null)
        }}
        titleKey="pages.training.training.courses.assign"
        titleFallback="Assign course"
        descriptionKey="pages.training.training.pending.assignCourse"
        descriptionFallback="Assign this course to operators or teams with a deadline."
        dependsOnIssue="KAN-416"
        operatorName={selectedCourse?.title}
      />
    </div>
  )
}

export default CoursesCatalogTab
