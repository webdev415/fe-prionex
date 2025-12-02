import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useTranslation('auth')

  return (
    <div className="relative min-h-screen lg:h-screen">
      {/* Background Image */}
      <img
        src="/assets/images/loggin-bg.webp"
        alt="login-background"
        className="absolute inset-0 z-0 h-full w-full object-cover"
      />
      <div className="from-dark-900/60 to-dark-900 absolute z-[5] h-full w-full bg-gradient-to-b via-transparent" />

      {/* Main Content Container */}
      <div className="relative z-10 flex min-h-screen w-full flex-col p-4 sm:p-6 md:p-10 lg:h-full lg:flex-row lg:p-16 xl:p-20">
        {/* Mobile/Tablet Header - Logo and Language Switcher */}
        <div className="mb-4 flex items-center justify-between sm:mb-6 lg:hidden">
          <img
            src="/assets/images/logo.png"
            width={120}
            height={27.6}
            alt="logo"
            className="w-[100px] sm:w-[120px]"
          />
          <LanguageSwitcher />
        </div>

        {/* Left Panel - Dark/Brand side (hidden on mobile) */}
        <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
          <div className="relative z-10 flex w-full flex-col justify-between">
            {/* Logo */}
            <img
              src="/assets/images/logo.png"
              width={250}
              height={57.5}
              alt="logo"
              className="w-[180px] xl:w-[250px]"
            />

            {/* Center content with tagline */}
            <div className="flex max-w-[392px] flex-col justify-between">
              <h1 className="text-display-sm xl:text-display-md mb-4 font-medium text-white">
                {t('branding.tagline')}
              </h1>
              <p className="text-body-sm xl:text-body-md leading-relaxed text-gray-400">
                {t('branding.description')}
              </p>
            </div>
          </div>
        </div>

        {/* Right Panel - Form side */}
        <div className="flex w-full flex-1 flex-col lg:h-full lg:w-1/2">
          {/* Form container */}
          <div className="bg-light-50 flex h-full w-full items-center justify-center rounded-xl p-6 sm:rounded-2xl sm:p-8 md:p-10 lg:p-12">
            <div className="w-full">{children}</div>
          </div>
        </div>
      </div>

      {/* Desktop Language Switcher - Top Right */}
      <div className="absolute top-4 right-4 z-20 hidden lg:block xl:top-6 xl:right-20">
        <LanguageSwitcher />
      </div>
    </div>
  )
}

export default AuthLayout
