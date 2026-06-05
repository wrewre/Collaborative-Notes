import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@collab-notes/types'
import { api } from '../../lib/api'

interface AuthState {
  user: User | null
  accessToken: string | null
  setAuth: (user: User, token: string) => void
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,

      setAuth: (user, accessToken) => {
        localStorage.setItem('access_token', accessToken)
        set({ user, accessToken })
      },

      logout: async () => {
        try { await api.delete('/auth/logout') } catch {}
        localStorage.removeItem('access_token')
        set({ user: null, accessToken: null })
        window.location.href = '/login'
      },

      fetchMe: async () => {
        try {
          const user = await api.get<User>('/auth/me')
          set({ user })
        } catch {
          get().logout()
        }
      },
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
    },
  ),
)
