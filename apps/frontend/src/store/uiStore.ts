import { create } from 'zustand'

interface UiStore {
  // breadcrumb state managed by pages
  boardId: string | null
  boardName: string | null
  cardTitle: string | null
  setBoardCrumb: (id: string | null, name: string | null) => void
  setCardTitle: (title: string | null) => void
}

export const useUiStore = create<UiStore>((set) => ({
  boardId: null,
  boardName: null,
  cardTitle: null,
  setBoardCrumb: (id, name) => set({ boardId: id, boardName: name }),
  setCardTitle: (title) => set({ cardTitle: title }),
}))
