import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

export const commentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  // GET /comments?noteId=
  fastify.get<{ Querystring: { noteId: string } }>('/', async (request, reply) => {
    const { noteId } = z.object({ noteId: z.string() }).parse(request.query)

    const note = await fastify.prisma.note.findUnique({ where: { id: noteId }, select: { workspaceId: true, isDeleted: true } })
    if (!note || note.isDeleted) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Note not found' })

    const member = await fastify.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: note.workspaceId, userId: request.user.sub } },
    })
    if (!member) return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Access denied' })

    const comments = await fastify.prisma.comment.findMany({
      where: { noteId, parentId: null },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
    })
    return reply.send(comments)
  })

  // POST /comments
  fastify.post('/', async (request, reply) => {
    const body = z.object({
      noteId: z.string(),
      parentId: z.string().optional(),
      body: z.string().min(1).max(10000),
      anchorPos: z.number().optional(),
    }).parse(request.body)

    const note = await fastify.prisma.note.findUnique({ where: { id: body.noteId }, select: { workspaceId: true, isDeleted: true } })
    if (!note || note.isDeleted) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Note not found' })

    const member = await fastify.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: note.workspaceId, userId: request.user.sub } },
    })
    if (!member) return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Access denied' })

    const comment = await fastify.prisma.comment.create({
      data: { noteId: body.noteId, parentId: body.parentId, userId: request.user.sub, body: body.body, anchorPos: body.anchorPos },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    })
    return reply.code(201).send(comment)
  })

  // PATCH /comments/:id
  fastify.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const body = z.object({
      body: z.string().min(1).max(10000).optional(),
      resolved: z.boolean().optional(),
    }).parse(request.body)

    const comment = await fastify.prisma.comment.findUnique({ where: { id: request.params.id } })
    if (!comment) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Comment not found' })
    if (comment.userId !== request.user.sub) {
      return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Not your comment' })
    }

    const updated = await fastify.prisma.comment.update({
      where: { id: request.params.id },
      data: body,
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    })
    return reply.send(updated)
  })

  // DELETE /comments/:id
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const comment = await fastify.prisma.comment.findUnique({ where: { id: request.params.id } })
    if (!comment) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Comment not found' })
    if (comment.userId !== request.user.sub) {
      return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Not your comment' })
    }
    await fastify.prisma.comment.delete({ where: { id: request.params.id } })
    return reply.code(204).send()
  })
}
