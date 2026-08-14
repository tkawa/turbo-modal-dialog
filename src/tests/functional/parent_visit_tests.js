import { test, expect } from "@playwright/test"
import { setupEventLog, nextEventNamed, cancelNextEvent } from "../helpers/page.js"

// JS-driven visits proposed in the parent while a modal is presented.
// (The underlying page is inert, so these can't come from link clicks —
// think session-timeout redirects, WebSocket handlers, keyboard
// shortcuts.) Routing by proposed URL:
//   same URL       → deferred refresh (covered in refresh_tests.js)
//   other modal    → navigateModal, droppable via turbo:before-iframe-navigate
//   non-modal      → dismissAndVisit, droppable via turbo:before-iframe-dismiss

test.describe("parent-initiated visits while a modal is presented", () => {
  test.beforeEach(async ({ page }) => {
    await setupEventLog(page)
    await page.goto("/")
    await page.click("#open-modal")
    await expect(page.locator("dialog.turbo-modal-dialog__dialog[open]")).toBeVisible()
    // Wait for the iframe's initial load: __navigateInIframe (needed by
    // modal-to-modal navigation) is injected on the iframe's load event.
    await nextEventNamed(page, "turbo:iframe-content-loaded")
    await page.evaluate(() => {
      document.querySelector("dialog.turbo-modal-dialog__dialog").setAttribute("data-test-marker", "original")
    })
  })

  test("a visit to another modal URL navigates within the modal", async ({ page }) => {
    await page.evaluate(() => window.Turbo.visit("/modals/second"))

    const frame = page.frameLocator("dialog.turbo-modal-dialog__dialog iframe")
    await expect(frame.locator("h1")).toHaveText("Modal Navigation #2")
    await expect(page).toHaveURL("/modals/second")
    // Same dialog element — navigated in place, not re-presented
    await expect(page.locator('dialog.turbo-modal-dialog__dialog[data-test-marker="original"][open]')).toBeVisible()
    // Pushed onto the modal stack, so the in-modal back button appears
    await expect(page.locator(".turbo-modal-dialog__back-button")).toBeVisible()
  })

  test("canceling turbo:before-iframe-navigate drops a modal-to-modal visit", async ({ page }) => {
    await cancelNextEvent(page, "turbo:before-iframe-navigate")
    await page.evaluate(() => window.Turbo.visit("/modals/second"))
    // The decision point identifies the intercepted parent visit
    await nextEventNamed(page, "turbo:before-iframe-navigate", { trigger: "parent-visit" })

    await expect(page).toHaveURL("/modals/first")
    const frame = page.frameLocator("dialog.turbo-modal-dialog__dialog iframe")
    await expect(frame.locator("h1")).toHaveText("Modal Navigation")
    await expect(page.locator(".turbo-modal-dialog__back-button")).toBeHidden()
  })

  test("a visit to a non-modal URL dismisses the modal and navigates", async ({ page }) => {
    await page.evaluate(() => window.Turbo.visit("/non-modal"))

    await expect(page.locator("dialog.turbo-modal-dialog__dialog")).toHaveCount(0)
    await expect(page).toHaveURL("/non-modal")
    await expect(page.locator("main h1")).toHaveText("Basic Navigation")
  })

  test("canceling turbo:before-iframe-dismiss drops a non-modal visit", async ({ page }) => {
    await cancelNextEvent(page, "turbo:before-iframe-dismiss")
    await page.evaluate(() => window.Turbo.visit("/non-modal"))
    // The decision point received the destination and the trigger
    const detail = await nextEventNamed(page, "turbo:before-iframe-dismiss", { trigger: "parent-visit" })
    expect(detail.targetUrl).toContain("/non-modal")

    await expect(page.locator("dialog.turbo-modal-dialog__dialog[open]")).toBeVisible()
    await expect(page).toHaveURL("/modals/first")
  })
})
