# turbo-modal-dialog

Present Turbo Drive navigations as modals — bringing a [Hotwire Native–compatible](https://native.hotwired.dev) approach to the web.

URL patterns can be marked as modal in a Path Configuration (the same JSON format Hotwire Native apps use). Matching navigations open in a `<dialog>` instead of replacing the page, mirroring how native apps present modal screens.

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

```sh
npm install turbo-modal-dialog
```

Or with [importmap-rails](https://github.com/rails/importmap-rails):

```sh
bin/importmap pin turbo-modal-dialog
```

## Usage

Import the module:

```js
import "turbo-modal-dialog"
```

Include the stylesheet:

```html
<link rel="stylesheet" href="/path/to/turbo-modal-dialog/src/style.css">
```

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

## License

MIT © Toru KAWAMURA
