/**
 * Сайт кредитного продукта: чей он и как попасть в его админку (17-40b).
 *
 * Оба ответа отдаёт auth-service (17-40a), не кредитный модуль: права на
 * контент сайта — права CRM, и считаются они в проекте-владельце сайта.
 */

/** Роль в админке сайта, которую сервер выводит из прав в проекте-владельце. */
export type SiteRole = 'editor' | 'publisher'

/** `GET/PUT /api/v1/auth/settings/site-admin` (форма 17-40a). */
export interface SiteAdminSettings {
  /**
   * Сохранённый проект-владелец сайта; `null` — владелец не выбран или
   * удалён (мягко). С 17-40a r4 деактивированный или архивный владелец здесь
   * ОСТАЁТСЯ: ключ ему не выдаётся, но менять сайт по-прежнему держатель
   * `manage_settings` в нём, и экран обязан назвать, кто владелец.
   */
  site_owner_project_id: number | null
  /**
   * Имя проекта-владельца (и выключенного тоже). Экран умеет взять имя и из
   * списка проектов, если сервер его не прислал.
   */
  site_owner_project_name?: string | null
  /**
   * `false` — владельца нет или он на паузе (деактивирован, в архиве): входа
   * в админку сайта нет ни у кого, `current_user_site_role` тогда `null`.
   * `undefined` — сервер старше 17-40a r4: владелец в ответе значит «живой».
   */
  site_owner_active?: boolean
  /**
   * `false` — у auth-service нет годного секрета ключа или адреса админки:
   * выдача ответила бы 503 `SITE_ADMIN_NOT_CONFIGURED`. Необязательно только
   * для совместимости: сервер 17-40a шлёт поле всегда.
   */
  configured?: boolean
  /**
   * Роль, которую вызывающий получил бы в проекте-владельце прямо сейчас;
   * `null` — права на контент сайта там нет (или владелец не выбран, или это
   * сеанс «от имени»). Это ответ сервера на ровно тот вопрос, который права
   * JWT (права АКТИВНОГО проекта) решают только догадкой. `undefined` —
   * сервер поле не прислал: тогда экран возвращается к правам JWT.
   */
  current_user_site_role?: SiteRole | null
}

/** Тело `PUT /api/v1/auth/settings/site-admin` — только сам выбор. */
export interface UpdateSiteAdminSettingsInput {
  site_owner_project_id: number
}

/**
 * `POST /api/v1/auth/site-admin/handoff` — одноразовый ключ входа.
 *
 * `url` = `<CMS_URL>/admin/sso?t=<ключ>`, ключ живёт не дольше `expires_in`
 * секунд (≤ 60). Экран его не разбирает и нигде не хранит: только открывает.
 */
export interface SiteAdminHandoff {
  url: string
  expires_in: number
}

/**
 * Отказ ручек админки сайта, как его видит человек.
 *
 * - `forbidden` — 403 `SITE_ADMIN_ACCESS_DENIED`: нет права на контент сайта
 *   в проекте-владельце (или сеанс «от имени» — сервер не различает вслух);
 * - `owner_change_denied` — 403 `SITE_OWNER_CHANGE_DENIED` на сохранении:
 *   правило PUT (17-40a r2) не разрешает этому человеку сменить владельца —
 *   владелец задан, а `manage_settings` в проекте-владельце нет; владельца нет,
 *   а он не системный `Admin` выбираемого проекта; сеанс «от имени»;
 * - `owner_not_set` — 409 `SITE_OWNER_NOT_SET`: владелец сайта не выбран или
 *   выключен — выдача их не различает, различает GET (`site_owner_active`);
 * - `not_configured` — 503 `SITE_ADMIN_NOT_CONFIGURED`: у CRM нет секрета
 *   или адреса админки;
 * - `unavailable` — 503 без этого кода (сервис или шлюз лежит): «не
 *   настроено» здесь было бы неправдой, чинить надо другое;
 * - `owner_project_gone` — 404 `SITE_OWNER_PROJECT_NOT_FOUND` на сохранении:
 *   выбранный проект удалён или выключен;
 * - `session_expired` — 401: сессия CRM кончилась, помогает только вход;
 * - `too_many_requests` — 429 выдачи ключа (лимит a r4, `Retry-After`):
 *   повтор поможет, но через минуту;
 * - `failed` — всё остальное, включая ответ без годного адреса.
 */
export type SiteAdminErrorKind =
  | 'forbidden'
  | 'owner_change_denied'
  | 'owner_not_set'
  | 'not_configured'
  | 'unavailable'
  | 'owner_project_gone'
  | 'session_expired'
  | 'too_many_requests'
  | 'failed'

/**
 * Что показать на месте кнопки «Открыть админку сайта».
 *
 * - `hidden` — у человека нет права на контент сайта ни по серверу, ни по JWT;
 * - `ready` — кнопка;
 * - `not_configured` / `owner_not_set` / `owner_inactive` — стенд или
 *   настройка, а не человек: сказать сразу, не дожидаясь 503/409 после
 *   нажатия; `owner_inactive` — владелец выбран, но его проект выключен;
 * - `impersonating` — сеанс «от имени»: сервер такой вход не выдаёт никогда;
 * - `no_right_in_owner` — права в проекте-владельце нет (сервер так сказал);
 * - `switch_project` — только запасной путь без ответа сервера о роли: право
 *   есть в активном проекте, а владелец — другой проект.
 */
export type SiteAdminEntry =
  | 'hidden'
  | 'ready'
  | 'not_configured'
  | 'owner_not_set'
  | 'owner_inactive'
  | 'impersonating'
  | 'no_right_in_owner'
  | 'switch_project'
