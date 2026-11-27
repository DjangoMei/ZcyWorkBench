/**
 * Update only editable fields; keep identity, original capture time and any
 * future metadata intact. Clearing an image detaches it, never deletes its file.
 */
export function applyInspirationEdit(original, draft, updatedAt) {
  return {
    ...original,
    category: draft.category,
    content: draft.content.trim(),
    tag: draft.tag.trim(),
    link: draft.link,
    imagePath: draft.imagePath,
    imageName: draft.imageName,
    updatedAt,
  };
}
