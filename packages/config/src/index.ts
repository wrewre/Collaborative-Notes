import { z } from 'zod'

// ─── API Service Env ──────────────────────────────────────────────────────────

const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required'),
  CLERK_PUBLISHABLE_KEY: z.string().min(1, 'CLERK_PUBLISHABLE_KEY is required'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
})

// ─── Exports ─────────────────────────────────────────────────────────────────

export type ApiEnv = z.infer<typeof apiEnvSchema>

export function validateApiEnv(env: NodeJS.ProcessEnv): ApiEnv {
  const result = apiEnvSchema.safeParse(env)
  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.format())
    process.exit(1)
  }
  return result.data
}
