/**
 * auth.store.ts
 *
 * With Clerk, we no longer manage tokens or user state manually.
 * Clerk's <ClerkProvider> and hooks (useUser, useAuth, useClerk)
 * handle all of that.
 *
 * This file now just exports a helper to get the Clerk token
 * so it can be passed to API calls and WebSocket connections.
 */

export async function getAuthToken(): Promise<string | null> {
  // Clerk exposes window.Clerk after initialization
  try {
    const clerk = (window as any).Clerk
    if (!clerk?.session) return null
    return await clerk.session.getToken()
  } catch {
    return null
  }
}
