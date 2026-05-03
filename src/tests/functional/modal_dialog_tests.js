import { test, expect } from "@playwright/test"

test.describe("modal dialog", () => {
  test("clicking a modal link opens a dialog with iframe", async ({ page }) => {
    await page.goto("/")
    await page.click("#open-modal")

    await expect(page.locator("dialog.modal-dialog[open]")).toBeVisible()
    await expect(page.locator("dialog.modal-dialog iframe")).toBeAttached()
  })

  test("closing the dialog removes it from the DOM", async ({ page }) => {
    await page.goto("/")
    await page.click("#open-modal")
    await expect(page.locator("dialog.modal-dialog[open]")).toBeVisible()

    await page.click(".modal-dialog__close-button")

    await expect(page.locator("dialog.modal-dialog")).toHaveCount(0)
  })

  test("reopening a modal after closing works", async ({ page }) => {
    await page.goto("/")
    await page.click("#open-modal")
    await expect(page.locator("dialog.modal-dialog[open]")).toBeVisible()

    await page.click(".modal-dialog__close-button")
    await expect(page.locator("dialog.modal-dialog")).toHaveCount(0)

    await page.click("#open-modal")
    await expect(page.locator("dialog.modal-dialog[open]")).toBeVisible()
  })

  test("modal_style large is applied by default", async ({ page }) => {
    await page.goto("/")
    await page.click("#open-modal")

    await expect(page.locator("dialog.modal-dialog.modal-dialog--large[open]")).toBeVisible()
  })

  test("/new pattern modal uses form_sheet style", async ({ page }) => {
    await page.goto("/")
    await page.click("#open-form")

    await expect(page.locator("dialog.modal-dialog.modal-dialog--form_sheet[open]")).toBeVisible()
  })

  test("modal header shows page title from iframe", async ({ page }) => {
    await page.goto("/")
    await page.click("#open-modal")

    await expect(page.locator(".modal-dialog__title")).toHaveText("Modal Navigation")
  })
})
