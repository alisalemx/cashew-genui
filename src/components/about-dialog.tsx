import { ArrowUpRight, FlaskConical, RotateCcw } from "lucide-react"
import { cn } from "cn"
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { type Actor, ActorChip, ComponentName } from "@/components/agent/turn-view"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CardBlock, FigureBlock, ListBlock, TextBlock } from "@/genui/blocks"
import { CategoryBreakdown, Stat } from "@/genui/cards"
import { CardSkeleton, skeletonBar, type CardShape } from "@/genui/skeleton"
import { CLAUDE_MODEL, JEV_MODEL } from "@/shared/protocol"

// How a question finds its answer, played back from real /api/ask runs on
// October 16, 2026, and what the demo is built with. Record the runs again
// when routing or the catalogue changes.

export function AboutDialog() {
  const [tab, setTab] = useState("flow")
  return (
    <Dialog>
      {/* Buttons that open a dialog skip the usual press, so it's set here. */}
      <DialogTrigger render={<Button size="sm" className="relative hit-area rounded-full font-sans active:scale-[0.96]" />}>
        <FlaskConical data-icon="inline-start" />
        <span className="sm:hidden">About</span>
        <span className="hidden sm:inline">About this experiment</span>
      </DialogTrigger>
      {/* Pinned near the top, so the answer grows downward and the questions stay put. */}
      <DialogContent className="top-4 max-h-[calc(100svh-2rem)] translate-y-0 gap-5 overflow-y-auto rounded-3xl p-5 sm:top-[8svh] sm:max-h-[84svh] sm:max-w-2xl sm:p-6">
        <div className="flex flex-col gap-2">
          <DialogTitle className="text-lg font-semibold tracking-[-0.02em]">About this experiment</DialogTitle>
          <DialogDescription className="leading-relaxed text-pretty">
            Most AI assistants write every answer from scratch, which takes seconds and puts something unchecked on screen. This experiment
            tests Jev, a model built to choose between options. Jev scores Cashew’s ready-made cards against each question and picks the best
            fit in about a second, and it passes a question to Claude only when no card can answer it.
          </DialogDescription>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as string)} className="gap-5">
          <TabsList className="w-full sm:w-fit">
            <TabsTrigger value="flow" className="px-3">
              How it works
            </TabsTrigger>
            <TabsTrigger value="stack" className="px-3">
              Tech stack
            </TabsTrigger>
          </TabsList>
          <TabsContent value="flow">
            <Flow />
          </TabsContent>
          <TabsContent value="stack">
            <Stack />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

/** Something Jev or Claude did, at milliseconds from the question being asked. */
interface Step {
  at: number
  actor: Actor
  text: ReactNode
  /** The tools Claude called, by their code names. */
  tools?: string[]
}

interface Run {
  question: string
  /** Whether Jev found a ready-made card that answers it. */
  fits: boolean
  steps: Step[]
  /** When the answer was complete. */
  end: number
  /** The card Cashew showed, and the shape of its skeleton while it's on its way. */
  card: { shape: CardShape; draw: () => ReactNode }
}

const SEPTEMBER = [
  { name: "Housing", amount: 2150, share: 38.75 },
  { name: "Travel", amount: 1693.48, share: 30.52 },
  { name: "Dining", amount: 584.8, share: 10.54 },
  { name: "Groceries", amount: 442.71, share: 7.98 },
  { name: "Shopping", amount: 222.74, share: 4.01 },
  { name: "Bills and utilities", amount: 149, share: 2.69 },
  { name: "Transport", amount: 114.62, share: 2.07 },
  { name: "Health", amount: 99.51, share: 1.79 },
  { name: "Entertainment", amount: 55.05, share: 0.99 },
  { name: "Subscriptions", amount: 36.97, share: 0.67 },
]

const RUNS: Run[] = [
  {
    question: "How’s my spending this month?",
    fits: true,
    steps: [
      { at: 920, actor: "jev", text: <>Picks the <ComponentName name="Stat" /> card</> },
      { at: 2170, actor: "claude", text: "Writes a line above it" },
    ],
    end: 2170,
    card: {
      shape: "stat",
      draw: () => <Stat label="Spent this month" value={3054.4} caption="against Sep 1 to 16" change={-11.3} changeIsGood={false} />,
    },
  },
  {
    question: "Why was September so expensive?",
    fits: false,
    steps: [
      { at: 540, actor: "jev", text: "Passes it to Claude, since it asks why" },
      { at: 2220, actor: "claude", text: "Reads your spending", tools: ["getMonthlySpending", "getCategoryBreakdown", "getTopMerchants"] },
      { at: 6790, actor: "claude", text: "Writes the answer" },
      { at: 7260, actor: "claude", text: <>Picks the <ComponentName name="CategoryBreakdown" /> card</> },
    ],
    end: 8600,
    card: {
      shape: "categories",
      draw: () => <CategoryBreakdown title="Where September went" caption="September 2026" total={5548.88} categories={SEPTEMBER} />,
    },
  },
  {
    question: "What would skipping Tim Hortons and Balzac’s save me this year?",
    fits: false,
    steps: [
      { at: 450, actor: "jev", text: "Passes it to Claude, since it needs a calculation" },
      { at: 3670, actor: "claude", text: "Reads your transactions", tools: ["getTransactions", "getTransactions"] },
      { at: 14010, actor: "claude", text: "Writes the answer" },
      {
        at: 15160,
        actor: "claude",
        text: (
          <>
            Builds a new card from <ComponentName name="Figure" />, <ComponentName name="List" />, and <ComponentName name="Text" />
          </>
        ),
      },
    ],
    end: 15170,
    card: {
      shape: "card",
      draw: () => (
        <CardBlock title="Skipping both, per year" caption="Based on May to September">
          <FigureBlock label="Saved per year" value={1152.41} format="money" />
          <ListBlock
            title="Yearly cost of each"
            style="bars"
            items={[
              { label: "Tim Hortons", value: 696.6 },
              { label: "Balzac’s Coffee", value: 455.81 },
            ]}
          />
          <TextBlock text="Each place's yearly cost is its average monthly spend from May to September, multiplied by twelve." />
        </CardBlock>
      ),
    },
  },
]

/**
 * How long each kind of piece stays the newest before the next arrives, long
 * enough to read it: short labels briefly, steps longer, the card longest.
 */
const HOLD = { label: 900, question: 1300, step: 1500, tools: 2000, card: 2000 }

/** A pause after the click, so the picked question registers first. */
const LEAD = 300

/** How each piece arrives: slower than Cashew's usual rise, so the order reads. */
const reveal = "animate-in fade-in-0 slide-in-from-bottom-2 duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:animate-none"

function Flow() {
  // Nothing plays until a question is picked.
  const [picked, setPicked] = useState<number | null>(null)
  // Asking the same question again plays it again.
  const [take, setTake] = useState(0)

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-3">
        <h3 className="font-mono text-[11px] text-muted-foreground">Pick a question</h3>
        <div role="radiogroup" aria-label="Question" className="flex flex-wrap gap-2">
          {RUNS.map((r, i) => (
            <button
              key={r.question}
              type="button"
              role="radio"
              aria-checked={picked === i}
              onClick={() => {
                setPicked(i)
                setTake((t) => t + 1)
              }}
              // The questions rise in one after another when the tab opens.
              style={{ animationDelay: `${i * 250}ms` }}
              className={cn(
                "rounded-2xl px-4 py-3 text-left text-base leading-snug font-medium tracking-[-0.01em] transition-colors duration-150 ease-out [animation-fill-mode:backwards] sm:text-lg",
                reveal,
                // Blush makes the questions the inviting place to start; the picked one is solid.
                "text-highlight-foreground",
                picked === i ? "bg-highlight" : "bg-highlight/30 hover:bg-highlight/55"
              )}
            >
              {r.question}
            </button>
          ))}
        </div>
      </section>
      {picked === null ? null : <Playback key={take} run={RUNS[picked]} onReplay={() => setTake((t) => t + 1)} />}
    </div>
  )
}

/**
 * How many pieces are in, adding one after a short lead and then after each
 * piece's hold. With reduced motion they're all in from the start.
 */
function useStage(holds: number[]) {
  const [still] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches)
  const [stage, setStage] = useState(still ? holds.length : 0)

  useEffect(() => {
    if (stage >= holds.length) return
    const timer = setTimeout(() => setStage((n) => n + 1), stage === 0 ? LEAD : holds[stage - 1])
    return () => clearTimeout(timer)
  }, [stage, holds])

  return stage
}

/**
 * Reveals the answer one piece at a time, top to bottom, each held long
 * enough to read before the next moves in: "Jev checks", its question, Yes or No, each
 * step, the card, then the total.
 */
function Playback({ run, onReplay }: { run: Run; onReplay: () => void }) {
  // Each piece, in order, with how long it stays the newest.
  const pieces = useMemo(
    () => [
      ["checks", HOLD.label],
      ["question", HOLD.question],
      ["answer", HOLD.label],
      ...run.steps.map((s, i) => [`step${i}`, s.tools ? HOLD.tools : HOLD.step] as const),
      ["shows", HOLD.label],
      ["card", HOLD.card],
      ["total", 0],
    ] as const,
    [run]
  )
  const order: string[] = pieces.map(([piece]) => piece)
  const holds = useMemo(() => pieces.map(([, hold]) => hold), [pieces])
  const stage = useStage(holds)
  const done = stage >= order.length
  const shown = (piece: string) => order.indexOf(piece) < stage
  /** Classes for a piece: in place but invisible, then rising in on its beat. */
  const enter = (piece: string) => (shown(piece) ? reveal : "opacity-0")
  /** A piece's skeleton holds its place, then fades as the piece rises in. */
  const ghost = (piece: string) => cn("pointer-events-none absolute transition-opacity duration-300 ease-out", shown(piece) && "opacity-0")
  /** Marks a piece for screen readers and for the scroll that follows the newest one. */
  const mark = (piece: string) => ({ "aria-hidden": !shown(piece), "data-shown": shown(piece) || undefined })

  // On a short screen, the modal scrolls to keep the newest piece in view.
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const newest = [...(box.current?.querySelectorAll("[data-shown]") ?? [])].at(-1)
    if (!newest) return
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    newest.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" })
  }, [stage])

  return (
    // Everything has its place from the start, held by a skeleton in its own
    // shape, so nothing shifts as it arrives.
    <div ref={box} className="flex flex-col gap-6">
      <section className="flex flex-col gap-2.5">
        <div className="relative w-fit">
          <h3 {...mark("checks")} className={cn("font-mono text-[11px] text-muted-foreground", enter("checks"))}>
            <ActorChip actor="jev" className="mr-1.5" />
            checks
          </h3>
          <Ghost className={cn("inset-0", ghost("checks"))} round="rounded-full" />
        </div>
        <p className="text-2xl leading-tight font-semibold tracking-[-0.03em] text-balance sm:text-3xl">
          <span className="relative inline-block">
            <span {...mark("question")} className={cn("inline-block", enter("question"))}>
              Can a ready-made card answer it?
            </span>
            <Ghost className={cn("inset-x-0 inset-y-[0.3em]", ghost("question"))} round="rounded-lg" />
          </span>{" "}
          <span className="relative inline-block">
            <span {...mark("answer")} className={cn("inline-block", enter("answer"), run.fits ? "text-primary" : "text-claude-ink")}>
              {run.fits ? "Yes" : "No"}
            </span>
            <Ghost className={cn("inset-x-0 inset-y-[0.3em]", ghost("answer"))} round="rounded-lg" />
          </span>
        </p>
      </section>

      <ol aria-label="What happens" className="flex flex-col gap-3 rounded-2xl bg-background p-4 text-sm sm:p-5">
        {run.steps.map((s, i) => (
          <li key={s.at} className="relative">
            <div {...mark(`step${i}`)} className={cn("grid grid-cols-[3rem_4rem_minmax(0,1fr)] items-baseline", enter(`step${i}`))}>
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">{(s.at / 1000).toFixed(2)}s</span>
              <ActorChip actor={s.actor} className="justify-self-start" />
              <span className="min-w-0 text-pretty">
                {s.text}
                {s.tools ? (
                  <span className="mt-1 flex flex-wrap gap-x-2 font-mono text-[11px] text-muted-foreground">
                    {s.tools.map((tool, j) => (
                      <span key={j}>{tool}()</span>
                    ))}
                  </span>
                ) : null}
              </span>
            </div>
            <div aria-hidden className={cn("inset-0 grid grid-cols-[3rem_4rem_minmax(0,1fr)] items-start", ghost(`step${i}`))}>
              <Bar line="h-5" bar="h-3 w-9" />
              <Bar line="h-5" bar="h-5 w-12 rounded-full" />
              <div className="flex flex-col">
                <Bar line="h-5" bar="h-3.5 w-3/4" />
                {s.tools ? <Bar line="mt-1 h-4" bar="h-3 w-1/2" /> : null}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {/* The card exactly as Cashew showed it, drawn by the real component. */}
      <section className="flex flex-col gap-2.5">
        <div className="relative w-fit">
          <h3 {...mark("shows")} className={cn("font-mono text-[11px] text-muted-foreground", enter("shows"))}>
            <ActorChip actor="cashew" className="mr-1.5" />
            shows
          </h3>
          <Ghost className={cn("inset-0", ghost("shows"))} round="rounded-full" />
        </div>
        <div className="relative">
          <div {...mark("card")} className={enter("card")}>
            {run.card.draw()}
          </div>
          <div aria-hidden className={cn("inset-0", ghost("card"))}>
            <CardSkeleton shape={run.card.shape} />
          </div>
        </div>
      </section>

      <div className="relative">
        <div {...mark("total")} className={cn("flex items-end justify-between gap-4", enter("total"))}>
          <p className="flex flex-col gap-1">
            <span className="font-mono text-[11px] text-muted-foreground">Answered in</span>
            <span className="text-4xl font-semibold tracking-[-0.045em] tabular-nums">
              {(run.end / 1000).toFixed(2)}
              <span className="text-xl text-muted-foreground">s</span>
            </span>
          </p>
          <Button variant="ghost" size="sm" className="relative hit-area" tabIndex={done ? undefined : -1} onClick={onReplay}>
            <RotateCcw data-icon="inline-start" />
            Replay
          </Button>
        </div>
        <div aria-hidden className={cn("inset-y-0 left-0 flex flex-col justify-end gap-1", ghost("total"))}>
          <Bar line="h-4" bar="h-3 w-20" />
          <Bar line="h-10" bar="h-8 w-24" />
        </div>
      </div>
    </div>
  )
}

/** One skeleton bar, centred in the height of the line it stands in for. */
function Bar({ line, bar }: { line: string; bar: string }) {
  return (
    <span className={cn("flex items-center", line)}>
      <span className={cn("block animate-pulse rounded-md", skeletonBar, bar)} />
    </span>
  )
}

/** A skeleton the size of the piece it covers. */
function Ghost({ className, round }: { className: string; round: string }) {
  return (
    <span aria-hidden className={className}>
      <span className={cn("block size-full animate-pulse", skeletonBar, round)} />
    </span>
  )
}

const STACK: { name: string; detail: string; about: string; href: string }[] = [
  {
    name: "Jev",
    detail: JEV_MODEL,
    about: "TypeSafe’s decision model scores every ready-made card against your question and picks the best match, or passes the question to Claude when none fits.",
    href: "https://typesafe.ai",
  },
  {
    name: "Claude Haiku 5.5",
    detail: CLAUDE_MODEL,
    about: "Every written reply comes from Anthropic’s language model, which also builds a new card from Cashew’s blocks when no ready-made card fits.",
    href: "https://www.anthropic.com/claude/haiku",
  },
  {
    name: "json-render",
    detail: "@json-render/react",
    about: "This library turns the JSON that describes each answer into Cashew’s real components, and draws the cards as they stream in.",
    href: "https://json-render.dev",
  },
  {
    name: "shadcn/ui",
    detail: "Base UI and Tailwind",
    about: "Cashew’s design system is built on these open-source React components, restyled for the brand.",
    href: "https://ui.shadcn.com",
  },
  {
    name: "Cloudflare Workers",
    detail: "AI Gateway",
    about: "Cloudflare runs the app and its API close to each visitor, and Cloudflare AI Gateway connects the API to Jev.",
    href: "https://workers.cloudflare.com",
  },
]

function Stack() {
  return (
    <ul aria-label="Tech stack" className="flex flex-col gap-5">
      {STACK.map((s) => (
        <li key={s.name} className="flex flex-col gap-1">
          <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <a
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="group relative hit-area inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
            >
              {s.name}
              <ArrowUpRight className="size-3.5 text-muted-foreground transition-colors duration-150 group-hover:text-foreground" aria-hidden />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <span className="font-mono text-[11px] text-muted-foreground">{s.detail}</span>
          </span>
          <p className="text-sm leading-relaxed text-pretty text-muted-foreground">{s.about}</p>
        </li>
      ))}
    </ul>
  )
}
