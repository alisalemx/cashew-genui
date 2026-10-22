import { ArrowLeft, Check, Send } from "lucide-react"
import { cn } from "cn"
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { NOTE_LENGTH, useBank } from "@/lib/bank"
import { money } from "@/lib/format"
import { Figure, Mono, rise } from "./parts"

// The AI can only open this form. Choosing who, checking the amount, and the
// final Confirm all happen here, in code the model never touches.

const LIMIT = 3000

export function TransferForm({ recipientId, amount, note }: { recipientId?: string | null; amount?: number | null; note?: string | null }) {
  const bank = useBank()
  const chequing = useChequing()
  const [step, setStep] = useState<"edit" | "review" | "sent">("edit")
  const [to, setTo] = useState<string | null>(recipientId ?? null)
  const [value, setValue] = useState(amount ? amount.toFixed(2) : "")
  const [memo, setMemo] = useState((note ?? "").slice(0, NOTE_LENGTH))
  const [touched, setTouched] = useState(false)
  const id = useId()

  // Each step swaps the card, so the button that was pressed disappears.
  // Move focus to the new card's heading so keyboard and screen reader users
  // land on what changed instead of the top of the page. The new card rises
  // in, keyed by step so it plays each time, but not when the form first shows.
  const heading = useRef<HTMLDivElement>(null)
  const [moved, setMoved] = useState(false)
  const go = (next: typeof step) => {
    setMoved(true)
    setStep(next)
  }
  useEffect(() => {
    if (moved) heading.current?.focus()
  }, [moved, step])
  const arrive = moved ? rise.self : undefined

  const contact = bank.contacts.find((c) => c.id === to)
  const parsed = Number(value)
  const error = !value
    ? "Enter an amount"
    : !Number.isFinite(parsed) || parsed <= 0
      ? "Enter an amount above $0"
      : parsed > LIMIT
        ? `e-Transfers are limited to ${money(LIMIT)} at a time`
        : parsed > chequing
          ? `That’s more than the ${money(chequing)} in chequing`
          : null
  const firstName = contact?.name.split(" ")[0]

  if (step === "sent" && contact) {
    return (
      <Card key="sent" className={cn("gap-3 px-5", arrive)}>
        <span className="flex size-10 items-center justify-center rounded-full bg-highlight text-highlight-foreground">
          <Check className="size-5" aria-hidden />
        </span>
        <div>
          <p ref={heading} tabIndex={-1} className="font-medium outline-none">
            Sent {money(parsed)} to {contact.name}
          </p>
          <p className="text-sm text-muted-foreground">{firstName} will get an email at {contact.email}.</p>
        </div>
        <Mono>Demo only. No real money moved. Chequing is now {money(chequing)}.</Mono>
      </Card>
    )
  }

  if (step === "review" && contact) {
    return (
      <Card key="review" className={cn("gap-4", arrive)}>
        <CardHeader>
          <CardTitle ref={heading} tabIndex={-1} className="outline-none">
            Review your e-Transfer
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Figure value={parsed} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">To</dt>
            <dd>
              {contact.name}
              <div className="text-xs text-muted-foreground">{contact.email}</div>
            </dd>
            <dt className="text-muted-foreground">From</dt>
            <dd>
              Everyday chequing <span className="text-muted-foreground tabular-nums">•••• 4821</span>
            </dd>
            {memo ? (
              <>
                <dt className="text-muted-foreground">Message</dt>
                <dd>{memo}</dd>
              </>
            ) : null}
            <dt className="text-muted-foreground">Arrives</dt>
            <dd>In a few minutes</dd>
          </dl>
        </CardContent>
        <CardFooter className="gap-2 bg-transparent pt-1">
          <Button variant="secondary" className="pointer-coarse:h-11" onClick={() => go("edit")}>
            <ArrowLeft data-icon="inline-start" />
            Edit
          </Button>
          <Button
            className="flex-1 pointer-coarse:h-11"
            onClick={() => {
              bank.sendTransfer({ contactId: contact.id, amount: parsed, note: memo || null })
              go("sent")
            }}
          >
            <Send data-icon="inline-start" />
            Confirm and send {money(parsed)}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card key="edit" className={cn("gap-4", arrive)}>
      <CardHeader className="flex items-baseline justify-between gap-3">
        <CardTitle ref={heading} tabIndex={-1} className="outline-none">
          {contact ? `Send money to ${firstName}` : "Send money"}
        </CardTitle>
        <Mono>e-Transfer</Mono>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setTouched(true)
            if (!error && contact) go("review")
          }}
        >
          <FieldGroup className="gap-4">
            <Field data-invalid={touched && !contact ? true : undefined}>
              <FieldLabel id={`${id}-to`}>To</FieldLabel>
              <ToggleGroup
                aria-labelledby={`${id}-to`}
                value={to ? [to] : []}
                onValueChange={(v) => setTo((v as string[])[0] ?? null)}
                variant="filled"
                spacing={2}
                className="flex-wrap pointer-coarse:gap-3"
              >
                {bank.contacts.map((c) => (
                  <ToggleGroupItem key={c.id} value={c.id} className="relative hit-area h-auto gap-2 py-1 pr-3 pl-1" aria-label={c.name}>
                    <Avatar className="size-6">
                      <AvatarFallback className="text-[10px]">{c.initials}</AvatarFallback>
                    </Avatar>
                    {c.name.split(" ")[0]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {touched && !contact ? <FieldError>Choose who to send it to</FieldError> : null}
            </Field>
            <Field data-invalid={touched && error ? true : undefined}>
              <FieldLabel htmlFor={`${id}-amount`}>Amount</FieldLabel>
              <InputGroup className="pointer-coarse:h-11">
                <InputGroupAddon>
                  <InputGroupText>$</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  id={`${id}-amount`}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={value}
                  aria-invalid={touched && error ? true : undefined}
                  onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
                  className="tabular-nums"
                />
              </InputGroup>
              {touched && error ? (
                <FieldError>{error}</FieldError>
              ) : (
                <FieldDescription>From Everyday chequing, {money(chequing)} available</FieldDescription>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-note`}>Message (optional)</FieldLabel>
              <Input id={`${id}-note`} className="pointer-coarse:h-11" maxLength={NOTE_LENGTH} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What’s it for?" />
            </Field>
            <Button type="submit" className="w-full pointer-coarse:h-11">
              Review
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

/** Chequing from the shared bank store, whichever renderer the form sits in. */
function useChequing() {
  const { store } = useBank()
  return useSyncExternalStore(store.subscribe, () => (store.get("/chequing") as number) ?? 0)
}
