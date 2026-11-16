# Build notes — token-radar-01

## Data source

The sealed snapshot from the official make.fun kit for this competition
(`input/snapshot.json` inside the kit archive): DefiLlama's protocol list
(`https://api.llama.fi/protocols`), fetched 2026-11-14T01:18:33.201Z, `as_of` 2026-11-14,
house floor $50,000,000 TVL. `main.ts` reads only this snapshot — no live API calls at build
time, so the entry reproduces exactly from the kit. `vendor/makefun-board.ts` is copied
byte-for-byte from the kit (sha256 `9ca51b6e5cd84fe46cb0efa61e2ea99365a1fb0e21f2b75e6007f977f0dc326e`,
matching the kit's own manifest).

## Filtering funnel (verified by an independent Python recount)

| Step | Count |
| --- | --- |
| Protocols in the snapshot | 758 |
| Pre-token: `mcap_usd`, `gecko_id` and `symbol` all null | 342 |
| − product/exchange categories (CEX 42, Liquid Staking 38, Bridge 28, Canonical Bridge 15, Liquid Restaking 3, Restaked BTC 2) | 214 |
| − versioned names (`V2`-style pools) | 203 |
| Board rows shipped | **203** (40 watchlist + 163 early) |

All 40 watchlist slugs fall inside the rule-based set on their own; the generator still treats
the watchlist as a hard floor and refuses to emit a board that drops one. Tokenized protocols
(market cap present, TVL > 0) number 144 and are never ranked — they are the peer set.

## Implied-value method (model `radar-2`, in `lib/model.ts`)

`implied = TVL × peer multiple × growth × maturity`, all inputs from the snapshot:

- **Peer multiple:** per category, the median market-cap/TVL ratio of its tokenized protocols,
  each ratio winsorized to [0.01, 5]. Global median 0.169× over 144 peers. A category needs
  ≥ 4 peers for its median to stand alone; with 1–3 it is blended with the global median
  weighted n parts category to 3 parts global (so a single hot peer cannot carry a category —
  this replaced an earlier straight 50/50 blend during the build); with none it takes the
  global median.
- **Growth:** `1 + clamp(change_7d, −60, +120)/100 × 0.5`.
- **Maturity:** `0.6 + min(age_days, 1095)/1095 × 0.4`; unknown listing age counts as 365 days.
- Ranking: implied descending, ties by TVL then slug. Farm plans: six steps per protocol,
  generated from its category (actions), first listed chain (gas text), TVL tier (capital
  $50/$100/$150/$250), and age (hold length), each step carrying a cost and a time.

Design decisions worth knowing: wrapped/staked/bridged product categories are excluded from
the ranked board even below the house floor (an early version ranked WBTC — a wrapped product
of a traded token — at #7; that is exactly what the task says the board must not contain), and
the board's universe is the same universe the house watchlist is drawn from.

## Verification run (2026-11-15, this machine)

- `node main.ts` executes end-to-end (VM Node v24.22.1; the competition prerequisite is
  22.18+, and the requirements state a newer major counts; the TypeScript uses erasable
  syntax only, no post-22 APIs). A clean re-run into a fresh output directory reproduces
  `board.json` byte-for-byte.
- **Dossier:** rebuilt independently with the vendored `buildDossier('/output', gate caps)`
  and compared byte-for-byte with both `/output/dossier.json` and the committed
  `dossier.json` — identical (771,492 bytes ≤ 1.5 MiB).
- **Gate checks (Python, 13/13 pass):** 100 ≤ rows ≤ 4,000; every slug present in the
  snapshot; ranks exactly 1..N; implied values positive whole numbers ≤ 1e14, non-increasing
  with rank, not all equal; watchlist coverage 40/40; every row's farm plan 3–12 steps of
  20–600 chars (shipped: 6 steps, 124–266 chars); no product/CEX category on the board;
  every board row pre-token in the snapshot.
- **Independent recompute:** all 203 implied values recomputed from the raw snapshot with a
  separate Python implementation of the documented model — exact match on every row.
- **Dashboard offline:** the three dashboard sources (36,850 bytes total, under the 64 KB
  dossier text cap) contain no `http://` or `https://` string anywhere; the page loads its
  data from the sibling `data.js` that `main.ts` writes, and its in-page recomputation of
  the #1 row's value matches board.json to the dollar.
- **Screenshots:** taken from the real built output with headless Chrome (Puppeteer's
  Chrome 157; the VM's `/opt/meta-chromium/chrome` refuses headless screenshots under a
  WebGL domain policy) at 1440×1000, converted to JPEG: `1-board.jpg` (177,230 B),
  `2-detail.jpg` (197,659 B), `3-filtered.jpg` (175,176 B) — each a whole JPEG, long side
  1440 ≤ 1440, short side 1000 ≥ 800, each ≤ 512 KiB. All three were visually inspected:
  board, Steakhouse Financial detail, and the watchlist-only filtered view (40 of 203).

## Unresolved / the entrant's side (not done here, by design)

- **Nothing was submitted.** No make.fun account, keypair, or API key was created; no
  wallet address exists in this repo. Submission needs the entrant's own account
  (`achzuldaf`), a GitHub repository (suggested name `token-launch-radar`), a commit SHA,
  the signed entry message, and the transcript bundle from the kit CLI.
- **Transcript gate:** this competition's requirements set `handed_over_places: "none"` —
  an entry whose build transcripts are handed-over exports is ranked but takes no paid
  place. The documented remedy is a locally recorded harness on the entrant's own computer;
  that decision sits with the entrant, and this build does not hide it.
- **README referral code:** the template's footer carries a `{referral_code}` placeholder;
  none is known for the entrant, so the shipped README links to make.fun without a `ref`
  parameter rather than inventing one. Fill it in before submitting if a code exists.
- **GitHub About:** the requirements ask for the repo About to be set (homepage = the
  bounty page, topic `makefun`) via the `repo_about.gh` line in the requirements — a
  submission-time step for the entrant.
- `.makefun/owner.json` is only needed if the repository owner differs from the account's
  GitHub login; the owner used in the README badges is `achzuldaf`.
