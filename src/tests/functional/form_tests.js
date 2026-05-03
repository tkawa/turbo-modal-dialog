import { test, expect } from "@playwright/test"

test.describe("form submission", () => {
  test("successful form submit dismisses modal and navigates", async ({ page }) => {
    await page.goto("/")
    await page.click("#open-form")
    await expect(page.locator("dialog.modal-dialog[open]")).toBeVisible()

    const iframe = page.frameLocator("dialog.modal-dialog iframe")
    await iframe.locator("#first_name").fill("Taro")
    await iframe.locator("#last_name").fill("Yamada")
    await iframe.locator("button[type=submit]").click()

    await expect(page.locator("dialog.modal-dialog")).toHaveCount(0)
    await expect(page.locator("h1")).toHaveText("Form Submitted")
    await expect(page.locator("#result")).toContainText("Taro")
    await expect(page.locator("#result")).toContainText("Yamada")
  })

  test("form validation errors keep modal open", async ({ page }) => {
    await page.goto("/")
    await page.click("#open-form")
    await expect(page.locator("dialog.modal-dialog[open]")).toBeVisible()

    const iframe = page.frameLocator("dialog.modal-dialog iframe")
    await iframe.locator("button[type=submit]").click()

    // Modal stays open; iframe re-renders the form
    await expect(page.locator("dialog.modal-dialog[open]")).toBeVisible()
    await expect(iframe.locator("form")).toBeVisible()
  })
})
