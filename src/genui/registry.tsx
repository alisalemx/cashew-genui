import { ActionProvider, defineRegistry, Renderer, StateProvider, VisibilityProvider, type ComponentRenderer } from "@json-render/react"
import { createStateStore, type Spec, type StateStore } from "@json-render/core"
import { Children, createContext, isValidElement, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { cn } from "cn"
import { useBank } from "@/lib/bank"
import { catalog } from "@/shared/catalog"
import { CardBlock, FigureBlock, ListBlock, MeterBlock, RowBlock, TextBlock } from "./blocks"
import { AccountList, Allocation, BillList, CategoryBreakdown, Comparison, HoldingsTable, MerchantList, Note, Stat, TransactionList } from "./cards"
import { PortfolioChart, SpendingChart } from "./charts"
import { Intro, rise, Rolls, useIntro } from "./parts"
import { TransferForm } from "./transfer-form"

// Each catalogue entry maps to one Cashew component. Containers lay out their
// children; everything else renders straight from its props.

export const { registry } = defineRegistry(catalog, {
  components: {
    Answer: ({ props, children }) => <AnswerLayout gap={props.gap}>{children}</AnswerLayout>,
    Dashboard: ({ children }) => <DashboardLayout>{children}</DashboardLayout>,
    Row: ({ children }) => <RowBlock>{children}</RowBlock>,
    Stat: ({ props }) => <Stat {...props} />,
    AccountList: ({ props }) => <AccountList {...props} />,
    TransactionList: ({ props }) => <TransactionList {...props} />,
    SpendingChart: ({ props }) => <SpendingChart {...props} />,
    CategoryBreakdown: ({ props }) => <CategoryBreakdown {...props} />,
    Comparison: ({ props }) => <Comparison {...props} />,
    MerchantList: ({ props }) => <MerchantList {...props} />,
    BillList: ({ props }) => <BillList {...props} />,
    PortfolioChart: ({ props }) => <PortfolioChart {...props} />,
    HoldingsTable: ({ props }) => <HoldingsTable {...props} />,
    Allocation: ({ props }) => <Allocation {...props} />,
    TransferForm: ({ props }) => <TransferForm {...props} />,
    Note: ({ props }) => <Note {...props} />,
    Card: ({ props, children }) => <CardBlock {...props}>{children}</CardBlock>,
    Figure: ({ props }) => <FigureBlock {...props} />,
    Meter: ({ props }) => <MeterBlock {...props} />,
    List: ({ props }) => <ListBlock {...props} />,
    Text: ({ props }) => <TextBlock {...props} />,
  },
})

/** Set while an answer is arriving, so its cards rise in as they land. */
const Arriving = createContext(false)

function AnswerLayout({ gap, children }: { gap?: string | null; children: ReactNode }) {
  const arriving = useContext(Arriving)
  return <div className={cn("flex flex-col [&>*]:h-auto [&>*]:shrink-0", gap === "sm" ? "gap-2" : "gap-3", arriving && rise.children)}>{children}</div>
}

/**
 * Each card is named after its element, so when Jev rearranges the dashboard
 * a view transition can glide it to its new place (see `moveCards` in App).
 * On first load the cards rise in after net worth, 50ms apart (`useIntro`).
 * Cards Jev adds later rise in through the view transition instead.
 *
 * On wide screens the cards fill two columns, alternating left and right, and
 * each column stacks at its cards' own heights, so a short card never stretches
 * to match its neighbour.
 */
function DashboardLayout({ children }: { children: ReactNode }) {
  const intro = useIntro()
  const ref = useRef<HTMLDivElement>(null)
  const twoColumns = useWiderThan(ref, 672)
  const cards = Children.map(children, (child, i) =>
    isValidElement(child) ? (
      <div
        className={cn("grid", intro && rise.self)}
        data-dashboard-card={child.key}
        style={{
          viewTransitionName: `dashboard-${String(child.key).replace(/[^\w-]/g, "_")}`,
          ...(intro && { "--tw-animation-delay": `${(i + 1) * 50}ms`, "--tw-animation-fill-mode": "both" }),
        }}
      >
        <Intro.Provider value={intro ? (i + 1) * 50 : null}>{child}</Intro.Provider>
      </div>
    ) : (
      child
    )
  )
  return (
    <div ref={ref} className="flex items-start gap-4 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:flex [&>*]:flex-col [&>*]:gap-4">
      {twoColumns ? (
        <>
          <div>{cards?.filter((_, i) => i % 2 === 0)}</div>
          <div>{cards?.filter((_, i) => i % 2 === 1)}</div>
        </>
      ) : (
        <div>{cards}</div>
      )}
    </div>
  )
}

/** Whether an element is at least `width` pixels wide, measured before paint. */
function useWiderThan(ref: RefObject<HTMLElement | null>, width: number) {
  const [wider, setWider] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setWider(el.clientWidth >= width)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, width])
  return wider
}

const fallback: ComponentRenderer = ({ element }) => (
  <div className="rounded-lg bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">Cashew has no {element.type} card</div>
)

/**
 * Draws a spec. Jev's specs and the dashboard bind to the shared bank store;
 * Claude's carry their own data in spec.state, so they get a private store.
 */
export function CashewSpec({ spec, shared, loading }: { spec: Spec | null; shared: boolean; loading?: boolean }) {
  const bank = useBank()
  // Only an answer that's on its way when it first shows rises in. One that's
  // already finished, like the history when the phone sheet reopens, just appears.
  const [arriving] = useState(!!loading)
  const own = useRef<StateStore | null>(null)
  own.current ??= createStateStore(spec?.state ?? {})

  // Claude streams its data into spec.state a patch at a time, so keep the
  // private store in step with each new snapshot.
  useEffect(() => {
    if (shared || !spec?.state) return
    const updates: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(spec.state)) updates[`/${key}`] = value
    own.current!.update(updates)
  }, [shared, spec?.state])

  if (!spec?.root) return null
  return (
    <StateProvider store={shared ? bank.store : own.current}>
      <VisibilityProvider>
        <ActionProvider>
          <Arriving.Provider value={arriving}>
            <Rolls.Provider value={shared}>
              <Renderer spec={spec} registry={registry} fallback={fallback} loading={loading} />
            </Rolls.Provider>
          </Arriving.Provider>
        </ActionProvider>
      </VisibilityProvider>
    </StateProvider>
  )
}
