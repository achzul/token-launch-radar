![Live rank](https://make.fun/badge/token-radar-01/achzul/token-launch-radar/rank.svg)
![Live reward](https://make.fun/badge/token-radar-01/achzul/token-launch-radar/reward.svg)

# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/achzuldaf/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/achzuldaf/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar. It reads the sealed snapshot of every protocol DefiLlama tracks, works out which
ones still record no token and are not a wrapped or staked product of one that trades, and ranks them
by what their launch would be worth. The dashboard shows the ranked board, a detail view for every
protocol with the model's own arithmetic, and a six-step farm plan per protocol — and it renders with
no network at all.

**The board:** 203 protocols — the full 40-protocol house watchlist plus 163 early finds below the
house floor — ranked by implied value at the stated model (`radar-2`). Top of the board: Steakhouse
Financial ($2.75B TVL, $1.89B implied), Sentora Curator, Gauntlet.

## How the board is built

**Filtering** (snapshot of 2026-11-14, 758 protocols):

| Step | Count |
| --- | --- |
| Every protocol in the sealed snapshot | 758 |
| Records no token (market cap, CoinGecko id and symbol all null) | 342 |
| − wrapped/staked/bridged product categories and exchanges (Bridge 28, Canonical Bridge 15, Liquid Staking 38, Liquid Restaking 3, Restaked BTC 2, CEX 42) | 214 |
| − versioned names (a `V2`-style pool of a protocol counted elsewhere) | **203** |

**Implied value** prices a pre-token protocol the way the market prices its kind, using only figures
from the snapshot itself:

```
implied = TVL × peer multiple × growth × maturity
peer multiple = median market-cap/TVL of the category's tokenized protocols,
                each ratio winsorized to [0.01, 5]; a category needs 4 tokenized
                peers to stand alone — fewer and its median is blended with the
                global median (0.169×, 144 peers), weighted n parts category to
                3 parts global; no peers at all takes the global median
growth        = 1 + clamp(7d TVL change, −60%, +120%) / 100 × 0.5
maturity      = 0.6 + min(age in days, 1095) / 1095 × 0.4   (unknown age = 365 days)
```

No protocol's name is read anywhere in the model: one function scores every row, and the dashboard
recomputes each value in the page from the row's own figures, so what you see is board.json's number
from the page's own arithmetic. Protocols whose token already trades are never ranked; the dashboard
sets the largest of them aside in an "Already launched" view, at market value. Each board row carries
a six-step farm plan written from its own record — its category sets the actions, its first chain the
fees, its TVL the position size, its age the hold — with a cost and a time on every step.

Implied value is this entry's model claim about what a launch would be worth if a protocol's record
stayed as it is. It is not a forecast that a token will be issued, and it is not investment advice.

## Run it

```sh
node main.ts --input /path/to/snapshot.json
# writes board.json, data.js, dashboard/, screenshots/ and dossier.json to /output
# (or to $MAKEFUN_OUTPUT_DIR when set); needs Node.js 22.18 or later
```

Open `dashboard/index.html` from the output directory in any browser — it needs no server and no
network. `main.ts` refuses to write a board the competition's gate would refuse.

## Layout

- `main.ts` — the generator (Node 22, standard library only)
- `lib/model.ts` — the whole value model and the farm-plan writer
- `vendor/makefun-board.ts` — the make.fun dossier library, byte-for-byte from the official kit
- `dashboard/` — the static page (`index.html`, `app.css`, `app.js`); data arrives as `data.js`
- `board.json`, `dossier.json` — the generated artifacts, committed for inspection
- `screenshots/` — the board, a detail view, and a filtered view

---

Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards
