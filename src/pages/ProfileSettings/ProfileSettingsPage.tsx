import { useState, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { ProfilePhotoField } from './ProfilePhotoField'
import { useAuth, useUpdateMyProfile, ChangePasswordModal, TwoFactorSection } from '@/features/auth'
import { useAuthStore } from '@/stores/authStore'
import { authApi } from '@/features/auth/api/authApi'
import { timezoneOptions } from '@/features/users/schemas/userSchemas'
import { Input } from '@/components/ui/Input'
import { ProjectSelector } from '@/components/layout/ProjectSelector'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, normalizeBackendLanguage } from '@/lib/i18n'
import type { UpdateMyProfileInput } from '@/types/api'
import { AppearanceSettings } from './AppearanceSettings'

const TRIGGER_CLASS =
  'text-foreground border-input-border bg-input flex h-[45px] w-full items-center justify-between rounded-lg border px-4 py-2 text-sm font-light'

const CONTENT_CLASS =
  'max-h-60 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto p-1.5'

export function ProfileSettingsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const refreshUser = useAuthStore((state) => state.refreshUser)
  const { t, i18n } = useTranslation('common')
  const { mutateAsync: updateMyProfileMutateAsync } = useUpdateMyProfile()
  const [isUpdatingLocal, setIsUpdatingLocal] = useState(false)
  const [isChangingLocal, setIsChangingLocal] = useState(false)
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)

  // Local form state initialized from store user
  const initialForm = useMemo(() => {
    const fromI18n = normalizeBackendLanguage(i18n.language)
    const currentLanguage: 'en' | 'uk' = user?.language
      ? normalizeBackendLanguage(user.language)
      : fromI18n
    return {
      username: user?.username || '',
      email: user?.email || '',
      first_name: user?.firstName || '',
      last_name: user?.lastName || '',
      middle_name: '',
      phone: '',
      language: currentLanguage,
      timezone: user?.timezone || 'Europe/Kyiv',
      agent_status: user?.agent_status || 'offline',
      work_format: (user?.work_format ?? 'office') as 'office' | 'remote',
      currentPassword: '',
      newPassword: '',
    }
  }, [user, i18n.language])

  const [form, setForm] = useState(initialForm)

  const [savedProfileSnapshot, setSavedProfileSnapshot] = useState(() => ({
    email: initialForm.email,
    first_name: initialForm.first_name,
    last_name: initialForm.last_name,
    middle_name: initialForm.middle_name,
    phone: initialForm.phone,
    language: initialForm.language,
    timezone: initialForm.timezone,
    work_format: initialForm.work_format,
  }))

  const workFormatOptions = [
    { value: 'office' as const, label: t('pages.profileSettings.workFormat.office', 'Office') },
    { value: 'remote' as const, label: t('pages.profileSettings.workFormat.remote', 'Remote') },
  ]

  const agentStatusOptions = [
    {
      value: 'online',
      label: t('pages.profile.agentStatus.online') || 'Online',
      dot: 'bg-green-500',
    },
    { value: 'busy', label: t('pages.profile.agentStatus.busy') || 'Busy', dot: 'bg-yellow-500' },
    {
      value: 'on-call',
      label: t('pages.profile.agentStatus.onCall') || 'On Call',
      dot: 'bg-red-500',
    },
    {
      value: 'offline',
      label: t('pages.profile.agentStatus.offline') || 'Offline',
      dot: 'bg-gray-400',
    },
  ]

  // Switching the language has to reach i18n as well as the form: the label the
  // dropdown shows comes from the form, but the rest of the page is translated
  // live. LanguageSwitcher used to own this; the profile page was its only
  // caller, so the call moved here with it.
  const handleLanguageChange = async (lang: (typeof SUPPORTED_LANGUAGES)[number]) => {
    await i18n.changeLanguage(lang)
    setForm((prev) => ({ ...prev, language: lang }))
  }

  // Re-sync form when auth user loads or is refreshed (e.g. after permission refresh / project switch)
  useEffect(() => {
    if (!user) return
    setForm((prev) => ({
      ...prev,
      username: user.username || prev.username,
      email: user.email || prev.email,
      first_name: user.firstName || prev.first_name,
      last_name: user.lastName || prev.last_name,
      timezone: user.timezone || prev.timezone,
      agent_status: user.agent_status || prev.agent_status,
      work_format: user.work_format ?? prev.work_format,
      language: user.language
        ? (normalizeBackendLanguage(user.language) as 'en' | 'uk')
        : prev.language,
    }))
  }, [user])

  const hasProfileChanges = useMemo(() => {
    return (
      form.email !== savedProfileSnapshot.email ||
      form.first_name !== savedProfileSnapshot.first_name ||
      form.last_name !== savedProfileSnapshot.last_name ||
      form.middle_name !== savedProfileSnapshot.middle_name ||
      form.phone !== savedProfileSnapshot.phone ||
      form.language !== savedProfileSnapshot.language ||
      form.timezone !== savedProfileSnapshot.timezone ||
      form.work_format !== savedProfileSnapshot.work_format
    )
  }, [form, savedProfileSnapshot])

  // Refresh auth user once on mount so profile has full /me data (projects, agent fields, names)
  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  // Sync when i18n changes externally only (e.g. header switcher). Do not depend on form.language —
  // i18n.changeLanguage is async; including form.language would revert the profile dropdown immediately.
  useEffect(() => {
    const currentLanguage: 'en' | 'uk' = normalizeBackendLanguage(i18n.language)
    // Defer to a microtask so the effect body itself doesn't call setState
    // synchronously (lint: react-hooks/set-state-in-effect).
    queueMicrotask(() => {
      setForm((prev) =>
        prev.language === currentLanguage ? prev : { ...prev, language: currentLanguage }
      )
    })
  }, [i18n.language])

  const { mutateAsync: changePassword } = useMutation({
    mutationFn: (payload: { current_password: string; new_password: string }) =>
      authApi.changePassword(payload),
    onSuccess: () => {
      toast.success(t('pages.profile.passwordChanged'))
    },
    onError: () => {
      toast.error(t('pages.profile.passwordChangeFailed'))
    },
  })

  if (authLoading) {
    return <div className="text-muted-foreground py-12 text-center">{t('status.loading')}</div>
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user?.id) return

    // If user provided a new password, attempt to change it first
    if (form.newPassword) {
      try {
        setIsChangingLocal(true)
        await changePassword({
          current_password: form.currentPassword,
          new_password: form.newPassword,
        })
      } finally {
        setIsChangingLocal(false)
      }
    }

    const updatePayload: UpdateMyProfileInput = {
      email: form.email,
      first_name: form.first_name,
      last_name: form.last_name,
      middle_name: form.middle_name || undefined,
      phone: form.phone || undefined,
      language: form.language || undefined,
      timezone: form.timezone || undefined,
      agent_status: user?.is_agent ? form.agent_status : undefined,
      work_format: form.work_format,
    }

    try {
      setIsUpdatingLocal(true)
      await updateMyProfileMutateAsync(updatePayload)

      setSavedProfileSnapshot({
        email: form.email,
        first_name: form.first_name,
        last_name: form.last_name,
        middle_name: form.middle_name,
        phone: form.phone,
        language: form.language,
        timezone: form.timezone,
        work_format: form.work_format,
      })
      setForm((f) => ({ ...f, currentPassword: '', newPassword: '' }))
    } finally {
      setIsUpdatingLocal(false)
    }
  }

  const handleCancel = () => {
    setForm((prev) => ({
      ...prev,
      email: savedProfileSnapshot.email,
      first_name: savedProfileSnapshot.first_name,
      last_name: savedProfileSnapshot.last_name,
      middle_name: savedProfileSnapshot.middle_name,
      phone: savedProfileSnapshot.phone,
      language: savedProfileSnapshot.language,
      timezone: savedProfileSnapshot.timezone,
      currentPassword: '',
      newPassword: '',
    }))
  }

  return (
    <div className="flex flex-col items-start gap-4 self-stretch p-0">
      <span className="text-foreground text-xl leading-[120%] font-light tracking-[-0.48px] sm:text-2xl">
        {t('pages.profile.title')}
      </span>

      <div className="flex flex-col items-start gap-4 self-stretch 2xl:flex-row 2xl:gap-5">
        <div className="bg-card/50 flex w-full flex-col items-center gap-4 self-stretch rounded-xl px-4 py-6 sm:gap-5 sm:px-6 sm:py-8 2xl:w-[25%] 2xl:py-11">
          <div className="flex flex-col items-center gap-4 self-stretch">
            <ProfilePhotoField
              userId={user?.id ? Number(user.id) : null}
              firstName={form.first_name}
              lastName={form.last_name}
              fullName={user?.fullName}
              avatarUrl={user?.avatar_url}
            />
            <div className="text-foreground text-lg leading-[132%] font-medium tracking-[-0.4px] sm:text-xl">
              {user?.username}
            </div>
            <div className="flex flex-col items-center gap-3 self-stretch">
              <ProjectSelector />
              <span className="text-muted-foreground text-sm leading-[155%] font-light tracking-[-0.32px] sm:text-base">
                {t('pages.profile.roleLabel')}{' '}
                <span className="text-foreground font-medium">{user?.active_role_name || ''}</span>
              </span>
              {(user?.active_department_name || user?.active_group_name) && (
                <span className="text-muted-foreground text-sm leading-[155%] font-light tracking-[-0.32px] sm:text-base">
                  {user?.active_department_name && (
                    <>
                      {t('pages.profile.departmentLabel')}{' '}
                      <span className="text-foreground font-medium">
                        {user.active_department_name}
                      </span>
                    </>
                  )}
                  {user?.active_department_name && user?.active_group_name && ' · '}
                  {user?.active_group_name && (
                    <>
                      {t('pages.profile.groupLabel')}{' '}
                      <span className="text-foreground font-medium">{user.active_group_name}</span>
                    </>
                  )}
                </span>
              )}
              {user?.asterisk_extension && (
                <div className="text-muted-foreground text-xs">
                  Extension: {user.asterisk_extension}
                </div>
              )}
              {user?.dialer_extension && (
                <div className="text-muted-foreground text-xs">
                  {t('pages.users.forms.dialerExtension')}: {user.dialer_extension}
                </div>
              )}
              {user?.is_agent && user?.agent_status && (
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      user.agent_status === 'online'
                        ? 'bg-green-500'
                        : user.agent_status === 'busy'
                          ? 'bg-yellow-500'
                          : user.agent_status === 'on-call'
                            ? 'bg-red-500'
                            : 'bg-gray-400'
                    }`}
                  />
                  <span className="text-muted-foreground text-xs capitalize">
                    {user.agent_status}
                  </span>
                </div>
              )}
            </div>
          </div>
          <Button
            onClick={() => setIsChangePasswordOpen(true)}
            variant="secondary"
            className="h-12 w-full rounded-md 2xl:w-auto"
            leftIcon={<Icons.LockSync01 size={24} />}
          >
            {t('pages.profile.resetPassword')}
          </Button>

          <ChangePasswordModal
            open={isChangePasswordOpen}
            onClose={() => setIsChangePasswordOpen(false)}
            isLoading={isChangingLocal}
            onSubmit={async (data) => {
              try {
                setIsChangingLocal(true)
                await changePassword(data)
                setIsChangePasswordOpen(false)
              } finally {
                setIsChangingLocal(false)
              }
            }}
          />

          <div className="border-border mt-6 flex w-full flex-col gap-3 self-stretch border-t pt-6">
            <span className="text-foreground self-start text-sm font-semibold tracking-[-0.28px]">
              {t('pages.profile.accountSecurity')}
            </span>
            <TwoFactorSection />
          </div>
        </div>

        <div className="bg-card/50 flex w-full flex-1 flex-col items-start gap-6 self-stretch rounded-xl p-4 sm:gap-8 sm:p-6">
          <AppearanceSettings />

          <form
            onSubmit={handleSave}
            className="border-border flex w-full flex-col items-center gap-4 self-stretch border-t pt-6 sm:gap-6"
          >
            <span className="text-foreground self-stretch text-base leading-[150%] font-medium tracking-[-0.36px] sm:text-[18px]">
              {t('pages.users.modals.edit.title')}
            </span>
            <div className="flex w-full flex-col items-center gap-6 self-stretch">
              <div className="flex w-full flex-col items-start gap-4 self-stretch 2xl:flex-row">
                <Input
                  label={t('pages.users.forms.username')}
                  value={form.username}
                  disabled
                  onChange={() => {}}
                  helperText={t('pages.users.editForm.usernameCannotBeChanged')}
                  className="w-full"
                />
                <Input
                  label={t('pages.users.forms.email')}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="w-full"
                />
              </div>
              <div className="flex w-full flex-col items-start gap-4 self-stretch 2xl:flex-row">
                <Input
                  label={t('pages.users.forms.firstName')}
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  required
                  className="w-full"
                />

                <Input
                  label={t('pages.users.forms.lastName')}
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  required
                  className="w-full"
                />
              </div>
              <div className="flex w-full flex-col items-start gap-4 self-stretch 2xl:flex-row">
                <Input
                  label={t('pages.users.forms.middleName')}
                  value={form.middle_name}
                  onChange={(e) => setForm({ ...form, middle_name: e.target.value })}
                  className="w-full"
                />

                <Input
                  label={t('pages.users.forms.phone')}
                  placeholder={t('pages.users.forms.placeholders.phone')}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full"
                />
              </div>
              <div className="flex w-full flex-col items-start gap-4 self-stretch 2xl:flex-row">
                <div className="flex w-full flex-col gap-2 self-stretch">
                  <Label htmlFor="language">{t('pages.users.forms.language')}</Label>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <button id="language" type="button" className={TRIGGER_CLASS}>
                        <span className="text-left">{LANGUAGE_NAMES[form.language]}</span>
                        <Icons.ArrowDown
                          size={16}
                          strokeWidth={1.5}
                          className="text-muted-foreground shrink-0"
                        />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className={CONTENT_CLASS}>
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <DropdownMenuItem
                          key={lang}
                          className="cursor-pointer"
                          onClick={() => void handleLanguageChange(lang)}
                        >
                          <span className="flex w-full items-center justify-between gap-2">
                            <span>{LANGUAGE_NAMES[lang]}</span>
                            {form.language === lang ? (
                              <Icons.Tick02 size={14} strokeWidth={2} className="text-primary" />
                            ) : null}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex w-full flex-col gap-2 self-stretch">
                  <Label htmlFor="work-format">
                    {t('pages.profileSettings.workFormat.label', 'Work format')}
                  </Label>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <button id="work-format" type="button" className={TRIGGER_CLASS}>
                        <span className="text-left">
                          {workFormatOptions.find((o) => o.value === form.work_format)?.label}
                        </span>
                        <Icons.ArrowDown
                          size={16}
                          strokeWidth={1.5}
                          className="text-muted-foreground shrink-0"
                        />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className={CONTENT_CLASS}>
                      {workFormatOptions.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          className="cursor-pointer"
                          onClick={() => setForm({ ...form, work_format: option.value })}
                        >
                          <span className="flex w-full items-center justify-between gap-2">
                            <span>{option.label}</span>
                            {form.work_format === option.value ? (
                              <Icons.Tick02 size={14} strokeWidth={2} className="text-primary" />
                            ) : null}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex w-full flex-col gap-2 self-stretch">
                  <Label htmlFor="timezone">{t('pages.users.forms.timezone')}</Label>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <button id="timezone" type="button" className={TRIGGER_CLASS}>
                        <span className="line-clamp-1 text-left">
                          {timezoneOptions.find((o) => o.value === form.timezone)?.label ??
                            form.timezone}
                        </span>
                        <Icons.ArrowDown
                          size={16}
                          strokeWidth={1.5}
                          className="text-muted-foreground shrink-0"
                        />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className={CONTENT_CLASS}>
                      {timezoneOptions.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          className="cursor-pointer"
                          onClick={() => setForm({ ...form, timezone: option.value })}
                        >
                          <span className="flex w-full items-center justify-between gap-2">
                            <span>{option.label}</span>
                            {form.timezone === option.value ? (
                              <Icons.Tick02 size={14} strokeWidth={2} className="text-primary" />
                            ) : null}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Call Settings Section - Only visible for agents */}
              {user?.is_agent && (
                <div className="flex w-full flex-col items-start gap-4 self-stretch 2xl:flex-row">
                  <Input
                    label={t('pages.users.forms.asteriskExtension') || 'Asterisk Extension'}
                    value={user?.asterisk_extension || ''}
                    disabled
                    onChange={() => {}}
                    placeholder={t('pages.users.forms.placeholders.notSet') || 'Not set'}
                    className="w-full"
                  />
                  <Input
                    label={t('pages.users.forms.dialerExtension') || 'Predictive Dialer Extension'}
                    value={user?.dialer_extension || ''}
                    disabled
                    onChange={() => {}}
                    placeholder={t('pages.users.forms.placeholders.notSet') || 'Not set'}
                    className="w-full"
                  />
                  {user?.agent_status !== undefined && (
                    <div className="w-full">
                      <label
                        htmlFor="agent-status"
                        className="text-foreground mb-1.5 block text-sm font-light"
                      >
                        {t('pages.users.forms.agentStatus') || 'Agent Status'}
                      </label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button id="agent-status" type="button" className={TRIGGER_CLASS}>
                            <span className="flex items-center gap-2 text-left">
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  agentStatusOptions.find((o) => o.value === form.agent_status)
                                    ?.dot ?? 'bg-gray-400'
                                }`}
                              />
                              <span>
                                {
                                  agentStatusOptions.find((o) => o.value === form.agent_status)
                                    ?.label
                                }
                              </span>
                            </span>
                            <Icons.ArrowDown
                              size={16}
                              strokeWidth={1.5}
                              className="text-muted-foreground shrink-0"
                            />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className={CONTENT_CLASS}>
                          {agentStatusOptions.map((option) => (
                            <DropdownMenuItem
                              key={option.value}
                              className="cursor-pointer"
                              onClick={() => setForm({ ...form, agent_status: option.value })}
                            >
                              <span className="flex w-full items-center justify-between gap-2">
                                <span className="flex items-center gap-2">
                                  <span className={`h-2 w-2 rounded-full ${option.dot}`} />
                                  <span>{option.label}</span>
                                </span>
                                {form.agent_status === option.value ? (
                                  <Icons.Tick02
                                    size={14}
                                    strokeWidth={2}
                                    className="text-primary"
                                  />
                                ) : null}
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              )}
            </div>
            {hasProfileChanges && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
                <Button
                  type="button"
                  variant="cancel"
                  onClick={handleCancel}
                  className="h-12 w-48 rounded-full px-10"
                >
                  {t('actions.cancel')}
                </Button>
                <DoubleButton
                  type="submit"
                  icon={<Icons.Tick02 size={28} />}
                  iconPosition="left"
                  disabled={isUpdatingLocal || isChangingLocal}
                  className="h-12 w-48"
                  onClick={() => {
                    // Handle double button click
                  }}
                >
                  {t('pages.profile.saveChanges')}
                </DoubleButton>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}

export default ProfileSettingsPage
