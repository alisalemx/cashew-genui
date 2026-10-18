import type { Spec } from "@json-render/core"
import { createAnthropic } from "@ai-sdk/anthropic"
import { streamText } from "ai"
import { isoDate, today } from "../src/shared/data"
import { CLAUDE_MODEL, type AskEvent, type JevPick, type SessionTransfer } from "../src/shared/protocol"
import { bankStateWith } from "../src/shared/state"

// Jev picks the cards, and Claude writes the sentence or two that goes under
// them, so every answer gets a written reply. It works only from the data the
// cards show, needs no tools, and runs after the cards are already on screen,
// so it never holds them up.

const LAYOUT = new Set(["Answer", "Dashboard", "Row"])

function pointer(state: unknown, path: string): unknown {
  return path
    .split("/")
    .slice(1)
    .reduce<unknown>((node, key) => (node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined), state)
}

/** A card's props with its $state bindings swapped for the data they point to. */
function resolve(value: unknown, state: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, 12).map((v) => resolve(v, state))
  if (value && typeof value === "object") {
    const path = (value as { $state?: unknown }).$state
    if (typeof path === "string") return resolve(pointer(state, path), state)
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, state)]))
  }
  return value
}

/**
 * Cards say which way is good news with a flag like changeIsGood: false,
 * meaning "a rise is bad". Read cold, that looks like "this change is bad", so
 * Claude once called a drop in spending bad news. The flag becomes a plain
 * reading of the change the card shows, matching its green or red.
 */
function withPlainTone(props: unknown): unknown {
  if (!props || typeof props !== "object" || Array.isArray(props)) return props
  const { changeIsGood, higherIsGood, ...rest } = props as Record<string, unknown>
  const reading = (diff: number, risingIsGood: boolean) =>
    diff === 0 ? "no change" : diff > 0 === risingIsGood ? "good news" : "bad news"

  if (typeof rest.change === "number" && typeof changeIsGood === "boolean") {
    return { ...rest, changeReads: reading(rest.change, changeIsGood) }
  }
  const current = (rest.current as { amount?: unknown } | undefined)?.amount
  const previous = (rest.previous as { amount?: unknown } | undefined)?.amount
  if (typeof current === "number" && typeof previous === "number" && typeof higherIsGood === "boolean") {
    return { ...rest, differenceReads: reading(current - previous, higherIsGood) }
  }
  return rest
}

function cardsFor(spec: Spec, picks: JevPick[], transfers: SessionTransfer[]) {
  const state = bankStateWith(transfers)
  // Jev's picks come in the same order as the spec's cards, with the Answer
  // container already left out.
  const cards = Object.values(spec.elements).filter((el) => !LAYOUT.has(el.type))
  return cards.map((el, i) => ({ card: el.type, shows: picks[i]?.description ?? null, data: withPlainTone(resolve(el.props, state)) }))
}

function systemPrompt() {
  return `You are the assistant inside Cashew online banking, talking with the customer, Jordan Lee. Cashew is a made-up Canadian bank in a design demo, so every number is fictional, but treat them as Jordan's real accounts and never mention that it's a demo.

Today is ${isoDate(today())}. Cashew has already put cards on screen that answer Jordan's question. You write the short reply that sits under them.

- Answer the question directly in one or two short sentences of plain Canadian English, under 40 words in all. Lead with the answer. The cards carry the detail, so don't repeat it.
- Use only numbers from the card data. Never estimate or invent an amount, merchant, or date.
- Write amounts with a dollar sign and cents, like $1,071.92, and percentages to one decimal, like 14.8%. Say "down" or "up" in place of a minus or plus sign.
- The data drops trailing zeros, so 3054.4 is $3,054.40. Pad with zeros only, and never change a digit.
- A changeReads or differenceReads field says whether the change is good or bad news for Jordan. Go by it, and never guess from the sign.
- Don't describe the cards or say what's on screen, like "Here are your balances". Say what the data means for the question.
- For a transfer form, tell Jordan to check the details and press Confirm. Never say money was sent.
- Don't recommend investments or tell Jordan what to buy or sell.
- Plain text only, with no markdown, lists, or emoji.`
}

export async function* captionCards(
  apiKey: string,
  prompt: string,
  spec: Spec,
  picks: JevPick[],
  transfers: SessionTransfer[],
  signal: AbortSignal,
): AsyncGenerator<AskEvent> {
  const started = performance.now()
  const anthropic = createAnthropic({ apiKey })
  yield { type: "caption", phase: "start" }

  const result = streamText({
    model: anthropic(CLAUDE_MODEL),
    system: systemPrompt(),
    prompt: `Jordan asked: ${prompt}\n\nThe cards on screen, top to bottom:\n${JSON.stringify(cardsFor(spec, picks, transfers))}`,
    maxOutputTokens: 300,
    // A sentence or two needs no thinking, and skipping it keeps the reply fast.
    providerOptions: { anthropic: { thinking: { type: "disabled" } } },
    abortSignal: signal,
  })

  // Streamed word by word as one paragraph, the way Claude's own answers arrive.
  let writing = false
  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      const text = part.text.replace(/\s*\n\s*/g, " ")
      if (!writing) {
        const opening = text.trimStart()
        if (!opening) continue
        writing = true
        yield { type: "text-delta", text: opening, start: true }
      } else if (text) yield { type: "text-delta", text, start: false }
    } else if (part.type === "error") throw part.error instanceof Error ? part.error : new Error(String(part.error))
  }

  const usage = await result.totalUsage
  yield {
    type: "caption",
    phase: "end",
    model: "Claude Haiku 5.5",
    ms: Math.round(performance.now() - started),
    inputTokens: usage?.inputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
  }
}
