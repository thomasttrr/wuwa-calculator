// App-wide notices (a failed save, an unreadable file). Plain messages, shown until dismissed.
import { createStore } from 'zustand/vanilla'

interface NoticeState {
  messages: { id: number; text: string }[]
}

const store = createStore<NoticeState>(() => ({ messages: [] }))
let nextId = 1

export const notices = {
  store,
  show(text: string) {
    const messages = store.getState().messages
    if (messages.some((message) => message.text === text)) return
    store.setState({ messages: [...messages, { id: nextId++, text }] })
  },
  dismiss(id: number) {
    store.setState({ messages: store.getState().messages.filter((message) => message.id !== id) })
  },
}
