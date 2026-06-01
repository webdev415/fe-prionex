import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/lib/icons'
import { MOCK_COURSES } from '../../mocks/trainerWorkplaceMocks'
import { CourseCard } from './CourseCard'

/**
 * Course Catalogue sub-tab (KAN-498). Search + category chips + "Add Course"
 * toolbar; card grid below.
 */
const CATEGORY_CHIPS = [
  'All categories',
  'Hard Collection',
  'Soft Skills',
  'Tone',
  'Analytics',
  'Compliance',
]

export function CoursesCatalogTab() {
  const { t } = useTranslation('common')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All categories')

  const filtered = MOCK_COURSES.filter((c) => {
    const matchesQuery = !query || c.title.toLowerCase().includes(query.toLowerCase())
    const matchesCategory = category === 'All categories' || c.category === category
    return matchesQuery && matchesCategory
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-dark-500 text-base font-semibold">
          {t('pages.training.training.courses.title', 'Course catalog')}
        </h2>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Icons.Add size={14} className="text-white" />}
          className="h-[40px] rounded-full px-4 text-xs"
        >
          {t('pages.training.training.courses.addCourse', 'Add a course')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Icons.Search
            size={14}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('pages.training.training.courses.searchPlaceholder', 'Search...')}
            className="h-[36px] w-[240px] rounded-full bg-white pl-9 text-xs"
          />
        </div>
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
        {filtered.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </div>
  )
}

export default CoursesCatalogTab
