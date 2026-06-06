import { SignIn } from '@clerk/clerk-react'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900">
      <div className="flex flex-col items-center gap-6">
        <div className="text-center mb-2">
          <h1 className="text-3xl font-bold text-white tracking-tight">Welcome back</h1>
          <p className="text-slate-400 mt-1">Sign in to your Collaborative Notes workspace</p>
        </div>
        <SignIn
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          afterSignInUrl="/dashboard"
          appearance={{
            variables: {
              colorPrimary: '#8b5cf6',
              colorBackground: '#1e1b4b',
              colorText: '#f1f5f9',
              colorInputBackground: '#312e81',
              colorInputText: '#f1f5f9',
              borderRadius: '0.75rem',
            },
            elements: {
              card: 'shadow-2xl border border-purple-800/30 backdrop-blur-xl',
              headerTitle: 'hidden',
              headerSubtitle: 'hidden',
            },
          }}
        />
      </div>
    </div>
  )
}
