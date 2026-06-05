import fp from 'fastify-plugin'
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fastifyJwt from '@fastify/jwt'
import { JwtPayload } from '@collab-notes/types'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
  interface FastifyRequest {
    user: JwtPayload
  }
}

const plugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyJwt, {
    secret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production-min32chars',
    sign: { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' },
  })

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid or expired token' })
    }
  })
}

export const jwtPlugin = fp(plugin, { name: 'jwt' })
