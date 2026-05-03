import { test, expect } from "@playwright/test"

test.describe("direct access", () => {
  test("direct access to modal URL opens as modal with hidden background", async ({ page }) => {
    await page.goto("/modals/first")

    await expect(page.locator("dialog.modal-dialog[open]")).toBeVisible()
    // Body has direct-access class — underlying content visually hidden
    await expect(page.locator("body.turbo-modal-dialog-direct-access")).toBeAttached()
    await expect(page.locator("main h1")).toBeHidden()

    const iframe = page.frameLocator("dialog.modal-dialog iframe")
    await expect(iframe.locator("body")).toContainText("This screen was presented as a modal")
  })

  test("closing direct-access modal navigates to fallback URL", async ({ page }) => {
    await page.goto("/modals/first")
    await expect(page.locator("dialog.modal-dialog[open]")).toBeVisible()

    await page.click(".modal-dialog__close-button")

    await expect(page.locator("dialog.modal-dialog")).toHaveCount(0)
    await expect(page).toHaveURL("/")
  })
})
