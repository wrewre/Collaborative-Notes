import 'dotenv/config'
import http from 'http'
import { WebSocketServer } from 'ws'
import { setupWSConnection } from 'y-websocket/bin/utils'
import { verifyToken } from './auth.js'
import { RedisBridge } from './redis-bridge.js'
import { PersistenceManager } from './persistence.js'

const PORT = parseInt(process.env.PORT || '4001', 10)

const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }))
    return
  }
  res.writeHead(404)
  res.end()
})

const wss = new WebSocketServer({ noServer: true })
const redisBridge = new RedisBridge()
const persistence = new PersistenceManager()

// Track active connections per document
const docConnections = new Map<string, Set<import('ws').WebSocket>>()

httpServer.on('upgrade', async (request, socket, head) => {
  try {
    // Extract docName and token from URL
    // URL format: /doc/{noteId}?token=...
    const url = new URL(request.url || '', `http://localhost:${PORT}`)
    const token = url.searchParams.get('token')
    const pathParts = url.pathname.split('/').filter(Boolean)
    const docName = pathParts.join('-') // e.g. "doc-{noteId}"

    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    // Verify JWT
    const payload = verifyToken(token)
    if (!payload) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      // Track connection
      if (!docConnections.has(docName)) docConnections.set(docName, new Set())
      const connections = docConnections.get(docName)!
      connections.add(ws)

      ws.on('close', () => {
        connections.delete(ws)
        if (connections.size === 0) docConnections.delete(docName)
      })

      // Setup y-websocket with persistence
      setupWSConnection(ws, request, {
        docName,
        gc: true,
        persistence: {
          bindState: async (docName: string, ydoc: import('yjs').Doc) => {
            await persistence.bindState(docName, ydoc)
          },
          writeState: async (docName: string, ydoc: import('yjs').Doc) => {
            await persistence.writeState(docName, ydoc)
          },
        },
      })

      // Subscribe to Redis updates for cross-pod sync
      redisBridge.subscribeDoc(docName, (update: Buffer) => {
        connections.forEach((client) => {
          if (client !== ws && client.readyState === client.OPEN) {
            // Forward update to all local clients for this doc
            const encoder = new Uint8Array([1, ...update]) // type 1 = sync
            client.send(encoder)
          }
        })
      })
    })
  } catch (err) {
    console.error('WS upgrade error:', err)
    socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n')
    socket.destroy()
  }
})

httpServer.listen(PORT, () => {
  console.log(`🔌 Collab WebSocket server running on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, draining connections...')
  await redisBridge.close()
  await persistence.close()
  httpServer.close(() => process.exit(0))
})
