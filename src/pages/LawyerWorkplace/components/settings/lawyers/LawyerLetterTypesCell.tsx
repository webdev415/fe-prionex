import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { LetterTypeConfig } from '../../../settings/types'
import type { SettingsLawyer } from '../../../settings/types'
import { LetterTypeBadge } from '../LetterTypeBadge'

interface LawyerLetterTypesCellProps {
  lawyer: SettingsLawyer
  letterTypes: LetterTypeConfig[]
  readOnly?: boolean
  saving?: boolean
  onUpdateLetterTypes: (lawyerId: string, letterTypeIds: string[]) => Promise<void>
}

export function LawyerLetterTypesCell({
  lawyer,
  letterTypes,
  readOnly = false,
  saving = false,
  onUpdateLetterTypes,
}: LawyerLetterTypesCellProps) {
  const { t } = useTranslation('common')

  const letterTypeById = useMemo(
    () => Object.fromEntries(letterTypes.map((type) => [type.id, type])),
    [letterTypes]
  )

  const availableToAdd = useMemo(
    () => letterTypes.filter((type) => !lawyer.letterTypeIds.includes(type.id)),
    [lawyer.letterTypeIds, letterTypes]
  )

  const handleRemove = async (typeId: string) => {
    if (readOnly || saving) return
    const nextIds = lawyer.letterTypeIds.filter((id) => id !== typeId)
    await onUpdateLetterTypes(lawyer.id, nextIds)
  }

  const handleAdd = async (typeId: string) => {
    if (readOnly || saving) return
    if (lawyer.letterTypeIds.includes(typeId)) return
    await onUpdateLetterTypes(lawyer.id, [...lawyer.letterTypeIds, typeId])
  }

  return (
    <div className="flex min-w-[140px] flex-wrap items-center gap-1.5">
      {lawyer.letterTypeIds.map((typeId) => {
        const letterType = letterTypeById[typeId]
        if (!letterType) return null

        return (
          <span
            key={typeId}
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full pr-0.5',
              !readOnly && 'group'
            )}
          >
            <LetterTypeBadge letterType={letterType} t={t} size="sm" />
            {!readOnly ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleRemove(typeId)}
                className="text-muted-foreground hover:text-foreground flex h-5 w-5 items-center justify-center rounded-full transition-colors disabled:opacity-40"
                aria-label={t(
                  'pages.lawyerWorkplace.settings.lawyers.removeLetterType',
                  'Remove letter type'
                )}
              >
                <Icons.Cancel01 size={12} strokeWidth={1.5} />
              </button>
            ) : null}
          </span>
        )
      })}

      {!readOnly ? (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={saving || availableToAdd.length === 0}
              className="border-border text-muted-foreground hover:border-primary-400 hover:text-primary-600 bg-card flex h-6 w-6 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={t(
                'pages.lawyerWorkplace.settings.lawyers.addLetterType',
                'Add letter type'
              )}
            >
              <Icons.Add size={14} strokeWidth={1.5} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-56 overflow-y-auto p-1.5">
            {availableToAdd.length === 0 ? (
              <DropdownMenuItem disabled className="text-muted-foreground text-[12px]">
                {t(
                  'pages.lawyerWorkplace.settings.lawyers.noMoreLetterTypes',
                  'All letter types assigned'
                )}
              </DropdownMenuItem>
            ) : (
              availableToAdd.map((letterType) => (
                <DropdownMenuItem
                  key={letterType.id}
                  className="cursor-pointer"
                  onClick={() => void handleAdd(letterType.id)}
                >
                  <LetterTypeBadge letterType={letterType} t={t} size="sm" />
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}
