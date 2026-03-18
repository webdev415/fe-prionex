/**
 * LanguageSwitcher Component
 *
 * Dropdown component for switching between supported languages.
 * Built with Radix UI DropdownMenu for consistency.
 */

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select'
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES, type SupportedLanguage } from '@/lib/i18n'

interface LanguageSwitcherProps {
  variant?: 'auth' | 'dashboard'
  value?: string
  onValueChange?: (v: string) => void
  id?: string
}

export function LanguageSwitcher({
  variant = 'auth',
  value,
  onValueChange,
  id,
}: LanguageSwitcherProps) {
  const { i18n } = useTranslation('common')

  const currentLanguage =
    (value as SupportedLanguage) || (i18n.language as SupportedLanguage) || 'en'

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang as SupportedLanguage)
    if (onValueChange) onValueChange(lang)
  }

  useEffect(() => {
    const handleResize = () => {}
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isAuth = variant === 'auth'

  return (
    <Select value={currentLanguage} onValueChange={handleLanguageChange}>
      <SelectTrigger
        id={id}
        className={cn(
          'cursor-pointer',
          isAuth
            ? 'bg-white/10 text-white backdrop-blur-sm hover:bg-white/20'
            : 'text-dark-500 bg-white'
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <SelectItem key={lang} value={lang}>
            {LANGUAGE_NAMES[lang]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default LanguageSwitcher
