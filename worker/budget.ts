import { DurableObject } from "cloudflare:workers"

// Every Claude call, written answers and the replies under Jev's cards alike,
// draws on one daily budget, and each visitor gets a share of it. The rate
// limiter bindings only count per minute, and per Cloudflare location, so
// they can't cap a day. Counts reset at midnight in Toronto.

/** Claude calls Cashew makes in a day, across every visitor. */
export const DAILY_BUDGET = 1500
/** Claude calls one visitor gets in a day. */
export const VISITOR_DAILY = 30

export type Spend = "ok" | "visitor" | "everyone"

const torontoDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" })
const EVERYONE = "*"

/** One instance holds the counts, so each check and increment happens in order. */
export class Budget extends DurableObject {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env)
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS spent (day TEXT, visitor TEXT, n INTEGER, PRIMARY KEY (day, visitor))")
  }

  /** Takes one Claude call from today's budget, or says which limit stops it. */
  spend(visitor: string): Spend {
    const sql = this.ctx.storage.sql
    const day = torontoDay.format(new Date())
    sql.exec("DELETE FROM spent WHERE day < ?", day)
    const count = (who: string) => sql.exec<{ n: number }>("SELECT n FROM spent WHERE day = ? AND visitor = ?", day, who).toArray()[0]?.n ?? 0

    if (count(EVERYONE) >= DAILY_BUDGET) return "everyone"
    if (count(visitor) >= VISITOR_DAILY) return "visitor"
    for (const who of [EVERYONE, visitor]) {
      sql.exec("INSERT INTO spent VALUES (?, ?, 1) ON CONFLICT (day, visitor) DO UPDATE SET n = n + 1", day, who)
    }
    return "ok"
  }
}

/**
 * Who's asking, for the limits. An IPv6 connection gets a whole /64 block of
 * addresses, so a visitor could take a new one for every question. The block
 * counts as one visitor.
 */
export function visitorOf(ip: string): string {
  if (!ip.includes(":")) return ip
  const [head, tail] = ip.split("::")
  const left = head ? head.split(":") : []
  const right = tail ? tail.split(":") : []
  const groups = tail === undefined ? left : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right]
  return `${groups
    .slice(0, 4)
    .map((g) => parseInt(g, 16).toString(16))
    .join(":")}::/64`
}

/** The budget keeps a hash of the visitor in place of the address itself, and only for the day. */
export async function hashOf(visitor: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(visitor))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
}
