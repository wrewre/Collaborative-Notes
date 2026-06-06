import { FastifyPluginAsync } from 'fastify'
import { setupWSConnection } from 'y-websocket/bin/utils'
import { persistenceManager } from '../collab/persistence.js'
import { createClerkClient } from '@clerk/backend'
import * as Y from 'yjs'

import yutils from 'y-websocket/bin/utils'
const docs = yutils.docs

let clerkClient: ReturnType<typeof createClerkClient>

function getClerkClient() {
  if (!clerkClient) {
    clerkClient = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY!,
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    })
  }
  return clerkClient
}

export const websocketRoutes: FastifyPluginAsync = async (app) => {
  app.get('/:documentId', { websocket: true }, async (connection, req) => {
    // Extract Clerk token from ?token= query param (WebSocket can't set headers)
    const token = (req.query as any).token as string | undefined

    if (!token) {
      connection.socket.close(4001, 'Unauthorized: no token')
      return
    }

    try {
      const client = getClerkClient()
      const { sub } = await client.verifyToken(token)

      if (!sub) throw new Error('Invalid token sub')
    } catch {
      connection.socket.close(4001, 'Unauthorized: invalid token')
      return
    }

    const docName = (req.params as any).documentId

    setupWSConnection(connection.socket, req as any, {
      docName,
      gc: true,
    })

    // Bind Postgres snapshot into ydoc on connect
    const ydoc = getYDoc(docName)
    if (ydoc) {
      await persistenceManager.bindState(docName, ydoc)
    }

    connection.socket.on('close', async () => {
      const ydoc = getYDoc(docName)
      if (ydoc) {
        await persistenceManager.writeState(docName, ydoc)
      }
    })
  })
}

function getYDoc(docName: string): Y.Doc | undefined {
  return docs.get(docName)
}
