import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { useMutation } from '@tanstack/react-query'
import { Icons } from '@/lib/icons'
import { useAuth } from '@/features/auth'
import { authApi } from '@/features/auth/api/authApi'
import { useUpdateUser } from '@/features/users/hooks/useUpdateUser'
import { languageOptions, timezoneOptions } from '@/features/users/schemas/userSchemas'
import { Input } from '@/components/ui/Input'
import { ProjectSelector } from '@/components/layout/ProjectSelector'
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
      toast.success('Password changed')
    },
    onError: () => {
      toast.error('Failed to change password')
    },
  })

  if (authLoading) {
    return <div className="py-12 text-center text-gray-600">Loading...</div>
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
      toast.success('Profile updated')
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
        Profile Setting
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
              <ProjectSelector variant="profile" />
              <div className="text-xs text-gray-500">Role: {user?.active_role_name || ''}</div>
            </div>
          </div>
          <Button
            onClick={() => setIsChangePasswordOpen(true)}
            variant="secondary"
            className="h-12 rounded-md"
            leftIcon={<Icons.LockSync01 size={24} />}
          >
            Reset Password
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
              Edit User
            </span>
            <div className="flex flex-col items-center gap-4 self-stretch">
              <div className="flex items-start gap-4 self-stretch">
                <Input
                  label="Username:"
                  value={form.username}
                  disabled
                  onChange={() => {}}
                  helperText=" Username cannot be changed"
                />
                <Input
                  label="Email: *"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="flex items-start gap-4 self-stretch">
                <Input
                  label="First Name: *"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  required
                />

                <Input
                  label="Last Name: *"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  required
                />
              </div>
              <div className="flex items-start gap-4 self-stretch">
                <Input
                  label="Middle Name:"
                  value={form.middle_name}
                  onChange={(e) => setForm({ ...form, middle_name: e.target.value })}
                />

                <Input
                  label="Phone:"
                  placeholder="+1-555-0101 (optional)"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="flex items-start gap-4 self-stretch">
                <div className="flex w-full flex-col gap-2 self-stretch">
                  <Label htmlFor="language">Language:</Label>
                  <Select
                    value={form.language}
                    onValueChange={(v: string) => setForm({ ...form, language: v })}
                  >
                    <SelectTrigger id="language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languageOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex w-full flex-col gap-2 self-stretch">
                  <Label htmlFor="timezone">Timezone:</Label>
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
                Cancel
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
                Save Changes
              </DoubleButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ProfileSettingsPage
