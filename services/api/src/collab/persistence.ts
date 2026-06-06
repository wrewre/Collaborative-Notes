import * as Y from 'yjs'
import { PrismaClient } from '@collab-notes/db'

const SNAPSHOT_DEBOUNCE_MS = 10_000

export class PersistenceManager {
  private prisma: PrismaClient
  private saveTimeouts = new Map<string, NodeJS.Timeout>()

  constructor() {
    this.prisma = new PrismaClient()
  }

  async bindState(docName: string, ydoc: Y.Doc): Promise<void> {
    const noteId = extractNoteId(docName)
    if (!noteId) return

    // Fall back to Postgres snapshot
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
      select: { ydocSnapshot: true },
    })

    if (note?.ydocSnapshot) {
      const snapshot = Buffer.from(note.ydocSnapshot)
      Y.applyUpdate(ydoc, snapshot)
    }

    // Observe future updates and debounce save
    ydoc.on('update', (_update: Uint8Array) => {
      this.scheduleSave(noteId, ydoc)
    })
  }

  async writeState(docName: string, ydoc: Y.Doc): Promise<void> {
    const noteId = extractNoteId(docName)
    if (!noteId) return
    await this.performSave(noteId, ydoc)
  }

  private scheduleSave(noteId: string, ydoc: Y.Doc): void {
    if (this.saveTimeouts.has(noteId)) {
      clearTimeout(this.saveTimeouts.get(noteId)!)
    }

    const timeout = setTimeout(() => {
      this.performSave(noteId, ydoc).catch(err => {
        console.error(`Failed to save note ${noteId}:`, err)
      })
      this.saveTimeouts.delete(noteId)
    }, SNAPSHOT_DEBOUNCE_MS)

    this.saveTimeouts.set(noteId, timeout)
  }

  private async performSave(noteId: string, ydoc: Y.Doc): Promise<void> {
    const snapshot = Y.encodeStateAsUpdate(ydoc)
    const contentText = extractText(ydoc)

    await this.prisma.note.updateMany({
      where: { id: noteId, isDeleted: false },
      data: {
        ydocSnapshot: Buffer.from(snapshot),
        contentText,
        ydocVersion: { increment: 1 },
        updatedAt: new Date(),
      },
    })
    console.log(`📸 Snapshot written to Postgres for note ${noteId}`)
  }

  async close(): Promise<void> {
    for (const timeout of this.saveTimeouts.values()) {
      clearTimeout(timeout)
    }
    await this.prisma.$disconnect()
  }
}

function extractNoteId(docName: string): string | null {
  // docName format: "doc-{noteId}"
  const match = docName.match(/^doc-(.+)$/)
  return match ? match[1] : null
}

function extractText(ydoc: Y.Doc): string {
  try {
    // TipTap stores content in 'default' XmlFragment
    const content = ydoc.get('default', Y.XmlFragment)
    return content.toString().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  } catch {
    return ''
  }
}

export const persistenceManager = new PersistenceManager()
