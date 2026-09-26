/**
 * Настройки → Сайт (17-40b).
 *
 * Две вещи и обе — про права CRM, а не кредитного модуля:
 *
 * 1. **Чей сайт.** Права на контент сайта считаются в ОДНОМ проекте —
 *    проекте-владельце (`auth_settings.site_owner_project_id`, auth-service).
 *    Видят его все, кто открыл вкладку; выключенный (деактивированный, в
 *    архиве) владелец называется по имени с отметкой «проєкт вимкнено»
 *    (17-40a r4, `site_owner_active`). Кто может сменить, решает сервер
 *    (правило PUT 17-40a r2): владелец задан — держатель `manage_settings` в
 *    ТЕКУЩЕМ проекте-владельце; владельца нет — только системный `Admin`
 *    выбираемого проекта; в сеансе «от имени» — никто. Заранее экран знает
 *    лишь две вещи: `manage_settings` в JWT (без него выбор выключен, кнопки
 *    сохранения нет) и сеанс «от имени» (выбор и кнопка выключены — сервер
 *    откажет всегда). Остальное — отказ 403 после нажатия, названный правилом,
 *    а не «спробуйте ще раз»: в bootstrap ответ зависит от выбираемого
 *    проекта, и поля «может ли менять» в GET нет. Список проектов для выбора
 *    читается только у того, кто может менять, и целиком — постранично
 *    (`useOwnerProjectChoices`), а не первой сотней.
 * 2. **Вход в админку сайта.** Своих учёток у админки больше нет: кнопка
 *    просит у auth-service одноразовый ключ (`POST /site-admin/handoff`, живёт
 *    ≤ 60 с) и отправляет по выданному адресу вкладку, открытую В САМОМ
 *    НАЖАТИИ, до запроса (r4, как `CreditDocumentOpenButton`): окно, открытое
 *    после ответа сервера, браузер блокирует молча, и одноразовый ключ сгорал
 *    бы без следа. Вкладку не дали (блокировщик; OneX — всегда: его политика
 *    окон отклоняет пустой адрес) — адмінка открывается В ЭТОЙ ЖЕ вкладке
 *    (`window.location.assign`, r4b): переход текущей вкладки не блокируется,
 *    поэтому ключ не сгорает молча, а вернуться в CRM можно кнопкой «Назад».
 *    Ключ нигде не хранится и не показывается: мутация сбрасывается сразу
 *    после `safeHttpUrl`, до перехода, — и на годном адресе, и на негодном; на
 *    отказе и негодном адресе новая вкладка закрывается, а без неё перехода нет.
 *
 * Показать ли кнопку, решает ответ сервера `current_user_site_role` — роль в
 * проекте-владельце (`siteAdminEntry`), а не права JWT активного проекта.
 * Когда входа не будет, на месте кнопки сказано почему: не настроено, владелец
 * не выбран или выключен, сеанс «от имени», нет права в проекте-владельце.
 *
 * ⚠️ ПРЕДЕЛ (решение куратора r4). До этой секции доходит только тот, у кого
 * в JWT АКТИВНОГО проекта есть право на контент сайта или `manage_settings`:
 * по ним решаются вкладка, маршрут `credit/settings` и пункт меню. Сотрудник,
 * у которого право на контент сайта есть только в проекте-владельце, вкладки
 * не увидит, пока не переключится на этот проект. Гейт по ответу сервера
 * стоил бы GET настроек у каждого пользователя CRM — его не расширяем.
 *
 * Отказы выдачи ключа называются своими словами (401 / 403 / 409 / 429 / 503) —
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
import {
  siteAdminEntry,
  siteAdminErrorKind,
  useOwnerProjectChoices,
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
    // 409 не говорит, что именно с владельцем: не выбран или выключен. Точную
    // причину скажет перечитанная картина (хук перечитывает её на отказе).
    case 'owner_not_set':
      return t('credit.settings.site.errors.ownerNotSetOrInactive')
    case 'not_configured':
      return t('credit.settings.site.errors.notConfigured')
    case 'unavailable':
      return t('credit.settings.site.errors.unavailable')
    case 'session_expired':
      return t('credit.settings.site.errors.sessionExpired')
    // Лимит выдачи ключей (a r4, `Retry-After`): повтор поможет, но не сразу.
    case 'too_many_requests':
      return t('credit.settings.site.errors.tooManyAttempts')
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
    case 'owner_inactive':
      return t('credit.settings.site.errors.ownerInactive')
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
    // 403 без кода (декоратор `manage_settings`, право отозвано после выдачи
    // JWT) — тот же отказ в праве, а не сбой, который лечится повтором.
    case 'owner_change_denied':
    case 'forbidden':
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
  // Сеанс «от имени» сервер на смене владельца отвергает всегда (запись легла
  // бы на чужое имя) — выбор, который гарантированно кончится 403, не даём.
  const canChangeOwner = canManage && !isImpersonating

  const settings = useSiteAdminSettings()
  // Список проектов нужен только тому, кто выбирает: остальным выбор показан
  // выключенным с текущим владельцем, и обход страниц был бы лишним.
  const choices = useOwnerProjectChoices(canChangeOwner)
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
  // `undefined` — сервер старше 17-40a r4: владелец в ответе значит «живой».
  const ownerInactive = ownerId !== null && settings.data.site_owner_active === false
  const projectList = choices.data?.projects ?? []
  const ownerName =
    settings.data.site_owner_project_name ??
    projectList.find((project) => project.id === ownerId)?.name ??
    (ownerId !== null ? `#${ownerId}` : null)

  // Владелец может не попасть в список (выключенный проект, чужой для
  // читателя, список не читался) — тогда выбор показал бы пустоту вместо
  // текущего значения.
  const options = [...projectList]
  if (ownerId !== null && ownerName && !options.some((option) => option.id === ownerId)) {
    options.unshift({ id: ownerId, name: ownerName })
  }

  const current = ownerId !== null ? String(ownerId) : ''
  const selected = draft ?? current
  const changed = draft !== null && draft !== current

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
    // Вкладка — в самом нажатии, ДО запроса: окно, открытое после ответа,
    // браузер считает открытым без участия человека и блокирует. `noopener`
    // здесь не годится — с ним открытие всегда возвращает `null`, и ни задать
    // адрес, ни узнать о блокировке было бы нельзя. Связь с окном CRM рвём сами.
    const tab = window.open('', '_blank')
    if (tab) tab.opener = null
    handoff.mutate(undefined, {
      onSuccess: (data) => {
        // Открываем только абсолютный http(s): `javascript:` из ответа — это
        // исполнение кода, а не переход.
        const url = safeHttpUrl(data?.url)
        // Ключ — в `data` мутации; держать его там дольше этой строки незачем.
        handoff.reset()
        if (!url) {
          tab?.close()
          setHandoffError('failed')
          return
        }
        if (tab) {
          tab.location.href = url
          return
        }
        // Вкладку не дали (блокировщик; OneX — всегда: пустой адрес его
        // политика окон отклоняет). Переход ЭТОЙ вкладки не блокируется, и
        // ключ не сгорает молча; вернуться в CRM — кнопкой «Назад» (r4b).
        window.location.assign(url)
      },
      onError: (error) => {
        tab?.close()
        setHandoffError(siteAdminErrorKind(error))
      },
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
              {ownerInactive && (
                <span
                  data-testid="site-owner-inactive"
                  className="bg-muted text-muted-foreground ml-2 inline-flex rounded-full px-2 py-0.5 text-xs"
                >
                  {t('credit.settings.site.ownerInactive')}
                </span>
              )}
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

        {canChangeOwner && choices.data?.truncated && (
          <p className="text-muted-foreground text-xs">
            {t('credit.settings.site.ownerListTruncated', { limit: projectList.length })}
          </p>
        )}
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
              {/* Без новой вкладки (блокировщик, OneX) админка откроется в этой —
                  сказать заранее, чтобы уход со страницы CRM не удивил. */}
              <p className="text-muted-foreground text-xs">
                {t('credit.settings.site.sameTabHint')}
              </p>
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
