import type { Spec } from "@json-render/core"
import { z } from "zod"
import { catalog } from "../src/shared/catalog"
import { CONTACTS } from "../src/shared/data"
import { JEV_MODEL, type AskEvent, type AskRequest } from "../src/shared/protocol"
import { captionCards } from "./caption"
import { Budget, type Kind, type Spend } from "./budget"
import { hashOf, householdOf, visitorOf } from "./visitor"
import { askClaude } from "./claude"
import { composeAnswer, editDashboard, makeEvaluator, routeRequest } from "./jev"

interface Env {
  ASSETS: Fetcher
  AI?: Ai
  ANTHROPIC_API_KEY?: string
  /** Set to "1" to use the keyword stand-in in place of Jev. */
  JEV_OFFLINE?: string
  ASK_LIMITER?: RateLimit
  CLAUDE_LIMITER?: RateLimit
  BUDGET?: DurableObjectNamespace<Budget>
}

export { Budget }

const AskSchema = z.object({
  prompt: z.string().trim().min(1).max(500),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) }))
    .max(12),
  dashboard: z.object({ root: z.string(), elements: z.record(z.string(), z.any()) }).passthrough(),
  transfers: z
    .array(
      z.object({
        contactId: z.enum(CONTACTS.map((c) => c.id) as [string, ...string[]]),
        amount: z.number().positive().max(3000),
        note: z.string().max(140).nullable(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .max(20),
})

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } })

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === "/api/ask" && request.method === "POST") return ask(request, env)
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found" }, 404)
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>

/** Whether this household can have one more call of this kind today, or which limit stops it. */
async function allowToday(env: Env, kind: Kind, household: string): Promise<Spend> {
  if (!env.BUDGET) return "ok"
  try {
    return await env.BUDGET.getByName("cashew").spend(kind, await hashOf(household))
  } catch (err) {
    // The Anthropic key's monthly spend limit, and the AI Gateway credit
    // balance, are the hard stops behind this one.
    console.error("Couldn't check the daily budget", err)
    return "ok"
  }
}

/** Whether this visitor can have one more Claude call, or which limit stops it. */
async function allowClaude(env: Env, household: string): Promise<Spend | "minute"> {
  if (env.CLAUDE_LIMITER && !(await env.CLAUDE_LIMITER.limit({ key: household })).success) return "minute"
  return allowToday(env, "claude", household)
}

const LIMITED = {
  minute: {
    note: "Rate limited",
    text: "You’ve reached the demo’s limit for written answers. Try again in a minute, or ask for a view like your spending or balances.",
  },
  visitor: {
    note: "Daily limit",
    text: "You’ve reached today’s limit for written answers. You can still ask for a view, like your spending or balances.",
  },
  everyone: {
    note: "Daily budget",
    text: "Cashew is out of written answers for today. You can still ask for a view, like your spending or balances.",
  },
}

/**
 * Whether the request came from Cashew's own page. Another site can't send a
 * JSON body without a preflight, which the Worker never answers, and browsers
 * always say which page a request came from. Without this, any site could
 * spend Cashew's limits from its own visitors' browsers.
 */
function fromCashew(request: Request) {
  const type = request.headers.get("content-type")?.toLowerCase() ?? ""
  const origin = request.headers.get("origin")
  return type.startsWith("application/json") && (!origin || origin === new URL(request.url).origin)
}

async function ask(request: Request, env: Env) {
  if (!fromCashew(request)) return json({ error: "Cashew couldn’t read that request." }, 403)
  const ip = request.headers.get("cf-connecting-ip") ?? "local"
  const visitor = visitorOf(ip)
  const household = householdOf(ip)
  if (env.ASK_LIMITER && !(await env.ASK_LIMITER.limit({ key: visitor })).success) {
    return json({ error: "That’s a lot of questions at once. Try again in a minute." }, 429)
  }
  if ((await allowToday(env, "jev", household)) !== "ok") {
    return json({ error: "Cashew has answered all it can for today. Come back tomorrow." }, 429)
  }

  const parsed = AskSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: "Cashew couldn’t read that request." }, 400)
  const body = parsed.data as AskRequest
  if (Object.keys(body.dashboard.elements).length > 40 || !catalog.validate(body.dashboard).success) {
    return json({ error: "Cashew couldn’t read the dashboard layout." }, 400)
  }

  const { readable, writable } = new TransformStream<Uint8Array>()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()
  const send = (event: AskEvent) => writer.write(encoder.encode(JSON.stringify(event) + "\n"))
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(55_000)])

  const run = async () => {
    const started = performance.now()
    const { evaluate, offline } = makeEvaluator(env.AI, env.JEV_OFFLINE === "1")
    const previous = [...body.history].reverse().find((m) => m.role === "user")?.text ?? null

    // Triage and composition run side by side, so a request Jev can answer
    // with cards doesn't wait on the routing decision first. Composition
    // stops as soon as the route says the cards aren't needed.
    const composeStop = new AbortController()
    const composing = composeAnswer(evaluate, body.prompt, AbortSignal.any([signal, composeStop.signal]))
    composing.catch(() => {})

    // If Jev itself is down or out of credit, Claude can still answer.
    const route = await routeRequest(evaluate, body.prompt, previous, signal).catch((err) => {
      console.error("Jev routing failed", err)
      return null
    })
    if (route) await send({ type: "route", ...route, offline })
    else await send({ type: "handoff", reason: "Couldn't be reached" })
    if (route && route.route !== "show") composeStop.abort()

    if (route?.route === "off_topic") {
      await send({ type: "text", text: "I can help with your Cashew accounts, spending, bills, investments, and e-Transfers." })
      await send({ type: "done", by: "cashew", ms: Math.round(performance.now() - started), note: "Canned reply, no model call" })
      return
    }

    if (route?.route === "edit_dashboard") {
      const edit = await editDashboard(evaluate, body.prompt, body.dashboard as Spec, signal)
      if (edit.spec && edit.stopReason !== "unavailable") {
        await send({ type: "dashboard", spec: edit.spec })
        await send({ type: "text", text: "Done. Your dashboard is updated." })
        await send({ type: "done", by: "jev", ms: Math.round(performance.now() - started), stopReason: edit.stopReason, picks: [], model: offline ? "offline stand-in" : JEV_MODEL })
        return
      }
      await send({ type: "handoff", reason: "Couldn't make that dashboard change" })
    }

    if (route?.route === "show") {
      try {
        const result = await composing
        if (result.spec && result.stopReason !== "unavailable" && Object.keys(result.spec.elements).length > 1) {
          await send({ type: "spec", spec: result.spec })
          const jevMs = Math.round(performance.now() - started)
          const picks = result.picks.filter((p) => p.id !== "answer")
          await send({ type: "picks", picks, candidates: result.candidates })
          // The cards are on screen, so Claude's reply under them never holds them up.
          // Past a limit, the cards answer on their own.
          if (env.ANTHROPIC_API_KEY && (await allowClaude(env, household)) === "ok") {
            try {
              for await (const e of captionCards(env.ANTHROPIC_API_KEY, body.prompt, result.spec, picks, body.transfers, signal)) await send(e)
            } catch (err) {
              console.error("Couldn't write the reply under the cards", err)
            }
          }
          await send({
            type: "done",
            by: "jev",
            ms: jevMs,
            stopReason: result.stopReason,
            picks,
            model: offline ? "offline stand-in" : JEV_MODEL,
            inputTokens: result.tokens,
          })
          return
        }
        await send({ type: "handoff", reason: "Had no cards for this" })
      } catch {
        await send({ type: "handoff", reason: "Couldn't put the cards together" })
      }
    }

    if (!env.ANTHROPIC_API_KEY) {
      await send({
        type: "text",
        text: route
          ? "This one needs a written answer from Claude, which isn’t connected in this copy of the demo."
          : "Cashew’s assistant isn’t available right now. Try again in a little while.",
      })
      await send({ type: "done", by: "cashew", ms: Math.round(performance.now() - started), note: "Claude not configured" })
      return
    }
    const allowed = await allowClaude(env, household)
    if (allowed !== "ok") {
      await send({ type: "text", text: LIMITED[allowed].text })
      await send({ type: "done", by: "cashew", ms: Math.round(performance.now() - started), note: LIMITED[allowed].note })
      return
    }
    for await (const e of askClaude(env.ANTHROPIC_API_KEY, body, signal)) await send(e)
  }

  run()
    .catch(async (err) => {
      console.error(err)
      await send({ type: "error", message: "Something went wrong on Cashew’s side. Try asking again." }).catch(() => {})
    })
    .finally(() => writer.close().catch(() => {}))

  return new Response(readable, {
    headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" },
  })
}
