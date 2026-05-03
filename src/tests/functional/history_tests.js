import { test, expect } from "@playwright/test"

test.describe("browser history", () => {
  test("browser back closes modal, forward restores it", async ({ page }) => {
    await page.goto("/")
    await page.click("#open-modal")
    await expect(page.locator("dialog.modal-dialog[open]")).toBeVisible()
    await expect(page).toHaveURL("/modals/first")

    await page.goBack()
    await expect(page.locator("dialog.modal-dialog")).toHaveCount(0)
    await expect(page).toHaveURL("/")

    await page.goForward()
    await expect(page.locator("dialog.modal-dialog[open]")).toBeVisible()
    await expect(page).toHaveURL("/modals/first")
  })

  test("back and forward cycle works repeatedly", async ({ page }) => {
    await page.goto("/")
    await page.click("#open-modal")
    await expect(page.locator("dialog.modal-dialog[open]")).toBeVisible()

    for (let i = 0; i < 3; i++) {
      await page.goBack()
      await expect(page.locator("dialog.modal-dialog")).toHaveCount(0)
      await page.goForward()
      await expect(page.locator("dialog.modal-dialog[open]")).toBeVisible()
    }
  })
})
