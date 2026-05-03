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

// --- Module-level singleton state ---
//
// We don't rely on history.state because Turbo overwrites it with its own
// restoration data on every popstate. Instead we use URL pattern matching:
// if the current URL matches a modal rule, the modal should be open.
//
// dialogIsDirectAccess distinguishes modals opened via direct URL access
// (no history entry was pushed) from those opened via link click (pushed).
// Used to decide whether close should history.back() or Turbo.visit(fallback).

let rules = []
let activeDialog = null
let activeElement = null  // the <turbo-modal-dialog> instance that activated us
let closingByPopstate = false
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

  // Hide iframe until native CSS is applied to prevent nav bar flash.
  // The dialog animation plays while the iframe loads in the background
  // (same strategy as iOS: sheet animation masks WebView load time).
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

    // Inject iframe-side behavior:
    // 1. Intercept non-modal navigations to dismiss modal and navigate parent
    // 2. Update parent title bar on Turbo navigation within iframe
    const script = doc.createElement("script")
    script.textContent = `
      document.addEventListener("turbo:before-visit", (event) => {
        if (window.parent === window) return
        const isModal = window.parent.__turboModalDialogIsModal?.(event.detail.url)
        if (isModal === false) {
          event.preventDefault()
          window.parent.__turboModalDialogDismissAndVisit?.(event.detail.url)
        }
      })
      document.addEventListener("turbo:load", () => {
        if (window.parent === window) return
        window.parent.__turboModalDialogUpdateTitle?.(document.title)
      })
    `
    doc.head.appendChild(script)

    // Update header title from iframe's <title> (same as native nav bar)
    title.textContent = doc.title || ""

    // Reveal iframe now that nav is hidden
    iframe.classList.add("modal-dialog__iframe--loaded")
  })

  dialog.appendChild(header)
  dialog.appendChild(iframe)

  // --- Close behavior ---

  let afterCloseCallback = null

  function closeWithAnimation(callback) {
    if (dialog.classList.contains("modal-dialog--closing")) return

    if (callback) afterCloseCallback = callback

    if (!animated) {
      dialog.close()
      return
    }

    dialog.classList.add("modal-dialog--closing")
    dialog.addEventListener("animationend", () => dialog.close(), { once: true })
  }

  // Expose for parent to call from dismiss-and-navigate
  dialog.closeWithAnimation = closeWithAnimation

  closeButton.addEventListener("click", () => closeWithAnimation())

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault()
    if (dismissGestureEnabled) closeWithAnimation()
  })

  dialog.addEventListener("close", () => {
    const callback = afterCloseCallback
    afterCloseCallback = null
    const wasDirectAccess = dialogIsDirectAccess

    dialog.remove()
    document.body.classList.remove("turbo-modal-dialog-direct-access")
    activeDialog = null
    dialogIsDirectAccess = false

    if (callback) {
      callback()
    } else if (closingByPopstate) {
      // Browser back already navigated; nothing to do
      // (Forward entry remains so the modal can be restored)
      closingByPopstate = false
    } else if (wasDirectAccess) {
      // Direct-access modal: no history entry to go back to, use fallback
      window.Turbo.visit(activeElement?.fallbackUrl || "/")
    } else {
      // ✕/ESC/backdrop on a pushed modal: navigate back via history
      // popstate will fire but activeDialog is null, so it's a no-op
      history.back()
    }
  })

  if (dismissGestureEnabled) {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        closeWithAnimation()
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
  document.body.appendChild(dialog)
  dialog.showModal()
  activeDialog = dialog
  dialogIsDirectAccess = false

  // Push history entry only if we're not already at the URL.
  // popstate-triggered restoration (browser forward) reaches here at
  // the new URL — no need to push again.
  if (location.href !== url) {
    history.pushState(null, "", url)
  }
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

  // Expose functions for iframe to call (same-origin).
  // Non-modal links inside the modal iframe call these to dismiss
  // the modal and navigate on the parent page.
  window.__turboModalDialogIsModal = (url) => {
    return matchModalRule(new URL(url).pathname) !== null
  }

  window.__turboModalDialogUpdateTitle = (newTitle) => {
    const titleEl = activeDialog?.querySelector(".modal-dialog__title")
    if (titleEl) titleEl.textContent = newTitle || ""
  }

  window.__turboModalDialogDismissAndVisit = (url) => {
    if (activeDialog?.closeWithAnimation) {
      // Animate close, then navigate parent after animation completes
      activeDialog.closeWithAnimation(() => {
        window.Turbo.visit(url, { action: "replace" })
      })
    } else if (activeDialog) {
      activeDialog.close()
      window.Turbo.visit(url, { action: "replace" })
    }
  }

  document.addEventListener("turbo:before-visit", (event) => {
    const url = new URL(event.detail.url)
    const match = matchModalRule(url.pathname)
    if (match) {
      event.preventDefault()
      openModal(url.href, match)
    }
  })

  // Block Turbo's body replacement for modal URLs. This catches the
  // restoration visit Turbo dispatches on popstate (back/forward),
  // where turbo:before-visit doesn't fire reliably.
  document.addEventListener("turbo:before-render", (event) => {
    if (matchModalRule(location.pathname)) {
      event.preventDefault()
    }
  })

  // popstate handles both close (back) and open (forward) based on URL.
  // We check the URL rather than event.state because Turbo overwrites
  // history.state on every restoration visit with its own data.
  window.addEventListener("popstate", () => {
    const match = matchModalRule(location.pathname)
    if (activeDialog && !match) {
      closingByPopstate = true
      activeDialog.close()
    } else if (!activeDialog && match) {
      // Forward navigation to a modal URL — restore modal without pushState
      openModal(location.href, match)
    }
  })
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
