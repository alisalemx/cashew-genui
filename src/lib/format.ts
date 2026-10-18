const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" })
const whole = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat("en-CA", { notation: "compact", maximumFractionDigits: 1 })

export const money = (n: number) => currency.format(n)
export const moneyWhole = (n: number) => whole.format(n)
export const moneyCompact = (n: number) => `$${compact.format(n)}`

/** "$4,862" and ".40" apart, so a hero number can set the cents smaller. */
export function moneyParts(n: number) {
  const [dollars, cents = "00"] = currency.format(Math.abs(n)).split(".")
  return { sign: n < 0 ? "−" : "", dollars, cents: `.${cents}` }
}

export const signedMoney = (n: number) => (n > 0 ? `+${money(n)}` : money(n).replace("-", "−"))

const toDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export const shortDate = (iso: string) => toDate(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" })

export function daysUntil(iso: string) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((toDate(iso).getTime() - start.getTime()) / 86_400_000)
}

export const percent = (n: number) => `${Math.abs(n).toLocaleString("en-CA", { maximumFractionDigits: 1 })}%`
