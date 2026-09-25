/**
 * Кнопка «Открыть админку сайта» или что сказать вместо неё (17-40b, r2).
 *
 * Правда о праве — у сервера. Выдача ключа считает права в ПРОЕКТЕ-ВЛАДЕЛЬЦЕ,
 * а права в JWT — это права АКТИВНОГО проекта. Поэтому, когда GET настроек
 * прислал `current_user_site_role`, решает он:
 *   - роль есть → кнопка, в каком бы проекте человек ни находился;
 *   - роли нет, а по JWT право есть → объяснить, почему входа не будет
 *     (сеанс «от имени» или нет права в проекте-владельце), а не обещать
 *     кнопкой отказ;
 *   - роли нет и по JWT права нет → ничего (администратор настроек видит
 *     только выбор владельца).
 * Порядок причин — тот же, что у выдачи на сервере: 503 → 409 → 403.
 *
 * Если поля нет (сервер старше 17-40a), остаётся догадка по JWT, как в r1:
 * кнопка в проекте-владельце, подсказка «перейдите» в другом.
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

  if (serverRole !== undefined) {
    if (serverRole === null && !hasSiteRightInActiveProject) return 'hidden'
    if (settings.configured === false) return 'not_configured'
    if (ownerId === null) return 'owner_not_set'
    if (serverRole !== null) return 'ready'
    return isImpersonating ? 'impersonating' : 'no_right_in_owner'
  }

  // Запасной путь: сервер о роли промолчал — только права JWT.
  if (!hasSiteRightInActiveProject) return 'hidden'
  if (settings.configured === false) return 'not_configured'
  if (ownerId === null) return 'owner_not_set'
  if (isImpersonating) return 'impersonating'
  return String(ownerId) === String(activeProjectId) ? 'ready' : 'switch_project'
}
