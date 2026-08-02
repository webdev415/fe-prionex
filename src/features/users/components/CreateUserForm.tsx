/**
 * CreateUserForm Component
 *
 * Form for creating a new user with validation.
 * Matches the design: User Credentials, Assign Projects, Role per Project, Status.
 * All fields match the backend API requirements from api-prionex.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCreateUser } from '../hooks/useCreateUser'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Label } from '@/components/ui/Label'
import { Alert } from '@/components/ui/Alert'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { createUserSchema } from '../schemas/userSchemas'
import { ProjectRoleGroupRow } from './ProjectRoleGroupRow'

interface Project {
  id: number
  name: string
  code: string
}

interface CreateUserFormProps {
  projects: Project[]
  onSuccess: () => void
  onCancel?: () => void
}

// Extended schema to support multiple projects with roles
// Note: Validation messages will be translated in the component
const createUserFormSchema = createUserSchema
  .extend({
    confirmPassword: z.string(),
    selectedProjects: z.array(z.number()).min(1, 'SELECT_AT_LEAST_ONE_PROJECT'),
    projectRoles: z.record(z.string(), z.number()),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'PASSWORDS_DONT_MATCH',
    path: ['confirmPassword'],
  })
  .refine(
    (data) => {
      // Check if every selected project has a role assigned
      return data.selectedProjects.every((projectId) => {
        const projectIdStr = String(projectId)
        return data.projectRoles[projectIdStr] !== undefined
      })
    },
    {
      message: 'ASSIGN_ROLE_FOR_EACH_PROJECT',
      path: ['projectRoles'],
    }
  )

type CreateUserFormData = z.infer<typeof createUserFormSchema>

export function CreateUserForm({ projects, onSuccess }: CreateUserFormProps) {
  const { t } = useTranslation('common')
  const { mutate, isError, error } = useCreateUser()
  const [selectedProjects, setSelectedProjects] = useState<number[]>([])
  const [projectRoles, setProjectRoles] = useState<Record<number, number>>({})
  const [projectGroups, setProjectGroups] = useState<Record<number, number | undefined>>({})

  const {
    register,
    handleSubmit,
    control,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<CreateUserFormData>({
    // zodResolver typing doesn't fully match our extended schema; cast is safe here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createUserFormSchema) as any,
    defaultValues: {
      language: 'uk' as const,
      timezone: 'Europe/Kyiv',
      must_change_password: false,
      selectedProjects: [] as number[],
      projectRoles: {} as Record<string, number>,
    },
  })

  const handleProjectToggle = async (projectId: number, checked: boolean) => {
    const newSelected = checked
      ? [...selectedProjects, projectId]
      : selectedProjects.filter((id) => id !== projectId)

    setSelectedProjects(newSelected)
    setValue('selectedProjects', newSelected, { shouldValidate: true })

    if (!checked) {
      // Remove role assignment when project is unchecked
      const newRoles = { ...projectRoles }
      delete newRoles[projectId]
      setProjectRoles(newRoles)
      const newGroups = { ...projectGroups }
      delete newGroups[projectId]
      setProjectGroups(newGroups)
      // Convert number keys to string keys for form validation
      const projectRolesForForm: Record<string, number> = {}
      Object.keys(newRoles).forEach((key) => {
        projectRolesForForm[String(key)] = newRoles[Number(key)]
      })
      setValue('projectRoles', projectRolesForForm, { shouldValidate: true })
      // Manually trigger validation to ensure the error clears
      await trigger(['projectRoles', 'selectedProjects'])
    } else {
      // When a project is checked, trigger validation to show error if no role is assigned
      await trigger(['projectRoles', 'selectedProjects'])
    }
  }

  const handleGroupChange = (projectId: number, groupId: number | undefined) => {
    setProjectGroups((prev) => ({ ...prev, [projectId]: groupId }))
  }

  const handleRoleChange = async (projectId: number, roleId: number) => {
    const newRoles = { ...projectRoles, [projectId]: roleId }
    setProjectRoles(newRoles)
    setProjectGroups((prev) => {
      const next = { ...prev }
      delete next[projectId]
      return next
    })
    // Convert number keys to string keys for form validation
    const projectRolesForForm: Record<string, number> = {}
    Object.keys(newRoles).forEach((key) => {
      projectRolesForForm[String(key)] = newRoles[Number(key)]
    })
    setValue('projectRoles', projectRolesForForm, { shouldValidate: true })
    // Manually trigger validation for both fields to ensure cross-field validation runs
    await trigger(['projectRoles', 'selectedProjects'])
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onSubmit = (data: any) => {
    const formData = data as CreateUserFormData

    // Build project assignments array from all selected projects
    const project_assignments = formData.selectedProjects.map((projectId) => ({
      project_id: projectId,
      role_id: formData.projectRoles[String(projectId)],
      group_id: projectGroups[projectId],
    }))

    // Note: status is not sent to API as users are always created as "active"
    mutate(
      {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name,
        middle_name: formData.middle_name || undefined,
        phone: formData.phone || undefined,
        language: formData.language || 'uk',
        timezone: formData.timezone || 'Europe/Kyiv',
        must_change_password: formData.must_change_password || false,
        asterisk_extension: formData.asterisk_extension || undefined,
        is_agent: formData.is_agent || false,
        project_assignments,
      },
      {
        onSuccess: () => {
          onSuccess()
        },
      }
    )
  }

  return (
    <form id="create-user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* API Error Alert */}
      {isError && (
        <Alert variant="error">
          <div>
            <h3 className="font-semibold">{t('pages.users.forms.errorCreating')}</h3>
            <p className="mt-1 text-sm">
              {error?.message || t('pages.users.forms.errors.failedToCreate')}
            </p>
          </div>
        </Alert>
      )}

      {/* User Credentials Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="username" required>
              {t('pages.users.forms.username')}
            </Label>
            <Input
              id="username"
              placeholder={t('pages.users.forms.placeholders.username')}
              {...register('username')}
              aria-invalid={!!errors.username}
              variant={errors.username ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.username && (
              <p className="mt-1 text-sm text-red-500">{errors.username.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="email" required>
              {t('pages.users.forms.email')}
            </Label>
            <Input
              id="email"
              type="email"
              placeholder={t('pages.users.forms.placeholders.email')}
              {...register('email')}
              aria-invalid={!!errors.email}
              variant={errors.email ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PasswordInput
            id="password"
            label={t('pages.users.forms.password')}
            placeholder={t('pages.users.forms.placeholders.password')}
            {...register('password')}
            aria-invalid={!!errors.password}
            variant={errors.password ? 'error' : 'default'}
            error={errors.password?.message}
            required
          />

          <PasswordInput
            id="confirmPassword"
            label={t('pages.users.forms.confirmPassword')}
            placeholder={t('pages.users.forms.placeholders.confirmPassword')}
            {...register('confirmPassword')}
            aria-invalid={!!errors.confirmPassword}
            variant={errors.confirmPassword ? 'error' : 'default'}
            error={
              errors.confirmPassword?.message === 'PASSWORDS_DONT_MATCH'
                ? t('pages.users.forms.errors.passwordsDontMatch')
                : errors.confirmPassword?.message
            }
            required
          />
        </div>

        <div className="flex items-center gap-2">
          <Controller
            name="must_change_password"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="must_change_password"
                checked={field.value || false}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
            )}
          />
          <Label htmlFor="must_change_password" className="mb-0 cursor-pointer">
            {t('pages.users.forms.mustChangePassword')}
          </Label>
        </div>
      </div>

      {/* Name Fields Section - Required by API */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="first_name" required>
              {t('pages.users.forms.firstName')}
            </Label>
            <Input
              id="first_name"
              placeholder={t('pages.users.forms.placeholders.firstName')}
              {...register('first_name')}
              aria-invalid={!!errors.first_name}
              variant={errors.first_name ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.first_name && (
              <p className="mt-1 text-sm text-red-500">{errors.first_name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="last_name" required>
              {t('pages.users.forms.lastName')}
            </Label>
            <Input
              id="last_name"
              placeholder={t('pages.users.forms.placeholders.lastName')}
              {...register('last_name')}
              aria-invalid={!!errors.last_name}
              variant={errors.last_name ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.last_name && (
              <p className="mt-1 text-sm text-red-500">{errors.last_name.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="middle_name">{t('pages.users.forms.middleName')}</Label>
            <Input
              id="middle_name"
              placeholder={t('pages.users.forms.placeholders.middleName')}
              {...register('middle_name')}
              aria-invalid={!!errors.middle_name}
              variant={errors.middle_name ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.middle_name && (
              <p className="mt-1 text-sm text-red-500">{errors.middle_name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="phone">{t('pages.users.forms.phone')}</Label>
            <Input
              id="phone"
              type="tel"
              placeholder={t('pages.users.forms.placeholders.phone')}
              {...register('phone')}
              aria-invalid={!!errors.phone}
              variant={errors.phone ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.phone && <p className="mt-1 text-sm text-red-500">{errors.phone.message}</p>}
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="language" required>
              {t('pages.users.forms.language')}
            </Label>
            <Controller
              name="language"
              control={control}
              render={({ field }) => (
                <Select value={field.value || 'uk'} onValueChange={field.onChange}>
                  <SelectTrigger className="border-border text-foreground mt-1 w-full border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uk">{t('language.uk')}</SelectItem>
                    <SelectItem value="en">{t('language.en')}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.language && (
              <p className="mt-1 text-sm text-red-500">{errors.language.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="timezone" required>
              {t('pages.users.forms.timezone')}
            </Label>
            <Controller
              name="timezone"
              control={control}
              render={({ field }) => (
                <Select value={field.value || 'Europe/Kyiv'} onValueChange={field.onChange}>
                  <SelectTrigger className="border-border text-foreground mt-1 w-full border text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/Kyiv">Europe/Kyiv (EET/EEST)</SelectItem>
                    <SelectItem value="UTC">UTC (Coordinated Universal Time)</SelectItem>
                    <SelectItem value="America/New_York">America/New York (EST/EDT)</SelectItem>
                    <SelectItem value="America/Chicago">America/Chicago (CST/CDT)</SelectItem>
                    <SelectItem value="America/Denver">America/Denver (MST/MDT)</SelectItem>
                    <SelectItem value="America/Los_Angeles">
                      America/Los Angeles (PST/PDT)
                    </SelectItem>
                    <SelectItem value="Europe/London">Europe/London (GMT/BST)</SelectItem>
                    <SelectItem value="Europe/Paris">Europe/Paris (CET/CEST)</SelectItem>
                    <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                    <SelectItem value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.timezone && (
              <p className="mt-1 text-sm text-red-500">{errors.timezone.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Call Settings Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="asterisk_extension">{t('pages.users.forms.asteriskExtension')}</Label>
            <Input
              id="asterisk_extension"
              placeholder="1001"
              {...register('asterisk_extension')}
              aria-invalid={!!errors.asterisk_extension}
              variant={errors.asterisk_extension ? 'error' : 'default'}
              className="mt-1"
            />
            {errors.asterisk_extension && (
              <p className="mt-1 text-sm text-red-500">{errors.asterisk_extension.message}</p>
            )}
            <p className="text-muted-foreground mt-1 text-xs">
              {t('pages.users.forms.helpers.asteriskExtension')}
            </p>
          </div>

          <div className="flex items-center gap-2 pt-7">
            <Controller
              name="is_agent"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="is_agent"
                  checked={field.value || false}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
              )}
            />
            <Label htmlFor="is_agent" className="mb-0 cursor-pointer">
              {t('pages.users.forms.isAgent')}
            </Label>
          </div>
        </div>
      </div>

      {/* Assign Projects Section */}
      <div className="mt-4 mb-0 space-y-4">
        <h3 className="text-foreground text-sm font-semibold">
          {t('pages.users.forms.assignProjects')}
        </h3>
        <div className="flex flex-wrap gap-4">
          {projects.map((project) => {
            const isChecked = selectedProjects.includes(project.id)
            return (
              <label
                key={project.id}
                className="text-foreground flex cursor-pointer items-center gap-2 text-sm font-light"
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={(checked) => handleProjectToggle(project.id, checked === true)}
                />
                <span className="font-light">{project.name}</span>
              </label>
            )
          })}
        </div>
        {errors.selectedProjects && (
          <p className="text-sm text-red-500">
            {errors.selectedProjects.message === 'SELECT_AT_LEAST_ONE_PROJECT'
              ? t('pages.users.forms.errors.selectAtLeastOneProject')
              : errors.selectedProjects.message}
          </p>
        )}
      </div>

      {/* Role per Project Section */}
      {selectedProjects.length > 0 && (
        <div className="mt-4 mb-0 space-y-4">
          <h3 className="text-foreground text-sm font-semibold">
            {t('pages.users.forms.rolePerProject')}
          </h3>
          <div className="space-y-3">
            {selectedProjects.map((projectId) => (
              <ProjectRoleGroupRow
                key={projectId}
                projectId={projectId}
                projectName={projects.find((p) => p.id === projectId)?.name}
                selectedRoleId={projectRoles[projectId]}
                selectedGroupId={projectGroups[projectId]}
                onRoleChange={(roleId) => handleRoleChange(projectId, roleId)}
                onGroupChange={(groupId) => handleGroupChange(projectId, groupId)}
              />
            ))}
          </div>
          {errors.projectRoles && (
            <p className="text-sm text-red-500">
              {typeof errors.projectRoles.message === 'string' &&
              errors.projectRoles.message === 'ASSIGN_ROLE_FOR_EACH_PROJECT'
                ? t('pages.users.forms.errors.assignRoleForEachProject')
                : typeof errors.projectRoles.message === 'string'
                  ? errors.projectRoles.message
                  : t('pages.users.forms.errors.assignRoleForEachProject')}
            </p>
          )}
        </div>
      )}

      {/* Form Actions - These will be rendered in ModalFooter */}
      <div className="hidden">
        <button type="submit" id="submit-form" />
      </div>
    </form>
  )
}
