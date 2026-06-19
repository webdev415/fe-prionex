/**
 * AddMarkerButton — "Add marker" affordance shown beneath the call player
 * in the trainer Action Analysis flow (KAN-410, Feature 2.2).
 *
 * Opens a small popover with type select + optional comment. Reads the
 * current playback position from the parent-supplied `getCurrentTimeMs`
 * callback so the new marker is stamped exactly where the player was at
 * click time (acceptance: marker created in no more than 2 clicks).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { useCreateMarker } from '../hooks/useMarkers'
import { MARKER_TYPES, type MarkerType } from '../types'

interface AddMarkerButtonProps {
  callId: string
  operatorId: number
  /** Returns the player's current position in ms when the user clicks Add. */
  getCurrentTimeMs: () => number
  onCreated?: () => void
}

export function AddMarkerButton({
  callId,
  operatorId,
  getCurrentTimeMs,
  onCreated,
}: AddMarkerButtonProps) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const [markerType, setMarkerType] = useState<MarkerType>('note')
  const [comment, setComment] = useState('')
  const createMutation = useCreateMarker()

  const handleSubmit = async () => {
    const timestamp_ms = getCurrentTimeMs()
    await createMutation.mutateAsync({
      callId,
      payload: {
        timestamp_ms,
        marker_type: markerType,
        comment: comment.trim() || null,
        operator_id: operatorId,
      },
    })
    setComment('')
    setMarkerType('note')
    setOpen(false)
    onCreated?.()
  }

  return (
    <div className="relative inline-block">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        leftIcon={<Icons.Add size={14} className="text-dark-500" />}
        className="h-[40px] rounded-md text-xs sm:h-[45px] sm:text-sm"
      >
        {t('pages.actionAnalysis.markers.addMarker', 'Add marker')}
      </Button>

      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <label className="text-xs font-medium text-gray-700">
            {t('pages.actionAnalysis.markers.type', 'Type')}
          </label>
          <select
            value={markerType}
            onChange={(e) => setMarkerType(e.target.value as MarkerType)}
            className="mt-1 mb-2 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
          >
            {MARKER_TYPES.map((mt) => (
              <option key={mt} value={mt}>
                {t(`pages.actionAnalysis.markers.types.${mt}`, mt.replace(/_/g, ' '))}
              </option>
            ))}
          </select>

          <label className="text-xs font-medium text-gray-700">
            {t('pages.actionAnalysis.markers.comment', 'Comment')}
          </label>
          <textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('pages.actionAnalysis.markers.commentPlaceholder', 'Optional comment')}
            className="mt-1 mb-3 w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
          />

          <div className="flex justify-end gap-2">
            <Button
              variant="cancel"
              size="sm"
              onClick={() => setOpen(false)}
              className="rounded-md"
            >
              {t('actions.cancel', 'Cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="rounded-md"
            >
              {t('pages.actionAnalysis.markers.save', 'Save')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
