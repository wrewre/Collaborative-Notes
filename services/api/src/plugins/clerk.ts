import fp from 'fastify-plugin'
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { createClerkClient } from '@clerk/backend'

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    clerkClient: ReturnType<typeof createClerkClient>
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
  interface FastifyRequest {
    clerkUserId: string
    clerkUser: { id: string; email: string; name: string; avatarUrl?: string }
  }
}

const plugin: FastifyPluginAsync = async (fastify) => {
  const clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  })

  fastify.decorate('clerkClient', clerkClient)

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const authHeader = request.headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Missing bearer token' })
      }

      const token = authHeader.slice(7)
      const { sub } = await clerkClient.verifyToken(token)

      if (!sub) {
        return reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid token' })
      }

      // Fetch user details from Clerk
      const clerkUser = await clerkClient.users.getUser(sub)
      const primaryEmail = clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)

      request.clerkUserId = sub
      request.clerkUser = {
        id: sub,
        email: primaryEmail?.emailAddress ?? '',
        name: `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() || 'User',
        avatarUrl: clerkUser.imageUrl ?? undefined,
      }
    } catch (err) {
      return reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid or expired token' })
    }
  })
}

export const clerkPlugin = fp(plugin, { name: 'clerk' })
