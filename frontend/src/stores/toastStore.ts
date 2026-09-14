import { create } from 'zustand'

export type ToastTipo = 'success' | 'warning' | 'error' | 'info'

export interface ToastItem {
  id: string
  tipo: ToastTipo
  titulo: string
  mensagem?: string
  duracao?: number
}

export interface ToastState {
  toasts: ToastItem[]
  adicionarToast: (toast: Omit<ToastItem, 'id'>) => void
  removerToast: (id: string) => void
  limparToasts: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  adicionarToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    const novoToast: ToastItem = { ...toast, id }

    set((state) => ({
      toasts: [...state.toasts, novoToast],
    }))

    const duracao = toast.duracao ?? 4000
    if (duracao > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }))
      }, duracao)
    }
  },

  removerToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }))
  },

  limparToasts: () => {
    set({ toasts: [] })
  },
}))
