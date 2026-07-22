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
  await page.goto('/categorias')
  // The page shows a full-screen "Carregando..." message (no heading) until the
  // PGlite query resolves, so this first assertion needs the seed-boot timeout too.
  await expect(page.getByRole('heading', { name: 'Categorias' })).toBeVisible({ timeout: SEED_TIMEOUT })
})

test('lists the seeded default categories', async ({ page }) => {
  await expect(visibleText(page, 'Alimentação')).toBeVisible({ timeout: SEED_TIMEOUT })
  await expect(visibleText(page, 'Transporte')).toBeVisible()
  await expect(visibleText(page, 'Transferências')).toBeVisible()
})

test('creates a new category with a chosen color and icon', async ({ page }) => {
  await expect(visibleText(page, 'Alimentação')).toBeVisible({ timeout: SEED_TIMEOUT })

  await page.getByRole('button', { name: 'Adicionar Categoria' }).click()
  const submit = page.getByRole('button', { name: 'Salvar' })
  await expect(submit).toBeDisabled()

  await page.getByRole('textbox', { name: 'Nome' }).fill('Assinatura de streaming')
  // Third color swatch and default icon, just to exercise the picker.
  await page.locator('form').getByRole('button').nth(2).click()
  await submit.click()

  await expect(visibleText(page, 'Assinatura de streaming')).toBeVisible()
})

test('creates a subcategory nested under a parent', async ({ page }) => {
  await expect(visibleText(page, 'Casa')).toBeVisible({ timeout: SEED_TIMEOUT })

  await page.getByRole('button', { name: 'Adicionar Categoria' }).click()
  await page.getByRole('textbox', { name: 'Nome' }).fill('Aluguel')
  await page.getByRole('combobox', { name: 'Categoria pai' }).selectOption({ label: 'Casa' })
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect(visibleText(page, 'Aluguel')).toBeVisible()

  // Re-opening the edit form should show "Casa" pre-selected as the parent.
  await page.getByRole('button', { name: 'Editar Aluguel' }).click()
  const parentSelect = page.getByRole('combobox', { name: 'Categoria pai' })
  const selectedLabel = await parentSelect.evaluate((el) => (el as HTMLSelectElement).selectedOptions[0]?.textContent)
  expect(selectedLabel).toBe('Casa')
  await page.getByRole('button', { name: 'Cancelar' }).click()
})

test('edits a category name', async ({ page }) => {
  await expect(visibleText(page, 'Lazer e hobbies')).toBeVisible({ timeout: SEED_TIMEOUT })

  await page.getByRole('button', { name: 'Editar Lazer e hobbies' }).click()
  await page.getByRole('textbox', { name: 'Nome' }).fill('Lazer')
  await page.getByRole('button', { name: 'Salvar' }).click()

  await expect(visibleText(page, 'Lazer', true)).toBeVisible()
  await expect(page.getByText('Lazer e hobbies')).toHaveCount(0)
})

test('blocks deleting a category that still has subcategories', async ({ page }) => {
  await expect(visibleText(page, 'Casa')).toBeVisible({ timeout: SEED_TIMEOUT })

  await page.getByRole('button', { name: 'Adicionar Categoria' }).click()
  await page.getByRole('textbox', { name: 'Nome' }).fill('Condomínio')
  await page.getByRole('combobox', { name: 'Categoria pai' }).selectOption({ label: 'Casa' })
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(visibleText(page, 'Condomínio')).toBeVisible()

  await page.getByRole('button', { name: 'Remover Casa' }).click()
  await page.getByRole('button', { name: 'Remover', exact: true }).click()

  await expect(page.getByText('Remova ou mova as subcategorias antes de excluir esta categoria.')).toBeVisible()
  await expect(visibleText(page, 'Casa', true)).toBeVisible()
})
