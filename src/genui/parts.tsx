import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { cn } from "cn"
import { createContext, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode, type Ref } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { moneyParts, percent } from "@/lib/format"

// Small pieces every Cashew card shares, so the cards read as one family.

/**
 * The one rise Cashew uses when a card arrives: in from 4px below while it
 * fades up, 200ms on a strong ease-out. Reduced motion keeps the fade and
 * drops the movement. `self` goes on the card, `children` on a container
 * whose cards should each rise. Written out in full so Tailwind finds every class.
 */
export const rise = {
  self: "animate-in fade-in-0 slide-in-from-bottom-1 duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:[--tw-enter-translate-y:0]",
  children:
    "[&>*]:animate-in [&>*]:fade-in-0 [&>*]:slide-in-from-bottom-1 [&>*]:duration-200 [&>*]:ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:[&>*]:[--tw-enter-translate-y:0]",
}

export function CashewCard({ title, caption, children, className }: { title: string; caption?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("h-full gap-5", className)}>
      {/* A caption too long to sit beside the title wraps onto its own line. */}
      <CardHeader className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <CardTitle className="min-w-0 truncate text-lg font-semibold tracking-[-0.02em]">{title}</CardTitle>
        {caption ? <Mono className="text-pretty">{caption}</Mono> : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">{children}</CardContent>
    </Card>
  )
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-xs text-muted-foreground", className)}>{children}</span>
}

/**
 * Set on each dashboard card while the dashboard rises in on first load: how
 * long, in ms, before that card starts. Its big figures count up from zero.
 */
export const Intro = createContext<number | null>(null)

/**
 * Whether figures roll when their value changes. Off for Claude's cards,
 * whose figures fill in as their data streams, so only a change to the bank
 * itself, like a transfer, rolls.
 */
export const Rolls = createContext(true)

/** Whether the home screen has already risen in once this visit. */
let introPlayed = false

/**
 * True while the home screen plays its one intro: net worth rises first, then
 * the dashboard cards 50ms apart, and their big figures count up. It plays
 * once a visit, so a reset or rearrange never replays it.
 */
export function useIntro() {
  const [intro, setIntro] = useState(() => !introPlayed)
  useEffect(() => {
    introPlayed = true
    if (!intro) return
    // The last card starts at 300ms and its figures settle by about 1100ms.
    const done = setTimeout(() => setIntro(false), 1500)
    return () => clearTimeout(done)
  }, [intro])
  return intro
}

/** A large figure with the cents set smaller, the way a statement prints it. */
export function Figure({
  value,
  size = "lg",
  className,
  centsClassName,
}: {
  value: number
  size?: "md" | "lg" | "xl"
  className?: string
  centsClassName?: string
}) {
  const delay = useContext(Intro)
  const cents = cn("text-muted-foreground", size === "md" ? "text-base" : "text-xl", centsClassName)
  return (
    <span
      className={cn(
        "font-semibold tracking-[-0.035em] text-foreground tabular-nums",
        size === "xl" && "text-5xl",
        size === "lg" && "text-4xl",
        size === "md" && "text-2xl tracking-[-0.025em]",
        className,
      )}
    >
      <Rolling value={value} intro={delay} cents={cents} />
    </span>
  )
}

/** An amount in a list row that rolls to its new value when it changes, like chequing after a transfer. */
export function Balance({ value }: { value: number }) {
  return <Rolling value={value} intro={null} cents="" />
}

function Amount({ value, cents }: { value: number; cents: string }) {
  const parts = moneyParts(value)
  return (
    <>
      {parts.sign}
      {parts.dollars}
      <span className={cents}>{parts.cents}</span>
    </>
  )
}

/**
 * Rolls an amount to its value, settling slowly on the last digits: up from
 * zero over 800ms as its card rises in on the intro (`intro` is its delay),
 * and from the old value over 400ms whenever it changes on screen, so a
 * transfer visibly comes out of net worth and chequing. A change mid-roll
 * carries on from wherever the roll is. The final amount sits underneath,
 * invisible, so the figure holds its full width and screen readers hear only
 * the real value. Reduced motion shows the value straight away.
 */
function Rolling({ value, intro, cents }: { value: number; intro: number | null; cents: string }) {
  const whole = useRef<HTMLSpanElement>(null)
  const part = useRef<HTMLSpanElement>(null)
  // What's on screen. The rolls write the digits directly, so React only sets them once.
  const shown = useRef(intro === null ? value : 0)
  const [first] = useState(() => moneyParts(intro === null ? value : 0))
  const rolls = useContext(Rolls)
  useEffect(() => {
    const show = (n: number) => {
      shown.current = n
      const p = moneyParts(n)
      whole.current!.textContent = p.sign + p.dollars
      part.current!.textContent = p.cents
    }
    const from = shown.current
    // Nothing rolls on Claude's cards, or for a value whose data hasn't arrived yet.
    const still = (intro === null && !rolls) || from === value || !Number.isFinite(from) || !Number.isFinite(value)
    if (still || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return show(value)
    let frame = 0
    const start = performance.now() + (intro ?? 0)
    const duration = intro === null ? 400 : 800
    const tick = (now: number) => {
      const t = Math.min(Math.max((now - start) / duration, 0), 1)
      show(t < 1 ? from + (value - from) * (1 - (1 - t) ** 4) : value)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, intro, rolls])
  return (
    <span className="inline-grid [&>*]:col-start-1 [&>*]:row-start-1">
      <span className="opacity-0">
        <Amount value={value} cents={cents} />
      </span>
      <span aria-hidden>
        <span ref={whole}>{first.sign + first.dollars}</span>
        <span ref={part} className={cents}>
          {first.cents}
        </span>
      </span>
    </span>
  )
}

/** A percentage change, green when the move is good news and orange when it isn't. */
export function Change({ value, rising = "good", suffix }: { value: number; rising?: "good" | "bad"; suffix?: string }) {
  const up = value > 0
  const good = value === 0 ? null : up === (rising === "good")
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-mono text-xs",
        good === true && "text-good",
        good === false && "text-bad",
        good === null && "text-muted-foreground",
      )}
    >
      {value !== 0 ? <Icon className="size-3.5" aria-hidden /> : null}
      {percent(value)}
      {suffix ? <span className="text-muted-foreground"> {suffix}</span> : null}
    </span>
  )
}

/** A list of rows, set apart by space alone, or by a light rule when divided. */
// Lists with three or more columns, like transactions, bills, top merchants,
// and holdings, are divided: a light rule helps the eye keep its place across
// the row. Accounts don't count their icon as a column.
export function Rows({ children, divided, ref }: { children: ReactNode; divided?: boolean; ref?: Ref<HTMLUListElement> }) {
  return (
    <ul ref={ref} className={cn("-my-2 flex flex-col", divided && "divide-y-(length:--hairline) divide-divider")}>
      {children}
    </ul>
  )
}

export function RowItem({ className, ...props }: ComponentProps<"li">) {
  return <li className={cn("flex items-center gap-3 py-2.5", className)} {...props} />
}
