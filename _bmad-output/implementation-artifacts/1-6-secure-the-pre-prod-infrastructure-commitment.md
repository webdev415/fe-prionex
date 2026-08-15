---
baseline_commit: 42fb1472
---

# Story 1.6: Secure the PRE-PROD Infrastructure Commitment

Status: done

> 🔴 **REWRITTEN 2026-08-15 by this story's code review — the story was right about what it did and
> wrong about what it achieved.**
>
> **The requirement worked.** It was never formally "sent", and the counterparty read it anyway,
> delivered the `crm-kong-gateway` alias on 2026-08-14, and brought up the entire PRE-PROD contour:
> `crm-preprod-network` with 69 containers, Kong running with the alias, and
> `api.crm.preprod.crm-prionex.online` serving over TLS. **Epic 5 is no longer blocked**, and Story
> 5.1's first two ACs are already satisfied by the other side. There was never an external team with
> a queue — the 2026-08-13 change proposal recorded that the "platform team" is an agent in a
> sibling repository on the same instance, and this story never absorbed it.
>
> 🔴 **And two of the values it asked for do not exist.** `preprod.crm-prionex.online` and
> `api.preprod.crm-prionex.online` are **NXDOMAIN**; the real convention carries an extra `.crm.`
> segment. Port `8081` is taken. Both bake into the bundle at build time under Option C, so the
> build would have passed and the image would have failed in a browser — **the exact failure class
> this story exists to prevent, reproduced one layer up.**
>
> **Why:** the story forbade itself from looking. Task 1.7 ordered a port census *"from the
> artifacts, not by SSH"* and Prohibition 3 banned SSH to s1 — but both findings are **read-only**
> facts, one session away. The budget conflated *do not provision* with *do not look*, and the
> Story 1.13 lesson it cited is about **writes**.
>
> **The lesson this story recorded — *"a document in `docs/` is not a submitted requirement"* — is
> not the lesson.** The real one, which the 13.08 proposal found by accident and nobody generalised:
> **measure the counterparty's conventions before writing the ask.** It was done for the Kong
> container name and caught a collision. It was not done for DNS.
>
> Amendments in `sprint-change-proposal-2026-08-15-preprod-reality.md`. The original closing state
> follows, kept because it is evidence of how the error happened.
>
> ~~**Partial result, honestly recorded — this is the outcome Task 3.3 prescribes.**~~ The requirement document exists and is send-ready; it has **not
> been sent**, so AC1, AC2 and AC4 are NOT satisfied — their trigger clause is *"when the
> requirement is submitted"*, and a document in `docs/` is not a submitted requirement. Two of the
> three questions in Task 3.2 are still unanswered: **which team/person/channel**, and **who
> sends it**.

> **Deliberately not started (2026-08-10, Oleg: "backend api ещё не готово").** The PRE-PROD
> backend API isn't ready yet, so requesting the network/Kong commitment from the platform team
> now would be premature — there's nothing concrete yet to size the ask around (see Open
> Question 7's PRE-PROD backend hostname point below). Status stays `ready-for-dev` on purpose;
> this is a "come back later" deferral, not a blocker to solve. Re-evaluate once the backend API
> timeline is clearer.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a release engineer,
I want a confirmed commitment from the platform team for the PRE-PROD backend environment,
so that Epic 5 is not blocked waiting on another team's queue.

> 🔴 **AMENDED 2026-08-13, after the story's document was written but before it was sent.**
> `sprint-change-proposal-2026-08-13-kong-naming.md` changed what this story asks for. Every task
> below that says "ask them to create `crm-network-preprod` with its own Kong" is superseded:
> `CRM/api-prionex` is **already building** a separate network and Kong for DEV, PRE-PROD and PROD,
> under its own names. **We adopt their network names and ask for one thing only — a network alias
> `crm-kong-gateway` for their Kong inside each stand's network** — because that name is baked into
> our image and cannot be changed per stand. The requirement document has been rewritten
> accordingly; the task text below is left as written, per this project's rule that records are not
> rewritten retroactively.
>
> ✅ Also answered since: the PRE-PROD services **have their own databases** (Oleg, 2026-08-13),
> which closes Task 2.4's question.

## 🚨 Read this before anything else: this story cannot be finished by the dev agent alone

This is the **only story in the plan whose acceptance depends on a person outside this
repository**. AC3 says *"When the platform team responds — Then a committed delivery date is
recorded."* No amount of file editing produces a response from the backend/infrastructure team.

Split the work accordingly:

| Part | Who | Can the dev agent do it? |
|---|---|---|
| Write the requirement document | dev agent | ✅ yes — this is the bulk of the story |
| Register the dependency as a blocker on Epic 5 | dev agent | ✅ yes |
| Amend the plan and the decision record | dev agent | ✅ yes |
| **Actually send the requirement to the other team** | **Oleg** | ❌ no — Task 3 is a hard stop |
| **Supply the team's answer and the committed date** | **Oleg** | ❌ no — Task 4 is a hard stop |

**Three prohibitions, and they are the ones that matter in this story:**

1. **Never invent a delivery date, a contact name, a team name, a ticket ID, or a response.**
   A fabricated commitment is worse than no commitment — Epic 5 would be scheduled against a
   date nobody agreed to. If Oleg has not supplied an answer, record the *absence* explicitly
   and truthfully (Task 4 gives you the exact shape for that).
2. **Never claim the requirement was "submitted" because the file was written.** Story 1.1 was
   cancelled after learning exactly this lesson in another form: *a repository-side change is
   not a deployed change*. Here: **a document in `docs/` is not a submitted requirement.**
   Writing it and sending it are two different events with two different dates.
3. **Do not provision anything.** This story asks for infrastructure; it does not build any.
   No SSH to s1, no `docker network create`, no Kong, no DNS record, no certificate. Those are
   Stories 5.1 and 5.2, and they are gated on the answer this story obtains.

## Acceptance Criteria

> **Read the trigger clauses.** AC1, AC2 and AC4 all fire on *"When the requirement **is
> submitted**"* — not on "when the document is written". Their **content is the agent's work**;
> their **trigger is a human's** (Task 3.4). AC3's trigger is a second human, on another team
> (Task 4). Marked inline below as `[content: agent] [trigger: human]`.

**AC1 — the network isolation requirement is specified, with its consequence stated**
`[content: agent] [trigger: human]`

**Given** PRE-PROD requires isolation from DEV at the network level
**When** the requirement is submitted to the backend/infrastructure team
**Then** it specifies a dedicated Docker network `crm-network-preprod` and its own Kong
gateway instance on s1
**And** it explains that a shared `crm-network` makes `crm-kong-gateway` resolve to the DEV
backend, rendering PRE-PROD validation fictional.

**AC2 — the reachability requirement is specified**
`[content: agent] [trigger: human]`

**Given** PRE-PROD needs to be reachable
**When** the requirement is submitted
**Then** it includes the DNS name `preprod.crm-prionex.online` and its TLS certificate
**And** it includes the published port allocation `8081` on s1.

**AC3 — the commitment is obtained and the dependency is tracked**
`[trigger: the other team — the agent cannot satisfy this alone]`

**Given** the requirement has been submitted
**When** the platform team responds
**Then** a committed delivery date is recorded
**And** the dependency is tracked as an explicit blocker on Epic 5.

**AC4 — the PRE-PROD backend's external address is requested in the same round trip**
`[content: agent] [trigger: human]`

> **Derived, not taken from the epic's AC list.** Justification, because this adds scope:
>
> - **Claim.** The requirement must also obtain the PRE-PROD *backend* hostname, not only the
>   frontend one. The only PRE-PROD name in any artifact is `preprod.crm-prionex.online`,
>   which is the frontend.
> - **Evidence.** Option C ([D1](docs/migration-decisions.md#d1)) bakes `VITE_API_BASE_URL` /
>   `VITE_WS_URL` in at build time (`Dockerfile.prod:19-22`) → `epics.md:268-269` therefore
>   requires `VITE_API_BASE_URL_PREPROD` / `VITE_WS_URL_PREPROD`, owned by Story 1.12
>   ([D6](docs/migration-decisions.md#d6)) → **no artifact says what value they take.** And a
>   frontend name cannot substitute: 3 of 5 socket.io hooks call `io(WS_URL)` with **no**
>   `path` option, so they hit socket.io's default `/socket.io/`, which `nginx.conf` does not
>   proxy — the request lands in the SPA fallback and returns `index.html`
>   (`forgejo-migration.md:70-72`, the reasoning that killed Option B). That is why PROD points
>   WS **straight** at `wss://api.crm-prionex.online`, bypassing the frontend nginx
>   (`CD.yml:51`, `forgejo-migration.md:73`).
> - **Consequence if omitted.** Epic 3 cannot build a PRE-PROD image at all, and obtaining the
>   values later means a second trip through the same team's queue — the exact failure this
>   story exists to prevent. Asking now costs one paragraph.

**Given** the PRE-PROD frontend needs a backend URL baked into its image
**When** the requirement is submitted
**Then** it also requests the externally reachable PRE-PROD Kong hostname and its TLS
certificate, proposing `api.preprod.crm-prionex.online` for consistency with the existing
`api.crm-prionex.online` / `api.dev.crm-prionex.online` pattern
**And** it states that these values become `VITE_API_BASE_URL_PREPROD` and
`VITE_WS_URL_PREPROD` in Story 1.12, and that Epic 3 cannot build a PRE-PROD image without
them.

## Tasks / Subtasks

### Task 1 — Verify every fact the requirement will assert (AC: 1, 2, 4) ✅

The document goes to another team. A wrong line number or a stale port in it costs credibility
and, worse, invites them to build the wrong thing. Verify before writing; do not copy the
citations below on trust — they were checked at `42fb1472` and are believed correct, but the
point of this task is that **you** checked them.

- [ ] 1.1 `docker-compose.server.yml` — confirm `name: fe-prionex` (`:4`),
      `container_name: fe-prionex` (`:9`), `"${FRONTEND_PORT:-8080}:80"` (`:11`), and the
      external network block at `:33-36` (`crm-network`, `external: true`).
- [ ] 1.2 `nginx.conf` — confirm the two `crm-kong-gateway` references at **`:39`** and
      **`:50`**, both `set $kong_upstream http://crm-kong-gateway:8000;`, inside
      `location /api/` (`:37-45`) and `location /ws/` (`:48-56`). Confirm
      `resolver 127.0.0.11 valid=10s ipv6=off;` at `:38` and `:49`, and read the comment at
      `:30-36` — it is load-bearing for the argument (see Task 2.3).
- [ ] 1.3 `Dockerfile.prod:34` — confirm `COPY nginx.conf /etc/nginx/conf.d/default.conf`,
      i.e. **`nginx.conf` is baked into the image**. This is what makes the Kong service name
      non-negotiable rather than a per-stand setting.
- [ ] 1.4 `.env.example:17-20` — copy the Kong route list verbatim (auth `8001`,
      clients `8002`, calls `8005`, `/ws/calls` `8005`). The second Kong is not an empty
      gateway; the requirement must say what it routes to. **Note line 21 is `#   ... etc`** —
      the list is *not* exhaustive, so present it to the infra team as **«как минимум»**, not
      as the complete set.
- [ ] 1.4a `src/lib/api.ts:12-18` — confirm `withCredentials: true` on the axios instance.
      This is what makes the CORS ask in Task 2.6 mandatory rather than nice-to-have.
- [ ] 1.4b `Dockerfile.prod:37` — confirm `EXPOSE 80` and that `nginx.conf` contains **no**
      `ssl` directive. The container serves plain HTTP; something in front of it terminates
      TLS, and this plan never says what. Basis for Task 2.5's fronting-proxy question.
- [ ] 1.5 `.github/workflows/CD.yml:47,51,57,61` — confirm the four real API/WS hostnames
      (`api.crm-prionex.online`, `api.dev.crm-prionex.online`, both `https://` and `wss://`).
      These establish the naming pattern AC4 extends.
- [ ] 1.6 `.github/workflows/CD.yml:185` — confirm
      `docker network create crm-network 2>/dev/null || true`. Worth knowing and worth saying:
      the shared network is created ad hoc by a deploy script today, not by a managed
      provisioning step. `crm-network-preprod` must be created deliberately and owned.
- [ ] 1.7 Port census on s1, from the artifacts (not by SSH): legacy stand `8080`
      ([D4](docs/migration-decisions.md#d4), `README.md:136`), new DEV stand `8082`
      (Story 4.2), PRE-PROD `8081` (this story). **Three frontend stands, not two** — the
      legacy one has no retirement date (sprint-change-proposal-2026-08-07, risk 8). Say so
      in the document: `8081` is a permanent allocation, not a temporary one.
- [ ] 1.8 Note anything that turns out **not** to match; correct the document rather than the
      repository, and record the discrepancy for Task 8.

### Task 2 — Write `docs/preprod-infrastructure-requirement.md` (AC: 1, 2, 4) ✅

- [ ] 2.1 **Path: `docs/preprod-infrastructure-requirement.md`.** Flat under `docs/`, beside
      `forgejo-migration.md` and `migration-decisions.md`. Do **not** create
      `docs/requirements/`, `docs/infra/` or any new tree — `docs/` is flat apart from the
      unrelated skill-owned `docs/superpowers/specs/`, and Story 1.2 already set the
      one-file-flat precedent.
- [ ] 2.2 **Write it in Russian.** It is addressed to a colleague team at this company, and
      `docs/` is Russian end to end. `document_output_language: English` in
      `_bmad/bmm/config.yaml` governs BMAD artifacts under `_bmad-output/` (this story file),
      not the project's own `docs/`. Keep identifiers verbatim in English:
      `crm-network-preprod`, `crm-kong-gateway`, `crm-network`, `FRONTEND_PORT`,
      `preprod.crm-prionex.online`, `VITE_API_BASE_URL_PREPROD`.
- [ ] 2.3 **Lead with the consequence, not the ask.** Open with the argument written out in
      Dev Notes → **"The argument, in one paragraph"**, rendered in Russian. Do not paraphrase
      it loosely — it is the load-bearing content of the whole document, and the reason it
      leads is that the failure mode is *silent*. Close the opening with the consequence in the
      other team's terms: every release validated on that stand would be validated against DEV
      data and DEV service versions, and PROD would ship on that evidence.
- [ ] 2.4 **The ask — network and gateway (AC1).** Be specific enough to be actionable and
      falsifiable:
  - A Docker network named exactly `crm-network-preprod` on **s1**, created and owned by the
    infra team (not auto-created by a deploy script — contrast `CD.yml:185`).
  - A **second Kong instance** attached to that network, routing to the PRE-PROD instances of
    the backend services listed at `.env.example:17-20` — **as a minimum**, since that list
    ends in `... etc`.
  - 🚨 **And ask the question the network ask alone does not settle: are those service
    instances backed by their own datastores, or do they point at the DEV database?** A second
    Kong in front of DEV-backed services reproduces exactly the fictional validation this
    document exists to prevent, only with a correct-looking network diagram. Ask it plainly:
    *«собственные экземпляры сервисов с собственными БД, не общие с DEV; кто и по какому
    триггеру обновляет их версии относительно релиз-кандидата?»*
  - 🚨 **The critical constraint nobody has written down yet:** inside `crm-network-preprod`
    that Kong must be reachable under the name **`crm-kong-gateway`** on port **`8000`** —
    either as its container name or as a network-scoped alias. `nginx.conf` is baked into the
    image at `Dockerfile.prod:34` and the image is byte-identical across stands, so there is
    **no per-stand way** to point the frontend at a differently-named gateway. If they name it
    `crm-kong-gateway-preprod`, PRE-PROD serves the SPA and every `/api/` call 502s. Docker's
    embedded DNS scopes names per network, so the same name living in both networks is not a
    conflict — it is the mechanism that makes this work.
  - The DEV stand stays on `crm-network`, untouched (NFR5). **No container is attached to both
    networks** — a dual-attached container would reintroduce the ambiguity this whole request
    exists to remove.
- [ ] 2.5 **The ask — reachability (AC2).**
  - DNS `preprod.crm-prionex.online` → s1, plus a valid TLS certificate for it.
  - 🚨 **Ask who terminates that TLS and how `:443` reaches `:8081`.** The container serves
    plain HTTP (`Dockerfile.prod:37` `EXPOSE 80`, no `ssl` in `nginx.conf`), published as
    `${FRONTEND_PORT}:80`. `README.md:136` shows `dev.crm-prionex.online` on port `8080`, so a
    fronting reverse proxy on s1 evidently exists — **and nothing in this plan names or owns
    it.** Request confirmation of the vhost that terminates TLS for
    `preprod.crm-prionex.online` and proxies to `s1:8081`, and who owns it. Without this,
    Story 5.2's AC *"it serves over TLS with a valid certificate"* cannot be met by this
    repository's work at all.
  - Published port **`8081`** on s1 reserved for the PRE-PROD frontend. Give the full census
    from Task 1.7 so they can see the allocation is deliberate and permanent.
  - **Ask, do not assert, about the runners.** Two org-level Forgejo runners have names that
    *suggest* they run on s1 — `s1-build-crm` and the newer `s1-deploy-dev-preprod`
    ([D9](docs/migration-decisions.md#d9)) — but
    `sprint-change-proposal-2026-08-07-runners.md:391-394` records their hosts as **unknown and
    deliberately unresolved**. Write it as a question (*«просим подтвердить, что порт 8081 и
    каталог свободны»*), never as a statement of fact about their infrastructure. Asserting
    something false about their own hosts is the fastest way to lose the room.
  - Directory `~/crm-prionex/fe-prionex-preprod/` on s1 (FR26) — ask them to **reserve** it,
    explicitly *«зарезервировать, не создавать»*: this team provisions the stand itself in
    Story 5.2. Consistent with Task 2.7.
  - **Ask whether PRE-PROD should be publicly reachable at all.** It is a release-candidate
    stand about to be exposed on the public internet. One line offering IP allow-listing or
    basic-auth at the fronting proxy costs nothing and prevents a security objection from
    parking the whole request in review.
- [ ] 2.6 **The ask — the backend's external address (AC4).** Request the externally reachable
      PRE-PROD Kong hostname + certificate, proposing `api.preprod.crm-prionex.online` by
      analogy with `api.dev.crm-prionex.online` (`CD.yml:57,61`). Explain **why the in-network
      name is not enough** using the AC4 evidence chain: socket.io hooks without a `path` option
      cannot be proxied through the frontend nginx (`forgejo-migration.md:70-72`), which is why
      PROD points WS straight at `wss://api.crm-prionex.online` (`CD.yml:51`); and Option C
      bakes both URLs into the image at build time, so the values must exist before Epic 3 can
      build anything for PRE-PROD.
- [ ] 2.6a 🚨 **Ask for CORS explicitly — this is the second-round-trip trap AC4 exists to
      close.** `src/lib/api.ts` creates the axios instance with **`withCredentials: true`**. A
      browser on `https://preprod.crm-prionex.online` calling
      `https://api.preprod.crm-prionex.online` therefore requires the PRE-PROD Kong to return
      `Access-Control-Allow-Origin: https://preprod.crm-prionex.online` — **the exact origin; a
      wildcard is illegal with credentials** — plus `Access-Control-Allow-Credentials: true`,
      and the auth cookie's `Domain` / `SameSite` must permit that origin pair. If the infra
      team clones the DEV Kong's CORS config, PRE-PROD will serve the SPA perfectly and every
      authenticated request will fail in the browser. Name the two headers and the cookie
      attributes literally in the document.
- [ ] 2.7 **State what is explicitly NOT being asked for.** A short section; it shortens their
      review and prevents defensive over-scoping:
  - nothing on s2 / PROD;
  - no change to the legacy stand, its port `8080`, or `crm-network`;
  - no new backend *features* — PRE-PROD instances of the existing services;
  - no CI/CD access, no runner, no registry work (this repo's side, Stories 1.7–1.12);
  - the frontend stand itself is provisioned by this team (Story 5.2), not by them.
- [ ] 2.8 **Add the response block — empty, with the fields named.** This is the artifact
      Task 4 fills in and the reason the document is a document rather than a chat message:

  | Поле | Значение |
  |---|---|
  | Кому направлено (команда, контакт) | — |
  | Дата направления | — |
  | Дата ответа | — |
  | **Обещанная дата поставки** | — |
  | Владелец со стороны инфры | — |
  | Подтверждённое имя Kong в сети | — |
  | Подтверждённые DNS-имена и TLS | — |
  | Статус | `не направлено` |

  Allowed `Статус` values, and nothing else: `не направлено` → `направлено, ответа нет` →
  `есть обязательство` / `отказ` / `изменён объём`. Leaving a field as `—` is a correct,
  honest state. Filling it with a guess is not.
- [ ] 2.9 Header block, following the in-repo precedent
      (`docs/superpowers/specs/2026-07-07-*.md`): `**Дата:**`, `**Статус:**`, `**Адресат:**`,
      `**Источник:**` (links to [D4](docs/migration-decisions.md#d4) and
      [forgejo-migration.md §1.2](docs/forgejo-migration.md)), `**Блокирует:**` (Epic 5 —
      Stories 5.1, 5.2, and transitively Epic 6 through the promotion guard
      [D2](docs/migration-decisions.md#d2)).
- [ ] 2.10 **State the sequencing constraint instead of inventing a deadline.** The document
      must convey *when it is needed* without naming a date this side does not own: PRE-PROD
      infra sits on the critical path ([`forgejo-migration.md` §6 «Критический путь»](../../docs/forgejo-migration.md#6-критический-путь)), Epics 1–4 run before Epic 5,
      and CI/DEV work proceeds in parallel — so their lead time, not ours, sets the schedule.
      End on the single question Task 3.1 also carries: **«когда реалистично?»**
- [ ] 2.11 **Link forms inside `docs/`** are relative to `docs/`: use
      `./migration-decisions.md#d11`, not a repo-root path. (The `[D4](docs/...)` form used
      throughout *this* story file is the `_bmad-output/` convention inherited from Story 1.2;
      do not copy it into `docs/`. From `epics.md` or `deferred-work.md` the correct form is
      `../../docs/migration-decisions.md#d11`, as already used at `deferred-work.md:22`.)

### Task 3 — 🛑 HARD STOP: hand the submission to Oleg (AC: 1, 2, 4)

- [ ] 3.1 Produce a **short send-ready summary** (10–15 lines, Russian) that Oleg can paste
      into whatever channel he uses: the one-paragraph consequence, the four concrete asks
      (network + Kong named `crm-kong-gateway`, DNS + TLS, port `8081`, API hostname), a link
      to `docs/preprod-infrastructure-requirement.md`, and one explicit question — **"когда
      реалистично?"**. Put this summary under **`### Debug Log References

**Send-ready summary (Task 3.1).** Paste as-is into whatever channel Oleg chooses. It is deliberately
short — the document carries the detail.

```
Коллеги, нужна инфраструктура под стенд PRE-PROD для фронтенда (fe-prionex).

Суть: фронтенд ходит в бэкенд по имени crm-kong-gateway, и это имя запечено в
образ на сборке — образ побайтово одинаков для всех стендов, указать другой адрес
негде. Значит, если PRE-PROD подключить к общей сети crm-network, он молча уйдёт
в DEV-овский Kong: стенд поднимется, ошибок не будет, и каждый релиз будет
проверен против данных и версий DEV, а в прод поедет на основании этой проверки.

Просим:
1) отдельную сеть crm-network-preprod на s1, за вами, а не создаваемую скриптом
   деплоя;
2) второй Kong в этой сети, доступный внутри неё под именем crm-kong-gateway на
   порту 8000 (имя контейнера или сетевой алиас) — иначе фронтенд не заработает;
3) DNS preprod.crm-prionex.online + TLS, публикуемый порт 8081 на s1
   (постоянный: стендов будет три);
4) внешнее имя PRE-PROD Kong — api.preprod.crm-prionex.online + сертификат.

Отдельный вопрос: за этим Kong будут собственные экземпляры сервисов со своими
БД, или они смотрят в базу DEV? И кто обновляет их версии относительно
релиз-кандидата? Второй Kong перед DEV-данными даёт ту же фиктивную проверку,
только с правильной схемой сети.

Детали и проверенные ссылки на код: docs/preprod-infrastructure-requirement.md

Главный вопрос — когда реалистично? Отказ или сокращение объёма тоже ответ, он
позволит перепланировать заранее.
```

**Answers received from Oleg, 2026-08-13:**

- `api.preprod.crm-prionex.online` — **confirmed** as the name to propose (Task 3.2, question 3).
- Separate `crm-network-preprod` with its own Kong — **confirmed** as the right ask.
- **Slack is not to be used**, neither as the channel for this requirement nor as a thing to
  repair. See the completion notes for what that closes and what it costs.

**Still unanswered (Task 3.2, questions 1 and 2):** which team, which person or channel this goes
to, and whether Oleg sends it himself. **Task 3 remains a hard stop and the requirement is
`не направлено`.**`** in this story
      file's Dev Agent Record — not in `docs/`, and do not invent a new subsection for it.
- [ ] 3.2 **Stop and ask Oleg**, giving him exactly these three questions:
  1. Which team and which person/channel does this go to? (The repo does not say. Migration
     work is tracked file-system-only — `sprint-status.yaml` has `project_key: NOKEY` — while
     Jira `KAN` is used for feature work only. `SLACK_CD_WEBHOOK_URL` is currently a dead
     `example.invalid` stub and its channel is unknown anyway. **There is no route in this
     repository for reaching another team.**)
  2. Does he want to send it himself, or should the message be prepared for him to send?
  3. Is `api.preprod.crm-prionex.online` the right name to propose (AC4), or does the infra
     team own that naming?
- [ ] 3.3 **Do not proceed past this point on assumption.** If Oleg is unavailable, complete
      Tasks 5–8 with the status `не направлено` and say so plainly in the completion notes —
      the story then sits at `review` with an honest partial result rather than a fake
      complete one. **Do not mark AC1/AC2/AC4 satisfied on the strength of the file existing:**
      their trigger clause is *"When the requirement is submitted"*.
- [ ] 3.4 Once Oleg confirms it was sent: fill `Дата направления`, `Кому направлено` and set
      `Статус: направлено, ответа нет`. That single edit is what converts the document from a
      draft into a submitted requirement, and it is the moment AC1, AC2 and AC4 become true.

### Task 4 — 🛑 HARD STOP: record the response, or its absence (AC: 3)

- [ ] 4.1 The committed delivery date comes **only** from Oleg relaying the team's actual
      answer. Ask for it; do not infer one from sprint dates, epic ordering, or plausibility.
- [ ] 4.2 If an answer exists, fill the whole response block from Task 2.8 and set `Статус`
      to `есть обязательство` (or `отказ` / `изменён объём` if that is what came back). Record
      any *deviation* from the ask verbatim — especially a different Kong name, a different
      port, or a shared-network counter-proposal, since each of those silently invalidates a
      downstream story.
- [ ] 4.3 If no answer yet, record the absence in the exact form the project already uses for
      this — [D3](docs/migration-decisions.md#d3) is the model (*«открыто, владельца и срока
      нет»*): `Статус: направлено, ответа нет`, the send date, and a **review-by date** so the
      absence has a next action rather than decaying into silence. Then add a 🔴 item to
      `_bmad-output/implementation-artifacts/deferred-work.md` under a heading for this story,
      stating that Epic 5 cannot start and naming Oleg as the person who must chase it.
- [ ] 4.4 A refusal or a materially reduced scope (e.g. "share `crm-network`, we'll add a Kong
      route") is **not a failure of this story** — it is a finding, and it is exactly the kind
      of thing this story exists to surface early. Record it, then stop: re-planning Epic 5
      around it is `correct-course` work, not yours.

### Task 5 — Record the decision as D11 in `docs/migration-decisions.md` (AC: 3) ✅

- [ ] 5.1 🚨 **Coordinates in this task were corrected by Story 1.7's code review (2026-08-11) and
      are now expressed structurally — do not re-introduce raw line numbers, they rot.** Story 1.7
      landed D10 before this story ran, so D11 is now the *second* entry to append, not the first.
      Append a new entry **`<a id="d11"></a>` / `## D11. Внешняя зависимость: инфраструктура
      PRE-PROD на s1`** **after the D10 entry** — i.e. after the `**Требования:**` line that closes
      D10, before the last `---` in the file, which is the one immediately preceding
      `<a id="changelog"></a>`. (At the time of writing that `---` is line **816** and the changelog
      anchor **818** — but D10 grew three times on 2026-08-11 alone, so **verify by locating
      `<a id="changelog"></a>`, not by trusting these numbers.**)
      **Do not rewrite D4, and do not rewrite D10.** The file's own contract
      (line 9) states records are never edited retroactively — *«Записи не переписываются
      задним числом»*. D4 already says the network is an external dependency; D11 records
      **what was asked, of whom, when, and what was promised**.
- [ ] 5.1a 🚨 **Resolve the update path before writing D11, or you will trap yourself.** D11
      will very likely be written while the answer is still absent. When the answer later
      arrives, D11 is **not** edited — that would violate the contract just cited. The rule:
      **the response block in `docs/preprod-infrastructure-requirement.md` (Task 2.8) is the
      mutable surface; D11 is not.** When the commitment lands, append a changelog row; add a
      *new* D-record only if the commitment differs materially from the ask (different Kong
      name, shared network, reduced scope). Say this explicitly inside D11 itself, so the next
      person does not have to rediscover it.
- [ ] 5.2 Follow the established entry shape: `**Решение.**` / consequences / `**Внешняя
      зависимость.**` / `**Требования:**`. For requirements, cite **FR27** (dedicated
      `crm-network-preprod` with its own Kong), **FR25**, **FR26**, **FR20** — the same set D4
      carries — and note that Story 1.6 covers no FR of its own: it is a de-risking story whose
      output is consumed by FR27 in Epic 5.
- [ ] 5.3 D11 must carry: a link to `docs/preprod-infrastructure-requirement.md` as the
      authoritative artifact, the committed date **or** its explicit absence, and the sentence
      that Epic 5 (Stories 5.1, 5.2) cannot start before it lands. Do **not** duplicate the
      requirement's contents into D11 — link it. Duplicated lists drift apart (Story 1.2's own
      anti-pattern, applied to D7).
- [ ] 5.4 Update the **index table** — header at `migration-decisions.md:12-13`, rows now run
      **14-23** with **D10 at line 23**. 🚨 **The D11 row goes after the D10 row — after line 23,
      not after line 22.** The original instruction said "after line 22", which was written before
      D10 existed and would now insert D11 *above* D10, out of order. Locate the last `| [DN](#dN)`
      row rather than counting. And update the anchor range in the "Как этим пользоваться"
      paragraph at **line 8** — it now reads `#d1` … `#d10` (not `#d9`, as the original text of
      this task claimed) and must become `#d1` … `#d11`. Story 1.3's code review had to fix
      exactly this omission; do not repeat it.
      Match D10's column style: `| [D11](#d11) | <краткое решение> | <статус> | <потребители> |`.
- [ ] 5.5 Append changelog rows. Locate the table by its `## Журнал изменений` heading — at the
      time of writing the heading is line 820, the header row 822 and the existing rows run
      824-834, but verify rather than trusting these. Format is fixed — `| Дата | Story |
      Изменение |`, date as `DD.MM.YYYY`, story as the bare dotted number (`1.6`, never a `KAN-`
      key), one long prose sentence per row, append-only, chronological. **Use the commit date**,
      not a guessed "today"; the existing last rows are `11.08.2026` (Story 1.7 and its code
      review).

### Task 6 — Amend the migration plan (AC: 3) ✅

- [ ] 6.1 `docs/forgejo-migration.md` **Фаза 0, item 2** (line 120) currently reads:
      *«Согласовать с бэкендом/инфрой: сеть и Kong для preprod на s1, DNS-имя
      `preprod.crm-prionex.online`, TLS.»* Items 1, 3, 4 and 5 carry an explicit status marker
      (`✅` or strikethrough); items 2 and 6 do not. Give item 2 the status it **actually**
      reached, plus links to the requirement document and `#d11`. Match the existing idiom
      (`✅ сделано, [migration-decisions.md#dN](...)`); if it is submitted but unanswered, say
      that instead of `✅`.
- [ ] 6.1a **If the status is `не направлено`, leave line 120 unchanged** and record why in
      Completion Notes. A phase-0 item that has not moved must not acquire a marker implying
      it has.
- [ ] 6.2 `§5 Риски` (line 298 — refreshed 2026-08-11; Story 1.7 added 10 lines in Фаза 1, so
      every reference below Фаза 1 in this file shifted by 10) — the row
      *«PRE-PROD без своего Kong = фиктивная валидация | Блокер 1.2, согласовать с инфрой в
      фазе 0»*. Update the mitigation cell with the current state and the two links. Preserve
      the two-column `| Риск | Митигация |` shape; do not reorder or renumber rows.
- [ ] 6.3 `§6 Критический путь` (lines 309-316, refreshed 2026-08-11) already reads
      *«→ preprod-инфра (зависит от бэкенда) → prod»*. If a date now exists, it belongs here as
      the constraint on when Epic 5 can start — this is the section a reader consults to
      schedule.
- [ ] 6.4 **Do not touch** `§1.2` (lines 81-91). It is the source of the argument and D4's
      basis; it stays as written.
- [ ] 6.5 Also update the **Фаза 0 DoD** (line **126**, not 122 — 122 is the struck-through
      item 4) only if item 2's outcome changes it. Otherwise leave it.

### Task 7 — Track the dependency as an explicit blocker on Epic 5 (AC: 3) ✅

⚠️ There is **no blocker field anywhere in the tracking system.** `sprint-status.yaml`'s
`STATUS DEFINITIONS` comment block (lines 8-35) defines status values only — `backlog |
ready-for-dev |
in-progress | review | done | cancelled` for stories, `backlog | in-progress | done` for epics.
"Track as an explicit blocker" therefore has to be *built*, not filled in. Do not invent a new
YAML key; the file is machine-read by the sprint workflows.

- [ ] 7.1 Use the mechanism the project already uses for exactly this: a **YAML comment**
      immediately above the tracked key. Precedent: `sprint-status.yaml:58-59`, where the
      1.13-before-1.12 ordering constraint from a change proposal is recorded as a comment.
      Add a comment above `epic-5:` naming the dependency, the committed date (or its absence),
      and pointing at `#d11`. Keep `epic-5: backlog` and all story statuses unchanged.
- [ ] 7.2 `_bmad-output/planning-artifacts/epics.md` — the Epic 5 body already opens with
      *"This epic depends on the infrastructure commitment secured in Story 1.6."* (line ~1513)
      and the Epic List entry (lines 372-383) calls it *"The only epic with an external
      dependency"*. Extend the body line with the concrete outcome: the artifact link, the
      committed date or its absence, and the Kong-name constraint from Task 2.4 (Story 5.1
      must verify that name resolution **from inside the running container**, which its ACs
      already require).
- [ ] 7.3 Preserve `epics.md` structure exactly — heading levels, story numbering, the
      Given/When/Then AC blocks. This is an annotation, not a rewrite. Do **not** edit
      Story 1.6's own AC text in `epics.md`; the derived AC4 lives in this story file, with its
      justification, and stays there.

### Task 8 — Record the out-of-scope findings (AC: none — hygiene) ✅

- [ ] 8.1 Append a section to `_bmad-output/implementation-artifacts/deferred-work.md`
      (`## Deferred from: story 1-6-secure-the-pre-prod-infrastructure-commitment (<date>)`),
      following the existing bullet style — what is unresolved, who must act, what it gates.
- [ ] 8.2 Record: **`README.md:136` mislabels the DEV stand as "Pre-production"**
      (`72.62.17.132 | 8080 | dev.crm-prionex.online` under an `Environment: Pre-production`
      heading). Once a real PRE-PROD exists this row is actively misleading — someone reading
      it would send a release candidate to DEV. Fixing README is not this story's job; flagging
      it is.
- [ ] 8.3 Record the naming question if Oleg defers it: whether
      `api.preprod.crm-prionex.online` is ours to propose or the infra team's to assign.
- [ ] 8.4 Record any Task 1.8 discrepancy between the artifacts and the working tree.

### Task 9 — Close out (AC: 1–4)

- [ ] 9.1 Trace **each AC clause** to a specific line of a specific file — the same
      verification standard Story 1.2 Task 7 used. There is nothing to run and nothing to
      observe on a server; the AC trace *is* the test.
- [ ] 9.2 Resolve every link and anchor added: `#d11` in `migration-decisions.md`, the
      cross-file links from `forgejo-migration.md` and `epics.md`, and the links out of the
      requirement document. A broken anchor in a document sent to another team is a
      credibility cost, not a typo.
- [ ] 9.3 Re-read the requirement document once as **the infra team would**: does it say what
      to build, on which host, under which exact names, and by when it is needed — without
      requiring them to open any other file? If they must read `epics.md` to act, it has
      failed.
- [ ] 9.4 Fill the Dev Agent Record: File List, Completion Notes, and — non-negotiable — an
      explicit statement of **which ACs are actually satisfied and which are pending a human**.
      If AC3 is unmet because no answer came back, say exactly that.
- [ ] 9.5 **Terminal state — one rule, no ambiguity.** Set this story's own key in
      `sprint-status.yaml` to `review` when you stop, whatever the outcome; only `done` belongs
      to the code-review workflow. Then:
  - **Full outcome** (submitted + committed date recorded): Completion Notes state AC1–AC4 all
    satisfied, with the date and the AC trace.
  - **Partial outcome** (any hard stop at Task 3 or 4 not answered by Oleg): Completion Notes
    open with this sentence, adapted to fact — *"AC1, AC2 and AC4 are drafted but NOT
    satisfied: the requirement was not submitted (Task 3.2 unanswered). AC3 is not satisfied:
    no response exists. The requirement document is complete and ready to send."* Then list
    precisely what a human must do next. **Never round a partial outcome up.**
- [ ] 9.6 Commit. `docs(migration): …` for `docs/` changes, `chore(bmad): …` for
      `_bmad-output/` changes — the established split (see Git intelligence). Do not
      `--no-verify`; if the pre-commit hook fails, see Testing standards.

## Dev Notes

### What this story produces

**One new Markdown file, edits to five existing Markdown/YAML files, and one message sent by a
human.** No code, no workflow, no infrastructure. If the implementation touches anything under
`src/`, `.github/`, `.forgejo/`, `Dockerfile*`, `docker-compose*` or `nginx.conf`, it has gone
out of scope.

The real deliverable is **a date**. Everything else is the apparatus for getting one and for
making sure it is not quietly forgotten. Epic 5 is on the critical path
([`forgejo-migration.md` §6 «Критический путь»](../../docs/forgejo-migration.md#6-критический-путь): *«→ preprod-инфра (зависит от бэкенда) → prod»*), Epic 6's
promotion guard ([D2](docs/migration-decisions.md#d2)) checks for `preprod-<sha>` tags that only
exist if PRE-PROD exists, and this story sits in Epic 1 — five epics early — for exactly one
reason: another team's queue is the longest-latency item in the plan, so the request is made
before anything depends on it.

| Consumer | What it needs from this story |
|---|---|
| Story 5.1 | The network and second Kong actually existing, under the agreed names |
| Story 5.2 | `preprod.crm-prionex.online` + TLS; port `8081` reserved; the stand directory |
| Story 1.12 | Values for `VITE_API_BASE_URL_PREPROD` / `VITE_WS_URL_PREPROD` (AC4) |
| Epic 3 | Cannot build a PRE-PROD image at all until those two values exist (Option C) |
| Epic 6 | `preprod-<sha>` tags, hence PRE-PROD, hence this |

### The argument, in one paragraph — memorize this, it is the whole story

`nginx.conf:39,50` resolves `crm-kong-gateway` by name through Docker's embedded DNS. Docker
scopes DNS names **per network**. On a shared `crm-network`, the PRE-PROD frontend resolves that
name to the **DEV** Kong and validates a release candidate against the DEV backend. It does not
error — `nginx.conf:30-36` documents the lazy-upstream/`resolver` design that deliberately
prevents nginx from crash-looping when the upstream is absent, and re-resolves every 10 s. So
the stand is green, the healthcheck passes, and the validation is worthless. On a separate
`crm-network-preprod` containing a Kong reachable as `crm-kong-gateway`, the same baked-in image
resolves to the PRE-PROD Kong with no config change at all. That per-network scoping is not a
workaround — it is the mechanism that makes one image serve three stands.

### Files being modified

**`docs/preprod-infrastructure-requirement.md`** — **NEW**. Russian. The deliverable, and the
only document in this repository addressed *outward*. There is no precedent for it; the header
idiom from `docs/superpowers/specs/2026-07-07-reasoning-activity-panel-design.md`
(`**Дата:** / **Статус:** / **Репозитории:**`) is the closest thing and is worth following.

**`docs/migration-decisions.md`** — UPDATE, **834 lines** (was 636 when this story was written;
Story 1.7 added D10 and three rounds of code-review corrections), Russian. 🚨 **Coordinates below
were refreshed on 2026-08-11 and this file moved three times that day — re-verify by anchor
before relying on any line number here.** Current state:
- Header: purpose, the never-rewrite contract (line 9), and the **D1–D10** index table at lines
  **12-23** (header 12-13, rows 14-23) with columns `| # | Решение | Статус | Реализуется в |`.
  The "Как этим пользоваться" paragraph at **line 8** names the anchor range **`#d1 … #d10`** —
  **must be extended to `#d11`**.
- D1–D10, each `<a id="dN"></a>` + `## DN. Title`, ending `**Требования:** FRxx, NFRxx`.
  Anchors: D1 27, D2 78, D3 113, D4 165, D5 194, D6 214, D7 249, D8 289, D9 414, **D10 625**.
- **D4** (anchor at 165, heading 167) is this story's basis.
  Its closing line — *«Внешняя зависимость. Сеть и
  второй Kong на s1 предоставляет команда бэкенда/инфры — это блокер на Epic 5, зафиксированный
  в story 1.6»* — is currently the **only** place the entire dependency is recorded. **Preserve
  it verbatim.**
- `<a id="changelog"></a>` at **818**, `## Журнал изменений` at **820**, table header **822**, rows
  **824-834**. Append-only. The last `---` before the changelog anchor is line **816** — that is
  the insertion point for D11, *after* D10 (which starts at 625 and now runs to ~816).

**`docs/forgejo-migration.md`** — UPDATE, Russian. Serves as **both PRD and Architecture** for
this migration. Touch only: Фаза 0 item 2 (line 120), §5 Риски row (line 298), §6 (309-316).
Preserve §1.2 (81-91) in full. (Coordinates refreshed 2026-08-11 by Story 1.7's code review —
1.7 inserted 10 lines into Фаза 1, shifting everything below it; lines 120 and 81-91 sit above
Фаза 1 and were unaffected.)

**`_bmad-output/planning-artifacts/epics.md`** — UPDATE, English. Annotate Epic 5's dependency
line only.

**`_bmad-output/implementation-artifacts/sprint-status.yaml`** — UPDATE, two things and no
more: (1) the comment above `epic-5:` (Task 7.1), and (2) this story's own key
`1-6-secure-the-pre-prod-infrastructure-commitment`, moved `ready-for-dev → in-progress` when
you start and `→ review` when you stop (Task 9.5). **Only `done` belongs to the code-review
workflow.** The `epic-5:` value itself and every other story's status stay untouched.

**`_bmad-output/implementation-artifacts/deferred-work.md`** — UPDATE, append a section.

### Verified repository facts (checked at `42fb1472`)

These are the load-bearing claims. Re-verify per Task 1, then cite with confidence.

```
docker-compose.server.yml:4      name: fe-prionex                      (hardcoded)
docker-compose.server.yml:9      container_name: fe-prionex            (hardcoded)
docker-compose.server.yml:11     "${FRONTEND_PORT:-8080}:80"           (8080 default)
docker-compose.server.yml:33-36  networks: crm-network, external: true, name: crm-network
nginx.conf:30-36                 comment: lazy DNS, no crash-loop when Kong is down
nginx.conf:38,49                 resolver 127.0.0.11 valid=10s ipv6=off;
nginx.conf:39,50                 set $kong_upstream http://crm-kong-gateway:8000;
nginx.conf:37-45 / :48-56        location /api/ ; location /ws/
Dockerfile.prod:19-22            ARG VITE_API_BASE_URL / ARG VITE_WS_URL → ENV → build
Dockerfile.prod:34               COPY nginx.conf /etc/nginx/conf.d/default.conf   ← baked in
Dockerfile.prod:37               EXPOSE 80         (plain HTTP; nginx.conf has no `ssl`)
src/lib/api.ts:12-18             axios.create({ baseURL, withCredentials: true, ... })
.env.example:17-20               Kong routes: auth 8001, clients 8002, calls 8005, /ws/calls
.env.example:21                  "#   ... etc"  ← the route list is NOT exhaustive
CD.yml:47,51                     https://api.crm-prionex.online  /  wss://api.crm-prionex.online
CD.yml:57,61                     https://api.dev.crm-prionex.online / wss://...
CD.yml:185                       docker network create crm-network 2>/dev/null || true
README.md:136                    72.62.17.132 | 8080 | dev.crm-prionex.online — labelled
                                 "Pre-production" (WRONG — this is the legacy DEV stand)
README.md:137                    175.110.122.17 | 8080 | crm-prionex.online     (PROD, s2)
```

**Hosts:** s1 = `72.62.17.132` (DEV + PRE-PROD), s2 = `175.110.122.17` (PROD). **Ports on s1:**
`8080` legacy DEV (untouched, no retirement date), `8082` new DEV (Story 4.2), `8081` PRE-PROD
(this story). **Forgejo:** `git.crm-prionex.com`, org `CRM`, repo `CRM/fe-prionex`, SSH `:2222`.

Note the TLD split: environments are on `crm-prionex.online`, Forgejo is on `crm-prionex.com`.
The TLS ask is on `.online`.

### Anti-patterns for this story

> The three prohibitions in the header block (fabricating a response, treating writing as
> sending, provisioning anything) are the most important ones and are not repeated here.

- **Do not assert anything about the other team's infrastructure as fact.** Specifically: the
  hosts of `s1-build-crm` and `s1-deploy-dev-preprod` are **unverified**
  (`sprint-change-proposal-2026-08-07-runners.md:391-394` records them as deliberately
  unresolved). Ask; do not tell.
- **Do not parameterize `docker-compose.server.yml` or `nginx.conf`.** Story 4.1 owns it. This
  story only *cites* the hardcoded values as evidence.
- **Do not add the `_PREPROD` repository variables.** AC4 obtains their *values*; Story 1.12
  creates the variables.
- **Do not create a Jira issue.** Migration work is file-system tracked
  (`project_key: NOKEY`, `tracking_system: file-system`); the `KAN` project is for feature work
  only, a convention already written down in Stories 1.3 and 1.13. If Oleg wants a ticket, that
  is his call to make, not a default to assume.
- **Do not rewrite D4** or any existing D-record. Append D11 and log it.
- **Do not invent a `blocked_by:` key in `sprint-status.yaml`.** The file is machine-read;
  use a comment (Task 7.1).
- **Do not propose that PRE-PROD share `crm-network` with a routing trick.** It is the one
  thing this story exists to prevent. If the infra team proposes it, record it as a finding
  (Task 4.4) — do not accept it on their behalf.
- **Do not create `docs/adr/`, `docs/requirements/` or `docs/infra/`.** Flat `docs/`.
- **Do not fix `README.md:136`.** Record it (Task 8.2).
- **Do not restate D4's contents inside D11.** Link.

### Previous story intelligence

**Story 1.2 (done) — the closest analogue: a documentation-only story.**
- It created `docs/migration-decisions.md` and established every convention this story follows:
  flat `docs/`, Russian prose with English identifiers, stable `<a id="dN">` anchors, the
  `Решение / Последствия / Требования` entry shape, the append-only changelog.
- Its AC4 is the **precedent for adding a derived AC** with an explicit justification block —
  the pattern AC4 here reuses.
- Its verification model — *"review against the ACs; there is nothing to observe on a server
  and nothing to run"* — applies verbatim, with the important exception that this story **does**
  have something outside the repository: the other team.

**Story 1.3 (done) — two carry-overs.**
- Its code review had to fix an anchor range in the decisions-file header that the
  implementation forgot to extend. Task 5.4 exists because of that. Do not repeat it.
- It established Forgejo Actions capabilities as [D8](docs/migration-decisions.md#d8) — not
  needed here, but it is why D-records now carry evidence tables.

**Story 1.13 (done) — three carry-overs.**
- It landed the inert `.forgejo/workflows/` placeholder on `main`, `staging` and `development`
  ([D9](docs/migration-decisions.md#d9)). Irrelevant to this story's content, but it means
  `main` now has **branch protection** (no force-push, no deletion for non-admins). Ordinary
  pushes still work.
- Its review found that the story **exceeded its own write budget** — three unplanned writes
  against a live instance. This story's write budget is: **files in this repository, and
  nothing else.** No API calls, no instance state, no server.
- `SLACK_CD_WEBHOOK_URL` is currently a dead `example.invalid` stub (deferred-work.md,
  🔴 before Story 1.12). Relevant only in that Slack is not a reliable route for this
  submission — which is why Task 3.2 asks Oleg for the route.

**Story 1.1 (cancelled) — one finding that transfers exactly.** Its ACs failed because a change
committed to `.github/workflows/CD.yml` only takes effect on GitHub — *a repository-side change
is not a deployed change*. The same asymmetry, restated for this story: **a document in `docs/`
is not a submitted requirement.**

Also from 1.1: it recorded that `.husky/pre-commit` did not fire (no `node_modules`,
`core.hooksPath` unset). **That is no longer true** — see Testing standards. It is a good
reminder that previous-story findings about the environment expire.

### Git intelligence

```
42fb1472  chore(bmad): close stories 1.3 and 1.13, sync sprint status     ← baseline, HEAD
1553291f  docs(migration): address code review findings for story 1.13
401fe43b  chore(bmad): record story 1.13 findings and sprint status
cdef5fdd  docs(migration): record D9 - legacy fallback neutralized on all three branches
f155b409  docs(migration): add inert .forgejo/workflows placeholder
6b8e9bcb  docs(migration): address code review findings for story 1.3
4bdce371  chore(bmad): record story 1.3 findings and sprint status
7b7b984c  docs(migration): record the Forgejo Actions capability findings
```

Conventional Commits, lowercase imperative subject, scope required. The established split is
firm: **`docs(migration):`** for anything under `docs/`, **`chore(bmad):`** for anything under
`_bmad-output/`. No `KAN-###` on migration work — Jira IDs are for feature work (a convention
stated in both Story 1.3 and Story 1.13). Recent migration commits land **directly on `main`**;
`fix/cd-close-tag-gate-bypass` is a stale leftover branch. Branching is the dev agent's call,
but match the recent pattern rather than the older one.

### Testing standards

No automated test covers Markdown or YAML in `docs/` or `_bmad-output/`. `npm run lint` is
`eslint . --max-warnings=0` scoped by `eslint.config.js` to `**/*.{ts,tsx}`; `format:check` is
`prettier --check "src/**/*.{ts,tsx,css,json}"` — neither matches `.md` or `.yaml`, neither
reaches `docs/`. There is no `.prettierignore` and no `lint-staged`.

🚨 **The pre-commit hook WILL fire in this clone** — verified at `42fb1472`:
`core.hooksPath` = `.husky/_` and `node_modules` is present. (Story 1.1 recorded the opposite;
that finding is now stale — do not rely on it.) `.husky/pre-commit` runs the full CI-parity
suite — `format:check`, `lint`, `typecheck`, `test:run` — on **every** commit, including a
documentation-only one. Expect several minutes.

**If it fails:** do **not** `--no-verify`, and do **not** start fixing `src/`. A pre-existing
`typecheck` or `test:run` failure is not this story's to repair and repairing it would blow the
scope boundary this story is built around. Record the failure verbatim in Completion Notes and
stop for a human decision.

Verification is therefore Task 9: each AC clause traced to a specific line of a specific file,
plus link and anchor resolution, plus the read-it-as-the-recipient pass (9.3). One extra check
this story has that Story 1.2 did not: **`sprint-status.yaml` must still parse as YAML** after
Task 7.1 — it is machine-read by the sprint workflows, and a comment is only safe if it is
actually a comment.

### Latest technical information

**None required, and this is deliberate.** This story introduces no dependency, library, action
or platform feature. It selects no Kong version, no TLS issuer, no Docker version — those are
the infra team's choices, and prescribing them would be overreach that invites a "no".

The one technical claim the requirement leans on is **Docker's embedded DNS scoping names per
network** (`127.0.0.11`, network-scoped aliases), which is what allows the same
`crm-kong-gateway` name to exist independently in `crm-network` and `crm-network-preprod`. This
is long-stable documented Docker behaviour, not a version-sensitive detail — but it has **not**
been verified on s1, and the requirement should present it as the expected mechanism rather than
as an observed fact about that host. Story 5.1's ACs already require verifying the resolution
*from inside the running container* rather than inferring it from configuration; that is where
the claim gets tested, not here.

### Project Structure Notes

- `docs/` is the project knowledge root (`project_knowledge` in `_bmad/bmm/config.yaml`) and
  holds `forgejo-migration.md`, `migration-decisions.md`, and the unrelated
  `superpowers/specs/`. Flat placement, no new subdirectory.
- `docs/forgejo-migration.md` serves as **both PRD and Architecture**. There is no
  `architecture.md`, no `prd.md` and no UX artifact in `_bmad-output/planning-artifacts/` —
  `epics.md` plus that document are the complete contract. UX is explicitly not applicable
  (`epics.md` § UX Design Requirements).
- BMAD artifacts live under `_bmad-output/` because `{output_folder}` is unresolved in
  `_bmad/bmm/config.yaml`. Project documentation goes in `docs/`; the requirement document
  being produced here is project documentation and goes to `docs/`.
- **Language split:** `docs/` is Russian, `_bmad-output/` is English. This story writes in both
  — the requirement and the decision record in Russian, this story file and the `epics.md`
  annotation in English.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.6] — user story and AC1–AC3 verbatim
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 5] — "The only epic with an external dependency"; "This epic depends on the infrastructure commitment secured in Story 1.6"
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1] — the network/Kong ACs this commitment must satisfy; resolution verified from inside the container
- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.2] — `~/crm-prionex/fe-prionex-preprod/`, `FRONTEND_PORT=8081`, `preprod.crm-prionex.online` + TLS
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1] — compose parameterization incl. the network variable (not this story's work)
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2] — the new DEV stand on `8082`, the port-census neighbour
- [Source: _bmad-output/planning-artifacts/epics.md#Functional Requirements] — FR27 (own network + own Kong), FR25 (parameterized compose, `8081`/`8082`), FR26 (split directories), FR20 (parameterized healthcheck)
- [Source: _bmad-output/planning-artifacts/epics.md#NonFunctional Requirements] — NFR5 (existing DEV/PROD stands untouched)
- [Source: _bmad-output/planning-artifacts/epics.md#Additional Requirements] — `VITE_API_BASE_URL_PREPROD` / `VITE_WS_URL_PREPROD` required as new variables (AC4); ports deliberately not migrated into CI variables
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07.md] — Epics 2–5 unaffected; risk 8, two DEV stands coexist with no planned end (three stands on s1)
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07-runners.md] — sequencing `1.3 → 1.13 → 1.6 … 1.11 → 1.12`; the open item that `s1-build-crm` may run on s1
- [Source: docs/migration-decisions.md#d4] — the decision this story executes; the fictional-validation consequence; "Внешняя зависимость … блокер на Epic 5, зафиксированный в story 1.6"
- [Source: docs/migration-decisions.md#d1] — Option C: build-time bake, image per environment (why AC4 exists)
- [Source: docs/migration-decisions.md#d2] — the promotion guard checks `preprod-<sha>`; Epic 6 transitively depends on PRE-PROD existing
- [Source: docs/migration-decisions.md#d3] — the model for honestly recording an open item with no owner and no date (Task 4.3)
- [Source: docs/migration-decisions.md#d6] — `S1_SSH_HOST` shared by DEV and PRE-PROD; `_PREPROD` variables owned by Story 1.12
- [Source: docs/migration-decisions.md#d9] — branch protection on `main`/`staging`; the newer `s1-deploy-dev-preprod` org runner on s1
- [Source: docs/migration-decisions.md#changelog] — the `| Дата | Story | Изменение |` format and its rules
- [Source: docs/forgejo-migration.md#1.2] — блокер 1.2 in full; "Без второго Kong-стенда на s1 preprod получается фиктивным"
- [Source: docs/forgejo-migration.md#2] — Фаза 0 item 2 (line 120), the item this story closes
- [Source: docs/forgejo-migration.md#5] — the risk row "PRE-PROD без своего Kong = фиктивная валидация" (line 298)
- [Source: docs/forgejo-migration.md#6] — critical path: "→ preprod-инфра (зависит от бэкенда) → prod"
- [Source: docs/forgejo-migration.md#1.1] — lines 70-72: 3 of 5 socket.io hooks call `io(WS_URL)` with no `path`, so WS cannot be proxied through the frontend nginx (the AC4 evidence, and why Option B was rejected)
- [Source: src/lib/api.ts:12-18] — `withCredentials: true`, hence the CORS ask in Task 2.6a
- [Source: Dockerfile.prod:37] — `EXPOSE 80`; the container serves plain HTTP, so TLS is terminated by something this plan never names (Task 2.5)
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-07-runners.md:391-394] — the hosts of `s1-build-crm` / `ci-hub` are **unknown and deliberately unresolved** (Task 2.5, anti-patterns)
- [Source: package.json:9,12 + eslint.config.js:12] — `lint` is `eslint .` over `**/*.{ts,tsx}`; `format:check` covers `src/` only; neither touches `.md`
- [Source: .husky/pre-commit + `git config core.hooksPath`] — the hook fires in this clone and runs the full CI-parity suite
- [Source: nginx.conf:30-56] — the lazy-DNS comment, `resolver 127.0.0.11`, and both `crm-kong-gateway:8000` upstreams
- [Source: Dockerfile.prod:34] — `nginx.conf` baked into the image; no per-stand gateway-name override
- [Source: Dockerfile.prod:19-22] — the build-time `ARG` contract behind AC4
- [Source: docker-compose.server.yml:4,9,11,33-36] — hardcoded names, `8080` default, external `crm-network`
- [Source: .env.example:17-20] — the Kong route inventory the second gateway must replicate; `:21` (`... etc`) shows it is not exhaustive
- [Source: .github/workflows/CD.yml:47,51,57,61] — the real API/WS hostnames and the naming pattern AC4 extends
- [Source: .github/workflows/CD.yml:185] — `crm-network` created ad hoc by the deploy script
- [Source: README.md:136-137] — s1/s2 IPs; the mislabelled "Pre-production" row (Task 8.2)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — the register's format; the dead `SLACK_CD_WEBHOOK_URL`
- [Source: _bmad-output/implementation-artifacts/1-2-record-the-migration-decisions-and-the-option-c-technical-debt.md] — documentation-story conventions, derived-AC precedent, testing standards
- [Source: _bmad-output/implementation-artifacts/sprint-status.yaml:58-59] — the YAML-comment precedent for recording a constraint (Task 7.1)

## Review Findings (code review 2026-08-15)

Two layers — adversarial and acceptance — both with read-only access to s1, which is what made the
difference. This story was the last in Epic 1 never to have been reviewed, and it had been sitting in
`review` since 2026-08-13 while eleven stories closed past it.

**The headline is not a defect in the story. It is that the world moved and four artifacts did not.**

- [x] [Review][Patch] ✅ **Epic 5 is not blocked.** The contour is running — 69 containers,
      `crm-preprod-network`, Kong with the `crm-kong-gateway` alias delivered 2026-08-14, and
      `api.crm.preprod.crm-prionex.online` on TLS. `epics.md`, `sprint-status.yaml`,
      `forgejo-migration.md` and this file all said we were waiting. Corrected in all of them.
- [x] [Review][Patch] 🔴 **`preprod.crm-prionex.online` and `api.preprod.crm-prionex.online` are
      NXDOMAIN.** The real names carry an extra `.crm.` segment and appeared in **zero files** in
      this repository. Verified by `dig`, not inferred. FR25, AC2, AC4 and Story 5.2 amended.
- [x] [Review][Patch] 🔴 **Port `8081` — FR25's "permanent allocation" — is taken.** `docker-proxy`
      binds `127.0.0.1:8081`. Moved to `8083`, measured free.
- [x] [Review][Patch] **The story forbade itself the checks that would have caught both.** Task 1.7
      ordered the port census *"from the artifacts, not by SSH"*; Prohibition 3 banned SSH. Both
      facts are read-only. *Do not provision* was applied as *do not look.*
- [x] [Review][Patch] **The requirement document claims both states at once** — header `Статус: не
      направлено`, and twenty lines below a filled response block dated 14.08 with delivered work.
      Also two `Статус` fields with different values, one outside the enum Task 2.8 defined.
- [x] [Review][Patch] **The Completion Notes contradict themselves on Tasks 5–8** — "completed" in
      one paragraph, "not done and not startable here" twenty-five lines later. They were done.
- [x] [Review][Patch] **`Status: review` on line 7 against "status stays `ready-for-dev`" on line 24.**
- [x] [Review][Patch] **55 unchecked boxes under six ✅ headings** — the same anti-pattern Story 3.1's
      review named, masking at least six genuinely dropped Task 2 subtasks.
- [x] [Review][Patch] **AC4's second clause was never written.** It requires the document to state
      that these values become `VITE_API_BASE_URL_PREPROD` / `VITE_WS_URL_PREPROD` in Story 1.12 and
      that Epic 3 cannot build a PRE-PROD image without them. `grep` for `VITE`, `1.12`, `Epic 3` in
      the requirement returns nothing. The Completion Notes claim all four asks are carried.
- [x] [Review][Patch] **The "unsent means unsatisfied" rule was applied selectively** — withheld from
      AC1/AC2/AC4, granted to AC3's second clause, which shares the same trigger.
- [x] [Review][Defer] ⚠️ **CORS on the PRE-PROD Kong allows `http://localhost:8320`.** Configured,
      with the wrong origin — worse than unconfigured, because it looks done and fails only in a
      browser. **Owner: Story 5.2**, once the frontend name serves.
- [x] [Review][Defer] ⚠️ **The frontend name `crm.preprod.crm-prionex.online` has no vhost and no
      certificate.** It resolves; s1 carries vhosts only for the two API names. This is the one piece
      of PRE-PROD infrastructure that genuinely does not exist, and it is **ours**. **Owner: Story 5.2.**
- [x] [Review][Defer] ⚠️ **s1's addressing is not what the record says.** `migration-decisions.md`
      asserts `72.62.17.132` and `10.67.0.1` are the same machine; the host presents `185.185.49.127`
      on `eno1`, while `dev.crm-prionex.online` resolves to `72.62.17.132`. Docker networks are
      host-local, so if a stand is provisioned on the wrong one it cannot join `crm-preprod-network`
      at all. **Owner: Story 5.2, before it provisions anything.**
- [x] [Review][Defer] ⚠️ **The security question was decided the other way and only the neighbours
      recorded it.** Their nginx config carries Oleg's 2026-08-14 decision that PRE-PROD is open to
      anyone who knows the name, with app auth as the only protection. This repo does not know.
      **Owner: Oleg** — it belongs in a decision record, not in someone else's comment.
- [x] [Review][Defer] ⚠️ **The document would leak internal commentary if it were ever sent.** §6
      contains our assessment of the counterparty's CI and a note about strengthening D2.
      **Owner: whoever sends it — if anyone ever does.**

**Disposition.** `review` was wrong, and `cancelled` would have been wronger: the story was
implemented, its output reached the counterparty, and the counterparty acted on it — the most
consequential thing it did. Closed as **`done` with AC2 and AC4 recorded as amended**, because
closing them as originally written would have ratified two names that do not exist.

---

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

**Task 1 — every citation re-verified at `f7c83434`, and all of them held.** `name: fe-prionex`
(`docker-compose.server.yml:4`), `container_name` (`:9`), `"${FRONTEND_PORT:-8080}:80"` (`:11`),
the external `crm-network` block (`:13,34-36`); both `set $kong_upstream http://crm-kong-gateway:8000;`
lines (`nginx.conf:39,50`) with their resolvers (`:38,49`); `COPY nginx.conf` (`Dockerfile.prod:34`)
and `EXPOSE 80` (`:37`) with **no `ssl` directive anywhere in `nginx.conf`**; the four Kong routes
ending in `... etc` (`.env.example:17-20,21`); `withCredentials: true` (`src/lib/api.ts:18`); the
four hostnames (`CD.yml:47,51,57,61`) and the ad-hoc `docker network create` (`:185`).
**No discrepancies** — nothing to correct for Task 8.

**Task 2 — `docs/preprod-infrastructure-requirement.md` written**, in Russian, flat under `docs/`,
leading with the consequence rather than the ask. It carries all four asks, the naming constraint
that is the story's real content, the datastore question, the CORS requirement that follows from
`withCredentials`, the TLS-termination question that follows from the container serving plain HTTP,
and a facts table citing every line it relies on.

**Confirmed by Oleg 2026-08-13:** `api.preprod.crm-prionex.online` is the name to propose, and the
separate `crm-network-preprod` with its own Kong is the right ask.

**Decision recorded — Slack is out of scope, and here is what that costs.** Oleg's instruction was
*«slack не трогаем»*, both as a route for this requirement and as a thing to repair. Two
consequences, stated once so they are not rediscovered:

1. **This requirement needs a channel that is not Slack.** Task 3.2's first question therefore
   stands open and is now the single thing blocking the story.
2. **`SLACK_CD_WEBHOOK_URL` stays a dead `example.invalid` stub permanently.** It stops being an
   open blocker and becomes an accepted state. Story 1.12's AC1 closes as «не проверено» for that
   secret, finally rather than pending, and **Story 4.5 (deploy notifications) will report success
   and send nothing** unless it is rescoped. That is a plan-level consequence and belongs in
   `correct-course`, not in either story's completion notes alone.


**Tasks 5–8 completed under Task 3.3's instruction**, which says plainly: if the submission cannot
happen, finish 5–8 with the status «не направлено» and let the story sit at `review` with an honest
partial result rather than a fake complete one.

- **D11 written** in `docs/migration-decisions.md`, placed between D10 and D12 in numeric order,
  index row added, and the header's anchor range corrected — it still claimed `D11` was «зарезервирован
  Story 1.6, которая ещё не написана», which stopped being true today. D11 records what was asked,
  of whom, when, and that **no commitment exists and none can while the requirement is unsent.** It
  also states its own update rule, so the next person does not edit it: the mutable surface is the
  response block in the requirement document, not the decision record.
- **Plan amended.** The `§5 Риски` mitigation cell now carries the real state and both links; `§6
  Критический путь` is annotated to say the segment is blocked **by decision rather than by a
  queue**. **Фаза 0 item 2 was deliberately left unmarked** (Task 6.1a): an item that has not moved
  must not acquire a marker implying it has.
- **Epic 5 tracked as blocked** in both places that a reader looks: a comment above `epic-5:` in
  `sprint-status.yaml` (the same mechanism the 1.13-before-1.12 constraint uses, since the schema
  has no blocker field), and a block in the Epic 5 body in `epics.md` carrying the artifact link,
  the absence of a date, and the `crm-kong-gateway` naming constraint that Story 5.1 must verify
  from inside a running container.
- **Findings recorded**, including `README.md:136` — verified: it does label the DEV stand
  `Pre-production`.

**AC status, traced rather than asserted.** AC1, AC2 and AC4 all trigger on *«when the requirement
is submitted»*; it is not submitted, so all three are **unsatisfied by definition**, not by
oversight. AC3 triggers on *«when the platform team responds»*; there is nobody to respond to an
unsent document. **The story cannot close, and the reason is a decision rather than a gap in the
work.**

**Not done and not startable here:** Tasks 3 and 4 are hard stops. Tasks 5–8 (D11, plan amendment,
Epic 5 blocker registration, out-of-scope findings) are deliberately left until the send status is
known — recording a decision record for a requirement that has not been sent would date-stamp a
commitment that does not exist.

### File List

### Change Log

## Open Questions for Review

Saved for the end, per the workflow. None of these blocks starting the story.

1. **Who is "the platform team", concretely?** The epic's AC3 says *"platform team"* while the
   story goal and `epics.md:379-380` say *"backend/infrastructure team"*. No team name, person
   or channel appears anywhere in this repository. Task 3.2 asks Oleg; if he does not know
   either, that is itself the finding — the dependency has no counterparty.
2. **Is there any route to that team from this repository?** There is none today: migration work
   is file-system tracked (`project_key: NOKEY`), Jira `KAN` is feature-work-only by written
   convention, and the one Slack webhook is a dead `example.invalid` stub whose channel is
   unrecorded. Should the route itself be recorded somewhere durable once used?
3. **Does `api.preprod.crm-prionex.online` (AC4) belong to us to propose?** The pattern is
   consistent with `api.dev.crm-prionex.online`, but naming may be the infra team's to assign.
4. **What happens to the requirement if the answer is "share `crm-network`"?** Task 4.4 says
   record it and stop. Confirm that re-planning Epic 5 around a refusal is `correct-course`
   work rather than an extension of this story.
5. **Should the committed date get a review-by date and an owner in `sprint-status.yaml`, or is
   a comment enough?** A comment is invisible to every sprint-status summary the project runs.
   The tracking system has no field for a dated external dependency, and this is the first
   story that needs one — it will not be the last.
6. **`README.md:136` labels the DEV stand "Pre-production".** Deferred (Task 8.2), but once a
   real PRE-PROD exists this is a row that could send a release candidate to the wrong host.
   Worth a follow-up story rather than a deferred-work bullet?
7. **The ask grew by four items beyond the epic's literal ACs** — CORS with credentials
   (Task 2.6a), TLS termination / the fronting proxy on s1 (2.5), backend **data** isolation
   (2.4), and access control for a publicly exposed release-candidate stand (2.5). Each is
   cheap to add now and expensive to discover later, and each is a thing the same team owns.
   Confirm this is the right trade — the alternative reading is that the story should ask only
   what `epics.md` lists and let Epic 5 find the rest.
8. **Nobody in this plan owns the reverse proxy that terminates TLS on s1.** `README.md:136`
   implies one exists; no story provisions or configures it. If the infra team says it is
   ours, that is unplanned work landing in Epic 5 with no story to hold it.
