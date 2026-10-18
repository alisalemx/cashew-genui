import { applySpecStreamPatch, createMixedStreamParser, type MixedStreamParser, type Spec } from "@json-render/core"
import { createAnthropic } from "@ai-sdk/anthropic"
import { stepCountIs, streamText, tool, type ModelMessage } from "ai"
import { z } from "zod"
import { catalog } from "../src/shared/catalog"
import componentsGuide from "../src/shared/components.md?raw"
import {
  CATEGORIES,
  CONTACTS,
  HISTORY_MONTHS,
  balanceHistory,
  cashFlow,
  categoryName,
  categoryTotals,
  getAccounts,
  getBills,
  getBudgets,
  getCreditCard,
  getCreditScore,
  getGoals,
  getHoldings,
  getPortfolioHistory,
  getSubscriptions,
  getTfsaActivity,
  getTransactions,
  isoDate,
  recentMonths,
  spendingByMonth,
  today,
  topMerchants,
  type Transaction,
} from "../src/shared/data"
import { CLAUDE_MODEL, type AskEvent, type AskRequest, type SessionTransfer } from "../src/shared/protocol"
import { allocation } from "../src/shared/data"

// Claude takes the requests Jev can't: anything that needs a written answer,
// reasoning, or a view nobody prepared. It reads the same mock bank through
// tools and builds its answer from the same catalogue.

function withTransfers(transfers: SessionTransfer[]) {
  const accounts = getAccounts()
  const sent = transfers.reduce((s, t) => s + t.amount, 0)
  accounts[0] = { ...accounts[0], balance: Math.round((accounts[0].balance - sent) * 100) / 100 }
  const extra: Transaction[] = transfers.map((t, i) => ({
    id: `s${i}`,
    date: t.date,
    merchant: `e-Transfer to ${CONTACTS.find((c) => c.id === t.contactId)?.name ?? "contact"}`,
    category: "transfer",
    amount: -t.amount,
    account: "chequing",
  }))
  return { accounts, transactions: [...extra, ...getTransactions()] }
}

const monthParam = z.string().regex(/^\d{4}-\d{2}$/).describe("Month as YYYY-MM")
const throughParam = monthParam.nullable().describe("Last month of a range as YYYY-MM, or null for just the one month")
const monthsParam = z.number().int().min(1).max(HISTORY_MONTHS).nullable().describe(`How many months back, up to ${HISTORY_MONTHS}, or null for 6`)

const round2 = (n: number) => Math.round(n * 100) / 100

function tools(transfers: SessionTransfer[]) {
  const bank = withTransfers(transfers)
  return {
    getAccounts: tool({
      description: "Every account with its current balance. Credit card balance is the amount owing.",
      inputSchema: z.object({}),
      execute: async () => bank.accounts,
    }),
    getBalanceHistory: tool({
      description: "Chequing or savings balance at the end of each month for the last year, oldest first. The last entry is today.",
      inputSchema: z.object({ account: z.enum(["chequing", "savings"]) }),
      execute: async ({ account }) => balanceHistory(account),
    }),
    getMonthlySpending: tool({
      description: "Total spending per month, oldest first, net of refunds. The current month is partial.",
      inputSchema: z.object({ months: monthsParam }),
      execute: async ({ months }) => spendingByMonth(months ?? 6),
    }),
    getCashFlow: tool({
      description:
        "For each month, oldest first: moneyIn (pay, refunds, and other deposits to chequing), spending, setAside (moved to savings and the TFSA), and what was left. The current month is partial.",
      inputSchema: z.object({ months: monthsParam }),
      execute: async ({ months }) => cashFlow(months ?? 6),
    }),
    getCategoryBreakdown: tool({
      description: "Spending by category for one month or a range of months, largest first, with each category's share of the total.",
      inputSchema: z.object({ month: monthParam, through: throughParam }),
      execute: async ({ month, through }) => categoryTotals(month, through ?? month),
    }),
    getTransactions: tool({
      description:
        "Individual transactions, newest first, with the count and totals of everything that matched, not only the rows returned. Filter by category, account, merchant text, a month, or a date range. Negative amounts are money out, and a positive amount in a spending category is a refund. Paycheques, interest, tax refunds, cash back, and investment distributions are category income. Money moved between Jordan's accounts, like the monthly transfers to savings and the TFSA and Visa payments, is category transfer. Purchases made in US dollars carry the original amount in foreign.",
      inputSchema: z.object({
        category: z.enum(["income", "transfer", ...CATEGORIES.map((c) => c.id)] as [string, ...string[]]).nullable(),
        account: z.enum(["chequing", "savings", "visa", "tfsa"]).nullable(),
        merchant: z.string().nullable().describe("Text the merchant name contains, like 'uber' or 'e-transfer'"),
        month: monthParam.nullable(),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().describe("First date, YYYY-MM-DD"),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().describe("Last date, YYYY-MM-DD"),
        limit: z.number().int().min(1).max(40).nullable(),
      }),
      execute: async ({ category, account, merchant, month, from, to, limit }) => {
        const matched = bank.transactions.filter(
          (t) =>
            (!category || t.category === category) &&
            (!account || t.account === account) &&
            (!month || t.date.startsWith(month)) &&
            (!from || t.date >= from) &&
            (!to || t.date <= to) &&
            (!merchant || t.merchant.toLowerCase().includes(merchant.toLowerCase())),
        )
        return {
          count: matched.length,
          totalOut: round2(-matched.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0)),
          totalIn: round2(matched.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0)),
          transactions: matched
            .slice(0, limit ?? 15)
            .map((t) => ({ ...t, category: t.category === "income" || t.category === "transfer" ? t.category : categoryName(t.category) })),
        }
      },
    }),
    getTopMerchants: tool({
      description: "Where the most money went, by merchant, for one month or a range of months, net of refunds.",
      inputSchema: z.object({ month: monthParam, through: throughParam }),
      execute: async ({ month, through }) => topMerchants(month, 8, through ?? month),
    }),
    getBills: tool({
      description: "Bills and recurring charges in the next five weeks, soonest first, with autopay status and the account each comes out of.",
      inputSchema: z.object({}),
      execute: async () => getBills(),
    }),
    getSubscriptions: tool({
      description: "Every subscription and membership, monthly and yearly, including cancelled ones, with yearly cost and any price change.",
      inputSchema: z.object({}),
      execute: async () => getSubscriptions(),
    }),
    getBudgets: tool({
      description: "Jordan's monthly spending limits by category, with what's been spent against each in one month.",
      inputSchema: z.object({ month: monthParam.nullable().describe("Month as YYYY-MM, or null for this month") }),
      execute: async ({ month }) => getBudgets(month ?? undefined),
    }),
    getSavingsGoals: tool({
      description: "Jordan's savings goals, which divide up the high-interest savings balance: target, amount saved, monthly transfer toward each, and target date.",
      inputSchema: z.object({}),
      execute: async () => getGoals(),
    }),
    getCreditCard: tool({
      description:
        "The Cashew Visa: limit, balance, available credit, interest rates, payment due date and minimum, interest and foreign transaction fees paid in the last year, and cash back earned and paid out.",
      inputSchema: z.object({}),
      execute: async () => getCreditCard(),
    }),
    getCreditScore: tool({
      description: "Jordan's Equifax credit score, its monthly history for the last year, and what's affecting it.",
      inputSchema: z.object({}),
      execute: async () => getCreditScore(),
    }),
    getPortfolio: tool({
      description:
        "TFSA investments: holdings with value and total return, asset allocation, weekly value for six months, contribution room, contributions this year, and distributions paid.",
      inputSchema: z.object({}),
      execute: async () => ({ holdings: getHoldings(), allocation: allocation(), history: getPortfolioHistory(), tfsa: getTfsaActivity() }),
    }),
    getContacts: tool({
      description: "People Jordan can send e-Transfers to, with their ids.",
      inputSchema: z.object({}),
      execute: async () => CONTACTS,
    }),
  }
}

function systemPrompt() {
  const now = today()
  const months = recentMonths(HISTORY_MONTHS)
  return `You are the assistant inside Cashew online banking, talking with the customer, Jordan Lee. Cashew is a made-up Canadian bank in a design demo, so every account and number is fictional, but treat them as Jordan's real accounts and never mention that it's a demo.

Today is ${isoDate(now)}. The months with data are ${months[0]} through ${months.at(-1)}, and the current month is partial. Amounts are Canadian dollars.

Jordan rents an apartment in Toronto, works at Northwind Studio, and is paid on the 15th and the last day of each month. They have chequing, high-interest savings with three savings goals, a Cashew Visa with cash back, and a TFSA. They have no loans or mortgage. They also set monthly budgets for some spending categories.

How to answer:
- Get every number from the tools. Never estimate, round up, or invent an amount, merchant, or date.
- For a total over many transactions, like a year at one merchant, use the count and totals getTransactions returns rather than adding up rows.
- If something isn't in the tools, like a loan or another bank's account, say Cashew doesn't have it rather than guessing.
- Your earlier replies in this conversation came from the same tools, though you only see their text. Trust them, and never retract or apologize for them unless Jordan points out a mistake.
- Answer the question directly in one to three short sentences of plain Canadian English. Lead with the answer, not with what you did.
- Then add a spec when a visual helps. Skip the spec for greetings and simple yes or no answers.
- Compose the spec by following the Cashew components guide at the end. It says when to use a finished card and how to build a new one from blocks when none fits.
- Put tool data in /state and bind props to it with { "$state": "/path" }.
- To send money, call getContacts and render a TransferForm with that contact's recipientId and the amount Jordan gave. The form handles review and confirmation. Never say money was sent.
- Don't recommend specific investments or tell Jordan what to buy or sell. You can describe what the portfolio holds and how it has done.
- If the question has nothing to do with Jordan's banking, say briefly what you can help with instead.

${catalog.prompt({
  mode: "inline",
  customRules: [
    "Answer is always the root. Never nest Answer inside Answer.",
    "Figure, Meter, List, and Text only go inside a Card. Row holds Stats in an answer or Figures in a Card.",
    "Never use repeat, on, visible, or watch. Answers show data and have no interactions of their own.",
  ],
})}

${componentsGuide}`
}

/**
 * Sends Claude's prose word by word as it's written. json-render's parser only
 * hands over complete lines, so a paragraph would otherwise land all at once.
 * A line that could be card data, one that opens with "{" or a code fence or
 * sits inside a spec fence, still goes to the parser whole.
 */
function streamProse(parser: MixedStreamParser, send: (event: AskEvent) => void) {
  let line = ""
  let kind: "unknown" | "prose" | "data" = "unknown"
  let fenced = false

  const endLine = () => {
    const trimmed = line.trim()
    if (kind !== "prose") parser.push(line + "\n")
    if (!fenced && trimmed.startsWith("```spec")) fenced = true
    else if (fenced && trimmed === "```") fenced = false
    line = ""
    kind = "unknown"
  }

  return {
    push(chunk: string) {
      for (const piece of chunk.split(/(\n)/)) {
        if (piece === "\n") {
          endLine()
          continue
        }
        if (!piece) continue
        line += piece
        if (kind === "prose") {
          send({ type: "text-delta", text: piece, start: false })
          continue
        }
        if (kind === "data") continue
        const opening = line.trimStart()
        if (!opening) continue
        kind = fenced || opening.startsWith("{") || opening.startsWith("`") ? "data" : "prose"
        if (kind === "prose") send({ type: "text-delta", text: opening, start: true })
      }
    },
    flush() {
      if (line) endLine()
      parser.flush()
    },
  }
}

export async function* askClaude(apiKey: string, body: AskRequest, signal: AbortSignal): AsyncGenerator<AskEvent> {
  const started = performance.now()
  const anthropic = createAnthropic({ apiKey })
  const messages: ModelMessage[] = [
    ...body.history.map((m) => ({ role: m.role, content: m.text }) as ModelMessage),
    { role: "user", content: body.prompt },
  ]

  const result = streamText({
    model: anthropic(CLAUDE_MODEL),
    // The instructions and components guide are the same on every call, so
    // they're cached. Only the conversation and tool results cost full price.
    system: { role: "system", content: systemPrompt(), providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } },
    messages,
    tools: tools(body.transfers),
    stopWhen: stepCountIs(6),
    maxOutputTokens: 4000,
    abortSignal: signal,
  })

  const spec: Spec = { root: "", elements: {}, state: {} }
  let hasSpec = false
  const queue: AskEvent[] = []
  const parser = createMixedStreamParser({
    onText: (text) => queue.push({ type: "text", text }),
    onPatch: (patch) => {
      applySpecStreamPatch(spec as unknown as Record<string, unknown>, patch)
      hasSpec = true
      queue.push({ type: "spec", spec: structuredClone(spec) })
    },
  })

  const prose = streamProse(parser, (event) => queue.push(event))

  for await (const part of result.fullStream) {
    if (part.type === "text-delta") prose.push(part.text)
    else if (part.type === "tool-call") queue.push({ type: "tool", name: part.toolName })
    else if (part.type === "finish-step") prose.push("\n")
    else if (part.type === "error") throw part.error instanceof Error ? part.error : new Error(String(part.error))
    while (queue.length) yield queue.shift()!
  }
  prose.flush()
  while (queue.length) yield queue.shift()!

  const usage = await result.totalUsage
  yield {
    type: "done",
    by: "claude",
    ms: Math.round(performance.now() - started),
    model: "Claude Haiku 5.5",
    inputTokens: usage?.inputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
    note: hasSpec ? undefined : "Text only",
  }
}
