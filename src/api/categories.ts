import {
  getCategories as getCategoriesService,
  createCategory as createCategoryService,
  updateCategory as updateCategoryService,
  deleteCategory as deleteCategoryService,
  type CategoryInput,
} from '../services/categoryService'

export function getCategories() {
  return getCategoriesService()
}

export function createCategory(input: CategoryInput) {
  return createCategoryService(input)
}

export function updateCategory(id: string, input: CategoryInput) {
  return updateCategoryService(id, input)
}

export function deleteCategory(id: string) {
  return deleteCategoryService(id)
}

export type { CategoryInput }
