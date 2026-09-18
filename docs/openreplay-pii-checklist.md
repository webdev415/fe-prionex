# OpenReplay: чек-лист разметки ПДн (KAN-KB-54)

Таблица «маршрут → компоненты → что должно быть в звёздочках → что обязано остаться читаемым».
По ней человек проходит **одну** запись на DEV (фаза 6 плана
[`openreplay-pii-markup-plan.md`](openreplay-pii-markup-plan.md)) вместо того, чтобы
вспоминать по ходу, что именно проверять.

Файл заведён в PR фазы 1 и пополняется **каждым** PR разметки. Строка появляется здесь
одновременно с диффом, а не после — иначе к фазе 6 таблица описывает не то приложение,
которое размечено.

## Как пользоваться

1. Открыть маршрут на DEV-сборке.
2. Прогнать `window.__piiAudit()` в консоли — **до** просмотра записи. Пустой вывод
   (`✅ … none readable on this screen`) — условие того, что на запись идти вообще имеет смысл.
3. Посмотреть запись этого экрана: колонка «в звёздочках» — звёздочки, колонка «читаемо» — текст.
4. В инспекторе записи проверить **атрибуты** узлов (`title`, `alt`, `aria-label`,
   `placeholder`): трекер их не маскирует вообще, и на кадре их не видно.

> ⚠️ Пустой вывод детектора — не доказательство отсутствия ПДн вообще. Он проверяет **те
> значения, которые вернул API** этому сеансу, в **том DOM**, который сейчас на экране.
> Экран, который не открыли, он не видит; поле, которого не было в ответе, — тоже.

## Статус по фазам

Строка переводится в ✅ тем же PR, который закрывает раздел, — не заранее.

| Фаза | Раздел | Ветка | Статус |
|---|---|---|---|
| 1–2 | Инфраструктура, аудит, детектор | `feat/kanban-54/infra` | ✅ |
| 3.1 | `pages/ClientManagement` | `feat/kanban-54/markup-client-management` | ✅ |
| 3.2 | `pages/EmployeeCard` + `features/users` | `feat/kanban-54/markup-employees` | ✅ |
| 3.3 | `pages/LawyerWorkplace` | `feat/kanban-54/markup-lawyer` | ✅ |
| 3.4 | `pages/ActionAnalysis` | `feat/kanban-54/markup-action-analysis` | ✅ |
| 3.5 | `pages/Training` + остальные разделы | `feat/kanban-54/markup-training-rest` | ✅ |
| 4 + 5.7 | ПДн в атрибутах, `<iframe>` | `feat/kanban-54/attributes` | ⬜ |
| 5 | Порталы | `feat/kanban-54/portals` | ⬜ |
| 7 | Барьер в CI | `feat/kanban-54/ci-barrier` | ⬜ |
| 8 | Снятие гейта | `feat/kanban-54/gate` | ⬜ |

## Маршруты

### Карточка клиента и связанные экраны

| Маршрут | Компоненты | В звёздочках | Читаемо |
|---|---|---|---|
| `/dashboard/clients/:id` | `ClientDetailPage` | ФИО клиента, адреса (`fullAddress`, `registrationAddress`), ФИО связанных контактов и рекомендателей, комментарии | заголовок «Карточка клиента», названия вкладок и полей, номер договора, статусы, суммы |
| `/dashboard/clients/:id` → вкладка «Рекомендатели» | `RecommendersTab` | ФИО рекомендателя, его адрес, комментарий | тип контакта, статус проверки, даты |
| `/dashboard/clients/:id` → вкладка «Контакты» | `ContactsTab`, `ContactCard` | ФИО контакта | тип контакта, статус |
| `/dashboard/clients/:id/activity` | `ActivityTimelinePage` | ФИО клиента в шапке, ФИО автора события | тип события, дата, название экрана |
| `/dashboard/clients/:id/payment-history` | `PaymentHistoryPage` | ФИО клиента, ФИО ответственного (`assigned_user_full_name`) | суммы, даты, статусы платежей |
| `/dashboard/clients/:id/debt-summary` | `DebtSummaryPage` | ФИО клиента | суммы задолженности, даты |
| `/dashboard/operator-work-list` | `ClientManagementPage`, `DataTable` | колонка ФИО, колонка адреса | заголовки колонок, статусы, суммы, пагинация |
| модалка назначения | `AssignClientModal` | ФИО клиента в подтверждении | заголовок модалки, кнопки |

> **Закрыто в 3.1** (`npm run pii-audit src/pages/ClientManagement` → 0 мест рендера):
> `ClientDetailPage` (ФИО в заголовке, оба адреса, ФИО руководителя с места работы),
> `ActivityTimelinePage` (ФИО в заголовке), `ClientManagementPage`
> (колонки `fullName`, `employeeName`, `searcherName`), `ClientReversalsTable`
> (колонки клиента и оператора), `AssignClientModal`, `BulkAssignClientModal`,
> `BulkSendMessageModal`, `DeleteClientModal`, `EditClientModal` (адрес),
> `ReassignPaymentEmployeeModal`, `RecommendersTab` (комментарий контакта).
>
> Осталось на фазу 4: `title={…fullName}` на `<Link>` в `ClientDetailPage:1617`
> и `RecommendersTab:365` — атрибут, разметкой не лечится.

### Сотрудники и пользователи

| Маршрут | Компоненты | В звёздочках | Читаемо |
|---|---|---|---|
| `/dashboard/team-management/users` | `UserManagementPage`, `DataTable` | колонка ФИО | логин, роль, отдел, статус |
| `/dashboard/team-management/users/:userId` | `EmployeeCardPage` и вкладки | ФИО сотрудника | должность, отдел, роль, метрики |
| модалки пользователя | `CreateUserForm`, `EditUserForm`, `ViewUserForm` | значения и ошибки полей ФИО | подписи полей, названия ролей, текст ошибок валидации без ПДн |

> **Закрыто в 3.2** (`npm run pii-audit src/pages/EmployeeCard src/features/users src/pages/UserManagement` → 0):
> `FieldGrid` получил флаг `obscured` на поле — атрибут садится на `<dd>`, подпись в `<dt>`
> остаётся читаемой; отмечены ФИО, домашний адрес, ФИО контактного лица и детей.
> `ProfilePanel` — ФИО в заголовке (должность читаема). `UserManagementPage` — колонка ФИО
> плюс `data-openreplay-label`. `ViewUserForm` — значения полей ФИО.
>
> В allowlist: `errors.first_name|last_name|middle_name` в `CreateUserForm`/`EditUserForm` —
> это состояние валидации, а рендерится `errors.<field>.message` («First name is required»),
> то есть текст интерфейса. Значение самого инпута уже снято `defaultInputMode: 2`,
> а разметка блока увела бы в звёздочки подпись поля.
>
> Осталось на фазу 4: `UserAvatar` кладёт ФИО в `alt`, `title` и `aria-label` — атрибут,
> разметкой не лечится, и это **общий** компонент, то есть утечка на каждом экране со списком людей.

### Рабочее место юриста

| Маршрут | Компоненты | В звёздочках | Читаемо |
|---|---|---|---|
| `/dashboard/lawyer-workplace` | `LawyerWorkplacePage`, канбан, треды | ФИО клиента в карточках задач, в письмах и в выборе клиента | статусы задач, названия колонок канбана, даты |

> **Закрыто в 3.3** (`npm run pii-audit src/pages/LawyerWorkplace` → 0): канбан
> (`KanbanCard`, `KanbanTaskDetailPanel`), входящие (`LetterListItem` — отправитель и клиент),
> тред (`EmailThreadPanel` — имя отправителя, инициалы в аватаре, чип клиента),
> `LetterContextPanel` (ФИО в контексте письма), документы (`DocumentsTable`,
> `DocumentDetailDrawer`), реестр (`registryColumns` — колонка «ФИО / учреждение»).
>
> Код клиента, номер договора, исходящий номер, тема письма и статусы — **читаемы**:
> ими запись остаётся узнаваемой, когда имя ушло в звёздочки.
>
> ⚠️ Этот раздел статический аудит не видел вовсе: он пишет ФИО как `clientName`, а
> словарь искал `full_name`/`fullName`. Правило расширено тем же PR — см. описание.

### Анализ действий

| Маршрут | Компоненты | В звёздочках | Читаемо |
|---|---|---|---|
| `/dashboard/action-analysis` | `CallsTable`, `InteractionHistoryTable`, `PaymentHistoryTable`, `TaHistoryTable` | колонки ФИО клиента и оператора, тексты взаимодействий | заголовки колонок, оценки, длительности, статусы |
| фильтр оператора | `EmployeeFilterDropdown` | ФИО в списке и в выбранном значении | подпись фильтра, «Все операторы» |
| диалоги инбокса | `RateDialogueDialog`, `ScheduleOneOnOneDialog` | ФИО оператора | заголовок диалога, шкала оценки |

> **Закрыто в 3.4** (`npm run pii-audit src/pages/ActionAnalysis` → 0): колонки ФИО в
> `CallsTable`, `InteractionHistoryTable`, `PaymentHistoryTable`, `TaHistoryTable`
> (две колонки — «кто создал» и «ответственный на момент создания»),
> `EmployeeFilterDropdown`, `DynamicsSubTab` (атрибут на самом `<option>`: `<Pii>`
> не является валидным потомком `<select>`), диалоги инбокса, комментарий оператора
> в `MarkersSubTab`.
>
> Оценки, длительности, статусы, даты и заголовки колонок — читаемы.

### Обучение

| Маршрут | Компоненты | В звёздочках | Читаемо |
|---|---|---|---|
| `/dashboard/training` → аналитика | `InteractionsSubTab`, `PromisesAndCallbacksSubTab`, `LeaksSubTab` | ФИО клиента (в т. ч. бывшее в `title`) | `#client_id`, даты, суммы, статусы |
| `/dashboard/training` → диалоги | `ScorecardListView`, `DialogueDetail` | ФИО клиента и оператора, комментарии | баллы, критерии, даты |
| `/dashboard/training` → материалы | `MaterialPreviewModal` | — (материал не ПДн; `<iframe>` не пишется) | название материала |

> **Закрыто в 3.5** — `npm run pii-audit` даёт **0 мест рендера по всему `src/`**, не только
> по этому разделу. Кроме `pages/Training` (таблицы, аналитика, диалоги, инбокс, отдел, курсы,
> тесты) сюда вошли: шапка приложения целиком (`DashboardLayout`, `NotificationBell`,
> `TaskBell`, `UserProfile`, обе свёрнутые плашки звонка и цепочки), `features/calls`,
> четыре отчётные таблицы (`communicationGap`, `contactTag`, `inboundFollowup`,
> `searcherFollowup`), `pages/Dialer`, `pages/Operations` (превью массовых операций),
> `pages/Credit`, `pages/UbkiIntegration`, `pages/DocumentGeneration`, `pages/InteractionLog`,
> `pages/RoleManagement`, `features/quality`, а также оставшиеся места в `ClientManagement`,
> которых расширенный словарь не видел в фазе 3.1.
>
> `SearchableSelect` получил проп `obscured` — тем же способом, что `Column.obscured`:
> компонент выбирает и людей, и портфели, и статусы, и различить их изнутри нельзя,
> а вызывающий знает всегда. Проставлен в 11 местах, где выбирают человека.
>
> В allowlist осталось **две** записи, обе про `portfolio.displayName`: портфель — не человек.

### Остальное

| Маршрут | Компоненты | В звёздочках | Читаемо |
|---|---|---|---|
| любой экран | `NotificationBell` | `trainer_full_name` в уведомлении | тип уведомления, время |
| входящий звонок | `IncomingCallWindow`, `IncomingCallWindowContainer`, `MinimizedCallPill`, `IncomingCallPrompt`, `CallDialogModal` | ФИО звонящего | номер линии, кнопки «Принять»/«Отклонить», таймер |
| поиск клиента | `CallClientSearch`, `SearchResults` | ФИО в результатах | подпись поля поиска, «Ничего не найдено» |
| тосты | `Toaster` (`sonner`) | ФИО/логин **внутри конкретного тоста** | системные сообщения об ошибках целиком |
| просмотр документа | `DocumentPreviewModal`, `DocumentFileViewer` | содержимое `<iframe>` не пишется вовсе; имя файла убрано из `title` | заголовок модалки, кнопки |
| генерация документов | `DocumentGenerationPage`, `DocumentTemplatesTab` | ФИО в полях договора | названия шаблонов, их описания |
| кредитный модуль | `pages/Credit/*` | ФИО заявителя | суммы, статусы заявок, названия продуктов |
| профиль | `ProfileSettingsPage` | собственное ФИО оператора | подписи полей, названия настроек |

## Что НЕ должно быть размечено

Отдельный список, потому что пропуск и перебор ломают запись одинаково, а перебор ещё и
незаметен: он выглядит как «всё хорошо, всё в звёздочках».

- URL в адресной строке и заголовки экранов;
- пункты навигации и хлебные крошки;
- названия колонок таблиц (`<th>` не размечается никогда);
- статусы, суммы, даты, метрики и агрегаты;
- `ip_address` (`pages/IpWhitelist`) — не буквенные ПДн;
- `email_address` — уже закрыт `obscureTextEmails` в опциях трекера;
- названия отделов, ролей и должностей;
- системные сообщения об ошибках и текст пустых состояний.

## Экраны от человека (шаг 2.2)

Файл `docs/openreplay-pii-screens.md` (список экранов, составленный по реальной записи)
в репозитории **отсутствует**. Шаг 2.2 плана пропущен, не выполнен. Когда файл появится —
сверить его с этой таблицей в обе стороны и дописать расхождения сюда.
