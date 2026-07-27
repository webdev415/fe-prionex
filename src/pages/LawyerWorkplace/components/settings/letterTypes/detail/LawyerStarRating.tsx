import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

interface LawyerStarRatingProps {
  value: number
  onChange: (stars: number) => void
  disabled?: boolean
}

export function LawyerStarRating({ value, onChange, disabled = false }: LawyerStarRatingProps) {
  const { t } = useTranslation('common')

  return (
    <div
      className={cn('flex items-center gap-0.5', disabled && 'pointer-events-none')}
      role="group"
      aria-disabled={disabled || undefined}
      aria-label={t('pages.lawyerWorkplace.settings.letterTypes.starRating', 'Star rating')}
    >
      {[1, 2, 3, 4].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          tabIndex={disabled ? -1 : undefined}
          onClick={() => {
            if (disabled) return
            onChange(star === value ? star - 1 : star)
          }}
          className={cn('p-0.5', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
          aria-label={t('pages.lawyerWorkplace.settings.letterTypes.starN', {
            n: star,
            total: 4,
            defaultValue: `Star ${star} of 4`,
          })}
        >
          <Icons.StarFilled
            size={15}
            strokeWidth={1.5}
            className={cn(
              star <= value ? 'text-secondary-500' : 'text-muted-foreground/60',
              disabled && 'opacity-60'
            )}
          />
        </button>
      ))}
    </div>
  )
}
