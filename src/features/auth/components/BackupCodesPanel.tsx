import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui'
import { Icons } from '@/lib/icons'

interface BackupCodesPanelProps {
  codes: string[]
  /**
   * Override for the “shown only once” warning banner.
   * - `undefined` → show the default banner (`twoFactor.backupCodes.warning`).
   * - `string`    → show that string in the banner.
   * - `null`      → suppress the banner entirely (caller already states the
   *                 same thing in surrounding copy).
   */
  warning?: string | null
}

/**
 * One-shot display of backup codes. Provides a Copy-all and a Download-as-txt
 * action; the parent decides what to do with them after the user confirms
 * they've saved them.
 */
export function BackupCodesPanel({ codes, warning }: BackupCodesPanelProps) {
  const { t } = useTranslation('auth')
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      setCopied(true)
      toast.success(t('twoFactor.backupCodes.copied'))
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('twoFactor.backupCodes.copyFailed'))
    }
  }

  const handleDownload = () => {
    const blob = new Blob([codes.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prionex-backup-codes.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3">
      {warning !== null && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700 sm:text-sm">
          <Icons.Warning size={18} className="mt-0.5 flex-shrink-0" />
          <span>{warning || t('twoFactor.backupCodes.warning')}</span>
        </div>
      )}

      <div className="bg-light-100 grid grid-cols-2 gap-2 rounded-md border border-gray-300 p-3 sm:gap-3 sm:p-4">
        {codes.map((code) => (
          <code
            key={code}
            className="text-dark-500 rounded border border-gray-200 bg-white px-2 py-1.5 text-center font-mono text-xs select-all sm:text-sm"
          >
            {code}
          </code>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="secondary"
          onClick={handleCopy}
          leftIcon={<Icons.Success size={18} />}
          className="h-10 flex-1"
        >
          {copied ? t('twoFactor.backupCodes.copied') : t('twoFactor.backupCodes.copyAll')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={handleDownload}
          leftIcon={<Icons.Download size={18} />}
          className="h-10 flex-1"
        >
          {t('twoFactor.backupCodes.download')}
        </Button>
      </div>
    </div>
  )
}

export default BackupCodesPanel
