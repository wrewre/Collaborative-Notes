import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import websocket from '@fastify/websocket'
import { validateApiEnv } from '@collab-notes/config'

import { dbPlugin } from './plugins/db.js'
import { jwtPlugin } from './plugins/jwt.js'

import { authRoutes } from './routes/auth.js'
import { workspaceRoutes } from './routes/workspaces.js'
import { noteRoutes } from './routes/notes.js'
import { commentRoutes } from './routes/comments.js'
import { websocketRoutes } from './routes/websocket.js'

const env = validateApiEnv(process.env as NodeJS.ProcessEnv)

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'development' ? 'info' : 'warn',
    transport:
      env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
})

async function bootstrap() {
  // Security plugins
  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
  await app.register(rateLimit, {
    max: 1000,
    timeWindow: '1 minute',
  })
  await app.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  })
  
  // Register websocket plugin BEFORE websocket routes
  await app.register(websocket)

  // App plugins
  await app.register(dbPlugin)
  await app.register(jwtPlugin)

  // Routes
  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(workspaceRoutes, { prefix: '/workspaces' })
  await app.register(noteRoutes, { prefix: '/notes' })
  await app.register(commentRoutes, { prefix: '/comments' })
  
  // Websocket route
  await app.register(websocketRoutes, { prefix: '/ws' })

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // Start server
  await app.listen({ port: env.PORT, host: '0.0.0.0' })
  app.log.info(`🚀 API server running on port ${env.PORT}`)
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
