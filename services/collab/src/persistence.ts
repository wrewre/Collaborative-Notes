import * as Y from 'yjs'
import Redis from 'ioredis'
import { PrismaClient } from '@collab-notes/db'
import { Queue, Worker } from 'bullmq'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const SNAPSHOT_DEBOUNCE_MS = 30_000
const UPDATES_BEFORE_SNAPSHOT = 500

export class PersistenceManager {
  private redis: Redis
  private prisma: PrismaClient
  private snapshotQueue: Queue
  private snapshotWorker: Worker
  private updateCounts = new Map<string, number>()

  constructor() {
    this.redis = new Redis(REDIS_URL)
    this.prisma = new PrismaClient()

    this.snapshotQueue = new Queue('ydoc-snapshots', {
      connection: { host: new URL(REDIS_URL).hostname, port: parseInt(new URL(REDIS_URL).port || '6379') },
    })

    this.snapshotWorker = new Worker(
      'ydoc-snapshots',
      async (job) => {
        const { noteId, snapshot, contentText } = job.data as {
          noteId: string
          snapshot: number[]
          contentText: string
        }
        await this.writeSnapshotToPostgres(noteId, Buffer.from(snapshot), contentText)
      },
      {
        connection: { host: new URL(REDIS_URL).hostname, port: parseInt(new URL(REDIS_URL).port || '6379') },
        concurrency: 5,
      },
    )

    this.snapshotWorker.on('failed', (job, err) => {
      console.error(`Snapshot job ${job?.id} failed:`, err)
    })
  }

  // Called when a client connects — loads existing state into ydoc
  async bindState(docName: string, ydoc: Y.Doc): Promise<void> {
    const noteId = extractNoteId(docName)
    if (!noteId) return

    // 1. Try Redis first (hot cache)
    const cached = await this.redis.getBuffer(`note:${noteId}:ydoc`)
    if (cached) {
      Y.applyUpdate(ydoc, cached)
      return
    }

    // 2. Fall back to Postgres snapshot
    const note = await this.prisma.note.findUnique({
      where: { id: noteId },
      select: { ydocSnapshot: true },
    })

    if (note?.ydocSnapshot) {
      const snapshot = Buffer.from(note.ydocSnapshot)
      Y.applyUpdate(ydoc, snapshot)
      // Re-cache in Redis
      await this.redis.setex(`note:${noteId}:ydoc`, 24 * 60 * 60, snapshot)
    }

    // Observe future updates and cache them
    ydoc.on('update', async (update: Uint8Array) => {
      await this.handleUpdate(noteId, ydoc, update)
    })
  }

  // Called when y-websocket writes state (on connection close / interval)
  async writeState(docName: string, ydoc: Y.Doc): Promise<void> {
    const noteId = extractNoteId(docName)
    if (!noteId) return

    const snapshot = Y.encodeStateAsUpdate(ydoc)
    await this.redis.setex(`note:${noteId}:ydoc`, 24 * 60 * 60, Buffer.from(snapshot))
    await this.queueSnapshot(noteId, snapshot, ydoc)
  }

  private async handleUpdate(noteId: string, ydoc: Y.Doc, _update: Uint8Array): Promise<void> {
    // Update Redis cache with latest full state
    const snapshot = Y.encodeStateAsUpdate(ydoc)
    await this.redis.setex(`note:${noteId}:ydoc`, 24 * 60 * 60, Buffer.from(snapshot))

    // Count updates and trigger snapshot when threshold reached
    const count = (this.updateCounts.get(noteId) || 0) + 1
    this.updateCounts.set(noteId, count)

    if (count >= UPDATES_BEFORE_SNAPSHOT) {
      this.updateCounts.set(noteId, 0)
      await this.queueSnapshot(noteId, snapshot, ydoc)
    }
  }

  private async queueSnapshot(noteId: string, snapshot: Uint8Array, ydoc: Y.Doc): Promise<void> {
    // Extract plain text from Yjs doc for search indexing
    const contentText = extractText(ydoc)

    await this.snapshotQueue.add(
      'snapshot',
      { noteId, snapshot: Array.from(snapshot), contentText },
      {
        jobId: `snapshot-${noteId}`, // deduplicates concurrent jobs
        delay: SNAPSHOT_DEBOUNCE_MS,
        removeOnComplete: true,
        removeOnFail: 50,
      },
    )
  }

  private async writeSnapshotToPostgres(noteId: string, snapshot: Buffer, contentText: string): Promise<void> {
    await this.prisma.note.updateMany({
      where: { id: noteId, isDeleted: false },
      data: {
        ydocSnapshot: snapshot,
        contentText,
        ydocVersion: { increment: 1 },
        updatedAt: new Date(),
      },
    })
    console.log(`📸 Snapshot written to Postgres for note ${noteId}`)
  }

  async close(): Promise<void> {
    await this.snapshotQueue.close()
    await this.snapshotWorker.close()
    await this.redis.quit()
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
