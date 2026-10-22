import { Check, ChevronRight, CircleAlert, Component, X } from "lucide-react"
import { cn } from "cn"
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Message, MessageContent } from "@/components/ui/message"
import { Separator } from "@/components/ui/separator"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"
import { rise } from "@/genui/parts"
import { CashewSpec } from "@/genui/registry"
import { CardSkeleton, shapeForTools, TextSkeleton } from "@/genui/skeleton"
import type { Spec } from "@json-render/core"
import type { Turn } from "@/lib/use-agent"
import type { ClaudeReason, JevCandidate } from "@/shared/protocol"

const isWorking = (turn: Turn) => turn.status !== "done" && turn.status !== "error"

/**
 * The chat jumps to each new question at once, so the question rises in to
 * show it landed, and its answer follows 50ms behind. Only a turn that's on
 * its way when it first shows rises; the history, like when the phone sheet
 * reopens, just appears.
 */
export function UserTurn({ turn }: { turn: Turn }) {
  const [arriving] = useState(() => isWorking(turn))
  return (
    <Message align="end" className={cn(arriving && rise.self)}>
      <MessageContent>
        <Bubble variant="secondary" align="end">
          <BubbleContent>{turn.prompt}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  )
}

export function AnswerTurn({ turn }: { turn: Turn }) {
  const working = isWorking(turn)
  const [arriving] = useState(working)
  const paced = arriving && !turn.stopped
  const reply = usePacedReply(turn.text, paced, working)
  // The answer still settling: on its way, or its reply still being shown.
  const settling = working || reply.revealing
  // Claude's cards wait under their placeholder until the answer is in and
  // the reply is shown in full, then a beat more while its last words settle,
  // so the reply reads first, never pushes a card down as it grows, and the
  // cards land whole and still.
  const lingering = useLinger(settling, BEAT)
  const held = !turn.shared && lingering
  // How many lines hold the reply's place: two for the sentence or two under
  // Jev's cards, three for Claude's own answer.
  const lines = turn.status === "writing" || !turn.shared ? 3 : 2
  const route = turn.route?.route
  const cardComing =
    (working || (held && !!turn.spec?.root)) &&
    (turn.status === "writing" || (route !== "edit_dashboard" && route !== "off_topic"))
  const { replyRef, belowRef } = useGlideBelow(arriving && settling)
  return (
    <Message
      align="start"
      className={cn(
        arriving && rise.self,
        arriving && "[--tw-animation-delay:50ms] [--tw-animation-fill-mode:backwards]"
      )}
    >
      <MessageContent className="gap-3">
        <HowItWasMade turn={turn} />
        {/* The reply always leads. Lines hold its place from the start, through
            the moment Jev's cards land before Claude starts writing, and the
            reply keeps that height while it's shown, so the cards below
            don't hop as its first words arrive. */}
        <div ref={replyRef} className="empty:hidden">
          {reply.lines.length ? (
            <AnswerText lines={reply.lines} fade={paced} minLines={settling ? lines : 0} />
          ) : settling ? (
            <TextSkeleton lines={lines} />
          ) : null}
        </div>
        <div ref={belowRef} className="flex flex-col gap-3 empty:hidden">
          {/* Claude's cards are drawn once, from the finished answer. Drawn
              while their data streams in, a card could render before its
              numbers arrive and fail for good. */}
          {turn.spec?.root && !held ? (
            <div data-answer-cards className="contents">
              <CashewSpec spec={turn.spec} shared={turn.shared} loading={working} arrives={arriving} />
            </div>
          ) : null}
          {/* Holds the card's place until a real card has drawn, then gives
              way in the same frame (see `[data-card-skeleton]` in index.css).
              Jev's cards land whole within a second, so theirs is a short
              general card the real one grows from. Claude's takes the shape
              of the data it asked for. */}
          {cardComing ? (
            <div data-card-skeleton>
              <CardSkeleton shape={turn.shared ? "stat" : shapeForTools(turn.tools)} />
            </div>
          ) : null}
          {turn.error ? (
            <p className="flex items-center gap-2 text-sm text-bad">
              <CircleAlert className="size-4" aria-hidden />
              {turn.error}
            </p>
          ) : null}
          {turn.stopped ? (
            <p className="text-sm text-muted-foreground">You stopped this answer.</p>
          ) : null}
        </div>
      </MessageContent>
    </Message>
  )
}

/** The beat between the reply's last word and Claude's cards, in ms: as long as a word takes to fade in. */
const BEAT = 300

/** True while `on` is, and for `ms` after it turns off. */
function useLinger(on: boolean, ms: number) {
  const [lingering, setLingering] = useState(on)
  if (on && !lingering) setLingering(true)
  useEffect(() => {
    if (on) return
    const timer = setTimeout(() => setLingering(false), ms)
    return () => clearTimeout(timer)
  }, [on, ms])
  return on || lingering
}

/**
 * Glides what sits below the reply, like its cards or their placeholder, when
 * the reply grows a line or settles to its height, instead of letting it jump.
 * Each glide adds to any still running, so lines that wrap close together
 * carry on smoothly. Reduced motion lets it move straight there.
 */
function useGlideBelow(live: boolean) {
  const replyRef = useRef<HTMLDivElement>(null)
  const belowRef = useRef<HTMLDivElement>(null)
  const height = useRef<number | null>(null)
  // The render that ends the settling still glides, as the reply drops the
  // lines it was holding.
  const wasLive = useRef(live)
  useLayoutEffect(() => {
    const before = height.current
    const after = replyRef.current?.offsetHeight ?? 0
    const glides = live || wasLive.current
    height.current = after
    wasLive.current = live
    if (!glides || before === null || before === after) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    belowRef.current?.animate(
      [{ transform: `translateY(${before - after}px)` }, { transform: "none" }],
      { duration: 250, easing: "cubic-bezier(0.645, 0.045, 0.355, 1)", composite: "add" }
    )
  })
  return { replyRef, belowRef }
}

/** At least as tall as the lines that held its place, while it's written. */
const MIN_LINES: Record<number, string> = { 2: "min-h-[2lh]", 3: "min-h-[3lh]" }

/**
 * The reply's paragraphs. While it's shown live, each word fades in as it
 * lands, and lines wrap plainly, since balancing them would move words
 * already on screen to the next line as new ones arrive.
 */
function AnswerText({
  lines,
  fade,
  minLines,
}: {
  lines: string[][]
  fade: boolean
  minLines: number
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 text-[0.95rem] leading-relaxed",
        fade ? "text-wrap" : "text-pretty",
        MIN_LINES[minLines]
      )}
    >
      {lines.map((words, i) => (
        <p key={i}>
          {fade
            ? words.map((word, j) => (
                <span key={j} className="animate-in fade-in-0 duration-300">
                  {word}
                </span>
              ))
            : words.join("")}
        </p>
      ))}
    </div>
  )
}

/** How many words of the reply show each second: calm enough to follow. */
const WORDS_PER_SECOND = 15

/** How far the shown reply may trail what has arrived, in ms, before it speeds up to catch up. */
const MAX_LAG = 2000

/**
 * The reply, shown a word at a time at a calm, steady pace. Claude writes far
 * faster than anyone reads, so shown as it arrives, a reply lands all at once.
 * A long one speeds up so it never trails what has arrived by more than two
 * seconds. A reply that was already in, like the history, or one that was
 * stopped, shows in full.
 */
function usePacedReply(text: string[], paced: boolean, streaming: boolean) {
  const words = useMemo(
    () => text.map((line) => line.match(/\S+\s*/g) ?? []),
    [text]
  )
  const last = words.at(-1)?.at(-1)
  // A word still being written waits until it's whole.
  const total =
    words.reduce((n, line) => n + line.length, 0) -
    (streaming && last && !/\s$/.test(last) ? 1 : 0)
  const [count, setCount] = useState(paced ? 0 : total)
  const progress = useRef(count)

  useEffect(() => {
    if (!paced || progress.current >= total) return
    let frame = 0
    let previous = performance.now()
    const tick = (now: number) => {
      const rate = Math.max(WORDS_PER_SECOND / 1000, (total - progress.current) / MAX_LAG)
      progress.current = Math.min(total, progress.current + (now - previous) * rate)
      previous = now
      setCount(Math.floor(progress.current))
      if (progress.current < total) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [paced, total])

  const shown = paced ? Math.min(count, total) : Infinity
  const lines: string[][] = []
  let left = shown
  for (const line of words) {
    if (left <= 0) break
    lines.push(line.slice(0, left))
    left -= line.length
  }
  return { lines, revealing: paced && count < total }
}

/** A card in the answer: a design system component, or a new card Claude composed from parts. */
interface ShownCard {
  kind: "component" | "composed"
  /** The component's name, or the components a composed card is made of. */
  names: string[]
}

const LAYOUT = new Set(["Answer", "Dashboard", "Row"])

/** The cards in a spec, top to bottom, with the layout around them left out. */
function shownCards(spec: Spec | null): ShownCard[] {
  if (!spec?.root) return []
  const el = (key: string) => spec.elements[key]

  const partsIn = (key: string, found: string[] = []) => {
    for (const child of el(key)?.children ?? []) {
      const type = el(child)?.type
      if (!type) continue
      if (!found.includes(type)) found.push(type)
      partsIn(child, found)
    }
    return found
  }

  const cards: ShownCard[] = []
  const walk = (key: string) => {
    const node = el(key)
    if (!node) return
    if (LAYOUT.has(node.type)) return node.children?.forEach(walk)
    cards.push(
      node.type === "Card"
        ? { kind: "composed", names: partsIn(key) }
        : { kind: "component", names: [node.type] }
    )
  }
  walk(spec.root)
  return cards
}

const unique = (cards: ShownCard[]) => [
  ...new Set(cards.flatMap((c) => c.names)),
]

export type Actor = "jev" | "claude" | "cashew"

const ACTORS: Record<Actor, { name: string; className: string }> = {
  jev: { name: "Jev", className: "bg-primary/10 text-jev-ink" },
  claude: { name: "Claude", className: "bg-claude/12 text-claude-ink" },
  cashew: {
    name: "Cashew",
    className: "bg-foreground/[0.06] text-foreground/70",
  },
}

/** One step in how the answer was made: who did it, and what they did. */
interface Step {
  actor: Actor
  text: ReactNode
  /** The components Jev scored against the question, with a check on its picks. */
  candidates?: JevCandidate[]
  /** The step still in progress, shimmering until it lands. */
  live?: boolean
  /** Which step this is, when its words grow as it goes, like Claude's lookups. */
  id?: string
}

const TOOL_WORDS: Record<string, string> = {
  getAccounts: "accounts",
  getMonthlySpending: "monthly spending",
  getCategoryBreakdown: "spending by category",
  getTransactions: "transactions",
  getTopMerchants: "top merchants",
  getBills: "bills",
  getPortfolio: "investments",
  getContacts: "contacts",
}

/** Why Jev passed a question to Claude, finishing "passed it to Claude, because…". */
const REASONS: Record<ClaudeReason, string> = {
  why: "it asks why something happened, and components only show data",
  calculation: "it needs a number worked out, and components only show data",
  plan: "it’s about a goal or a what-if, and components only show data",
  advice: "it asks for advice",
  followup: "it builds on your earlier question",
  other: "no ready-made component shows it",
}

/** Why Jev gave up on components after trying them, finishing "Read your question but…". */
const HANDOFFS: Record<string, string> = {
  "Had no cards for this": "found no components that fit",
  "Couldn't put the cards together": "couldn’t put the components together",
  "Couldn't make that dashboard change": "couldn’t make that dashboard change",
}

const CASHEW_REPLIES: Record<string, string> = {
  "Canned reply, no model call": "Sent a set reply. No AI was needed.",
  "Claude not configured":
    "Sent a set reply, as Claude isn’t connected in this copy of the demo.",
  "Rate limited":
    "Sent a set reply, as you’ve reached the demo’s limit for written answers.",
  "Daily limit":
    "Sent a set reply, as you’ve reached today’s limit for written answers.",
  "Daily budget":
    "Sent a set reply, as the demo is out of written answers for today.",
}

function list(words: string[]) {
  if (words.length < 3) return words.join(" and ")
  return `${words.slice(0, -1).join(", ")}, and ${words.at(-1)}`
}

/** Jev's score as a percentage, with anything above zero shown as at least 1%. */
const percent = (score: number) =>
  score > 0 && score < 0.01 ? "<1%" : `${Math.round(score * 100)}%`

/**
 * The components Jev weighed, best score first: each one's description, which
 * is all Jev reads, its score, and a check on the ones it picked.
 */
function Candidates({ candidates }: { candidates: JevCandidate[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-background/50 p-4">
      <div
        className="flex items-baseline justify-between gap-3 font-mono text-[11px] text-muted-foreground"
        aria-hidden
      >
        <span>Components Jev scored</span>
        <span>Match</span>
      </div>
      <Separator className="bg-foreground/10 data-horizontal:h-(--hairline)" />
      <ul aria-label="Components Jev scored" className="flex flex-col gap-2.5">
        {candidates.map((c) => (
          <li
            key={c.id}
            className="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-baseline gap-x-2"
          >
            {c.picked ? (
              <span
                className="mt-px inline-flex size-4 items-center justify-center self-start rounded-full bg-primary/15 text-primary"
                aria-label="Picked"
              >
                <Check className="size-2.5" strokeWidth={3.5} aria-hidden />
              </span>
            ) : (
              <span
                className="mt-px inline-flex size-4 items-center justify-center self-start rounded-full bg-foreground/[0.06] text-muted-foreground"
                aria-label="Not picked"
              >
                <X className="size-2.5" strokeWidth={3.5} aria-hidden />
              </span>
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              <ComponentName
                small
                name={c.component}
                className={
                  c.picked
                    ? "font-medium text-primary"
                    : "text-muted-foreground"
                }
                iconClassName={c.picked ? "text-primary" : undefined}
              />
              <span className="text-xs leading-relaxed text-pretty text-muted-foreground">
                {c.description}
              </span>
            </div>
            <span
              className={cn(
                "font-mono text-xs tabular-nums",
                c.picked ? "font-medium text-primary" : "text-muted-foreground"
              )}
            >
              {c.score == null ? null : percent(c.score)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A design system component's name, in mono with the component icon. */
export function ComponentName({
  name,
  small = false,
  className,
  iconClassName,
}: {
  name: string
  /** Set at label size, as in the list of components Jev scored. */
  small?: boolean
  className?: string
  iconClassName?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-1 font-mono whitespace-nowrap text-foreground",
        small ? "text-[11px]" : "text-[0.8rem]",
        className
      )}
    >
      <Component
        className={cn(
          "self-center text-muted-foreground",
          small ? "size-3" : "size-3.5",
          iconClassName
        )}
        aria-hidden
      />
      {name}
    </span>
  )
}

/** Design system components, named in mono with the component icon, listed the way a sentence lists them. */
function Components({ names }: { names: string[] }) {
  return (
    <>
      the{" "}
      {names.map((name, i) => (
        <Fragment key={name}>
          {i === 0
            ? null
            : names.length > 2
              ? i === names.length - 1
                ? ", and "
                : ", "
              : " and "}
          <ComponentName name={name} />
        </Fragment>
      ))}{" "}
      {names.length === 1 ? "component" : "components"}
    </>
  )
}

/** The cards' steps: components picked from the design system, or a new card composed from them. */
function cardSteps(cards: ShownCard[], picker: Actor, lead = ""): Step[] {
  const picked = cards.filter((c) => c.kind === "component")
  const composed = cards.filter((c) => c.kind === "composed")
  const steps: Step[] = []
  if (picked.length) {
    steps.push({
      actor: picker,
      text: (
        <>
          {lead ? `${lead} picked` : "Picked"}{" "}
          <Components names={unique(picked)} />.
        </>
      ),
    })
  }
  if (composed.length) {
    steps.push({
      actor: "claude",
      text: (
        <>
          Composed{" "}
          {composed.length === 1
            ? "a new card"
            : `${composed.length} new cards`}{" "}
          from <Components names={unique(composed)} />.
        </>
      ),
    })
  }
  return steps
}

/** How the answer was made, step by step, in the order it happened. */
function stepsFor(turn: Turn): Step[] {
  const { route, done } = turn
  // A stopped answer is laid out as it stood, then its step under way is marked stopped.
  const working =
    turn.stopped || (turn.status !== "done" && turn.status !== "error")
  const steps: Step[] = []
  const cards = turn.dashboardChanged ? [] : shownCards(turn.spec)
  const tools = [...new Set(turn.tools.map((t) => TOOL_WORDS[t] ?? t))]

  // Jev reads every question first.
  if (!route) {
    if (turn.handoff)
      steps.push({
        actor: "jev",
        text: "Couldn’t be reached, so Claude took over.",
      })
    else if (working)
      steps.push({ actor: "jev", text: "Reading your question", live: true })
  } else if (turn.handoff) {
    steps.push({
      actor: "jev",
      text: `Read your question but ${HANDOFFS[turn.handoff] ?? "couldn’t answer it with components"}, so passed it to Claude.`,
    })
  } else if (route.route === "explain") {
    steps.push({
      actor: "jev",
      text: `Read your question and passed it to Claude, because ${REASONS[route.reason ?? "other"]}.`,
    })
  } else if (route.route === "off_topic") {
    steps.push({
      actor: "jev",
      text: "Read your question and found it isn’t about your banking.",
    })
  } else if (turn.dashboardChanged) {
    steps.push({
      actor: "jev",
      text: "Read your question and rearranged your dashboard.",
    })
  } else if (turn.candidates?.length) {
    const n = turn.candidates.filter((c) => c.picked).length
    steps.push({
      actor: "jev",
      text: `Scored the ready-made components against your question and picked ${n === 1 ? "the best match" : `the ${n} best matches`}.`,
      candidates: turn.candidates,
    })
  } else if (cards.length) {
    steps.push(...cardSteps(cards, "jev", "Read your question and"))
  } else if (working) {
    steps.push({
      actor: "jev",
      text:
        route.route === "edit_dashboard"
          ? "Rearranging your dashboard"
          : "Picking cards from the design system",
      live: true,
    })
  }

  // Claude writes the reply under Jev's cards.
  if (turn.caption?.status === "writing")
    steps.push({ actor: "claude", text: "Writing the reply", live: true })
  else if (turn.caption?.status === "done" && turn.text.length)
    steps.push({
      actor: "claude",
      text: "Wrote the reply from the data those components show.",
    })

  // Or Claude answers on its own: looks things up, writes, then lays out the cards.
  const claudeAnswers = route?.route === "explain" || !!turn.handoff
  if (claudeAnswers && done?.by !== "cashew") {
    const lookedUp = tools.length ? `Looked up your ${list(tools)}` : null
    if (done || (turn.text.length && !turn.stopped)) {
      steps.push({
        actor: "claude",
        text: lookedUp
          ? `${lookedUp} and wrote the reply.`
          : "Wrote the reply.",
      })
    } else if (working) {
      steps.push({
        actor: "claude",
        id: lookedUp ? "looking up" : undefined,
        text: lookedUp ? `Looking up your ${list(tools)}` : "Writing the reply",
        live: true,
      })
    }
    steps.push(...cardSteps(cards, "claude"))
  }

  if (done?.by === "cashew") {
    steps.push({
      actor: "cashew",
      text: turn.dashboardChanged
        ? "Sent a set reply. No AI was needed."
        : (CASHEW_REPLIES[done.note ?? ""] ?? "Sent a set reply."),
    })
  } else if (turn.dashboardChanged && done) {
    steps.push({ actor: "cashew", text: "Sent a set reply. No AI was needed." })
  }

  if (turn.stopped)
    return steps.map((s) =>
      s.live ? { actor: s.actor, text: "Stopped before finishing." } : s
    )
  return steps
}

/**
 * Above each answer, a closed panel holding the AI's part: who did what, in
 * order. Closed, it names the step under way, or once the answer is in, who
 * worked on it.
 */
function HowItWasMade({ turn }: { turn: Turn }) {
  const [open, setOpen] = useState(false)
  const steps = stepsFor(turn)
  const live = usePacedStep(steps.findLast((s) => s.live), isWorking(turn))
  // Each new step rises in over the last. Opening or closing the panel
  // changes the row too, but the chevron already shows that, so it doesn't rise.
  const label = live && !open ? stepKey(live) : "made"
  const [row, setRow] = useState({ label, open, rises: false })
  if (row.label !== label || row.open !== open)
    setRow({ label, open, rises: row.open === open })
  if (!steps.length) return null
  const actors = [...new Set(steps.map((s) => s.actor))]

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-xl border-(length:--hairline) border-border"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm pointer-coarse:py-3 text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
        <ChevronRight
          className={cn(
            "size-4 shrink-0 transition-transform duration-150 ease-out",
            open && "rotate-90"
          )}
          aria-hidden
        />
        {/* The rise sits on this wrapper, since the shimmer inside is an
            animation too, and one would cancel the other. */}
        <span
          key={label}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2",
            row.rises && rise.self
          )}
        >
          {live && !open ? (
            <>
              <ActorChip actor={live.actor} />
              <span aria-hidden className="min-w-0 flex-1 shimmer truncate">
                {live.text}
              </span>
            </>
          ) : (
            <>
              <span className="min-w-0 flex-1 truncate">
                How this answer was made
              </span>
              {open ? null : (
                <span className="flex shrink-0 gap-1">
                  {actors.map((a) => (
                    <ActorChip key={a} actor={a} />
                  ))}
                </span>
              )}
            </>
          )}
        </span>
        {/* Outside the row that rises, so it stays put and screen readers
            hear each new step. */}
        <span role="status" className="sr-only">
          {live && !open ? live.text : null}
        </span>
      </CollapsibleTrigger>
      {/* Opens to its height rather than snapping, so the answer below slides
          down instead of jumping. The padding sits inside, so the panel can
          close all the way to nothing. */}
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
        {/* Chips sit in a column as wide as the widest one, so every step's
            text starts at the same edge. */}
        <Trace aria-label="Steps" className="gap-3 px-3 pt-1 pb-3.5 [--actor-slot:3.5rem]">
          {steps.map((step, i) =>
            step.candidates?.length ? (
              // Jev's scoring opens to the components it weighed.
              <TraceCollapsible key={i} defaultOpen>
                <TraceCollapsibleTrigger className="items-start gap-1.5 *:data-[slot=trace-icon]:mt-0.5">
                  <StepLine step={step} />
                </TraceCollapsibleTrigger>
                <TraceCollapsibleContent className="mt-2.5 mb-0 ml-[calc(var(--actor-slot)+--spacing(2.5))] border-l-0 pr-0 pl-0">
                  <Candidates candidates={step.candidates} />
                </TraceCollapsibleContent>
              </TraceCollapsible>
            ) : (
              <StepLine key={i} step={step} />
            )
          )}
        </Trace>
      </CollapsibleContent>
    </Collapsible>
  )
}

const stepKey = (step: Step) =>
  `${step.actor}: ${step.id ?? String(step.text)}`

/** How long a step stays up before a newer one replaces it: long enough to read, and for its rise to finish. */
const DWELL = 400

/** How long the finished label waits while the answer is still working, in case another step is about to start. */
const GRACE = 200

/**
 * The step the closed row shows. Each one stays up at least 400ms, and a
 * newer step waits its turn, so a step that lasts a few milliseconds, like
 * Jev picking cards just before Claude starts, can't flash past. Only the
 * latest waiting step is shown. When a step ends while the answer is still
 * working, the finished label waits 200ms more, because Jev's last step and
 * Claude's first can land milliseconds apart.
 */
function usePacedStep(live: Step | undefined, working: boolean) {
  const key = live ? stepKey(live) : null
  const [shown, setShown] = useState<{ key: string | null; step?: Step }>({
    key,
    step: live,
  })
  // The step on show keeps its latest words, like a lookup that adds another
  // source, including once it has ended and is waiting out its time.
  if (key === shown.key && live && live.text !== shown.step?.text)
    setShown({ key, step: live })
  const latest = useRef(live)
  const since = useRef(0)
  useEffect(() => {
    latest.current = live
  })
  useEffect(() => {
    since.current = performance.now()
  }, [shown.key])
  useEffect(() => {
    if (key === shown.key) return
    const wait = Math.max(
      since.current + DWELL - performance.now(),
      !key && working ? GRACE : 0
    )
    const timer = setTimeout(
      () => setShown({ key, step: latest.current }),
      wait
    )
    return () => clearTimeout(timer)
  }, [key, shown.key, working])
  return key === shown.key ? live : shown.step
}

/** One step: who did it, then what they did. The step under way shimmers. */
function StepLine({ step }: { step: Step }) {
  return (
    <TraceLine
      status={step.live ? "running" : undefined}
      className="items-baseline gap-2.5"
    >
      <span className="w-(--actor-slot) shrink-0">
        <ActorChip actor={step.actor} />
      </span>
      <TraceTitle
        role={step.live ? "status" : undefined}
        className="whitespace-normal text-pretty"
      >
        {step.text}
      </TraceTitle>
    </TraceLine>
  )
}

export function ActorChip({
  actor,
  className,
}: {
  actor: Actor
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full px-2 font-mono text-[11px] font-medium",
        ACTORS[actor].className,
        className
      )}
    >
      {ACTORS[actor].name}
    </span>
  )
}
