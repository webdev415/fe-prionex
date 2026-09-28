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

- вышла новая миграция прав в auth-сервисе (082 → 083 и далее) — снимок обязан
  быть пересмотрен, иначе интерфейс продолжит просить или терять имя молча;
- перед заморозкой релиза (условие `F-FE-05`) — подтвердить отсутствие дрейфа
  либо обновить `source_commit_sha`, `source_sha256`, `captured_at`;
- ни один тест этого репозитория **не** открывает миграцию и не пересчитывает
  список: сверка с живым источником — ручная работа владельца, а не CI.

Владелец снимка — куратор программы Wave 1 (`F-FE-05`). Секретов в файле нет и
быть не должно: это публичные имена прав.

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
