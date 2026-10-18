import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { money, moneyCompact, shortDate } from "@/lib/format"
import { CashewCard, Change, Figure, Mono } from "./parts"

// Single-series charts only, so there's no legend: the title names the series.
// Bars stay thin with rounded ends, the current month carries the brand cobalt,
// and gridlines are hairlines in the background.

const spendConfig = { amount: { label: "Spent", color: "var(--chart-1)" } } satisfies ChartConfig
const valueConfig = { value: { label: "Value", color: "var(--chart-1)" } } satisfies ChartConfig

const axisTick = { fontSize: 11, fontFamily: "var(--font-mono)" }

// Charts draw in quickly on arrival, and the tooltip keeps up with the cursor
// instead of trailing it. Hover marks stay light, so the data stays the loudest
// thing in the chart. Recharts turns both off for reduced motion.
const drawIn = { animationDuration: 400, animationEasing: "ease-out" } as const
const follow = { animationDuration: 150, animationEasing: "ease-out" } as const

/**
 * Gridlines at round, even steps from zero, as many as fit (up to four
 * gaps), while keeping each at least a quarter of a gap from the average
 * line. A gridline right beside it reads as one smudged double line.
 */
function axisTicks(max: number, avg: number | null) {
  if (!(max > 0)) return undefined
  const round = (v: number) => {
    const p = 10 ** Math.floor(Math.log10(v))
    return [1, 1.5, 2, 2.5, 3, 5, 10].map((m) => m * p).find((s) => s >= v) ?? 10 * p
  }
  let ticks: number[] = []
  for (const gaps of [4, 3, 2]) {
    const step = round(max / gaps)
    ticks = Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step)
    if (avg == null || ticks.every((t) => Math.abs(t - avg) >= step / 4)) break
  }
  return ticks
}

export function SpendingChart({
  title,
  caption,
  style,
  months,
  average,
}: {
  title: string
  caption?: string | null
  style: "bar" | "line"
  months: { label: string; amount: number }[]
  average?: number | null
}) {
  const data = months ?? []
  const lastIndex = data.length - 1
  const avg = average ?? null
  const ticks = axisTicks(Math.max(...data.map((m) => m.amount), avg ?? 0), avg)
  const yAxis = { width: 44, tickLine: false, axisLine: false, tick: axisTick, tickFormatter: moneyCompact, ticks, domain: ticks ? [0, ticks[ticks.length - 1]] : undefined, interval: 0 } as const

  return (
    <CashewCard title={title} caption={caption}>
      <ChartContainer config={spendConfig} className="aspect-auto h-44 w-full">
        {style === "line" ? (
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={axisTick} />
            <YAxis {...yAxis} />
            {avg ? <ReferenceLine y={avg} stroke="var(--chart-4)" strokeOpacity={0.5} /> : null}
            <ChartTooltip {...follow} cursor={false} content={<ChartTooltipContent formatter={(v) => money(Number(v))} />} />
            <Line
              {...drawIn}
              dataKey="amount"
              type="monotone"
              stroke="var(--color-amount)"
              strokeWidth={2}
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
            />
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={axisTick} />
            <YAxis {...yAxis} />
            <ChartTooltip {...follow} cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }} content={<ChartTooltipContent hideIndicator formatter={(v) => money(Number(v))} />} />
            <Bar {...drawIn} dataKey="amount" maxBarSize={24} radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={i === lastIndex ? "var(--chart-1)" : "var(--chart-1-soft)"} />
              ))}
            </Bar>
            {avg ? <ReferenceLine y={avg} stroke="var(--chart-4)" strokeOpacity={0.5} /> : null}
          </BarChart>
        )}
      </ChartContainer>
      {avg ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="h-px w-4 bg-chart-4/50" aria-hidden />
          <Mono>Monthly average {money(avg)}</Mono>
        </div>
      ) : null}
    </CashewCard>
  )
}

export function PortfolioChart({
  title,
  value,
  change,
  period,
  points,
}: {
  title: string
  value: number
  change: number
  period: string
  points: { date: string; value: number }[]
}) {
  const data = points ?? []
  const min = Math.min(...data.map((p) => p.value))
  const max = Math.max(...data.map((p) => p.value))
  const pad = (max - min) * 0.15

  return (
    <CashewCard title={title} caption={period}>
      <div className="flex items-baseline gap-3">
        <Figure value={value} />
        <Change value={change} />
      </div>
      <ChartContainer config={valueConfig} className="mt-3 aspect-auto h-36 w-full">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id="portfolio-wash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.14} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={axisTick}
            minTickGap={40}
            tickFormatter={(d: string) => shortDate(d).split(" ")[0]}
          />
          <YAxis hide domain={[min - pad, max + pad]} />
          <ChartTooltip
            {...follow}
            cursor={{ stroke: "var(--border)", strokeOpacity: 0.6 }}
            content={<ChartTooltipContent hideIndicator labelFormatter={(_, p) => shortDate(String(p?.[0]?.payload?.date ?? ""))} formatter={(v) => money(Number(v))} />}
          />
          <Area
            {...drawIn}
            dataKey="value"
            type="monotone"
            stroke="var(--color-value)"
            strokeWidth={2}
            fill="url(#portfolio-wash)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
          />
        </AreaChart>
      </ChartContainer>
    </CashewCard>
  )
}
