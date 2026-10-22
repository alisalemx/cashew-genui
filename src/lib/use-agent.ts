import type { Spec } from "@json-render/core"
import { useCallback, useRef, useState } from "react"
import type { AskEvent, AskRequest, ClaudeReason, JevCandidate, JevPick, Route, SessionTransfer } from "@/shared/protocol"

export type Done = Extract<AskEvent, { type: "done" }>

export interface Turn {
  id: string
  prompt: string
  status: "routing" | "composing" | "writing" | "done" | "error"
  route?: { route: Route; reason: ClaudeReason | null; confidence: number | null; ms: number; offline: boolean }
  text: string[]
  spec: Spec | null
  /** Jev's specs bind to the shared bank store; Claude's bring their own state. */
  shared: boolean
  tools: string[]
  handoff?: string
  dashboardChanged?: boolean
  /** What Jev picked for its cards, and the descriptions it matched. */
  picks?: JevPick[]
  /** The cards Jev scored, picked or not, best first. */
  candidates?: JevCandidate[]
  /** Claude's reply under Jev's cards, while it's written and once it's in. */
  caption?: { status: "writing" } | (Extract<AskEvent, { type: "caption"; phase: "end" }> & { status: "done" })
  done?: Done
  error?: string
  /** The visitor stopped the answer before it finished. */
  stopped?: boolean
}

/** The longest message the Worker accepts in the history. */
const HISTORY_LENGTH = 2000

/** The last few turns, cut to what the Worker accepts so a long reply can't lock later questions out. */
function historyFrom(turns: Turn[]): AskRequest["history"] {
  return turns
    .filter((t) => t.status === "done" && !t.stopped)
    .slice(-6)
    .flatMap((t) => [
      { role: "user" as const, text: t.prompt },
      {
        role: "assistant" as const,
        text: (
          t.text.join("\n") ||
          (t.done?.picks?.length ? `[Showed cards: ${t.done.picks.map((p) => p.description).join("; ")}]` : "[Showed cards]")
        ).slice(0, HISTORY_LENGTH),
      },
    ])
}

export function useAgent({
  dashboard,
  transfers,
  onDashboard,
}: {
  dashboard: Spec
  transfers: SessionTransfer[]
  onDashboard: (spec: Spec) => void
}) {
  const [turns, setTurns] = useState<Turn[]>([])
  const busy = turns.some((t) => t.status !== "done" && t.status !== "error")
  const abort = useRef<AbortController | null>(null)

  const ask = useCallback(
    async (prompt: string) => {
      const text = prompt.trim()
      if (!text || busy) return
      const id = crypto.randomUUID()
      const update = (fn: (t: Turn) => Turn) => setTurns((list) => list.map((t) => (t.id === id ? fn(t) : t)))
      setTurns((list) => [...list, { id, prompt: text, status: "routing", text: [], spec: null, shared: true, tools: [] }])

      abort.current = new AbortController()
      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt: text, history: historyFrom(turns), dashboard, transfers } satisfies AskRequest),
          signal: abort.current.signal,
        })
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error ?? "Cashew couldn’t answer that. Try again.")
        }

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
        let buffer = ""
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += value
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""
          for (const line of lines) {
            if (!line.trim()) continue
            const event = JSON.parse(line) as AskEvent
            switch (event.type) {
              case "route":
                update((t) => ({
                  ...t,
                  route: event,
                  status: event.route === "explain" ? "writing" : "composing",
                  shared: event.route !== "explain",
                }))
                break
              case "handoff":
                update((t) => ({ ...t, handoff: event.reason, status: "writing", shared: false, spec: null }))
                break
              case "spec":
                update((t) => ({ ...t, spec: event.spec }))
                break
              case "dashboard":
                onDashboard(event.spec)
                update((t) => ({ ...t, dashboardChanged: true }))
                break
              case "text":
                update((t) => ({ ...t, text: [...t.text, event.text] }))
                break
              case "text-delta":
                update((t) => ({
                  ...t,
                  text: event.start || !t.text.length ? [...t.text, event.text] : [...t.text.slice(0, -1), t.text[t.text.length - 1] + event.text],
                }))
                break
              case "tool":
                update((t) => ({ ...t, tools: [...t.tools, event.name] }))
                break
              case "picks":
                update((t) => ({ ...t, picks: event.picks, candidates: event.candidates }))
                break
              case "caption":
                update((t) => ({ ...t, caption: event.phase === "start" ? { status: "writing" } : { ...event, status: "done" } }))
                break
              case "done":
                // A reply that never finished is dropped, so nothing keeps shimmering.
                update((t) => ({ ...t, done: event, status: "done", caption: t.caption?.status === "writing" ? undefined : t.caption }))
                break
              case "error":
                update((t) => ({ ...t, error: event.message, status: "error" }))
                break
            }
          }
        }
        update((t) => (t.status === "done" || t.status === "error" ? t : { ...t, status: "done" }))
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        update((t) => ({ ...t, status: "error", error: (err as Error).message }))
      }
    },
    [busy, dashboard, transfers, turns, onDashboard],
  )

  // Back to the examples. Stops any answer still on its way.
  const reset = useCallback(() => {
    abort.current?.abort()
    setTurns([])
  }, [])

  // Stops the answer on its way and keeps what already arrived.
  const stop = useCallback(() => {
    abort.current?.abort()
    setTurns((list) =>
      list.map((t) => (t.status === "done" || t.status === "error" ? t : { ...t, status: "done", stopped: true })),
    )
  }, [])

  return { turns, ask, busy, reset, stop }
}
