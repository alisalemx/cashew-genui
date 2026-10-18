import { cn } from "cn"
import type { ReactNode } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

// Placeholders in the shapes of Cashew's real cards, used while an answer is on
// its way. Each line sits in the height of the text it stands in for, so the
// real card lands in the same space.

/** The shapes a card can take while it's on its way. */
export type CardShape = "stat" | "list" | "bars" | "categories" | "portfolio" | "form" | "card"

/** The fill and pulse every placeholder shares. */
export const skeletonBar = "bg-foreground/[0.07] motion-reduce:animate-none"

function Line({ height, bar, className }: { height: string; bar: string; className?: string }) {
  return (
    <div className={cn("flex items-center", height, className)}>
      <Skeleton className={cn(skeletonBar, bar)} />
    </div>
  )
}

/** The lines of a written reply, at the reply's own line height. */
export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  const widths = ["w-full", "w-11/12", "w-2/3"]
  return (
    <div className="flex flex-col" aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Line key={i} height="h-[1.545rem]" bar={cn("h-3.5", i === lines - 1 ? "w-2/3" : widths[i % 2])} />
      ))}
    </div>
  )
}

/** A card's title and caption, like `CashewCard`'s header. */
function Header() {
  return (
    <CardHeader className="flex items-center justify-between gap-3">
      <Line height="h-6" bar="h-4 w-32" />
      <Line height="h-6" bar="h-3 w-20" />
    </CardHeader>
  )
}

function Shell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Card className={cn("h-full gap-5", className)} aria-hidden>
      <Header />
      <CardContent className="flex flex-col">{children}</CardContent>
    </Card>
  )
}

const BAR_HEIGHTS = ["68%", "52%", "50%", "56%", "82%", "46%"]
const ROW_WIDTHS = ["w-3/5", "w-2/5", "w-1/2", "w-3/5"]

/** A placeholder in the shape of the card that's coming. */
export function CardSkeleton({ shape, className }: { shape: CardShape; className?: string }) {
  if (shape === "stat") {
    return (
      <Card className={cn("h-full gap-1 px-5", className)} aria-hidden>
        <Line height="h-5" bar="h-3.5 w-28" />
        <Line height="h-10" bar="h-8 w-44" />
        <Line height="h-5" bar="h-3 w-36" className="mt-1" />
      </Card>
    )
  }

  if (shape === "list") {
    return (
      <Shell className={className}>
        <ul className="-my-2 flex flex-col divide-y-(length:--hairline) divide-divider">
          {ROW_WIDTHS.map((width, i) => (
            <li key={i} className="flex items-center gap-3 py-2.5">
              <Line height="h-5" bar="h-3 w-10" className="w-12 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col">
                <Line height="h-5" bar={cn("h-3.5", width)} />
                <Line height="h-4" bar="h-3 w-1/4" />
              </div>
              <Line height="h-5" bar="h-3.5 w-16" />
            </li>
          ))}
        </ul>
      </Shell>
    )
  }

  if (shape === "bars") {
    return (
      <Shell className={className}>
        <div className="flex h-44 flex-col pt-2">
          <div className="flex min-h-0 flex-1 items-end gap-3 pl-11">
            {BAR_HEIGHTS.map((height, i) => (
              <div key={i} className="flex h-full flex-1 items-end justify-center">
                <Skeleton className={cn(skeletonBar, "w-6 max-w-full rounded-b-none rounded-t-[4px]")} style={{ height }} />
              </div>
            ))}
          </div>
          <div className="flex h-7 items-center gap-3 pl-11">
            {BAR_HEIGHTS.map((_, i) => (
              <div key={i} className="flex flex-1 justify-center">
                <Skeleton className={cn(skeletonBar, "h-3 w-6")} />
              </div>
            ))}
          </div>
        </div>
        <Line height="h-4" bar="h-3 w-40" className="mt-2" />
      </Shell>
    )
  }

  if (shape === "categories") {
    return (
      <Shell className={className}>
        <Line height="h-8" bar="h-6 w-32" />
        <ul className="mt-4 flex flex-col gap-3">
          {ROW_WIDTHS.map((width, i) => (
            <li key={i} className="flex flex-col gap-1.5">
              <div className="flex h-5 items-center justify-between gap-2">
                <Skeleton className={cn(skeletonBar, "h-3.5 w-24")} />
                <Skeleton className={cn(skeletonBar, "h-3.5 w-16")} />
              </div>
              <div className="h-1.5 rounded-full bg-foreground/[0.04]">
                <Skeleton className={cn(skeletonBar, "h-full rounded-full", width)} />
              </div>
            </li>
          ))}
        </ul>
      </Shell>
    )
  }

  if (shape === "portfolio") {
    return (
      <Shell className={className}>
        <Line height="h-10" bar="h-8 w-44" />
        <div className="mt-3 flex h-36 flex-col">
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="min-h-0 w-full flex-1 animate-pulse text-foreground/[0.1] motion-reduce:animate-none">
            <path
              d="M0 26 C 8 18, 16 20, 24 17 S 38 12, 46 16 S 58 22, 64 20 S 72 34, 78 32 S 90 22, 100 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="flex h-7 items-center justify-between">
            {BAR_HEIGHTS.map((_, i) => (
              <Skeleton key={i} className={cn(skeletonBar, "h-3 w-6")} />
            ))}
          </div>
        </div>
      </Shell>
    )
  }

  if (shape === "form") {
    return (
      <Shell className={cn("gap-4", className)}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Line height="h-5" bar="h-3.5 w-8" />
            <div className="flex gap-2">
              {["w-24", "w-20", "w-24"].map((width, i) => (
                <Skeleton key={i} className={cn(skeletonBar, "h-8 rounded-full", width)} />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Line height="h-5" bar="h-3.5 w-14" />
            <Skeleton className={cn(skeletonBar, "h-8 w-full rounded-lg")} />
          </div>
          <Skeleton className={cn(skeletonBar, "mt-1 h-8 w-full rounded-lg")} />
        </div>
      </Shell>
    )
  }

  // A card Claude builds from blocks: a figure, then a short list.
  return (
    <Shell className={className}>
      <Line height="h-5" bar="h-3.5 w-24" />
      <Line height="h-8" bar="h-6 w-36" />
      <ul className="mt-4 flex flex-col">
        {ROW_WIDTHS.slice(0, 3).map((width, i) => (
          <li key={i} className="flex items-center justify-between gap-3 py-2.5">
            <Line height="h-5" bar={cn("h-3.5", width)} className="flex-1" />
            <Line height="h-5" bar="h-3.5 w-16" />
          </li>
        ))}
      </ul>
    </Shell>
  )
}

/**
 * The shape of the card Claude is likely to build, from the data it asked
 * for. Claude often reads several kinds of data and shows the most specific,
 * so the shapes are ranked: a transfer form first, then categories, the
 * portfolio, monthly spending, lists, single figures, and last a card built
 * from blocks, which is what a calculation over transactions usually becomes.
 */
const TOOL_SHAPES: [CardShape, string[]][] = [
  ["form", ["getContacts"]],
  ["categories", ["getCategoryBreakdown", "getBudgets", "getSavingsGoals"]],
  ["portfolio", ["getPortfolio", "getBalanceHistory"]],
  ["bars", ["getMonthlySpending", "getCashFlow"]],
  ["list", ["getBills", "getSubscriptions", "getTopMerchants", "getAccounts"]],
  ["stat", ["getCreditCard", "getCreditScore"]],
]

export function shapeForTools(tools: string[]): CardShape {
  return TOOL_SHAPES.find(([, names]) => names.some((name) => tools.includes(name)))?.[0] ?? "card"
}
