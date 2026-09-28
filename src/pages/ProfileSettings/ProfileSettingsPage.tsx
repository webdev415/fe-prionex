import { useState, useMemo, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { ProfilePhotoField } from './ProfilePhotoField'
import { useAuth, useUpdateMyProfile, ChangePasswordModal, TwoFactorSection } from '@/features/auth'
import { AppLoginSection } from '@/features/appLogin'
import {
  useMyPersonalInformation,
  useUpdateMyPersonalInformation,
} from '@/features/auth/hooks/useMyPersonalInformation'
import { useAuthStore } from '@/stores/authStore'
import { authApi } from '@/features/auth/api/authApi'
import { timezoneOptions } from '@/features/users/schemas/userSchemas'
import { Input } from '@/components/ui/Input'
import { DateSelect } from '@/components/ui/DateSelect'
import '@/components/ui/DateSelect.theme.css'
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
import { formatPickerDateAsYMD, parsePickerYMD } from '@/lib/dateUtils'
import {
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
  normalizeBackendLanguage,
  type SupportedLanguage,
} from '@/lib/i18n'
import type { MyPersonalInformationInput, UpdateMyProfileInput } from '@/types/api'
import { AppearanceSettings } from './AppearanceSettings'
import { KeyboardShortcutsSettings } from '@/features/taHotkeys/components/KeyboardShortcutsSettings'

const TRIGGER_CLASS =
  'text-foreground border-input-border bg-input flex h-[45px] w-full items-center justify-between rounded-lg border px-4 py-2 text-sm font-light'

/**
 * The six card fields somebody keeps about themselves. They sit in the same
 * form as the name and phone above them because they are the same kind of
 * thing - what a person knows about themselves and nobody else finds out when
 * it changes. Only the table behind them differs, and that is not something a
 * form should show.
 */
const MY_PERSONAL_FIELDS = [
  'date_of_birth',
  'telegram',
  'city',
  'address',
  'nova_poshta_branch',
] as const

const CONTENT_CLASS =
  'max-h-60 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto p-1.5'

export function ProfileSettingsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const refreshUser = useAuthStore((state) => state.refreshUser)
  const { t, i18n } = useTranslation('common')
  const { mutateAsync: updateMyProfileMutateAsync } = useUpdateMyProfile()
  const { data: myPersonal } = useMyPersonalInformation()
  const { mutateAsync: updateMyPersonalMutateAsync } = useUpdateMyPersonalInformation()
  const [isUpdatingLocal, setIsUpdatingLocal] = useState(false)
  const [isChangingLocal, setIsChangingLocal] = useState(false)
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)
  // KAN-975 — the right-hand column is now two tabs. The left column
  // (identity, password, 2FA) is not tabbed: it is about the account itself
  // rather than about either set of settings.
  const [activeTab, setActiveTab] = useState<'account' | 'shortcuts'>('account')

  // Local form state initialized from store user
  const initialForm = useMemo(() => {
    const fromI18n = normalizeBackendLanguage(i18n.language)
    const currentLanguage: SupportedLanguage = user?.language
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
      date_of_birth: '',
      telegram: '',
      city: '',
      address: '',
      nova_poshta_branch: '',
      currentPassword: '',
      newPassword: '',
    }
  }, [user, i18n.language])

  const [form, setForm] = useState(initialForm)

  // Whether the user has actually chosen a work format in this session. It
  // cannot be inferred by comparing values: the field falls back to office for
  // display, so a user picking office when the server holds remote produces no
  // difference to compare and the correction would never be sent.
  const [workFormatTouched, setWorkFormatTouched] = useState(false)

  const [savedProfileSnapshot, setSavedProfileSnapshot] = useState(() => ({
    email: initialForm.email,
    first_name: initialForm.first_name,
    last_name: initialForm.last_name,
    middle_name: initialForm.middle_name,
    phone: initialForm.phone,
    language: initialForm.language,
    timezone: initialForm.timezone,
    work_format: initialForm.work_format,
    agent_status: initialForm.agent_status,
    date_of_birth: initialForm.date_of_birth,
    telegram: initialForm.telegram,
    city: initialForm.city,
    address: initialForm.address,
    nova_poshta_branch: initialForm.nova_poshta_branch,
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

  // Read inside the re-sync effect below, which must not re-run when they
  // change - only when the user does.
  const latest = useRef({ form, savedProfileSnapshot, workFormatTouched })
  useEffect(() => {
    latest.current = { form, savedProfileSnapshot, workFormatTouched }
  }, [form, savedProfileSnapshot, workFormatTouched])

  // Re-sync form when auth user loads or is refreshed (e.g. after permission refresh / project switch)
  //
  // A refresh can land in the middle of an edit: it runs on mount, and again
  // after every photo upload or removal. So a server value is taken only for a
  // field the user has not touched. Overwriting a touched one would discard
  // what they typed, and because the snapshot moves in step the unsaved-changes
  // bar would vanish with it - the edit would be gone with nothing to say so.
  useEffect(() => {
    if (!user) return

    const {
      form: current,
      savedProfileSnapshot: saved,
      workFormatTouched: touched,
    } = latest.current
    const serverLanguage = user.language
      ? (normalizeBackendLanguage(user.language) as SupportedLanguage)
      : undefined

    const edited = {
      email: current.email !== saved.email,
      first_name: current.first_name !== saved.first_name,
      last_name: current.last_name !== saved.last_name,
      timezone: current.timezone !== saved.timezone,
      language: current.language !== saved.language,
      agent_status: current.agent_status !== saved.agent_status,
      // Picking the value already displayed leaves nothing to compare, which is
      // what the flag is for. Without it the pick would be silently reverted
      // here while the flag survived to save the reverted value.
      work_format: touched || current.work_format !== saved.work_format,
    }

    const take = <T,>(isEdited: boolean, mine: T, incoming: T | undefined): T =>
      isEdited || incoming === undefined ? mine : incoming

    setForm((prev) => ({
      ...prev,
      username: user.username || prev.username,
      agent_status: take(edited.agent_status, prev.agent_status, user.agent_status || undefined),
      email: take(edited.email, prev.email, user.email || undefined),
      first_name: take(edited.first_name, prev.first_name, user.firstName || undefined),
      last_name: take(edited.last_name, prev.last_name, user.lastName || undefined),
      timezone: take(edited.timezone, prev.timezone, user.timezone || undefined),
      language: take(edited.language, prev.language, serverLanguage),
      work_format: take(edited.work_format, prev.work_format, user.work_format ?? undefined),
    }))

    // The snapshot is what the server holds, so it always follows the server -
    // no edited check here. That is what makes "changed" mean "differs from the
    // server": an untouched field moves with it and reads as clean, while a
    // field the form is holding an edit for stays different and keeps offering
    // to save.
    setSavedProfileSnapshot((prev) => ({
      ...prev,
      email: user.email || prev.email,
      first_name: user.firstName || prev.first_name,
      last_name: user.lastName || prev.last_name,
      timezone: user.timezone || prev.timezone,
      language: serverLanguage ?? prev.language,
      work_format: user.work_format ?? prev.work_format,
      agent_status: user.agent_status || prev.agent_status,
    }))
  }, [user])

  /*
   * The card fields answer from their own request, so they arrive after the
   * form has already rendered - and they can arrive again on a refetch. The
   * rule is the one the auth user follows above: take a server value only for
   * a field nobody has touched, and let the snapshot follow the server either
   * way, so an untouched field reads as clean and an edited one keeps offering
   * to save.
   */
  useEffect(() => {
    if (!myPersonal) return

    const { form: current, savedProfileSnapshot: saved } = latest.current

    setForm((prev) => {
      const next = { ...prev }
      for (const field of MY_PERSONAL_FIELDS) {
        if (current[field] !== saved[field]) continue
        next[field] = myPersonal[field] ?? ''
      }
      return next
    })

    setSavedProfileSnapshot((prev) => {
      const next = { ...prev }
      for (const field of MY_PERSONAL_FIELDS) {
        next[field] = myPersonal[field] ?? ''
      }
      return next
    })
  }, [myPersonal])

  const hasProfileChanges = useMemo(() => {
    return (
      form.email !== savedProfileSnapshot.email ||
      form.first_name !== savedProfileSnapshot.first_name ||
      form.last_name !== savedProfileSnapshot.last_name ||
      form.middle_name !== savedProfileSnapshot.middle_name ||
      form.phone !== savedProfileSnapshot.phone ||
      form.language !== savedProfileSnapshot.language ||
      form.timezone !== savedProfileSnapshot.timezone ||
      form.work_format !== savedProfileSnapshot.work_format ||
      form.agent_status !== savedProfileSnapshot.agent_status ||
      MY_PERSONAL_FIELDS.some((field) => form[field] !== savedProfileSnapshot[field]) ||
      // Picking the value already on screen is not a value change, but it is
      // still something to save: the field may be showing its fallback while
      // the server holds the other one.
      workFormatTouched
    )
  }, [form, savedProfileSnapshot, workFormatTouched])

  // Refresh auth user once on mount so profile has full /me data (projects, agent fields, names)
  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  // Sync when i18n changes externally only (e.g. header switcher). Do not depend on form.language —
  // i18n.changeLanguage is async; including form.language would revert the profile dropdown immediately.
  useEffect(() => {
    const currentLanguage: SupportedLanguage = normalizeBackendLanguage(i18n.language)
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
      // Only when the user actually picked something. The field falls back to
      // office for display, and when /users/me is unavailable the store builds
      // the user from the token, which carries no work format at all - sending
      // the fallback would record a choice nobody made and could overwrite a
      // remote employee with office on an unrelated save.
      work_format: workFormatTouched ? form.work_format : undefined,
    }

    /*
     * The card fields are stored elsewhere, so saving them is a second
     * request. It only goes out when one of them actually changed - a form
     * that always wrote both would turn a language switch into a card write
     * and give a second thing to fail for no reason.
     */
    const personalChanges = MY_PERSONAL_FIELDS.filter(
      (field) => form[field] !== savedProfileSnapshot[field]
    )

    try {
      setIsUpdatingLocal(true)
      await updateMyProfileMutateAsync(updatePayload)

      if (personalChanges.length > 0) {
        await updateMyPersonalMutateAsync(
          Object.fromEntries(
            personalChanges.map((field) => [field, form[field].trim() || null])
          ) as MyPersonalInformationInput
        )
      }

      setSavedProfileSnapshot({
        email: form.email,
        first_name: form.first_name,
        last_name: form.last_name,
        middle_name: form.middle_name,
        phone: form.phone,
        language: form.language,
        timezone: form.timezone,
        work_format: form.work_format,
        agent_status: form.agent_status,
        date_of_birth: form.date_of_birth,
        telegram: form.telegram,
        city: form.city,
        address: form.address,
        nova_poshta_branch: form.nova_poshta_branch,
      })
      setWorkFormatTouched(false)
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
      work_format: savedProfileSnapshot.work_format,
      agent_status: savedProfileSnapshot.agent_status,
      date_of_birth: savedProfileSnapshot.date_of_birth,
      telegram: savedProfileSnapshot.telegram,
      city: savedProfileSnapshot.city,
      address: savedProfileSnapshot.address,
      nova_poshta_branch: savedProfileSnapshot.nova_poshta_branch,
      currentPassword: '',
      newPassword: '',
    }))
    setWorkFormatTouched(false)
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
                  {t('pages.profile.extensionLabel')} {user.asterisk_extension}
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
            {/* Phone binding (Epic 19, #1532): renders nothing while the flag is off. */}
            <AppLoginSection />
          </div>
        </div>

        <div className="bg-card/50 flex w-full flex-1 flex-col items-start gap-6 self-stretch rounded-xl p-4 sm:gap-8 sm:p-6">
          {/* A tab widget is a contract, not a set of roles: the panel has to
              be findable from the tab (`aria-controls`), only the selected tab
              may hold a tab stop, and the arrows must move between them —
              otherwise a screen-reader user is told "tab 1 of 2" and then has
              no way to reach tab 2. */}
          <div
            className="border-border flex w-full items-center gap-1 self-stretch border-b"
            role="tablist"
          >
            {(
              [
                ['account', t('pages.profile.tabs.account', 'Account')],
                ['shortcuts', t('pages.profile.tabs.shortcuts', 'Keyboard Shortcuts')],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`profile-tab-${id}`}
                // Only the selected panel is mounted, so pointing the inactive
                // tab at it would leave a dangling IDREF — worse than omitting
                // the attribute, which ARIA permits.
                aria-controls={activeTab === id ? `profile-tabpanel-${id}` : undefined}
                aria-selected={activeTab === id}
                tabIndex={activeTab === id ? 0 : -1}
                onClick={() => setActiveTab(id)}
                // On the tab rather than the tablist: only the selected tab is
                // focusable, so it is the element that actually receives the
                // key, and a container listener would need a tab stop of its
                // own to be reachable at all.
                onKeyDown={(e) => {
                  const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
                  if (step === 0) return
                  e.preventDefault()
                  const order = ['account', 'shortcuts'] as const
                  const next =
                    order[(order.indexOf(activeTab) + step + order.length) % order.length]
                  setActiveTab(next)
                  // Roving focus follows the selection, or the arrow moves the
                  // highlight while the keyboard stays on the tab left behind.
                  document.getElementById(`profile-tab-${next}`)?.focus()
                }}
                className={
                  activeTab === id
                    ? 'text-foreground border-primary-500 -mb-px border-b-2 px-3 py-2 text-sm font-medium'
                    : 'text-muted-foreground hover:text-foreground -mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium'
                }
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'shortcuts' ? (
            <div
              role="tabpanel"
              id="profile-tabpanel-shortcuts"
              aria-labelledby="profile-tab-shortcuts"
              className="flex w-full flex-col self-stretch"
            >
              <KeyboardShortcutsSettings />
            </div>
          ) : (
            <div
              role="tabpanel"
              id="profile-tabpanel-account"
              aria-labelledby="profile-tab-account"
              className="flex w-full flex-col items-start gap-6 self-stretch sm:gap-8"
            >
              <AppearanceSettings />

              <form
                onSubmit={handleSave}
                className="border-border flex w-full flex-col items-center gap-4 self-stretch border-t pt-6 sm:gap-6"
              >
                <span className="text-foreground self-stretch text-base leading-[150%] font-medium tracking-[-0.36px] sm:text-[18px]">
                  {t('pages.users.modals.edit.title')}
                </span>
                <div className="flex w-full flex-col items-center gap-6 self-stretch">
                  <div className="flex w-full flex-col items-start gap-4 self-stretch md:flex-row">
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
                  <div className="flex w-full flex-col items-start gap-4 self-stretch md:flex-row">
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
                  <div className="flex w-full flex-col items-start gap-4 self-stretch md:flex-row">
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
                  <div className="flex w-full flex-col items-start gap-4 self-stretch md:flex-row">
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
                              onClick={() => {
                                setWorkFormatTouched(true)
                                setForm({ ...form, work_format: option.value })
                              }}
                            >
                              <span className="flex w-full items-center justify-between gap-2">
                                <span>{option.label}</span>
                                {form.work_format === option.value ? (
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
                  </div>

                  {/* Call Settings Section - Only visible for agents */}
                  {user?.is_agent && (
                    <div className="flex w-full flex-col items-start gap-4 self-stretch md:flex-row">
                      <Input
                        label={t('pages.users.forms.asteriskExtension') || 'Asterisk Extension'}
                        value={user?.asterisk_extension || ''}
                        disabled
                        onChange={() => {}}
                        placeholder={t('pages.users.forms.placeholders.notSet') || 'Not set'}
                        className="w-full"
                      />
                      <Input
                        label={
                          t('pages.users.forms.dialerExtension') || 'Predictive Dialer Extension'
                        }
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
                  <div className="flex w-full flex-col items-start gap-4 self-stretch md:flex-row">
                    <div className="flex w-full flex-col justify-end gap-2 self-stretch">
                      <Label htmlFor="date-of-birth">
                        {t('pages.employeeCard.fields.dateOfBirth')}
                      </Label>
                      <DateSelect
                        id="date-of-birth"
                        value={parsePickerYMD(form.date_of_birth)}
                        onChange={({ value }) =>
                          setForm({
                            ...form,
                            date_of_birth: value ? formatPickerDateAsYMD(value) : '',
                          })
                        }
                        max={new Date()}
                        format="dd.MM.yyyy"
                        allowManualInput
                        placeholder={t('pages.employeeCard.fields.dateOfBirth')}
                      />
                    </div>

                    <Input
                      label={t('pages.employeeCard.fields.telegram')}
                      value={form.telegram}
                      onChange={(e) => setForm({ ...form, telegram: e.target.value })}
                      className="w-full"
                    />
                  </div>

                  <div className="flex w-full flex-col items-start gap-4 self-stretch md:flex-row">
                    <Input
                      label={t('pages.employeeCard.fields.city')}
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className="w-full"
                    />

                    <Input
                      label={t('pages.employeeCard.fields.novaPoshta')}
                      value={form.nova_poshta_branch}
                      onChange={(e) => setForm({ ...form, nova_poshta_branch: e.target.value })}
                      className="w-full"
                    />
                  </div>

                  {/* The address takes the row on its own: it is the longest
                      thing anybody types here, and paired with a short field it
                      was the one that ran out of room first. */}
                  <Input
                    label={t('pages.employeeCard.fields.address')}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full"
                  />
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
          )}
        </div>
      </div>
    </div>
  )
}

export default ProfileSettingsPage
