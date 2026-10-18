import { ArrowUp, CornerDownRight, RotateCcw, Square } from "lucide-react"
import { cn } from "cn"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from "@/components/ui/message-scroller"
import type { Turn } from "@/lib/use-agent"
import { type Actor, ActorChip, AnswerTurn, UserTurn } from "./turn-view"

// Grouped by who answers, so a visitor can try each path on purpose.
const SUGGESTIONS: { actor: Actor; label: string; prompts: string[] }[] = [
  {
    actor: "jev",
    label: "picks a ready-made card",
    prompts: ["How’s my spending this month?", "Show my investments", "What bills are coming up?"],
  },
  {
    actor: "jev",
    label: "takes an action",
    prompts: ["Send Maya $40 for dinner", "Move investments to the top of my dashboard", "Add my paycheques to my dashboard"],
  },
  {
    actor: "claude",
    label: "works it out",
    prompts: [
      "Why was September so expensive?",
      "How much of my dining goes to delivery versus eating out?",
      "If Uber Eats went up 20%, what would that cost me over six months?",
    ],
  },
]

export function AgentPanel({
  turns,
  busy,
  onAsk,
  onReset,
  onStop,
  inSheet = false,
}: {
  turns: Turn[]
  busy: boolean
  onAsk: (prompt: string) => void
  /** Clears the conversation and brings the examples back. */
  onReset: () => void
  /** Stops the answer on its way. */
  onStop: () => void
  /** In the phone sheet, the header leaves room for the sheet's close button. */
  inSheet?: boolean
}) {
  const [draft, setDraft] = useState("")
  // Where the panel opens, fixed when it mounts (each time the phone sheet
  // opens): the top of the examples, or the latest question with its answer.
  const [openAt] = useState<"start" | "last-anchor">(() => (turns.length ? "last-anchor" : "start"))

  const submit = (text = draft) => {
    if (!text.trim() || busy) return
    onAsk(text)
    setDraft("")
  }

  return (
    // Each new question scrolls to the top, 16px below the edge, so its answer
    // reads from the start. The scroller pads the end with a spacer to make
    // room, and shrinks it as the answer grows.
    <MessageScrollerProvider scrollPreviousItemPeek={16} defaultScrollPosition={openAt}>
      <div className="flex h-full min-h-0 flex-col">
        <header className={cn("flex items-center justify-between gap-3 pt-5 pb-2 pl-5", inSheet ? "pr-14" : "pr-5")}>
          <h2 className="font-medium">Ask Cashew</h2>
          {turns.length > 0 ? <StartOver onReset={onReset} /> : null}
        </header>

        <MessageScroller className="min-h-0 flex-1">
          <MessageScrollerViewport>
            <MessageScrollerContent className="gap-6 px-5 py-5">
              {turns.length === 0 ? (
                <MessageScrollerItem messageId="intro">
                  <Suggestions onPick={submit} />
                </MessageScrollerItem>
              ) : null}
              {turns.flatMap((turn) => [
                <MessageScrollerItem key={`${turn.id}-q`} messageId={`${turn.id}-q`} scrollAnchor>
                  <UserTurn turn={turn} />
                </MessageScrollerItem>,
                <MessageScrollerItem key={`${turn.id}-a`} messageId={`${turn.id}-a`}>
                  <AnswerTurn turn={turn} />
                </MessageScrollerItem>,
              ])}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>

        <form
          className="p-3"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          {/* The panel's corner less the form's 12px, so the corners stay concentric. */}
          <InputGroup className="rounded-md">
            <InputGroupTextarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  submit()
                }
              }}
              placeholder="Ask about your money"
              aria-label="Ask Cashew"
              maxLength={500}
              rows={1}
              className="max-h-32 min-h-11"
            />
            {/* While Cashew answers, Send becomes Stop. */}
            <InputGroupAddon align="block-end" className="justify-end">
              {busy ? (
                <InputGroupButton type="button" variant="default" size="icon-sm" onClick={onStop} aria-label="Stop answering" className="relative hit-area">
                  <Square className="fill-current" />
                </InputGroupButton>
              ) : (
                <InputGroupButton type="submit" variant="default" size="icon-sm" disabled={!draft.trim()} aria-label="Send" className="relative hit-area">
                  <ArrowUp />
                </InputGroupButton>
              )}
            </InputGroupAddon>
          </InputGroup>
        </form>
      </div>
    </MessageScrollerProvider>
  )
}

// Back to the top first, or the examples come back scrolled to their end.
function StartOver({ onReset }: { onReset: () => void }) {
  const { scrollToStart } = useMessageScroller()
  return (
    <Button
      variant="ghost"
      size="xs"
      className="relative hit-area"
      onClick={() => {
        scrollToStart()
        onReset()
      }}
    >
      <RotateCcw data-icon="inline-start" />
      Start over
    </Button>
  )
}

function Suggestions({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-2xl font-semibold tracking-[-0.03em] text-balance">What would you like to know, Jordan?</p>
      {SUGGESTIONS.map((group, i) => (
        <div key={i} className="flex flex-col gap-2">
          {/* The same chip as in "How this answer was made", so a visitor
              meets Jev and Claude before they ask. */}
          <p id={`suggestions-${i}`} className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <ActorChip actor={group.actor} /> {group.label}
          </p>
          <ul aria-labelledby={`suggestions-${i}`} className="flex flex-col gap-1.5">
            {group.prompts.map((s) => (
              <li key={s}>
                {/* Filled in the paper tone so each question reads as a button,
                    a step darker on hover. The arrow sits on the first line
                    when a question wraps. */}
                <button
                  type="button"
                  onClick={() => onPick(s)}
                  className="flex w-full items-start gap-2 rounded-xl bg-background px-3 py-2.5 text-left pointer-coarse:py-3 text-sm transition-[background-color,scale] duration-150 ease-out hover:bg-secondary active:scale-[0.96]"
                >
                  <CornerDownRight className="mt-[3px] size-3.5 shrink-0 text-primary" aria-hidden />
                  <span className="flex-1 text-pretty">{s}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
