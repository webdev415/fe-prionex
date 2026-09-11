/**
 * The tag filter inside the preset editor (#1100).
 *
 * Tags are the one row a plain multi-select cannot express: each tag is
 * neutral, included, or excluded, and the two groups are stored separately
 * (`tagIds` / `excludeTagIds`). The cycle itself is the client list's own pure
 * helper, so a tag behaves identically in both places — reimplementing the
 * three-way cycle here would be the easiest way to make them disagree.
 */

import { useTranslation } from 'react-i18next'

import { TagFilterTriState } from '@/pages/ClientManagement/components/TagFilterTriState'
import { cycleTagTriState, getTagTriState } from '@/features/tags/utils/tagFilterState'

import type { PresetOption } from '../hooks/usePresetFilterOptions'

export interface PresetTagsRowProps {
  label: string
  options: PresetOption<number>[]
  include?: number[]
  exclude?: number[]
  /** Both groups at once: one click can move a tag from one to the other. */
  onChange: (next: { include?: number[]; exclude?: number[] }) => void
}

export function PresetTagsRow({ label, options, include, exclude, onChange }: PresetTagsRowProps) {
  const { t } = useTranslation('common')

  const selection = { includeIds: include ?? [], excludeIds: exclude ?? [] }

  const cycle = (tagId: number) => {
    const next = cycleTagTriState(selection, tagId)
    // Each group drops out independently: a preset that only excludes tags has
    // no include filter at all, and must not save an empty one.
    onChange({
      include: next.includeIds.length > 0 ? next.includeIds : undefined,
      exclude: next.excludeIds.length > 0 ? next.excludeIds : undefined,
    })
  }

  return (
    <fieldset className="flex w-full flex-col gap-2 self-stretch">
      <legend className="text-foreground text-sm font-medium">{label}</legend>
      {options.length === 0 ? (
        <span className="text-muted-foreground text-xs">
          {t('pages.profile.presets.tags.none', 'No tags available')}
        </span>
      ) : (
        <div
          className="border-border flex max-h-40 w-full flex-wrap gap-x-4 gap-y-2 self-stretch overflow-y-auto rounded-lg border p-3"
          data-testid="preset-tags"
        >
          {options.map((tag) => (
            <label
              key={tag.value}
              className="text-foreground flex cursor-pointer items-center gap-2 text-xs"
            >
              <TagFilterTriState
                state={getTagTriState(selection, tag.value)}
                onCycle={() => cycle(tag.value)}
                aria-label={tag.label}
              />
              {tag.label}
            </label>
          ))}
        </div>
      )}
      {/* The three states are not self-explanatory from the swatches alone. */}
      <span className="text-muted-foreground text-xs">
        {t('pages.profile.presets.tags.hint', 'Click a tag to include it, again to exclude it')}
      </span>
    </fieldset>
  )
}
