import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

interface LawyerStarRatingProps {
  value: number
  onChange: (stars: number) => void
}

export function LawyerStarRating({ value, onChange }: LawyerStarRatingProps) {
  const { t } = useTranslation('common')

  return (
    <div
      className="flex items-center gap-0.5"
      role="group"
      aria-label={t('pages.lawyerWorkplace.settings.letterTypes.starRating', 'Star rating')}
    >
      {[1, 2, 3, 4].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star === value ? star - 1 : star)}
          className="cursor-pointer p-0.5"
          aria-label={t('pages.lawyerWorkplace.settings.letterTypes.starN', {
            n: star,
            total: 4,
            defaultValue: `Star ${star} of 4`,
          })}
        >
          <Icons.StarFilled
            size={15}
            strokeWidth={1.5}
            className={cn(star <= value ? 'text-secondary-500' : 'text-gray-300')}
          />
        </button>
      ))}
    </div>
  )
}
