import { useState, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useAuth } from '@/features/auth'
import { authApi } from '@/features/auth/api/authApi'
import { useUpdateUser } from '@/features/users/hooks/useUpdateUser'
import { timezoneOptions } from '@/features/users/schemas/userSchemas'
import { Input } from '@/components/ui/Input'
import { ProjectSelector } from '@/components/layout/ProjectSelector'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { ChangePasswordModal } from '@/features/auth'
export function ProfileSettingsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const { t, i18n } = useTranslation('common')
  const { mutateAsync: updateUserMutateAsync } = useUpdateUser()
  const [isUpdatingLocal, setIsUpdatingLocal] = useState(false)
  const [isChangingLocal, setIsChangingLocal] = useState(false)
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)

  // Local form state initialized from store user
  const initialForm = useMemo(() => {
    // Get current language from i18n (which reads from localStorage via LanguageDetector)
    const currentLanguage = (i18n.language as 'en' | 'uk' | 'ru') || 'en'
    return {
      username: user?.username || '',
      email: user?.email || '',
      first_name: user?.firstName || '',
      last_name: user?.lastName || '',
      middle_name: '',
      phone: '',
      language: currentLanguage,
      timezone: 'Europe/Kyiv',
      currentPassword: '',
      newPassword: '',
    }
  }, [user, i18n.language])

  const [form, setForm] = useState(initialForm)

  // Sync form language with i18n language when it changes externally (e.g., from header)
  useEffect(() => {
    const currentLanguage = (i18n.language as 'en' | 'uk' | 'ru') || 'en'
    if (form.language !== currentLanguage) {
      setForm((prev) => ({ ...prev, language: currentLanguage }))
    }
  }, [i18n.language, form.language])

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
    return <div className="py-12 text-center text-gray-600">{t('status.loading')}</div>
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

    const updatePayload: Record<string, unknown> = {
      email: form.email,
      first_name: form.first_name,
      last_name: form.last_name,
      middle_name: form.middle_name || undefined,
      phone: form.phone || undefined,
      language: (form.language as 'en' | 'uk' | 'ru') || undefined,
      timezone: form.timezone || undefined,
    }

    try {
      setIsUpdatingLocal(true)
      await updateUserMutateAsync({ userId: Number(user.id), data: updatePayload })
      toast.success(t('pages.profile.profileUpdated'))
      setForm((f) => ({ ...f, currentPassword: '', newPassword: '' }))
    } finally {
      setIsUpdatingLocal(false)
    }
  }

  const handleCancel = () => {
    setForm(initialForm)
  }

  return (
    <div className="flex flex-col items-start gap-4 self-stretch p-0">
      <span className="text-dark-500 text-xl leading-[120%] font-light tracking-[-0.48px] sm:text-2xl">
        {t('pages.profile.title')}
      </span>

      <div className="flex flex-col items-start gap-4 self-stretch lg:flex-row lg:gap-5">
        {/* Left panel */}
        <div className="flex w-full flex-col items-center gap-4 self-stretch rounded-xl bg-white/50 px-4 py-6 sm:gap-5 sm:px-6 sm:py-8 lg:w-[25%] lg:py-11">
          <div className="flex flex-col items-center gap-4 self-stretch">
            <div className="bg-secondary-800 relative flex flex-col items-center justify-center gap-[10px] rounded-full border border-white p-3">
              <div className="border-primary-300 absolute flex h-15 w-15 items-center justify-center rounded-full border-2 bg-transparent"></div>
              <Icons.User02 size={40} className="text-primary-500" />
            </div>
            <div className="text-dark-500 text-lg leading-[132%] font-medium tracking-[-0.4px] sm:text-xl">
              {user?.username}
            </div>
            <div className="flex flex-col items-center gap-3 self-stretch">
              <ProjectSelector />
              <span className="text-sm leading-[155%] font-light tracking-[-0.32px] text-gray-700 sm:text-base">
                {t('pages.profile.roleLabel')}{' '}
                <span className="text-dark-500 font-medium">{user?.active_role_name || ''}</span>
              </span>
            </div>
          </div>
          <Button
            onClick={() => setIsChangePasswordOpen(true)}
            variant="secondary"
            className="h-12 w-full rounded-md lg:w-auto"
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
        </div>

        {/* Right: form */}
        <div className="flex w-full flex-1 flex-col items-start gap-3 rounded-xl bg-white/50 p-4 sm:p-6">
          <form
            onSubmit={handleSave}
            className="flex w-full flex-col items-center gap-4 self-stretch sm:gap-6"
          >
            <span className="text-dark-500 self-stretch text-base leading-[150%] font-medium tracking-[-0.36px] sm:text-[18px]">
              {t('pages.users.modals.edit.title')}
            </span>
            <div className="flex w-full flex-col items-center gap-4 self-stretch">
              <div className="flex w-full flex-col items-start gap-4 self-stretch lg:flex-row">
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
              <div className="flex w-full flex-col items-start gap-4 self-stretch lg:flex-row">
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
              <div className="flex w-full flex-col items-start gap-4 self-stretch lg:flex-row">
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
              <div className="flex w-full flex-col items-start gap-4 self-stretch lg:flex-row">
                <div className="flex w-full flex-col gap-2 self-stretch">
                  <Label htmlFor="language">{t('pages.users.forms.language')}</Label>
                  <LanguageSwitcher
                    id="language"
                    variant="dashboard"
                    value={form.language}
                    onValueChange={(v: string) =>
                      setForm({ ...form, language: v as 'en' | 'uk' | 'ru' })
                    }
                  />
                </div>

                <div className="flex w-full flex-col gap-2 self-stretch">
                  <Label htmlFor="timezone">{t('pages.users.forms.timezone')}</Label>
                  <Select
                    value={form.timezone}
                    onValueChange={(v: string) => setForm({ ...form, timezone: v })}
                  >
                    <SelectTrigger id="timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezoneOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
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
                icon={<Icons.Success size={28} />}
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
          </form>
        </div>
      </div>
    </div>
  )
}

export default ProfileSettingsPage
