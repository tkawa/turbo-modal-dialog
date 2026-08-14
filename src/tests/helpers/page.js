// Test helpers — adapted from hotwired/turbo's src/tests/helpers/page.js,
// scoped to this library's turbo:iframe-* event surface and TurboIframe
// programmatic API.

const TURBO_IFRAME_EVENTS = [
  "turbo:before-iframe-present",
  "turbo:iframe-presented",
  "turbo:iframe-content-loaded",
  "turbo:iframe-refresh",
  "turbo:before-iframe-navigate",
  "turbo:iframe-navigate",
  "turbo:before-iframe-dismiss",
  "turbo:iframe-dismissed"
]

// Install an init script that records every turbo:iframe-* event into
// window.__eventLog. Must be called before page.goto() so the listener
// is attached before the page's own scripts run.
export async function setupEventLog(page) {
  await page.addInitScript((events) => {
    window.__eventLog = []
    function serialize(value) {
      if (value === null || value === undefined) return value
      if (typeof value === "function") return undefined
      if (value instanceof Element || value instanceof Node) return undefined
      if (Array.isArray(value)) return value.map(serialize).filter((v) => v !== undefined)
      if (typeof value === "object") {
        const out = {}
        for (const [k, v] of Object.entries(value)) {
          const s = serialize(v)
          if (s !== undefined) out[k] = s
        }
        return out
      }
      return value
    }
    for (const name of events) {
      addEventListener(name, (event) => {
        window.__eventLog.push({ name, detail: serialize(event.detail) })
      })
    }
  }, TURBO_IFRAME_EVENTS)
}

// Shift up to `count` events from the front of the log and return them.
// Events left in the log remain available to subsequent reads.
export async function readEventLogs(page, count = Infinity) {
  return await page.evaluate((n) => {
    const log = window.__eventLog || []
    return log.splice(0, n)
  }, count === Infinity ? Number.MAX_SAFE_INTEGER : count)
}

// Drain the entire log without inspecting it. Useful between phases of
// a test when prior events are no longer relevant.
export async function clearEventLogs(page) {
  await page.evaluate(() => { window.__eventLog = [] })
}

// Poll the event log shifting one event at a time until a matching one
// is found. Non-matching events ahead of the match are consumed.
// Returns the matched event's detail.
export async function nextEventNamed(page, name, expectedDetail = {}, timeout = 2000) {
  const startTime = Date.now()
  while (Date.now() - startTime < timeout) {
    const [event] = await readEventLogs(page, 1)
    if (event) {
      if (event.name === name &&
          Object.entries(expectedDetail).every(([k, v]) => event.detail?.[k] === v)) {
        return event.detail
      }
      // Non-matching event consumed; loop to try the next.
      continue
    }
    await page.waitForTimeout(25)
  }
  throw new Error(
    `Event ${name} with ${JSON.stringify(expectedDetail)} not dispatched within ${timeout}ms`
  )
}

// Register a one-shot listener that calls preventDefault on the next
// occurrence of the named event. Useful for testing cancelable events.
export async function cancelNextEvent(page, name) {
  await page.evaluate((eventName) => {
    addEventListener(eventName, (event) => event.preventDefault(), { once: true })
  }, name)
}
