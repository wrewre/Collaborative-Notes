# Real-Time Collaborative Notes 🚀

A real-time collaborative notes application designed for a seamless, Google Docs-like simultaneous editing experience. 

Built with a fast, modern tech stack, this project features robust Yjs-powered conflict resolution, secure Clerk authentication, and a stunning dark-mode glassmorphism UI.

## ✨ Key Features

- **Real-Time Collaboration**: Powered by Yjs (CRDT) and TipTap for conflict-free, multi-user rich text editing.
- **Secure Authentication**: Fully integrated with [Clerk](https://clerk.com/) for secure, hassle-free user management.
- **Workspaces & RBAC**: Isolate notes within workspaces. Control access with Owner, Editor, and Viewer roles.
- **Rich Text Editor**: Support for headings, lists, code blocks with syntax highlighting, and formatting options.
- **Threaded Comments**: Leave comments on notes and reply in threads. Resolve or delete comments when done.
- **Robust Persistence**: Edits sync to the API via WebSockets and are periodically flushed as snapshots to PostgreSQL.
- **Offline Support**: Edits are stored locally using IndexedDB and synced automatically when back online.
- **Stunning UI**: Dark-mode, responsive, glassmorphism design using Tailwind CSS.

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, TipTap, Zustand, React Query
- **Backend**: Node.js, Fastify, Prisma ORM, Yjs WebSockets
- **Auth**: Clerk
- **Database**: PostgreSQL
- **Monorepo**: pnpm workspaces, Turborepo
- **Deployment**: Render (Zero-config `render.yaml`)

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
└── render.yaml             # Render Blueprint for automated deployment
```

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/) v9+
- A [Clerk](https://clerk.com/) account (for Auth keys)
- PostgreSQL database (Local or hosted like Supabase/Neon)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/wrewre/Collaborative-Notes.git
cd Collaborative-Notes

# Install all monorepo dependencies
pnpm install
```

### 2. Environment Variables

Copy the example environment files and fill in your Clerk and Database URLs:

```bash
cp apps/web/.env.example apps/web/.env.local
cp services/api/.env.example services/api/.env
```

### 3. Run Locally

1. Run Prisma migrations to set up your database schema:
```bash
pnpm --filter @collab-notes/db migrate:deploy
```

2. Start all services concurrently via Turborepo:
```bash
pnpm dev
```

### 🌐 Accessing the Services

- **Web App**: http://localhost:3000
- **REST & WS API**: http://localhost:4000

## 🚢 Deployment

This project includes a `render.yaml` Blueprint for 1-click deployment on [Render](https://render.com).

1. Connect your GitHub repository to Render using the Blueprint feature.
2. Render will automatically provision a PostgreSQL database, the Node.js API service, and a static site for the React frontend.
3. Add your Clerk API keys as environment variables in the Render dashboard.

## 📄 License

This project is open-source and available under the MIT License.
