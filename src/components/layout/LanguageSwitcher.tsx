import { Fragment } from 'react'
import { Menu, MenuButton, MenuItem, MenuItems, Transition } from '@headlessui/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
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
    <Menu as="div" className="relative inline-block text-left">
      <MenuButton className="text-body-sm inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-white backdrop-blur-sm transition-colors hover:bg-white/20">
        <span className="text-base leading-none">{LANGUAGE_FLAGS[currentLanguage]}</span>
        <span className="font-medium">{LANGUAGE_SHORT_NAMES[currentLanguage]}</span>
        <ChevronDownIcon className="h-3.5 w-3.5 opacity-70" />
      </MenuButton>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <MenuItems className="absolute right-0 z-50 mt-2 w-32 origin-top-right rounded-lg bg-white shadow-lg ring-1 ring-black/5 focus:outline-none">
          <div className="p-1">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <MenuItem key={lang}>
                {({ focus }) => (
                  <button
                    type="button"
                    onClick={() => handleLanguageChange(lang)}
                    className={cn(
                      'text-body-sm flex w-full items-center gap-2 rounded-md px-2.5 py-2 transition-colors',
                      focus ? 'bg-gray-100' : '',
                      currentLanguage === lang ? 'text-primary-600 font-medium' : 'text-gray-700'
                    )}
                  >
                    <span className="text-base leading-none">{LANGUAGE_FLAGS[lang]}</span>
                    <span>{LANGUAGE_SHORT_NAMES[lang]}</span>
                    {currentLanguage === lang && (
                      <CheckIcon className="text-primary-600 ml-auto h-4 w-4" />
                    )}
                  </button>
                )}
              </MenuItem>
            ))}
          </div>
        </MenuItems>
      </Transition>
    </Menu>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export default LanguageSwitcher
