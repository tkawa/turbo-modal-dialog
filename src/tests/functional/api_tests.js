import { test, expect } from "@playwright/test"

test.describe("TurboIframe programmatic API", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
  })

  test("matchesUrl returns properties for matching modal URL", async ({ page }) => {
    const result = await page.evaluate(() =>
      window.TurboIframe.matchesUrl(new URL("/modals/first", location.href).href)
    )
    expect(result).toMatchObject({ context: "modal" })
  })

  test("matchesUrl returns null for non-matching URL", async ({ page }) => {
    const result = await page.evaluate(() =>
      window.TurboIframe.matchesUrl(new URL("/non-modal", location.href).href)
    )
    expect(result).toBeNull()
  })

  test("isPresented reflects current state", async ({ page }) => {
    expect(await page.evaluate(() => window.TurboIframe.isPresented)).toBe(false)

    await page.click("#open-modal")
    await expect(page.locator("dialog.turbo-modal-dialog__dialog[open]")).toBeVisible()
    expect(await page.evaluate(() => window.TurboIframe.isPresented)).toBe(true)

    await page.click(".turbo-modal-dialog__close-button")
    await expect(page.locator("dialog.turbo-modal-dialog__dialog")).toHaveCount(0)
    expect(await page.evaluate(() => window.TurboIframe.isPresented)).toBe(false)
  })

  test("canGoBack reflects modal stack depth", async ({ page }) => {
    await page.click("#open-modal")
    await expect(page.locator("dialog.turbo-modal-dialog__dialog[open]")).toBeVisible()
    expect(await page.evaluate(() => window.TurboIframe.canGoBack)).toBe(false)

    const iframe = page.frameLocator("dialog.turbo-modal-dialog__dialog iframe")
    await iframe.locator("#modal-to-modal").click()
    await expect(page).toHaveURL("/modals/second")
    expect(await page.evaluate(() => window.TurboIframe.canGoBack)).toBe(true)
  })

  test("dismiss() programmatically closes the modal", async ({ page }) => {
    await page.click("#open-modal")
    await expect(page.locator("dialog.turbo-modal-dialog__dialog[open]")).toBeVisible()

    await page.evaluate(() => window.TurboIframe.dismiss("/non-modal"))
    await expect(page.locator("dialog.turbo-modal-dialog__dialog")).toHaveCount(0)
  })

  test("dismissAndVisit() closes the modal and navigates the parent", async ({ page }) => {
    await page.click("#open-modal")
    await expect(page.locator("dialog.turbo-modal-dialog__dialog[open]")).toBeVisible()

    await page.evaluate(() => window.TurboIframe.dismissAndVisit("/non-modal"))
    await expect(page.locator("dialog.turbo-modal-dialog__dialog")).toHaveCount(0)
    await expect(page).toHaveURL("/non-modal")
  })

  test("navigateModal() pushes onto the stack and updates the parent URL", async ({ page }) => {
    await page.click("#open-modal")
    await expect(page.locator("dialog.turbo-modal-dialog__dialog[open]")).toBeVisible()

    await page.evaluate(() =>
      window.TurboIframe.navigateModal(new URL("/modals/second", location.href).href)
    )
    await expect(page).toHaveURL("/modals/second")
    expect(await page.evaluate(() => window.TurboIframe.canGoBack)).toBe(true)
  })

  test("back() pops the modal stack and updates the parent URL", async ({ page }) => {
    await page.click("#open-modal")
    const iframe = page.frameLocator("dialog.turbo-modal-dialog__dialog iframe")
    await iframe.locator("#modal-to-modal").click()
    await expect(page).toHaveURL("/modals/second")

    await page.evaluate(() => window.TurboIframe.back())
    await expect(page).toHaveURL("/modals/first")
    expect(await page.evaluate(() => window.TurboIframe.canGoBack)).toBe(false)
  })

  test("back() is a no-op at depth 1", async ({ page }) => {
    await page.click("#open-modal")
    await expect(page).toHaveURL("/modals/first")

    await page.evaluate(() => window.TurboIframe.back())
    await expect(page).toHaveURL("/modals/first")
    await expect(page.locator("dialog.turbo-modal-dialog__dialog[open]")).toBeVisible()
  })
})
