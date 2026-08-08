import { test, expect } from '@playwright/test'

test('guide previews link to their exact GitHub source lines', async ({ page }) => {
  await page.goto('/guide/examples/replays')
  const preview = page.locator('.guide-source').first()
  const link = preview.getByRole('link', { name: 'View these lines on GitHub' })
  const copy = preview.locator('button.copy')

  await expect(preview.locator('.language-js.vp-adaptive-theme')).toBeVisible()
  await expect(link).toHaveAttribute('href', /\/blob\/[0-9a-f]{40}\/examples\/import-osr\/index\.js#L\d+-L\d+$/)
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveText('View source')
  await expect(link).toHaveCSS('opacity', '0')
  await expect(copy).toHaveCSS('opacity', '0')
  await preview.hover()
  await expect(link).toHaveCSS('opacity', '1')
  await expect(copy).toHaveCSS('opacity', '1')

  const sourceBox = await link.boundingBox()
  const copyBox = await copy.boundingBox()
  expect(sourceBox).not.toBeNull()
  expect(copyBox).not.toBeNull()
  expect(Math.abs(sourceBox!.x + sourceBox!.width - copyBox!.x)).toBeLessThanOrEqual(1.5)
  expect(Math.abs(sourceBox!.y - copyBox!.y)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(sourceBox!.height - copyBox!.height)).toBeLessThanOrEqual(0.5)
})
