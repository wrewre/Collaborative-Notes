import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'crypto'

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf', 'text/plain', 'text/markdown',
  'application/zip', 'application/json',
  'video/mp4', 'video/webm',
]

export const attachmentRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  // POST /attachments/presign — get presigned upload URL
  fastify.post('/presign', async (request, reply) => {
    const body = z.object({
      noteId: z.string(),
      fileName: z.string().min(1).max(255),
      mimeType: z.string(),
      sizeBytes: z.number().int().positive().max(50 * 1024 * 1024),
    }).parse(request.body)

    if (!ALLOWED_MIME_TYPES.includes(body.mimeType)) {
      return reply.code(415).send({ statusCode: 415, error: 'Unsupported Media Type', message: 'File type not allowed' })
    }

    // Verify note access
    const note = await fastify.prisma.note.findUnique({ where: { id: body.noteId }, select: { workspaceId: true } })
    if (!note) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Note not found' })

    const member = await fastify.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: note.workspaceId, userId: request.user.sub } },
    })
    if (!member || member.role === 'viewer') {
      return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Cannot upload' })
    }

    const ext = body.fileName.split('.').pop() || 'bin'
    const s3Key = `attachments/${body.noteId}/${randomUUID()}.${ext}`

    const uploadUrl = await fastify.getPresignedUploadUrl(s3Key, body.mimeType)

    // Pre-register attachment record
    const attachment = await fastify.prisma.attachment.create({
      data: {
        noteId: body.noteId,
        uploaderId: request.user.sub,
        fileName: body.fileName,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        s3Key,
      },
    })

    return reply.code(201).send({ attachment, uploadUrl })
  })

  // GET /attachments/:id/download — presigned download URL
  fastify.get<{ Params: { id: string } }>('/:id/download', async (request, reply) => {
    const attachment = await fastify.prisma.attachment.findUnique({
      where: { id: request.params.id },
      include: { note: { select: { workspaceId: true } } },
    })
    if (!attachment) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Attachment not found' })

    const member = await fastify.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: attachment.note.workspaceId, userId: request.user.sub } },
    })
    if (!member) return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Access denied' })

    const downloadUrl = await fastify.getPresignedDownloadUrl(attachment.s3Key)
    return reply.send({ downloadUrl, fileName: attachment.fileName, mimeType: attachment.mimeType })
  })

  // GET /attachments?noteId= — list attachments for a note
  fastify.get<{ Querystring: { noteId: string } }>('/', async (request, reply) => {
    const { noteId } = z.object({ noteId: z.string() }).parse(request.query)

    const note = await fastify.prisma.note.findUnique({ where: { id: noteId }, select: { workspaceId: true } })
    if (!note) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Note not found' })

    const member = await fastify.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: note.workspaceId, userId: request.user.sub } },
    })
    if (!member) return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Access denied' })

    const attachments = await fastify.prisma.attachment.findMany({
      where: { noteId },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(attachments)
  })

  // DELETE /attachments/:id
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const attachment = await fastify.prisma.attachment.findUnique({
      where: { id: request.params.id },
      include: { note: { select: { workspaceId: true } } },
    })
    if (!attachment) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Attachment not found' })

    if (attachment.uploaderId !== request.user.sub) {
      return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Not your attachment' })
    }

    await fastify.deleteS3Object(attachment.s3Key)
    await fastify.prisma.attachment.delete({ where: { id: request.params.id } })
    return reply.code(204).send()
  })
}
