/**
 * LanguageSwitcher Component
 *
 * Dropdown component for switching between supported languages.
 * Built with Radix UI DropdownMenu for consistency.
 */

import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Icons } from '@/lib/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_SHORT_NAMES,
  LANGUAGE_FLAGS,
  type SupportedLanguage,
} from '@/lib/i18n'

export function LanguageSwitcher() {
  const { i18n } = useTranslation('common')

  const currentLanguage = i18n.language as SupportedLanguage

  const handleLanguageChange = (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-sm text-white backdrop-blur-sm transition-colors hover:bg-white/20"
        >
          <span className="text-base leading-none">{LANGUAGE_FLAGS[currentLanguage]}</span>
          <span className="font-medium">{LANGUAGE_SHORT_NAMES[currentLanguage]}</span>
          <Icons.ArrowDown
            size={14}
            color="currentColor"
            strokeWidth={1.5}
            className="opacity-70"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-32">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => handleLanguageChange(lang)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors',
              currentLanguage === lang ? 'text-primary-600 font-medium' : 'text-gray-700'
            )}
          >
            <span className="text-base leading-none">{LANGUAGE_FLAGS[lang]}</span>
            <span>{LANGUAGE_SHORT_NAMES[lang]}</span>
            {currentLanguage === lang && (
              <Icons.Checkmark size={16} color="#0369A1" strokeWidth={2} className="ml-auto" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default LanguageSwitcher
