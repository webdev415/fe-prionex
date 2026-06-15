import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'

interface KeywordHintsFieldProps {
  keywords: string[]
  onChange: (keywords: string[]) => void
}

export function KeywordHintsField({ keywords, onChange }: KeywordHintsFieldProps) {
  const { t } = useTranslation('common')
  const [input, setInput] = useState('')

  const addKeyword = (raw: string) => {
    const keyword = raw.trim().toLowerCase()
    if (!keyword || keywords.includes(keyword)) return
    onChange([...keywords, keyword])
  }

  return (
    <div className="flex min-h-[44px] flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
      {keywords.map((keyword) => (
        <span
          key={keyword}
          className="bg-secondary-100 text-secondary-800 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
        >
          {keyword}
          <button
            type="button"
            onClick={() => onChange(keywords.filter((item) => item !== keyword))}
            className="text-secondary-700 hover:text-secondary-900"
            aria-label={t('actions.remove', 'Remove')}
          >
            <Icons.Cancel01 size={10} strokeWidth={1.5} />
          </button>
        </span>
      ))}
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
        className="text-dark-500 min-w-[180px] flex-1 bg-transparent text-[13px] outline-none placeholder:text-gray-400"
      />
    </div>
  )
}
