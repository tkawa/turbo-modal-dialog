// Iframe Navigation — polyfill for a hypothetical future Turbo Drive
// API for presenting URLs in iframes (e.g., as modal overlays).
//
// Synthesizes turbo:iframe-* events and exposes a TurboIframe global
// programmatic API by intercepting Turbo Drive's existing events and
// coordinating with iframe navigation. When/if Turbo Drive natively
// supports iframe presentation, this module can be removed and the
// rest of the package will continue to work unchanged.
//
// === Events (dispatched on document) ===
//
//   turbo:before-iframe-present  (cancelable)
//     detail: { url, properties }
//     Fires before an iframe is presented. preventDefault to skip.
//
//   turbo:iframe-presented
//     detail: { url, properties, bindFrame }
//     Host should create the iframe and pass it to detail.bindFrame
//     so the polyfill can wire up cross-frame communication.
//
//   turbo:iframe-navigate
//     detail: { url, canGoBack }
//     The iframe should display a different modal URL. Host navigates the
//     iframe (typically via Turbo.visit(url, { action: "replace" }) so the
//     iframe's session history doesn't grow), and updates the back-button
//     visibility from canGoBack.
//
//   turbo:iframe-content-loaded
//     detail: { url, title }
//     Iframe content (re)loaded. Useful for syncing modal title.
//
//   turbo:before-iframe-dismiss  (cancelable)
//     Fires before iframe is dismissed. preventDefault to keep open.
//
//   turbo:iframe-dismissed
//     detail: { targetUrl }
//     Host should remove the iframe (with animation if any).
//     If targetUrl is non-null, host navigates parent there after dismissal.
//
// === Programmatic API (window.TurboIframe) ===
// Naming aspires to a future Turbo Drive extension (Turbo.iframe.*) but
// uses a separate global because Turbo's global is not extensible.
//
//   matchesUrl(url) — returns properties object or null
//   isPresented — read-only boolean
//   canGoBack — read-only boolean (modal nav stack length > 1)
//   dismiss(fallbackUrl?) — dismiss; navigation handled by host on iframe-dismissed
//   dismissAndVisit(url) — dismiss with explicit target URL
//   navigateModal(url) — push a new URL onto the modal stack and tell host
//                        to navigate the iframe. Called from the injected
//                        iframe script when a user clicks an intra-modal link.
//   back() — pop the modal stack and tell host to navigate the iframe back.
//            No-op if stack length <= 1.
//
// === History model: parent owns one entry per modal session ===
//
// Browser back from anywhere inside a modal dismisses the entire modal.
// This is achieved by keeping the iframe's session history at length 1 —
// every intra-modal navigation goes through Turbo.visit(url, { action:
// "replace" }) inside the iframe, never adding a new joint-session-history
// entry. A custom "modal stack" (an in-memory array of modal URLs) drives
// a back button rendered inside the modal header, providing intra-modal
// back navigation without colliding with browser back.
//
// The address bar still tracks the iframe's current URL: the host's
// navigateModal calls history.replaceState on the parent so the URL bar
// stays truthful, and refresh / bookmark / share continue to deep-link
// to the currently displayed modal page.
//
// Trade-off vs. having the iframe own its history:
//   + Browser forward button correctly disables when there's nowhere
//     forward to go (no stale destroyed-iframe entries left in joint
//     session history).
//   + Browser back has a single, predictable meaning: "leave the modal".
//   - Browser back can no longer step through the modal's internal
//     navigation. The in-modal back button is the way to do that.
//
// === Navigation strategy on dismiss ===
//
// When dismissing the iframe, the host calls Turbo.visit(target, { action:
// "replace" }) rather than parent.history.back(). Two independent reasons:
//
// 1. parent.history.back() is browser-divergent in the presence of iframe
//    history entries, so we cannot rely on it:
//
//      - Chrome / WebKit: traverses joint session history (parent + iframe)
//      - Firefox:         traverses parent's session history only
//
//    The HTML Living Standard's session-history rewrite leans toward the
//    Chrome/WebKit interpretation, but Firefox hasn't aligned yet. Rather
//    than UA-sniff Firefox or count iframe-history depth (both add fragile
//    state), we follow Turbo's broader pattern: avoid APIs whose behavior
//    is browser-divergent and take deterministic control ourselves. Turbo
//    itself does this for scroll restoration — sets `scrollRestoration =
//    "manual"` and manages scroll positions internally rather than relying
//    on the browser's auto-restoration. Turbo has zero User-Agent sniffing
//    in its codebase; we follow the same discipline here.
//
//    This rules out history.back() but on its own would still allow either
//    Turbo.visit(target, { action: "advance" }) or { action: "replace" }.
//    The choice between those is the second reason, below.
//
// 2. "replace" mirrors the iOS/Android native modal dismiss semantic: the
//    modal is an ephemeral overlay, not a navigation step. Dismissing
//    leaves no trace in the navigation stack. With "advance" the modal
//    URL would remain mid-history and pressing back would resurrect the
//    modal — surprising right after the user explicitly clicked ✕/ESC.
//
//    Note: forward-restore (browser forward re-presents the iframe) IS
//    supported via popstate; that is the right place for "back/forward
//    re-traversal" semantics. Explicit dismiss is treated separately and
//    intentionally collapses the modal entry out of the stack.

let preIframeUrl = null
let closingByPopstate = false
let isPresented = false
let matchUrlFn = null
// Modal navigation stack — drives the in-modal back button. Reset on
// dismiss / present. Forward-restored presentations start a fresh stack
// (we have no way to reconstruct a previous in-memory stack from history).
let modalStack = []

export function start({ matchUrl }) {
  if (matchUrlFn) return
  matchUrlFn = matchUrl

  document.addEventListener("turbo:before-visit", handleBeforeVisit)
  document.addEventListener("turbo:before-render", handleBeforeRender)
  window.addEventListener("popstate", handlePopstate)

  // Public programmatic API.
  window.TurboIframe = {
    matchesUrl: (url) => matchUrlFn(url),
    get isPresented() { return isPresented },
    get canGoBack() { return modalStack.length > 1 },
    dismiss,
    dismissAndVisit,
    navigateModal,
    back
  }

  // Direct-access detection — if we land on an iframe URL on initial page
  // load, mark as presented so dismiss() works correctly. Host detects
  // direct access via DOMContentLoaded and creates the dialog itself.
  if (matchUrlFn(location.href)) {
    isPresented = true
    modalStack = [location.href]
  }
}

// --- Programmatic API ---

function dismiss(fallbackUrl) {
  if (!isPresented) return
  if (!dispatchCancelable("turbo:before-iframe-dismiss")) return

  let targetUrl = null
  if (closingByPopstate) {
    closingByPopstate = false
  } else {
    targetUrl = preIframeUrl || fallbackUrl || "/"
  }
  preIframeUrl = null
  isPresented = false
  modalStack = []
  dispatch("turbo:iframe-dismissed", { targetUrl })
}

function dismissAndVisit(url) {
  if (!isPresented) {
    window.Turbo.visit(url, { action: "replace" })
    return
  }
  if (!dispatchCancelable("turbo:before-iframe-dismiss")) return

  preIframeUrl = null
  closingByPopstate = false
  isPresented = false
  modalStack = []
  dispatch("turbo:iframe-dismissed", { targetUrl: url })
}

// Push a URL onto the modal stack and tell the host to navigate the
// iframe to it. The iframe's session history must NOT grow — host calls
// Turbo.visit(url, { action: "replace" }) inside the iframe.
function navigateModal(url) {
  if (!isPresented) return
  if (!matchUrlFn(url)) return
  modalStack.push(url)
  if (location.href !== url) {
    history.replaceState(null, "", url)
  }
  dispatch("turbo:iframe-navigate", { url, canGoBack: modalStack.length > 1 })
}

// Pop one entry off the modal stack and ask the host to navigate the
// iframe back. No-op when there is nothing to go back to.
function back() {
  if (!isPresented) return
  if (modalStack.length <= 1) return
  modalStack.pop()
  const previous = modalStack[modalStack.length - 1]
  if (location.href !== previous) {
    history.replaceState(null, "", previous)
  }
  dispatch("turbo:iframe-navigate", { url: previous, canGoBack: modalStack.length > 1 })
}

// --- Turbo Drive event handlers ---

function handleBeforeVisit(event) {
  const url = new URL(event.detail.url).href
  const properties = matchUrlFn(url)
  if (!properties) return

  event.preventDefault()
  if (!dispatchCancelable("turbo:before-iframe-present", { url, properties })) return

  if (preIframeUrl === null && location.href !== url) {
    preIframeUrl = location.href
  }
  if (location.href !== url) {
    history.pushState(null, "", url)
  }
  isPresented = true
  modalStack = [url]
  presentIframe(url, properties)
}

function handleBeforeRender(event) {
  // Block Turbo's body replacement for iframe-presented URLs. Catches
  // the restoration visit Turbo dispatches on popstate (back/forward)
  // where turbo:before-visit doesn't fire reliably.
  if (matchUrlFn(location.href)) event.preventDefault()
}

function handlePopstate() {
  const properties = matchUrlFn(location.href)

  if (isPresented && !properties) {
    // Browser back away from iframe URL — dismiss without navigation
    // (browser already navigated).
    closingByPopstate = true
    if (!dispatchCancelable("turbo:before-iframe-dismiss")) {
      closingByPopstate = false
      return
    }
    closingByPopstate = false
    preIframeUrl = null
    isPresented = false
    modalStack = []
    dispatch("turbo:iframe-dismissed", { targetUrl: null })
    // The body already contains the parent (pre-iframe) page — we never let
    // Turbo replace body while the iframe was presented, so Turbo's
    // restoration visit for this URL is redundant. Cancel it so its body
    // replace doesn't race with the host's close animation / View Transition.
    cancelTurboVisit()
  } else if (!isPresented && properties) {
    // Browser forward to iframe URL — restore presentation (no pushState).
    if (!dispatchCancelable("turbo:before-iframe-present", { url: location.href, properties })) return
    isPresented = true
    modalStack = [location.href]
    presentIframe(location.href, properties)
    // Cancel any in-flight Turbo visit (e.g. the previous back's restoration
    // visit may not have finished rendering yet). Without this, the visit's
    // before-render will fire under the iframe URL — we'd preventDefault
    // and the visit would hang, leaving the progress bar stuck.
    cancelTurboVisit()
  }
}

function cancelTurboVisit() {
  const adapter = window.Turbo?.session?.adapter
  window.Turbo?.navigator?.currentVisit?.cancel()
  adapter?.hideVisitProgressBar?.()
}

// --- Iframe binding (cross-frame communication) ---

function presentIframe(url, properties) {
  dispatch("turbo:iframe-presented", { url, properties, bindFrame })
}

// Host calls this after creating the iframe, to wire up cross-frame events.
export function bindFrame(iframe) {
  iframe.addEventListener("load", () => {
    const doc = iframe.contentDocument
    if (!doc) return

    // Inject a script that bridges iframe-internal Turbo events to
    // the parent's turbo:iframe-* event system.
    const script = doc.createElement("script")
    script.textContent = `
      // Re-entry guard: when our handler programmatically re-issues a
      // visit as { action: "replace" } (to keep the iframe's session
      // history at length 1), we must not intercept that re-issued visit
      // again — it would loop forever.
      let __programmaticReplace = false

      document.addEventListener("turbo:before-visit", (event) => {
        if (window.parent === window) return
        if (__programmaticReplace) {
          __programmaticReplace = false
          return
        }
        const url = event.detail.url
        event.preventDefault()
        if (window.parent.TurboIframe.matchesUrl(url)) {
          // Intra-modal link click — push onto parent's modal stack and
          // re-trigger the same URL as a replace so iframe history stays
          // length 1. The parent will dispatch turbo:iframe-navigate; the
          // host listener will call __navigateInIframe below.
          window.parent.TurboIframe.navigateModal(url)
        } else {
          window.parent.TurboIframe.dismissAndVisit(url)
        }
      })

      // Called by the host (parent) to navigate this iframe to a different
      // modal URL with replace semantics so no joint-session-history
      // entries are added.
      window.__navigateInIframe = (url) => {
        if (location.href === url) return
        __programmaticReplace = true
        Turbo.visit(url, { action: "replace" })
      }

      document.addEventListener("turbo:load", () => {
        if (window.parent === window) return
        window.parent.document.dispatchEvent(new CustomEvent("turbo:iframe-content-loaded", {
          bubbles: true,
          detail: { url: location.href, title: document.title }
        }))
      })
    `
    doc.head.appendChild(script)

    // Initial content-loaded event (for first load before turbo:load fires)
    document.dispatchEvent(new CustomEvent("turbo:iframe-content-loaded", {
      bubbles: true,
      detail: { url: doc.location.href, title: doc.title }
    }))
  })
}

// --- Helpers ---

function dispatch(type, detail = {}) {
  document.dispatchEvent(new CustomEvent(type, { bubbles: true, detail }))
}

function dispatchCancelable(type, detail = {}) {
  const event = new CustomEvent(type, { bubbles: true, cancelable: true, detail })
  document.dispatchEvent(event)
  return !event.defaultPrevented
}
