import { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import crypto from 'crypto'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /auth/register
  fastify.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body)

    const existing = await fastify.prisma.user.findUnique({ where: { email: body.email } })
    if (existing) {
      return reply.code(409).send({ statusCode: 409, error: 'Conflict', message: 'Email already registered' })
    }

    const passwordHash = await bcrypt.hash(body.password, 12)
    const user = await fastify.prisma.user.create({
      data: { email: body.email, name: body.name, password: passwordHash },
      select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true },
    })

    const { accessToken, refreshToken } = await generateTokens(fastify, user.id, user.email, user.name)

    return reply
      .setCookie('refresh_token', refreshToken, cookieOptions())
      .code(201)
      .send({ user, accessToken, expiresIn: 900 })
  })

  // POST /auth/login
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)

    const user = await fastify.prisma.user.findUnique({ where: { email: body.email } })
    if (!user || !user.password) {
      return reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(body.password, user.password)
    if (!valid) {
      return reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid credentials' })
    }

    const { accessToken, refreshToken } = await generateTokens(fastify, user.id, user.email, user.name)

    return reply
      .setCookie('refresh_token', refreshToken, cookieOptions())
      .send({
        user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, createdAt: user.createdAt },
        accessToken,
        expiresIn: 900,
      })
  })

  // POST /auth/refresh
  fastify.post('/refresh', async (request, reply) => {
    const token = (request.cookies as Record<string, string>)['refresh_token']
    if (!token) {
      return reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'No refresh token' })
    }

    const tokenHash = hashToken(token)
    const stored = await fastify.redis.get(`refresh:${tokenHash}`)
    if (!stored) {
      return reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid refresh token' })
    }

    const { userId } = JSON.parse(stored)
    const user = await fastify.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    })
    if (!user) {
      return reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'User not found' })
    }

    // Rotate: delete old token
    await fastify.redis.del(`refresh:${tokenHash}`)

    const { accessToken, refreshToken: newRefreshToken } = await generateTokens(
      fastify,
      user.id,
      user.email,
      user.name,
    )

    return reply
      .setCookie('refresh_token', newRefreshToken, cookieOptions())
      .send({ accessToken, expiresIn: 900 })
  })

  // DELETE /auth/logout
  fastify.delete('/logout', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const token = (request.cookies as Record<string, string>)['refresh_token']
    if (token) {
      await fastify.redis.del(`refresh:${hashToken(token)}`)
    }
    return reply.clearCookie('refresh_token').send({ message: 'Logged out' })
  })

  // GET /auth/me
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { id: true, email: true, name: true, avatarUrl: true, provider: true, createdAt: true },
    })
    if (!user) return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' })
    return reply.send(user)
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function generateTokens(
  fastify: Parameters<FastifyPluginAsync>[0],
  userId: string,
  email: string,
  name: string,
) {
  const accessToken = fastify.jwt.sign({ sub: userId, email, name })
  const refreshToken = crypto.randomBytes(64).toString('hex')
  const tokenHash = hashToken(refreshToken)

  // Store refresh token in Redis for 30 days
  await fastify.redis.setex(
    `refresh:${tokenHash}`,
    30 * 24 * 60 * 60,
    JSON.stringify({ userId }),
  )

  return { accessToken, refreshToken }
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  }
}
