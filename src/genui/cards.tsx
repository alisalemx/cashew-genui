import { CircleAlert, CreditCard, Info, Landmark, PiggyBank, Sparkles, TrendingUp, Wallet } from "lucide-react"
import { cn } from "cn"
import { useLayoutEffect, useRef, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { daysUntil, money, percent, shortDate, signedMoney } from "@/lib/format"
import { Balance, CashewCard, Change, Figure, Mono, rise, RowItem, Rows } from "./parts"

export function Stat({
  label,
  value,
  caption,
  change,
  changeIsGood,
}: {
  label: string
  value: number
  caption?: string | null
  change?: number | null
  changeIsGood?: boolean | null
}) {
  return (
    <Card className="h-full gap-1 px-5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Figure value={value} />
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        {change != null ? <Change value={change} rising={changeIsGood === false ? "bad" : "good"} /> : null}
        {caption ? <Mono>{caption}</Mono> : null}
      </div>
    </Card>
  )
}

const ACCOUNT_ICONS = { chequing: Wallet, savings: PiggyBank, credit: CreditCard, investment: TrendingUp }

export function AccountList({
  title,
  accounts,
}: {
  title: string
  accounts: { name: string; kind: keyof typeof ACCOUNT_ICONS; lastFour: string; balance: number; detail?: string | null }[]
}) {
  return (
    <CashewCard title={title} caption={`${accounts?.length ?? 0} accounts`}>
      <Rows>
        {(accounts ?? []).map((a) => {
          const Icon = ACCOUNT_ICONS[a.kind] ?? Landmark
          return (
            <RowItem key={a.lastFour}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                <Icon className="size-4.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{a.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  <span className="tabular-nums">•••• {a.lastFour}</span>
                  {a.detail ? <> · {a.detail}</> : null}
                </div>
              </div>
              <span className="font-medium tabular-nums">
                <Balance value={a.balance} />
              </span>
            </RowItem>
          )
        })}
      </Rows>
    </CashewCard>
  )
}

/**
 * Each transaction with a key that holds as new ones arrive above it, so only
 * the new row rises. Identical charges, like the planted double Uber Eats
 * charge, are numbered oldest first, so a repeat on top doesn't renumber them.
 */
function keyed<T extends { date: string; merchant: string; amount: number }>(transactions: T[]) {
  const seen = new Map<string, number>()
  return transactions
    .toReversed()
    .map((t) => {
      const same = `${t.date}-${t.merchant}-${t.amount}`
      const n = seen.get(same) ?? 0
      seen.set(same, n + 1)
      return { key: `${same}-${n}`, t }
    })
    .toReversed()
}

/**
 * When rows land on top of a list, the rows already there slide down to make
 * room instead of jumping, 250ms on the same in-and-out curve as the
 * dashboard's glide, shorter for a shorter move. The list keeps its height,
 * so nothing below it moves. Reduced motion lets them jump.
 */
function useMakeRoom(top: string | undefined) {
  const list = useRef<HTMLUListElement>(null)
  const was = useRef(top)
  useLayoutEffect(() => {
    const before = was.current
    was.current = top
    const items = [...(list.current?.children ?? [])] as HTMLElement[]
    const keys = items.map((el) => el.dataset.row)
    const added = before ? keys.indexOf(before) : -1
    if (added < 1 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const room = items[added].offsetTop - items[0].offsetTop
    for (const el of items.slice(added)) {
      el.animate([{ transform: `translateY(${-room}px)` }, { transform: "none" }], {
        duration: 250,
        easing: "cubic-bezier(0.645, 0.045, 0.355, 1)",
      })
    }
  }, [top])
  return list
}

export function TransactionList({
  title,
  caption,
  transactions,
}: {
  title: string
  caption?: string | null
  transactions: { date: string; merchant: string; category: string; amount: number }[]
}) {
  const rows = keyed((transactions ?? []).slice(0, 10))
  // A row that lands above the ones the card first showed, like a transfer
  // you just sent, rises in. Rows streaming in below them don't.
  const [first] = useState(() => new Set(rows.map((r) => r.key)))
  const known = rows.findIndex((r) => first.has(r.key))
  const list = useMakeRoom(rows[0]?.key)
  return (
    <CashewCard title={title} caption={caption}>
      {rows.length ? (
        <Rows divided ref={list}>
          {rows.map(({ key, t }, i) => (
            <RowItem key={key} data-row={key} className={cn(i < known && rise.self)}>
              <Mono className="w-12 shrink-0">{shortDate(t.date)}</Mono>
              <div className="min-w-0 flex-1">
                <div className="truncate">{t.merchant}</div>
                <div className="truncate text-xs text-muted-foreground">{t.category}</div>
              </div>
              <span className={cn("tabular-nums", t.amount > 0 && "text-good")}>{signedMoney(t.amount)}</span>
            </RowItem>
          ))}
        </Rows>
      ) : (
        <p className="text-sm text-muted-foreground">No transactions in this period.</p>
      )}
    </CashewCard>
  )
}

export function CategoryBreakdown({
  title,
  caption,
  total,
  categories,
}: {
  title: string
  caption?: string | null
  total: number
  categories: { name: string; amount: number; share: number }[]
}) {
  const list = categories ?? []
  const top = list.slice(0, 5)
  const rest = list.slice(5)
  const rows = rest.length
    ? [...top, { name: "Everything else", amount: rest.reduce((s, c) => s + c.amount, 0), share: rest.reduce((s, c) => s + c.share, 0) }]
    : top
  const widest = Math.max(...rows.map((r) => r.share), 1)

  return (
    <CashewCard title={title} caption={caption}>
      <Figure value={total} size="md" />
      <ul className="mt-4 flex flex-col gap-3">
        {rows.map((c) => (
          <li key={c.name} className="flex flex-col gap-1.5">
            <div className="flex items-baseline gap-2 text-sm">
              <span className="flex-1 truncate">{c.name}</span>
              <Mono>{percent(c.share)}</Mono>
              <span className="w-24 text-right tabular-nums">{money(c.amount)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(c.share / widest) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </CashewCard>
  )
}

export function Comparison({
  title,
  current,
  previous,
  higherIsGood,
}: {
  title: string
  current: { label: string; amount: number }
  previous: { label: string; amount: number }
  higherIsGood?: boolean | null
}) {
  const diff = current.amount - previous.amount
  const change = previous.amount ? (diff / previous.amount) * 100 : 0
  const max = Math.max(current.amount, previous.amount, 1)
  return (
    <CashewCard title={title}>
      <div className="grid grid-cols-2 gap-4">
        {[current, previous].map((p, i) => (
          <div key={p.label} className="flex flex-col gap-1">
            <Mono>{p.label}</Mono>
            <Figure value={p.amount} size="md" className={i === 1 ? "text-muted-foreground" : undefined} />
            <div className="h-1.5 rounded-full bg-muted">
              <div className={cn("h-full rounded-full", i === 0 ? "bg-primary" : "bg-chart-4/40")} style={{ width: `${(p.amount / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm">
        {diff === 0 ? (
          "The same as before."
        ) : (
          <>
            {money(Math.abs(diff))} {diff < 0 ? "less" : "more"} than {previous.label}{" "}
            <Change value={change} rising={higherIsGood ? "good" : "bad"} />
          </>
        )}
      </p>
    </CashewCard>
  )
}

export function MerchantList({
  title,
  merchants,
}: {
  title: string
  merchants: { merchant: string; category: string; amount: number; count: number }[]
}) {
  return (
    <CashewCard title={title}>
      <Rows divided>
        {(merchants ?? []).map((m, i) => (
          <RowItem key={m.merchant}>
            <Mono className="w-5 shrink-0">{String(i + 1).padStart(2, "0")}</Mono>
            <div className="min-w-0 flex-1">
              <div className="truncate">{m.merchant}</div>
              <div className="truncate text-xs text-muted-foreground">
                {m.category} · {m.count} {m.count === 1 ? "purchase" : "purchases"}
              </div>
            </div>
            <span className="tabular-nums">{money(m.amount)}</span>
          </RowItem>
        ))}
      </Rows>
    </CashewCard>
  )
}

export function BillList({
  title,
  bills,
}: {
  title: string
  bills: { name: string; due: string; amount: number; autopay: boolean }[]
}) {
  return (
    <CashewCard title={title}>
      <Rows divided>
        {(bills ?? []).map((b) => {
          const days = daysUntil(b.due)
          return (
            <RowItem key={b.name}>
              <div className="flex w-16 shrink-0 flex-col whitespace-nowrap">
                <Mono className="text-foreground">{shortDate(b.due)}</Mono>
                <Mono>{days <= 0 ? "today" : days === 1 ? "1 day" : `${days} days`}</Mono>
              </div>
              <div className="min-w-0 flex-1 truncate">{b.name}</div>
              {b.autopay ? <Badge variant="secondary">Autopay</Badge> : null}
              <span className="w-20 text-right tabular-nums">{money(b.amount)}</span>
            </RowItem>
          )
        })}
      </Rows>
    </CashewCard>
  )
}

export function HoldingsTable({
  title,
  holdings,
}: {
  title: string
  holdings: { symbol: string; name: string; value: number; returnPct: number }[]
}) {
  return (
    <CashewCard title={title} caption="Total return">
      <Rows divided>
        {(holdings ?? []).map((h) => (
          <RowItem key={h.symbol}>
            <Mono className="w-11 shrink-0 text-foreground">{h.symbol}</Mono>
            <div className="min-w-0 flex-1 truncate text-muted-foreground">{h.name}</div>
            <span className="tabular-nums">{money(h.value)}</span>
            <span className="w-16 text-right">
              <Change value={h.returnPct} />
            </span>
          </RowItem>
        ))}
      </Rows>
    </CashewCard>
  )
}

// Validated as a categorical set: cobalt, pink, then apricot.
const SEGMENT_COLOURS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"]

export function Allocation({ title, segments }: { title: string; segments: { name: string; share: number }[] }) {
  const list = (segments ?? []).filter((s) => s.share > 0)
  return (
    <CashewCard title={title}>
      <div className="flex h-3 gap-0.5" role="img" aria-label={list.map((s) => `${s.name} ${percent(s.share)}`).join(", ")}>
        {list.map((s, i) => (
          <div
            key={s.name}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${s.share}%`, background: SEGMENT_COLOURS[i % SEGMENT_COLOURS.length] }}
          />
        ))}
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {list.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2 text-sm">
            <span className="size-2 rounded-full" style={{ background: SEGMENT_COLOURS[i % SEGMENT_COLOURS.length] }} aria-hidden />
            <span className="flex-1">{s.name}</span>
            <span className="tabular-nums">{percent(s.share)}</span>
          </li>
        ))}
      </ul>
    </CashewCard>
  )
}

const NOTE_ICONS = { info: Info, good: Sparkles, warning: CircleAlert }

export function Note({ tone, text }: { tone?: "info" | "good" | "warning" | null; text: string }) {
  const Icon = NOTE_ICONS[tone ?? "info"]
  return (
    <Alert className={cn("border-transparent bg-muted", tone === "good" && "bg-highlight/40", tone === "warning" && "bg-chart-3/15")}>
      <Icon className={cn("text-primary", tone === "warning" && "text-bad")} aria-hidden />
      <AlertDescription className="text-foreground">{text}</AlertDescription>
    </Alert>
  )
}
