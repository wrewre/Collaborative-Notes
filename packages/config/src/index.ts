import { z } from 'zod'

// ─── API Service Env ──────────────────────────────────────────────────────────

const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_ACCESS_KEY: z.string().default('minioadmin'),
  S3_SECRET_KEY: z.string().default('minioadmin'),
  S3_BUCKET: z.string().default('collab-notes'),
  S3_REGION: z.string().default('us-east-1'),
})

// ─── Collab Service Env ───────────────────────────────────────────────────────

const collabEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4001),
  REDIS_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
})

// ─── Exports ─────────────────────────────────────────────────────────────────

export type ApiEnv = z.infer<typeof apiEnvSchema>
export type CollabEnv = z.infer<typeof collabEnvSchema>

export function validateApiEnv(env: NodeJS.ProcessEnv): ApiEnv {
  const result = apiEnvSchema.safeParse(env)
  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.format())
    process.exit(1)
  }
  return result.data
}

export function validateCollabEnv(env: NodeJS.ProcessEnv): CollabEnv {
  const result = collabEnvSchema.safeParse(env)
  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.format())
    process.exit(1)
  }
  return result.data
}
