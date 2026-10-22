import { DurableObject } from "cloudflare:workers"

// Every model call draws on a daily budget, and each visitor gets a share of
// it. Claude answers and the replies under Jev's cards count against one
// budget, and Jev's own calls against another, since the two are paid for
// separately. The rate limiter bindings only count per minute, and per
// Cloudflare location, so they can't cap a day. Counts reset at midnight in
// Toronto.

export type Kind = "claude" | "jev"

/** Calls Cashew makes in a day across every visitor, and each visitor's share. */
export const LIMITS: Record<Kind, { daily: number; visitor: number }> = {
  claude: { daily: 1500, visitor: 30 },
  // Counted per ask. An ask makes two or three Jev calls, and a dashboard
  // edit up to eleven.
  jev: { daily: 5000, visitor: 200 },
}

export type Spend = "ok" | "visitor" | "everyone"

const torontoDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" })
const EVERYONE = "*"

/** One instance holds the counts, so each check and increment happens in order. */
export class Budget extends DurableObject {
  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env)
    // The first version of this table had no kind column.
    ctx.storage.sql.exec("DROP TABLE IF EXISTS spent")
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS budget (day TEXT, kind TEXT, visitor TEXT, n INTEGER, PRIMARY KEY (day, kind, visitor))")
  }

  /** Takes one call of this kind from today's budget, or says which limit stops it. */
  spend(kind: Kind, visitor: string): Spend {
    const sql = this.ctx.storage.sql
    const day = torontoDay.format(new Date())
    sql.exec("DELETE FROM budget WHERE day < ?", day)
    const count = (who: string) =>
      sql.exec<{ n: number }>("SELECT n FROM budget WHERE day = ? AND kind = ? AND visitor = ?", day, kind, who).toArray()[0]?.n ?? 0

    if (count(EVERYONE) >= LIMITS[kind].daily) return "everyone"
    if (count(visitor) >= LIMITS[kind].visitor) return "visitor"
    for (const who of [EVERYONE, visitor]) {
      sql.exec("INSERT INTO budget VALUES (?, ?, ?, 1) ON CONFLICT (day, kind, visitor) DO UPDATE SET n = n + 1", day, kind, who)
    }
    return "ok"
  }
}
