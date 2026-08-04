import { test, expect } from "@playwright/test"
import { setupEventLog, clearEventLogs, nextEventNamed, cancelNextEvent } from "../helpers/page.js"

test.describe("custom events", () => {
  test.beforeEach(async ({ page }) => {
    await setupEventLog(page)
    await page.goto("/")
  })

  test("turbo:before-iframe-present fires with url and properties on link click", async ({ page }) => {
    await page.click("#open-modal")
    const detail = await nextEventNamed(page, "turbo:before-iframe-present")
    expect(detail.url).toBe("http://localhost:9000/modals/first")
    expect(detail.properties).toMatchObject({ context: "modal" })
  })

  test("turbo:iframe-presented fires after turbo:before-iframe-present", async ({ page }) => {
    await page.click("#open-modal")
    await nextEventNamed(page, "turbo:before-iframe-present")
    const detail = await nextEventNamed(page, "turbo:iframe-presented")
    expect(detail.url).toBe("http://localhost:9000/modals/first")
    expect(detail.properties).toMatchObject({ context: "modal" })
    // bindFrame is a function and stripped from the serialized detail; we
    // do not assert on it here.
  })

  test("turbo:iframe-content-loaded fires with iframe url and title", async ({ page }) => {
    await page.click("#open-modal")
    const detail = await nextEventNamed(page, "turbo:iframe-content-loaded")
    expect(detail.url).toBe("http://localhost:9000/modals/first")
    expect(detail.title).toBe("Modal Navigation")
  })

  test("turbo:iframe-navigate fires on intra-modal link click", async ({ page }) => {
    await page.click("#open-modal")
    await expect(page.locator("dialog.turbo-modal-dialog__dialog[open]")).toBeVisible()
    await clearEventLogs(page)

    const iframe = page.frameLocator("dialog.turbo-modal-dialog__dialog iframe")
    await iframe.locator("#modal-to-modal").click()

    const detail = await nextEventNamed(page, "turbo:iframe-navigate")
    expect(detail.url).toBe("http://localhost:9000/modals/second")
    expect(detail.canGoBack).toBe(true)
  })

  test("turbo:before-iframe-dismiss fires before turbo:iframe-dismissed (close button)", async ({ page }) => {
    await page.click("#open-modal")
    await expect(page.locator("dialog.turbo-modal-dialog__dialog[open]")).toBeVisible()
    await clearEventLogs(page)

    await page.click(".turbo-modal-dialog__close-button")

    await nextEventNamed(page, "turbo:before-iframe-dismiss")
    const dismissed = await nextEventNamed(page, "turbo:iframe-dismissed")
    expect(dismissed.targetUrl).toBe("http://localhost:9000/")
  })

  test("turbo:iframe-dismissed fires with null targetUrl on browser back", async ({ page }) => {
    await page.click("#open-modal")
    await expect(page.locator("dialog.turbo-modal-dialog__dialog[open]")).toBeVisible()
    await clearEventLogs(page)

    await page.goBack()
    const detail = await nextEventNamed(page, "turbo:iframe-dismissed")
    expect(detail.targetUrl).toBeNull()
  })

  test("turbo:iframe-dismissed fires with target URL on dismissAndVisit (intra-iframe non-modal link)", async ({ page }) => {
    await page.click("#open-modal")
    await expect(page.locator("dialog.turbo-modal-dialog__dialog[open]")).toBeVisible()
    await clearEventLogs(page)

    const iframe = page.frameLocator("dialog.turbo-modal-dialog__dialog iframe")
    await iframe.locator("#modal-to-non-modal").click()

    const detail = await nextEventNamed(page, "turbo:iframe-dismissed")
    expect(detail.targetUrl).toBe("http://localhost:9000/non-modal")
  })

  test("preventing turbo:before-iframe-present prevents the modal from opening", async ({ page }) => {
    await cancelNextEvent(page, "turbo:before-iframe-present")
    await page.click("#open-modal")

    // Give the system a moment, then assert no modal was opened.
    await page.waitForTimeout(200)
    await expect(page.locator("dialog.turbo-modal-dialog__dialog")).toHaveCount(0)
  })

  test("preventing turbo:before-iframe-dismiss keeps the modal open", async ({ page }) => {
    await page.click("#open-modal")
    await expect(page.locator("dialog.turbo-modal-dialog__dialog[open]")).toBeVisible()

    await cancelNextEvent(page, "turbo:before-iframe-dismiss")
    await page.click(".turbo-modal-dialog__close-button")

    await page.waitForTimeout(200)
    await expect(page.locator("dialog.turbo-modal-dialog__dialog[open]")).toBeVisible()
  })
})
