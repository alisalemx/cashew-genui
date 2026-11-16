import {
  experimental_composeSpec,
  type Experimental_CompositionCandidate as Candidate,
  type Experimental_CompositionEvaluation,
  type Experimental_CompositionEvaluator,
  type Experimental_CompositionStep,
  type Spec,
} from "@json-render/core"
import { catalog } from "../src/shared/catalog"
import { buildCandidates, buildDashboardCandidates, dashboardDescriptions } from "../src/shared/candidates"
import { CONTACTS, monthLabel, recentMonths } from "../src/shared/data"
import { JEV_MODEL, type ClaudeReason, type JevCandidate, type JevPick, type Route } from "../src/shared/protocol"
import { buildBankState } from "../src/shared/state"
import { offlineEvaluator } from "./offline-evaluator"

// json-render's built-in evaluator only works with one hosted gateway, but
// any function that answers the same choice questions will do. This one sends
// them to Jev through Cloudflare AI Gateway on the Worker's AI binding, so
// there's no key to manage and usage comes out of the account's AI Gateway
// credits.
function cloudflareEvaluator(ai: Ai): Experimental_CompositionEvaluator {
  return async ({ state, questions, signal }) => {
    signal.throwIfAborted()
    const run = ai.run.bind(ai) as unknown as (model: string, input: unknown, options: unknown) => Promise<JevResponse>
    let timer: ReturnType<typeof setTimeout> | null = null
    let onAbort = () => {}
    let response: JevResponse
    try {
      response = await Promise.race([
        run(JEV_MODEL, { state, questions }, { gateway: { id: "default" } }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Jev took too long to answer")), 8000)
          onAbort = () => reject(signal.reason)
          signal.addEventListener("abort", onAbort, { once: true })
        }),
      ])
    } finally {
      // One signal serves every call in a request, so each call cleans up after itself.
      clearTimeout(timer)
      signal.removeEventListener("abort", onAbort)
    }
    // The binding wraps Jev's reply as { state, result }, unlike the REST examples.
    if (response.state && response.state !== "Completed") throw new Error(`Jev returned ${response.state}`)
    const reply = response.result ?? response
    const answers: Experimental_CompositionEvaluation["answers"] = {}
    for (const [name, answer] of Object.entries(reply.answers ?? {})) {
      // Jev scores every option, and Cashew keeps those scores to show which
      // components it weighed against the ones it picked.
      if (typeof answer?.choice === "string") answers[name] = { choice: answer.choice, confidence: answer.confidence, probabilities: answer.probabilities } as Scored
    }
    return { answers, usage: { inputTokens: reply.usage?.input_tokens } }
  }
}

/** An answer with Jev's score for every option it was offered. */
type Scored = { choice: string; confidence?: number; probabilities?: Record<string, number> }

interface JevReply {
  answers?: Record<string, { choice?: string; confidence?: number; probabilities?: Record<string, number> }>
  usage?: { input_tokens?: number }
}

interface JevResponse extends JevReply {
  state?: string
  result?: JevReply
}

/** Real Jev on Cloudflare, or the keyword stand-in when JEV_OFFLINE is set. */
export function makeEvaluator(ai: Ai | undefined, forceOffline: boolean): { evaluate: Experimental_CompositionEvaluator; offline: boolean } {
  if (!ai || forceOffline) return { evaluate: offlineEvaluator, offline: true }
  return { evaluate: cloudflareEvaluator(ai), offline: false }
}

// Jev's first job is triage. It's a single choice question, which is exactly
// the kind of quick judgement it's built for. It lists the months the cards
// cover, because Jev doesn't know today's date and, given only a range, still
// took February for one of them.
function routeQuestion() {
  const months = recentMonths(6)
  const named = (key: string) => `${monthLabel(key, "long")} ${key.slice(0, 4)}`
  const first = named(months[0])
  const covered = months.map((m) => monthLabel(m, "long"))
  const list = `${covered.slice(0, -1).join(", ")}, and ${covered.at(-1)}`
  return {
    type: "choice" as const,
    instructions: `Decide how Cashew, a banking app, should handle user_request. Cashew has prepared cards for the person's own balances, net worth, transactions (all of them, the biggest, or one category like groceries, dining, transport and rides, shopping, or travel), spending by month or by category, this month's spending against last month's, paycheques and other money in, bills, the TFSA's value, holdings, and asset mix, recent e-Transfers, and a form to send one. Cards show data as it is, only for the six months from ${first} to now, ${named(months[5])}: ${list}. Any other month is too old for a card. They can't explain why, reason, give advice, or work out anything new, like a yearly total, an average, a percentage, a goal, or whether something is affordable. There are no cards for savings goals, budgets, subscriptions, the credit score, the credit card's details or cash back, TFSA contribution room, raises, or anything before ${first}.`,
    criteria: {
      show: "A prepared card shows the answer as it is: the person wants to see their balances, net worth, transactions, spending by month or category, this month against last, paycheques, bills, or investments, or to send someone money",
      edit_dashboard: "The person wants to change their home dashboard: add, remove, move, or reorder its sections",
      explain: `The answer has to be worked out or written: why something happened, advice, whether they can afford something, progress toward a goal, a what-if, a yearly or custom total, an average, a ranking no card shows (like who they send the most money to), a percentage or share, a comparison other than this month against last, or a follow-up that depends on the earlier conversation. Also anything about raises, savings goals, budgets, subscriptions, the credit score, card details or cash back, TFSA room, fees, unusual charges, or anything before ${first}`,
      off_topic:
        "Not about the person's money or this banking app. Their own purchases, orders, rides, or charges at any store or service are about their money, so they're never off topic",
    } satisfies Record<Route, string>,
  }
}

// A card Jev doubts can look right and still not answer the question, and a
// doubtful off-topic call turns a real question away with the set reply.
// Both are worse than Claude taking a few seconds longer, so either one goes
// to Claude when Jev's confidence is under half. Its confidence runs lower
// than the option's probability: "Show my Amazon orders" split 0.39 card to
// 0.38 off topic, with a confidence of 0.19 either way. The offline stand-in
// always gives 0.5, so it still shows cards.
const SURE_ENOUGH = 0.5

// Asked alongside triage, so when Jev passes a question to Claude it can say
// why. Answered every time, but only used when the route is explain.
const REASON_QUESTION = {
  type: "choice" as const,
  instructions: "Suppose user_request needs a written answer from Cashew rather than prepared cards. Pick the main reason.",
  criteria: {
    why: "It asks why something happened",
    calculation: "It needs a number worked out that no card shows, like a yearly total, an average, a share, or a percentage",
    plan: "It's about a goal, a what-if, a plan, or whether something is affordable",
    advice: "It asks for advice or a recommendation",
    followup: "It builds on previous_request and only makes sense with it",
    other: "None of these",
  } satisfies Record<Exclude<ClaudeReason, "unsure">, string>,
}

export async function routeRequest(evaluate: Experimental_CompositionEvaluator, prompt: string, previous: string | null, signal: AbortSignal) {
  const started = performance.now()
  const question = routeQuestion()
  const result = await evaluate({
    state: { user_request: prompt, previous_request: previous ?? "none" },
    questions: { route: question, reason: REASON_QUESTION },
    signal,
  })
  const answer = result.answers.route
  const picked = (answer && answer.choice in question.criteria ? answer.choice : "explain") as Route
  const unsure = (picked === "show" || picked === "off_topic") && answer?.confidence != null && answer.confidence < SURE_ENOUGH
  const route: Route = unsure ? "explain" : picked
  const why = result.answers.reason?.choice
  const reason: ClaudeReason | null =
    route !== "explain" ? null : unsure ? "unsure" : why && why in REASON_QUESTION.criteria ? (why as ClaudeReason) : "other"
  return { route, reason, confidence: answer?.confidence ?? null, ms: Math.round(performance.now() - started) }
}

function picksFrom(spec: Spec | null, steps: Experimental_CompositionStep[], candidates: { id: string; description: string; element: { type: string; props: Record<string, unknown> } }[]): JevPick[] {
  if (!spec) return []
  const answers = Object.assign({}, ...steps.map((s) => s.answers ?? {})) as Record<string, { choice: string; confidence?: number }>
  const confidenceFor = (id: string) => {
    for (const a of Object.values(answers)) if (a.choice === `use:${id}` || a.choice === id) return a.confidence ?? null
    return null
  }
  const signature = (el: { type: string; props: Record<string, unknown> }) => el.type + JSON.stringify(el.props)
  return Object.values(spec.elements).map((el) => {
    const c = candidates.find((x) => signature(x.element) === signature(el as never))
    return { id: c?.id ?? el.type, component: el.type, description: c?.description ?? el.type, confidence: c ? confidenceFor(c.id) : null }
  })
}

/** Cashew, not Jev, reads an amount like "$40", "$1,500", or "40 dollars" out of the request. */
export function amountFrom(prompt: string): number | null {
  const figure = "(\\d{1,3}(?:,\\d{3})+|\\d{1,6})(\\.\\d{1,2})?"
  const m = prompt.match(new RegExp(`\\$\\s?${figure}|${figure}\\s?(?:dollars|bucks|cad)\\b`, "i"))
  if (!m) return null
  const [whole, cents] = m[1] ? [m[1], m[2]] : [m[3], m[4]]
  const n = Number(whole.replace(/,/g, "") + (cents ?? ""))
  return Number.isFinite(n) && n > 0 ? n : null
}

export interface ComposeResult {
  spec: Spec | null
  stopReason: string
  picks: JevPick[]
  candidates: JevCandidate[]
  ms: number
  tokens: number | null
}

export async function composeAnswer(evaluate: Experimental_CompositionEvaluator, prompt: string, signal: AbortSignal): Promise<ComposeResult> {
  const candidates = buildCandidates()
  const state = buildBankState()
  let result: ComposeResult = { spec: null, stopReason: "limit", picks: [], candidates: [], ms: 0, tokens: null }

  // Each card Jev was offered, with the highest score it gave it.
  const scores = new Map<string, number>()
  const scoring: Experimental_CompositionEvaluator = async (request) => {
    const evaluation = await evaluate(request)
    for (const answer of Object.values(evaluation.answers) as Scored[]) {
      for (const [option, p] of Object.entries(answer.probabilities ?? {})) {
        if (!option.startsWith("use:")) continue
        const id = option.slice(4)
        scores.set(id, Math.max(scores.get(id) ?? 0, p))
      }
    }
    return evaluation
  }

  for await (const event of experimental_composeSpec({
    catalog,
    candidates,
    prompt,
    initialState: state,
    context: { app: "Cashew online banking", contacts: CONTACTS.map((c) => c.name) },
    instructions: {
      next: "Include only what the person asked for. A single figure is enough for a single-number question. Never add a transfer form unless the person wants to send or pay money.",
    },
    evaluate: scoring,
    maxElements: 8,
    signal,
  })) {
    if (event.type !== "complete") continue
    const spec = event.spec ? withAmount(stripState(event.spec), prompt) : null
    // Matched before Cashew fills in a transfer amount, so the form still
    // matches the card Jev picked.
    const picks = event.spec ? picksFrom(stripState(event.spec), event.steps, candidates).filter((p) => p.id !== "answer") : []
    result = {
      spec,
      stopReason: event.stopReason,
      picks,
      candidates: weighed(picks, scores, candidates),
      ms: event.elapsedMs,
      tokens: event.inputTokens,
    }
  }
  return result
}

/**
 * The cards Jev picked and the three it scored highest among the rest, best
 * first. The offline stand-in gives no scores, so it shows only its picks.
 */
function weighed(picks: JevPick[], scores: Map<string, number>, candidates: Candidate[]): JevCandidate[] {
  const picked = new Set(picks.map((p) => p.id))
  const all = candidates
    .filter((c) => c.id !== "answer" && (scores.has(c.id) || picked.has(c.id)))
    .map((c) => ({
      id: c.id,
      component: c.element.type,
      description: c.description,
      score: scores.get(c.id) ?? picks.find((p) => p.id === c.id)?.confidence ?? null,
      picked: picked.has(c.id),
    }))
    .sort((a, b) => Number(b.picked) - Number(a.picked) || (b.score ?? 0) - (a.score ?? 0))
  const runnersUp = all.filter((c) => !c.picked).slice(0, 3)
  return [...all.filter((c) => c.picked), ...runnersUp].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
}

export async function editDashboard(evaluate: Experimental_CompositionEvaluator, prompt: string, dashboard: Spec, signal: AbortSignal) {
  let result: Spec | null = null
  let stopReason = "limit"
  let ms = 0
  const steps: Experimental_CompositionStep[] = []
  for await (const event of experimental_composeSpec({
    catalog,
    candidates: buildDashboardCandidates(),
    initialSpec: { ...dashboard, state: buildBankState() },
    elementDescriptions: dashboardDescriptions(dashboard),
    prompt,
    evaluate,
    maxSteps: 8,
    signal,
  })) {
    if (event.type === "complete") {
      result = event.spec ? stripState(event.spec) : null
      stopReason = event.stopReason
      ms = event.elapsedMs
      steps.push(...event.steps)
    }
  }
  return { spec: result, stopReason, ms, steps }
}

// The browser already holds the bank's state, so specs travel without it.
function stripState(spec: Spec): Spec {
  const rest = { ...spec }
  delete rest.state
  return rest
}

function withAmount(spec: Spec, prompt: string): Spec {
  const amount = amountFrom(prompt)
  if (amount == null) return spec
  const elements = Object.fromEntries(
    Object.entries(spec.elements).map(([id, el]) =>
      el.type === "TransferForm" ? [id, { ...el, props: { ...el.props, amount } }] : [id, el],
    ),
  )
  return { ...spec, elements }
}
