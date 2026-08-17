# turbo-modal-dialog

Present any URL as a modal by declaring it in your Path Configuration. The URL stays a first-class permalink — browser back/forward, sharing, refresh, and deep linking all work — and the same configuration drives [Hotwire Native](https://native.hotwired.dev) iOS / Android apps, so a single JSON declaration gives matched modal UX across web and native.

Matching navigations open in a `<dialog>` containing an `<iframe>` for the URL's normal Rails view, instead of replacing the page. The modal is just a presentation choice for an ordinary URL — your controller serves the same HTML whether the URL is reached via in-app navigation, direct access, refresh, or a crawler.

## Features

- **Path Configuration–driven**: declare modal URLs in JSON; same format as Hotwire Native iOS/Android apps
- **`<dialog>` + `<iframe>`**: native browser modal with an in-modal back button for multi-page flows, like a native WebView modal stack
- **Browser back/forward works**: closes and re-opens the modal, X.com-style
- **Direct URL access**: deep links to modal URLs open as modals, with a configurable fallback for the underlying page
- **Form submissions**: redirects out of the modal dismiss it; validation errors stay
- **Animation**: slide-up entry / slide-down exit via the View Transitions API; configurable per rule
- **Modal styles**: large, medium, full, page_sheet, form_sheet (matches iOS modal_style)
- **Hotwire Native interop**: automatically disabled inside Hotwire Native apps (the native side handles modal presentation)

## Install

This library requires [`@hotwired/turbo`](https://github.com/hotwired/turbo) 8.x to be present at runtime — install it (or have it pinned) in your application alongside the steps below.

### Rails with cssbundling-rails / jsbundling-rails (esbuild, vite, webpack, …)

```sh
npm install turbo-modal-dialog
```

```js
// app/javascript/application.js
import "turbo-modal-dialog"
```

```css
/* app/assets/stylesheets/application.css (or your bundled CSS entry) */
@import "turbo-modal-dialog/style.css";
```

### Rails with importmap-rails + propshaft (no JS bundler)

Pin the JS module and vendor the stylesheet:

```sh
bin/importmap pin turbo-modal-dialog
curl -L https://cdn.jsdelivr.net/npm/turbo-modal-dialog/dist/style.css \
  -o vendor/assets/stylesheets/turbo-modal-dialog.css
```

Then link it from your layout:

```erb
<%= stylesheet_link_tag "turbo-modal-dialog" %>
```

### Plain HTML (no build tooling)

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/turbo-modal-dialog/+esm"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/turbo-modal-dialog/dist/style.css">
```

> Pin to a specific major/minor in production, e.g. `npm/turbo-modal-dialog@0.2/dist/style.css`.

## Usage

Place the custom element in your layout, with configuration:

```html
<turbo-modal-dialog
  modal-fallback="/"
  path-configuration="/configurations/web_v1"
  content-stylesheet="/assets/native.css">
  <script type="application/json">
    {
      "rules": [
        {
          "patterns": ["/new$", "/edit$", "/modal"],
          "properties": { "context": "modal" }
        }
      ]
    }
  </script>
</turbo-modal-dialog>
```

### Attributes (all optional)

| Attribute | Description | Default |
|---|---|---|
| `modal-fallback` | URL to navigate to when closing a modal that was opened directly (deep link / refresh) | `"/"` |
| `path-configuration` | URL of remote Path Configuration JSON; loaded on init to override the inline rules | – |
| `content-stylesheet` | URL of CSS injected into the modal's iframe (e.g., your app's `native.css` to hide nav inside the modal) | – |

### Children

`<script type="application/json">` — inline (local) Path Configuration. Used immediately on first load. If `path-configuration` URL is also set, the remote version overrides this once fetched.

### Hiding chrome from the modal view

The modal iframe loads the full HTML the controller returns. Elements that shouldn't appear inside the modal — global navigation, page headers, footer chrome — should be tagged with `hide@native` so the modal stylesheet can hide them:

```erb
<header class="hide@native">...</header>
```

The library defaults to the convention used in the official [Hotwire Native Rails demo](https://github.com/hotwired/hotwire-native-demo): tag elements with `hide@native`, and a stylesheet maps that class to `display: none` in the modal context. A baseline `.hide\@native { display: none !important }` is injected into every modal iframe so the convention works out of the box. If your app already follows the demo's pattern, point `content-stylesheet` at your existing `native.css` to inherit any additional rules. If you prefer a different class or mechanism, supply a stylesheet that declares whatever hiding rules you want — `hide@native` itself is not mandated by the Hotwire Native framework, only popularized by the demo.

If your layout treats "everything that isn't `<main>` is chrome," a single rule via `content-stylesheet` is enough and per-element tagging isn't needed:

```css
/* served at the URL pointed to by content-stylesheet */
body > *:not(main) {
  display: none !important;
}
```

## Path Configuration

Reuses [Hotwire Native's Path Configuration](https://native.hotwired.dev/reference/path-configuration) format. Modal-related rule properties:

| Property | Values | Effect |
|---|---|---|
| `context` | `"modal"` | Marks the URL as a modal |
| `modal_style` | `"large"`, `"medium"`, `"full"`, `"page_sheet"`, `"form_sheet"` | Sizing variant (matches iOS) |
| `animated` | `true` (default), `false` | Slide animation on open/close |
| `modal_dismiss_gesture_enabled` | `true` (default), `false` | ESC key and backdrop click dismiss |

Example:

```json
{
  "rules": [
    {
      "patterns": ["/modal"],
      "properties": { "context": "modal", "modal_style": "large" }
    },
    {
      "patterns": ["/new$", "/edit$"],
      "properties": { "context": "modal", "modal_style": "form_sheet" }
    }
  ]
}
```

## Choosing a presentation

A URL listed in your Path Configuration is **a first-class permalink
and a modal at the same time**. Direct access — search hit, shared
link, refresh — opens it as a modal over a fallback page; in-app link
clicks open it as a modal over whatever screen the user was already
on. Crawlers, OGP scrapers, and sitemaps see the URL like any other
page, because your controller serves it as a plain HTML response
either way. The same URL works as both: the path-configuration only
decides how it's *presented*.

That removes one historical reason to *avoid* modals (loss of URL
state). The remaining reasons still apply: **a modal is a mode**, and
modes carry a real cognitive cost. The user has to track that they're
"in" a modal, can't freely reference other parts of the app, and
can't compare multiple items side-by-side. Treat "full page" as the
default, and reach for "modal" only when you have an active reason
— see the use cases below for typical ones, and *What doesn't fit*
for the patterns to avoid.

That leaves two design questions:

**Modal vs full page** — choose a modal when the screen makes sense as
an extension of what the user is already on: peeking at one item from
a list they'll keep browsing, completing a focused side-task without
leaving the underlying workflow. Choose a full page when the URL is
the experience itself — long-form content, hierarchical starting
points, landing pages, or anything users want to keep visible while
working in another part of the app.

**Sheet vs full-screen** — within modal cases, sheet styles (`large`,
`form_sheet`, `medium`, `page_sheet`) keep some of the underlying
context visible and invite easy dismissal, fitting brief and
interruptible work. `full` claims the whole viewport, fitting
immersive content (visual media) and multistep precision tasks
(markup, editing). This mirrors [Apple HIG's Sheet vs Full-screen
distinction](https://developer.apple.com/design/human-interface-guidelines/modality).

## Typical use cases

### Forms (new / edit)

```json
{
  "patterns": ["/new$", "/edit$"],
  "properties": { "context": "modal", "modal_style": "form_sheet" }
}
```

`form_sheet` is narrower on desktop (matching iOS form-sheet) and near
full-screen on mobile — well-suited to short input forms.

### First-party authentication (email / password, MFA, password reset)

```json
{
  "patterns": ["/sign_in", "/sessions/new", "/password/.+", "/two_factor/.+"],
  "properties": { "context": "modal", "modal_style": "form_sheet" }
}
```

Sign-in, password reset, and MFA enrollment are short form interactions
served from your own origin, so `form_sheet` is the same fit as any
other short form. (OAuth flows to third-party IdPs cannot run inside a
modal — see *Doesn't fit* below.)

### Passkey (WebAuthn) registration and authentication

```json
{
  "patterns": ["/passkeys/new", "/sessions/passkey"],
  "properties": { "context": "modal", "modal_style": "form_sheet" }
}
```

`navigator.credentials.get()` and `.create()` work inside same-origin
iframes via the default Permissions Policy — no `allow` attribute is
needed. The browser's biometric / security-key prompt renders above
the modal as a system-level dialog.

### Payments (Stripe Elements, Embedded Checkout, 3-D Secure)

```json
{
  "patterns": ["/checkout", "/payments/new"],
  "properties": {
    "context": "modal",
    "modal_style": "large",
    "modal_dismiss_gesture_enabled": false
  }
}
```

`large` is roomy enough for a 3-D Secure challenge iframe (EMVCo's
challenge sizes start at 250×400 px). `modal_dismiss_gesture_enabled:
false` prevents accidental ESC / backdrop dismissal mid-payment. Pair
with Stripe Elements or Embedded Checkout, both designed for iframe
embedding.

### Item detail browsed from a list (text-heavy)

```json
{
  "patterns": ["/products/\\d+$"],
  "properties": { "context": "modal", "modal_style": "large" }
}
```

`large` fits product / item detail comfortably (specs, reviews,
descriptions) while keeping part of the underlying list visible —
reinforcing "close and browse the next one". Use this only when
users typically view one item at a time; in domains where users
compare items side-by-side (hardware specs, real estate, …), prefer
a full page so multiple items can be opened in parallel tabs.

### Visual media — photos, videos, hero images

```json
{
  "patterns": ["/photos/\\d+$", "/videos/\\d+$"],
  "properties": { "context": "modal", "modal_style": "full" }
}
```

`full` because the content itself wants the whole viewport — matches
the HIG "presenting videos, photos, or camera views" case and iOS
Photos.app's full-screen presentation.

### Markup / editing flows

```json
{
  "patterns": ["/attachments/\\d+/markup", "/documents/\\d+/sign"],
  "properties": {
    "context": "modal",
    "modal_style": "full",
    "modal_dismiss_gesture_enabled": false
  }
}
```

`full` so precision pinch / drag interactions get the entire screen.
`modal_dismiss_gesture_enabled: false` so an accidental backdrop tap
or ESC doesn't drop the user out of a half-finished edit. Matches the
HIG "multistep task like marking up a document or editing a photo"
case.

## What doesn't fit the modal pattern

### Can't (technical limits)

| Flow | Why not |
|---|---|
| OAuth / OIDC redirects to third-party IdPs (Google, Apple, GitHub, …) | Provider sends `X-Frame-Options: DENY` / `frame-ancestors 'none'` to block clickjacking. There is no way around this — use a top-level redirect or a popup window with `postMessage` instead. |
| Stripe legacy hosted Checkout, Payment Links | Same reason — full-page hosted UIs that refuse iframe embedding. Use Stripe Elements or Embedded Checkout instead. |

### Shouldn't (design anti-patterns)

These are *possible* but degrade UX. The underlying issue is that
modals are a mode, and modes are costly when imposed on users who
didn't ask for one or who need parallel access to the page underneath.

| Flow | Why not |
|---|---|
| Auth-wall — forcing sign-in *during* another task | A modal not initiated by the user is the textbook "don't mode me in" violation. Redirect to a sign-in page, then back to the original URL, instead. |
| Reference / help / documentation pages | Users often want to keep these visible while working in another part of the app. Modal turns reference into interruption. |
| Search results, index, or comparison views | Users may want to open several items in parallel tabs. Modal forces sequential viewing. |
| Quick edits of a single field (rename, status toggle) | Inline edit is more modeless. Reserve modals for substantial forms with a clear "complete or cancel" boundary. |
| Long-form content (articles, terms of service users actually read) | Reading takes time, and modes have ongoing cognitive cost. Use a full page. |

## How it works

When a Turbo Drive navigation matches a modal rule:

1. The visit is intercepted (`turbo:before-visit`) and a `<dialog>` containing an `<iframe>` is created.
2. The iframe loads the URL as a normal page (with its own Turbo, scripts, and styles).
3. The parent's URL is updated via `history.pushState` so the modal URL is shareable and browser forward can re-present the modal.
4. Closing the dialog navigates the parent via `Turbo.visit(target, { action: "replace" })` so the modal entry is collapsed out of the navigation stack — dismissing leaves no trace, mirroring iOS modal semantics.

A link inside the modal whose URL is non-modal dismisses the modal and navigates the parent there (matching the native "dismiss the modal stack and push on the main stack" behavior).

### Navigation model inside a modal

The library splits responsibilities between the browser back/forward buttons and an in-modal back button:

| User action | Result |
|---|---|
| Browser back / forward (anywhere) | Dismisses or re-presents the modal |
| Link to another modal URL inside the modal | Navigates within the modal; the in-modal back button appears |
| In-modal back button (`‹` in modal header) | Pops the modal navigation stack one step |
| Close button (`✕`), ESC, backdrop click | Dismisses the modal |

**Why this split?** The iframe's session history is intentionally kept at length 1 — every intra-modal navigation goes through `Turbo.visit(url, { action: "replace" })` inside the iframe so no joint-session-history entries are added. As a consequence:

- Browser forward never lands on a stale destroyed-iframe entry (the forward button correctly disables when there is no real forward state).
- Browser back has a single, predictable meaning regardless of where in the modal you are: "leave the modal".
- An in-modal back button (rendered automatically when the modal stack has depth > 1) is the way to step back through multi-page modal flows.

The address bar still tracks the current modal page (via `history.replaceState` from the in-modal navigation), so refresh, bookmark, and share links continue to deep-link to the displayed modal page.

## Events

All events are dispatched on `document` and bubble. The `turbo:before-*` events are cancelable — `event.preventDefault()` stops the transition and, when a navigation caused it, drops that navigation.

| Event | Cancelable | `detail` | Fires when |
|---|---|---|---|
| `turbo:before-iframe-present` | ✓ | `{ url, properties }` | A modal is about to be presented |
| `turbo:iframe-presented` | | `{ url, properties, bindFrame }` | A modal was presented (`bindFrame` is internal host wiring) |
| `turbo:before-iframe-navigate` | ✓ | `{ url, trigger }` | The modal is about to navigate to another modal URL |
| `turbo:iframe-navigate` | | `{ url, canGoBack }` | The modal navigated; `canGoBack` drives the in-modal back button |
| `turbo:iframe-content-loaded` | | `{ url, title }` | The iframe (re)loaded its content |
| `turbo:iframe-refresh-deferred` | | `{ url }` | A refresh for the hidden underlying page was deferred (see below); informational |
| `turbo:before-iframe-dismiss` | ✓ | `{ targetUrl, trigger }` | The modal is about to be dismissed; `targetUrl` is where the parent will navigate (`null` for browser back) |
| `turbo:iframe-dismissed` | | `{ targetUrl }` | The modal was dismissed |

The `trigger` value identifies what caused the transition, split along one axis: an **explicit request** (the user or your code asked for it) versus an **intercepted parent visit** (a JS-driven `Turbo.visit` in the parent that the library rerouted — see the next section).

| Event | `trigger` | Source |
|---|---|---|
| `before-iframe-navigate` | `"navigate"` | Explicit: an intra-modal link click or a `navigateModal()` call |
| | `"parent-visit"` | Intercepted: a parent visit to another modal URL |
| `before-iframe-dismiss` | `"dismiss"` | ✕ button, ESC, backdrop click, or a programmatic `dismiss()` |
| | `"popstate"` | Browser back |
| | `"visit"` | Explicit: a non-modal link inside the modal, or a `dismissAndVisit()` call |
| | `"parent-visit"` | Intercepted: a parent visit to a non-modal URL |

## While a modal is open: background updates and parent visits

The underlying page stays alive under the dialog — hidden and inert, but fully present in the DOM. Two kinds of background activity can reach it while the modal is open.

**Turbo Streams.** Targeted stream actions (`append`, `replace`, `remove`, …) mutate the DOM directly and keep updating the hidden page throughout. The `refresh` action is different: it is bound to `document.baseURI`, which is the modal URL while presented, so it cannot fetch the underlying page's HTML at that moment. The library defers it — the broadcast is recorded, announced via `turbo:iframe-refresh-deferred`, and replayed when dismissal uncovers the page (an explicit close fetches fresh HTML anyway; browser back triggers the replay). The modal's own stream subscriptions are unaffected: they live inside the iframe and refresh it there directly, with morph and `data-turbo-permanent` honored.

**JS-driven visits.** The inert underlying page can't produce link clicks, but code still can — session-timeout redirects, WebSocket handlers, document-level keyboard shortcuts. A `Turbo.visit` proposed in the parent while a modal is open is routed by its URL:

| Proposed URL | Behavior | Decision point |
|---|---|---|
| The URL already presented | Deferred as a refresh (see above) | — |
| Another modal-pattern URL | Navigates within the modal (dialog kept) | `turbo:before-iframe-navigate`, trigger `"parent-visit"` |
| A non-modal URL | Dismisses the modal, then navigates | `turbo:before-iframe-dismiss`, trigger `"parent-visit"` |

By default these visits proceed, because the most important ones are forced (a session-timeout redirect to a sign-in page must win). Whether a given visit *should* win is application policy, so the decision points are cancelable and carry enough detail to decide:

```js
// Protect the user's in-modal work from ambient background visits,
// while letting a session-timeout redirect through.
document.addEventListener("turbo:before-iframe-dismiss", (event) => {
  const { trigger, targetUrl } = event.detail
  if (trigger === "parent-visit" && !targetUrl.includes("/sign_in")) {
    event.preventDefault()
  }
})

// Don't let background code steal the current modal either.
document.addEventListener("turbo:before-iframe-navigate", (event) => {
  if (event.detail.trigger === "parent-visit") event.preventDefault()
})
```

Because the explicit sources keep their own trigger values (`"dismiss"`, `"popstate"`, `"visit"`, `"navigate"`), a policy like the above never traps the user: their ✕ button, browser back, and in-modal links are unaffected.

## Why this library

For the longer pitch — the problem framing, why the modal-as-URL reframe matters, comparison with adjacent solutions, and honest discussion of what the library does not solve — see [docs/why-this-library.md](docs/why-this-library.md).

## License

MIT © Toru KAWAMURA
