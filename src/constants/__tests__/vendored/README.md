# vendored/ — снимки чужих словарей

Здесь лежат копии данных, которыми владеет **не** этот репозиторий. Копия нужна,
чтобы тест мог сверяться с источником, не ходя в сеть; она стареет, и порядок
пересъёмки описан ниже.

## `credit-w1-permissions.json` — словарь прав кредитного модуля (Wave 1)

| Что | Значение |
|---|---|
| Источник | `CRM/api-prionex`, ветка `main` |
| Путь в источнике | `services/auth/alembic/versions/20260902_1000_082_credit_module_roles.py` |
| Коммит съёмки | поле `source_commit_sha` в самом файле |
| Кто снял | поле `captured_by` |
| Когда | поле `captured_at` |
| Сколько имён | 17 |

Файл читают два теста: `../creditW1Permissions.test.ts` (право, употреблённое в
интерфейсе, обязано быть в этом списке) и — через общий модуль
`../creditPermissionSets.ts` — `../creditOutOfW1Permissions.test.ts`.

Файл **не** исполняется как тест: `vitest.config.ts` ловит только
`*.{test,spec}.*`. Зато он попадает под `format:check` (`.prettierignore` в
репозитории нет), поэтому обязан быть в формате Prettier: два пробела, `LF`,
завершающий перевод строки, без BOM.

### Как проверить, что снимок не протух

```bash
# 1. sha256 источника — обязан совпасть с полем source_sha256
sha256sum services/auth/alembic/versions/20260902_1000_082_credit_module_roles.py

# 2. список имён из миграции — обязан совпасть с полем permissions
grep -o 'credit\.[a-z_]*\.[a-z_]*' \
  services/auth/alembic/versions/20260902_1000_082_credit_module_roles.py | sort -u

# 3. подпись списка — обязана совпасть с полем sha256
python3 -c "import json,hashlib,sys; d=json.load(open(sys.argv[1])); \
print(hashlib.sha256('\n'.join(sorted(d['permissions'])).encode()).hexdigest() == d['sha256'])" \
  src/constants/__tests__/vendored/credit-w1-permissions.json
```

### Алгоритм самохеша

`sha256` в файле — это `sha256(sorted(permissions).join('\n'))`, то есть подпись
**списка**, а не байтов файла. Так считаны все снимки этого словаря в
`credit-module` и `api-prionex`; переформатирование файла подпись не ломает.
Не «чинить» на «хеш байтов с обнулённым полем»: сломается сходимость с копиями
в соседних репозиториях.

### Когда пересъёмка обязательна

- вышла новая миграция прав в auth-сервисе — рядом кладётся **новый** снимок с
  провенансом этой миграции (как `credit-confirm-conditional-permission.json` для
  098), снимок 082 не переписывается: его провенанс — один файл миграции; страж
  объединяет снимки;
- перед заморозкой релиза (условие `F-FE-05`) — подтвердить отсутствие дрейфа
  либо обновить `source_commit_sha`, `source_sha256`, `captured_at`;
- ни один тест этого репозитория **не** открывает миграцию и не пересчитывает
  список: сверка с живым источником — ручная работа владельца, а не CI.

Владелец снимка — куратор программы Wave 1 (`F-FE-05`). Секретов в файле нет и
быть не должно: это публичные имена прав.

## `credit-confirm-conditional-permission.json` — право подтверждения условного одобрения (19-5a)

| Что | Значение |
|---|---|
| Источник | `CRM/api-prionex`, ветка `main` |
| Путь в источнике | `services/auth/alembic/versions/20260929_0000_098_credit_decisions_confirm_conditional.py` |
| Коммит съёмки | поле `source_commit_sha` в самом файле (мерж PR #533) |
| Кто снял | поле `captured_by` |
| Когда | поле `captured_at` |
| Сколько имён | 1 |

Файл читает `../creditW1Permissions.test.ts`: словарь стража — объединение этого снимка и
снимка 082; проверки канона, списка, провенанса и самохеша идут на каждом снимке со своим
счётом (082 — 17, этот — 1).

### Как проверить, что снимок не протух

```bash
# 1. sha256 источника — обязан совпасть с полем source_sha256
sha256sum services/auth/alembic/versions/20260929_0000_098_credit_decisions_confirm_conditional.py

# 2. список имён из миграции — обязан совпасть с полем permissions
grep -o 'credit\.[a-z_]*\.[a-z_]*' \
  services/auth/alembic/versions/20260929_0000_098_credit_decisions_confirm_conditional.py | sort -u

# 3. подпись списка — обязана совпасть с полем sha256
python3 -c "import json,hashlib,sys; d=json.load(open(sys.argv[1])); \
print(hashlib.sha256('\n'.join(sorted(d['permissions'])).encode()).hexdigest() == d['sha256'])" \
  src/constants/__tests__/vendored/credit-confirm-conditional-permission.json
```

## `credit-rail-codes.json` — перечни операций рельса кредитного модуля

| Что | Значение |
|---|---|
| Источник | `CRM/credit-module`, ветка `main` |
| Путь в источнике | `contracts/openapi.yaml` |
| Коммит съёмки | поле `source_commit_sha` в самом файле (мерж 17-6c `f7f263d` — его предок) |
| Схемы | поле `source_schemas`: список снимка → схема контракта |
| Строки прозы | поле `source_lines` — диапазон на `source_commit_sha` для перечня, который контракт даёт только прозой |
| Кто снял / когда | поля `captured_by` / `captured_at` |
| Сколько значений | коды Zūm 44, коды модуля 9, шаблонов семейств 1, статусов Zūm 7, слов модуля 1, шагов Zūm 15 |

Файл читает `../creditRailCodes.test.ts`: каждый перечень `src/features/credit/api/enums.ts`
(`CREDIT_ZUM_FAILURE_CODES`, `CREDIT_MODULE_RAIL_FAILURE_CODES`,
`CREDIT_MODULE_RAIL_FAILURE_PATTERNS`, `CREDIT_ZUM_STATUSES`, `CREDIT_RAIL_MODULE_STATUSES`,
`CREDIT_ZUM_EVENTS`) обязан совпасть со своим списком снимка множеством, а подпись каждого
списка — сойтись. Перечни держат словари `credit.railFailure`, `credit.zumStatus`,
`credit.railModuleStatus`, `credit.zumEvent`: код без строки в словаре доехал бы до оператора
машинным именем. Под `format:check` файл попадает так же, как соседний.

Шаги Zūm контракт перечисляет **только прозой** — в описании
`RailOperationEvent.properties.event` («Известные имена …»). Её равенство перечню модуля
`PROVIDER_EVENTS_KNOWN` держит страж самого модуля
(`service/tests/test_rail_failure_codes_are_catalogued.py`), поэтому снимок прозы не устареет
молча, пока модуль её не меняет. События отказа носят имена кодов Zūm и в `zum_events` не
дублируются.

### Как проверить, что снимок не протух

```bash
# в клоне credit-module; SHA — из поля source_commit_sha
SHA=d643378e9fd88162d9dd36bc06b9d91166e7cd07

# 1. sha256 источника — обязан совпасть с полем source_sha256
git show "$SHA:contracts/openapi.yaml" | sha256sum

# 2. перечни — обязаны совпасть со списками снимка (сортировка — как в снимке)
git show "$SHA:contracts/openapi.yaml" | python3 -c '
import sys, re, yaml
s = yaml.safe_load(sys.stdin)["components"]["schemas"]
print(sorted(s["RailProviderFailureCode"]["x-known-values"]))
print(sorted(s["RailModuleFailureCode"]["x-known-values"]))
print(s["RailModuleFailureCode"]["x-known-patterns"])
print(sorted(s["RailProviderStatus"]["x-known-values"]))
print(sorted(s["RailModuleStatus"]["x-known-values"]))
# шаги: все подстроки в обратных кавычках, ЦЕЛИКОМ подходящие под ^[A-Za-z][A-Za-z0-9]*$;
# ссылки с точкой (RailProviderFailureCode.x-known-values) под шаблон не подходят
prose = s["RailOperationEvent"]["properties"]["event"]["description"]
print(sorted(m for m in re.findall(r"`([^`]*)`", prose) if re.fullmatch(r"[A-Za-z][A-Za-z0-9]*", m)))
'

# 3. подписи списков — обязаны совпасть с полями <список>_sha256
python3 -c "import json,hashlib,sys; d=json.load(open(sys.argv[1])); \
print(all(hashlib.sha256('\n'.join(sorted(d[k])).encode()).hexdigest() == d[k + '_sha256'] \
for k in ['zum_failure_codes','module_failure_codes','module_failure_code_patterns', \
'zum_statuses','module_statuses','zum_events']))" \
  src/constants/__tests__/vendored/credit-rail-codes.json
```

Алгоритм подписи тот же, что у соседнего снимка: `sha256(sorted(list).join('\n'))` — подпись
**списка**, а не байтов файла.

### Когда пересъёмка обязательна

- в контракте модуля появился новый код, статус, слово модуля, семейство или шаг Zūm — до
  пересъёмки экран покажет его нейтрально («Невідомий код: X», «Невідома подія (X)»), без
  расшифровки;
- сменилась проза шагов (`source_lines` указывает на старые строки) — снять заново и строки,
  и список;
- ни один тест этого репозитория **не** открывает контракт модуля: сверка с живым источником —
  ручная работа по командам выше, при каждой пересъёмке обновляются `source_commit_sha`,
  `source_sha256`, `source_lines`, `captured_at`, `captured_by` и подписи списков.

Секретов и данных клиентов в файле нет: это публичные имена кодов и статусов провайдера.

## `credit-postbacks-permissions.json` — права постбеков партнерам (18-13d)

| Что | Значение |
|---|---|
| Источник | `CRM/api-prionex`, ветка `main` |
| Путь в источнике | `services/auth/alembic/versions/20261002_1200_100_credit_export_postback_permissions.py` |
| Коммит съёмки | поле `source_commit_sha` в самом файле (`main` с миграцией 100) |
| Кто снял / когда | поля `captured_by` / `captured_at` |
| Сколько имён | 2 |

Файл читает `../creditW1Permissions.test.ts` третьим снимком — так же, как 098: словарь стража
— объединение трёх снимков, проверки канона, списка, провенанса и самохеша идут на каждом.
Миграция 100 вносит три имени; третье, `credit.applications.export`, этому экрану не нужно и в
снимок не взято — его снимает та единица, что его употребит (счёт снимка — 2, не 3).

### Как проверить, что снимок не протух

```bash
# в клоне api-prionex; SHA — из поля source_commit_sha
SHA=502636730e49a51b6f803dea8e2e27023c2ac40f
F=services/auth/alembic/versions/20261002_1200_100_credit_export_postback_permissions.py

# 1. sha256 источника — обязан совпасть с полем source_sha256
git show "$SHA:$F" | sha256sum

# 2. имена постбеков в миграции — обязаны совпасть с полем permissions
git show "$SHA:$F" | grep -o 'credit\.partner_postbacks\.[a-z_]*' | sort -u

# 3. подпись списка — обязана совпасть с полем sha256
python3 -c "import json,hashlib,sys; d=json.load(open(sys.argv[1])); \
print(hashlib.sha256('\n'.join(sorted(d['permissions'])).encode()).hexdigest() == d['sha256'])" \
  src/constants/__tests__/vendored/credit-postbacks-permissions.json
```

## `credit-postback-contract.json` — перечни постбеков партнерам (18-13d)

| Что | Значение |
|---|---|
| Источник | `CRM/credit-module`, ветка `main` |
| Путь в источнике | `contracts/openapi.yaml` |
| Коммит съёмки | поле `source_commit_sha` в самом файле (`main` модуля, контракт 0.1.46; первая съёмка a1 — 0.1.44) |
| Схемы | поле `source_schemas`: список снимка → схема контракта |
| Строки прозы | поле `source_lines` — «`{amount}` — только у `new_loan`» в описании `createPartnerPostbackRule`; коды `last_error` в описании `listPartnerPostbackDeliveries` (enum в схеме у поля нет) |
| Кто снял / когда | поля `captured_by` / `captured_at` |
| Сколько значений | триггеров 2, триггеров с `{amount}` 1, макросов 5, исходов 5, причин пропуска 3, кодов `last_error` 10 |

Файл читает `../creditPostbackContract.test.ts`: перечни `src/features/credit/api/postbacks.ts`
(все шесть, включая исходы, причины пропуска и коды `last_error` лога 18-13d-b) обязаны
совпасть со списками снимка множеством, подписи списков — сойтись, а пространства
`postbacks.trigger`, `postbacks.outcome`, `postbacks.skipReason`, `postbacks.lastError` — быть
зарегистрированными в `CREDIT_DYNAMIC_NAMESPACES` (строки словаря на каждый код сторожит
`i18nKeys.test.ts`). Значения в ответе модуля — открытые строки: код вне снимка экран
показывает как есть с пометкой «невідоме значення».

### Как проверить, что снимок не протух

```bash
# в клоне credit-module; SHA — из поля source_commit_sha
SHA=270150e5f6b5fa927a96aeafcef5b5f7180744fa

# 1. sha256 источника — обязан совпасть с полем source_sha256
git show "$SHA:contracts/openapi.yaml" | sha256sum

# 2. перечни — обязаны совпасть со списками снимка (сортировка — как в снимке)
git show "$SHA:contracts/openapi.yaml" | python3 -c '
import sys, yaml
d = yaml.safe_load(sys.stdin)
s = d["components"]["schemas"]
print(sorted(s["PartnerPostbackRule"]["properties"]["trigger"]["enum"]))
print(sorted(s["PartnerPostbackRuleList"]["properties"]["macros"]["items"]["enum"]))
print(sorted(s["PartnerPostbackDelivery"]["properties"]["status"]["enum"]))
print(sorted(v for v in s["PartnerPostbackDelivery"]["properties"]["skip_reason"]["enum"] if v))
'
# триггеры с {amount} и коды last_error — проза, строки source_lines
git show "$SHA:contracts/openapi.yaml" | sed -n 2990,2991p
git show "$SHA:contracts/openapi.yaml" | sed -n 3126,3128p

# 3. подписи списков — обязаны совпасть с полями <список>_sha256
python3 -c "import json,hashlib,sys; d=json.load(open(sys.argv[1])); \
print(all(hashlib.sha256('\n'.join(sorted(d[k])).encode()).hexdigest() == d[k + '_sha256'] \
for k in ['triggers','amount_triggers','macros','outcomes','skip_reasons','last_errors']))" \
  src/constants/__tests__/vendored/credit-postback-contract.json
```

Пересъёмка обязательна, когда модуль добавил триггер, макрос, исход, причину пропуска или код
`last_error`: до неё экран покажет новое значение сырым с пометкой, без подписи.
