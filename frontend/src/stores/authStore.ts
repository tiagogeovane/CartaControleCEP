import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { UsuarioResponse } from '@/types/api'

export interface AuthState {
  token: string | null
  usuario: UsuarioResponse | null
  isAuthenticated: boolean
  login: (token: string, usuario: UsuarioResponse) => void
  logout: () => void
  setToken: (token: string | null) => void
  setUsuario: (usuario: UsuarioResponse | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      usuario: null,
      isAuthenticated: false,

      login: (token: string, usuario: UsuarioResponse) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('cep_auth_token', token)
        }
        set({
          token,
          usuario,
          isAuthenticated: true,
        })
      },

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('cep_auth_token')
        }
        set({
          token: null,
          usuario: null,
          isAuthenticated: false,
        })
      },

      setToken: (token: string | null) => {
        if (typeof window !== 'undefined') {
          if (token) {
            localStorage.setItem('cep_auth_token', token)
          } else {
            localStorage.removeItem('cep_auth_token')
          }
        }
        set({
          token,
          isAuthenticated: Boolean(token),
        })
      },

      setUsuario: (usuario: UsuarioResponse | null) => {
        set({ usuario })
      },
    }),
    {
      name: 'cep_auth_storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        usuario: state.usuario,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
