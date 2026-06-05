FROM node:20-alpine AS base
RUN npm install -g pnpm@9.4.0

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY services/api/package.json ./services/api/
COPY packages/db/package.json ./packages/db/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/api/node_modules ./services/api/node_modules
COPY . .
RUN pnpm --filter @collab-notes/types build
RUN pnpm --filter @collab-notes/config build
RUN pnpm --filter @collab-notes/db generate
RUN pnpm --filter @collab-notes/api build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services/api/package.json ./package.json
EXPOSE 4000
CMD ["node", "dist/index.js"]
