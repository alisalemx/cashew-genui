import type { SpecStreamLine } from "@json-render/core"

// json-render's path writers follow "__proto__" like any other key, so a patch
// Claude writes could reach Object.prototype, which every later request in the
// Worker shares. Claude's patches only ever need the answer's root, elements,
// and state, so anything else is dropped before it's applied.

const AREAS = new Set(["root", "elements", "state"])
const BLOCKED = new Set(["__proto__", "prototype", "constructor"])

function safePath(path: unknown): boolean {
  if (typeof path !== "string" || !path.startsWith("/")) return false
  const segments = path
    .slice(1)
    .split("/")
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"))
  return AREAS.has(segments[0]) && !segments.some((s) => BLOCKED.has(s))
}

/** Whether a patch from Claude stays inside the answer's own spec. */
export function isSafePatch(patch: SpecStreamLine): boolean {
  return safePath(patch.path) && (patch.from === undefined || safePath(patch.from))
}
