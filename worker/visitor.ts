// Who a request counts as, for the per-minute limits and the daily budgets.

/** The first `groups` hextets of an IPv6 address, zero-expanded, or null for IPv4. */
function prefix(ip: string, groups: number): string | null {
  if (!ip.includes(":")) return null
  const [head, tail] = ip.split("::")
  const left = head ? head.split(":") : []
  const right = tail ? tail.split(":") : []
  const all = tail === undefined ? left : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right]
  return all
    .slice(0, groups)
    .map((g) => parseInt(g, 16).toString(16))
    .join(":")
}

/**
 * Who's asking, for the per-minute limits. An IPv6 connection gets a whole
 * /64 block of addresses, so a visitor could take a new one for every
 * question. The block counts as one visitor.
 */
export function visitorOf(ip: string): string {
  const p = prefix(ip, 4)
  return p === null ? ip : `${p}::/64`
}

/**
 * Who's asking, for the daily budgets. Home and hosting providers hand out
 * blocks of up to 65,536 /64s (a /48), so one person could otherwise take a
 * fresh daily share from each. The /48 counts as one household.
 */
export function householdOf(ip: string): string {
  const p = prefix(ip, 3)
  return p === null ? ip : `${p}::/48`
}

/** The budget keeps a hash of the visitor in place of the address itself, and only for the day. */
export async function hashOf(visitor: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(visitor))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
}
