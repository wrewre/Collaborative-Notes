import Redis from 'ioredis'

type UpdateCallback = (update: Buffer) => void

export class RedisBridge {
  private pub: Redis
  private sub: Redis
  private subscribers = new Map<string, Set<UpdateCallback>>()

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
    this.pub = new Redis(redisUrl)
    this.sub = new Redis(redisUrl)

    this.sub.on('messageBuffer', (channel: Buffer, message: Buffer) => {
      const docName = channel.toString()
      const callbacks = this.subscribers.get(docName)
      callbacks?.forEach((cb) => cb(message))
    })

    this.sub.on('error', (err) => console.error('Redis sub error:', err))
    this.pub.on('error', (err) => console.error('Redis pub error:', err))
  }

  async publish(docName: string, update: Buffer): Promise<void> {
    await this.pub.publishBuffer(`doc:${docName}`, update)
  }

  subscribeDoc(docName: string, callback: UpdateCallback): () => void {
    const channel = `doc:${docName}`

    if (!this.subscribers.has(docName)) {
      this.subscribers.set(docName, new Set())
      this.sub.subscribe(channel)
    }

    this.subscribers.get(docName)!.add(callback)

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(docName)
      if (subs) {
        subs.delete(callback)
        if (subs.size === 0) {
          this.subscribers.delete(docName)
          this.sub.unsubscribe(channel)
        }
      }
    }
  }

  async close(): Promise<void> {
    await this.pub.quit()
    await this.sub.quit()
  }
}
