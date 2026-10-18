import { defineCatalog } from "@json-render/core"
import { schema } from "@json-render/react/schema"
import { z } from "zod"

// The catalogue is Cashew's design system as the AI sees it. Each description
// says when to reach for the component, so both Jev and Claude pick by intent
// as well as by shape.

const money = z.number().describe("Amount in Canadian dollars, positive")

const monthPoint = z.object({
  label: z.string().describe("Short month label, like Sep"),
  amount: money,
})

export const catalog = defineCatalog(schema, {
  components: {
    Answer: {
      props: z.object({
        gap: z.enum(["sm", "md"]).nullable(),
      }),
      slots: ["default"],
      description:
        "Outermost container for an answer in the assistant panel. Stacks cards vertically, most important first. Always the root of an answer.",
      example: { gap: "md" },
    },

    Dashboard: {
      props: z.object({}),
      slots: ["default"],
      description:
        "Outermost container for the home dashboard. Lays sections out in a responsive grid. Only used as the root of the dashboard.",
    },

    Row: {
      props: z.object({}),
      slots: ["default"],
      description:
        "Puts two or three Stats side by side in an answer, or two or three Figures side by side inside a Card. Never holds anything else.",
    },

    Stat: {
      props: z.object({
        label: z.string(),
        value: money,
        caption: z.string().nullable().describe("One short line of context"),
        change: z
          .number()
          .nullable()
          .describe("Percentage change against the comparison period"),
        changeIsGood: z
          .boolean()
          .nullable()
          .describe("Whether a rise is good news, like savings, or bad news, like spending"),
      }),
      description:
        "One headline figure, set large. Use for a single number the person asked about: a balance, a total, net worth.",
      example: { label: "Spent this month", value: 3054.4, caption: "Oct 1 to 16", change: -11.3, changeIsGood: false },
    },

    AccountList: {
      props: z.object({
        title: z.string(),
        accounts: z.array(
          z.object({
            name: z.string(),
            kind: z.enum(["chequing", "savings", "credit", "investment"]),
            lastFour: z.string(),
            balance: money,
            detail: z.string().nullable().describe("Like available credit or interest rate"),
          }),
        ),
      }),
      description:
        "Balances for several accounts in one card. Use when the person asks about their accounts or balances in general.",
    },

    TransactionList: {
      props: z.object({
        title: z.string(),
        caption: z.string().nullable().describe("A few words of context, like 'Last six months'. Never a sentence."),
        transactions: z.array(
          z.object({
            date: z.string().describe("YYYY-MM-DD"),
            merchant: z.string(),
            category: z.string(),
            amount: z.number().describe("Negative is money out"),
          }),
        ),
      }),
      description:
        "A list of individual transactions, newest first, at most ten. Use to show what makes up a total or recent activity.",
    },

    SpendingChart: {
      props: z.object({
        title: z.string(),
        caption: z.string().nullable().describe("A few words of context, like 'Last six months'. Never a sentence."),
        style: z.enum(["bar", "line"]).describe("Bars compare months, a line shows a trend"),
        months: z.array(monthPoint),
        average: money.nullable().describe("Monthly average, drawn as a reference line"),
      }),
      description:
        "Spending per month over time. Use for trends and month-to-month comparisons. One series only.",
    },

    CategoryBreakdown: {
      props: z.object({
        title: z.string(),
        caption: z.string().nullable().describe("A few words of context, like 'Last six months'. Never a sentence."),
        total: money,
        categories: z.array(
          z.object({ name: z.string(), amount: money, share: z.number().describe("Percent of total") }),
        ),
      }),
      description:
        "Where the money went in one period, split by category, largest first. Use for 'what did I spend on' questions.",
    },

    Comparison: {
      props: z.object({
        title: z.string(),
        current: z.object({ label: z.string(), amount: money }),
        previous: z.object({ label: z.string(), amount: money }),
        higherIsGood: z.boolean().nullable(),
      }),
      description:
        "Two amounts side by side with the difference between them. Use when the person compares two periods.",
    },

    MerchantList: {
      props: z.object({
        title: z.string(),
        merchants: z.array(
          z.object({ merchant: z.string(), category: z.string(), amount: money, count: z.number() }),
        ),
      }),
      description: "The places the person spent the most at, ranked. Use for 'where do I spend the most' questions.",
    },

    BillList: {
      props: z.object({
        title: z.string(),
        bills: z.array(
          z.object({ name: z.string(), due: z.string().describe("YYYY-MM-DD"), amount: money, autopay: z.boolean() }),
        ),
      }),
      description: "Bills coming up, soonest first, with whether each is on autopay.",
    },

    PortfolioChart: {
      props: z.object({
        title: z.string(),
        value: money,
        change: z.number().describe("Percent change over the period shown"),
        period: z.string().describe("Like 6 months"),
        points: z.array(z.object({ date: z.string(), value: money })),
      }),
      description: "Investment portfolio value over time with today's value set large. Use for how investments are doing.",
    },

    HoldingsTable: {
      props: z.object({
        title: z.string(),
        holdings: z.array(
          z.object({
            symbol: z.string(),
            name: z.string(),
            value: money,
            returnPct: z.number(),
          }),
        ),
      }),
      description: "Each investment the person owns, with its value and total return. Use for 'what do I own' questions.",
    },

    Allocation: {
      props: z.object({
        title: z.string(),
        segments: z.array(z.object({ name: z.string(), share: z.number().describe("Percent") })),
      }),
      description: "How the portfolio splits across equity, fixed income, and cash, as one bar.",
    },

    TransferForm: {
      props: z.object({
        recipientId: z
          .string()
          .nullable()
          .describe("Contact id from the contacts list, or null to let the person choose"),
        amount: z.number().nullable().describe("Amount the person asked to send, if they said one"),
        note: z.string().nullable(),
      }),
      description:
        "Starts an e-Transfer from chequing. The form always shows a review step and only sends after the person presses Confirm. Use whenever the person wants to send or pay someone money.",
    },

    Note: {
      props: z.object({
        tone: z.enum(["info", "good", "warning"]).nullable(),
        text: z.string().describe("One or two complete sentences. Never trail off with an ellipsis."),
      }),
      description:
        "A short callout that points out one fact worth noticing, like a category that grew. Never a substitute for a chart or list.",
    },

    // Building blocks. Claude composes these into a new card when no finished
    // card shows what was asked. src/shared/components.md documents how.

    Card: {
      props: z.object({
        title: z.string().describe("Names what the card shows, in a few words"),
        caption: z.string().nullable().describe("A few words of scope, like 'By December 31'. Never a sentence."),
      }),
      slots: ["default"],
      description:
        "An empty Cashew card to build a new view in, from Figure, Row, Meter, List, and Text. Use only when no finished card shows what was asked.",
      example: { title: "Savings goal", caption: "By December 31" },
    },

    Figure: {
      props: z.object({
        label: z.string().nullable().describe("What the number is, like 'Still to save'"),
        value: z.number(),
        format: z.enum(["money", "percent", "number"]).nullable().describe("Defaults to money. Percent takes 12.5 for 12.5%."),
        caption: z.string().nullable().describe("A few words of context, like '$179 a month'. How it was worked out goes in Text."),
        change: z.number().nullable().describe("Percentage change against the comparison period"),
        changeIsGood: z.boolean().nullable().describe("Whether a rise is good news"),
      }),
      description:
        "The number that answers the question, set large, inside a Card. Goes first in the Card. Set smaller automatically inside a Row.",
      example: { label: "Still to save", value: 1760, format: "money", caption: "$704 a month", change: null, changeIsGood: null },
    },

    Meter: {
      props: z.object({
        label: z.string(),
        value: money.describe("How far along, in Canadian dollars"),
        target: money.describe("The goal or limit, in Canadian dollars"),
        kind: z.enum(["goal", "limit"]).describe("A goal is good to fill, like savings. A limit is bad to fill, like a budget or credit limit."),
        caption: z.string().nullable().describe("A few words, like '72% of the way'"),
      }),
      description: "Progress toward a goal or use of a limit, as a bar, inside a Card.",
      example: { label: "Saved", value: 3240, target: 5000, kind: "goal", caption: null },
    },

    List: {
      props: z.object({
        title: z.string().nullable().describe("A small label above the list, like 'Due before Nov 1'"),
        style: z.enum(["plain", "bars"]).nullable().describe("Bars compare the size of each value. Plain lists them."),
        items: z.array(
          z.object({
            label: z.string(),
            detail: z.string().nullable().describe("A few words under the label, like a date or a count"),
            value: z.union([z.number(), z.string()]).describe("A number is shown as dollars. Use a string for anything else."),
            tone: z.enum(["good", "bad"]).nullable().describe("Only when the value is clearly good or bad news"),
          }),
        ),
      }),
      description: "Rows of labelled values inside a Card, at most eight. Bars style ranks them by size.",
    },

    Text: {
      props: z.object({
        text: z.string().describe("One or two complete sentences"),
      }),
      description: "A sentence or two inside a Card that explains a number or how it was worked out. Goes last in the Card.",
    },
  },
  actions: {},
})

export type CashewCatalog = typeof catalog
