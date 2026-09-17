import { test, expect } from '@playwright/test'

test('API outlines show useful sections and members without signature details', async ({ page }) => {
  await page.goto('/api/generated/classes/Storyboard')

  const outline = page.locator('.VPDocAsideOutline')
  await expect(outline).toHaveClass(/has-outline/)

  const labels = (await outline.locator('.outline-link').allTextContents()).map(text => text.trim())
  expect(labels).toEqual([
    'Constructors',
    'Properties',
    'backgroundOffset',
    'layers',
    'useSkinSprites',
    'variables',
    'Accessors',
    'earliestEventTime',
    'hasDrawable',
    'latestEventTime',
    'Methods',
    'clearLayers()',
    'getLayer()',
    'hasLayer()',
    'removeLayer()',
    'renameLayer()',
  ])
  expect(labels).not.toEqual(expect.arrayContaining(['Constructor', 'Returns', 'Parameters', 'Get Signature', 'Set Signature', 'x', 'y']))

  const hrefs = await outline.locator('.outline-link').evaluateAll(elements => elements.map(element => (element as HTMLAnchorElement).getAttribute('href')!))
  for (const href of hrefs) await expect(page.locator(href)).toHaveCount(1)

  const memberHeadings = page.locator('h3.api-outline-member')
  await expect(memberHeadings).not.toHaveCount(0)
  await expect(memberHeadings.first()).not.toHaveCSS('display', 'none')
  await expect(memberHeadings.first()).toHaveCSS('position', 'absolute')
})

test('function and structural type outlines omit parameter and return details', async ({ page }) => {
  await page.goto('/api/generated/functions/parseOsu')
  await expect(page.locator('.VPDocAsideOutline')).toHaveClass(/has-outline/)
  let labels = (await page.locator('.VPDocAsideOutline .outline-link').allTextContents()).map(text => text.trim())
  expect(labels).toEqual(['Call Signature'])
  expect(labels).not.toEqual(expect.arrayContaining(['Parameters', 'Returns']))

  await page.goto('/api/generated/type-aliases/OsuMetadata')
  await expect(page.locator('.VPDocAsideOutline')).toHaveClass(/has-outline/)
  labels = (await page.locator('.VPDocAsideOutline .outline-link').allTextContents()).map(text => text.trim())
  expect(labels).toEqual(expect.arrayContaining(['Properties', 'artist', 'title']))
  expect(labels).not.toEqual(expect.arrayContaining(['Parameters', 'Returns']))
})

test('function pages render call-signature cards', async ({ page }) => {
  for (const slug of ['createFileRef', 'computeSkinHash']) {
    await page.goto(`/api/generated/functions/${slug}`)

    const wrapper = page.locator(
      '.vp-doc[class*="_api_generated_functions_"] > div:has(> .api-member)',
    )
    await expect(wrapper).toHaveCount(1)

    const callSignature = wrapper.locator(':scope > h2[id^="call-signature"]')
    await expect(callSignature).not.toHaveCount(0)
    await expect(callSignature.first()).toHaveText(/Call Signature/)

    await expect(wrapper.locator(':scope > .api-member')).not.toHaveCount(0)
  }
})

test('parameters and returns cards share a row', async ({ page }) => {
  await page.goto('/api/generated/functions/createFileRef')

  const wrapper = page.locator(
    '.vp-doc[class*="_api_generated_functions_"] > div:has(> .api-member)',
  )
  const parameters = wrapper.locator(':scope > .api-member:has(h3#parameters)')
  const returns = wrapper.locator(':scope > .api-member:has(h3#returns)')
  await expect(parameters).toHaveCount(1)
  await expect(returns).toHaveCount(1)

  const pBox = await parameters.boundingBox()
  const rBox = await returns.boundingBox()
  expect(pBox).not.toBeNull()
  expect(rBox).not.toBeNull()
  expect(Math.abs(pBox!.y - rBox!.y)).toBeLessThan(1)
  expect(rBox!.x).toBeGreaterThan(pBox!.x)
  expect(rBox!.width).toBeLessThan(pBox!.width / 2)
})

test('object return members render as signature-only cards', async ({ page }) => {
  await page.goto('/api/generated/functions/parseOsb')

  const wrapper = page.locator(
    '.vp-doc[class*="_api_generated_functions_"] > div:has(> .api-member)',
  )
  const members = wrapper.locator(':scope > .api-member').filter({ hasNot: page.locator('#api-parseosb-1') })
  await expect(members).toHaveCount(4)

  const strip = (t: string) => t.replace(/\u200b/g, '').trim()
  const sigs = (await members.locator(':scope > h3').allTextContents()).map(strip)
  expect(sigs).toEqual(['Parameters', 'Returns'])

  const objectMembers = await members.evaluateAll(elements => elements.slice(2).map(element => {
    const quote = element.querySelector(':scope > blockquote')?.textContent?.replace(/\u200b/g, '').trim()
    return {
      hasTitle: Boolean(element.querySelector(':scope > h3')),
      quote,
    }
  }))

  expect(objectMembers).toEqual([
    { hasTitle: false, quote: 'storyboard: Storyboard' },
    { hasTitle: false, quote: 'variables: Record<string, string>' },
  ])
})

test('facade pages show readable methods and verified output', async ({ page }) => {
  await page.goto('/api/facades/Collections')

  await expect(page.locator('h1')).toHaveText('Collections')
  await expect(page.locator('h2#byname')).toHaveCount(1)
  await expect(page.locator('.promotable-example')).not.toHaveCount(0)
  await expect(page.locator('.promotable-example__activate').first()).toBeVisible()
  await expect(page.locator('.api-example')).toHaveCount(0)
  await expect(page.locator('.language-ts.vp-adaptive-theme').first()).toBeVisible()
  await expect(page.locator('body')).not.toContainText('CollectionQuery')
  await expect(page.locator('body')).not.toContainText('Iterator<{')
})

test('API result sections can be promoted from previews to runnable examples', async ({ page }) => {
  await page.goto('/api/')

  const example = page.locator('#api-working-with-results').first()
  await expect(example.locator('.language-ts.vp-adaptive-theme')).toBeVisible()
  await expect(example.locator('.promotable-example__activate')).toBeVisible()
  await expect(example.locator('.monaco-editor')).toHaveCount(0)

  await example.locator('.promotable-example__activate').click()
  const runner = page.locator('#api-working-with-results.api-example')
  await expect(runner.locator('.monaco-editor')).toBeVisible({ timeout: 20_000 })
  const run = runner.getByRole('button', { name: 'Run (Ctrl+Enter)' })
  await expect(run).toBeEnabled()
  await run.click()
  const output = runner.locator('[data-json-output]')
  await expect(output).toBeVisible({ timeout: 20_000 })
  await expect(output.locator('[data-json-path="$.maps"]')).toBeVisible()
  await expect(output.locator('[data-json-path="$.first"]')).toBeVisible()
  await expect(output.locator('.output-panel__fallback')).toHaveCount(0)
})

test('generated function examples keep the native preview until activated', async ({ page }) => {
  await page.goto('/api/generated/functions/parseOsu')
  const preview = page.locator('#api-parseosu-1')
  await expect(preview.locator('.language-ts.vp-adaptive-theme')).toBeVisible()
  await expect(preview.locator('.promotable-example__activate')).toBeVisible()
  await expect(page.locator('.monaco-editor')).toHaveCount(0)

  await preview.locator('.promotable-example__activate').click()
  const runner = page.locator('#api-parseosu-1.api-example')
  await expect(runner.locator('.monaco-editor')).toBeVisible({ timeout: 20_000 })
  await expect(runner.locator('.api-example__diagnostics')).toContainText('No problems detected.')
  await expect(runner.locator('[data-json-path="$.title"]')).toHaveText('"title":"Make A Move"')
})

test('Storyboard examples are runnable and isolated on the generated class page', async ({ page }) => {
  await page.goto('/api/generated/classes/Storyboard')
  const preview = page.locator('#api-storyboard-1')
  await expect(preview.locator('.language-ts.vp-adaptive-theme')).toBeVisible()
  await expect(preview.locator('.promotable-example__activate')).toBeVisible()
  await preview.locator('.promotable-example__activate').click()

  const runner = page.locator('#api-storyboard-1.api-example')
  await expect(runner.locator('.monaco-editor')).toBeVisible({ timeout: 20_000 })
  await expect(runner.locator('.api-example__diagnostics')).toContainText('No problems detected.')
  await expect(runner.locator('[data-json-path="$.name"]')).toHaveText('"name":"Foreground"')
})

test('Node-only API examples stay static', async ({ page }) => {
  await page.goto('/api/generated/functions/init')
  await expect(page.locator('.language-ts.vp-adaptive-theme')).toHaveCount(1)
  await expect(page.locator('.promotable-example__activate')).toHaveCount(0)
  await expect(page.locator('.monaco-editor')).toHaveCount(0)
})

test('FileStore examples stay inside the original member card', async ({ page }) => {
  await page.goto('/api/generated/classes/FileStore')

  const member = page.locator('.api-member').filter({ has: page.locator('#api-filestore-begintransaction-1') })
  await expect(member).toHaveCount(1)

  const example = member.locator('#api-filestore-begintransaction-1')
  await expect(example).toHaveCount(1)
  await expect(example.locator('.language-ts.vp-adaptive-theme')).toBeVisible()
  await expect(example.locator('.promotable-example__activate')).toHaveCount(0)
  await expect(example).toContainText('store.beginTransaction()')

  const memberBox = await member.boundingBox()
  const exampleBox = await example.boundingBox()
  expect(memberBox).not.toBeNull()
  expect(exampleBox).not.toBeNull()
  expect(exampleBox!.width).toBeGreaterThan(memberBox!.width * 0.9)
  await expect(page.locator('h3').filter({ hasText: 'FileStore.beginTransaction' })).toHaveCount(0)
})

test('runnable member examples remain activatable inside their API card', async ({ page }) => {
  await page.goto('/api/generated/classes/Storyboard')

  const member = page.locator('.api-member').filter({ has: page.locator('#api-storyboard-getlayer-1') })
  await expect(member).toHaveCount(1)

  const preview = member.locator('#api-storyboard-getlayer-1')
  await expect(preview.locator('.promotable-example__activate')).toBeVisible()
  await preview.locator('.promotable-example__activate').click()

  const runner = member.locator('#api-storyboard-getlayer-1.api-example')
  await expect(runner.locator('.monaco-editor')).toBeVisible({ timeout: 20_000 })
  await expect(runner.locator('.api-example__diagnostics')).toContainText('No problems detected.')
})
