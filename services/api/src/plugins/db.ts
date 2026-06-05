import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { PrismaClient } from '@collab-notes/db'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
  }
}

const plugin: FastifyPluginAsync = async (fastify) => {
  const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

  await prisma.$connect()
  fastify.decorate('prisma', prisma)

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect()
  })
}

export const dbPlugin = fp(plugin, { name: 'prisma' })
