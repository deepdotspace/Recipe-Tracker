import { test, expect } from '@playwright/test'
import { captureConsoleErrors } from './helpers/errors'

/**
 * Wait for the React app to mount. The app shows either:
 * - "Loading..." while auth initializes
 * - The navigation bar once ready
 */
async function waitForApp(page: import('@playwright/test').Page) {
  await page.waitForSelector('[data-testid="app-navigation"]', { timeout: 15000 })
}

test.describe('Smoke tests', () => {
  test('landing page renders at / without app chrome', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Every recipe you love, in one tidy place.' })).toBeVisible()
    // The landing page owns the viewport — no global navigation bar.
    await expect(page.getByTestId('app-navigation')).toHaveCount(0)
    expect(errors).toEqual([])
  })

  test('app loads without JS errors', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/add')
    await waitForApp(page)
    expect(errors).toEqual([])
  })

  test('navigation is visible', async ({ page }) => {
    await page.goto('/add')
    await waitForApp(page)
    await expect(page.getByTestId('app-navigation')).toBeVisible()
  })

  test('sign-in button visible when logged out', async ({ page }) => {
    await page.goto('/add')
    await waitForApp(page)
    await expect(page.getByTestId('nav-sign-in-button')).toBeVisible()
    await expect(page.getByTestId('nav-user-name')).toHaveCount(0)
  })

  test('unknown route shows 404', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz')
    await waitForApp(page)
    await expect(page.locator('text=404')).toBeVisible()
  })
})
