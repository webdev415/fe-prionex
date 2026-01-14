import { useState, useMemo } from 'react'
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
  const { t } = useTranslation('common')
  const { mutateAsync: updateUserMutateAsync } = useUpdateUser()
  const [isUpdatingLocal, setIsUpdatingLocal] = useState(false)
  const [isChangingLocal, setIsChangingLocal] = useState(false)
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)

  // Local form state initialized from store user
  const initialForm = useMemo(() => {
    return {
      username: user?.username || '',
      email: user?.email || '',
      first_name: user?.firstName || '',
      last_name: user?.lastName || '',
      middle_name: '',
      phone: '',
      language: 'en',
      timezone: 'Europe/Kyiv',
      currentPassword: '',
      newPassword: '',
    }
  }, [user])

  const [form, setForm] = useState(initialForm)

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
      <span className="text-dark-500 text-2xl leading-[120%] font-light tracking-[-0.48px]">
        {t('pages.profile.title')}
      </span>

      <div className="flex items-start gap-5 self-stretch">
        {/* Left panel */}
        <div className="flex w-[25%] flex-col items-center gap-5 self-stretch rounded-xl bg-white/50 px-6 py-11">
          <div className="flex flex-col items-center gap-4 self-stretch">
            <div className="bg-secondary-800 relative flex flex-col items-center justify-center gap-[10px] rounded-full border border-white p-3">
              <div className="border-primary-300 absolute flex h-15 w-15 items-center justify-center rounded-full border-2 bg-transparent"></div>
              <Icons.User02 size={40} className="text-primary-500" />
            </div>
            <div className="text-dark-500 text-xl leading-[132%] font-medium tracking-[-0.4px]">
              {user?.username}
            </div>
            <div className="flex flex-col items-center gap-3 self-stretch">
              <ProjectSelector />
              <span className="text-base leading-[155%] font-light tracking-[-0.32px] text-gray-700">
                {t('pages.profile.roleLabel')}{' '}
                <span className="text-dark-500 font-medium">{user?.active_role_name || ''}</span>
              </span>
            </div>
          </div>
          <Button
            onClick={() => setIsChangePasswordOpen(true)}
            variant="secondary"
            className="h-12 rounded-md"
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
        <div className="flex flex-1 flex-col items-start gap-3 rounded-xl bg-white/50 p-6">
          <form onSubmit={handleSave} className="flex flex-col items-center gap-6 self-stretch">
            <span className="text-dark-500 self-stretch text-[18px] leading-[150%] font-medium tracking-[-0.36px]">
              {t('pages.users.modals.edit.title')}
            </span>
            <div className="flex flex-col items-center gap-4 self-stretch">
              <div className="flex items-start gap-4 self-stretch">
                <Input
                  label={t('pages.users.forms.username')}
                  value={form.username}
                  disabled
                  onChange={() => {}}
                  helperText={t('pages.users.editForm.usernameCannotBeChanged')}
                />
                <Input
                  label={t('pages.users.forms.email')}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="flex items-start gap-4 self-stretch">
                <Input
                  label={t('pages.users.forms.firstName')}
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  required
                />

                <Input
                  label={t('pages.users.forms.lastName')}
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  required
                />
              </div>
              <div className="flex items-start gap-4 self-stretch">
                <Input
                  label={t('pages.users.forms.middleName')}
                  value={form.middle_name}
                  onChange={(e) => setForm({ ...form, middle_name: e.target.value })}
                />

                <Input
                  label={t('pages.users.forms.phone')}
                  placeholder={t('pages.users.forms.placeholders.phone')}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="flex items-start gap-4 self-stretch">
                <div className="flex w-full flex-col gap-2 self-stretch">
                  <Label htmlFor="language">{t('pages.users.forms.language')}</Label>
                  <LanguageSwitcher
                    id="language"
                    variant="dashboard"
                    value={form.language}
                    onValueChange={(v: string) => setForm({ ...form, language: v })}
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
            <div className="mt-4 flex items-center gap-4">
              <Button
                type="button"
                variant="cancel"
                onClick={handleCancel}
                className="h-12 rounded-full px-10"
              >
                {t('actions.cancel')}
              </Button>
              <DoubleButton
                type="submit"
                icon={<Icons.Success size={24} />}
                iconPosition="left"
                disabled={isUpdatingLocal || isChangingLocal}
                className="h-12"
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
