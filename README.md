# Real-Time Collaborative Notes App 🚀

A production-grade, highly scalable real-time collaborative notes application built with a modern tech stack. Experience Google Docs-like simultaneous editing with multiple users, offline capabilities, and a beautiful dark-mode glassmorphism UI.

## ✨ Key Features

- **Real-Time Collaboration**: Powered by Yjs (CRDT) and TipTap for conflict-free, multi-user rich text editing.
- **Offline Support**: Edits are stored locally using IndexedDB (`y-indexeddb`) and synced automatically when back online.
- **Rich Text Editor**: Support for headings, lists, code blocks with syntax highlighting, blockquotes, and multiple formatting options.
- **Workspaces & RBAC**: Isolate notes within workspaces. Control access with Owner, Editor, and Viewer roles.
- **Threaded Comments**: Leave comments on notes and reply in threads. Resolve or delete comments when done.
- **Robust Persistence**: Edits sync to the API via WebSockets and are periodically flushed as snapshots to PostgreSQL.
- **Stunning UI**: Dark-mode, responsive, glassmorphism design using Tailwind CSS.

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, TipTap, Zustand, React Query
- **Backend API**: Node.js, Fastify, Prisma ORM, JWT Authentication, Yjs WebSockets
- **Database**: PostgreSQL 15
- **Monorepo**: pnpm workspaces, Turborepo
- **CI/CD**: GitHub Actions (Linting, Testing, Docker image builds to GHCR)

## 📂 Project Structure

This project is a monorepo leveraging Turborepo.

```text
├── apps/
│   └── web/                # React Vite application
├── services/
│   └── api/                # Fastify REST API with Yjs WebSocket server
├── packages/
│   ├── config/             # Shared Zod schemas for env validation
│   ├── db/                 # Prisma schema, client, and migrations
│   └── types/              # Shared TypeScript definitions
├── infra/                  # Docker Compose configuration
└── .github/workflows/      # CI/CD pipelines
```

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/) v9+
- [Docker](https://www.docker.com/) & Docker Compose

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/wrewre/Collaborative-Notes.git
cd Collaborative-Notes

# Install all monorepo dependencies
pnpm install
```

### 2. Environment Variables

The project uses `.env` files for configuration. For quick local Docker runs, `docker-compose.yml` provides all required environment variables automatically.

### 3. Run with Docker Compose (Recommended)

The easiest way to run the entire stack (Postgres, API, and Web Frontend) is via Docker Compose:

```bash
docker compose -f infra/docker-compose.yml up --build -d
```

### 4. Run Locally (Development Mode)

If you prefer to run the Node.js services locally while only running the database in Docker:

1. Start database:
```bash
docker compose -f infra/docker-compose.yml up postgres -d
```

2. Run Prisma migrations:
```bash
# Set DATABASE_URL locally in packages/db/.env first
pnpm --filter @collab-notes/db migrate:deploy
```

3. Start all services via Turborepo:
```bash
pnpm dev
```

### 🌐 Accessing the Services

- **Web App**: http://localhost:3000
- **REST API**: http://localhost:4000
- **WebSocket Route**: ws://localhost:4000/ws

## 🚢 Deployment

The repository includes GitHub Actions workflows (`.github/workflows/deploy.yml`) that automatically build Docker images for `api`, `collab`, and `web`, pushing them to the GitHub Container Registry (GHCR) upon merges to the `main` branch.

## 📄 License

This project is open-source and available under the MIT License.
