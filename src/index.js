// Turbo Modal Dialog
//
// Brings Hotwire Native's Path Configuration concept to the web,
// presenting Turbo Drive navigations as <dialog> modals with an
// <iframe> for independent navigation, mirroring the native WebView
// stack approach.
//
// Usage:
//   1. Import this module (e.g., via importmap)
//   2. Place the custom element in your layout with configuration:
//
//        <turbo-modal-dialog
//          modal-fallback="/"
//          path-configuration="/configurations/web_v1"
//          content-stylesheet="/assets/native.css">
//          <script type="application/json">{ "rules": [...] }</script>
//        </turbo-modal-dialog>
//
// Attributes (all optional):
//   - modal-fallback        URL to navigate to when closing a direct-access
//                           modal (default: "/")
//   - path-configuration    URL of remote Path Configuration JSON; loaded
//                           on init to override the inline local rules
//   - content-stylesheet    URL of CSS injected into the modal's iframe
//                           (e.g., your app's "native.css" to hide nav)
//
// Children (optional):
//   - <script type="application/json">  Inline (local) Path Configuration

import * as iframeNavigation from "./iframe_navigation.js"

// --- View Transitions ---
//
// We call document.startViewTransition() directly instead of relying on
// Turbo 8's <meta name="view-transition"> support. Turbo's ViewTransitioner
// only wraps `view.renderPage`'s body replacement, but this library
// preventDefaults turbo:before-visit for iframe URLs, so body replacement
// never happens for present. Even on dismiss (where Turbo does replace
// the body), the dialog is JS-injected and absent from the server-rendered
// HTML, so it has no counterpart in Turbo's new snapshot — the View
// Transition would have nothing to track on. By calling startViewTransition
// ourselves at the moment we mutate dialog state, we get the same animation
// regardless of trigger (click, popstate back, popstate forward, form
// submit) — present/dismiss/swap unified under one primitive.
//
// Browsers without startViewTransition fall back to instant DOM mutation
// (no animation), keeping the behavior functional but unanimated.

function withViewTransition(callback) {
  if (document.startViewTransition) {
    return document.startViewTransition(callback)
  }
  callback()
  return null
}

// --- Module-level singleton state ---

let rules = []
let activeDialog = null
let activeElement = null  // the <turbo-modal-dialog> instance that activated us
let dialogIsDirectAccess = false
let initialized = false

// --- Path Configuration ---

function loadLocalPathConfiguration(element) {
  const localRules = element.localRules
  if (localRules) rules = localRules
}

async function loadRemotePathConfiguration(element) {
  const url = element.pathConfigurationUrl
  if (!url) return

  const response = await fetch(url)
  const config = await response.json()
  rules = config.rules || []
}

function matchModalRule(pathname) {
  for (const rule of rules) {
    if (rule.properties.context !== "modal") continue
    for (const pattern of rule.patterns) {
      if (new RegExp(pattern).test(pathname)) return rule.properties
    }
  }
  return null
}

// --- Dialog ---

function createDialog(url, properties) {
  const modalStyle = properties.modal_style || "large"
  const animated = properties.animated !== false
  const dismissGestureEnabled = properties.modal_dismiss_gesture_enabled !== false

  const dialog = document.createElement("dialog")
  dialog.className = `modal-dialog modal-dialog--${modalStyle}`
  if (!animated) dialog.classList.add("modal-dialog--no-animation")

  const header = document.createElement("div")
  header.className = "modal-dialog__header"

  // In-modal back button — the way to navigate the modal stack now that
  // browser back is reserved for "leave the modal entirely". Starts
  // invisible (but still occupies layout space so the title stays
  // centered); shown when TurboIframe.canGoBack becomes true after an
  // intra-modal link click pushes onto the modal stack.
  const backButton = document.createElement("button")
  backButton.className = "modal-dialog__back-button modal-dialog__back-button--invisible"
  backButton.type = "button"
  backButton.setAttribute("aria-label", "Back")
  backButton.innerHTML = "&#10094;"
  header.appendChild(backButton)

  const title = document.createElement("span")
  title.className = "modal-dialog__title"
  header.appendChild(title)

  const closeButton = document.createElement("button")
  closeButton.className = "modal-dialog__close-button"
  closeButton.type = "button"
  closeButton.setAttribute("aria-label", "Close")
  closeButton.innerHTML = "&#x2715;"
  header.appendChild(closeButton)

  const iframe = document.createElement("iframe")
  iframe.className = "modal-dialog__iframe"
  iframe.src = url

  // Inject host-specific styles into iframe on each load.
  iframe.addEventListener("load", () => {
    const doc = iframe.contentDocument
    if (!doc) return

    // Inject hide@native rule as inline <style> (synchronous, no network wait)
    const style = doc.createElement("style")
    style.textContent = String.raw`.hide\@native { display: none !important; }`
    doc.head.insertBefore(style, doc.head.firstChild)

    // Also load the user-provided content stylesheet (e.g., native.css)
    const contentStylesheet = activeElement?.contentStylesheet
    if (contentStylesheet) {
      const link = doc.createElement("link")
      link.rel = "stylesheet"
      link.href = contentStylesheet
      doc.head.appendChild(link)
    }

    // Reveal iframe now that nav is hidden
    iframe.classList.add("modal-dialog__iframe--loaded")
  })

  // Let the polyfill wire up cross-frame events (turbo:iframe-content-loaded,
  // dismiss-and-visit, etc.) on this iframe.
  iframeNavigation.bindFrame(iframe)

  dialog.appendChild(header)
  dialog.appendChild(iframe)

  // --- Close behavior ---
  //
  // User-initiated close (✕/ESC/backdrop) calls TurboIframe.dismiss(),
  // which dispatches turbo:iframe-dismissed. Our listener for that event
  // (registered in activate()) wraps dialog.close() in a View Transition
  // and triggers the host's own visit if the polyfill provides a targetUrl.

  backButton.addEventListener("click", () => {
    window.TurboIframe.back()
  })

  closeButton.addEventListener("click", () => {
    window.TurboIframe.dismiss(activeElement?.fallbackUrl)
  })

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault()
    if (dismissGestureEnabled) {
      window.TurboIframe.dismiss(activeElement?.fallbackUrl)
    }
  })

  dialog.addEventListener("close", () => {
    dialog.remove()
    document.body.classList.remove("turbo-modal-dialog-direct-access")
    if (activeDialog === dialog) activeDialog = null
    dialogIsDirectAccess = false
  })

  if (dismissGestureEnabled) {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        window.TurboIframe.dismiss(activeElement?.fallbackUrl)
      }
    })
  }

  return dialog
}

function openModal(url, properties) {
  if (activeDialog) {
    activeDialog.remove()
    activeDialog = null
  }

  const dialog = createDialog(url, properties)
  activeDialog = dialog
  dialogIsDirectAccess = false
  withViewTransition(() => {
    document.body.appendChild(dialog)
    dialog.showModal()
  })
}

// Open modal at the current URL when the page was directly loaded
// (deep link / refresh). No history is pushed — close navigates to fallback.
// Underlying body content is hidden via CSS class (no DOM destruction).
function openModalForDirectAccess(properties) {
  document.body.classList.add("turbo-modal-dialog-direct-access")

  const dialog = createDialog(location.href, properties)
  document.body.appendChild(dialog)
  dialog.showModal()
  activeDialog = dialog
  dialogIsDirectAccess = true
}

// --- Activation ---

function activate(element) {
  if (initialized) {
    if (element !== activeElement) {
      console.warn(
        "turbo-modal-dialog: multiple <turbo-modal-dialog> elements detected. " +
        "Only the first one is active; others are ignored."
      )
    }
    return
  }

  initialized = true
  activeElement = element

  loadLocalPathConfiguration(element)
  loadRemotePathConfiguration(element)

  // Wire up the iframe-presentation polyfill.
  iframeNavigation.start({
    matchUrl: (url) => matchModalRule(new URL(url).pathname)
  })

  // Listen to events from the polyfill.
  document.addEventListener("turbo:iframe-presented", (event) => {
    openModal(event.detail.url, event.detail.properties)
  })

  document.addEventListener("turbo:iframe-content-loaded", (event) => {
    const titleEl = activeDialog?.querySelector(".modal-dialog__title")
    if (titleEl) titleEl.textContent = event.detail.title || ""
  })

  // Modal-to-modal navigation: tell the iframe (which already
  // preventDefault'd its own visit) to load the new URL with replace
  // semantics, and reflect the back-button availability.
  document.addEventListener("turbo:iframe-navigate", (event) => {
    if (!activeDialog) return
    const iframe = activeDialog.querySelector("iframe.modal-dialog__iframe")
    iframe?.contentWindow?.__navigateInIframe?.(event.detail.url)
    const back = activeDialog.querySelector(".modal-dialog__back-button")
    if (back) back.classList.toggle("modal-dialog__back-button--invisible", !event.detail.canGoBack)
  })

  document.addEventListener("turbo:iframe-dismissed", (event) => {
    const targetUrl = event.detail.targetUrl
    if (!activeDialog) {
      if (targetUrl) window.Turbo.visit(targetUrl, { action: "replace" })
      return
    }
    // Unified close path: View Transition wraps dialog.close() so the
    // animation plays the same way regardless of trigger (popstate back,
    // close button, dismiss-and-visit, form-submit redirect).
    //
    // Both close() and remove() run inside the VT callback so the new
    // snapshot is taken with the dialog fully gone. If we relied on the
    // close-event handler to remove() (it does that for non-VT paths
    // like when activeDialog is mutated externally), Chrome would still
    // capture the dialog (display:none from UA stylesheet on
    // dialog:not([open])) into the new snapshot and run a phantom
    // slide-in alongside the slide-out, washing the animation into a
    // cross-fade.
    //
    // Turbo.visit is deferred until the VT is ready (old snapshot taken,
    // update callback complete) so that Turbo's render — which can use a
    // cached snapshot and replace <body> on the very next animation frame
    // — does not race with VT's capture step. Without this, a cached
    // visit replaces body before VT can capture the dialog into ::view-
    // transition-old, and no slide-down animation is observed.
    const dialogToClose = activeDialog
    const transition = withViewTransition(() => {
      dialogToClose.close()
      dialogToClose.remove()
    })
    if (targetUrl) {
      if (transition?.ready) {
        transition.ready.then(
          () => window.Turbo.visit(targetUrl, { action: "replace" }),
          () => window.Turbo.visit(targetUrl, { action: "replace" })
        )
      } else {
        window.Turbo.visit(targetUrl, { action: "replace" })
      }
    }
  })

  // Direct-access detection: if the current URL matches a modal pattern
  // and no modal is open, open the page as a modal with hidden background.
  function checkDirectAccess() {
    if (activeDialog) return
    const match = matchModalRule(location.pathname)
    if (match) openModalForDirectAccess(match)
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkDirectAccess)
  } else {
    checkDirectAccess()
  }
}

// --- Custom Element ---

class TurboModalDialogElement extends HTMLElement {
  connectedCallback() {
    // Skip in iframes (parent handles modal presentation)
    if (window.parent !== window) return
    // Skip in Hotwire Native apps (native handles modal presentation)
    if (/(Turbo|Hotwire) Native/.test(navigator.userAgent)) return

    activate(this)
  }

  // --- Configuration accessors ---

  get fallbackUrl() {
    return this.getAttribute("modal-fallback") || "/"
  }

  get pathConfigurationUrl() {
    return this.getAttribute("path-configuration")
  }

  get contentStylesheet() {
    return this.getAttribute("content-stylesheet")
  }

  get localRules() {
    const script = this.querySelector('script[type="application/json"]')
    if (!script) return null
    return JSON.parse(script.textContent).rules || []
  }
}

customElements.define("turbo-modal-dialog", TurboModalDialogElement)
