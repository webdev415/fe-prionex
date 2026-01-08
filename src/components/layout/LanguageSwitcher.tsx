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
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES, type SupportedLanguage } from '@/lib/i18n'

interface LanguageSwitcherProps {
  variant?: 'auth' | 'dashboard'
}

export function LanguageSwitcher({ variant = 'auth' }: LanguageSwitcherProps) {
  const { i18n } = useTranslation('common')

  const currentLanguage = i18n.language as SupportedLanguage

  const handleLanguageChange = (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang)
  }

  const isAuth = variant === 'auth'

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg rounded-md px-2 py-1 text-xs transition-colors sm:h-9 sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-sm md:h-10',
            isAuth
              ? 'bg-white/10 text-white backdrop-blur-sm hover:bg-white/20'
              : 'bg-secondary-800 text-white hover:opacity-90'
          )}
        >
          <span className="font-medium">{LANGUAGE_NAMES[currentLanguage]}</span>
          <Icons.ArrowDown
            size={14}
            color={isAuth ? 'currentColor' : '#05040D'}
            strokeWidth={1.5}
            className="h-3 w-3 text-white opacity-70 sm:h-3.5 sm:w-3.5"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-36 sm:w-40">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => handleLanguageChange(lang)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors',
              currentLanguage === lang ? 'text-primary-600 font-medium' : 'text-gray-700'
            )}
          >
            <span>{LANGUAGE_NAMES[lang]}</span>
            {currentLanguage === lang && (
              <Icons.Checkmark size={16} className="text-information-700 ml-auto" strokeWidth={2} />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default LanguageSwitcher
