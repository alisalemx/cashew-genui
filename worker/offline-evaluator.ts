import type { Experimental_CompositionEvaluator } from "@json-render/core"

// A keyword-matching stand-in for Jev, used only when no AI Gateway key is set
// so the app still works on a laptop without credentials. It's deliberately
// simple, and the debug view labels its answers as offline.

const STOP = new Set(
  "a an the my me i is are was were do does did to of in on for and or with how what show much many can you please about this that it its at be by from".split(" "),
)

const SYNONYMS: Record<string, string[]> = {
  spend: ["spending", "spent"],
  spending: ["spent"],
  spent: ["spending"],
  invest: ["portfolio", "investment", "tfsa"],
  investment: ["portfolio", "tfsa"],
  portfolio: ["tfsa", "investment"],
  stock: ["holding", "fund"],
  balance: ["account", "balances"],
  account: ["balances"],
  owe: ["credit"],
  send: ["money", "form"],
  pay: ["send", "money"],
  transfer: ["send", "money"],
  eat: ["dining"],
  restaurant: ["dining"],
  food: ["dining", "groceries"],
  bill: ["bills", "upcoming"],
  trend: ["month", "line"],
  category: ["categories"],
}

const stem = (w: string) => w.replace(/'s$/, "").replace(/(ies)$/, "y").replace(/s$/, "")

function words(text: string) {
  const out = new Set<string>()
  for (const raw of text.toLowerCase().match(/[a-z0-9-]+/g) ?? []) {
    if (STOP.has(raw)) continue
    const w = stem(raw)
    out.add(w)
    for (const s of SYNONYMS[w] ?? []) out.add(stem(s))
  }
  return out
}

function score(request: Set<string>, text: string) {
  let n = 0
  for (const w of words(text)) if (request.has(w)) n++
  return n
}

export const offlineEvaluator: Experimental_CompositionEvaluator = async ({ state, questions }) => {
  const text = String((state as { user_request?: unknown }).user_request ?? "")
  const request = words(text)
  const answers: Record<string, { choice: string; confidence: number }> = {}

  for (const [name, q] of Object.entries(questions)) {
    const keys = Object.keys(q.criteria)

    if (name === "route") {
      const t = text.toLowerCase()
      const choice = /\b(why|should|explain|advice|afford|how come|what if|plan|save more)\b/.test(t)
        ? "explain"
        : /\b(dashboard|home|move|put|hide|remove|add|reorder|top|bottom|first)\b/.test(t) && !/\bsend|pay\b/.test(t)
          ? "edit_dashboard"
          : "show"
      answers[name] = { choice, confidence: 0.5 }
      continue
    }

    if (keys.includes("omit")) {
      let best = "omit"
      let bestScore = 1
      for (const key of keys) {
        if (key === "omit") continue
        const s = score(request, q.criteria[key])
        if (s > bestScore) [best, bestScore] = [key, s]
      }
      answers[name] = { choice: best, confidence: 0.5 }
      continue
    }

    if (keys.every((k) => /^\d+$/.test(k))) {
      // Counts start at "0"; sibling positions start at "1" and ties keep catalog order.
      answers[name] = { choice: keys.includes("0") ? "0" : keys[0], confidence: 0.5 }
      continue
    }

    // Root and layout questions: the best non-"unavailable" match, else the first key.
    let best = keys.find((k) => k !== "unavailable" && k !== "finish") ?? keys[0]
    let bestScore = 0
    for (const key of keys) {
      if (key === "unavailable") continue
      const s = score(request, q.criteria[key])
      if (s > bestScore) [best, bestScore] = [key, s]
    }
    answers[name] = { choice: best, confidence: 0.5 }
  }

  return { answers }
}
