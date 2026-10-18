import { cn } from "cn"
import { createContext, useContext, type ReactNode } from "react"
import { Progress, ProgressLabel } from "@/components/ui/progress"
import { money, moneyWhole } from "@/lib/format"
import { CashewCard, Change, Figure as FigureText, Mono, RowItem, Rows } from "./parts"

// The building blocks Claude composes into a new card when no finished card
// shows what was asked. They're cut from the same pieces as the finished
// cards, so a card built on the spot reads as part of the same family. The
// rules for combining them live in src/shared/components.md.

/** A Row inside a Card sets its figures smaller, so two fit side by side. */
const InRow = createContext(false)

export function RowBlock({ children }: { children: ReactNode }) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-3 @2xl:col-span-2 [&>*]:min-w-0">
      <InRow.Provider value={true}>{children}</InRow.Provider>
    </div>
  )
}

export function CardBlock({ title, caption, children }: { title: string; caption?: string | null; children: ReactNode }) {
  return (
    <CashewCard title={title} caption={caption}>
      <div className="flex flex-col gap-5">{children}</div>
    </CashewCard>
  )
}

type Format = "money" | "percent" | "number"

function formatValue(value: number, format: Format) {
  if (format === "percent") return `${value.toLocaleString("en-CA", { maximumFractionDigits: 1 })}%`
  return value.toLocaleString("en-CA", { maximumFractionDigits: 1 })
}

export function FigureBlock({
  label,
  value,
  format,
  caption,
  change,
  changeIsGood,
}: {
  label?: string | null
  value: number
  format?: Format | null
  caption?: string | null
  change?: number | null
  changeIsGood?: boolean | null
}) {
  const compact = useContext(InRow)
  const size = compact ? "md" : "lg"
  const kind = format ?? "money"
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {label ? <span className="text-sm text-muted-foreground">{label}</span> : null}
      {kind === "money" ? (
        <FigureText value={value ?? 0} size={size} />
      ) : (
        <span className={cn("font-semibold text-foreground tabular-nums", compact ? "text-2xl tracking-[-0.025em]" : "text-4xl tracking-[-0.035em]")}>
          {formatValue(value ?? 0, kind)}
        </span>
      )}
      {change != null || caption ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {change != null ? <Change value={change} rising={changeIsGood === false ? "bad" : "good"} /> : null}
          {caption ? <Mono>{caption}</Mono> : null}
        </div>
      ) : null}
    </div>
  )
}

type Tone = "good" | "bad"

const amount = (n: number) => (n < 0 ? `−${money(Math.abs(n))}` : money(n))

/** Cents only when there are some, so a target reads "$5,000" and not "$5,000.00". */
const plain = (n: number) => (Number.isInteger(n) ? moneyWhole(n) : money(n))

export function ListBlock({
  title,
  style,
  items,
}: {
  title?: string | null
  style?: "plain" | "bars" | null
  items: { label: string; detail?: string | null; value: number | string; tone?: Tone | null }[]
}) {
  const list = items ?? []
  const toneClass = (tone?: Tone | null) => cn(tone === "good" && "text-good", tone === "bad" && "text-bad")
  const show = (v: number | string) => (typeof v === "number" ? amount(v) : v)

  if (style === "bars") {
    const widest = Math.max(...list.map((i) => (typeof i.value === "number" ? Math.abs(i.value) : 0)), 1)
    return (
      <div className="flex flex-col gap-3">
        {title ? <Mono>{title}</Mono> : null}
        <ul className="flex flex-col gap-3">
          {list.map((item, i) => (
            <li key={`${item.label}-${i}`} className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.detail ? <Mono className="shrink-0">{item.detail}</Mono> : null}
                <span className={cn("shrink-0 text-right tabular-nums", toneClass(item.tone))}>{show(item.value)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full bg-primary", item.tone === "bad" && "bg-bad")}
                  style={{ width: `${typeof item.value === "number" ? (Math.abs(item.value) / widest) * 100 : 0}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {title ? <Mono>{title}</Mono> : null}
      <Rows>
        {list.map((item, i) => (
          <RowItem key={`${item.label}-${i}`}>
            <div className="min-w-0 flex-1">
              <div className="truncate">{item.label}</div>
              {item.detail ? <div className="truncate text-xs text-muted-foreground">{item.detail}</div> : null}
            </div>
            <span className={cn("shrink-0 tabular-nums", toneClass(item.tone))}>{show(item.value)}</span>
          </RowItem>
        ))}
      </Rows>
    </div>
  )
}

export function MeterBlock({
  label,
  value,
  target,
  kind,
  caption,
}: {
  label: string
  value: number
  target: number
  kind: "goal" | "limit"
  caption?: string | null
}) {
  const share = target > 0 ? Math.min(Math.max((value / target) * 100, 0), 100) : 0
  // A limit close to full is a warning; a goal never is.
  const strained = kind === "limit" && share >= 90
  return (
    <Progress
      value={share}
      className={cn(
        "gap-2 [&_[data-slot=progress-track]]:h-1.5",
        strained && "[&_[data-slot=progress-indicator]]:bg-bad",
      )}
    >
      <ProgressLabel className="min-w-0 flex-1 font-normal text-pretty">{label}</ProgressLabel>
      <Mono className="shrink-0 self-end text-foreground tabular-nums">
        {plain(value ?? 0)} <span className="text-muted-foreground">of {plain(target ?? 0)}</span>
      </Mono>
      {caption ? <Mono className="order-last w-full">{caption}</Mono> : null}
    </Progress>
  )
}

export function TextBlock({ text }: { text: string }) {
  return <p className="text-sm leading-relaxed text-pretty">{text}</p>
}
