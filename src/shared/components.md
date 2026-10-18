# Cashew components

This is the guide to composing Cashew answers. Claude reads all of it before every written answer, and it's the reference for anyone adding to the design system. The props for each component live in `catalog.ts`. This guide covers when to use each one and how they combine.

## Building an answer

An answer is a short written reply followed by one to three cards, stacked in an Answer with the most important card first.

- Use a finished card whenever one shows exactly what was asked. Finished cards are tuned by hand, so they always beat a card built on the spot.
- Build a new card from blocks when no finished card shows it. That's usually a goal, a what-if, a plan, a total over a set the person picked, or anything worked out from several numbers.
- Give each card one idea. If a second card would only repeat what the first one shows, leave it out.
- The panel is about 400 pixels wide, so everything stacks. Row is the only way to put two things side by side.

## Writing inside a card

- **Titles** name what the card shows in a few words, in sentence case, like "Savings goal" or "Dining if you cut back".
- **Captions** give the scope in a few words, like "By December 31" or "Last six months". A caption is never a sentence.
- **Labels** say exactly what the number under them is, like "Still to save". If the number is a projection, the label says so. A label like "Amount" or "Total" says nothing.
- **Numbers** come from the tools, or are worked out from them. When a number was worked out, a Text block says how.
- **Text** is one or two complete sentences that explain the method in words, like "Based on your average since May". It uses one number at most, never one the card already shows, and never lists the figures behind a calculation.
- **Each number appears once** in the card. A Figure's caption and the Card's caption never say the same thing.
- Write plain Canadian English, with no exclamation marks or emoji.

## Finished cards

| Card | Use it for | Use something else for |
| --- | --- | --- |
| Stat | A single number the person asked about, like a balance or net worth | A number that needs explaining: a Card with a Figure and Text |
| AccountList | Every account's balance at once | One account: a Stat |
| TransactionList | Up to ten transactions, to show recent activity or what makes up a total | Ranking places by spend: MerchantList |
| SpendingChart | One spending series by month, for trends | Two categories side by side: a Card with a Row of Figures |
| CategoryBreakdown | Where the money went in one period, by category | One category over time: SpendingChart |
| Comparison | Two periods and the difference between them | More than two periods: SpendingChart |
| MerchantList | The places the person spent the most at | |
| BillList | Bills coming up, with autopay | Whether the person can cover them: a Card with a Figure and a List |
| PortfolioChart | How the TFSA has done over time | |
| HoldingsTable | Each investment, with its value and return | |
| Allocation | The split across equity, fixed income, and cash | |
| TransferForm | Sending someone money. It always sits on its own, never inside a Card | |
| Note | One fact worth noticing, next to the cards that show it | The main answer |

## Building blocks

Blocks only go inside a Card. From top to bottom, a Card reads Figure, then Row, Meter, or List, then Text. Most Cards hold two to four blocks.

### Card

The container for a new view. It holds Figure, Row, Meter, List, and Text, and nothing else. A finished card, a Note, or another Card never goes inside it.

### Figure

The number that answers the question, set large. Lead with one Figure, first in the Card. The format is money unless you set percent or number. Set a change only when comparing with an earlier period, and say with changeIsGood whether a rise is good news.

### Row

Inside a Card, a Row puts two or three Figures side by side, for a before and after or two numbers that belong together. Figures in a Row are set smaller. Two fit best at this width. In an answer, outside any Card, a Row puts Stats side by side instead.

### Meter

Progress against a target, as a bar. Use kind goal for something good to reach, like savings, and kind limit for something to stay under, like a budget or a credit limit. A limit turns orange at 90%. The label is a few words, like "Saved so far", because the amounts sit beside it. Use one or two Meters in a Card. For more targets than that, use a List.

### List

Rows of labelled values, at most eight. The plain style suits a breakdown or a plan, where the order carries meaning, like dates. The bars style compares sizes, largest first. A number shows as dollars, and anything else, like a date or "Autopay", goes in as a string. Money going out is a negative number, which shows with a minus sign, so a label never needs a word like "Less". Set tone only when a value is clearly good or bad news.

### Text

One or two sentences, last in the Card, that say how a number was worked out or what it assumes. The written reply above the cards already carries the main answer, so Text stays short.

## Patterns

These are starting points for questions no finished card answers. Adapt them to the question.

- **A goal**, like "Am I on track to save $5,000 by December?": a Card titled "Savings goal" with a Figure for what's still to save, a goal Meter, and Text with the monthly pace it takes.
- **A what-if**, like "What if I cut dining in half?": a Card with a Figure for what the change saves in a year, a Row of Figures for the monthly amount now and after, and Text with the assumption.
- **Affording something**, like "Can I afford a $900 trip next month?": a Card with a Figure for what's left after bills, a plain List that starts from the balance and takes away each bill and the trip as negatives, and Text with what the sum leaves out.
- **A total over a set**, like "What do my subscriptions cost a year?": a Card with a Figure for the yearly total and a bars List of each subscription's yearly cost.
- **Two things compared**, like "Do I spend more on groceries or dining?": a Card with a Row of two Figures for each one's monthly average, and Text with the difference.
- **A limit**, like "How much of my credit limit am I using?": a Card with a percent Figure and a limit Meter.
- **Budgets**, like "Am I over budget?": a Card with a Figure for what's left in the budget asked about, or across them all, and a limit Meter for one or two budgets. For more than two, use a plain List of what's left in each, with overspending as a negative number.
- **Several goals**, like "How are my savings goals doing?": a Card with a Figure for the total still to save and a goal Meter for each goal, up to two. For three, use a plain List of what's left in each, with Text on which one is behind.
- **A score over time**, like "How's my credit score?": a Card with a number Figure for the score, its caption giving the points gained or lost since the first month, a plain List of a few months, and Text on what's moving it.
- **Something unusual**, like "Any weird charges?": a TransactionList of only the charges worth a look, and a Note on the one that matters most. The reply says why each one stands out.

## Example

The goal pattern, as a spec. Data the card shows goes in state and is bound with `$state`. The amounts here are made up to show the shape, and a real answer takes every amount from the tools.

```spec
{"op":"add","path":"/root","value":"answer"}
{"op":"add","path":"/elements/answer","value":{"type":"Answer","props":{"gap":"md"},"children":["goal"]}}
{"op":"add","path":"/elements/goal","value":{"type":"Card","props":{"title":"Savings goal","caption":"By December 31"},"children":["left","meter","how"]}}
{"op":"add","path":"/elements/left","value":{"type":"Figure","props":{"label":"Still to save","value":{"$state":"/goal/left"},"format":"money","caption":"$880 a month","change":null,"changeIsGood":null},"children":[]}}
{"op":"add","path":"/elements/meter","value":{"type":"Meter","props":{"label":"Saved since January","value":{"$state":"/goal/saved"},"target":5000,"kind":"goal","caption":null},"children":[]}}
{"op":"add","path":"/elements/how","value":{"type":"Text","props":{"text":"You move $400 to savings each month, so at that pace you'd reach about $4,040 by December 31."},"children":[]}}
{"op":"add","path":"/state/goal","value":{"left":1760,"saved":3240}}
```
