import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useHasPermission } from '@/hooks'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { useCourses, useEnrollCourse } from '@/features/training/hooks/useCourses'
import { useDrills, useAssignDrill } from '@/features/training/hooks/useDrills'

interface AssignTrainingDialogProps {
  open: boolean
  onClose: () => void
  /** Preselected operator (e.g. the Inbox operator the overlay was opened for). */
  operatorId?: number | null
}

function toggle(list: number[], id: number): number[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

/**
 * Multi-assign picker: published courses (left) + active drills (right) +
 * operator multi-select. Submit creates one enrollment per (course x operator)
 * and one drill assignment per (drill x operator) by reusing the existing
 * enroll / assign endpoints. Submitting requires `manage_coaching_assignments`.
 */
export function AssignTrainingDialog({ open, onClose, operatorId }: AssignTrainingDialogProps) {
  const { t } = useTranslation('common')
  const canAssign = useHasPermission('manage_coaching_assignments')

  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const projectIdNum = activeProjectId ? Number(activeProjectId) : null
  const { data: operators = [] } = useOperators(projectIdNum)
  const { data: coursesData } = useCourses({ status: 'published' }, open)
  const { data: drillsData } = useDrills({ status: 'active' }, open)
  const courses = coursesData?.data ?? []
  const drills = drillsData?.data ?? []

  const enroll = useEnrollCourse()
  const assign = useAssignDrill()

  const [courseIds, setCourseIds] = useState<number[]>([])
  const [drillIds, setDrillIds] = useState<number[]>([])
  const [operatorIds, setOperatorIds] = useState<number[]>(
    operatorId != null ? [operatorId] : []
  )
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = useMemo(
    () => canAssign && operatorIds.length > 0 && courseIds.length + drillIds.length > 0,
    [canAssign, operatorIds, courseIds, drillIds]
  )

  if (!open) return null

  const submit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      for (const courseId of courseIds) {
        await enroll.mutateAsync({ courseId, operatorIds })
      }
      for (const drillId of drillIds) {
        await assign.mutateAsync({ drillId, operatorIds })
      }
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const itemRow = (
    active: boolean,
    onToggle: () => void,
    primary: string,
    secondary: string
  ) => (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#EBECE8] px-3 py-2 hover:bg-[#FAFAFA]">
      <input type="checkbox" checked={active} onChange={onToggle} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs font-medium text-[#05040D]">{primary}</span>
        <span className="truncate text-[10px] text-[#6B7280]">{secondary}</span>
      </span>
    </label>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#EBECE8] px-5 py-4">
          <h3 className="text-base font-semibold text-[#05040D]">
            {t('pages.training.inbox.quickActions.assignCourse', 'Assign course / drill')}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close">
            <Icons.Close size={18} className="text-[#676767]" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-[#05040D]">
                {t('pages.training.assign.courses', 'Published courses')}
              </span>
              {courses.length === 0 ? (
                <p className="text-[11px] text-[#9CA3AF]">
                  {t('pages.training.assign.noCourses', 'No published courses.')}
                </p>
              ) : (
                courses.map((c) =>
                  itemRow(
                    courseIds.includes(c.id),
                    () => setCourseIds((l) => toggle(l, c.id)),
                    c.title,
                    t('pages.training.assign.lessonCount', '{{count}} lessons', {
                      count: c.lesson_count,
                    })
                  )
                )
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-[#05040D]">
                {t('pages.training.assign.drills', 'Active drills')}
              </span>
              {drills.length === 0 ? (
                <p className="text-[11px] text-[#9CA3AF]">
                  {t('pages.training.assign.noDrills', 'No active drills.')}
                </p>
              ) : (
                drills.map((d) =>
                  itemRow(
                    drillIds.includes(d.id),
                    () => setDrillIds((l) => toggle(l, d.id)),
                    d.title,
                    [d.difficulty, d.duration_minutes != null ? `${d.duration_minutes} min` : null]
                      .filter(Boolean)
                      .join(' · ') || t('pages.training.assign.drill', 'Drill')
                  )
                )
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-[#05040D]">
              {t('pages.training.assign.operators', 'Operators')}
            </span>
            <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-[#EBECE8] p-2 sm:grid-cols-2">
              {operators.map((op) => (
                <label
                  key={op.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-[#FAFAFA]"
                >
                  <input
                    type="checkbox"
                    checked={operatorIds.includes(op.id)}
                    onChange={() => setOperatorIds((l) => toggle(l, op.id))}
                  />
                  <span className="truncate text-[#05040D]">{op.full_name}</span>
                </label>
              ))}
            </div>
          </div>

          {!canAssign ? (
            <p className="rounded-lg bg-[#FEF9C3] px-3 py-2 text-[11px] text-[#A16207]">
              {t(
                'pages.training.assign.noPermission',
                'You need the assignment permission to submit.'
              )}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-[#EBECE8] px-5 py-4">
          <span className="text-[11px] text-[#6B7280]">
            {t('pages.training.assign.summary', '{{items}} item(s) → {{ops}} operator(s)', {
              items: courseIds.length + drillIds.length,
              ops: operatorIds.length,
            })}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[#EDEDED] bg-white px-4 py-2 text-xs font-medium text-[#05040D] hover:bg-[#F7F7F7]"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit || submitting}
              className="rounded-md bg-[#204E4D] px-4 py-2 text-xs font-medium text-white hover:bg-[#1a3f3e] disabled:opacity-50"
            >
              {t('pages.training.assign.submit', 'Assign')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AssignTrainingDialog
