import type { Experimental_CompositionCandidate as Candidate, Spec } from "@json-render/core"
import { CATEGORIES, CONTACTS, categoryName, monthLabel, recentMonths } from "./data"

// Jev never writes UI. It chooses from these ready-made cards, so this file is
// where the design system's judgement lives: what each card is for, worded so
// a fast model can tell similar cards apart. Data stays in state and is bound
// with $state, so Jev only ever sees the descriptions.

const s = (path: string) => ({ $state: path })

function card(id: string, description: string, type: string, props: Record<string, unknown>, extra: Partial<Candidate> = {}): Candidate {
  return { id, description, root: false, element: { type, props }, ...extra }
}

export function buildCandidates(): Candidate[] {
  const [lastMonth, thisMonth] = recentMonths(2).map((m) => monthLabel(m, "long"))

  const categoryCards = CATEGORIES.filter((c) => c.id !== "housing").flatMap((c) => [
    card(
      `trend-${c.id}`,
      `${c.name} spending per month for the last six months`,
      "SpendingChart",
      { title: `${c.name} by month`, caption: "Last six months", style: "bar", months: s(`/categories/trends/${c.id}`), average: null },
    ),
    card(
      `recent-${c.id}`,
      `Individual ${c.name.toLowerCase()} transactions from ${lastMonth} and ${thisMonth}`,
      "TransactionList",
      { title: `${c.name} transactions`, caption: `Since ${lastMonth} 1`, transactions: s(`/categories/recent/${c.id}`) },
    ),
  ])

  const transferCards = CONTACTS.map((c) =>
    card(`transfer-${c.id}`, `Form to send money to ${c.name}`, "TransferForm", { recipientId: c.id, amount: null, note: null }, { resource: "transfer" }),
  )

  return [
    // Containers
    {
      id: "answer",
      description: "Answer container that stacks cards vertically",
      element: { type: "Answer", props: { gap: "md" } },
    },

    // Headline figures
    card("stat-net-worth", "Net worth: everything owned minus the credit card balance", "Stat", {
      label: "Net worth",
      value: s("/netWorth"),
      caption: "Across all accounts and investments",
      change: null,
      changeIsGood: true,
    }),
    card("stat-spent-month", `One headline figure: total spent so far in ${thisMonth}`, "Stat", {
      label: "Spent this month",
      value: s("/spending/monthToDate/current"),
      caption: s("/spending/monthToDate/caption"),
      change: s("/spending/monthToDate/change"),
      changeIsGood: false,
    }, { resource: "month-to-date" }),
    card("stat-chequing", "Chequing account balance on its own", "Stat", {
      label: "Everyday chequing",
      value: s("/chequing"),
      caption: "Available to spend",
      change: null,
      changeIsGood: true,
    }, { resource: "balances" }),
    card("stat-portfolio", "Only the portfolio's current value as one number, with no chart or history", "Stat", {
      label: "TFSA value",
      value: s("/portfolio/value"),
      caption: "Last six months",
      change: s("/portfolio/change"),
      changeIsGood: true,
    }, { resource: "portfolio-value" }),

    // Accounts and activity
    card("accounts", "Balances for all accounts: chequing, savings, credit card, and TFSA", "AccountList", {
      title: "Accounts",
      accounts: s("/accounts"),
    }, { resource: "balances" }),
    card("recent-transactions", "The ten most recent transactions on chequing and the credit card", "TransactionList", {
      title: "Recent transactions",
      caption: null,
      transactions: s("/transactions/recent"),
    }),
    card("largest-transactions", `The biggest single purchases in ${thisMonth}`, "TransactionList", {
      title: "Biggest purchases",
      caption: thisMonth,
      transactions: s("/transactions/largestThisMonth"),
    }),
    card("income", "Recent paycheques and other money coming in", "TransactionList", {
      title: "Money in",
      caption: "Recent deposits",
      transactions: s("/transactions/income"),
    }),
    card("bills", "Bills coming up in the next few weeks, with autopay status", "BillList", {
      title: "Upcoming bills",
      bills: s("/bills"),
    }),

    // Spending
    {
      ...card("spending-bars", "Total spending per month for the last six months, as bars for comparing months", "SpendingChart", {
        title: "Spending by month",
        caption: "Last six months",
        style: "bar",
        months: s("/spending/months"),
        average: s("/spending/average"),
      }),
      resource: "spending-trend",
    },
    {
      ...card("spending-line", "Total spending per month for the last six months, as a line showing the trend", "SpendingChart", {
        title: "Spending trend",
        caption: "Last six months",
        style: "line",
        months: s("/spending/months"),
        average: s("/spending/average"),
      }),
      resource: "spending-trend",
    },
    card("categories-this-month", `Spending by category in ${thisMonth}, the current month`, "CategoryBreakdown", {
      title: `${thisMonth} by category`,
      caption: "So far this month",
      total: s("/spending/thisMonth/total"),
      categories: s("/spending/thisMonth/categories"),
    }),
    card("categories-last-month", `Spending by category in ${lastMonth}, last month`, "CategoryBreakdown", {
      title: `${lastMonth} by category`,
      caption: "Whole month",
      total: s("/spending/lastMonth/total"),
      categories: s("/spending/lastMonth/categories"),
    }),
    card("compare-months", `Side-by-side comparison of ${thisMonth} so far with the same days of ${lastMonth}, only when the person asks to compare months`, "Comparison", {
      title: "This month against last",
      current: { label: s("/spending/monthToDate/currentLabel"), amount: s("/spending/monthToDate/current") },
      previous: { label: s("/spending/monthToDate/previousLabel"), amount: s("/spending/monthToDate/previous") },
      higherIsGood: false,
    }, { resource: "month-to-date" }),
    card("merchants-this-month", `Places with the most spending in ${thisMonth}`, "MerchantList", {
      title: "Top places this month",
      merchants: s("/spending/merchantsThisMonth"),
    }),
    card("merchants-last-month", `Places with the most spending in ${lastMonth}`, "MerchantList", {
      title: `Top places in ${lastMonth}`,
      merchants: s("/spending/merchantsLastMonth"),
    }),
    ...categoryCards,

    // Investments
    card("portfolio-chart", "Investment portfolio value today, with a chart of how it moved over the last six months", "PortfolioChart", {
      title: "TFSA",
      value: s("/portfolio/value"),
      change: s("/portfolio/change"),
      period: "6 months",
      points: s("/portfolio/points"),
    }, { resource: "portfolio-value" }),
    card("holdings", "Each fund and stock in the portfolio with its value and return", "HoldingsTable", {
      title: "Holdings",
      holdings: s("/portfolio/holdings"),
    }),
    card("allocation", "How the portfolio splits across equity, fixed income, and cash", "Allocation", {
      title: "Asset mix",
      segments: s("/portfolio/allocation"),
    }),

    // Money movement
    ...transferCards,
    card("transfer-anyone", "Form to send money when no recipient was named", "TransferForm", { recipientId: null, amount: null, note: null }, { resource: "transfer" }),
    card("transfers-recent", "Recent e-Transfers sent and received", "TransactionList", {
      title: "Recent e-Transfers",
      caption: null,
      transactions: s("/transfers/recent"),
    }),
  ]
}

/** Candidates for editing the home dashboard: the same cards, a different root. */
export function buildDashboardCandidates(): Candidate[] {
  return [
    {
      id: "dashboard",
      description: "Home dashboard container that lays sections out in a grid",
      element: { type: "Dashboard", props: {} },
    },
    ...buildCandidates().filter((c) => c.id !== "answer" && !c.element.type.startsWith("Transfer")),
  ]
}

/** The dashboard Jordan sees first. It's a spec too, so Jev can rearrange it. */
export function defaultDashboardSpec(): Spec {
  const all = new Map(buildDashboardCandidates().map((c) => [c.id, c]))
  const order = ["accounts", "spending-bars", "categories-this-month", "recent-transactions", "portfolio-chart", "bills", "holdings"]
  const elements: Spec["elements"] = {
    dashboard: { type: "Dashboard", props: {}, children: order },
  }
  for (const id of order) {
    const c = all.get(id)!
    elements[id] = { type: c.element.type, props: c.element.props, children: [] }
  }
  return { root: "dashboard", elements }
}

/** Plain-language names for dashboard sections, keyed by element id. */
export function dashboardDescriptions(spec: Spec) {
  const all = new Map(buildDashboardCandidates().map((c) => [c.id, c.description]))
  return Object.fromEntries(Object.keys(spec.elements).map((id) => [id, all.get(id) ?? `${spec.elements[id].type} section`]))
}

export { categoryName }
