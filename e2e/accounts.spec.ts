import { test, expect, type Page } from '@playwright/test'

// PGlite boots fresh (wasm init + migrate + seed) on first load in each isolated
// browser context, so the initial paint can take a few seconds — longer than Playwright's default.
const SEED_TIMEOUT = 15_000

// The layout renders both a mobile and a desktop tree simultaneously (one hidden via
// Tailwind responsive classes, not unmounted), so plain text can match twice in the DOM.
// getByRole locators are unaffected (hidden elements have no accessible role), but any
// getByText() check needs this to land on the one actually on screen.
function visibleText(page: Page, text: string, exact = false) {
  return page.getByText(text, { exact }).filter({ visible: true })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/contas')
  // The page shows a full-screen "Carregando..." message (no heading) until the
  // PGlite query resolves, so this first assertion needs the seed-boot timeout too.
  await expect(page.getByRole('heading', { name: 'Contas' })).toBeVisible({ timeout: SEED_TIMEOUT })
})

test('lists the seeded accounts', async ({ page }) => {
  await expect(visibleText(page, 'Conta Pessoal')).toBeVisible({ timeout: SEED_TIMEOUT })
  await expect(visibleText(page, 'Conta da Empresa')).toBeVisible()
  await expect(visibleText(page, 'Padrão')).toBeVisible()
})

test('creates a new account', async ({ page }) => {
  await expect(visibleText(page, 'Conta Pessoal')).toBeVisible({ timeout: SEED_TIMEOUT })

  await page.getByRole('button', { name: 'Adicionar Conta' }).click()
  const submit = page.getByRole('button', { name: 'Salvar' })
  await expect(submit).toBeDisabled()

  await page.getByRole('textbox', { name: 'Nome' }).fill('Conta Viagem')
  await page.getByRole('textbox', { name: 'Saldo inicial' }).fill('500')
  await submit.click()

  await expect(visibleText(page, 'Conta Viagem')).toBeVisible()
  await expect(visibleText(page, 'R$ 500,00')).toBeVisible()
})

test('edits an account', async ({ page }) => {
  await expect(visibleText(page, 'Conta da Empresa')).toBeVisible({ timeout: SEED_TIMEOUT })

  await page.getByRole('button', { name: 'Editar Conta da Empresa' }).click()
  await page.getByRole('textbox', { name: 'Nome' }).fill('Conta da Empresa Ltda')
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect(visibleText(page, 'Conta da Empresa Ltda')).toBeVisible()
  await expect(page.getByText('Conta da Empresa', { exact: true })).toHaveCount(0)
})

test('deletes an account after confirming', async ({ page }) => {
  await expect(visibleText(page, 'Conta Pessoal')).toBeVisible({ timeout: SEED_TIMEOUT })

  await page.getByRole('button', { name: 'Adicionar Conta' }).click()
  await page.getByRole('textbox', { name: 'Nome' }).fill('Conta Descartável')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(visibleText(page, 'Conta Descartável')).toBeVisible()

  await page.getByRole('button', { name: 'Remover Conta Descartável' }).click()
  await expect(page.getByRole('heading', { name: 'Remover conta' })).toBeVisible()
  await page.getByRole('button', { name: 'Remover', exact: true }).click()

  await expect(page.getByText('Conta Descartável')).toHaveCount(0)
})
