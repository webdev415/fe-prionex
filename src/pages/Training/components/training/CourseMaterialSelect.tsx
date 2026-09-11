import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/Input'
import { useMaterials } from '@/features/training/hooks/useMaterials'
import { materialSubtitle } from '@/features/training/types/materials'

/**
 * Pick course materials from the library (KAN-1049).
 *
 * A *selection* control, not an attach control: the create form has no course
 * id until the course exists, so it collects ids and the caller attaches them
 * afterwards. `AttachMaterialPicker` covers the other case — attaching to a
 * target that already exists — and attaches on click.
 *
 * This replaces typing a material's name into the course form. That list
 * belonged to one course and could not be reused anywhere, which is the
 * duplication the library exists to remove.
 */
export interface CourseMaterialSelectProps {
  selectedIds: number[]
  onChange: (ids: number[]) => void
}

export function CourseMaterialSelect({ selectedIds, onChange }: CourseMaterialSelectProps) {
  const { t } = useTranslation('common')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  const filters = useMemo(() => ({ q: debounced || undefined, limit: 30, offset: 0 }), [debounced])
  const { data, isLoading, isError } = useMaterials(filters)
  const materials = data?.data ?? []

  const toggle = (id: number) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id])

  return (
    <div className="flex flex-col gap-2">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('pages.training.training.courses.searchMaterials', 'Search the library…')}
      />
      <div className="max-h-[200px] overflow-y-auto rounded-lg border border-[#EBECE8]">
        {isLoading ? (
          <p className="px-3 py-3 text-center text-[11px] text-[#9CA3AF]">
            {t('common.loading', 'Loading…')}
          </p>
        ) : isError ? (
          <p className="px-3 py-3 text-center text-[11px] text-[#B91C1C]">
            {t('pages.training.training.materials.errors.list', 'Could not load the library.')}
          </p>
        ) : materials.length === 0 ? (
          /* Says what to do next: the library is where materials come from now,
             so an empty one is a dead end unless we point at it. */
          <p className="px-3 py-3 text-center text-[11px] text-[#9CA3AF]">
            {t(
              'pages.training.training.courses.noMaterialsInLibrary',
              'Nothing in the library yet — add a file or a link on the Materials tab first.'
            )}
          </p>
        ) : (
          <ul className="py-1">
            {materials.map((m) => {
              const checked = selectedIds.includes(m.id)
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggle(m.id)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[#F7F7F7]"
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                        checked ? 'border-[#204E4D] bg-[#204E4D]' : 'border-[#DFDFDF] bg-white'
                      }`}
                    />
                    <span className="truncate text-xs text-[#05040D]">{m.title}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-[#6B7280]">
                      {materialSubtitle(m)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
