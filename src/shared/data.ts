// Cashew is a made-up bank. Everything here is generated from a fixed seed so
// the same customer, merchants, and story show up on every visit, anchored to
// the current date so the demo never looks stale.
//
// There's a year of history so visitors can ask their own questions and find
// something real behind them: a raise, a tax refund, two trips, holiday
// spending, subscriptions that went up, a card balance carried once, savings
// goals, budgets, cash back, and a credit score. A few oddities are planted
// for "anything unusual?": a double charge, a refund, and a surprise renewal.

export type CategoryId =
  | "groceries"
  | "dining"
  | "transport"
  | "shopping"
  | "entertainment"
  | "subscriptions"
  | "utilities"
  | "health"
  | "travel"
  | "housing"
  | "gifts"
  | "cash"
  | "fees"

export interface Category {
  id: CategoryId
  name: string
}

export const CATEGORIES: Category[] = [
  { id: "housing", name: "Housing" },
  { id: "groceries", name: "Groceries" },
  { id: "dining", name: "Dining" },
  { id: "transport", name: "Transport" },
  { id: "shopping", name: "Shopping" },
  { id: "travel", name: "Travel" },
  { id: "utilities", name: "Bills and utilities" },
  { id: "entertainment", name: "Entertainment" },
  { id: "subscriptions", name: "Subscriptions" },
  { id: "health", name: "Health" },
  { id: "gifts", name: "Gifts and donations" },
  { id: "cash", name: "Cash" },
  { id: "fees", name: "Fees and interest" },
]

export const categoryName = (id: CategoryId) =>
  CATEGORIES.find((c) => c.id === id)?.name ?? id

export type AccountId = "chequing" | "savings" | "visa" | "tfsa"

export interface Account {
  id: AccountId
  name: string
  kind: "chequing" | "savings" | "credit" | "investment"
  lastFour: string
  balance: number
  creditLimit?: number
  interestRate?: number
}

export interface Transaction {
  id: string
  date: string // YYYY-MM-DD
  merchant: string
  category: CategoryId | "income" | "transfer"
  amount: number // negative is money out
  account: AccountId
  memo?: string
  /** The original amount, for purchases made in another currency. */
  foreign?: { currency: "USD"; amount: number; rate: number }
}

export interface Contact {
  id: string
  name: string
  email: string
  initials: string
}

export interface Bill {
  id: string
  name: string
  due: string
  amount: number
  autopay: boolean
  account: AccountId
}

export interface Holding {
  symbol: string
  name: string
  assetClass: "Equity" | "Fixed income" | "Cash"
  units: number
  price: number
  value: number
  costBasis: number
  returnPct: number
}

export const CUSTOMER = { firstName: "Jordan", lastName: "Lee" }

export const CONTACTS: Contact[] = [
  { id: "maya", name: "Maya Patel", email: "maya.patel@example.com", initials: "MP" },
  { id: "sam", name: "Sam Okafor", email: "sam.okafor@example.com", initials: "SO" },
  { id: "lina", name: "Lina Haddad", email: "lina.haddad@example.com", initials: "LH" },
  { id: "theo", name: "Theo Martin", email: "theo.martin@example.com", initials: "TM" },
  { id: "priya", name: "Priya Shah", email: "priya.shah@example.com", initials: "PS" },
]

// ---------------------------------------------------------------------------
// Dates

const pad = (n: number) => String(n).padStart(2, "0")
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// Jordan banks in Toronto, so "today" is Toronto's date on both the server
// and the browser, whatever time zone either one runs in.
const torontoDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export function today(): Date {
  const [y, m, d] = torontoDate.format(new Date()).split("-").map(Number)
  return new Date(y, m - 1, d)
}

export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

export function monthLabel(key: string, style: "short" | "long" = "short") {
  const [y, m] = key.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleString("en-CA", { month: style })
}

/** The last `count` month keys, oldest first, ending with the current month. */
export function recentMonths(count: number, from = today()): string[] {
  const keys: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    keys.push(monthKey(new Date(from.getFullYear(), from.getMonth() - i, 1)))
  }
  return keys
}

/** How many months of history there are, the current month included. */
export const HISTORY_MONTHS = 13

const daysAgo = (n: number, from = today()) => new Date(from.getFullYear(), from.getMonth(), from.getDate() - n)

// ---------------------------------------------------------------------------
// Seeded randomness

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100

// ---------------------------------------------------------------------------
// Transactions

interface Pattern {
  merchant: string
  category: CategoryId
  perMonth: [number, number]
  amount: [number, number]
  account?: AccountId
  /** Round amounts to this, like $20 notes from an ATM. */
  step?: number
}

const PATTERNS: Pattern[] = [
  { merchant: "Loblaws", category: "groceries", perMonth: [3, 4], amount: [62, 148] },
  { merchant: "No Frills", category: "groceries", perMonth: [2, 3], amount: [28, 71] },
  { merchant: "Farm Boy", category: "groceries", perMonth: [1, 2], amount: [22, 54] },
  { merchant: "Tim Hortons", category: "dining", perMonth: [5, 8], amount: [3.2, 11.5] },
  { merchant: "Pai Northern Thai", category: "dining", perMonth: [1, 2], amount: [38, 86] },
  { merchant: "Uber Eats", category: "dining", perMonth: [2, 4], amount: [24, 52] },
  { merchant: "Balzac's Coffee", category: "dining", perMonth: [3, 5], amount: [4.5, 9.8] },
  { merchant: "Presto", category: "transport", perMonth: [2, 3], amount: [20, 40], account: "chequing" },
  { merchant: "Uber", category: "transport", perMonth: [1, 3], amount: [12, 34] },
  { merchant: "Bike Share Toronto", category: "transport", perMonth: [0, 1], amount: [15, 15] },
  { merchant: "Amazon.ca", category: "shopping", perMonth: [1, 3], amount: [18, 96] },
  { merchant: "Uniqlo", category: "shopping", perMonth: [0, 1], amount: [39, 129] },
  { merchant: "Shoppers Drug Mart", category: "health", perMonth: [1, 2], amount: [9, 46] },
  { merchant: "Cineplex", category: "entertainment", perMonth: [0, 2], amount: [16, 38] },
  { merchant: "Ticketmaster", category: "entertainment", perMonth: [0, 1], amount: [64, 140] },
  { merchant: "ATM withdrawal", category: "cash", perMonth: [0, 2], amount: [40, 120], account: "chequing", step: 20 },
]

/**
 * Fixed monthly charges on a set day. Months are counted back from this one,
 * so 0 is this month: `since` is the first month charged, `until` the last,
 * and `raised` the first month at today's price, with `was` before it.
 */
interface Recurring {
  merchant: string
  category: CategoryId
  day: number
  amount: number
  account: AccountId
  since?: number
  until?: number
  raised?: number
  was?: number
}

const RECURRING: Recurring[] = [
  { merchant: "Rent, 88 Harbord St", category: "housing", day: 1, amount: 2150, account: "chequing" },
  { merchant: "Square One Insurance", category: "housing", day: 8, amount: 21.5, account: "chequing" },
  { merchant: "Spotify", category: "subscriptions", day: 4, amount: 11.99, account: "visa", raised: 2, was: 10.99 },
  { merchant: "Netflix", category: "subscriptions", day: 9, amount: 20.99, account: "visa", raised: 3, was: 18.99 },
  { merchant: "iCloud+", category: "subscriptions", day: 12, amount: 3.99, account: "visa" },
  { merchant: "Crave", category: "subscriptions", day: 27, amount: 9.99, account: "visa", since: 1 },
  { merchant: "Disney+", category: "subscriptions", day: 18, amount: 11.99, account: "visa", until: 5 },
  { merchant: "Rogers", category: "utilities", day: 22, amount: 85, account: "chequing" },
  { merchant: "GoodLife Fitness", category: "health", day: 15, amount: 54.99, account: "visa" },
  { merchant: "Daily Bread Food Bank", category: "gifts", day: 20, amount: 25, account: "visa" },
]

/** Toronto Hydro by calendar month: electric heat in winter, air conditioning in summer. */
const HYDRO = [96.4, 91.2, 78.6, 66.1, 58.3, 71.8, 84.2, 82.5, 64.7, 61.3, 72.9, 89.6]

/** Charged once a year, on a set calendar month and day. */
const YEARLY: { merchant: string; category: CategoryId; month: number; day: number; amount: number; account: AccountId }[] = [
  { merchant: "Duolingo Super", category: "subscriptions", month: 1, day: 11, amount: 119.99, account: "visa" },
  { merchant: "Amazon Prime", category: "subscriptions", month: 3, day: 3, amount: 99, account: "visa" },
]

// Jordan's pay went up this many months ago, from the old amount.
const PAY = { now: 2560, before: 2450, raised: 3 }

const SAVINGS_TRANSFER = 400
const TFSA_TRANSFER = 350
const VISA_RATE = 20.99
const SAVINGS_RATE = 3.1
const USD_RATE = 1.3763
const FX_FEE = 0.025

/** Dining creeps up over the last seven months, and last month had a trip. */
function monthModifiers(ago: number) {
  return {
    dining: 1 + Math.max(0, 6 - ago) * 0.07,
    montebello: ago === 1,
    newYork: ago === 5,
  }
}

// e-Transfers with friends: [amount, contact, days ago, memo].
const E_TRANSFERS: [number, string, number, string][] = [
  [-25, "theo", 5, "Coffee beans"],
  [65, "lina", 12, "Birthday gift for Noor"],
  [-120, "sam", 21, "Cottage groceries"],
  [-40, "maya", 34, "Dinner at Pai"],
  [-18, "priya", 47, "Lunch"],
  [150, "priya", 88, "Osheaga ticket"],
  [-85, "maya", 121, "Concert tickets"],
  [-30, "lina", 152, "Flowers for Dana"],
  [60, "maya", 198, "Uber home"],
  [-45, "sam", 259, "Raptors tickets"],
  [-200, "theo", 301, "Moving help, thank you"],
  [-40, "sam", 344, "Secret Santa"],
]

const DISTRIBUTIONS: { symbol: string; perUnit: number; months: number[] }[] = [
  { symbol: "CCDV", perUnit: 0.11, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { symbol: "CBND", perUnit: 0.058, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { symbol: "CGEQ", perUnit: 0.19, months: [3, 6, 9, 12] },
]

/** Cash back on the Cashew Visa: 2% on groceries and dining, 1% on everything else. */
export const cashBack = (t: Transaction) =>
  t.account === "visa" && isCategorized(t) && t.category !== "fees"
    ? -t.amount * (t.category === "groceries" || t.category === "dining" ? 0.02 : 0.01)
    : 0

let cache: { key: string; transactions: Transaction[] } | null = null

export function getTransactions(): Transaction[] {
  const now = today()
  const key = isoDate(now)
  if (cache?.key === key) return cache.transactions

  const months = recentMonths(HISTORY_MONTHS, now)
  const rand = mulberry32(20261016)
  const pick = ([min, max]: [number, number]) => min + rand() * (max - min)
  const txns: Transaction[] = []
  let n = 0
  const push = (date: Date, merchant: string, category: Transaction["category"], amount: number, account: AccountId, extra: Partial<Transaction> = {}) => {
    if (date > now || date < new Date(now.getFullYear(), now.getMonth() - HISTORY_MONTHS + 1, 1)) return
    txns.push({ id: `t${++n}`, date: isoDate(date), merchant, category, amount: round2(amount), account, ...extra })
  }
  const usd = (date: Date, merchant: string, category: CategoryId, dollars: number) => {
    const cad = round2(dollars * USD_RATE)
    push(date, merchant, category, -cad, "visa", { foreign: { currency: "USD", amount: dollars, rate: USD_RATE } })
    push(date, "Foreign transaction fee", "fees", -round2(cad * FX_FEE), "visa", { memo: merchant })
  }

  months.forEach((mk, index) => {
    const [y, m] = mk.split("-").map(Number)
    const ago = months.length - 1 - index
    const daysInMonth = new Date(y, m, 0).getDate()
    const on = (day: number) => new Date(y, m - 1, Math.min(day, daysInMonth))
    const mod = monthModifiers(ago)

    for (const r of RECURRING) {
      if (r.since != null && ago > r.since) continue
      if (r.until != null && ago < r.until) continue
      const amount = r.raised != null && ago > r.raised ? r.was! : r.amount
      push(on(r.day), r.merchant, r.category, -amount, r.account)
    }
    push(on(25), "Toronto Hydro", "utilities", -HYDRO[m - 1], "chequing")
    for (const r of YEARLY) if (r.month === m) push(on(r.day), r.merchant, r.category, -r.amount, r.account)

    // Paid twice a month, on the 15th and the last day.
    const pay = ago > PAY.raised ? PAY.before : PAY.now
    push(on(15), "Payroll, Northwind Studio", "income", pay, "chequing")
    push(on(daysInMonth), "Payroll, Northwind Studio", "income", pay, "chequing")

    // Money Jordan sets aside every month.
    push(on(16), "Transfer to savings", "transfer", -SAVINGS_TRANSFER, "chequing")
    push(on(16), "Transfer from chequing", "transfer", SAVINGS_TRANSFER, "savings")
    push(on(17), "Transfer to TFSA", "transfer", -TFSA_TRANSFER, "chequing")
    push(on(17), "Contribution from chequing", "transfer", TFSA_TRANSFER, "tfsa")

    for (const d of DISTRIBUTIONS) {
      if (!d.months.includes(m)) continue
      const h = HOLDINGS_BASE.find((x) => x.symbol === d.symbol)!
      push(on(28), `Distribution, ${d.symbol}`, "income", h.units * d.perUnit, "tfsa")
    }

    for (const p of PATTERNS) {
      const count = Math.round(pick(p.perMonth))
      for (let i = 0; i < count; i++) {
        let amount = pick(p.amount)
        if (p.category === "dining") amount *= mod.dining
        if (p.step) amount = Math.round(amount / p.step) * p.step
        const day = 1 + Math.floor(rand() * daysInMonth)
        push(on(day), p.merchant, p.category, -amount, p.account ?? "visa")
      }
    }

    // Seasons and one-offs.
    if (m === 12) {
      push(on(6), "Indigo", "shopping", -86.4, "visa")
      push(on(12), "Simons", "shopping", -142.75, "visa")
      push(on(14), "Best Buy", "shopping", -329.99, "visa")
      push(on(19), "VIA Rail", "travel", -184.6, "visa", { memo: "Toronto to Ottawa and back" })
      push(on(23), "LCBO", "groceries", -64.2, "visa")
      push(on(29), "CanadaHelps", "gifts", -150, "visa")
    }
    if (m === 11) push(on(14), "Movember", "gifts", -50, "visa")
    if (m === 2) {
      push(on(14), "Bar Isabel", "dining", -168.4, "visa")
      push(on(21), "Blue Mountain Resort", "travel", -389, "visa")
    }
    if (m === 5) {
      push(on(6), "CRA tax refund", "income", 1284.37, "chequing")
      push(on(12), "Transfer to TFSA", "transfer", -1500, "chequing", { memo: "Tax refund" })
      push(on(12), "Contribution from chequing", "transfer", 1500, "tfsa", { memo: "Tax refund" })
    }
    if (ago === 11) push(on(20), "Fieldnote Press", "income", 1450, "chequing", { memo: "Invoice 014, brand illustrations" })
    if (ago === 4) push(on(9), "Fieldnote Press", "income", 950, "chequing", { memo: "Invoice 019, book cover" })
    if (ago === 7) push(on(11), "ATM fee, other bank", "fees", -3.5, "chequing")

    if (mod.newYork) {
      push(on(7), "Porter Airlines", "travel", -418.6, "visa", { memo: "Toronto to Newark and back" })
      usd(on(22), "Ace Hotel New York", "travel", 612)
      usd(on(23), "Joe's Pizza", "dining", 14.5)
      usd(on(23), "MoMA", "entertainment", 30)
      usd(on(24), "Katz's Delicatessen", "dining", 38.4)
      usd(on(24), "Uber", "transport", 42.1)
    }
    if (mod.montebello) {
      push(on(6), "Air Canada", "travel", -642.18, "visa")
      push(on(19), "Fairmont Le Château Montebello", "travel", -812.4, "visa")
      push(on(20), "Le Bouchon", "dining", -146.3, "visa")
      push(on(21), "Enterprise Rent-A-Car", "travel", -238.9, "visa")
    }
  })

  // Planted for "anything unusual?": Uber Eats charged twice for one order,
  // an Amazon return, and an annual MasterClass renewal Jordan may have
  // forgotten about.
  const doubled = daysAgo(Math.min(3, now.getDate() - 1), now)
  push(doubled, "Uber Eats", "dining", -38.62, "visa")
  push(doubled, "Uber Eats", "dining", -38.62, "visa")
  push(daysAgo(20, now), "Amazon.ca", "shopping", -54.99, "visa", { memo: "Desk lamp" })
  push(daysAgo(6, now), "Amazon.ca", "shopping", 54.99, "visa", { memo: "Refund, desk lamp" })
  push(daysAgo(9, now), "MasterClass", "subscriptions", -239, "visa", { memo: "Annual renewal" })
  push(daysAgo(9 + 365, now), "MasterClass", "subscriptions", -239, "visa", { memo: "Annual membership" })
  usd(daysAgo(26, now), "Bandcamp", "entertainment", 24)

  for (const [amount, contactId, ago, memo] of E_TRANSFERS) {
    const c = CONTACTS.find((x) => x.id === contactId)!
    push(daysAgo(ago, now), `e-Transfer ${amount < 0 ? "to" : "from"} ${c.name}`, "transfer", amount, "chequing", { memo })
  }

  settleVisa(txns, months, push)
  payInterest(txns, months, push)

  txns.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id, "en", { numeric: true })))
  cache = { key, transactions: txns }
  return txns
}

type Push = (date: Date, merchant: string, category: Transaction["category"], amount: number, account: AccountId, extra?: Partial<Transaction>) => void

/** What went on the Visa in one month, less credits, not counting payments. */
const visaCharges = (txns: Transaction[], mk: string) =>
  -txns.filter((t) => t.account === "visa" && t.category !== "transfer" && t.date.startsWith(mk)).reduce((s, t) => s + t.amount, 0)

// Owing on the Visa when the history starts, paid on the 2nd of the first month.
const VISA_OPENING = 1640

/**
 * Jordan pays the Visa in full on the 2nd, except in January after the
 * holidays, when they paid part of it and were charged interest on the rest.
 * Cash back is paid out each January as a statement credit.
 */
function settleVisa(txns: Transaction[], months: string[], push: Push) {
  let carry = 0
  months.forEach((mk, i) => {
    const [y, m] = mk.split("-").map(Number)
    if (m === 1) {
      const lastYear = txns.filter((t) => t.date.startsWith(String(y - 1)))
      const seen = new Set(lastYear.map((t) => t.date.slice(0, 7))).size || 1
      const earned = lastYear.reduce((s, t) => s + cashBack(t), 0) * (12 / seen)
      push(new Date(y, 0, 10), "Cash back credit", "income", earned, "visa", { memo: `Cash back earned in ${y - 1}` })
    }
    if (carry > 0) {
      push(new Date(y, m - 1, 3), "Interest charge", "fees", -carry * (VISA_RATE / 100 / 12), "visa", { memo: "Purchase interest" })
    }
    const due = (i === 0 ? VISA_OPENING : visaCharges(txns, months[i - 1])) + carry
    const paid = m === 1 ? 1500 : due
    carry = round2(due - paid)
    push(new Date(y, m - 1, 2), "Visa payment", "transfer", -paid, "chequing")
    push(new Date(y, m - 1, 2), "Payment, thank you", "transfer", paid, "visa")
  })
}

/** Savings interest on the last day of each month, worked back from today's balance. */
function payInterest(txns: Transaction[], months: string[], push: Push) {
  let balance = SAVINGS_BALANCE
  for (let i = months.length - 1; i >= 0; i--) {
    const mk = months[i]
    const [y, m] = mk.split("-").map(Number)
    const last = new Date(y, m, 0)
    if (last <= today()) {
      const before = balance / (1 + SAVINGS_RATE / 100 / 12)
      push(last, "Interest", "income", balance - before, "savings")
      balance = before
    }
    balance -= txns.filter((t) => t.account === "savings" && t.date.startsWith(mk) && t.merchant !== "Interest").reduce((s, t) => s + t.amount, 0)
  }
}

// ---------------------------------------------------------------------------
// Accounts, bills, and investments

const CHEQUING_BALANCE = 4862.4
const SAVINGS_BALANCE = 18240

export function getAccounts(): Account[] {
  return [
    { id: "chequing", name: "Everyday chequing", kind: "chequing", lastFour: "4821", balance: CHEQUING_BALANCE },
    { id: "savings", name: "High-interest savings", kind: "savings", lastFour: "7730", balance: SAVINGS_BALANCE, interestRate: SAVINGS_RATE },
    { id: "visa", name: "Cashew Visa", kind: "credit", lastFour: "1094", balance: round2(visaBalance()), creditLimit: 8000 },
    { id: "tfsa", name: "TFSA", kind: "investment", lastFour: "3305", balance: portfolioValue() },
  ]
}

/** What's owing: the opening balance plus every charge, less every payment. */
function visaBalance() {
  return VISA_OPENING - getTransactions()
    .filter((t) => t.account === "visa")
    .reduce((s, t) => s + t.amount, 0)
}

/** Every bill and recurring charge in the next five weeks, soonest first. */
export function getBills(): Bill[] {
  const now = today()
  const next = (day: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), day)
    return isoDate(d < now ? new Date(now.getFullYear(), now.getMonth() + 1, day) : d)
  }
  const visa = getAccounts().find((a) => a.id === "visa")!
  const lastHydro = getTransactions().find((t) => t.merchant === "Toronto Hydro")?.amount ?? -64
  const bills: Bill[] = [
    { id: "rent", name: "Rent", due: next(1), amount: 2150, autopay: false, account: "chequing" },
    { id: "visa", name: "Cashew Visa payment", due: next(3), amount: visa.balance, autopay: false, account: "chequing" },
    { id: "spotify", name: "Spotify", due: next(4), amount: 11.99, autopay: true, account: "visa" },
    { id: "insurance", name: "Square One Insurance", due: next(8), amount: 21.5, autopay: true, account: "chequing" },
    { id: "netflix", name: "Netflix", due: next(9), amount: 20.99, autopay: true, account: "visa" },
    { id: "icloud", name: "iCloud+", due: next(12), amount: 3.99, autopay: true, account: "visa" },
    { id: "goodlife", name: "GoodLife Fitness", due: next(15), amount: 54.99, autopay: true, account: "visa" },
    { id: "rogers", name: "Rogers", due: next(22), amount: 85, autopay: true, account: "chequing" },
    { id: "hydro", name: "Toronto Hydro", due: next(25), amount: -lastHydro, autopay: true, account: "chequing" },
    { id: "crave", name: "Crave", due: next(27), amount: 9.99, autopay: true, account: "visa" },
  ]
  for (const y of YEARLY) {
    let d = new Date(now.getFullYear(), y.month - 1, y.day)
    if (d < now) d = new Date(now.getFullYear() + 1, y.month - 1, y.day)
    if (d.getTime() - now.getTime() < 35 * 864e5) bills.push({ id: y.merchant, name: y.merchant, due: isoDate(d), amount: y.amount, autopay: true, account: y.account })
  }
  return bills.sort((a, b) => (a.due < b.due ? -1 : 1))
}

const HOLDINGS_BASE: Omit<Holding, "value" | "returnPct">[] = [
  { symbol: "CGEQ", name: "Cashew Global Equity ETF", assetClass: "Equity", units: 412, price: 41.36, costBasis: 14820 },
  { symbol: "CCDV", name: "Cashew Canadian Dividend ETF", assetClass: "Equity", units: 268, price: 33.08, costBasis: 8190 },
  { symbol: "MTEC", name: "Maple Tech Leaders", assetClass: "Equity", units: 54, price: 96.42, costBasis: 4310 },
  { symbol: "NREN", name: "Northern Renewables", assetClass: "Equity", units: 120, price: 18.75, costBasis: 2640 },
  { symbol: "CBND", name: "Cashew Canadian Bond Index", assetClass: "Fixed income", units: 310, price: 21.14, costBasis: 6820 },
  { symbol: "CASH", name: "Cash", assetClass: "Cash", units: 1, price: 1186.5, costBasis: 1186.5 },
]

export function getHoldings(): Holding[] {
  return HOLDINGS_BASE.map((h) => {
    const value = round2(h.units * h.price)
    return { ...h, value, returnPct: round2(((value - h.costBasis) / h.costBasis) * 100) }
  }).sort((a, b) => b.value - a.value)
}

export function portfolioValue() {
  return round2(getHoldings().reduce((s, h) => s + h.value, 0))
}

/** Weekly portfolio values for roughly the last six months, ending today. */
export function getPortfolioHistory(): { date: string; value: number }[] {
  const now = today()
  const rand = mulberry32(3305)
  const weeks = 27
  const end = portfolioValue()
  // Walk backwards from today's value so the series always lands on it.
  const values = [end]
  for (let i = 1; i < weeks; i++) {
    const shock = (rand() - 0.42) * 0.028
    const dip = i === 9 || i === 10 ? 0.025 : 0
    values.push(values[i - 1] / (1 + 0.0024 + shock - dip))
  }
  values.reverse()
  return values.map((v, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (weeks - 1 - i) * 7)
    return { date: isoDate(d), value: round2(v) }
  })
}

// The yearly TFSA limit set by the CRA, and the room Jordan carried in from
// earlier years.
const TFSA_LIMITS: Record<number, number> = { 2025: 7000, 2026: 7000 }
const TFSA_UNUSED_BEFORE = 6500

/** TFSA contributions and room for this calendar year, and distributions paid. */
export function getTfsaActivity() {
  const now = today()
  const year = now.getFullYear()
  const tfsa = getTransactions().filter((t) => t.account === "tfsa")
  const contributed = round2(tfsa.filter((t) => t.category === "transfer" && t.date.startsWith(String(year))).reduce((s, t) => s + t.amount, 0))
  const limit = TFSA_LIMITS[year] ?? 7000
  return {
    year,
    yearlyLimit: limit,
    unusedFromEarlierYears: TFSA_UNUSED_BEFORE,
    contributedThisYear: contributed,
    roomLeft: round2(TFSA_UNUSED_BEFORE + limit - contributed),
    monthlyContribution: TFSA_TRANSFER,
    distributionsThisYear: round2(tfsa.filter((t) => t.category === "income" && t.date.startsWith(String(year))).reduce((s, t) => s + t.amount, 0)),
    activity: tfsa.slice(0, 12),
  }
}

// ---------------------------------------------------------------------------
// Goals, budgets, card, and credit

const addMonths = (n: number, day: number) => {
  const now = today()
  return isoDate(new Date(now.getFullYear(), now.getMonth() + n, day))
}

/** Savings goals. They divide up the high-interest savings balance between them. */
export function getGoals() {
  return [
    { id: "emergency", name: "Emergency fund", target: 15000, saved: 12000, monthly: 0, due: null, started: addMonths(-30, 1), note: "Gets the savings interest, with no monthly transfer" },
    { id: "japan", name: "Japan trip", target: 6000, saved: 4140, monthly: 250, due: addMonths(6, 1), started: addMonths(-16, 16), note: null },
    { id: "laptop", name: "New laptop", target: 2800, saved: 2100, monthly: 150, due: addMonths(3, 0), started: addMonths(-14, 16), note: null },
  ].map((g) => ({ ...g, account: "High-interest savings", left: g.target - g.saved }))
}

/** Monthly spending limits Jordan set, by category. */
const BUDGETS: Partial<Record<CategoryId, number>> = {
  groceries: 650,
  dining: 450,
  transport: 160,
  shopping: 250,
  entertainment: 120,
  subscriptions: 60,
}

export function getBudgets(mk = monthKey(today())) {
  const totals = new Map(categoryTotals(mk).map((c) => [c.id, c.amount]))
  return Object.entries(BUDGETS).map(([id, limit]) => {
    const spent = totals.get(id as CategoryId) ?? 0
    return { category: categoryName(id as CategoryId), limit, spent, left: round2(limit - spent), usedPct: Math.round((spent / limit) * 100) }
  })
}

export function getCreditCard() {
  const now = today()
  const txns = getTransactions().filter((t) => t.account === "visa")
  const visa = getAccounts().find((a) => a.id === "visa")!
  const year = String(now.getFullYear())
  const lastPayment = txns.find((t) => t.merchant === "Payment, thank you")
  const lastCredit = txns.find((t) => t.merchant === "Cash back credit")
  const yearAgo = isoDate(daysAgo(365, now))
  return {
    name: visa.name,
    lastFour: visa.lastFour,
    status: "Active",
    expires: "08/29",
    creditLimit: visa.creditLimit!,
    balance: visa.balance,
    available: round2(visa.creditLimit! - visa.balance),
    utilizationPct: Math.round((visa.balance / visa.creditLimit!) * 100),
    purchaseRate: VISA_RATE,
    cashAdvanceRate: 22.99,
    annualFee: 0,
    foreignTransactionFee: `${FX_FEE * 100}%`,
    payment: {
      due: getBills().find((b) => b.id === "visa")!.due,
      amount: visa.balance,
      minimum: round2(Math.min(visa.balance, Math.max(10, visa.balance * 0.03))),
      lastPaid: lastPayment ? { date: lastPayment.date, amount: lastPayment.amount } : null,
      paysInFull: "Every month except January",
    },
    interestPaidLastYear: round2(-txns.filter((t) => t.merchant === "Interest charge" && t.date >= yearAgo).reduce((s, t) => s + t.amount, 0)),
    foreignFeesLastYear: round2(-txns.filter((t) => t.merchant === "Foreign transaction fee" && t.date >= yearAgo).reduce((s, t) => s + t.amount, 0)),
    cashBack: {
      rates: "2% on groceries and dining, 1% on everything else",
      earnedThisYear: round2(txns.filter((t) => t.date.startsWith(year)).reduce((s, t) => s + cashBack(t), 0)),
      earnedThisMonth: round2(txns.filter((t) => t.date.startsWith(monthKey(now))).reduce((s, t) => s + cashBack(t), 0)),
      paidOut: "Once a year, as a statement credit in January",
      lastPayout: lastCredit ? { date: lastCredit.date, amount: lastCredit.amount } : null,
    },
  }
}

/** Monthly credit score from Equifax, oldest first. */
export function getCreditScore() {
  const scores = [728, 731, 735, 733, 724, 727, 734, 740, 744, 749, 752, 757, 761]
  const months = recentMonths(scores.length)
  return {
    bureau: "Equifax",
    range: "300 to 900",
    score: scores.at(-1)!,
    rating: "Very good",
    updated: addMonths(0, 1),
    history: months.map((mk, i) => ({ month: mk, label: monthLabel(mk), score: scores[i] })),
    factors: [
      { factor: "Payment history", status: "No missed payments" },
      { factor: "Credit used", status: `${getCreditCard().utilizationPct}% of the Visa limit` },
      { factor: "Age of credit", status: "6 years, 4 months" },
      { factor: "Hard inquiries", status: "None in the last 12 months" },
      { factor: "Accounts", status: "1 credit card, no loans" },
    ],
  }
}

/** Every subscription and membership, including ones that ended, with price changes. */
export function getSubscriptions() {
  const txns = getTransactions()
  const charges = (merchant: string) => txns.filter((t) => t.merchant === merchant && t.amount < 0)
  const monthly = RECURRING.filter((r) => r.category === "subscriptions" || r.merchant === "GoodLife Fitness").map((r) => {
    const list = charges(r.merchant)
    const active = r.until == null
    const raisedOn = r.raised != null ? list.filter((t) => -t.amount === r.amount).at(-1)?.date ?? null : null
    return {
      name: r.merchant,
      cycle: "monthly",
      price: r.amount,
      yearlyCost: active ? round2(r.amount * 12) : 0,
      status: active ? "active" : "cancelled",
      firstCharged: list.at(-1)?.date ?? null,
      lastCharged: list[0]?.date ?? null,
      priceChange: r.raised != null ? { from: r.was, to: r.amount, firstChargedAtNewPrice: raisedOn } : null,
    }
  })
  const yearly = [...YEARLY.map((y) => ({ merchant: y.merchant, amount: y.amount })), { merchant: "MasterClass", amount: 239 }].map((y) => {
    const list = charges(y.merchant)
    return { name: y.merchant, cycle: "yearly", price: y.amount, yearlyCost: y.amount, status: "active", firstCharged: list.at(-1)?.date ?? null, lastCharged: list[0]?.date ?? null, priceChange: null }
  })
  return [...monthly, ...yearly]
}

/** Each account's balance at the end of every month, oldest first. */
export function balanceHistory(account: "chequing" | "savings") {
  const months = recentMonths(HISTORY_MONTHS)
  const txns = getTransactions().filter((t) => t.account === account)
  let balance = account === "chequing" ? CHEQUING_BALANCE : SAVINGS_BALANCE
  const out: { month: string; label: string; balance: number }[] = []
  for (let i = months.length - 1; i >= 0; i--) {
    out.push({ month: months[i], label: monthLabel(months[i]), balance: round2(balance) })
    balance -= txns.filter((t) => t.date.startsWith(months[i])).reduce((s, t) => s + t.amount, 0)
  }
  return out.reverse()
}

// ---------------------------------------------------------------------------
// Summaries

/** Purchases and refunds: everything except income and money moved between accounts. */
export const isCategorized = (t: Transaction): t is Transaction & { category: CategoryId } =>
  t.category !== "income" && t.category !== "transfer"

/** Money going out on a purchase. Refunds come in under a category too, as positive amounts. */
export const isSpending = (t: Transaction): t is Transaction & { category: CategoryId } => isCategorized(t) && t.amount < 0

// Totals are net of refunds, so a returned purchase doesn't count as spending.
const spent = (txns: Transaction[]) => round2(-txns.reduce((s, t) => s + t.amount, 0))

export function spendingByMonth(count = 6) {
  const months = recentMonths(count)
  const txns = getTransactions().filter(isCategorized)
  return months.map((mk) => ({
    month: mk,
    label: monthLabel(mk),
    amount: spent(txns.filter((t) => t.date.startsWith(mk))),
  }))
}

/** Spending by category over one month, or from `mk` through `through`. */
export function categoryTotals(mk: string, through = mk) {
  const txns = getTransactions().filter((t) => isCategorized(t) && t.date.slice(0, 7) >= mk && t.date.slice(0, 7) <= through)
  const total = spent(txns)
  return CATEGORIES.map((c) => {
    const amount = spent(txns.filter((t) => t.category === c.id))
    return { id: c.id, name: c.name, amount, share: total ? round2((amount / total) * 100) : 0 }
  })
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)
}

export function categoryByMonth(category: CategoryId, count = 6) {
  const txns = getTransactions().filter((t) => t.category === category)
  return recentMonths(count).map((mk) => ({
    month: mk,
    label: monthLabel(mk),
    amount: spent(txns.filter((t) => t.date.startsWith(mk))),
  }))
}

/** Spending this month so far, against the same days of last month. */
export function monthToDate() {
  const now = today()
  const day = now.getDate()
  const [prev, current] = recentMonths(2)
  const txns = getTransactions().filter(isCategorized)
  const sum = (mk: string) => spent(txns.filter((t) => t.date.startsWith(mk) && Number(t.date.slice(8)) <= day))
  return { current: sum(current), previous: sum(prev), currentMonth: current, previousMonth: prev, day }
}

/** Where the most went over one month, or from `mk` through `through`. */
export function topMerchants(mk: string, limit = 5, through = mk) {
  const totals = new Map<string, { amount: number; count: number; category: CategoryId }>()
  for (const t of getTransactions()) {
    const month = t.date.slice(0, 7)
    if (!isCategorized(t) || month < mk || month > through || t.category === "fees") continue
    const row = totals.get(t.merchant) ?? { amount: 0, count: 0, category: t.category }
    row.amount -= t.amount
    if (t.amount < 0) row.count += 1
    totals.set(t.merchant, row)
  }
  return [...totals.entries()]
    .map(([merchant, r]) => ({ merchant, amount: round2(r.amount), count: r.count, category: categoryName(r.category) }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
}

/** Money in, spending, and money set aside for each month, oldest first. */
export function cashFlow(count = 6) {
  const txns = getTransactions()
  return recentMonths(count).map((mk) => {
    const month = txns.filter((t) => t.date.startsWith(mk))
    const moneyIn = round2(month.filter((t) => t.category === "income" && t.account === "chequing").reduce((s, t) => s + t.amount, 0))
    const spending = spent(month.filter(isCategorized))
    const setAside = round2(-month.filter((t) => t.account === "chequing" && /^Transfer to (savings|TFSA)/.test(t.merchant)).reduce((s, t) => s + t.amount, 0))
    return { month: mk, label: monthLabel(mk), moneyIn, spending, setAside, left: round2(moneyIn - spending - setAside) }
  })
}

export function netWorth() {
  return round2(getAccounts().reduce((s, a) => s + (a.kind === "credit" ? -a.balance : a.balance), 0))
}

export function allocation() {
  const holdings = getHoldings()
  const total = holdings.reduce((s, h) => s + h.value, 0)
  const classes = ["Equity", "Fixed income", "Cash"] as const
  return classes.map((name) => ({
    name,
    share: round2((holdings.filter((h) => h.assetClass === name).reduce((s, h) => s + h.value, 0) / total) * 100),
  }))
}
