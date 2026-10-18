// Dev helper: runs one Jev composition from the command line.
//   npx tsx scripts/try-compose.ts "How's my spending this month?"
// Uses real Jev through the Worker's AI binding (needs `wrangler login`),
// or the offline stand-in with JEV_OFFLINE=1.
import { experimental_composeSpec } from "@json-render/core"
import { getPlatformProxy } from "wrangler"
import { catalog } from "../src/shared/catalog"
import { buildCandidates } from "../src/shared/candidates"
import { buildBankState } from "../src/shared/state"
import { defaultDashboardSpec } from "../src/shared/candidates"
import { editDashboard, makeEvaluator, routeRequest } from "../worker/jev"

const prompt = process.argv[2] ?? "How's my spending this month?"
const proxy = process.env.JEV_OFFLINE === "1" ? null : await getPlatformProxy<{ AI: Ai }>()
const { evaluate, offline } = makeEvaluator(proxy?.env.AI, !proxy)
const signal = AbortSignal.timeout(30_000)

console.log(offline ? "offline stand-in" : "Jev on Cloudflare")
const route = await routeRequest(evaluate, prompt, null, signal)
console.log("route:", route)
if (route.route === "edit_dashboard") {
  const edit = await editDashboard(evaluate, prompt, defaultDashboardSpec(), signal)
  console.log(edit.stopReason, `${edit.ms}ms`, "dashboard:", edit.spec?.elements[edit.spec.root]?.children?.join(", "))
  await proxy?.dispose()
  process.exit(0)
}
for await (const e of experimental_composeSpec({ catalog, candidates: buildCandidates(), prompt, initialState: buildBankState(), evaluate, maxElements: 8, signal })) {
  if (e.type !== "complete") continue
  console.log(e.stopReason, `${e.elapsedMs}ms`, `${e.inputTokens ?? "?"} tokens`)
  const root = e.spec?.elements[e.spec.root]
  for (const id of root?.children ?? []) console.log(" -", e.spec!.elements[id].type, JSON.stringify(e.spec!.elements[id].props).slice(0, 80))
}
await proxy?.dispose()
