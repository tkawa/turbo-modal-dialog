import { test, expect } from "@playwright/test"

test.describe("modal navigation", () => {
  test("navigation within iframe works", async ({ page }) => {
    await page.goto("/")
    await page.click("#open-modal")
    await expect(page.locator("dialog.modal-dialog[open]")).toBeVisible()

    const iframe = page.frameLocator("dialog.modal-dialog iframe")
    await expect(iframe.locator("body")).toContainText("This screen was presented as a modal")

    await iframe.locator("#modal-to-modal").click()
    await expect(iframe.locator("body")).toContainText("This screen was pushed on the modal stack")
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
