import { FastifyPluginAsync } from 'fastify'
import { setupWSConnection } from 'y-websocket/bin/utils'
import { persistenceManager } from '../collab/persistence.js'
import * as Y from 'yjs'

// Need to safely import docs map from y-websocket internal utils
import yutils from 'y-websocket/bin/utils'
const docs = yutils.docs

export const websocketRoutes: FastifyPluginAsync = async (app) => {
  app.get('/:documentId', { websocket: true }, async (connection, req) => {
    let user;
    try {
      const token = (req.query as any).token
      if (token) {
         user = app.jwt.verify(token)
      } else {
         throw new Error("No token")
      }
    } catch {
      connection.socket.close(4001, 'Unauthorized')
      return
    }

    const docName = (req.params as any).documentId

    setupWSConnection(connection.socket, req as any, {
      docName,
      gc: true,
    })

    // Bind state from postgres on connect
    const ydoc = getYDocFromSetup(docName)
    if (ydoc) {
      await persistenceManager.bindState(docName, ydoc)
    }

    connection.socket.on('close', async () => {
      // Save state on disconnect
      const ydoc = getYDocFromSetup(docName)
      if (ydoc) {
        await persistenceManager.writeState(docName, ydoc)
      }
    })
  })
}

function getYDocFromSetup(docName: string): Y.Doc | undefined {
  return docs.get(docName)
}
