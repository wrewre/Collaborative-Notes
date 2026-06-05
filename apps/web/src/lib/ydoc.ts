import * as Y from 'yjs'

// Cache of open Y.Doc instances to avoid duplication per note
const docCache = new Map<string, Y.Doc>()

export function getYDoc(noteId: string): Y.Doc {
  if (docCache.has(noteId)) return docCache.get(noteId)!

  const ydoc = new Y.Doc()
  docCache.set(noteId, ydoc)

  ydoc.on('destroy', () => {
    docCache.delete(noteId)
  })

  return ydoc
}

export function destroyYDoc(noteId: string): void {
  const doc = docCache.get(noteId)
  if (doc) {
    doc.destroy()
    docCache.delete(noteId)
  }
}
