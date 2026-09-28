/**
 * Кнопка «Открыть админку сайта» или что сказать вместо неё (17-40b, r2–r4).
 *
 * Правда о праве — у сервера. Выдача ключа считает права в ПРОЕКТЕ-ВЛАДЕЛЬЦЕ,
 * а права в JWT — это права АКТИВНОГО проекта. Поэтому, когда GET настроек
 * прислал `current_user_site_role`, решает он:
 *   - роль есть → кнопка, в каком бы проекте человек ни находился;
 *   - роли нет, а по JWT право есть → объяснить, почему входа не будет
 *     (нет права в проекте-владельце, владелец выключен), а не обещать
 *     кнопкой отказ;
 *   - роли нет и по JWT права нет → ничего (администратор настроек видит
 *     только выбор владельца).
 * Порядок причин — тот же, что у выдачи на сервере: 503 → 409 → 403.
 *
 * Сеанс «от имени» проверяется сразу после `hidden`, ДО роли (r4): клиент
 * знает его сам и наверняка, а сервер, отдавший роль в таком сеансе, привёл бы
 * к кнопке с гарантированным 403 и чужим текстом «нет права».
 *
 * ⚠️ ПРЕДЕЛ ДОСТИЖИМОСТИ (решение куратора r4, гейт не расширяем). Сюда
 * попадает только тот, кто открыл вкладку «Сайт», а вкладку, маршрут и пункт
 * меню решают права JWT АКТИВНОГО проекта: право на контент сайта или
 * `manage_settings`. Сцена «роль только в проекте-владельце, активен другой
 * проект» доходит до кнопки лишь у того, у кого в активном проекте тоже есть
 * одно из этих прав. Контент-менеджер, у которого права только в
 * проекте-владельце, сначала переключается на этот проект. Расширить гейт
 * значило бы спрашивать GET настроек у каждого пользователя CRM.
 *
 * Если поля роли нет (сервер старше 17-40a), остаётся догадка по JWT, как в
 * r1: кнопка в проекте-владельце, подсказка «перейдите» в другом. Эта ветка
 * (`switch_project`) достижима: её видит держатель `manage_settings` или права
 * сайта в другом проекте.
 *
 * Чистая функция без React: решение проверяется таблицей, а не экраном.
 */
import type { SiteAdminEntry, SiteAdminSettings } from './types'

export interface SiteAdminEntryInput {
  settings: SiteAdminSettings
  /** По JWT активного проекта есть `site.content.edit` или `site.content.publish`. */
  hasSiteRightInActiveProject: boolean
  activeProjectId: string | number | null
  isImpersonating: boolean
}

export function siteAdminEntry(input: SiteAdminEntryInput): SiteAdminEntry {
  const { settings, hasSiteRightInActiveProject, activeProjectId, isImpersonating } = input
  const ownerId = settings.site_owner_project_id
  const serverRole = settings.current_user_site_role
  // `undefined` — сервер старше 17-40a r4: владелец в ответе значит «живой».
  const ownerInactive = settings.site_owner_active === false

  if (serverRole !== undefined) {
    if (serverRole === null && !hasSiteRightInActiveProject) return 'hidden'
    if (isImpersonating) return 'impersonating'
    if (settings.configured === false) return 'not_configured'
    if (ownerId === null) return 'owner_not_set'
    if (ownerInactive) return 'owner_inactive'
    if (serverRole !== null) return 'ready'
    return 'no_right_in_owner'
  }

  // Запасной путь: сервер о роли промолчал — только права JWT.
  if (!hasSiteRightInActiveProject) return 'hidden'
  if (isImpersonating) return 'impersonating'
  if (settings.configured === false) return 'not_configured'
  if (ownerId === null) return 'owner_not_set'
  if (ownerInactive) return 'owner_inactive'
  return String(ownerId) === String(activeProjectId) ? 'ready' : 'switch_project'
}
