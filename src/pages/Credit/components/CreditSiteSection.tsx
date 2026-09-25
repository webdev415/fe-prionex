/**
 * Настройки → Сайт (17-40b).
 *
 * Две вещи и обе — про права CRM, а не кредитного модуля:
 *
 * 1. **Чей сайт.** Права на контент сайта считаются в ОДНОМ проекте —
 *    проекте-владельце (`auth_settings.site_owner_project_id`, auth-service).
 *    Видят его все, кто открыл вкладку. Кто может сменить, решает сервер
 *    (правило PUT 17-40a r2): владелец задан — держатель `manage_settings` в
 *    ТЕКУЩЕМ проекте-владельце; владельца нет — только системный `Admin`
 *    выбираемого проекта; в сеансе «от имени» — никто. Заранее экран знает
 *    лишь две вещи: `manage_settings` в JWT (без него выбор выключен, кнопки
 *    сохранения нет) и сеанс «от имени» (выбор и кнопка выключены — сервер
 *    откажет всегда). Остальное — отказ 403 `SITE_OWNER_CHANGE_DENIED` после
 *    нажатия, названный правилом, а не «спробуйте ще раз»: в bootstrap ответ
 *    зависит от выбираемого проекта, и поля «может ли менять» в GET нет.
 * 2. **Вход в админку сайта.** Своих учёток у админки больше нет: кнопка
 *    просит у auth-service одноразовый ключ (`POST /site-admin/handoff`, живёт
 *    ≤ 60 с) и открывает выданный адрес в новой вкладке. Ключ нигде не
 *    хранится и не показывается: мутация сбрасывается сразу после
 *    `safeHttpUrl`, до `window.open`, — и на годном адресе, и на негодном.
 *
 * Показать ли кнопку, решает ответ сервера `current_user_site_role` — роль в
 * проекте-владельце (`siteAdminEntry`), а не права JWT активного проекта.
 * Когда входа не будет, на месте кнопки сказано почему: не настроено, владелец
 * не выбран, сеанс «от имени», нет права в проекте-владельце.
 *
 * Отказы выдачи ключа называются своими словами (401 / 403 / 409 / 503) —
 * каждый требует от человека разного действия, и общий «не удалось» оставил бы
 * его без подсказки, кому писать.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { PERMISSIONS } from '@/constants/permissions'
import { useHasAnyPermission, useHasPermission } from '@/hooks/usePermissions'
import { safeHttpUrl } from '@/lib/safeUrl'
import { useAuthStore } from '@/stores/authStore'
import { useProjects } from '@/features/projects'
import {
  siteAdminEntry,
  siteAdminErrorKind,
  useSiteAdminHandoff,
  useSiteAdminSettings,
  useUpdateSiteAdminSettings,
} from '@/features/siteAdmin'
import type { SiteAdminEntry, SiteAdminErrorKind } from '@/features/siteAdmin'

/**
 * Ключи перечислены вызовами `t('credit.…')`, а не собраны из имени отказа:
 * страж словарей (`i18nKeys.test.ts`) видит только статические ключи.
 */
function handoffErrorText(kind: SiteAdminErrorKind, t: TFunction): string {
  switch (kind) {
    case 'forbidden':
      return t('credit.settings.site.errors.forbidden')
    case 'owner_not_set':
      return t('credit.settings.site.errors.ownerNotSet')
    case 'not_configured':
      return t('credit.settings.site.errors.notConfigured')
    case 'unavailable':
      return t('credit.settings.site.errors.unavailable')
    case 'session_expired':
      return t('credit.settings.site.errors.sessionExpired')
    default:
      return t('credit.settings.site.errors.failed')
  }
}

/** Что сказать на месте кнопки, когда входа не будет. */
function entryText(entry: SiteAdminEntry, t: TFunction): string {
  switch (entry) {
    case 'not_configured':
      return t('credit.settings.site.errors.notConfigured')
    case 'owner_not_set':
      return t('credit.settings.site.errors.ownerNotSet')
    case 'impersonating':
      return t('credit.settings.site.impersonating')
    case 'switch_project':
      return t('credit.settings.site.switchToOwnerProject')
    default:
      return t('credit.settings.site.errors.forbidden')
  }
}

/** Сохранение владельца: свои слова только там, где они ведут к действию. */
function saveErrorText(error: unknown, t: TFunction): string {
  switch (siteAdminErrorKind(error)) {
    // Повтор тут ничего не даст: назвать правило, кто может сменить владельца.
    case 'owner_change_denied':
      return t('credit.settings.site.errors.ownerChangeDenied')
    case 'owner_project_gone':
      return t('credit.settings.site.errors.ownerProjectGone')
    case 'session_expired':
      return t('credit.settings.site.errors.sessionExpired')
    default:
      return t('credit.settings.site.saveFailed')
  }
}

export function CreditSiteSection() {
  const { t } = useTranslation('common')
  const canManage = useHasPermission(PERMISSIONS.SYSTEM.MANAGE_SETTINGS)
  const hasSiteRightInActiveProject = useHasAnyPermission([
    PERMISSIONS.SITE.CONTENT_EDIT,
    PERMISSIONS.SITE.CONTENT_PUBLISH,
  ])
  const activeProjectId = useAuthStore((state) => state.user?.active_project_id ?? null)
  const isImpersonating = useAuthStore((state) => state.isImpersonating)

  const settings = useSiteAdminSettings()
  const projects = useProjects({ page: 1, page_size: 100, status: 'active' })
  const update = useUpdateSiteAdminSettings()
  const handoff = useSiteAdminHandoff()

  const [draft, setDraft] = useState<string | null>(null)
  const [handoffError, setHandoffError] = useState<SiteAdminErrorKind | null>(null)

  if (settings.isLoading) {
    return <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
  }
  // Молчать нельзя: экран, не узнавший владельца, не вправе показать «не
  // выбран» — это другое утверждение, и оно толкнуло бы выбрать заново.
  // Экран отказа — только когда картины нет вовсе. Сбой ПЕРЕчитывания поверх
  // уже прочитанной (на отказе выдачи или сохранения хуки перечитывают
  // настройки) секцию не прячет: иначе точный текст отказа («сервіс тимчасово
  // недоступний») подменился бы другим утверждением — «не вдалося прочитати».
  if (!settings.data) {
    const expired = siteAdminErrorKind(settings.error) === 'session_expired'
    return (
      <Alert variant="warning">
        {expired
          ? t('credit.settings.site.errors.sessionExpired')
          : t('credit.settings.site.loadFailed')}
      </Alert>
    )
  }

  const ownerId = settings.data.site_owner_project_id
  const projectList = projects.data?.projects ?? []
  const ownerName =
    settings.data.site_owner_project_name ??
    projectList.find((project) => project.id === ownerId)?.name ??
    (ownerId !== null ? `#${ownerId}` : null)

  // Владелец может не попасть в список (архивный проект, чужой для читателя) —
  // тогда выбор показал бы пустоту вместо текущего значения.
  const options = projectList.map((project) => ({ id: project.id, name: project.name }))
  if (ownerId !== null && ownerName && !options.some((option) => option.id === ownerId)) {
    options.unshift({ id: ownerId, name: ownerName })
  }

  const current = ownerId !== null ? String(ownerId) : ''
  const selected = draft ?? current
  const changed = draft !== null && draft !== current
  // Сеанс «от имени» сервер на смене владельца отвергает всегда (запись легла
  // бы на чужое имя) — выбор, который гарантированно кончится 403, не даём.
  const canChangeOwner = canManage && !isImpersonating

  const entry = siteAdminEntry({
    settings: settings.data,
    hasSiteRightInActiveProject,
    activeProjectId,
    isImpersonating,
  })

  const save = () => {
    if (!canChangeOwner || !changed || draft === null) return
    update.mutate({ site_owner_project_id: Number(draft) }, { onSuccess: () => setDraft(null) })
  }

  const openAdmin = () => {
    setHandoffError(null)
    handoff.mutate(undefined, {
      onSuccess: (data) => {
        // Открываем только абсолютный http(s): `javascript:` из ответа — это
        // исполнение кода в новой вкладке, а не переход.
        const url = safeHttpUrl(data?.url)
        // Ключ — в `data` мутации; держать его там дольше этой строки незачем.
        handoff.reset()
        if (!url) {
          setHandoffError('failed')
          return
        }
        window.open(url, '_blank', 'noopener,noreferrer')
      },
      onError: (error) => setHandoffError(siteAdminErrorKind(error)),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Картина прочитана раньше, перечитать не удалось: сказать, что она
          может устареть, но выбор и точный текст отказа оставить. */}
      {settings.error && <Alert variant="warning">{t('credit.settings.site.refreshFailed')}</Alert>}
      <div className="border-border flex flex-col gap-3 rounded-lg border p-4">
        <p className="text-foreground text-sm">
          {ownerId !== null ? (
            <>
              {t('credit.settings.site.ownerLabel')}{' '}
              <strong data-testid="site-owner-name">{ownerName}</strong>
            </>
          ) : (
            t('credit.settings.site.ownerNotSet')
          )}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="sm:w-80">
            <Select
              value={selected || undefined}
              onValueChange={(value) => setDraft(value)}
              disabled={!canChangeOwner || update.isPending}
            >
              <SelectTrigger aria-label={t('credit.settings.site.ownerSelect')}>
                <SelectValue placeholder={t('credit.settings.site.ownerPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.id} value={String(option.id)}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {canManage && (
            <Button
              size="sm"
              onClick={save}
              disabled={!canChangeOwner || !changed || update.isPending}
            >
              {t('credit.settings.site.save')}
            </Button>
          )}
        </div>

        {isImpersonating && (
          <p className="text-muted-foreground text-xs">
            {t('credit.settings.site.ownerImpersonating')}
          </p>
        )}
        {!isImpersonating && !canManage && (
          <p className="text-muted-foreground text-xs">{t('credit.settings.site.ownerReadOnly')}</p>
        )}
        {update.isError && <Alert variant="error">{saveErrorText(update.error, t)}</Alert>}
      </div>

      {entry !== 'hidden' && (
        <div className="border-border flex flex-col gap-3 rounded-lg border p-4">
          <p className="text-muted-foreground text-xs">{t('credit.settings.site.adminHint')}</p>
          {entry === 'ready' ? (
            <>
              <div>
                <Button size="sm" onClick={openAdmin} disabled={handoff.isPending}>
                  {t('credit.settings.site.openAdmin')}
                </Button>
              </div>
              {handoffError && <Alert variant="error">{handoffErrorText(handoffError, t)}</Alert>}
            </>
          ) : (
            <Alert variant="info">{entryText(entry, t)}</Alert>
          )}
        </div>
      )}
    </div>
  )
}
