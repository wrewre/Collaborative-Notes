// ─── Auth ───────────────────────────────────────────────────────────────────

export type Role = 'owner' | 'admin' | 'editor' | 'viewer'

export interface JwtPayload {
  sub: string      // userId
  email: string
  name: string
  iat?: number
  exp?: number
}

export interface AuthTokens {
  accessToken: string
  expiresIn: number
}

// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
  provider: string
  createdAt: string
}

// ─── Workspace ───────────────────────────────────────────────────────────────

export interface Workspace {
  id: string
  name: string
  slug: string
  plan: string
  createdAt: string
}

export interface WorkspaceMember {
  workspaceId: string
  userId: string
  role: Role
  joinedAt: string
  user: Pick<User, 'id' | 'email' | 'name' | 'avatarUrl'>
}

// ─── Folder ──────────────────────────────────────────────────────────────────

export interface Folder {
  id: string
  workspaceId: string
  parentId?: string | null
  name: string
  createdAt: string
  createdBy: string
}

// ─── Note ────────────────────────────────────────────────────────────────────

export interface Note {
  id: string
  workspaceId: string
  folderId?: string | null
  title: string
  contentText?: string | null
  ydocVersion: number
  isDeleted: boolean
  createdBy: string
  lastEditedBy?: string | null
  createdAt: string
  updatedAt: string
}

export interface NoteVersion {
  id: string
  noteId: string
  contentText?: string | null
  createdBy: string
  createdAt: string
}

// ─── Comment ─────────────────────────────────────────────────────────────────

export interface Comment {
  id: string
  noteId: string
  parentId?: string | null
  userId: string
  body: string
  resolved: boolean
  anchorPos?: number | null
  createdAt: string
  user: Pick<User, 'id' | 'name' | 'avatarUrl'>
}

// ─── Attachment ──────────────────────────────────────────────────────────────

export interface Attachment {
  id: string
  noteId: string
  uploaderId: string
  fileName: string
  mimeType: string
  sizeBytes: number
  s3Key: string
  createdAt: string
}

// ─── WebSocket Messages ───────────────────────────────────────────────────────

export type WsMessageType = 'awareness' | 'sync' | 'presence' | 'comment' | 'error'

export interface WsMessage {
  type: WsMessageType
  payload: unknown
}

export interface PresencePayload {
  userId: string
  noteId: string
  action: 'join' | 'leave'
}

export interface CommentWsPayload {
  action: 'create' | 'update' | 'delete' | 'resolve'
  comment: Comment
}

export interface ErrorPayload {
  code: number
  message: string
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  cursor?: string | null
}

export interface ApiError {
  statusCode: number
  error: string
  message: string
}
