import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { Role } from '@collab-notes/types'

export const noteRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  // Helper: check note access
  async function checkNoteAccess(noteId: string, userId: string, minRole: Role = 'viewer') {
    const roleRank: Record<Role, number> = { owner: 4, admin: 3, editor: 2, viewer: 1 }
    const note = await fastify.prisma.note.findUnique({
      where: { id: noteId },
      select: { id: true, workspaceId: true, isDeleted: true, folderId: true, title: true, ydocVersion: true, createdById: true, lastEditedById: true, createdAt: true, updatedAt: true },
    })
    if (!note || note.isDeleted) return null

    const member = await fastify.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: note.workspaceId, userId } },
    })
    if (!member || roleRank[member.role as Role] < roleRank[minRole]) return null
    return { note, member }
  }

  // GET /notes/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const access = await checkNoteAccess(request.params.id, request.user.sub)
    if (!access) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Note not found' })
    return reply.send(access.note)
  })

  // PATCH /notes/:id — metadata only (title, folderId)
  fastify.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const access = await checkNoteAccess(request.params.id, request.user.sub, 'editor')
    if (!access) return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Cannot edit note' })

    const body = z.object({
      title: z.string().min(1).max(500).optional(),
      folderId: z.string().nullable().optional(),
    }).parse(request.body)

    const note = await fastify.prisma.note.update({
      where: { id: request.params.id },
      data: { ...body, lastEditedById: request.user.sub },
    })
    return reply.send(note)
  })

  // DELETE /notes/:id — soft delete
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const access = await checkNoteAccess(request.params.id, request.user.sub, 'editor')
    if (!access) return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Cannot delete note' })

    await fastify.prisma.note.update({
      where: { id: request.params.id },
      data: { isDeleted: true },
    })
    return reply.code(204).send()
  })

  // GET /notes/:id/versions
  fastify.get<{ Params: { id: string } }>('/:id/versions', async (request, reply) => {
    const access = await checkNoteAccess(request.params.id, request.user.sub)
    if (!access) return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Access denied' })

    const versions = await fastify.prisma.noteVersion.findMany({
      where: { noteId: request.params.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, noteId: true, contentText: true, createdById: true, createdAt: true },
    })
    return reply.send(versions)
  })

  // POST /notes/:id/versions — create named snapshot
  fastify.post<{ Params: { id: string } }>('/:id/versions', async (request, reply) => {
    const access = await checkNoteAccess(request.params.id, request.user.sub, 'editor')
    if (!access) return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Cannot snapshot note' })

    const note = await fastify.prisma.note.findUnique({
      where: { id: request.params.id },
      select: { ydocSnapshot: true, contentText: true },
    })
    if (!note?.ydocSnapshot) {
      return reply.code(422).send({ statusCode: 422, error: 'Unprocessable', message: 'No snapshot available yet' })
    }

    const version = await fastify.prisma.noteVersion.create({
      data: {
        noteId: request.params.id,
        ydocSnapshot: note.ydocSnapshot,
        contentText: note.contentText,
        createdById: request.user.sub,
      },
      select: { id: true, noteId: true, contentText: true, createdById: true, createdAt: true },
    })
    return reply.code(201).send(version)
  })

  // GET /notes/:id/ydoc — return raw Yjs binary snapshot (for collab server recovery)
  fastify.get<{ Params: { id: string } }>('/:id/ydoc', async (request, reply) => {
    const access = await checkNoteAccess(request.params.id, request.user.sub)
    if (!access) return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Access denied' })

    const note = await fastify.prisma.note.findUnique({
      where: { id: request.params.id },
      select: { ydocSnapshot: true },
    })

    if (!note?.ydocSnapshot) {
      return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'No snapshot' })
    }

    return reply.type('application/octet-stream').send(note.ydocSnapshot)
  })
}
