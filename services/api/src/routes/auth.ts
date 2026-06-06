import { FastifyPluginAsync } from 'fastify'
import { PrismaClient } from '@collab-notes/db'

const prisma = new PrismaClient()

/**
 * Auth Routes
 *
 * With Clerk, we no longer handle login/register manually.
 * We only expose a /sync endpoint that the frontend calls once
 * after a user signs in, to upsert the Clerk user into our
 * PostgreSQL database.
 */
export const authRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /auth/sync
   * Called by the frontend after Clerk sign-in to ensure the user
   * exists in our database with up-to-date profile information.
   */
  app.post('/sync', {
    preHandler: [app.authenticate],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            avatarUrl: { type: 'string', nullable: true },
            createdAt: { type: 'string' },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { id, email, name, avatarUrl } = req.clerkUser

    const user = await prisma.user.upsert({
      where: { id },
      create: { id, email, name, avatarUrl },
      update: { email, name, avatarUrl },
    })

    return reply.send(user)
  })

  /**
   * GET /auth/me
   * Returns the currently authenticated user's profile from our DB.
   */
  app.get('/me', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.clerkUserId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        createdAt: true,
        workspaceMemberships: {
          include: { workspace: true },
        },
      },
    })

    if (!user) {
      return reply.code(404).send({ error: 'User not found. Call /auth/sync first.' })
    }

    return reply.send(user)
  })
}
