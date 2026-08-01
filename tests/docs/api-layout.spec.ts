import { test, expect } from '@playwright/test'

test('function overload parameter and return cards share a row', async ({ page }) => {
  await page.goto('/api/generated/functions/computeSkinHash')

  const members = page.locator(
    '.vp-doc[class*="_api_generated_functions_"] > div:has(> .api-member) > .api-member',
  )
  await expect(members).toHaveCount(4)

  const boxes = await members.evaluateAll(elements => elements.map(element => {
    const { x, y, width, height } = element.getBoundingClientRect()
    return { x, y, width, height }
  }))

  expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(1)
  expect(boxes[1].x).toBeGreaterThan(boxes[0].x)
  expect(boxes[1].width).toBeLessThan(boxes[0].width / 2)
  expect(Math.abs(boxes[2].y - boxes[3].y)).toBeLessThan(1)
  expect(boxes[3].x).toBeGreaterThan(boxes[2].x)
  expect(boxes[3].width).toBeLessThan(boxes[2].width / 2)
})

test('single-signature function sections share a dynamic row', async ({ page }) => {
  await page.goto('/api/generated/functions/createFileRef')

  const wrapper = page.locator(
    '.vp-doc[class*="_api_generated_functions_"] > div:has(> h2[id^="parameters"]):not(:has(> .api-member))',
  )
  await expect(wrapper).toHaveCount(1)

  const boxes = await wrapper.evaluate(element => {
    const parameters = element.querySelector(':scope > h2#parameters')
    const table = parameters?.nextElementSibling
    const returns = element.querySelector(':scope > h2#returns')
    const returnValue = returns?.nextElementSibling

    return [parameters, table, returns, returnValue].map(node => {
      const { x, y, width, height } = node?.getBoundingClientRect() ?? {}
      return { x: x ?? 0, y: y ?? 0, width: width ?? 0, height: height ?? 0 }
    })
  })

  expect(Math.abs(boxes[0].y - boxes[2].y)).toBeLessThan(1)
  expect(Math.abs(boxes[1].y - boxes[3].y)).toBeLessThan(1)
  expect(boxes[3].width).toBeLessThan(boxes[1].width / 2)
})

test('object return members put titles above their values', async ({ page }) => {
  await page.goto('/api/generated/functions/parseOsb')

  const members = page.locator(
    '.vp-doc[class*="_api_generated_functions_"] > div:has(> h2[id^="returns"]) > h2[id^="returns"] ~ .api-member',
  )
  await expect(members).toHaveCount(2)

  const boxes = await members.evaluateAll(elements => elements.map(element => {
    const title = element.querySelector(':scope > h3')?.getBoundingClientRect()
    const value = element.querySelector(':scope > h3 + blockquote')?.getBoundingClientRect()
    return {
      titleX: title?.x ?? 0,
      titleY: title?.y ?? 0,
      valueX: value?.x ?? 0,
      valueY: value?.y ?? 0,
    }
  }))

  for (const box of boxes) {
    expect(Math.abs(box.titleX - box.valueX)).toBeLessThan(1)
    expect(box.titleY).toBeLessThan(box.valueY)
  }
})
