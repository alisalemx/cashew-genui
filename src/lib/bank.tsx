import { createStateStore, type StateStore } from "@json-render/core"
import { createContext, use, useMemo, useRef, useState, type ReactNode } from "react"
import { CONTACTS, isoDate, today, type Contact } from "@/shared/data"
import type { SessionTransfer } from "@/shared/protocol"
import { buildBankState, transferUpdates, type BankState } from "@/shared/state"

// One store holds Jordan's bank for the whole page. The dashboard and every
// card Jev picks read from it, so a transfer shows up everywhere at once.

interface Bank {
  store: StateStore
  contacts: Contact[]
  transfers: SessionTransfer[]
  sendTransfer: (t: Omit<SessionTransfer, "date">) => void
}

const BankContext = createContext<Bank | null>(null)

export function BankProvider({ children }: { children: ReactNode }) {
  const store = useRef(createStateStore(buildBankState())).current
  const [transfers, setTransfers] = useState<SessionTransfer[]>([])

  const value = useMemo<Bank>(
    () => ({
      store,
      contacts: CONTACTS,
      transfers,
      sendTransfer: ({ contactId, amount, note }) => {
        const transfer = { contactId, amount, note, date: isoDate(today()) }
        store.update(transferUpdates(store.getSnapshot() as unknown as BankState, transfer))
        setTransfers((list) => [...list, transfer])
      },
    }),
    [store, transfers],
  )

  return <BankContext value={value}>{children}</BankContext>
}

export function useBank() {
  const bank = use(BankContext)
  if (!bank) throw new Error("useBank needs a BankProvider")
  return bank
}
