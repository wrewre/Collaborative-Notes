import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import Redis from 'ioredis'

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis
  }
}

const plugin: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  })

  redis.on('error', (err) => fastify.log.error({ err }, 'Redis error'))
  redis.on('connect', () => fastify.log.info('Redis connected'))

  fastify.decorate('redis', redis)

  fastify.addHook('onClose', async () => {
    await redis.quit()
  })
}

export const redisPlugin = fp(plugin, { name: 'redis' })
