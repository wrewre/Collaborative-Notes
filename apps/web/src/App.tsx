import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn, useUser, useAuth } from '@clerk/clerk-react'
import WorkspacePage from './features/workspace/WorkspacePage'
import EditorPage from './features/editor/EditorPage'
import LandingPage from './features/landing/LandingPage'
import LoginPage from './features/auth/LoginPage'
import RegisterPage from './features/auth/RegisterPage'
import { api } from './lib/api'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY — copy .env.example to .env.local and fill it in')
}

/**
 * SyncUser: After sign-in, syncs the Clerk user into our Postgres database
 * via POST /auth/sync, then redirects to the user's workspace.
 */
function SyncUser() {
  const { isSignedIn, isLoaded, user } = useUser()
  const { getToken } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return

    // Make sure the Clerk token is available to the API client
    // then sync user profile to our DB
    getToken().then(async () => {
      try {
        await api.post('/auth/sync')
      } catch (e) {
        console.warn('User sync failed — continuing anyway', e)
      }
      navigate('/w/select', { replace: true })
    })
  }, [isSignedIn, isLoaded, user, navigate, getToken])

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-400 text-sm">Signing you in...</p>
      </div>
    </div>
  )
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/sign-in/*" element={<LoginPage />} />
      <Route path="/sign-up/*" element={<RegisterPage />} />

      {/* /dashboard — sync user then redirect to workspace */}
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <SyncUser />
          </PrivateRoute>
        }
      />

      {/* Protected workspace routes */}
      <Route
        path="/w/:workspaceId"
        element={
          <PrivateRoute>
            <WorkspacePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/w/:workspaceId/notes/:noteId"
        element={
          <PrivateRoute>
            <EditorPage />
          </PrivateRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
    >
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ClerkProvider>
  )
}
