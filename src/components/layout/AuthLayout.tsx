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
      <div className="relative z-10 flex min-h-screen w-full flex-col p-3 sm:p-4 md:p-6 lg:h-full lg:flex-row lg:p-12 xl:p-16 2xl:p-20">
        {/* Mobile/Tablet Header - Logo and Language Switcher */}
        <div className="mb-3 flex items-center justify-between sm:mb-4 md:mb-6 lg:hidden">
          <img
            src="/assets/images/logo.png"
            width={120}
            height={27.6}
            alt="logo"
            className="h-auto w-[90px] min-[375px]:w-[100px] sm:w-[120px]"
          />
          <LanguageSwitcher />
        </div>

        {/* Left Panel - Dark/Brand side (hidden on mobile) */}
        <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
          <div className="relative z-10 flex w-full flex-col justify-between py-8 xl:py-12">
            {/* Logo */}
            <img
              src="/assets/images/logo.png"
              width={250}
              height={57.5}
              alt="logo"
              className="h-auto w-[160px] lg:w-[180px] xl:w-[220px] 2xl:w-[250px]"
            />

            {/* Center content with tagline */}
            <div className="flex max-w-[392px] flex-col justify-between">
              <h1 className="text-display-xs lg:text-display-sm xl:text-display-md mb-4 font-medium text-white">
                {t('branding.tagline')}
              </h1>
              <p className="text-body-sm lg:text-body-md xl:text-body-lg leading-relaxed text-gray-400">
                {t('branding.description')}
              </p>
            </div>
          </div>
        </div>

        {/* Right Panel - Form side */}
        <div className="flex w-full flex-1 flex-col items-center justify-center lg:h-full lg:w-1/2">
          {/* Form container */}
          <div className="bg-light-50 flex w-[90%] items-center justify-center rounded-lg p-4 py-40 sm:rounded-xl sm:p-6 sm:py-40 md:rounded-2xl md:p-8 md:py-40 lg:p-10 lg:py-40 xl:p-12 xl:py-40">
            <div className="w-full">{children}</div>
          </div>
        </div>
      </div>

      {/* Desktop Language Switcher - Top Right */}
      <div className="absolute top-3 right-3 z-20 hidden sm:top-4 sm:right-4 lg:block xl:top-6 xl:right-12 2xl:right-20">
        <LanguageSwitcher />
      </div>
    </div>
  )
}

export default AuthLayout
