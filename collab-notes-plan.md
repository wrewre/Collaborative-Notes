# Real-Time Collaborative Notes App — Full A–Z Build Plan

> A complete specification for building and deploying a production-grade real-time collaborative notes application. Structured for execution by an AI coding agent or a development team.

---

## Table of Contents

1. [Product Definition](#1-product-definition)
2. [Tech Stack Decisions](#2-tech-stack-decisions)
3. [The Collaboration Engine](#3-the-collaboration-engine--the-core)
4. [Database Schema](#4-database-schema)
5. [API Design](#5-api-design)
6. [Auth System](#6-auth-system)
7. [Offline Support](#7-offline-support)
8. [Search](#8-search)
9. [File Structure](#9-file-structure)
10. [Infrastructure and Deployment](#10-infrastructure-and-deployment)
11. [Security Checklist](#11-security-checklist)
12. [AI Agent Execution Order](#12-ai-agent-execution-order)

---

## 1. Product Definition

### Core feature set (MVP)

- Create, edit, delete notes and folders in a workspace
- Real-time multi-user collaborative editing (multiple cursors, live changes)
- Workspace/team model — invite members, set roles (owner, editor, viewer)
- Rich-text editor: headings, lists, code blocks, embeds, @mentions
- Full-text search across all notes
- Offline support with automatic sync on reconnect
- Version history (last 100 snapshots per note)
- File/image attachments
- Comment threads on notes

### Post-MVP roadmap

- Public sharing via link
- AI-assisted writing (summarize, expand, fix grammar)
- Webhooks and public API
- Mobile apps (iOS/Android)

---

## 2. Tech Stack Decisions

### Frontend

| Concern | Choice | Reason |
|---|---|---|
| Framework | React 18 + TypeScript | Ecosystem, concurrent mode |
| CRDT library | **Yjs** | Most mature, provider-agnostic, binds to ProseMirror/TipTap |
| Editor | **TipTap v2** (ProseMirror wrapper) | Rich extensions, Yjs binding built-in |
| State management | Zustand + React Query | Local UI state + server state separation |
| WebSocket client | `y-websocket` provider | Auto-reconnect, awareness protocol |
| Styling | Tailwind CSS | Utility-first, purges unused |
| Build | Vite | Fast HMR |

### Backend

| Concern | Choice | Reason |
|---|---|---|
| Runtime | **Node.js 20** (TypeScript) | Excellent WS support, same language as frontend |
| Framework | **Fastify** | Faster than Express, schema-first, plugin system |
| WebSocket | `ws` + `y-websocket` server | Native Yjs awareness protocol |
| ORM | **Prisma** | Type-safe, migration tooling |
| Auth | **Passport.js** + JWT + refresh tokens | Flexible strategy system |
| Validation | Zod | Runtime + compile-time |
| Queue | **BullMQ** (Redis-backed) | Robust job lifecycle, retries, cron |

### Data Layer

| Store | Use |
|---|---|
| **PostgreSQL 15** | Source of truth for users, notes metadata, permissions |
| **Redis 7** | Pub/sub (cross-pod WS sync), session store, Yjs document cache |
| **S3-compatible** (AWS S3 or MinIO locally) | File attachments, note exports |
| **Elasticsearch 8** | Full-text search with note content indexing |

### Infrastructure

- **Docker + Docker Compose** for local dev
- **Kubernetes** (EKS/GKE) for production with Helm charts
- **Nginx** ingress — WebSocket upgrade support required (`proxy_read_timeout 3600`)
- **cert-manager** for TLS

---

## 3. The Collaboration Engine — The Core

The hardest part of this app is conflict-free real-time editing.

### CRDT vs OT — choose CRDT (Yjs)

Operational Transform (Google Docs' original approach) requires a central server to sequence all operations. CRDTs (Conflict-free Replicated Data Types) are peer-to-peer — any two clients can merge independently, making offline sync trivially correct. Yjs implements a CRDT called YATA and is the industry standard for new collaborative apps.

### Data model in Yjs

```typescript
// Each note document is a Y.Doc
const ydoc = new Y.Doc()

// The editor content lives in a Y.XmlFragment
const content = ydoc.get('content', Y.XmlFragment)

// Metadata (title, tags) lives in a Y.Map
const meta = ydoc.getMap('meta')

// Comments live in a Y.Array
const comments = ydoc.getArray('comments')
```

### Sync flow

1. Client opens a note → connects via WebSocket to the collab service
2. Server sends the full Yjs document state vector (compressed binary)
3. Client merges it with its local state (offline edits auto-merge here)
4. All subsequent edits produce Yjs update diffs (binary, ~50–200 bytes per keystroke)
5. Server broadcasts diffs to all other connected clients for that document
6. Server persists diffs to Redis (Yjs document cache) and queues a debounced PostgreSQL snapshot job

### Awareness protocol (cursors + presence)

```typescript
// Client-side awareness state
provider.awareness.setLocalState({
  user: { name: 'Alice', color: '#E85D24' },
  cursor: { anchor: 42, head: 55 }  // ProseMirror positions
})

// All connected clients receive everyone else's state
provider.awareness.on('change', (changes) => {
  renderRemoteCursors(provider.awareness.getStates())
})
```

### Persistence strategy (important for scale)

Do NOT write every Yjs update to Postgres — this creates massive write amplification. Instead:

- Store the full Yjs binary snapshot in Redis (`note:{id}:ydoc`)
- Use BullMQ to debounce snapshot writes to Postgres (every 30 seconds of inactivity or every 500 updates)
- Store version history as periodic full snapshots (every hour, and on explicit "save version")
- **Recovery path:** Redis is source of truth for live docs; Postgres is the durable archive

### Cross-pod WebSocket sync (critical for horizontal scaling)

When you run multiple WebSocket server pods, a user on pod A and a user on pod B editing the same note must stay in sync. Solve this with Redis pub/sub:

```typescript
// On receiving a Yjs update from a client:
const channel = `doc:${noteId}`
await redis.publish(channel, updateBuffer)  // broadcast to other pods

// Each pod subscribes to all active document channels:
redisSubscriber.subscribe(channel, (updateBuffer) => {
  broadcastToLocalClients(noteId, updateBuffer)
})
```

---

## 4. Database Schema

```sql
-- Users
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  avatar_url  TEXT,
  provider    TEXT DEFAULT 'email',  -- 'google' | 'github' | 'email'
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Workspaces (teams)
CREATE TABLE workspaces (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  plan       TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Workspace membership + RBAC
CREATE TABLE workspace_members (
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('owner','admin','editor','viewer')),
  invited_by   UUID REFERENCES users(id),
  joined_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

-- Folders (self-referential for nesting)
CREATE TABLE folders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  parent_id    UUID REFERENCES folders(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Notes
CREATE TABLE notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  folder_id       UUID REFERENCES folders(id) ON DELETE SET NULL,
  title           TEXT NOT NULL DEFAULT 'Untitled',
  content_text    TEXT,                      -- plain-text extraction for search indexing
  ydoc_snapshot   BYTEA,                     -- latest Yjs binary snapshot
  ydoc_version    INTEGER DEFAULT 0,
  is_deleted      BOOLEAN DEFAULT FALSE,     -- soft delete
  created_by      UUID REFERENCES users(id),
  last_edited_by  UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Version history
CREATE TABLE note_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id       UUID REFERENCES notes(id) ON DELETE CASCADE,
  ydoc_snapshot BYTEA NOT NULL,
  content_text  TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Comments
CREATE TABLE comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id    UUID REFERENCES notes(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES comments(id) ON DELETE CASCADE,  -- threading
  user_id    UUID REFERENCES users(id),
  body       TEXT NOT NULL,
  resolved   BOOLEAN DEFAULT FALSE,
  anchor_pos INTEGER,                        -- ProseMirror character offset
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Attachments
CREATE TABLE attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id     UUID REFERENCES notes(id) ON DELETE CASCADE,
  uploader_id UUID REFERENCES users(id),
  file_name   TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL,
  s3_key      TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX ON notes(workspace_id, is_deleted, updated_at DESC);
CREATE INDEX ON notes(folder_id);
CREATE INDEX ON note_versions(note_id, created_at DESC);
CREATE INDEX ON comments(note_id, resolved);
```

---

## 5. API Design

### REST endpoints (Fastify)

```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
DELETE /auth/logout
GET    /auth/me

POST   /workspaces
GET    /workspaces/:id
PATCH  /workspaces/:id
POST   /workspaces/:id/members          -- invite
DELETE /workspaces/:id/members/:userId  -- remove

GET    /workspaces/:wsId/notes          -- list; supports ?folderId=&search=&cursor=
POST   /workspaces/:wsId/notes          -- create
GET    /notes/:id
PATCH  /notes/:id                       -- title, folder, metadata only
DELETE /notes/:id                       -- soft delete
GET    /notes/:id/versions
POST   /notes/:id/versions              -- create named version
POST   /notes/:id/attachments           -- multipart upload
GET    /notes/:id/comments
POST   /notes/:id/comments
PATCH  /comments/:id
DELETE /comments/:id
```

### WebSocket protocol (y-websocket extension)

The `y-websocket` protocol uses binary messages. On top of it, add a JSON envelope for app-level events on a secondary channel:

```jsonc
// Message types sent over the WS connection
{ "type": "awareness", "payload": "<binary Yjs awareness update>" }
{ "type": "sync",      "payload": "<binary Yjs document update>"  }
{ "type": "presence",  "payload": { "userId": "...", "noteId": "...", "action": "join" } }
{ "type": "comment",   "payload": { "action": "create", "comment": { "..." : "..." } } }
{ "type": "error",     "payload": { "code": 403, "message": "unauthorized" } }
```

---

## 6. Auth System

### Token strategy

- **Access tokens:** Short-lived JWT (15 min), signed with RS256. Public key distributed to microservices for local verification without a network round-trip.
- **Refresh tokens:** 30-day opaque token stored in an `httpOnly` cookie, rotated on each use (refresh token rotation). Stored in Redis as `userId:tokenHash`.

### OAuth2

Implement Google and GitHub strategies via Passport.js. On first OAuth login, create a user record; on subsequent logins, match by email.

### RBAC on notes

Middleware checks `workspace_members.role` before every note operation. Roles cascade: `owner > admin > editor > viewer`.

### WebSocket auth

Pass the access token as a query param on WS connect (`?token=...`) — browsers don't support custom headers on WS upgrades. Validate on connection and on every message. When the token expires mid-session, send a `reconnect` signal; the client calls `/auth/refresh` via REST and reconnects with the new token.

---

## 7. Offline Support

Yjs handles this natively via the `y-indexeddb` provider.

```typescript
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebsocketProvider }    from 'y-websocket'
import * as Y from 'yjs'

const ydoc = new Y.Doc()

// Persist locally — loads instantly, works offline
const localProvider = new IndexeddbPersistence(`note-${noteId}`, ydoc)

// Sync with server — queues updates when offline, flushes on reconnect
const wsProvider = new WebsocketProvider(WS_URL, `note-${noteId}`, ydoc)
wsProvider.on('status', ({ status }) => setConnectionStatus(status))
```

**How reconnect sync works:**
1. On reconnect, the client sends its local state vector
2. The server replies with only the missing updates (delta sync, not full document)
3. Any edits made offline are flushed as Yjs updates
4. The CRDT merges automatically — no conflict resolution UI required for text edits

---

## 8. Search

### MVP path — Postgres tsvector

```sql
-- Add a generated full-text search column to notes
ALTER TABLE notes ADD COLUMN search_vector TSVECTOR
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(content_text,'')), 'B')
  ) STORED;

CREATE INDEX ON notes USING GIN(search_vector);

-- Search query
SELECT * FROM notes
WHERE workspace_id = $1
  AND is_deleted = FALSE
  AND search_vector @@ plainto_tsquery('english', $2)
ORDER BY ts_rank(search_vector, plainto_tsquery('english', $2)) DESC
LIMIT 20;
```

### Scale path — Elasticsearch

When Postgres full-text is insufficient (large workspaces, fuzzy matching, highlighting):

- Index mapping: `title` (boost 2×), `content_text`, `workspace_id`, `created_by`, `updated_at`, `tags`
- Dual-write pattern: on every note save (debounced), extract plain text from Yjs and write to both Postgres and Elasticsearch
- Fallback: if Elasticsearch is unavailable, fall back to Postgres `tsvector`

---

## 9. File Structure

```
/
├── apps/
│   ├── web/                        # React frontend
│   │   ├── src/
│   │   │   ├── features/
│   │   │   │   ├── editor/         # TipTap + Yjs setup
│   │   │   │   ├── notes/          # note list, sidebar
│   │   │   │   ├── auth/           # login, register pages
│   │   │   │   └── workspace/      # settings, members
│   │   │   ├── lib/
│   │   │   │   ├── ydoc.ts         # Yjs doc factory
│   │   │   │   ├── ws-provider.ts  # WebSocket provider config
│   │   │   │   └── api.ts          # REST client (axios/fetch)
│   │   │   └── main.tsx
│   │   └── vite.config.ts
│   └── mobile/                     # React Native (post-MVP)
│
├── services/
│   ├── api/                        # Fastify REST API
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── plugins/            # auth, db, redis, s3 plugins
│   │   │   ├── schemas/            # Zod schemas
│   │   │   └── jobs/               # BullMQ job definitions
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── migrations/
│   └── collab/                     # WebSocket collab server
│       └── src/
│           ├── server.ts           # y-websocket server
│           ├── redis-bridge.ts     # cross-pod pub/sub
│           └── persistence.ts      # Redis + Postgres snapshot logic
│
├── packages/
│   ├── db/                         # Prisma client (shared)
│   ├── types/                      # shared TypeScript types
│   └── config/                     # shared env validation (Zod)
│
├── infra/
│   ├── docker-compose.yml          # local dev
│   ├── helm/                       # K8s Helm chart
│   └── terraform/                  # cloud infra (VPC, RDS, EKS)
│
└── .github/
    └── workflows/
        ├── ci.yml
        └── deploy.yml
```

This is a **monorepo** — use Turborepo or pnpm workspaces to share the `packages/` layer across services.

---

## 10. Infrastructure and Deployment

### Docker Compose (local dev)

```yaml
version: '3.9'
services:
  web:
    build: ./apps/web
    ports: ['3000:3000']
    environment:
      VITE_API_URL: http://localhost:4000
      VITE_WS_URL: ws://localhost:4001

  api:
    build: ./services/api
    ports: ['4000:4000']
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/collabnotes
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev-secret

  collab:
    build: ./services/collab
    ports: ['4001:4001']
    depends_on: [redis]
    environment:
      REDIS_URL: redis://redis:6379
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/collabnotes

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: collabnotes
      POSTGRES_PASSWORD: postgres
    volumes: [pg_data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports: ['9000:9000', '9001:9001']

  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      discovery.type: single-node
      xpack.security.enabled: 'false'

volumes:
  pg_data:
```

### Kubernetes (production)

Each service gets its own `Deployment` + `Service`. Key considerations:

**Sticky WebSocket sessions:**
Use `sessionAffinity: ClientIP` on the collab Service, or route by `noteId` hash at the Nginx ingress level. The Redis pub/sub bridge means any pod can handle any document, but sticky sessions reduce cross-pod traffic.

**Autoscaling:**
- API pods: HPA based on CPU utilization (target 60%)
- Collab pods: HPA based on active WebSocket connection count (custom Prometheus metric)

**Zero-downtime rolling deploys:**
Add a `PodDisruptionBudget` on collab pods ensuring at least 1 pod stays up at all times. On SIGTERM, drain active WS connections with a 30s grace period before shutdown.

**Managed services in production:**
- RDS PostgreSQL with a read replica for search queries
- ElastiCache Redis in cluster mode
- S3 for file storage
- CloudFront CDN for static web assets

### CI/CD pipeline

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm turbo test       # unit tests (Vitest)
      - run: pnpm turbo e2e        # Playwright end-to-end

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: docker/build-push-action@v5
        with:
          push: true
          tags: ${{ env.ECR_REGISTRY }}/api:${{ github.sha }}
      # repeat for collab and web

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: helm upgrade --install collab-notes ./infra/helm
          --set api.image.tag=${{ github.sha }}
          --set collab.image.tag=${{ github.sha }}
      # ArgoCD picks up the Helm change and syncs to the cluster
```

---

## 11. Security Checklist

| Area | Requirement |
|---|---|
| API auth | All routes protected by JWT middleware except `/auth/*` |
| WebSocket auth | Token validated on `upgrade` event; re-validated on token expiry mid-session |
| Data isolation | Every DB query includes `workspace_id` filter derived from the JWT, never from user input |
| File uploads | Validate MIME type server-side (not just extension); virus scan via ClamAV on upload worker |
| File serving | Serve attachments via signed S3 URLs with 1-hour expiry, never public URLs |
| Rate limiting | 100 req/min per IP on auth endpoints; 1000 req/min per user on API |
| SQL injection | Impossible with Prisma parameterized queries; audit all `$queryRaw` calls |
| XSS | TipTap/ProseMirror sanitizes HTML on paste; CSP header blocks inline scripts |
| CSRF | `httpOnly` cookies + `SameSite=Strict` for refresh token; access token in memory only (not localStorage) |
| Secrets | All secrets in environment variables, never committed; use AWS Secrets Manager or Vault in production |
| Dependency scanning | Dependabot or Snyk in CI pipeline |

---

## 12. AI Agent Execution Order

If you are an AI coding agent executing this plan, follow this sequence. Each step is independently deployable and testable before the next step begins.

| Step | Task | Deliverable |
|---|---|---|
| 1 | Scaffold monorepo | pnpm workspaces, Turborepo, full directory tree |
| 2 | Set up Postgres + Prisma | Full schema from Section 4, `prisma migrate dev` passing |
| 3 | Build Auth service | Register, login, refresh, JWT middleware, RBAC |
| 4 | Build Notes REST API | Full CRUD routes with workspace-scoped access control |
| 5 | Build Collab WebSocket server | `y-websocket` server + Redis pub/sub bridge + Postgres snapshot worker |
| 6 | Build React frontend | Workspace sidebar, TipTap editor wired to Yjs + WebSocket provider |
| 7 | Add offline support | `y-indexeddb` provider, reconnect sync, connection status UI |
| 8 | Add search | Postgres `tsvector` first; Elasticsearch integration second |
| 9 | Add file uploads | Presigned S3 URLs, multipart route, attachments table |
| 10 | Add comments | REST API + real-time comment events via Yjs `Y.Array` |
| 11 | Wire notifications | BullMQ jobs for email (invite, @mention), in-app notification store |
| 12 | Docker Compose | Wire all services for local dev, seed script |
| 13 | Write tests | Unit (Vitest), integration (Supertest), end-to-end (Playwright) |
| 14 | Helm chart + CI/CD | Production deploy pipeline, Kubernetes manifests |

---

## Key dependency versions (as of mid-2025)

```json
{
  "yjs": "^13.6",
  "y-websocket": "^2.0",
  "y-indexeddb": "^9.0",
  "@tiptap/core": "^2.4",
  "@tiptap/extension-collaboration": "^2.4",
  "@tiptap/extension-collaboration-cursor": "^2.4",
  "fastify": "^4.28",
  "prisma": "^5.14",
  "bullmq": "^5.7",
  "ioredis": "^5.4",
  "zod": "^3.23",
  "react": "^18.3",
  "zustand": "^4.5",
  "@tanstack/react-query": "^5.45"
}
```

---

*This document is the single source of truth for the project. Update it as architectural decisions change.*
