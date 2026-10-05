# Story crm-roles-4: форма роли — восемь переключателей чата и экран роли, «Роль у чаті (HUB)» убрана из формы (fe-prionex) — за флагом сборки `VITE_ROLE_CHAT_SETTINGS_ENABLED`

Status: done

- Epic: «Роли чата = роли CRM» (CAP-2, CAP-5, CAP-7)
- Story key: `crm-roles-4`
- Plan task: wave 35 lane F1 (curator session ceo-prionex-71); story `4` of
  `_bmad-output/specs/spec-hub-chat-roles-mirror-crm/stories.yaml` (CEO-Prionex workspace); rules
  `chat-switches.md` §Переключатели, §Экраны
- Phase: **1 — CRM-сторона набора прав чата** (истории 1–4; поля снимка остаются за `HUB_CHAT_SET_MODE=off` до
  истории 13)
- Surface: fe-prionex, `src/features/roles` (типы, каталог, правила формы, payload, формы create / edit / view),
  `src/pages/RoleManagement` (столбец «Чат (HUB)»), словари `public/locales/{uk,en,es}/{common,errors}.json`. Без
  новых зависимостей, без правок api
- Depends on: api-prionex #584 (story 2a, `crm-roles-2a-snapshot-chat-set-and-template`) и #613 (story 2b,
  `crm-roles-2b-role-chat-switches-edit`) — оба в `main`
- Created: 02.10.2026 (builder, curator session ceo-prionex-71)
- Board: https://git.crm-prionex.com/Tasks/CRMTasksBoard/issues/1621

## Story

As a CRM user who manages the roles of a project,
I want to see and change, in the role form, the eight chat switches and the role's home screen, and to choose a
chat template when I create a role,
so that the chat rights of a role are set in CRM in plain words, and the old «Роль у чаті (HUB)» field no longer
pretends to decide them.

## Acceptance Criteria

AC1–AC9 описывают сборку с флагом `VITE_ROLE_CHAT_SETTINGS_ENABLED` = `true` / `1` (решение куратора, review
round 2, правило 28.5); сборка без флага (по умолчанию, PROD сегодня) — AC11.

**AC1 — Секция «Чат (HUB)» в форме редактирования.** Given роль с заполненным набором (`chat_switches` — восемь
ключей) и пользователь с `manage_roles`, when открыта форма редактирования, then в секции «Чат (HUB)» восемь
переключателей в порядке `SWITCH_KEYS` (access, client_dialogs, create_groups, dept_channel_admin, download_files,
ai_assistant, chat_only, lead) и выбор экрана роли (`home_plane`, 6 значений из каталога) показывают значения из
GET; «Діалоги з клієнтами» — выбор none / my / department / all (значения из каталога), остальные — переключатели
с подписями.

**AC2 — Что отправляется.** Given форма редактирования, when пользователь изменил переключатель (хоть один) и
сохранил, then PUT несёт `chat_switches` (все восемь ключей); when изменил экран, then PUT несёт `home_plane`; каждое
поле уходит только если его значение отличается от сохранённого — неизменённое поле в PUT не попадает, чтобы не
вернуть поверх чужого сохранения то, что пользователь не трогал (review round 4); when секцию не трогали (или
вернули к сохранённым значениям), then ни `chat_switches`, ни `home_plane`, ни `chat_template` в PUT нет;
`chat_template` в PUT не отправляется никогда; `hub_role` формы не отправляют вовсе.

**AC3 — Правила, которые API всё равно откажет.** Given «Доступ до чату» выключен, then все остальные
переключатели выключены (диалоги «Немає») и недоступны; given «Лише чат (бот)» включён, then диалоги «Немає»,
группы / ШІ / права керівника / адміністратор каналу відділу выключены, «Завантажувати файли» включено, и эти
элементы недоступны — пользователь не может собрать `CHAT_SWITCHES_CONFLICT`. Если код всё же пришёл — он
показан словами у секции.

**AC4 — «Не заповнено».** Given роль с `chat_switches: null`, when форма открыта, then секция видна с подсказкой,
что набор ещё не заполнен; пользователь с `manage_roles` может нажать «Заповнити налаштування чату», получить
переключатели (всё выключено, экран — из GET) и при сохранении PUT создаёт набор: `chat_switches` уходят всегда,
`home_plane` — только если экран сменили (иначе API оставляет сохранённый экран: ключ отсутствует = не менять,
review round 4); без нажатия ничего не отправляется.

**AC5 — Только чтение.** Given форма просмотра роли, или форма редактирования у пользователя без `manage_roles`,
или каталог формы ещё не пришёл / недоступен, then те же значения показаны текстом, без элементов управления, и
ничего из секции не отправляется. Given `chat_set_follows_hub_role === false`, then видна строка «Налаштування
чату змінені вручну».

**AC6 — Шаблон только при создании.** Given форма создания, then есть выбор «Шаблон прав чату» из
`chat_templates` каталога (9 кодов, подписи в одном месте); шаблон с `assignable: false` показан недоступным с
пометкой «потрібен адміністратор HUB»; переключателей при создании нет; `chat_template` уходит в POST только если
выбран. В формах редактирования и просмотра выбора шаблона нет.

**AC7 — «Роль у чаті (HUB)» убрана из форм (флаг on).** Given сборка с флагом и формы create / edit / view, then
поля «Роль у чаті (HUB)» нет ни в одной, и формы не отправляют `hub_role`; столбец `hub_role` в БД и в списке ролей
не трогаем. Без флага поле на месте — AC11.

**AC8 — Отказы словами.** Коды 422 `CHAT_SWITCHES_INVALID` (params.missing / unknown / bad_values),
`CHAT_SWITCHES_CONFLICT` (params.conflicts), `HOME_PLANE_UNKNOWN`, `CHAT_SET_BROKEN` (params.switches),
`CHAT_TEMPLATE_IMMUTABLE` / `CHAT_TEMPLATE_UNKNOWN` / `CHAT_TEMPLATE_CONFLICT`, `CHAT_SET_UNKNOWN_HUB_ROLE` и 403
`HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN` / `HUB_ROLE_FORBIDDEN_WHILE_IMPERSONATING` (поле — по `params.field`)
показаны у своего поля формы; у каждого кода есть фраза в `errors.json` на uk / en / es. На отказе 403 по полю
чата выбор в секции сбрасывается к сохранённому, чтобы повтор сохранения прошёл без него.

**AC9 — Список ролей.** В таблице ролей столбец «Чат (HUB)»: «так» / «ні» / «—» по `chat_access`.

**AC10 — Тексты и тесты.** Все новые строки на uk / en / es (паритет ключей проверяется тестом). Существующие тесты
формы роли зелёные (обновлены, не удалены); новые тесты: каждый переключатель, правила недоступности, только
чтение, «не заповнено», шаблон при создании, отсутствие `hub_role`, карта кодов отказа, сборка payload.

**AC11 — Флаг сборки (review round 2, решение куратора).** Новая поверхность «Чат (HUB)» живёт за флагом сборки
`VITE_ROLE_CHAT_SETTINGS_ENABLED` (`true` / `1` = on; не задан, пусто или любое другое значение = off). Given сборка
без флага, then формы create / edit / view ровно такие, как до этой истории: поле «Роль у чаті (HUB)» с прежним
поведением (KAN-1476), `hub_role` уходит как раньше; секции чата, выбора шаблона, столбца «Чат (HUB)» и ключей
`chat_switches` / `home_plane` / `chat_template` в запросах нет. Given сборка с флагом, then AC1–AC9. Флаг доезжает до
образа: пара `ARG` + `ENV` в `Dockerfile.prod`, `--build-arg` из шага `build.yml` по переменной репозитория
`VITE_ROLE_CHAT_SETTINGS_ENABLED_<DEV|PREPROD|PROD>` (пусто = `false`); дорогу держит тест
`roleChatSettingsFlag.test.ts`. Обе ветви покрыты тестами форм.

## Dev notes

- Карта кода (строки на момент сборки):
  - `src/features/roles/chatRoleSet.ts` — одно место правил формы: `SWITCH_KEYS` :28, подписи переключателей
    `SWITCH_LABELS` :51, диалогов / экранов / шаблонов (`clientDialogsLabel` :163, `homePlaneLabel` :167,
    `chatTemplateLabel` :171), столбец списка `chatAccessLabel` :182, `readChatSwitches` :193,
    `NO_ACCESS_SWITCHES` :222, `applySwitchChange` :252, `lockedSwitches` :264, `chatCatalogView` :305,
    `effectiveChatTemplate` :344, `chatRefusal` :430, `dropsChatDraft` :517.
  - `src/features/roles/roleChatSettingsFlag.ts` — флаг сборки (review round 2): `ROLE_CHAT_SETTINGS_FLAG` :23,
    `isRoleChatSettingsEnabled` :30 (читается на каждый вызов, `true` / `1` = on); `Dockerfile.prod` — `ARG` :47,
    `ENV` :76.
  - `src/features/roles/buildRolePayload.ts` — флаг off: `hubRoleCreatePatch` :53, `hubRoleUpdatePatch` :63
    (как до истории); флаг on: `chatTemplateCreatePatch` :84, `chatUpdatePatch` :99.
  - `src/features/roles/components/ChatSettingsSection.tsx` — секция :92, отказ у поля `ChatRefusalNote` :52.
  - `src/features/roles/components/ChatTemplateSelect.tsx` — выбор шаблона :27 (только создание).
  - `src/features/roles/components/EditRoleForm.tsx` — флаг :93, состояние поля «Роль у чаті» :104, секции :121,
    payload :250, секция или поле :396; `CreateRoleForm.tsx` — флаг :61, payload :154, шаблон или поле :250;
    `ViewRoleForm.tsx` — флаг :37, секция :115 или строка «Роль у чаті».
  - `src/features/roles/hooks/useHubRoles.ts` :16 — тот же запрос каталога, плюс `chat` (шаблоны, экраны,
    значения диалогов).
  - `src/features/roles/types.ts` — `chat_access`, `chat_switches`, `home_plane`, `chat_template`,
    `chat_set_follows_hub_role`, `ChatSwitches`, `ChatTemplateOption`; `hub_role` в `CreateRoleInput` /
    `UpdateRoleInput` остаётся (его шлёт сборка без флага).
  - `src/pages/RoleManagement/RoleManagementPage.tsx` :131 — столбец «Чат (HUB)» (только с флагом).
  - `src/features/roles/components/HubRoleSelect.tsx` — возвращён из HEAD без правок (review round 2: путь без
    флага).
- Правила недоступности (AC3) повторяют только `switch_conflicts` API (отказ по правилу), а не вычисляют права:
  набор прав считает только API.
- «Тронуто» = значения секции отличаются от сохранённых (или роль заполняется): возврат к сохранённым ничего не
  шлёт — под имперсонацией любой ключ чата, даже сохранённое значение, API отказывает 403.
- Каталог формы (`GET /roles/hub-roles`) требует `manage_roles` в проекте — форма просмотра с флагом его не
  запрашивает (без флага — как до истории: по каталогу подписывается строка «Роль у чаті»); подписи экранов и
  диалогов — локальные по коду, неизвестный код показан как есть.
- Флаг сборки (round 2): формы ветвят по `isRoleChatSettingsEnabled()` только отрисовку, payload и обработку
  отказа; хуки (`useHubRoles`, права, имперсонация) вызываются при обоих значениях.
- Роли по умолчанию (`is_default`): переключатели и экран редактируются так же, как у своих ролей. API запирает у
  них только смену `hub_role` (`HUB_ROLE_DEFAULT_LOCKED`, `role_service.update_role` при `hub_role_changed`), а
  `chat_switches` / `home_plane` не запирает (сверено с api-prionex `origin/main` `27a407b4`).

## Builder record 02.10

Worktree `fe-prionex-wt-roles-4`, branch `KAN-1621/feat/role-form-chat-switches`, base `22eb7d063` (fe-prionex
`origin/main`). Ничего не закоммичено (коммит — куратор, `HUSKY=0`); без новых зависимостей; `.env*`,
`.forgejo/**`, `package*.json`, конфиги vite/ts и `sprint-status.yaml` не тронуты.

| AC | Статус | Чем проверено |
|---|---|---|
| AC1 секция, значения из GET | PASS | `RoleForm.chatSwitches.test.tsx` «shows the eight switches in form order…» |
| AC2 что отправляется | PASS | тот же файл: по тесту на каждый переключатель, диалоги, экран, «не трогали», «туда и обратно»; `roleHubRolePayload.test.ts` |
| AC3 правила недоступности | PASS | «turns everything off with access…», «gives «chat only» what it demands…»; `chatRoleSet.test.ts` |
| AC4 «не заповнено» | PASS | describe «a role whose chat settings are not filled» (3 теста) |
| AC5 только чтение | PASS | без `manage_roles`, под имперсонацией, каталог недоступен, форма просмотра; «змінені вручну» |
| AC6 шаблон только при создании | PASS | describe «CreateRoleForm - chat template» (6 тестов) |
| AC7 «Роль у чаті (HUB)» убрана | PASS | `RoleForm.hubRoleGone.test.tsx` (в round 2 перенесён сюда из `EditRoleForm.hubRole.test.tsx`: поле отсутствует в трёх формах при любом каталоге, `hub_role` не уходит — флаг on), `EditRoleModal.hubRole.test.tsx` |
| AC8 отказы словами | PASS | `chatRoleSet.test.ts` (каждый код, `params.field`), формы (конфликт, экран, 403 со сбросом), `hubRoleErrorCodes.test.ts` (+8 кодов × 3 языка) |
| AC9 столбец списка | PASS | `RoleManagementPage.hubRole.test.tsx` «chat access column» |
| AC10 тексты и тесты | PASS | паритет ключей `pages.roles.chat` uk/en/es и отсутствие плейсхолдеров — `chatRoleSet.test.ts`; старые тесты обновлены, не удалены |

Проверки сборщика (каждая под `flock … systemd-run … CPUQuota=200% MemoryMax=8G`, по коду возврата):
`npx tsc -b` rc=0; `npx eslint --max-warnings=0 <17 изменённых файлов>` rc=0; `npx prettier --check <те же файлы +
словари>` rc=0; `npx vitest run src/features/roles src/pages/RoleManagement` rc=0 (9 файлов, 161 тест);
соседи `WorkDialog.hubAdminGuard`, `ProjectRoleGroupRow.scopeDenied`, `AssistantAccessSection` rc=0 (10 тестов);
`git diff --check` rc=0. Полный vitest и сборку не запускал (CI).

Решения и допущения:
- «Админ проекта» = право `manage_roles` из сессии (`useHasPermission`); что из этого HUB-админ — решает API (403
  показан у поля). Под имперсонацией (`authStore.isImpersonating`) секция только для чтения — API всё равно
  отказал бы любым ключом чата.
- «Тронуто» = значения отличаются от сохранённых (см. Dev notes); при отличии уходят оба поля (снято review round
  4: каждое поле уходит только если отличается само).
- «Не заповнено» заполняется явной кнопкой; черновик начинается с «всё выключено» и экрана из GET — без вывода
  прав на клиенте. Отмена возвращает «не заповнено».
- Значения выбора (экраны, диалоги, шаблоны) — только из каталога; без каталога секция — текст с пометкой, выбор
  шаблона скрыт (роль создаётся «не заповненой»).
- Отказ 403 по полю чата сбрасывает черновик / выбор шаблона (повтор сохраняет остальное), 422 оставляет для
  исправления. Каталог перезапрашивается теми же кодами, что раньше (`isStaleHubCatalogueRefusal`).
- Пометка «потрібен адміністратор HUB» стоит у каждого шаблона с `assignable: false`, как решено; под
  имперсонацией `assignable: false` у всех, и пометка там неточна (см. хвосты).
- Тексты `HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN` и `HUB_ROLE_FORBIDDEN_WHILE_IMPERSONATING` в `errors.json` расширены на
  настройки чата (тот же код теперь приходит за переключатели / экран / шаблон).
- Тесты форм теперь мокают `@/lib/api` частично (`importOriginal`): формы читают auth store, который подключается
  к модулю api при импорте.

### Review round 1 (02.10, triage-and-fix lane F1)

Три ревьюера (blind / edge / gap) прочитали дифф; находки сверены с кодом и с api-prionex `origin/main`
`27a407b4` (`services/auth/app/domain/chat_role_set.py`, `services/auth/app/services/role_service.py`).

Исправлено (код + тесты + тексты uk/en/es):
- Отказ по чату говорится один раз: у поля (секция / выбор шаблона), общий Alert формы для него не показывается;
  отказ по полю, которого в форме нет (шаблон в редактировании, переключатели при создании), показан у ближайшего
  элемента чата, а не теряется.
- Каталог перезапрашивается и на `CHAT_TEMPLATE_UNKNOWN` / `HOME_PLANE_UNKNOWN` (`hubRoles.ts`
  `STALE_CATALOGUE_CODES`); комментарий в `useRoleMutations` обновлён.
- Сохранённый набор, который пришёл, но не читается как восемь переключателей, больше не принимается за
  «не заповнено»: секция говорит, что его не удаётся показать, кнопки «Заповнити» нет, ничего не отправляется
  (`storedChatSwitches`).
- Текст `CHAT_SET_BROKEN` (errors.json и `pages.roles.chat.errors.broken`) приведён к тому, что делают форма и API:
  выключить доступ и сохранить, затем включить, настроить и сохранить ещё раз (API заново берёт набор из семени при
  «доступ включён из пустого», `access_base_seed`), а не «выключить и включить» в одной правке.
- Столбец «Чат (HUB)» в списке — только когда бэкенд присылает `chat_access` (как столбец `hub_role`).
- Каталог 403 → пометка «немає права» вместо «значення недоступні»; запрос без проекта (`enabled: false`) —
  «недоступно», а не вечная загрузка; при неудачном перезапросе каталога форма держит прежний ответ (черновик не
  пропадает молча).
- Черновик помнит сохранённые значения, от которых начат: если роль перезапрошена с другими значениями, черновик
  сбрасывается и секция об этом говорит (не затирает чужое сохранение); секция, ставшая только для чтения, тоже
  сбрасывает черновик (скрытый черновик не вернётся и не уйдёт).
- Создание под имперсонацией: вместо девяти недоступных шаблонов с неверной пометкой «потрібен адміністратор HUB» —
  пояснение, шаблон не уходит.
- Доступность: отказ — `role="alert"` с id, элемент связан с ним `aria-describedby` / `aria-invalid`; подсказки
  связаны со своими элементами; видимая пометка, почему переключатели заблокированы (доступ выключен / «Лише
  чат»); id секции и шаблона — `useId()` (у `ToggleSwitch` добавлены необязательные `ariaDescribedBy` /
  `ariaInvalid`).
- Параметры отказа: в текст попадают только строки и числа (объект не станет «[object Object]»).
- Новые тесты: отказ один раз; отказ не про чат остаётся в Alert; нечитаемый набор; сброс черновика при
  перезапросе с другими значениями и сохранение при тех же; состояние загрузки каталога; каталог 403; роль без
  проекта; отказ в секции у роли, вернувшейся в «не заповнено»; неудачный перезапрос каталога; пометка
  блокировки; два экземпляра секции; при создании — сброс отказанного шаблона, когда перезапрошенный каталог его
  ещё предлагает (прежний тест проходил и без сброса), перезапрос на `CHAT_TEMPLATE_UNKNOWN`, имперсонация;
  столбец списка без поля; юнит-тесты `storedChatSwitches`, `chatCatalogView` (enabled / 403 / прежний ответ),
  `chatRefusal` (только строки), набор кодов перезапроса. Три теста проверены «мутацией»: без правки они падают.

Не исправлено:
- Пометка, что до `HUB_CHAT_SET_MODE=on` (история 13) изменения в HUB не доходят, — решение владельца / куратора
  (эскалация; API флаг в каталог не отдаёт).
- Роли по умолчанию не заперты — так решает API (см. Dev notes).
- Алфавит кодов `^[a-z_]{1,32}$` оставлен: это форма, которой бэкенд проверяет коды (`hubRoles.ts`), все коды
  каталога в ней.
- Тексты `CHAT_TEMPLATE_CONFLICT` / `CHAT_SET_UNKNOWN_HUB_ROLE` не переписаны: эти коды API отдаёт только на
  `hub_role`, которого формы не шлют; фразы в errors.json верны для API в целом.
- Повторная отправка сохранённых переключателей при смене только экрана оставлена (AC2: уходят оба поля);
  переключатели, прочитанные API из набора, по построению не противоречат друг другу. — Снято review round 4.
- Права на форму — по `manage_roles` сессии; точная проверка по проекту роли не сделана (отказ каталога 403 теперь
  показан как «немає права»).
- Удалённые тесты прежнего поля `hub_role` (обновление каталога под открытой формой, перезапрос после отказа,
  каталог 500 при создании) переписаны на поля чата в этом раунде (см. новые тесты выше); проверки самого
  убранного поля не возвращались — поля больше нет.

Сверка с API (`27a407b4`): `SWITCH_KEYS`, `DEFAULT_HOME_PLANE='my_day'`, `HOME_PLANES` (6), `CLIENT_DIALOG_VALUES`,
`_CHAT_ONLY_DEMANDS`, шаблоны (8 семян + `none` = 9) совпадают с `chatRoleSet.ts`. Приёмка на DEV — не проведена
(pending), это не PASS.

### Review round 2 (curator decision: VITE_ROLE_CHAT_SETTINGS_ENABLED)

**Почему.** Эскалация round 1: пока HUB не применяет набор (`HUB_CHAT_SET_MODE=on`, история 13), правки
переключателей хранятся в CRM, но до HUB не доходят, а форма об этом молчит. Решение куратора 02.10: новая
поверхность «Чат (HUB)» едет за флагом сборки фронта, правило 28.5 — старое и новое сосуществуют, пока раскатка
(история 13) не включит флаг на стенде.

**Что за флагом** (`VITE_ROLE_CHAT_SETTINGS_ENABLED`; `true` / `1` = on, не задан / пусто / иное = off; читается в
`roleChatSettingsFlag.ts` на каждый вызов, по образцу `VITE_ASSISTANT_REPORT_TABLES_ENABLED`):
- on — всё, что построила история: секция переключателей и экрана в edit / view, выбор шаблона в create, столбец
  «Чат (HUB)» в списке, ключи `chat_switches` / `home_plane` / `chat_template` в PUT / POST; поля «Роль у чаті
  (HUB)» нет ни в одной из трёх форм, `hub_role` не уходит;
- off (по умолчанию, PROD сегодня) — формы как до этой ветки: поле «Роль у чаті (HUB)» в create / edit / view с
  прежним поведением, `hub_role` уходит как раньше (`hubRoleCreatePatch` / `hubRoleUpdatePatch` возвращены в
  `buildRolePayload.ts`, `HubRoleSelect.tsx` возвращён из HEAD без правок, помощники `hubRoles.ts` снова в деле);
  нет секции, нет шаблона, нет нового столбца, нет ключей чата; отказы — в общем Alert, как раньше.
- Хуки форм вызываются при обоих значениях (правила хуков), ветвится только отрисовка, payload и обработка отказа.
  Форма просмотра с флагом каталог не запрашивает, без флага — как раньше (строка «Роль у чаті» по каталогу).

**Как включить на DEV** (`.forgejo/**` и `.env*` — зона куратора; в этой ветке только `Dockerfile.prod`):
1. `Dockerfile.prod` — пара `ARG` + `ENV VITE_ROLE_CHAT_SETTINGS_ENABLED` до `RUN npm run build` (сделано в ветке).
2. `.forgejo/workflows/build.yml` — шаг «Select the role chat settings flag for this environment»
   (`id: role_chat_flag`) после шага `credit_flag` и строка `VITE_ROLE_CHAT_SETTINGS_ENABLED=${{
   steps.role_chat_flag.outputs.role_chat_enabled }}` в `build-args` шага `docker/build-push-action` — патч куратору
   (отчёт builder'а round 2). Пусто = `false`, значение вне `true` / `false` валит сборку.
3. Переменная репозитория `CRM/fe-prionex` → Settings → Actions → Variables:
   `VITE_ROLE_CHAT_SETTINGS_ENABLED_DEV = true` (как уже стоит `VITE_CREDIT_MODULE_ENABLED_DEV = true`);
   `_PREPROD` / `_PROD` не заводить (= off).
4. Строки `VITE_ROLE_CHAT_SETTINGS_ENABLED=false` с пояснением в `.env.example`, `.env.dev.example`,
   `.env.production.example` (рядом с `VITE_CREDIT_MODULE_ENABLED`).
5. ⚠️ Автодеплой DEV (`dev-branch-autodeploy.yml`) переиспользует готовый образ `sha-<12hex>-dev`
   (`reuse_published_image: "true"`): переменную ставить ДО мержа `sync(dev)`, иначе нужен новый коммит в `dev`
   или ручная сборка без переиспользования.

**Тесты обоих путей** (vitest `src/features/roles src/pages/RoleManagement`, `vi.stubEnv`):
- off — `EditRoleForm.hubRole.test.tsx` (файл HEAD возвращён: 28 тестов прежнего поля, флаг off явно; правка —
  частичный мок `@/lib/api`, текст `HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN` расширен в round 1), describe «flag off» в
  `RoleForm.chatSettingsFlag.test.tsx` (6), `EditRoleModal.hubRole.test.tsx` (1), `RoleManagementPage.hubRole`
  (3 прежних + 1 «нет столбца при флаге off»), `roleHubRolePayload.test.ts` (15 тестов `hub_role`-патчей HEAD);
- on — `RoleForm.chatSwitches.test.tsx` (47), `RoleForm.hubRoleGone.test.tsx` (10), describe «flag on» в
  `RoleForm.chatSettingsFlag.test.tsx` (5), `EditRoleModal.hubRole.test.tsx` (1), `RoleManagementPage.hubRole` (2),
  `roleHubRolePayload.test.ts` (14);
- `RoleForm.chatSettingsFlag.test.tsx` — бок о бок: без флага поле «Роль у чаті (HUB)» на месте и `hub_role`
  уходит (edit / create), строка в просмотре; с флагом секция / шаблон и `hub_role` не уходит никогда;
- `roleChatSettingsFlag.test.ts` — значение флага (12) и дорога до образа (5, по образцу `creditModuleFlag.test.ts`):
  `ARG` + `ENV` в `Dockerfile.prod` до сборки бандла и имя в коде — зелёные (2); **три проверки `build.yml` красные, пока куратор не
  внесёт патч шага** (сторож, чтобы флаг не уехал мёртвым) — патч проверен на копии `build.yml`: применяется
  чисто, YAML валиден, все три проверки проходят, шаг даёт `false` на пустом, `true` / `false` как есть, отказ на
  `1`.

Проверки round 2 (под `flock … systemd-run … CPUQuota=200% MemoryMax=8G`, по коду возврата): `npx tsc -b` rc=0;
`npx eslint --max-warnings=0` по 24 изменённым TS-файлам rc=0; `npx prettier --check` по ним и словарям rc=0;
`npx vitest run src/features/roles src/pages/RoleManagement` rc=1 — 253 passed, 3 failed (только проверки
`build.yml` выше); соседи `WorkDialog.hubAdminGuard`, `ProjectRoleGroupRow.scopeDenied`, `AssistantAccessSection`
rc=0 (10); `git diff --check` rc=0. Полный vitest и `vite build` не запускал (CI).

Допущения round 2:
- Значение `1` код принимает (как флаг таблиц ассистента), а шаг `build.yml` пускает только `true` / `false` (как
  кредитный флаг) — опечатка в переменной валит сборку, а не оставляет старое поле молча.
- Тексты `errors.json` из round 1 (расширенные `HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN` /
  `HUB_ROLE_FORBIDDEN_WHILE_IMPERSONATING` и новые коды) за флаг не прячутся: это слова API, верные для обоих путей;
  без флага пользователь видит их в общем Alert, как раньше.
- Столбец «Роль у чаті (HUB)» списка не тронут ни при каком значении флага.

**Вопрос владельцу (до PROD-релиза этой истории):** включать флаг на PROD вместе с историей 13 HUB
(`HUB_CHAT_SET_MODE=on`), когда правки переключателей реально доходят до HUB, — или раньше, с подсказкой в форме,
что изменения дойдут до HUB после включения? До решения PROD собирается без флага (поле «Роль у чаті (HUB)»).

### Review round 3 (bot round 1, 02.10)

Основание: ревью бота Олега на PR CRM/fe-prionex#380 (раунд 1, review id 1186, head `716b3fc7`) — один Medium и
три Low.

Исправлено (три Low):
1. **Просмотр роли говорил «не заполнено» о нечитаемом наборе.** `ViewRoleForm.tsx` читал `chat_switches` через
   `readChatSwitches` и не передавал `unreadable`: значение, которое есть, но не восемь переключателей, выглядело
   как незаполненное. Теперь как в `EditRoleForm`: `storedChatSwitches(role.chat_switches)` →
   `switches = filled ? switches : null`, `unreadable = kind === 'unreadable'`. Тест: describe «ViewRoleForm -
   chat settings» — строка, пустой объект и объект с частью ключей показывают `pages.roles.chat.unreadable`, а не
   `notFilled` (3, `it.each`); случай `null` → `notFilled` уже был («says a role is not filled…»).
2. **Ключ черновика зависел от порядка ключей сырого объекта.** `storedKey` в `EditRoleForm.tsx` строился из
   `JSON.stringify(role.chat_switches)`: повторная загрузка с теми же значениями в другом порядке ключей сбрасывала
   черновик и показывала «тим часом змінили». Теперь ключ из прочитанных значений:
   `[filled ? orderedSwitches(switches) : kind, storedHomePlane]`. Тест: describe «EditRoleForm - review round 1» —
   рефетч с теми же значениями в обратном порядке ключей черновик сохраняет, «outdated» не показывает, PUT несёт
   черновик. Рефетч с другим значением сбрасывает — тест «drops a draft when the stored values change…» уже был.
3. **Текст `HUB_ROLE_FORBIDDEN_WHILE_IMPERSONATING` перечислял элементы формы с флагом** («роль у чаті,
   перемикачі, екран чи шаблон»), которых без флага нет. Формулировка в `public/locales/{uk,en,es}/errors.json`
   стала нейтральной для обоих путей: «не можна змінювати права в чаті (HUB) і призначати на ролі адміністратора
   HUB» (en / es — тот же смысл). Допущение round 2 о текстах `errors.json` для этого кода этим уточнено.
   `HUB_ROLE_ADMIN_REQUIRES_HUB_ADMIN` не тронут: его расширенный текст описывает причины api (отказ из-за
   админского набора чата приходит и без флага — история 2a). Тестов на точный текст кода нет (grep по строке).

Отклонено (Medium, решение куратора): «PUT шлёт неизменённые переключатели» — по фактам api не дефект:
`switch_edit` в `services/auth/app/domain/chat_role_set.py` сравнивает присланные значения с сохранёнными и
неизменённые правкой не считает, `chat_edit_needs_hub_admin` при этом возвращает False. `buildRolePayload.ts` /
`chatUpdatePatch` не менялись. **Отклонение снято review round 4:** бот в раунде 2 показал сценарий потери чужой
правки (см. ниже), куратор довод принял.

Красный до правки: 4 новых теста на компонентах HEAD `716b3fc7` — rc=1, 4 failed (тест порядка ключей падает на
`toBeChecked`: черновик сброшен).

Проверки round 3 (под `flock … systemd-run … CPUQuota=300% MemoryMax=10G`, по коду возврата):
`npx vitest run src/features/roles src/pages/RoleManagement` rc=0 — 12 файлов, 260 passed
(`RoleForm.chatSwitches.test.tsx` 51); сторожа словарей `src/lib/__tests__/spanishLocaleParity.test.ts` +
`errors.codes.test.ts` rc=0 (33), `hubRoleErrorCodes.test.ts` — в прогоне roles; `npx tsc -b` rc=0;
`npx eslint --max-warnings=0` по трём изменённым TS-файлам rc=0; `npx prettier --check` по ним и трём словарям
rc=0; `git diff --check` rc=0. Полный vitest и `vite build` не запускал (CI).

### Review round 4 (bot round 2, 02.10)

Основание: ревью бота Олега на PR CRM/fe-prionex#380 (раунд 2, review id 1187, head `dfdda5c4`) — Medium P1 остался
открытым; куратор довод принял, отклонение round 3 снято.

**Почему.** `chatUpdatePatch` при отличии хоть одного поля слал оба: `chat_switches` (все восемь) и `home_plane`.
Сценарий потери чужой правки: A открыл форму (переключатели X), B тем временем сохранил переключатели Y, форма A не
перечитала роль; A меняет только экран и сохраняет — PUT несёт старые X, API видит в них правку (они отличаются от
сохранённых Y) и затирает Y. Зеркально: правка только переключателей возвращала старый экран поверх чужого нового.
Сброс черновика при перезапросе (round 1) от этого не спасает — он срабатывает, только если роль перечитана.

**Что изменено** (`src/features/roles/buildRolePayload.ts`, `chatUpdatePatch` и комментарии): каждое поле уходит
само по себе — `chat_switches` (все восемь, API принимает только полный набор) только если отличаются от
сохранённых или роль заполняется (`stored === null`), `home_plane` только если отличается от сохранённого. Ничего не
отличается — `{}`, как раньше. Что уходит в PUT:

| Случай | PUT |
|---|---|
| сменили только экран | `home_plane` |
| сменили только переключатели | `chat_switches` |
| сменили и то и другое | `chat_switches` + `home_plane` |
| заполнение (`chat_switches: null`), экран не меняли | `chat_switches` |
| заполнение, экран сменили | `chat_switches` + `home_plane` |

Заполнение без `home_plane` — по контракту API (`services/auth/app/schemas/role.py`, api-prionex `origin/main`
`a3d975b6`): ключ отсутствует = не менять; столбец `roles.home_plane` NOT NULL с умолчанием `my_day`, GET отдаёт
`known_home_plane(...)` — экран, который форма показала, у роли уже сохранён. AC2 и AC4 приведены к этому.

Потребители не зависят от того, что ключей было два: `chatRefusal` читает только ответ (`params.field`),
`dropsChatDraft` сбрасывает весь черновик на 403 по любому полю чата, секция ставит отказ у экрана по
`field === 'home_plane'`; API называет поле по тому, что правка реально двигает (`edited_chat_field`), — тот же ответ,
что и раньше, когда неизменённые переключатели шли довеском.

Тесты: `roleHubRolePayload.test.ts` — «только переключатели» (без экрана), «только экран», «оба», «заполнение без смены
экрана», «заполнение со сменой экрана» (+2 теста); `RoleForm.chatSwitches.test.tsx` — ожидания PUT по переключателям
(5, `it.each`), экрану и заполнению переписаны (неизменённое поле отсутствует), отказ 403 `field: home_plane`
проверяет и отсутствие `chat_switches` в отказанном PUT; `RoleForm.chatSettingsFlag.test.tsx` — правка переключателя
без `home_plane`. Красный до правки: на коде `dfdda5c4` 12 тестов падают (3 файла), «оба» и «заполнение со сменой
экрана» зелёные и там (старое поведение совпадает).

Проверки round 4 (под `flock … systemd-run … CPUQuota=300% MemoryMax=10G`, по коду возврата):
`npx vitest run src/features/roles src/pages/RoleManagement` rc=0 — 12 файлов, 262 passed; `npx tsc -b` rc=0;
`npx eslint --max-warnings=0` по четырём изменённым TS-файлам rc=0; `npx prettier --check` по ним rc=0;
`git diff --check` rc=0. Полный vitest и `vite build` не запускал (CI).

## Tails

- Столбец «Роль у чаті (HUB)» в списке ролей оставлен как был (история сняла поле с формы, не со списка); рядом
  новый «Чат (HUB)». Убрать старый столбец — решение куратора / владельца вместе с выводом `hub_role` из оборота.
- Помощники `hubRoles.ts` (`hubRoleChoices`, `hubRoleLock`, `effectiveHubRoleValue`, `isAssignableHubRole`),
  `HubRoleSelect.tsx`, `hubRoleCreatePatch` / `hubRoleUpdatePatch` и ключи `pages.roles.forms.hubRoleHint` /
  `hubRoleUnavailableOption` / `hubRoleLockedDefault` / `hubRoleLockedNotAssignable` с round 2 снова в деле — это
  путь без флага. Убрать их (и ветку «без флага» в трёх формах и столбце) — отдельной правкой, когда флаг включён
  на всех стендах и метрики подтвердили (правило 28.5), вместе со столбцом «Роль у чаті (HUB)».
- ~~Пока `HUB_CHAT_SET_MODE=off` (до истории 13), изменения переключателей хранятся в CRM, но в HUB не доезжают;
  форма об этом не говорит~~ — закрыто round 2: поверхность за флагом `VITE_ROLE_CHAT_SETTINGS_ENABLED`, по
  умолчанию выключена. Открытым остаётся вопрос владельцу о PROD (см. round 2).
- Куратору до мержа: патч шага `role_chat_flag` в `.forgejo/workflows/build.yml` (иначе три проверки
  `roleChatSettingsFlag.test.ts` красные и флаг мёртв в образе), строки в трёх `.env*.example`, переменная
  `VITE_ROLE_CHAT_SETTINGS_ENABLED_DEV=true` в репозитории до `sync(dev)` (см. round 2).
- Вне зоны (находка round 2, уверенность высокая): `VITE_ASSISTANT_REPORT_TABLES_ENABLED` объявлен в
  `Dockerfile.prod` (`ARG` :35 / `ENV`), но в `build-args` шага сборки Forgejo `.forgejo/workflows/build.yml` его
  нет (передаётся только в legacy `.github/workflows/CD.yml:167`) — в образах Forgejo CI он всегда пуст
  (= выключен), включить на стенде нельзя. Записано в `deferred-work.md` («Deferred from: story crm-roles-4,
  review round 2»).
- API не сообщает причину `assignable: false` у шаблона (HUB-админ или имперсонация).

**Curator record 02.10.2026 (ceo-prionex-71):** PR fe #380 → `main` merge `46772a9b` (13:21 CEST), голова
`af413578`: коммиты `716b3fc7` (сборка + review rounds 1–2), `dfdda5c4` (round 3 = бот раунд 1, review 1186: три
Low исправлены, Medium отклонён), `af413578` (round 4 = бот раунд 2, review 1187: Medium принят — при правке
только экрана уходили и старые переключатели, затирание чужой правки; каждое поле чата уходит, только если само
изменилось, при заполнении `home_plane` — только при смене); approve бота — review 1190 (13:19 CEST, на
`af413578`). Пара sync(dev) #382 → `dev` merge `32bffcbb` (13:32 CEST; cherry-pick `2ea3c813`, `a3e95c29`,
`60878626`), голова `dev` `0d98369c` её содержит. Проводка флага на `main` и `dev`: шаг `role_chat_flag` в
`.forgejo/workflows/build.yml` + `build-args`, `ARG` / `ENV` в `Dockerfile.prod`, строки
`VITE_ROLE_CHAT_SETTINGS_ENABLED=false` в трёх `.env*.example`. Образ DEV собран с переменной репозитория
`VITE_ROLE_CHAT_SETTINGS_ENABLED_DEV=true`; `_PREPROD` / `_PROD` не заведены = off (PRE-PROD / PROD — прежнее поле
«Роль у чаті (HUB)»). Доска: #1621, комментарий куратора 40709 (история 4 на DEV).

Живая проверка на CRM DEV 02.10 15:55–16:15 CEST (`https://crm.dev.crm-prionex.online`, qa_admin, headless
Chrome; проект 1 Technofinance; две роли под проверку — 27 «QA F1-dev check 02.10 (delete me)» и 28 «… b» — по
одному праву, людей 0, обе заархивированы; Lawyer и synth-роли не менялись; результаты и скриншоты —
scratchpad сессии `accept/F1-dev/results.json`):

| AC | Итог | Что видно |
|---|---|---|
| AC1 секция, значения из GET | PASS | Lawyer (id 10): восемь переключателей в порядке `SWITCH_KEYS` и экран (6 значений), значения совпадают с `GET /admin/roles/10` |
| AC2 что уходит | PASS | только переключатель — PUT с `chat_switches` (8 ключей) без `home_plane` / `hub_role` / `chat_template` (роли 27, 28); только экран — PUT с `home_plane` без `chat_switches`, переключатели API сохранил (роль 28). «Оба в одном сохранении» живьём не делали — юнит-тесты |
| AC3 правила недоступности | PASS | «Лише чат (бот)» и «Доступ до чату» выкл блокируют нужные элементы с пояснением; показ `CHAT_SWITCHES_CONFLICT` словами не проверен (нужен отказ API) |
| AC4 «не заповнено» | PASS | роль 28 без шаблона (`chat_switches: null`): подсказка «ще не заповнено» и кнопка «Заповнити налаштування чату»; после заполнения PUT несёт только `chat_switches`, без `home_plane`, экран остался `my_day`, `chat_set_follows_hub_role` → false; затем смена только экрана — PUT только с `home_plane` |
| AC5 только чтение | PARTIAL | форма просмотра — текст, 0 элементов, каталог не запрашивается; «Налаштування чату змінені вручну» видна у роли 28, у роли 27 пропадает после возврата переключателя (`follows` снова true); каталог 403 (проект 2 Spain Test Project) — секция только для чтения с пояснением. Не проверено: пользователь без `manage_roles`, impersonation. Провалов нет |
| AC6 шаблон только при создании | PASS | 9 кодов с подписями; с `employee` — POST 201 с `chat_template`, без `hub_role` / `chat_switches` / `home_plane`, набор заполнен из шаблона; без выбора ключа `chat_template` в POST нет, роль «не заповнена». Пометка «потрібен адміністратор HUB» не проверена: у qa_admin все 9 `assignable: true` |
| AC7 «Роль у чаті (HUB)» убрана | PASS | в create / edit / view поля нет; ни в одном из 2 POST и 5 PUT нет `hub_role`; столбец в списке остался, как задумано |
| AC8 отказы словами | не проверено | отказ из UI не вызвать (AC3 не даёт собрать конфликт, qa_admin — HUB-админ, impersonation не применялась); тексты кодов — юнит-тесты |
| AC9 столбец списка | PASS | «Чат (HUB)» так / ні совпадает с `chat_access` в `GET /admin/roles`; «—» в UI не видели (API отдавал `null` у роли 28 до заполнения) |
| AC10 тексты и тесты | вне живой проверки | юнит-тесты и паритет словарей — CI PR #380 |
| AC11 флаг сборки | PASS (ветка on) | сборка DEV ведёт себя как флаг on; ветка off на DEV не видна — юнит-тесты |

Что уходило в живых запросах (тела запросов из логов проверки `flow_c-log.json` / `flow_d-log.json`; в каждом
PUT кроме чат-полей — обычные поля формы `name` / `description` / `permission_ids` / `access_levels` /
`department_id`; `hub_role` нет ни в одном):

| Шаг | Запрос → ответ | Чат-ключи в теле | Ответ API |
|---|---|---|---|
| роль 27, создание с шаблоном `employee` | `POST /admin/roles` → 201 | `chat_template: employee` (без `chat_switches` / `home_plane`) | набор из шаблона: доступ, группы, файлы, ИИ вкл, диалоги `none`, экран `my_day`; `follows: true` |
| роль 27, «Завантажувати файли» выкл | `PUT /admin/roles/27` → 200 | `chat_switches` (8 ключей, `download_files: false`) | `follows: false` |
| роль 27, «Завантажувати файли» снова вкл | `PUT /admin/roles/27` → 200 | `chat_switches` (8 ключей, `download_files: true`) | как после создания, `follows: true` |
| роль 28, создание без шаблона | `POST /admin/roles` → 201 | нет (ни `chat_template`, ни других) | `chat_switches: null`, `chat_template: null`, экран `my_day` |
| роль 28, «Заповнити…» + доступ вкл | `PUT /admin/roles/28` → 200 | `chat_switches` (8 ключей, только `access: true`), без `home_plane` | набор сохранён, экран `my_day`, `follows: false` |
| роль 28, только экран `my_day` → `operator` | `PUT /admin/roles/28` → 200 | `home_plane: operator`, без `chat_switches` | экран `operator`, переключатели не тронуты |
| роль 28, только «Завантажувати файли» вкл | `PUT /admin/roles/28` → 200 | `chat_switches` (8 ключей, `download_files: true`), без `home_plane` | экран остался `operator` |
| роли 27 и 28, архив | `POST /admin/roles/{id}/archive` → 200 | — | обе роли вне активного списка |

Побочные находки: роль без разрешений молча не сохраняется (текст валидации далеко ниже видимой области) — старое
поведение, не эта история, доска #1687; «`chat_access: null` в GET одной роли» — в ответах детали ключа нет вовсе
(контракт api 2b), запись в api-prionex `deferred-work.md`; PUT шлёт `department_id: 0`, POST — `null` (API отвечает
`null` в обоих; старое, общее поле формы); каталог 403 в проектах 2 и 3 — секция только для чтения, права роли в той
же форме редактируются (принимает ли API такой PUT — не проверялось); на 390 px текст выбора шаблона обрезается
(нативный select, косметика); учётку qa_admin периодически выбивала параллельная сессия (процесс проверки, не
продукт). Хвосты — `deferred-work.md` («Deferred from: story crm-roles-4, curator DEV acceptance»).

**Вопрос владельцу (открыт):** включать флаг на PROD вместе с историей 13 HUB или раньше, с подсказкой в форме. До
ответа PRE-PROD / PROD собираются без флага. Status review → **done**: приёмка на DEV была; выкат на PROD с флагом —
решение владельца.
