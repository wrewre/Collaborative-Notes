import { FastifyRequest, FastifyReply } from 'fastify'
import { Role } from '@collab-notes/types'

// Role hierarchy: owner > admin > editor > viewer
const roleRank: Record<Role, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
}

export function requireRole(minimumRole: Role) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, wsId } = request.params as Record<string, string>
    const wid = workspaceId || wsId

    if (!wid) {
      return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Workspace ID required' })
    }

    const member = await request.server.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: wid, userId: request.clerkUserId } },
    })

    if (!member) {
      return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'Not a workspace member' })
    }

    if (roleRank[member.role as Role] < roleRank[minimumRole]) {
      return reply.code(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: `Requires ${minimumRole} role or higher`,
      })
    }

    // Attach the member's role to the request for downstream handlers
    ;(request as FastifyRequest & { memberRole: Role }).memberRole = member.role as Role
  }
}
