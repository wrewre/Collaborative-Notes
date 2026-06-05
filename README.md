# Real-Time Collaborative Notes

A production-grade real-time collaborative notes application built with:

- **Frontend:** React 18 + TypeScript + TipTap (rich text editor) + Yjs (CRDT for real-time sync) + Vite + Tailwind CSS
- **Backend API:** Node.js + Fastify + Prisma + JWT Auth + BullMQ
- **Collab Server:** y-websocket + Redis pub/sub for cross-pod sync
- **Database:** PostgreSQL 15 + Redis 7 + MinIO (S3-compatible)
- **Infra:** Docker Compose (local dev) + Kubernetes/Helm (production)

## Features

- ✅ Real-time collaborative editing with multiple cursors
- ✅ Workspace/team model with RBAC (owner, admin, editor, viewer)
- ✅ Rich-text editor with headings, lists, code blocks, @mentions
- ✅ Full-text search
- ✅ Offline support with automatic sync on reconnect
- ✅ Version history (last 100 snapshots per note)
- ✅ File/image attachments
- ✅ Threaded comments on notes

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker Desktop

### Local Development

```bash
# Install dependencies
pnpm install

# Start all services with Docker Compose
docker compose -f infra/docker-compose.yml up -d

# Run database migrations
pnpm db:migrate

# Start all dev servers
pnpm dev
```

### Services
| Service | URL |
|---------|-----|
| Web App | http://localhost:3000 |
| API | http://localhost:4000 |
| Collab WS | ws://localhost:4001 |
| MinIO Console | http://localhost:9001 |

## Architecture

```
apps/
  web/              # React frontend
services/
  api/              # Fastify REST API
  collab/           # y-websocket collaboration server
packages/
  db/               # Prisma client (shared)
  types/            # Shared TypeScript types
  config/           # Shared env validation
infra/
  docker-compose.yml
  helm/
```

## License

MIT
