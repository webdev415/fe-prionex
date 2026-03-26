/**
 * Mutex Group Form Modal
 *
 * Modal for creating mutex groups by selecting tags.
 * Only one tag from a mutex group can be active on a client at the same time.
 */

import { useState, useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { useUpdateTag } from '@/features/tags'
import type { TagDefinition } from '@/features/tags'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Icons } from '@/lib/icons'

interface MutexGroupFormModalProps {
  open: boolean
  tags: TagDefinition[]
  onClose: () => void
  onSuccess: () => void
}

type MutexGroupFormData = {
  groupName: string
  description?: string
}

export function MutexGroupFormModal({ open, tags, onClose, onSuccess }: MutexGroupFormModalProps) {
  const { t } = useTranslation('common')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])

  const updateTagMutation = useUpdateTag()

  const schema = useMemo(
    () =>
      z.object({
        groupName: z
          .string()
          .min(1, t('pages.tags.groups.validation.nameRequired', 'Group name is required'))
          .max(50, t('pages.tags.groups.validation.nameMax', 'Max 50 characters'))
          .regex(
            /^[a-z][a-z0-9_]*$/,
            t(
              'pages.tags.groups.validation.nameFormat',
              'Only lowercase letters, numbers, underscores'
            )
          ),
        description: z
          .string()
          .max(
            200,
            t(
              'pages.tags.groups.validation.descriptionMax',
              'Description must be 200 characters or less'
            )
          )
          .optional(),
      }),
    [t]
  )

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<MutexGroupFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      groupName: '',
      description: '',
    },
  })

  const handleToggleTag = useCallback((tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }, [])

  const onSubmit = useCallback(
    async (data: MutexGroupFormData) => {
      if (selectedTagIds.length < 2) return

      try {
        await Promise.all(
          selectedTagIds.map((tagId) =>
            updateTagMutation.mutateAsync({
              id: tagId,
              data: { mutex_group: data.groupName },
            })
          )
        )
        onSuccess()
      } catch (error) {
        console.error('Failed to create group:', error)
      }
    },
    [selectedTagIds, updateTagMutation, onSuccess]
  )

  const handleClose = useCallback(() => {
    reset()
    setSelectedTagIds([])
    onClose()
  }, [reset, onClose])

  const isPending = isSubmitting || updateTagMutation.isPending
  const hasEnoughTags = selectedTagIds.length >= 2

  return (
    <Modal open={open} onClose={handleClose} className="max-w-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="min-w-0">
        <ModalHeader
          icon={
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
              <Icons.Add size={20} className="text-green-600" strokeWidth={2} />
            </div>
          }
          title={t('pages.tags.groups.createGroup', 'Create mutex group')}
        />

        <ModalContent>
          <div className="space-y-5">
            {/* Info banner */}
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
              <Icons.Info size={16} className="mt-0.5 shrink-0" />
              <span>
                {t(
                  'pages.tags.groups.mutexHint',
                  'Only one tag from this group can be active on a client at the same time'
                )}
              </span>
            </div>

            {/* Group Name */}
            <div className="space-y-1.5">
              <Label htmlFor="groupName" required>
                {t('pages.tags.groups.name', 'Group name')}
              </Label>
              <Input
                id="groupName"
                {...register('groupName')}
                placeholder="e.g. payment_agreement"
                error={errors.groupName?.message}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">
                {t('pages.tags.groups.description', 'Description')} (
                {t('pages.tags.fields.optional', 'Optional')})
              </Label>
              <Input
                id="description"
                {...register('description')}
                placeholder="e.g. Tип договоренности с клиентом"
                error={errors.description?.message}
              />
            </div>

            {/* Tag selection */}
            <div className="space-y-1.5">
              <Label required>{t('pages.tags.groups.selectTags', 'Select tags')}</Label>
              {!hasEnoughTags && selectedTagIds.length > 0 && (
                <p className="text-xs text-amber-600">
                  {t(
                    'pages.tags.groups.minTagsWarning',
                    'Select at least 2 tags to form a mutex group'
                  )}
                </p>
              )}

              <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
                {tags.length === 0 && (
                  <p className="py-4 text-center text-sm text-gray-400">
                    {t('pages.tags.groups.noTags', 'No tags available')}
                  </p>
                )}

                {tags.map((tag) => {
                  const isChecked = selectedTagIds.includes(tag.id)
                  const hasOtherGroup = tag.mutex_group && tag.mutex_group !== ''

                  return (
                    <label
                      key={tag.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-gray-50 ${
                        isChecked ? 'bg-green-50' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleTag(tag.id)}
                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-sm font-medium text-gray-900">{tag.name}</span>
                        {tag.code && (
                          <span className="ml-1.5 text-xs text-gray-400">{tag.code}</span>
                        )}
                      </span>
                      {hasOtherGroup && (
                        <span className="shrink-0 text-xs text-amber-500">
                          ({t('pages.tags.groups.alreadyInGroup', 'already in group')}:{' '}
                          {tag.mutex_group})
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>

              <p className="text-xs text-gray-500">
                {t('pages.tags.groups.selected', 'Selected')}: {selectedTagIds.length}
              </p>
            </div>
          </div>
        </ModalContent>

        <ModalFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
            {t('actions.cancel', 'Cancel')}
          </Button>
          <Button type="submit" disabled={!hasEnoughTags} isLoading={isPending}>
            {t('actions.create', 'Create')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
