import {
  getTags as getTagsService,
  createTag as createTagService,
  updateTag as updateTagService,
  deleteTag as deleteTagService,
  type TagInput,
} from '../services/tagService'

export function getTags() {
  return getTagsService()
}

export function createTag(input: TagInput) {
  return createTagService(input)
}

export function updateTag(id: string, input: TagInput) {
  return updateTagService(id, input)
}

export function deleteTag(id: string) {
  return deleteTagService(id)
}

export type { TagInput }
