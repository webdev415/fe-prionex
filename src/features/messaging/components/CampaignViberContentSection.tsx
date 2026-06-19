import { useTranslation } from 'react-i18next'
import { resolveViberImageUrls, viberContentFromSnapshot } from '../utils/viberContent'

interface CampaignViberContentSectionProps {
  snapshot: Record<string, unknown>
  channel: string
}

export function CampaignViberContentSection({
  snapshot,
  channel,
}: CampaignViberContentSectionProps) {
  const { t } = useTranslation('common')
  if (channel !== 'viber') return null

  const viber = viberContentFromSnapshot(snapshot)
  if (!viber) return null

  const imageUrls = resolveViberImageUrls(viber)
  const hasButton = Boolean(viber.button_name && viber.button_url)
  if (!imageUrls.length && !hasButton) return null

  const p = 'pages.messagingCampaigns.detail.viber'

  return (
    <div className="space-y-3 border-t border-gray-100 pt-3">
      {imageUrls.length > 0 && (
        <div>
          <span className="text-xs font-light text-gray-500">
            {t(`${p}.images`, 'Images')}
            {imageUrls.length > 1
              ? ` (${t(`${p}.my2UsesFirst`, 'My2 sends the first image')})`
              : null}
          </span>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {imageUrls.map((url) => (
              <li key={url} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                  <img src={url} alt="" className="aspect-square w-full object-cover" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {hasButton && (
        <div>
          <span className="text-xs font-light text-gray-500">{t(`${p}.button`, 'Button')}</span>
          <p className="text-dark-500 mt-0.5 font-medium">{viber.button_name}</p>
          <a
            href={viber.button_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 mt-0.5 inline-block text-xs break-all hover:underline"
          >
            {viber.button_url}
          </a>
        </div>
      )}
    </div>
  )
}
