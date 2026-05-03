// Iframe Navigation — joint session history × Turbo Drive
//
// When a page presents content in an <iframe> (e.g., as a modal overlay)
// instead of replacing the body, the iframe's own navigation creates
// entries in the parent browsing context's joint session history.
// This module coordinates that with Turbo Drive on the parent:
//
// - Intercepts turbo:before-visit for iframe-presented URLs and asks
//   the host to show the iframe.
// - Blocks turbo:before-render for those URLs so Turbo doesn't replace
//   the parent body during popstate restoration.
// - Listens to popstate to show/dismiss the iframe based on URL.
// - Tracks the pre-iframe URL and provides navigateOut(), which uses
//   Turbo.visit(replace) to return there reliably across browsers.
//   (parent.history.back() is unreliable when iframe navigation has
//   added joint-history entries — Chrome and Firefox differ.)

let preIframeUrl = null
let closingByPopstate = false
let config = null

export function start(opts) {
  if (config) return
  config = opts
  document.addEventListener("turbo:before-visit", handleBeforeVisit)
  document.addEventListener("turbo:before-render", handleBeforeRender)
  window.addEventListener("popstate", handlePopstate)
}

// Called by the host after the iframe has been removed. Navigates the
// parent back to the URL we came from, or to fallbackUrl when there's
// none (direct-access / restoration). If popstate already navigated,
// this is a no-op.
export function navigateOut(fallbackUrl) {
  if (closingByPopstate) {
    closingByPopstate = false
    preIframeUrl = null
    return
  }
  const target = preIframeUrl || fallbackUrl || "/"
  preIframeUrl = null
  window.Turbo.visit(target, { action: "replace" })
}

// Reset internal state without navigating. Use when the host performs
// its own navigation (e.g., dismiss-and-visit when an iframe-internal
// link points to a non-iframe URL).
export function clear() {
  preIframeUrl = null
  closingByPopstate = false
}

function handleBeforeVisit(event) {
  const url = new URL(event.detail.url).href
  const match = config.matchUrl(url)
  if (!match) return

  event.preventDefault()
  if (preIframeUrl === null && location.href !== url) {
    preIframeUrl = location.href
  }
  if (location.href !== url) {
    history.pushState(null, "", url)
  }
  config.onShow(url, match)
}

function handleBeforeRender(event) {
  // Block Turbo's body replacement for iframe-presented URLs. Catches
  // the restoration visit Turbo dispatches on popstate (back/forward)
  // where turbo:before-visit doesn't fire reliably.
  if (config.matchUrl(location.href)) event.preventDefault()
}

function handlePopstate() {
  const match = config.matchUrl(location.href)
  if (config.isShown() && !match) {
    closingByPopstate = true
    config.onDismiss()
  } else if (!config.isShown() && match) {
    config.onShow(location.href, match)
  }
}
