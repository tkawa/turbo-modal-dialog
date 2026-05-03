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

  test("Turbo progress bar does not get stuck during forward-restore", async ({ page }) => {
    await page.goto("/")
    await page.click("#open-modal")
    await expect(page.locator("dialog.modal-dialog[open]")).toBeVisible()

    await page.goBack()
    await expect(page.locator("dialog.modal-dialog")).toHaveCount(0)

    await page.goForward()
    await expect(page.locator("dialog.modal-dialog[open]")).toBeVisible()

    // Turbo's progress bar shows after a 500ms delay if a visit is still
    // in progress. Wait longer than that before asserting it isn't visible.
    await page.waitForTimeout(700)
    await expect(page.locator(".turbo-progress-bar")).toHaveCount(0)
  })

  test("Turbo progress bar does not get stuck with a slow iframe load", async ({ page }) => {
    await page.goto("/")
    await page.click("#open-modal-slow")
    // Iframe content takes 1s. Modal dialog itself opens immediately;
    // the progress bar must not appear since we cancelled Turbo's visit.
    await expect(page.locator("dialog.modal-dialog[open]")).toBeVisible()
    await page.waitForTimeout(700)
    await expect(page.locator(".turbo-progress-bar")).toHaveCount(0)

    await expect(page.locator("dialog.modal-dialog iframe.modal-dialog__iframe--loaded")).toBeAttached()
  })
})
