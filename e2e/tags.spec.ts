import { test, expect, type Page } from '@playwright/test'

const SEED_TIMEOUT = 15_000

// The layout renders both a mobile and a desktop tree simultaneously (one hidden via
// Tailwind responsive classes, not unmounted), so plain text can match twice in the DOM.
// getByRole locators are unaffected (hidden elements have no accessible role), but any
// getByText() check needs this to land on the one actually on screen.
function visibleText(page: Page, text: string, exact = false) {
  return page.getByText(text, { exact }).filter({ visible: true })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/tags')
  // The page shows a full-screen "Carregando..." message (no heading) until the
  // PGlite query resolves, so this first assertion needs the seed-boot timeout too.
  await expect(page.getByRole('heading', { name: 'Tags' })).toBeVisible({ timeout: SEED_TIMEOUT })
})

test('lists the seeded default tags', async ({ page }) => {
  await expect(visibleText(page, 'Pessoal')).toBeVisible({ timeout: SEED_TIMEOUT })
  await expect(visibleText(page, 'Empresa')).toBeVisible()
  await expect(visibleText(page, 'Custo Fixo')).toBeVisible()
})

test('creates a new tag', async ({ page }) => {
  await expect(visibleText(page, 'Pessoal')).toBeVisible({ timeout: SEED_TIMEOUT })

  await page.getByRole('button', { name: 'Adicionar Tag' }).click()
  const submit = page.getByRole('button', { name: 'Salvar' })
  await expect(submit).toBeDisabled()

  await page.getByRole('textbox', { name: 'Nome' }).fill('Reembolsável')
  await submit.click()

  await expect(visibleText(page, 'Reembolsável')).toBeVisible()
})

test('edits a tag', async ({ page }) => {
  await expect(visibleText(page, 'Custo Variável')).toBeVisible({ timeout: SEED_TIMEOUT })

  await page.getByRole('button', { name: 'Editar Custo Variável' }).click()
  // The row only hides its subtitle when description === title, so update both —
  // otherwise the old title legitimately reappears as the now-differing subtitle.
  await page.getByRole('textbox', { name: 'Nome' }).fill('Custo Variável Mensal')
  await page.getByRole('textbox', { name: 'Descrição' }).fill('Custo Variável Mensal')
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect(visibleText(page, 'Custo Variável Mensal')).toBeVisible()
  await expect(page.getByText('Custo Variável', { exact: true })).toHaveCount(0)
})

test('deletes a tag after confirming', async ({ page }) => {
  await expect(visibleText(page, 'Pessoal')).toBeVisible({ timeout: SEED_TIMEOUT })

  await page.getByRole('button', { name: 'Adicionar Tag' }).click()
  await page.getByRole('textbox', { name: 'Nome' }).fill('Tag Descartável')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(visibleText(page, 'Tag Descartável')).toBeVisible()

  await page.getByRole('button', { name: 'Remover Tag Descartável' }).click()
  await expect(page.getByRole('heading', { name: 'Remover tag' })).toBeVisible()
  await page.getByRole('button', { name: 'Remover', exact: true }).click()

  await expect(page.getByText('Tag Descartável')).toHaveCount(0)
})
