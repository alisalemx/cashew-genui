# Cashew, a generative UI demo

Cashew is a made-up Canadian bank. Its assistant builds every answer from the
Cashew design system on the spot. It's live at genui.alisalem.ca, credited to
Ali Salem.

## Decisions

- **Design direction:** Playful tech, adapted for product UI: big grotesk
  figures (Geist), small Geist Mono labels, sentence case, one bold flat blush
  block per screen (`highlight`), brand cobalt for marks and actions. Green is
  only for good news in numbers. The cashew mark is cobalt on a blush tile,
  centred on the outline's bounds (its area centre sits about 1px low and
  right, which looks off). The header and `public/favicon.svg` draw the
  same mark, and it keeps its colours in dark mode. No borders: fill, space, and
  shadow set surfaces apart, fields are filled, and cards have generous rounded
  corners. The one exception
  is a light divider (`divider`) between rows in lists with three or more
  columns: transactions, upcoming bills, top merchants, and holdings (`Rows
  divided` in `src/genui/parts.tsx`). Accounts don't count their icon as a
  column, and two-column lists stay undivided. Every line, these dividers and
  the "How this answer was made" outline included, is a hairline
  (`--hairline` in `src/index.css`): one device pixel on retina screens, 1px
  elsewhere. A rounded surface inside another takes the outer corner less the
  gap between them, so corners stay concentric (the composer is `rounded-md`
  inside the panel's 12px padding). Cards, the Ask Cashew panel, and the open
  tab are raised with a soft shadow (`shadow-raised`), and anything that floats casts
  a deeper one (`shadow-floating`): dialogs, the phone sheet, tooltips, the
  scroll button, and the phone's Ask Cashew button. The net worth block stays
  flat. The Ask Cashew panel is a card too, and answer cards inside it are
  white and raised like the dashboard's, while the suggestion chips sit on the
  paper tone. The chat's messages don't use `content-visibility`, because it
  clipped the cards' shadows. The About modal's replayed card is white and
  raised the same way. The dashboard has no visible heading (a screen-reader
  one stays), and its cards fill two columns that stack independently
  (`DashboardLayout` in `src/genui/registry.tsx`), so each card keeps its own
  height and none stretches to match its neighbour. Holdings sits under TFSA
  to even out the columns. Chart gridlines keep at least a quarter of a step
  away from the average line (`axisTicks` in `src/genui/charts.tsx`), and
  charts carry no title, so the browser shows no tooltip of its own. Anything that floats
  over content on hover, like chart tooltips, is frosted glass (`frosted`) as
  well. The phone's floating Ask Cashew button is frosted too, tinted cobalt
  (85%) so it stays the main action, with a sparkle icon.
  Focus rings are neutral grey, and small controls get `hit-area` for a 40px
  target (44px on touch). Cashew follows the system's light or dark setting,
  with no toggle. Dark mode only flips the tokens in `src/index.css`, so
  components never use `dark:`: the page is darkest and cards step up from
  it, cobalt turns periwinkle with dark text, the blush block turns berry with
  light text, and each shadow becomes a faint light edge. Every text colour
  was checked for contrast in both themes, so recheck when changing one.
- **How answers are made:** Jev (`typesafe/jev`) triages each request and, for
  most of them, picks and arranges ready-made cards. Claude Haiku (`claude-haiku-5-5`, chosen to keep costs low)
  takes requests that need a written answer, and any Jev can't cover. Claude
  uses a finished card when one fits, and otherwise builds a new card from
  blocks (Card, Figure, Row, Meter, List, Text), following the components guide.
  Every answer gets a written reply. For Jev's cards, Claude writes a sentence
  or two from the cards' data (`worker/caption.ts`) after the cards are on
  screen, so the cards never wait. The reply always sits above the cards.
  Replies stream in word by word (`text-delta` events). json-render's parser
  only hands over whole lines, so `streamProse` in `worker/claude.ts` passes
  prose straight through and still sends anything that could be card data to
  the parser whole. Claude writes a reply in a fraction of a second, so the
  chat shows it a word at a time at a calm 15 words a second, each word
  fading in over 300ms, speeding up so it never trails what has arrived by
  more than two seconds (`usePacedReply` in
  `src/components/agent/turn-view.tsx`). While it's shown, its lines wrap
  plainly, since `text-pretty` would move words already on screen as new
  ones arrive. Claude's own cards wait under their placeholder until the
  answer is in, the reply is shown in full, and 300ms more while its last
  words settle (`BEAT`). They're drawn once, from the finished answer: drawn
  while their data streamed in, a card could render before its numbers
  arrived, and json-render's error guard then hid it for good.
  While an answer is on its way, the chat shows skeletons
  in the shapes of Cashew's real cards (`src/genui/skeleton.tsx`): the
  reply's lines until its first words show, and a card below, which holds
  its place until a real card has drawn (`[data-card-skeleton]` in
  `src/index.css`), so the space never empties. The reply's
  placeholder is two lines for Jev's cards and three for Claude's own answer.
  It stays from the moment Jev's cards land until Claude starts writing, and
  the reply keeps that height while it's shown, so the cards land where the
  skeleton was and only move down as the reply grows, gliding a line at a
  time (`useGlideBelow`). When no reply follows,
  past a limit or without a key, the cards move up once when the answer ends.
  Jev's cards land whole within a second, with no hint of their shape before,
  so they get a short card (`stat`) that the real one grows from. Claude's
  take the shape of the most specific data it asked for (`shapeForTools`),
  and a calculation over transactions gets a figure with rows, like the card
  Claude builds. The chat scroller (`@shadcn/react`) is patched
  (`patches/`, applied by `patch-package` on install) to keep the question
  in place in the same frame the answer resizes. Unpatched, it caught up a
  frame late, and a shorter card made the whole answer jump for a frame.
- **How this answer was made:** a closed panel above each answer tells the
  story step by step, with Jev and Claude chips, in plain design system
  language: the components Claude composed or picked, why Jev passed a
  question to Claude, and for Jev's own answers, its top-scoring components
  with their descriptions and Jev's scores, and a check on the ones it picked.
  Jev returns a score for every option, which `worker/jev.ts` keeps. No
  timings or token counts. The panel is outlined, and the scored list has a
  divider under its labels. Apart from the light row dividers in lists,
  those are the only border and divider in Cashew, which sets the AI layer
  apart from the bank's own interface. The steps are
  shadcn's Trace (`src/components/ui/trace.tsx`), with its left rule turned
  off to keep that rule. While an answer streams, Send becomes Stop, which
  keeps what arrived and marks the step under way as stopped.
  What Jev and Claude are in general lives in the About modal
  (`src/components/about-dialog.tsx`), opened from the cobalt pill in the
  header. It keeps text to a minimum, with no blush block and no sequence
  diagram. It has a plain title and two tabs. "How it works" comes
  first and shows only three real questions, set large in blush (a light
  tint, solid once picked), until one is
  picked. When the tab opens, the questions rise in one after another,
  250ms apart, on the same rise as the answer. Then, 300ms after the click,
  the answer
  reveals top to bottom on a 500ms rise, one piece at a time, each held long
  enough to read before the next: "Jev checks" (0.9s), the question "Can a
  ready-made card answer it?" (1.3s), Yes or No (0.9s), each step with its
  real time (1.5s, or 2s with Claude's tool calls by code name), "Cashew
  shows" (0.9s), the real card Cashew showed, drawn by the real components
  (2s), then the total time. Keep one piece at a time, these holds, and no
  running clock, so the reveal stays easy to follow. Every piece has its place from the start, held by a
  skeleton in its own shape that fades as the piece rises in, the modal is
  pinned near the top so the reveal grows downward, and on short screens it
  scrolls to the newest piece. Reduced motion shows the answer finished. The
  timings come from real `/api/ask` runs, so record them again when routing
  or the catalogue changes. "Tech stack" is a plain list, no cards or dividers, of the five
  core pieces (Jev, Claude, json-render, shadcn/ui, Cloudflare Workers): each
  links to its site and says what it is and what it does here. Trivial items
  like fonts and charting stay out.
- **Providers:** Jev runs through Cloudflare AI Gateway on the Worker's `AI`
  binding, paid from the Cloudflare account's AI Gateway credits (no key).
  Claude runs on an Anthropic API key (`ANTHROPIC_API_KEY`), always through
  `claudeModel` in `worker/claude.ts`. json-render's
  built-in Jev evaluator only works with one other gateway, so `worker/jev.ts`
  has its own small evaluator.
- **Motion:** quiet and sparing. Anything that arrives uses one rise (`rise`
  in `src/genui/parts.tsx`): a new question, with its answer 50ms behind
  (the chat jumps to it at once), answer cards as they land, each transfer
  step after a press, each new step in the closed "How this answer was made"
  row, and a transaction row that lands above the ones a card first showed,
  like a transfer just sent, while the rows below slide down to make room
  (`useMakeRoom` in `src/genui/cards.tsx`, 250ms on the glide's curve).
  Answers already finished, like the history when the phone sheet reopens,
  don't replay it. The closed row keeps each step up at least 400ms, so a
  step that lasts milliseconds can't flash past, and when a step ends while
  the answer is still working, the finished label waits 200ms more, because
  Jev's last step and Claude's first can land milliseconds apart
  (`usePacedStep` in `src/components/agent/turn-view.tsx`). A step rises once,
  and one whose words grow, like Claude's lookups, updates in place. The rise
  sits on a wrapper, since the shimmer is an animation too. Transaction rows
  are keyed by date, merchant, and amount, never by position, or a new row
  would make all ten rise. "How this answer was made" opens to its height. When Jev rearranges the dashboard, the cards glide to their new places with a view transition
  (`moveCards` in `src/App.tsx`), on wide screens only, because on phones the
  sheet covers the dashboard and the moving cards would draw over it. A card
  Jev adds rises in once its neighbours have mostly moved, and a card Jev
  drops fades out quickly (the `:only-child` rules in `src/index.css`). The
  "Rearranged by Jev" line takes part too (`dashboard-note`), so it rises in
  and fades out by the same rules. In the chat, an answer's first card takes
  over its placeholder: its surface stays put and only its contents rise in,
  so the card never blinks out and back. Any more cards rise in below it,
  50ms apart (`[data-answer-layout]` in `src/index.css`). Whatever sits below
  a reply glides down 250ms on the glide's curve as the reply grows a line,
  rather than jumping. The
  home screen plays one intro per visit (`useIntro` in `src/genui/parts.tsx`):
  net worth rises first, then the dashboard cards 50ms apart, and their big
  figures count up from zero over 800ms, holding their final width so nothing
  shifts. A reset or rearrange never replays it. After that, a bank figure
  that changes, like net worth and chequing after a transfer, rolls from its
  old value to the new one over 400ms (`Rolling` in `src/genui/parts.tsx`).
  Claude's cards don't roll (`Rolls`), because their figures fill in as the
  data streams. Buttons press to 0.96, except ones that open a dialog or sheet,
  which the button skips by default: the About pill sets 0.96 itself, and the
  phone's full-width Ask Cashew bar sets 0.98. Reduced motion skips the
  movement and shows the real values at once: the rise becomes a fade, the
  dashboard's cards crossfade in place, and rows and figures jump straight to
  where they end up. Left out on purpose: a check drawing in on the
  Sent card, a sliding pill on the About tabs, a hover lift on dashboard
  cards, the transfer card animating its height, and a crossfade from Send to
  Stop.
- **Money movement:** the AI can only open the transfer form. Review and Confirm
  live in `src/genui/transfer-form.tsx`, and transfers are demo-only. The
  amount Jev's form opens with comes from `amountFrom` in `worker/jev.ts`,
  which reads "$1,500" with the thousands comma, so the form never opens
  with $1.50.
- **Cost guard:** `/api/ask` only takes requests from Cashew's own page
  (`fromCashew` in `worker/index.ts`): a JSON content type and, when the
  browser sends one, Cashew's origin. Otherwise any site could spend
  Cashew's limits from its visitors' browsers. Then per-visitor rate limits
  in `wrangler.jsonc` (20 asks a minute, 5 Claude calls a minute), and daily
  budgets in `worker/budget.ts` (`LIMITS`) that reset at midnight in
  Toronto: Claude at 1,500 calls a day across everyone and 30 per visitor,
  counting every Claude call including the reply under Jev's cards, and
  Jev at 5,000 asks a day and 200 per visitor, counted per ask since Jev
  has no cap of its own. Past a Claude limit, a written answer becomes a set
  reply saying so, and Jev's cards show without a reply. Past the Jev
  limit, the ask gets a 429. For the per-minute ask limit, an IPv6 visitor
  is their whole /64 block, since each connection gets millions of
  addresses. For the daily budgets and the Claude limiter, they're their
  /48 (`householdOf` in `worker/visitor.ts`), since home and hosting
  providers hand out blocks that size, and 50 fresh /64s would otherwise
  spend the whole day's Claude budget. Composition starts alongside
  routing and is aborted once the route isn't `show`, so an explained
  question costs fewer Jev calls. Dashboard element ids are capped at 64
  characters, because they travel to Jev on every edit step. Claude's
  system prompt, guide included, is prompt-cached, so only the conversation
  and tool results cost full price. When the budget store can't be
  reached, Claude's answers pause and Jev's cards carry on. Bodies over
  64 KB are refused before they're read in full (`readJson`). Keep a
  monthly spend limit on the Anthropic key, and leave Cloudflare auto
  top-up off.
- **Browser locks:** the Worker refuses a transfer note over 140 characters
  and a history message over 2,000, and once a bad value is in the
  browser's state every later question fails. So the client cuts both
  first (`NOTE_LENGTH` in `src/lib/bank.tsx`, `historyFrom` in
  `src/lib/use-agent.ts`).
- **Headers:** `public/_headers` sets a content security policy on every
  asset: scripts, styles, fonts, and requests only from Cashew's origin,
  no framing, inline styles allowed because React and Recharts set them.
  Workers Assets reads the file, so the Vite dev server doesn't apply it.
  Check it with `npx wrangler dev --config dist/cashew_genui/wrangler.json`
  after a build.
- **Patch guard:** json-render's path writers follow `__proto__` like any
  other key, so a patch in Claude's output could reach `Object.prototype`,
  which every later request in the Worker shares. Found in the October 2026
  security audit: a planted patch line redirected every later Claude call,
  API key included, to another address. `isSafePatch` in `worker/patch.ts`
  drops any patch that leaves `/root`, `/elements`, and `/state` or names
  `__proto__`, `constructor`, or `prototype`, and `claudeModel` in
  `worker/claude.ts` pins the Anthropic address so nothing can redirect
  the key. Keep both when changing how specs are applied.

## Where things live

- `index.html` and `public/og.png`: the preview when the link is shared on X,
  LinkedIn, and elsewhere. The image is a 2400 by 1260 screenshot of the home
  screen in light mode, at a 1200 by 630 window, with Ask Cashew answering
  "How's my spending this month?". Take it again when the design changes.
- `src/shared/catalog.ts`: the catalogue, with when-to-use descriptions.
- `src/shared/components.md`: the components guide. Claude reads all of it on
  every written answer, so a change to how answers should be composed goes here.
  Keep it in step with the catalogue.
- `src/genui/blocks.tsx`: the blocks Claude composes new cards from.
- `src/shared/candidates.ts`: Jev's ready-made cards. Descriptions are all Jev
  sees, so word them to tell similar cards apart.
- `src/shared/data.ts` and `state.ts`: seeded mock bank, anchored to today in Toronto.
  It holds 13 months of history so visitors' own questions land on something
  real: a raise, a tax refund, freelance income, trips to New York (in US
  dollars, with fees) and Montebello, holiday spending, subscriptions that went
  up, started, or were cancelled, a Visa balance carried once in January,
  savings goals, budgets, cash back, TFSA room, and an Equifax score. A double
  Uber Eats charge, an Amazon refund, and a MasterClass renewal are planted for
  "anything unusual?". Jev's cards cover six months and stick to
  chequing and the Visa; Claude reaches the rest through its tools in
  `worker/claude.ts`. A new kind of data needs a tool there and a mention in
  Jev's route question in `worker/jev.ts`.
- `worker/`: the Cloudflare Worker (`/api/ask`), Jev routing and composition,
  Claude with tools, and an offline stand-in used when no key is set.
- `src/genui/`: the Cashew components json-render draws with.

## Running it

- `npm run dev` starts Vite with the Worker. It needs `npx wrangler login`,
  because the AI binding always calls Cloudflare, even locally. Put the
  Anthropic key in `.dev.vars` as `ANTHROPIC_API_KEY=...` (git-ignored). Without
  it, Claude answers are switched off. `JEV_OFFLINE=1` in `.dev.vars` swaps Jev
  for a keyword stand-in. A build copies `.dev.vars` into
  `dist/cashew_genui/`, so never archive or upload `dist` as a whole.
- Run one dev server at a time, and reuse it if it's already up. Servers in
  this folder share Vite's dependency cache (`node_modules/.vite`), so a second
  one rebuilds it under the first and the page hangs while loading. If that
  happens, stop them all, delete `node_modules/.vite`, and start one again.
- `npx tsx scripts/try-compose.ts "prompt"` runs one Jev composition from the
  command line.
- Production secret: `npx wrangler secret put ANTHROPIC_API_KEY`.
- The Worker is `cashew-genui`. Renaming it in `wrangler.jsonc` deploys a new
  Worker, so the custom domain and the Anthropic secret have to move to it.
