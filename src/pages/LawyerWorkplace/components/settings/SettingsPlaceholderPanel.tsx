import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'

interface SettingsPlaceholderPanelProps {
  titleKey: string
  titleFallback: string
  descriptionKey: string
  descriptionFallback: string
}

export function SettingsPlaceholderPanel({
  titleKey,
  titleFallback,
  descriptionKey,
  descriptionFallback,
}: SettingsPlaceholderPanelProps) {
  const { t } = useTranslation('common')

  return (
    <div className="px-4 pb-6 sm:px-5 lg:px-7">
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <div className="bg-light-100 text-light-600 mb-4 flex h-14 w-14 items-center justify-center rounded-full">
          <Icons.Settings size={24} strokeWidth={1.5} />
        </div>
        <h2 className="text-dark-500 mb-2 text-lg font-light">{t(titleKey, titleFallback)}</h2>
        <p className="text-light-600 max-w-md text-[13px]">
          {t(descriptionKey, descriptionFallback)}
        </p>
      </div>
    </div>
  )
}
