import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'
import { getAuthToken } from '../features/auth/auth.store'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000/ws'

export interface CollabProvider {
  wsProvider: WebsocketProvider
  localProvider: IndexeddbPersistence
  destroy: () => void
}

// User colors for collaborative cursors
const USER_COLORS = [
  '#E85D24', '#3B82F6', '#10B981', '#F59E0B',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
]

export async function createCollabProvider(
  noteId: string,
  ydoc: Y.Doc,
  user: { id: string; name: string; color?: string },
): Promise<CollabProvider> {
  const token = await getAuthToken()
  const docName = `doc-${noteId}`
  const userColor = user.color || USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]

  // Local IndexedDB persistence — works offline instantly
  const localProvider = new IndexeddbPersistence(docName, ydoc)

  // WebSocket provider — syncs with server
  // Token is passed as a query param (WebSocket connections can't set Authorization headers)
  const wsUrl = token
    ? `${WS_URL}/${docName}?token=${encodeURIComponent(token)}`
    : `${WS_URL}/${docName}`

  const wsProvider = new WebsocketProvider(
    wsUrl,
    docName,
    ydoc,
    { connect: true },
  )

  // Set awareness state (cursor, presence)
  wsProvider.awareness.setLocalStateField('user', {
    name: user.name,
    color: userColor,
    id: user.id,
  })

  return {
    wsProvider,
    localProvider,
    destroy: () => {
      wsProvider.destroy()
      localProvider.destroy()
    },
  }
}
