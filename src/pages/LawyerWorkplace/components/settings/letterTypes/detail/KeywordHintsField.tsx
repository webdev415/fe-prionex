import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { getKeywordHintLabel } from '../../../../settings/utils/settingsI18n'

interface KeywordHintsFieldProps {
  keywords: string[]
  onChange: (keywords: string[]) => void
  readOnly?: boolean
}

export function KeywordHintsField({
  keywords,
  onChange,
  readOnly = false,
}: KeywordHintsFieldProps) {
  const { t } = useTranslation('common')
  const [input, setInput] = useState('')

  const addKeyword = (raw: string) => {
    if (readOnly) return
    const keyword = raw.trim().toLowerCase()
    if (!keyword || keywords.includes(keyword)) return
    onChange([...keywords, keyword])
  }

  return (
    <div
      className={cn(
        'flex min-h-[44px] flex-wrap items-center gap-2 rounded-xl border px-3 py-2',
        readOnly ? 'cursor-not-allowed border-gray-100 bg-gray-50' : 'border-border bg-input'
      )}
    >
      {keywords.map((keyword) => (
        <span
          key={keyword}
          className="bg-secondary-100 text-secondary-800 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
        >
          {getKeywordHintLabel(keyword, t)}
          {!readOnly ? (
            <button
              type="button"
              onClick={() => onChange(keywords.filter((item) => item !== keyword))}
              className="text-secondary-700 hover:text-secondary-900"
              aria-label={t('actions.remove', 'Remove')}
            >
              <Icons.Cancel01 size={10} strokeWidth={1.5} />
            </button>
          ) : null}
        </span>
      ))}
      {!readOnly ? (
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addKeyword(input)
              setInput('')
            }
          }}
          placeholder={t(
            'pages.lawyerWorkplace.settings.letterTypes.keywordPlaceholder',
            'Type a keyword and press Enter..'
          )}
          className="text-dark-500 placeholder:text-muted-foreground min-w-[120px] flex-1 bg-transparent text-[13px] outline-none sm:min-w-[180px]"
        />
      ) : keywords.length === 0 ? (
        <span className="text-light-500 text-[12px]">
          {t('pages.lawyerWorkplace.settings.letterTypes.noKeywordHints', 'No keyword hints')}
        </span>
      ) : null}
    </div>
  )
}
