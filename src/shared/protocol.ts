import type { Spec } from "@json-render/core"

// What the browser sends to /api/ask, and the events the Worker streams back
// as newline-delimited JSON.

export interface SessionTransfer {
  contactId: string
  amount: number
  note: string | null
  date: string
}

export interface AskRequest {
  prompt: string
  history: { role: "user" | "assistant"; text: string }[]
  dashboard: Spec
  transfers: SessionTransfer[]
}

export type Route = "show" | "edit_dashboard" | "explain" | "off_topic"

/** Why Jev passed a question to Claude. */
/** A card Jev scored for the question, picked or not. */
export interface JevCandidate {
  id: string
  component: string
  description: string
  /** Jev's score from 0 to 1, or null from the offline stand-in. */
  score: number | null
  picked: boolean
}

export type ClaudeReason = "why" | "calculation" | "plan" | "advice" | "followup" | "other"

export interface JevPick {
  id: string
  /** The design system component the card is. */
  component: string
  /** The card's description, which is all Jev sees when it picks. */
  description: string
  confidence: number | null
}

export type AskEvent =
  | { type: "route"; route: Route; reason: ClaudeReason | null; confidence: number | null; ms: number; offline: boolean }
  | { type: "spec"; spec: Spec }
  /** What Jev picked for the cards just sent, and the cards it weighed them against. */
  | { type: "picks"; picks: JevPick[]; candidates: JevCandidate[] }
  | { type: "dashboard"; spec: Spec }
  | { type: "text"; text: string }
  /** Prose as it's written: `start` opens a new paragraph, otherwise it adds to the last one. */
  | { type: "text-delta"; text: string; start: boolean }
  | { type: "tool"; name: string }
  | { type: "handoff"; reason: string }
  | {
      type: "done"
      by: "jev" | "claude" | "cashew"
      ms: number
      stopReason?: string
      picks?: JevPick[]
      model?: string
      inputTokens?: number | null
      outputTokens?: number | null
      note?: string
    }
  /** Claude writing the reply that goes under Jev's cards. */
  | { type: "caption"; phase: "start" }
  | { type: "caption"; phase: "end"; model: string; ms: number; inputTokens: number | null; outputTokens: number | null }
  | { type: "error"; message: string }

export const JEV_MODEL = "typesafe/jev"
export const CLAUDE_MODEL = "claude-haiku-5-5"
