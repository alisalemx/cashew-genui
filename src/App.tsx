import type { Spec } from "@json-render/core"
import { RotateCcw, Sparkle } from "lucide-react"
import { useCallback, useState, useSyncExternalStore } from "react"
import { flushSync } from "react-dom"
import { cn } from "cn"
import { AboutDialog } from "@/components/about-dialog"
import { AgentPanel } from "@/components/agent/agent-panel"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { CashewSpec } from "@/genui/registry"
import { Figure, Intro, rise, useIntro } from "@/genui/parts"
import { BankProvider, useBank } from "@/lib/bank"
import { useAgent } from "@/lib/use-agent"
import { defaultDashboardSpec } from "@/shared/candidates"
import { CUSTOMER } from "@/shared/data"

export default function App() {
  return (
    <BankProvider>
      <Cashew />
    </BankProvider>
  )
}

function Cashew() {
  const bank = useBank()
  const [dashboard, setDashboard] = useState<Spec>(defaultDashboardSpec)
  const [edited, setEdited] = useState(false)
  const onDashboard = useCallback((spec: Spec) => {
    moveCards(() => {
      setDashboard(spec)
      setEdited(true)
    })
  }, [])
  const agent = useAgent({ dashboard, transfers: bank.transfers, onDashboard })
  const [sheetOpen, setSheetOpen] = useState(false)
  const panel = (inSheet: boolean) => <AgentPanel turns={agent.turns} busy={agent.busy} onAsk={agent.ask} onReset={agent.reset} onStop={agent.stop} inSheet={inSheet} />

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[minmax(0,1fr)_440px]">
      <div className="flex min-w-0 flex-col">
        <TopBar />
        <main className="@container mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pb-12">
          <Greeting />
          <section className="flex flex-col gap-3" aria-labelledby="dashboard-heading">
            {/* The heading is for screen readers. Once Jev rearranges the cards, a
                line says so, with a way back to the original layout. */}
            <h2 id="dashboard-heading" className="sr-only">
              Your dashboard
            </h2>
            {/* The line takes part in the cards' glide, so it rises in once
                they've made room and fades out as they close the gap. */}
            {edited ? (
              <div className="flex items-baseline justify-between gap-3" style={{ viewTransitionName: "dashboard-note" }}>
                <p className="font-mono text-xs text-muted-foreground">Rearranged by Jev</p>
                <Button
                  variant="ghost"
                  size="xs"
                  className="relative hit-area"
                  onClick={() =>
                    moveCards(() => {
                      setDashboard(defaultDashboardSpec())
                      setEdited(false)
                    })
                  }
                >
                  <RotateCcw data-icon="inline-start" />
                  Reset layout
                </Button>
              </div>
            ) : null}
            <CashewSpec spec={dashboard} shared />
          </section>
        </main>
        <Footer />
      </div>

      <aside className="hidden p-3 pl-0 lg:sticky lg:top-0 lg:block lg:h-svh">
        <div className="h-full overflow-hidden rounded-2xl bg-card shadow-raised">{panel(false)}</div>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-10 p-4 lg:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          {/* It floats over the dashboard, so it is frosted glass, tinted cobalt to stay the main action. */}
          {/* Buttons that open a dialog skip the usual press, so it's set here, gentler for a full-width bar. */}
          <SheetTrigger render={<Button size="lg" className="h-12 w-full rounded-full text-base frosted bg-primary/85 shadow-floating hover:bg-primary/95 active:scale-[0.98]" />}>
            <Sparkle data-icon="inline-start" />
            Ask Cashew
          </SheetTrigger>
          {/* The height needs the side variant, or the sheet's own h-auto wins and
              a long conversation pushes the top, close button included, off screen. */}
          <SheetContent side="bottom" className="gap-0 rounded-t-2xl p-0 data-[side=bottom]:h-[88svh]">
            <SheetTitle className="sr-only">Ask Cashew</SheetTitle>
            {panel(true)}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}

/**
 * Changes the dashboard so its cards glide to their new places, letting you
 * see what Jev moved. Only on wide screens, where the dashboard sits beside
 * Ask Cashew: on phones the sheet covers it, and the moving cards would draw
 * over the sheet. Browsers without view transitions just swap.
 */
function moveCards(change: () => void) {
  if (!document.startViewTransition || !window.matchMedia("(min-width: 64rem)").matches) return change()
  const cards = () => [...document.querySelectorAll<HTMLElement>("[data-dashboard-card]")]
  const transition = document.startViewTransition(() => {
    const before = cards().map((el) => el.dataset.dashboardCard)
    flushSync(change)
    // Cards paint in their new order, so the one you asked to move to the top
    // would slide under the rest. Any card that jumps past more than one
    // neighbour passes over them instead.
    cards().forEach((el, i) => {
      const was = before.indexOf(el.dataset.dashboardCard)
      if (was !== -1 && Math.abs(i - was) > 1) el.style.setProperty("view-transition-class", "lead")
    })
  })
  transition.finished.finally(() => cards().forEach((el) => el.style.removeProperty("view-transition-class")))
}

function TopBar() {
  return (
    <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <a href="/" className="flex items-center gap-2 font-semibold tracking-[-0.02em]">
        <CashewMark />
        Cashew Bank
      </a>
      <div className="flex items-center gap-4 font-mono text-[11px] text-muted-foreground">
        <a href="https://alisalem.ca" target="_blank" rel="noreferrer" className="relative hit-area underline-offset-4 max-sm:hidden transition-colors hover:text-foreground hover:underline">
          A demo by Ali Salem
        </a>
        <AboutDialog />
      </div>
    </header>
  )
}

/** A cobalt cashew on a blush tile, centred on its outline's bounds. `public/favicon.svg` draws the same mark. */
function CashewMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" aria-hidden>
      <rect width="24" height="24" rx="7" fill="var(--mark-tile)" />
      <path
        transform="translate(12.8 12.8) scale(0.8) rotate(30) translate(-12.6 -12)"
        d="M9.5 3.2C15.5 3.2 19.8 7 19.8 12.2C19.8 17.4 15.6 20.8 10 20.8C7.3 20.8 5.4 19.4 5.4 17.4C5.4 15.6 6.8 14.6 8.6 14.4C10.4 14.2 11.4 13.4 11.4 12.1C11.4 10.8 10.4 10 8.8 9.8C6.8 9.6 5.3 8.4 5.3 6.6C5.3 4.6 7.1 3.2 9.5 3.2Z"
        fill="var(--mark-ink)"
      />
    </svg>
  )
}

function greeting() {
  const hour = Number(new Date().toLocaleString("en-CA", { hour: "numeric", hour12: false, timeZone: "America/Toronto" }))
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
}

function Greeting() {
  const { store } = useBank()
  const netWorth = useSyncExternalStore(store.subscribe, () => store.get("/netWorth") as number)
  const intro = useIntro()
  return (
    <section className="flex flex-col gap-4 @2xl:flex-row @2xl:items-end @2xl:justify-between">
      <h1 className="text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">
        {greeting()}, {CUSTOMER.firstName}
      </h1>
      {/* Net worth leads the home screen's intro, ahead of the dashboard cards. */}
      <div className={cn("flex flex-col gap-1 rounded-2xl bg-highlight px-5 py-4 text-highlight-foreground @2xl:min-w-72", intro && rise.self)}>
        <span className="font-mono text-xs">Net worth</span>
        <Intro.Provider value={intro ? 0 : null}>
          <Figure value={netWorth} centsClassName="text-highlight-foreground/60" />
        </Intro.Provider>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="flex flex-col gap-1 px-4 pt-4 pb-8 font-mono text-[11px] text-muted-foreground sm:px-6 lg:px-8">
      <p>Cashew is a made-up bank. Every account, person, and number here is fictional.</p>
      <p>
        Designed and built by{" "}
        <a href="https://alisalem.ca" className="relative hit-area text-foreground underline underline-offset-4">
          Ali Salem
        </a>{" "}
        with json-render, Jev, and Claude.
      </p>
    </footer>
  )
}
