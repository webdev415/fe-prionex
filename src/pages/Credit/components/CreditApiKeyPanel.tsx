/**
 * Ввод сервисного ключа стенда.
 *
 * Зачем экран, а не консоль. На этапе 1 операторские ручки модуля закрыты
 * статическим ключом (`X-Internal-Api-Key`) — JWT появится на этапе 2 (WS-20).
 * Ключ уже читался из sessionStorage, но вписать его было НЕГДЕ: `setStandApiKey`
 * не вызывался ни из одного экрана, то есть на стенде с непустым ключом раздел
 * молча отдавал 401 всем, кроме того, кто знает про консоль браузера.
 *
 * Почему sessionStorage, а не localStorage, — в creditApi.ts: ключ умирает
 * вместе с вкладкой и не остаётся лежать на общей машине. Отсюда третья строка
 * подсказки: повторный запрос ключа после закрытия вкладки — это не поломка.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { getStandApiKey, setStandApiKey } from '@/features/credit/api/creditApi'

export function CreditApiKeyPanel({ onSaved }: { onSaved?: () => void }) {
  const { t } = useTranslation('common')
  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState(() => Boolean(getStandApiKey()))

  const save = () => {
    setStandApiKey(draft.trim())
    setSaved(Boolean(draft.trim()))
    setDraft('')
    onSaved?.()
    // Перезагрузка, а не инвалидация: ключ читает интерцептор axios, и уже
    // выполненные запросы кешированы React Query с прежним заголовком.
    window.location.reload()
  }

  return (
    <div className="border-border bg-card rounded-xl border p-4 shadow-sm">
      <p className="text-foreground text-sm font-medium">{t('credit.standKey.title')}</p>
      <p className="text-muted-foreground mt-1 text-sm">{t('credit.standKey.where')}</p>
      <p className="text-muted-foreground mt-1 text-sm">{t('credit.standKey.lifetime')}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="min-w-[280px] flex-1">
          <Input
            type="password"
            value={draft}
            autoComplete="off"
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('credit.standKey.placeholder')}
          />
        </div>
        <Button type="button" onClick={save} disabled={!draft.trim()}>
          {t('credit.standKey.save')}
        </Button>
        {saved && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setStandApiKey('')
              setSaved(false)
              window.location.reload()
            }}
          >
            {t('credit.standKey.clear')}
          </Button>
        )}
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        {saved ? t('credit.standKey.present') : t('credit.standKey.absent')}
      </p>
    </div>
  )
}

export default CreditApiKeyPanel
