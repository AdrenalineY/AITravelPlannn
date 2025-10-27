import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, ConfigStatus } from '@/types'

interface AuthState {
  user: User | null
  session: any
  isLoading: boolean
  error: string | null
  configStatus: ConfigStatus | null
  setUser: (user: User | null) => void
  setSession: (session: any) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  setConfigStatus: (status: ConfigStatus | null) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      isLoading: true,
      error: null,
      configStatus: null,
      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      setConfigStatus: (configStatus) => set({ configStatus }),
      reset: () =>
        set({
          user: null,
          session: null,
          isLoading: false,
          error: null,
          configStatus: null,
        }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        configStatus: state.configStatus,
      }),
    }
  )
)
