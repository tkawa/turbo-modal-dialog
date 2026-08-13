import { test, expect } from "@playwright/test"
import { setupEventLog, nextEventNamed } from "../helpers/page.js"

// Turbo Streams refresh broadcasts while a modal is presented.
//
// While a modal is open the parent's URL (document.baseURI) is the modal
// URL, so a refresh broadcast received by the underlying page proposes a
// visit to the modal's own URL. That proposal must refresh the iframe
// content in place — not tear down and rebuild the dialog.

test.describe("refresh while a modal is presented", () => {
  test("a refresh proposal in the parent reloads the iframe without rebuilding the dialog", async ({ page }) => {
    await setupEventLog(page)
    await page.goto("/")
    await page.click("#open-modal")
    await expect(page.locator("dialog.turbo-modal-dialog__dialog[open]")).toBeVisible()
    await nextEventNamed(page, "turbo:iframe-content-loaded")

    // Tag the dialog element; a rebuilt dialog would lose the attribute.
    await page.evaluate(() => {
      document.querySelector("dialog.turbo-modal-dialog__dialog").setAttribute("data-test-marker", "original")
      window.Turbo.session.refresh(document.baseURI)
    })

    await nextEventNamed(page, "turbo:iframe-refresh")
    await nextEventNamed(page, "turbo:iframe-content-loaded")

    await expect(page.locator('dialog.turbo-modal-dialog__dialog[data-test-marker="original"][open]')).toBeVisible()
    await expect(page.locator("dialog.turbo-modal-dialog__dialog")).toHaveCount(1)
    // No duplicate modal-stack entry — the in-modal back button stays hidden
    await expect(page.locator(".turbo-modal-dialog__back-button")).toBeHidden()
  })

  test("a refresh inside the iframe morphs the content and preserves data-turbo-permanent", async ({ page }) => {
    await setupEventLog(page)
    await page.goto("/")
    await page.evaluate(() => window.Turbo.visit("/modals/refresh"))
    await expect(page.locator("dialog.turbo-modal-dialog__dialog[open]")).toBeVisible()
    await nextEventNamed(page, "turbo:iframe-content-loaded")

    const frame = page.frameLocator("dialog.turbo-modal-dialog__dialog iframe")
    const note = frame.locator("#permanent-note")
    await expect(note).toHaveText("initial")

    // Mutate the permanent element, then simulate a refresh broadcast
    // received by the modal page's own stream subscription.
    await note.evaluate((el) => {
      el.textContent = "edited"
      document.addEventListener("turbo:morph", () => { window.__didMorph = true })
      window.Turbo.session.refresh(document.baseURI)
    })

    await nextEventNamed(page, "turbo:iframe-content-loaded")

    await expect(note).toHaveText("edited")
    expect(await frame.locator("body").evaluate(() => window.__didMorph)).toBe(true)
    await expect(page.locator("dialog.turbo-modal-dialog__dialog")).toHaveCount(1)
    // The same-URL visit must not push a duplicate modal-stack entry
    await expect(page.locator(".turbo-modal-dialog__back-button")).toBeHidden()
  })
})
