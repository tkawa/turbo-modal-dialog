import { test, expect } from "@playwright/test"
import { setupEventLog, nextEventNamed } from "../helpers/page.js"

test.describe("modal navigation", () => {
  test("navigation within iframe works", async ({ page }) => {
    await setupEventLog(page)
    await page.goto("/")
    await page.click("#open-modal")
    await nextEventNamed(page, "turbo:iframe-content-loaded", {
      url: "http://localhost:9000/modals/first",
      title: "Modal Navigation"
    })

    const iframe = page.frameLocator("dialog.modal-dialog iframe")
    await iframe.locator("#modal-to-modal").click()
    await nextEventNamed(page, "turbo:iframe-content-loaded", {
      url: "http://localhost:9000/modals/second",
      title: "Modal Navigation #2"
    })
  })

  test("modal title updates after iframe navigation", async ({ page }) => {
    await page.goto("/")
    await page.click("#open-modal")
    await expect(page.locator(".modal-dialog__title")).toHaveText("Modal Navigation")

    const iframe = page.frameLocator("dialog.modal-dialog iframe")
    await iframe.locator("#modal-to-modal").click()

    await expect(page.locator(".modal-dialog__title")).toHaveText("Modal Navigation #2")
  })

  test("parent URL tracks intra-modal navigation", async ({ page }) => {
    await page.goto("/")
    await page.click("#open-modal")
    await expect(page).toHaveURL("/modals/first")

    const iframe = page.frameLocator("dialog.modal-dialog iframe")
    await iframe.locator("#modal-to-modal").click()
    await expect(iframe.locator("body")).toContainText("Modal Navigation #2")

    // Address bar should follow the iframe's modal URL.
    await expect(page).toHaveURL("/modals/second")
  })

  test("in-modal back button appears after intra-modal navigation and pops the stack", async ({ page }) => {
    await page.goto("/")
    await page.click("#open-modal")
    // No back available initially.
    await expect(page.locator(".modal-dialog__back-button")).toBeHidden()

    const iframe = page.frameLocator("dialog.modal-dialog iframe")
    await iframe.locator("#modal-to-modal").click()
    await expect(iframe.locator("body")).toContainText("Modal Navigation #2")
    await expect(page).toHaveURL("/modals/second")

    // Now back button is shown.
    await expect(page.locator(".modal-dialog__back-button")).toBeVisible()

    // Clicking it pops the stack: iframe shows #1 again, URL syncs.
    await page.click(".modal-dialog__back-button")
    await expect(iframe.locator("body")).toContainText("Modal Navigation")
    await expect(iframe.locator("body")).not.toContainText("Modal Navigation #2")
    await expect(page).toHaveURL("/modals/first")

    // Back at depth 1 — back button hides itself.
    await expect(page.locator(".modal-dialog__back-button")).toBeHidden()
  })

  test("browser back from intra-modal page dismisses the modal entirely", async ({ page }) => {
    await page.goto("/")
    await page.click("#open-modal")
    const iframe = page.frameLocator("dialog.modal-dialog iframe")
    await iframe.locator("#modal-to-modal").click()
    await expect(page).toHaveURL("/modals/second")

    // Browser back skips the in-modal stack and dismisses the whole modal,
    // because intra-modal navigation does not grow joint session history.
    await page.goBack()
    await expect(page.locator("dialog.modal-dialog")).toHaveCount(0)
    await expect(page).toHaveURL("/")
  })

  test("closing after intra-modal navigation returns to original page", async ({ page }) => {
    await page.goto("/")
    await page.click("#open-modal")

    const iframe = page.frameLocator("dialog.modal-dialog iframe")
    await iframe.locator("#modal-to-modal").click()
    await expect(iframe.locator("body")).toContainText("Modal Navigation #2")

    await page.click(".modal-dialog__close-button")
    await expect(page.locator("dialog.modal-dialog")).toHaveCount(0)
    await expect(page).toHaveURL("/")
  })

  test("non-modal link inside modal dismisses modal and navigates parent", async ({ page }) => {
    await page.goto("/")
    await page.click("#open-modal")
    await expect(page.locator("dialog.modal-dialog[open]")).toBeVisible()

    const iframe = page.frameLocator("dialog.modal-dialog iframe")
    await iframe.locator("#modal-to-non-modal").click()

    await expect(page.locator("dialog.modal-dialog")).toHaveCount(0)
    await expect(page.locator("h1")).toHaveText("Basic Navigation")
    await expect(page).toHaveURL("/non-modal")
  })
})
