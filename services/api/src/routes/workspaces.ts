import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireRole } from '../plugins/rbac.js'
import { Role } from '@collab-notes/types'

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
})

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
})

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'editor', 'viewer']),
})

export const workspaceRoutes: FastifyPluginAsync = async (fastify) => {
  // All workspace routes require auth
  fastify.addHook('preHandler', fastify.authenticate)

  // POST /workspaces — create workspace
  fastify.post('/', async (request, reply) => {
    const body = createWorkspaceSchema.parse(request.body)
    const userId = request.clerkUserId

    const existing = await fastify.prisma.workspace.findUnique({ where: { slug: body.slug } })
    if (existing) {
      return reply.code(409).send({ statusCode: 409, error: 'Conflict', message: 'Slug already taken' })
    }

    const workspace = await fastify.prisma.workspace.create({
      data: {
        name: body.name,
        slug: body.slug,
        members: {
          create: { userId, role: 'owner' },
        },
      },
    })
    return reply.code(201).send(workspace)
  })

  // GET /workspaces — list user's workspaces
  fastify.get('/', async (request) => {
    const memberships = await fastify.prisma.workspaceMember.findMany({
      where: { userId: request.clerkUserId },
      include: { workspace: true },
      orderBy: { joinedAt: 'desc' },
    })
    return memberships.map((m) => ({ ...m.workspace, role: m.role }))
  })

  // GET /workspaces/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const member = await fastify.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: request.params.id, userId: request.clerkUserId } },
      include: { workspace: { include: { members: { include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } } } } } },
    })
    if (!member) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Workspace not found' })
    return reply.send({ ...member.workspace, role: member.role })
  })

  // PATCH /workspaces/:id
  fastify.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole('admin')] },
    async (request, reply) => {
      const body = updateWorkspaceSchema.parse(request.body)
      const workspace = await fastify.prisma.workspace.update({
        where: { id: request.params.id },
        data: body,
      })
      return reply.send(workspace)
    },
  )

  // POST /workspaces/:id/members — invite
  fastify.post<{ Params: { id: string } }>(
    '/:id/members',
    { preHandler: [requireRole('admin')] },
    async (request, reply) => {
      const body = inviteMemberSchema.parse(request.body)

      const user = await fastify.prisma.user.findUnique({ where: { email: body.email } })
      if (!user) {
        return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found. They must sign in at least once first.' })
      }

      const existing = await fastify.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: request.params.id, userId: user.id } },
      })
      if (existing) {
        return reply.code(409).send({ statusCode: 409, error: 'Conflict', message: 'Already a member' })
      }

      const member = await fastify.prisma.workspaceMember.create({
        data: {
          workspaceId: request.params.id,
          userId: user.id,
          role: body.role,
          invitedById: request.clerkUserId,
        },
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
      })
      return reply.code(201).send(member)
    },
  )

  // PATCH /workspaces/:id/members/:userId — change role
  fastify.patch<{ Params: { id: string; userId: string } }>(
    '/:id/members/:userId',
    { preHandler: [requireRole('admin')] },
    async (request, reply) => {
      const { role } = z.object({ role: z.enum(['admin', 'editor', 'viewer']) }).parse(request.body)
      const member = await fastify.prisma.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId: request.params.id, userId: request.params.userId } },
        data: { role },
      })
      return reply.send(member)
    },
  )

  // DELETE /workspaces/:id/members/:userId — remove member
  fastify.delete<{ Params: { id: string; userId: string } }>(
    '/:id/members/:userId',
    { preHandler: [requireRole('admin')] },
    async (request, reply) => {
      await fastify.prisma.workspaceMember.delete({
        where: { workspaceId_userId: { workspaceId: request.params.id, userId: request.params.userId } },
      })
      return reply.code(204).send()
    },
  )

  // GET /workspaces/:wsId/notes
  fastify.get<{ Params: { wsId: string }; Querystring: { folderId?: string; search?: string; cursor?: string } }>(
    '/:wsId/notes',
    async (request, reply) => {
      const { wsId } = request.params
      const { folderId, search, cursor } = request.query

      const member = await fastify.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: wsId, userId: request.clerkUserId } },
      })
      if (!member) return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Not a member' })

      const where: Record<string, unknown> = { workspaceId: wsId, isDeleted: false }
      if (folderId) where.folderId = folderId === 'root' ? null : folderId
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { contentText: { contains: search, mode: 'insensitive' } },
        ]
      }
      if (cursor) where.id = { lt: cursor }

      const notes = await fastify.prisma.note.findMany({
        where: where as Parameters<typeof fastify.prisma.note.findMany>[0]['where'],
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          id: true, workspaceId: true, folderId: true, title: true,
          ydocVersion: true, isDeleted: true, createdById: true,
          lastEditedById: true, createdAt: true, updatedAt: true,
        },
      })
      return reply.send({ items: notes, cursor: notes.length === 20 ? notes[19]?.id : null })
    },
  )

  // POST /workspaces/:wsId/notes
  fastify.post<{ Params: { wsId: string } }>(
    '/:wsId/notes',
    async (request, reply) => {
      const { wsId } = request.params
      const userId = request.clerkUserId

      const member = await fastify.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: wsId, userId } },
      })
      if (!member || (member.role as Role) === 'viewer') {
        return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Cannot create notes' })
      }

      const body = z.object({
        title: z.string().default('Untitled'),
        folderId: z.string().optional(),
      }).parse(request.body)

      const note = await fastify.prisma.note.create({
        data: { workspaceId: wsId, createdById: userId, ...body },
      })
      return reply.code(201).send(note)
    },
  )

  // GET /workspaces/:wsId/folders
  fastify.get<{ Params: { wsId: string } }>('/:wsId/folders', async (request, reply) => {
    const member = await fastify.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: request.params.wsId, userId: request.clerkUserId } },
    })
    if (!member) return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Not a member' })

    const folders = await fastify.prisma.folder.findMany({
      where: { workspaceId: request.params.wsId },
      orderBy: { name: 'asc' },
    })
    return reply.send(folders)
  })

  // POST /workspaces/:wsId/folders
  fastify.post<{ Params: { wsId: string } }>('/:wsId/folders', async (request, reply) => {
    const body = z.object({ name: z.string().min(1), parentId: z.string().optional() }).parse(request.body)
    const userId = request.clerkUserId

    const member = await fastify.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: request.params.wsId, userId } },
    })
    if (!member || (member.role as Role) === 'viewer') {
      return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Cannot create folders' })
    }
    const folder = await fastify.prisma.folder.create({
      data: { workspaceId: request.params.wsId, name: body.name, parentId: body.parentId, createdById: userId },
    })
    return reply.code(201).send(folder)
  })
}
