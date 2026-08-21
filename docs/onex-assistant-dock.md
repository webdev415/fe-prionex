# OneX ↔ CRM assistant dock — integration contract

The assistant page (`/dashboard/ai-assistant`) can render as a compact sidebar
inside **OneX**, the operators' Electron browser. OneX shows the CRM in the main
pane and the assistant in a ~420px dock beside it.

Implementation: `src/features/onexEmbed/` (contract + React bindings),
`src/pages/AiAssistant/AiAssistantBetaPage.tsx` (dock layout, context chip),
`src/components/layout/DashboardLayout.tsx` (chrome stripping).

## 1. Opening the dock

```
https://<crm-host>/dashboard/ai-assistant?embed=dock
```

`embed=dock` is the only recognised value; the match is exact and
case-sensitive. Without it the page renders exactly as it always has — the dock
mode changes nothing for the normal CRM tab.

The query is **route-gated**: `?embed=dock` on any other CRM route is inert, so
a copied link can never leave an operator on a screen with no navigation.

What dock mode changes:

| | Normal | Dock |
|---|---|---|
| Dashboard rail (`Sidebar`) | shown | not rendered |
| Dashboard header (search, bell, profile) | shown | not rendered |
| `<main>` padding | `pt-[80px]` + gutters | none — the chat is full-bleed |
| Chat history panel | fixed left column | drawer, opened from the ⌂ button top-left |
| Layout mode | width-driven | always compact, whatever the host window width |
| Incoming-call popup | shown | suppressed (the main CRM window raises its own) |

Everything else is unchanged: SSE streaming, `fast` / `thinking`, attachments,
voice input and voice messages, TTS, feedback, the reasoning panel.

Recommended host width: **420 px** (`ONEX_DOCK_WIDTH_PX`). The layout is fluid,
so a wider or narrower dock still works.

## 2. Readiness signal — dock → host

Once the page has mounted and its listeners are attached:

```js
window.__onexDockReady === true
```

It is set back to `false` when the page unmounts. Fire events only after this
flag is `true`, or publish through `window.__onexPageContext` (below), which is
read at mount time and needs no handshake.

## 3. Page context — host → dock

Whenever the operator moves to another page in the main pane, OneX publishes:

```js
const detail = {
  url:       'https://crm/dashboard/clients/42', // optional
  title:     'Картка Іваненка',                  // optional
  clientId:  42,                                 // optional, number or numeric string
  selection: 'борг 12 000',                      // optional, what the operator selected
  text:      'readable body of the page',        // optional
  ts:        Date.now(),                         // optional
}

window.__onexPageContext = detail                // for a dock that mounts later
window.dispatchEvent(new CustomEvent('onex:page-context', { detail }))
```

Every field is optional, but a payload with **only** `ts` (or no known field at
all) counts as "no context" and clears whatever the dock was showing — publish
`null` deliberately to reset it.

The dock renders a chip above the composer — «Контекст: `title`» (falling back
to the URL, then to `Клієнт #id`) — with a ✕ that drops it.

Normalisation applied on arrival: whitespace collapsed; `title` ≤ 160,
`url` ≤ 400, `selection` ≤ 800, `text` ≤ 1200 characters; `clientId` must be a
positive integer.

### How the context reaches the assistant

`POST /api/v1/ai-assistant/chat` has no field for host-supplied context, and
this integration does not change the backend. The context is therefore rendered
as a short labelled preamble in front of the operator's own text:

```
Контекст сторінки: Картка Іваненка — https://crm/dashboard/clients/42
Клієнт ID: 42
Виділений текст: борг 12 000
Текст сторінки: …

Що йому запропонувати?
```

- The chat bubble shows only what the operator typed — the preamble is
  machine-facing.
- The whole preamble is capped at 2000 characters; the page body is the first
  thing cut, the client id the last.
- The labels are fixed Ukrainian strings (the brain reads them), not i18n keys.
- **The context is consumed by one turn.** After it is sent the chip clears, so
  a conversation is not re-stamped with the same page on every message. Publish
  the context again to re-attach it.
- An audio-only turn (voice message, empty text) is sent without the preamble
  and keeps the chip for the next text message.

## 4. Ask command — host → dock

```js
window.dispatchEvent(
  new CustomEvent('onex:ask', { detail: { text: 'Підсумуй розмову' } })
)

// or a preset instead of your own wording:
window.dispatchEvent(new CustomEvent('onex:ask', { detail: { preset: 'summary' } }))
```

- `text` — the question, sent as typed. Trimmed, capped at 2000 characters.
- `preset` — `'summary'` is the only one this build knows: it asks the assistant
  to summarise the current page context. `text` wins when both are present; an
  unknown preset with no text is ignored.
- The prompt always lands in the composer first. If a turn is already streaming
  it stays there for the operator to send, instead of being dropped or queued.
- The page context, if any, is attached exactly as in §3.

## 5. Quick manual check

```js
// in the dock's devtools console
window.__onexDockReady                                            // → true
window.dispatchEvent(new CustomEvent('onex:page-context', {
  detail: { title: 'Картка Іваненка', clientId: 42, url: location.href },
}))                                                               // → chip appears
window.dispatchEvent(new CustomEvent('onex:ask', { detail: { preset: 'summary' } }))
```
