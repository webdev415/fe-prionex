import { useTranslation } from 'react-i18next'

export interface PlaceholderTabProps {
  titleKey: string
  titleFallback: string
  descriptionKey: string
  descriptionFallback: string
}

export function PlaceholderTab({
  titleKey,
  titleFallback,
  descriptionKey,
  descriptionFallback,
}: PlaceholderTabProps) {
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-white p-12">
      <h3 className="text-dark-500 text-lg font-medium">{t(titleKey, titleFallback)}</h3>
      <p className="max-w-md text-center text-sm text-gray-500">
        {t(descriptionKey, descriptionFallback)}
      </p>
    </div>
  )
}
