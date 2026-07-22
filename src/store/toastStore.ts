import { create } from 'zustand'

interface ToastState {
  message: string | null
  show: (message: string) => void
}

let timeoutId: ReturnType<typeof setTimeout> | undefined

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  show: (message) => {
    if (timeoutId) clearTimeout(timeoutId)
    set({ message })
    timeoutId = setTimeout(() => set({ message: null }), 2500)
  },
}))

export function comingSoon() {
  useToastStore.getState().show('Em breve')
}
