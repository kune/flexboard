import { create } from 'zustand'

interface UiStore {
  // breadcrumb state managed by pages
  boardName: string | null
  setBoardName: (name: string | null) => void
}

export const useUiStore = create<UiStore>((set) => ({
  boardName: null,
  setBoardName: (name) => set({ boardName: name }),
}))
