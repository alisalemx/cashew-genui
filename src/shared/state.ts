import {
  CATEGORIES,
  CONTACTS,
  allocation,
  categoryByMonth,
  categoryName,
  categoryTotals,
  getAccounts,
  getBills,
  getHoldings,
  getPortfolioHistory,
  getTransactions,
  isSpending,
  monthLabel,
  monthToDate,
  netWorth,
  recentMonths,
  spendingByMonth,
  topMerchants,
  type CategoryId,
  type Transaction,
} from "./data"

// The bank's state model. Jev's cards bind to paths in here with $state, so
// the numbers live in one place, never pass through the model, and update
// everywhere at once when a transfer goes out.

export interface TxnRow {
  date: string
  merchant: string
  category: string
  amount: number
}

const row = (t: Transaction): TxnRow => ({
  date: t.date,
  merchant: t.merchant,
  category:
    t.category === "income" ? "Income" : t.category === "transfer" ? "Transfer" : categoryName(t.category),
  amount: t.amount,
})

const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 1000) / 10 : 0)

export function buildBankState() {
  const accounts = getAccounts()
  // The savings and TFSA side of each transfer would show every move twice,
  // so the activity cards follow chequing and the Visa, like a bank's feed.
  const txns = getTransactions().filter((t) => t.account === "chequing" || t.account === "visa")
  const [lastMonth, thisMonth] = recentMonths(2)
  const months = spendingByMonth(6)
  const fullMonths = months.slice(0, -1)
  const average = Math.round(fullMonths.reduce((s, m) => s + m.amount, 0) / fullMonths.length)
  const mtd = monthToDate()
  const history = getPortfolioHistory()
  const first = history[0].value
  const last = history.at(-1)!.value

  const byCategory: Record<string, TxnRow[]> = {}
  const trends: Record<string, { label: string; amount: number }[]> = {}
  for (const c of CATEGORIES) {
    byCategory[c.id] = txns
      .filter((t) => t.category === c.id && t.date >= `${lastMonth}-01`)
      .slice(0, 10)
      .map(row)
    trends[c.id] = categoryByMonth(c.id as CategoryId).map(({ label, amount }) => ({ label, amount }))
  }

  const total = (mk: string) => categoryTotals(mk).reduce((s, c) => s + c.amount, 0)

  return {
    accounts: accounts.map((a) => ({
      name: a.name,
      kind: a.kind,
      lastFour: a.lastFour,
      balance: a.balance,
      detail:
        a.kind === "credit"
          ? `Owing, ${fmt(a.creditLimit! - a.balance)} available`
          : a.kind === "savings"
            ? `${a.interestRate}% interest`
            : a.kind === "investment"
              ? "Tax-free savings account"
              : "Available",
    })),
    chequing: accounts[0].balance,
    netWorth: netWorth(),
    spending: {
      months: months.map(({ label, amount }) => ({ label, amount })),
      average,
      thisMonth: { label: monthLabel(thisMonth, "long"), total: total(thisMonth), categories: categoryTotals(thisMonth) },
      lastMonth: { label: monthLabel(lastMonth, "long"), total: total(lastMonth), categories: categoryTotals(lastMonth) },
      monthToDate: {
        current: mtd.current,
        previous: mtd.previous,
        change: pct(mtd.current, mtd.previous),
        currentLabel: `${monthLabel(thisMonth)} 1 to ${mtd.day}`,
        caption: `against ${monthLabel(lastMonth)} 1 to ${mtd.day}`,
        previousLabel: `${monthLabel(lastMonth)} 1 to ${mtd.day}`,
      },
      merchantsThisMonth: topMerchants(thisMonth),
      merchantsLastMonth: topMerchants(lastMonth),
    },
    categories: { recent: byCategory, trends },
    transactions: {
      recent: txns.slice(0, 10).map(row),
      income: txns.filter((t) => t.category === "income" && t.account === "chequing").slice(0, 6).map(row),
      largestThisMonth: txns
        .filter((t) => isSpending(t) && t.date.startsWith(thisMonth))
        .sort((a, b) => a.amount - b.amount)
        .slice(0, 6)
        .map(row),
    },
    transfers: {
      recent: txns.filter((t) => t.merchant.startsWith("e-Transfer")).slice(0, 8).map(row),
    },
    contacts: CONTACTS,
    bills: getBills().slice(0, 6),
    portfolio: {
      value: last,
      change: pct(last, first),
      points: history,
      holdings: getHoldings().map(({ symbol, name, value, returnPct }) => ({ symbol, name, value, returnPct })),
      allocation: allocation(),
    },
  }
}

export type BankState = ReturnType<typeof buildBankState>

/**
 * The parts of the bank an e-Transfer changes, as store updates. The page
 * applies them when Jordan confirms a transfer, and the Worker replays the
 * session's transfers the same way, so both see the same balances.
 */
export function transferUpdates(state: BankState, t: { contactId: string; amount: number; date: string }) {
  const contact = CONTACTS.find((c) => c.id === t.contactId)
  const chequing = Math.round((state.chequing - t.amount) * 100) / 100
  const row: TxnRow = { date: t.date, merchant: `e-Transfer to ${contact?.name ?? "contact"}`, category: "Transfer", amount: -t.amount }
  return {
    "/chequing": chequing,
    "/netWorth": Math.round((state.netWorth - t.amount) * 100) / 100,
    "/accounts": state.accounts.map((a, i) => (i === 0 ? { ...a, balance: chequing } : a)),
    "/transactions/recent": [row, ...state.transactions.recent].slice(0, 10),
    "/transfers/recent": [row, ...state.transfers.recent].slice(0, 8),
  }
}

/** The bank as it stands after this session's transfers. */
export function bankStateWith(transfers: { contactId: string; amount: number; date: string }[]): BankState {
  let state = buildBankState()
  for (const t of transfers) {
    const u = transferUpdates(state, t)
    state = {
      ...state,
      chequing: u["/chequing"],
      netWorth: u["/netWorth"],
      accounts: u["/accounts"],
      transactions: { ...state.transactions, recent: u["/transactions/recent"] },
      transfers: { ...state.transfers, recent: u["/transfers/recent"] },
    }
  }
  return state
}

export function fmt(n: number) {
  return n.toLocaleString("en-CA", { style: "currency", currency: "CAD" })
}
