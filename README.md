# Cashew

Cashew is a made-up Canadian bank whose assistant builds every answer from the bank's own design system. Ask how your spending looks this month and Cashew's spending card appears. Ask why September cost so much and Claude writes an answer, then composes a new card for it from the same parts. Try it at [genui.alisalem.ca](https://genui.alisalem.ca).

Designed and built by Ali Salem.

## Why Jev

Most AI assistants write every answer from scratch. That takes several seconds, and what reaches the screen is something nobody checked. Jev is a model built to choose between options, so this experiment asks how much of an assistant's work choosing can cover before writing is needed.

For each question, Jev scores Cashew's ready-made cards and picks the best fit, usually in about a second. "How's my spending this month?" put the spending card on screen in 0.92 seconds. When no card fits, like "What would skipping Tim Hortons and Balzac's save me this year?", Jev passes the question to Claude, which took about 15 seconds to read the transactions and build a new card. Jev also returns a score for every card it weighed, so each answer can show why it was chosen.

## How an answer is made

Two models share the work. Jev reads every request first. It's a model that scores a set of options and chooses between them. For most requests it picks ready-made cards from Cashew's catalogue and arranges them. Requests that need a written answer, or that Jev can't cover, go to Claude Haiku, which uses a finished card when one fits and otherwise composes a new one from blocks like Figure, Meter, and List. Every answer gets a short written reply. For Jev's cards, Claude writes the reply after the cards are already on screen.

Above each answer, a panel called "How this answer was made" lays out the steps: the components Jev weighed and how it scored them, why it passed a question to Claude, and what Claude composed. The About button in the header lists the tech stack and shows how a question reaches Jev or Claude.

Jev can also act on the page. It rearranges the dashboard when you ask, and it can open the transfer form, but you review and confirm every transfer yourself. Transfers are demo-only.

## Running it locally

Cashew is a React app with shadcn/ui, served by a Cloudflare Worker. Jev runs through Cloudflare AI Gateway, so you need a Cloudflare login even in development.

```bash
npm install
npx wrangler login
npm run dev
```

Claude's answers need an Anthropic API key in `.dev.vars`, a git-ignored file at the project root:

```
ANTHROPIC_API_KEY=your-key
```

Without the key, Jev's cards still work, and questions that need Claude get a note that Claude isn't connected. Adding `JEV_OFFLINE=1` to the same file swaps Jev for a simple keyword matcher.
