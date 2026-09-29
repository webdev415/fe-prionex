/**
 * The bar of unsaved changes (planner story 5.10, AC2; UX C-08): pinned to the
 * bottom of the settings while the draft differs from the board —
 * «Є незбережені зміни · Скасувати · Зберегти». «Зберегти» checks with the
 * server first (`dry_run`) and saves only a clean check.
 */
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'

interface SaveBarProps {
  busy: boolean
  onCancel: () => void
  onSave: () => void
}

export function SaveBar({ busy, onCancel, onSave }: SaveBarProps) {
  const { t } = useTranslation('planner')
  return (
    <div
      role="region"
      aria-label={t('settings.saveBar.dirty')}
      className="border-border bg-card sticky bottom-0 z-10 flex items-center justify-end gap-3 rounded-lg border px-4 py-2 shadow-sm"
    >
      <span className="text-foreground mr-auto text-sm">{t('settings.saveBar.dirty')}</span>
      <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
        {t('settings.saveBar.cancel')}
      </Button>
      <Button size="sm" onClick={onSave} isLoading={busy}>
        {t('settings.saveBar.save')}
      </Button>
    </div>
  )
}

export default SaveBar
