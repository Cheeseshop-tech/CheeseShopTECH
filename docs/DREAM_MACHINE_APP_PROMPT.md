# Dream Machine — Build Prompt + Open Questions

*Dream Machine — Banking and Budgeting. (Working title through rev. 2: "Teen Shopping Budget App.")*

**Status:** PROMPT + DECISION SHEET. No app code written yet.
**Prepared by:** Claude Code, at the request of Rick Posada
**Date:** 2026-08-19 (rev. 6 — capture routes; rev. 5 visual direction; rev. 4 named; rev. 3 savings
balance; rev. 2 access, budget, fallback UI)
**Input doc:** "Teen Shopping Budget App — Spec" (chat-prepared, same date)

Two things live here:

- **Part A — The Build Prompt.** Self-contained. Paste it into a fresh Claude Code session
  and it can build v1 without re-reading the original spec.
- **Part B — Questions for Rick.** What Part A still assumes. Answered items are recorded at the
  top of Part B; the rest carry recommended defaults, so you can reply
  `defaults, except 5b` and the build starts.

## Decisions locked so far

| Decision | Answer |
|---|---|
| Auto-filled vs. manually-entered items | Look identical. No badge, no failure styling. |
| Access | One simple shared link per person. No accounts, no passwords. |
| Goals funding | A single shared pot of parent money, entered by the parents. |
| Her savings | A balance she banks into, allocated out onto Goals and tracked separately from parent money. |
| Parent actions | Approve/decline, set the pot, and pledge to specific Goals. |
| List view | Grid for browsing; list for reordering, reprioritizing, deleting. |
| Getting items in | Share sheet via an iOS Shortcut. Carts can't be imported; public wishlists can. |
| Name | **Dream Machine** — Banking and Budgeting. |
| Visual direction | Depop-like: photo-led, high contrast, minimal chrome. |

The three money rows interlock, so state the relationship plainly: **the pot is the ceiling, pledges
are allocations out of it.** Parents enter one number (say $300). Pledging $80 toward the boots
draws that $80 down, leaving $220 unallocated. Her own saved money is a separate track that never
touches the pot. That is what keeps "budget" and "pledges" from becoming two systems that
disagree.

Her money works the same way, one layer down. Babysitting money lands in **her balance** as a
deposit; moving $20 of it onto the boots is an allocation out of that balance. She can also put
money straight onto a Goal without it passing through the balance, for when she already knows
where it's going. So a Goal's progress bar has two funding sources (hers, parents') and each
source has a pot behind it.

---

# Part A — The Build Prompt

> Copy from here to the end of Part A.

## Context

Build **Dream Machine** — banking and budgeting for a teenager — a mobile-first web app for a 15-year-old to catalog things she wants to buy, sorted into
Needs / Wants / Goals, with a linked parent view where her parents can approve items, fund a
shared savings pot, and pledge from it toward specific Goals. She tracks her own savings the same
way: money she earns banks into a balance, and she puts it toward the bigger purchases she's
saving for. It is a private family app — three
known users, no signups, no public listing, no growth features. Target: a working v1 in a weekend
of focused build time.

Primary user is on an iPhone in Safari, adding items while browsing Sephora, Depop, and boutique
Instagram shops. Every design decision resolves toward "fast to add an item on a phone,
one-handed." The parent view is secondary and can be plainer.

## Stack (decided — do not re-litigate unless something is genuinely blocked)

- **Front end:** React + Vite, TypeScript, single-page app. Tailwind for styling. No component
  library — the surface is small enough that hand-rolled cards and a bottom tab bar are less work
  than adapting one.
- **PWA:** web app manifest + `apple-touch-icon` so it installs to the iOS home screen and opens
  chromeless. No service worker / offline mode in v1 (see Non-goals).
  Manifest `name`: "Dream Machine — Banking and Budgeting". Manifest `short_name`: **"Dream
  Machine"** — that is what sits under the home screen icon, and iOS truncates past ~12
  characters, so do not append anything to it. `<title>` matches the full name.
- **Data:** Supabase Postgres. **Accessed only from Netlify Functions using the service key** —
  the browser never holds a Supabase key of any kind. See Access model for why.
- **Scraping:** Firecrawl, called from a Netlify Function (`/api/scrape`), never from the browser.
- **Images:** scraped image URLs are re-hosted via Cloudinary fetch/upload rather than hotlinked —
  retailer CDNs hotlink-block, expire URLs, and break the list a month later. Uploaded screenshots
  go to the same place.
- **Sync:** poll on window focus and every 30s while open. Realtime subscriptions need a client-side
  Supabase key, which the access model rules out; at three users, polling is indistinguishable.
- **Hosting:** Netlify (matches existing CheeseShop TECH deploys). Free tier is sufficient.

Environment variables (`.env`, never committed): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
`FIRECRAWL_API_KEY`, `CLOUDINARY_URL`. All server-side only — note that none are `VITE_`-prefixed,
and that is deliberate: anything `VITE_` is compiled into the client bundle. Commit a
`.env.example` with keys and no values.

## Access model — shared links, no accounts

No login, no password, no email. Each person gets a long unguessable link they save once.

- **Three links, one per person:** one teen link, one for each parent. Same URL, different token.
  Separate parent tokens cost nothing and give pledge attribution for free ("Mom pledged $30").
- **Token format:** 128 bits of randomness, base58, in the URL **hash fragment** —
  `https://app.example.com/#t=<token>`. The hash is never sent in an HTTP request, never appears
  in server logs, and is never leaked in a `Referer` header when she taps through to a product
  page. A token in the path or query string would leak in all three places.
- Also set `rel="noreferrer noopener"` on every outbound product link.
- On first load, the client stores the token in `localStorage` and rewrites the URL to drop the
  hash, so the token isn't sitting in a visible address bar or in Safari's history UI.
- **Server-side validation:** every Netlify Function takes the token, hashes it (SHA-256), looks it
  up in `access_links`, and derives `role` and `household_id` from the row. Store only the hash —
  a database dump should not yield working links. An invalid or revoked token returns 401 and the
  client shows a plain "this link isn't valid anymore" screen.
- **Permissions are enforced in the Functions, not the UI.** The teen token may create, edit, and
  delete items and log her own savings. A parent token may set the pot, pledge, approve, and
  decline — and may **not** create, edit, or delete items. Reject with 403 server-side; a
  hidden button is not a permission.
- **Rotation:** a `/api/rotate-links` endpoint, callable with any parent token, that regenerates
  all three tokens and returns the new links. Links get forwarded and screenshotted; being able to
  revoke in ten seconds is what makes the link model acceptable.
- Rate-limit the token check (e.g. 20 failed attempts per IP per minute) so the token space can't
  be walked.

## Visual direction — Depop as the reference

She likes Depop, so build toward that feel. What that concretely means, and what it does not:

- **Photos carry the screen; the UI recedes.** Big images, tight type, almost no borders, no card
  shadows, no gradients, no decorative color fields. Depop looks the way it does because the
  product photos are the design and everything else gets out of the way.
- **Near-white paper, near-black ink, one accent.** Suggested: paper `#FAFAF8`, ink `#111111`,
  accent `#6C4CF1`. **Do not make the accent red.** Depop's is, but this app spends red on
  over-allocated budget, and an interface that is red everywhere can't warn with red.
  Reserve red strictly for over-budget; reserve green strictly for a fully-funded Goal.
- **Type:** a tight grotesk. Archivo 700/800 for headings and numbers, Inter for body and labels.
  Small, wide-tracked uppercase for section labels; large and heavy for money figures.
- **Controls:** pill-shaped buttons, full-bleed sheets that slide up, generous tap targets. No
  hairline-bordered form fields — filled input wells instead.
- **Dark mode** follows the phone setting: true near-black paper, not a dark gray, since the point
  is again that photos glow and chrome disappears.
- Take the *layout language*, not Depop's marks — no Depop logo, wordmark, or lifted iconography.
  Dream Machine should look like a cousin, not a counterfeit.

### The one conflict, and how it resolves

The original spec asked for vertical card layouts. Depop's browse screen is a **two-up photo
grid**. Both are honored by splitting on content type:

- **Needs and Wants → two-column photo grid.** Square-ish tiles, image first, name and price small
  underneath. Still one vertical scroll; no horizontal carousels, no timeline views. These items
  are visual and she is scanning them the way she scans Depop.
- **Goals → full-width cards, one per row.** A Goal carries a progress bar, two funding segments,
  and dollar figures. That does not survive being shrunk to half-width, and Goals are the screen
  she reads rather than scans.

### What a photo grid demands of the images

A grid is unforgiving about missing and mismatched images in a way a list is not — one blank tile
in a 2-up grid reads as broken, and ~10–20% of adds will have no scraped image.

- Serve every tile through a Cloudinary transform to a **uniform 4:5 crop** (`c_fill,g_auto`) so
  ragged source images can't break the grid rhythm.
- Store the image's dominant color on the item and paint it as the tile background while the photo
  loads, so the grid never flashes empty.
- **Design the no-image tile deliberately**, not as a fallback afterthought: the item name set
  large in ink on a flat tinted field, with the source site small beneath. It should look like a
  typographic choice. This is the single highest-leverage piece of polish in the app — it is what
  keeps the scraping failures from feeling like failures.

## Data model

```
households
  id                  uuid
  name                text
  goal_budget_cents   int default 0   -- THE POT. Parent-entered. One number for all Goals.
  updated_at          timestamptz

access_links
  id            uuid
  household_id  uuid
  token_hash    text unique      -- sha256 of the token; the token itself is never stored
  role          text  -- 'teen' | 'parent'
  display_name  text  -- 'Bella' | 'Mom' | 'Dad' — used for attribution
  revoked_at    timestamptz
  last_seen_at  timestamptz      -- powers the parent's "new since you last looked"

items
  id            uuid
  household_id  uuid
  bucket        text  -- 'need' | 'want' | 'goal'
  name          text
  price_cents   int          -- nullable; an item can be logged before the price is known
  currency      text default 'USD'
  image_url     text         -- Cloudinary URL
  source_url    text         -- original product link
  source_site   text         -- derived hostname, e.g. 'sephora.com'
  notes         text
  priority      int          -- 1 = must have, 2 = would like, 3 = someday
  sort_order    float        -- manual position within (bucket, priority)
  entry_method  text  -- 'auto' | 'manual' | 'screenshot' — recorded, never displayed
  status        text  -- 'open' | 'approved' | 'declined' | 'purchased' | 'archived'
  created_at    timestamptz
  updated_at    timestamptz

contributions          -- the money ledger; every total in the app is derived from this table
  id            uuid
  household_id  uuid
  item_id       uuid -> items.id     -- NULL only for a 'deposit' into her balance
  link_id       uuid -> access_links.id   -- who did it, for attribution
  source        text  -- 'teen' | 'parent'
  kind          text
    -- source='teen':   'deposit'   money in, item_id NULL      -> her balance += amount
    --                  'allocate'  item_id set                 -> her balance -= amount, goal += amount
    --                  'direct'    item_id set                 -> goal += amount, balance untouched
    -- source='parent': 'pledged'   item_id set                 -> pot allocated += amount, goal += amount
  amount_cents  int          -- may be negative on 'allocate' to pull money back off a Goal
  fulfilled_at  timestamptz  -- pledges only: set when the money actually changes hands
  note          text         -- 'babysitting the Hendersons', etc.
  created_at    timestamptz
```

Three `kind` values on her side rather than one is the difference between a balance that
reconciles and a balance that quietly double-counts. `deposit` is money entering, `allocate` moves
money that already exists, and `direct` is money that never touched the balance. Only `deposit`
increases what she has; only `allocate` decreases it.

**Derived figures — compute these, never store them:**

- Goal progress = `sum(allocate + direct) + sum(pledged)` over `price_cents`, rendered as two
  segments so her money and parent money stay visually distinct.
- **Her balance** = `sum(deposit) − sum(allocate)`. Show it at the top of the Goals section.
- Allocating more than her balance holds is **blocked**, unlike the parent pot's soft warning. The
  pot is a promise and can be optimistic; her balance is money that either exists or doesn't.
- Pulling money back off a Goal is a negative `allocate` — she will change her mind about which
  thing she's saving for, and the app should let her without deleting history.
- **Deleting an item with money on it must settle that money, not orphan it.** Her `allocate`
  entries are removed, which returns the amount to her balance by the formula above; her `direct`
  entries become `deposit` entries (item_id NULL), because that money never passed through the
  balance and would otherwise vanish; parent `pledged` entries are removed, freeing the pot. The
  confirmation says exactly what will happen — "$40 goes back to her balance and $60 of pledges is
  freed up" — before anything is deleted. Silently deleting money is the one bug in this app that
  would actually matter.
- **Pot remaining** = `goal_budget_cents − sum(pledged on non-archived goals)`. This is the number
  parents care about; show it at the top of the parent Goals view.
- If a pledge would push the pot negative, **warn but allow** — show the pot as over-allocated in
  red and prompt "raise the budget?". Hard-blocking a parent from promising their own kid money is
  the wrong call; a visible red number is the right one.
- `fulfilled_at` exists because an unfulfilled pledge is a promise, not money. Show unfulfilled
  pledge segments as a hatched/lighter fill so the progress bar doesn't overstate what's real.

## Screens

**1. My List** (default screen, teen)
- Three sections — Needs, Wants, Goals — as a segmented control at top; content is a single
  vertical scroll of cards. Vertical cards only; no horizontal carousels, no timeline/Gantt views.
- **Needs and Wants render as a two-column photo grid** (see Visual direction): 4:5 image tile,
  name and price small beneath, priority as a small dot on the tile, status pill only when not
  `open`. Tap → Item Detail; long-press → quick actions (change bucket, mark purchased, delete).
- **Goals render as full-width cards**, one per row, each showing its progress bar inline.
- **Auto-filled and manually-entered items are visually identical.** No badge, no icon, no
  differing styling anywhere in the app. `entry_method` is recorded for diagnostics only.
- Within a section, sort by `priority` then `sort_order`.
- **A grid/list toggle sits at the right of the tab row and applies to all three buckets.** The
  grid is for browsing; the list is for tidying up, and carries the controls a photo tile has no
  room for:
  - A compact row: small thumbnail, name, price and source, and a tappable priority label
    (Must have → Would like → Someday, cycling).
  - **Up/down arrows rather than drag.** Touch drag-and-drop inside a scrolling list is fiddly on
    a phone and hard to undo; arrows are unambiguous and reversible. Moving an item **within** a
    priority band reorders it; moving it **past** the band boundary promotes or demotes it into
    the neighboring band. One control does both jobs, and the list visibly re-sorts either way.
  - Delete, with a confirmation that states any money consequence (see below).
- Remember the toggle per person — she will have a preference and it won't be the same in both
  directions.
- Section header shows a running total of open items in that bucket. The Goals section is topped
  by a **savings card**: her balance, the parents' unallocated pot, and an "Add money" button.
  Tapping the card opens Savings (screen 4). No fourth tab — a fourth bucket would cost layout on
  every screen for something that is one card.
- Empty states matter — an empty Goals tab should say what a Goal is and offer "Add one."

**2. Add Item** (full-screen sheet from a persistent `+` button)
- Top field: paste a product link. On paste, immediately show the card in a "fetching…" skeleton
  and call `/api/scrape`. Do not make her wait on a spinner before she can type.
- Auto-fill returns name, price, image, source site. Every field stays editable — treat scraped
  values as a first draft, not truth.
- **If scraping fails, nothing about the form changes.** No error banner, no warning color, no
  alternate layout. The fields simply come back empty and focus lands on the name field, exactly
  as if she'd opened the form to type from the start. An "Add a photo" button is present on every
  add, not just failures, so the screenshot path isn't a consolation prize either.
- Required to save: name + bucket. Everything else optional.
- Bucket picker, priority picker, notes.

**3. Item Detail**
- Full image, name, price, source link (opens the original, `noreferrer`), notes, bucket,
  priority, status.
- For Goals only: two-segment progress bar (her saved / parent pledged, with unfulfilled pledges
  hatched), amount remaining, and "+ Put money toward this" — which offers her balance first
  (an `allocate`, capped at the balance) and "add new money" second (a `direct`). Also "take money
  back off this," writing the negative `allocate`.
- History strip: when it was added, and any parent actions taken, attributed by name.

**4. Savings** (teen)
- Big number: current balance. Two actions: **Add money** (a deposit, with an optional note like
  "babysitting") and **Put toward a Goal** (pick a Goal, pick an amount, capped at the balance).
- Below: the ledger, newest first — deposits, allocations, and money pulled back, each with its
  note and date. This is the screen that makes the saving feel real, so give it more visual care
  than a transaction list normally gets.
- If the balance is 0 and there are no entries, say what this is for rather than showing "$0.00."

**5. Parent View** (same app, parent token)
- Header: **the pot** — total budget (tap to edit), amount allocated, amount unallocated. This is
  the primary parent-facing number.
- Same three buckets, read-only, plus per item: **Approve**, **Decline**, and on Goals,
  **Pledge $__** (drawing from the pot) and a checkbox to mark a pledge fulfilled.
- "New since you last looked" filter, driven by `access_links.last_seen_at`.
- Household totals: open request value by bucket, pledged vs. fulfilled, total purchased, and
  **her balance** (read-only — parents can see what she's saved but never move it).

## Scraping behavior (`/api/scrape`)

- Input: a URL. Output: `{ name, price_cents, currency, image_url, source_site, confidence }`.
- Firecrawl scrape with a JSON extraction schema for those fields. Prefer Open Graph and
  `schema.org/Product` markup when present; fall back to Firecrawl's extraction.
- Handle: request timeout (8s hard cap — she is on cellular and will not wait), non-200, blocked
  domains, missing price, and currency symbols other than `$`.
- **Never fail loudly.** Any failure returns 200 with empty fields and `confidence: 0`. The client
  renders the ordinary empty form. A scraping error must never cost her the item or interrupt her.
- Cache by normalized URL for 24h so re-pasting the same link is free.
- Expect ~10–20% failure — Instagram Shops and some fast-fashion apps block scraping. That is the
  designed-for path, not the error path.

## Getting items in from somewhere other than the paste field

Pasting a link is the baseline, not the ceiling. Two upgrades, assessed:

### The share sheet (proposed for v1 — high value, roughly an hour)

The real friction isn't typing, it's leaving the store. On an iPhone the fix is an **iOS
Shortcut published to the share sheet**, named "Add to Dream Machine": from Safari, the Depop
app, Instagram, anywhere — Share → Dream Machine → the URL POSTs to `/api/scrape-and-add` with
her token, and the item lands in a chosen bucket without the app ever coming to the foreground.
A banner confirms it. She never loses her place.

- No App Store, no review, no native code. The Shortcut is a file she installs once.
- The token lives inside the Shortcut on her phone; the endpoint validates it exactly like any
  other call, and rotation invalidates it along with everything else.
- Default the bucket to Wants and let her re-file later — asking a question at share time defeats
  the purpose.
- On Android this is native: a PWA declares `share_target` in the manifest and appears in the
  system share sheet with no Shortcut at all. Build the endpoint once; both front doors use it.

### Importing a whole list (v1.1)

**Shopping carts are not importable, and shouldn't be.** A cart sits behind her retail login.
Reading one would mean holding her store credentials or session cookies — for a minor's accounts,
against most sites' terms, and a standing security liability for a family app. Not worth it.

**Public wishlist and share links are a different matter** and are worth doing. Where a retailer
offers a shareable saved-items URL, that page is public and scrapes like any other, just with N
products on it instead of one. The work is small and mostly UI:

- `/api/scrape-list` returns an array of candidates rather than a single item.
- She gets a picker — every item found, each with a checkbox, bucket, and price — and imports the
  ones she actually wants. Never bulk-add silently; a 30-item dump is how a list becomes noise.
- Worth checking which of the three sites she actually uses offer a public share URL before
  committing to this. If none do, it's dead weight.

## Non-goals for v1 (state these back if asked to add them)

Side-by-side browsing (see below). Push notifications. Native apps / app store. Offline mode.
Price-drop tracking. Accounts,
passwords, or email. Multiple households. Sharing outside the family. Analytics or third-party
tracking of any kind — this is a minor's data; keep it to Supabase and nothing else. Payments.
Chores/allowance tracking. Retailer affiliate links.

**Side-by-side specifically:** iOS Safari on iPhone has no split view for two web pages, and no
web app can create one — this is an OS limitation, not a build decision. iPad already does it
natively via Split View with no work from us. The share-sheet route above solves the underlying
problem better anyway: she doesn't need the app beside the store if the store can hand items to
the app directly.

## Acceptance criteria for v1

1. Opening her link on her phone installs to the home screen, opens chromeless, and works
   thereafter without the link — token persisted, URL hash cleared.
2. Pasting a Sephora product URL fills name, price, and image in under 8 seconds.
3. Pasting a URL from a site that blocks scraping produces an ordinary empty form with no error
   surface, and the saved item is indistinguishable from an auto-filled one anywhere in the app.
4. Items land in the right bucket and can be re-bucketed and reordered by drag on touch.
5. Parents set the pot to $300; a $80 pledge on one Goal shows $220 unallocated; the Goal's bar
   shows her savings and the pledge as separate segments, with the pledge hatched until fulfilled.
6. She deposits $40, allocates $25 to a Goal: balance reads $15, the Goal's teen segment reads
   $25, and attempting to allocate $30 from a $15 balance is refused server-side. Pulling the $25
   back restores the balance to $40 and leaves both entries visible in the ledger.
7. A parent token calling the item create/edit/delete endpoints directly gets 403 — verified with
   curl against the deployed Functions, not by checking that the button is hidden.
8. Rotating links from a parent token invalidates all previous links immediately; the old link
   shows the "no longer valid" screen.
9. A change on one device appears on the other within ~30s, or immediately on refocus.
10. In list view, an item moved up past a priority boundary changes priority and the list
    re-sorts; deleting a Goal with $40 of her savings and $60 pledged on it warns about both,
    and on confirm her balance rises by $40 and the pot frees $60.
11. On a list where a third of items have no image, the grid still reads as designed — no blank
    tiles, no layout gaps, no broken-image icons.
12. Tested at 390px wide (iPhone viewport) with no horizontal scroll anywhere.

## Deliverables

Working app deployed to Netlify. `README.md` covering local setup, env vars, the schema SQL
(checked into `supabase/migrations/`), how to mint and rotate the three links, and what to do if a
link leaks. Seed script with realistic items so the UI can be reviewed before real data exists.

> End of build prompt.

---

# Part B — Questions for Rick

## Answered (rev. 2)

- **Manual vs. auto items look the same.** Built as stated: no badge, no failure messaging, no
  visual difference at all. Worth knowing what that trades away — when a site blocks scraping, the
  app gives her no signal that it tried; the form just sits there empty. If she ever reports "it
  didn't do anything," that's this, and the fix is one line of copy.
- **Shared link for access.** Built as stated, hardened where it's free to do so: one link per
  person, token in the URL hash so it can't leak through logs or `Referer`, hashed at rest, and
  one-tap rotation if a link gets forwarded. The residual risk is unchanged and worth naming once:
  anyone holding a link is that person, so a link in a group chat is a stranger reading your
  daughter's list. Rotation is the mitigation.
- **Goals funded from a parent-entered pot, her savings tracked separately, parents can also
  approve/decline and pledge per Goal.** Reconciled by making pledges allocations *from* the pot
  rather than a parallel promise, so the two numbers can never disagree.
- **Name: Dream Machine — Banking and Budgeting.** Set as the PWA name; "Dream Machine" alone is
  the home screen label.
- **Visual direction: Depop.** Photo-led, high contrast, minimal chrome. Needs and Wants become a
  two-column photo grid; Goals stay full-width because progress bars and dollar figures don't
  survive half-width. Accent deliberately not red, since red is doing budget-warning work.
- **She can bank savings generally and also put money straight onto a Goal.** Built as one ledger
  with a balance on her side mirroring the pot on the parents' side, so "how much do I have" and
  "how much is on the boots" are always the same money counted once.

## Still open

### 1. Money mechanics
**a.** Does the pot ever refill on a schedule, or do you just top it up by hand when it runs low?
> **Recommended:** top up by hand. A recurring reset needs a rollover rule and date handling, which
> is real work for a number you'll edit six times a year.
**b.** When she marks a Goal purchased, do the money committed to it (her allocations and the
parent pledges) get consumed, or released back to her balance and the pot?
> **Recommended:** consumed — the money was spent. But confirm, because the opposite is defensible
> if a pledge sometimes goes unspent.
**e.** Should Needs and Wants also be fundable from her balance, or is spending money only ever
tracked against Goals?
> **Recommended:** Goals only. She buys a $12 lip balm without wanting to do bookkeeping about it.
**c.** Any spending ceilings on **Needs** and **Wants**, or is the pot purely a Goals thing?
> **Recommended:** Goals only for v1, as specified.
**d.** Prices: sticker only, or include tax/shipping?
> **Recommended:** sticker. One number, entered once.

### 2. Buckets and priority
**a.** Split Needs into recurring vs. one-time?
> **Recommended:** not as a bucket — a `recurring` flag in v1.1 once you see whether restocks pile
> up. A fourth bucket costs UI on every screen.
**b.** Priority as a 3-level picker (must have / would like / someday) plus drag within a level?
> **Recommended:** yes. Pure drag-ordering gets unusable past ~20 items on a phone.
**c.** When something is bought — delete, or archive to a "Got it" view?
> **Recommended:** archive. The purchase history is the most interesting data this will produce,
> and it costs one status value.

### 3. Screenshot fallback
For v1, is a screenshot just an image she attaches (typing name and price herself), or should the
app read the price *out of* the image?
> **Recommended:** attach-only. Vision extraction is a real feature with a real accuracy problem —
> good v1.1, bad Saturday.

### 4. Look and feel
*Named: **Dream Machine**, banking and budgeting. Icon label is "Dream Machine". Visual direction:
Depop — see the Visual direction section in Part A. Dark mode: yes, following the phone.*

**c.** Still open: **is she reviewing this before it ships, or is it a surprise?** The mockup now
exists either way — the question is only whether she sees it before the build starts.

### 5. Privacy
**a.** Confirm: no analytics, no third-party scripts, no error-reporting service that receives item
content.
> **Recommended:** confirm. Part A assumes it.
**b.** The link model means the app URL is reachable by anyone who has it. Want a second gate
(Netlify password protection on the whole site) on top, or is the token enough?
> **Recommended:** token is enough given rotation exists, but it's a checkbox in Netlify if you'd
> rather have both.
**c.** Retention — does anything ever get deleted?
> **Recommended:** accumulate for v1; it's tiny. Worth revisiting when she's 18 and it becomes her
> data to decide about.

### 6. Scope
**a.** Anything in the Non-goals list that's actually a must-have? Notifications is the likely one
— "tell me when she adds something" is a reasonable parent ask.
> **Recommended:** if you want it, a daily email digest is far cheaper than push and gets most of
> the value.

*Answered: clickable mockup first — built, see below.*

---

## The mockup

`docs/prototype/dream-machine-prototype.html` — a single self-contained file, no build step, no
backend. Open it in a phone browser and it behaves like the app: switch buckets, add an item by
pasting a link (try a `sephora` or `depop` URL for the auto-fill, an `instagram` one for the
silent fallback), deposit savings, move money onto a Goal, then flip to the parent view to
approve and pledge. State is in memory and Reset restores it.

It is a **behavior** prototype, not just screens: the money rules are live, so allocating more
than her balance is refused, pulling money back off a Goal restores it, and over-pledging turns
the pot red. That is the fastest way to check the model is right before any of it is real.

Two things it deliberately fakes: product photos are drawn stand-ins rather than scraped images,
and "scraping" is a lookup table with four known sites. Everything else is the real design.

### What building it changed in the spec above

- **The parent request queue is not truncated.** It first showed only the four oldest open items,
  which meant Goals — the ones needing a pledge decision — could sit permanently below the cut.
- **The no-image tile has to scale.** The same treatment appears at grid size and at thumbnail
  size, so its type is sized in container units rather than pixels; at a fixed size it overflowed
  its own tile in the smaller slots.
- **A tile that carries its own name doesn't repeat it underneath.** The no-image treatment sets
  the name large inside the tile, so the caption below it drops to price and source only.
- **The no-image treatment becomes a monogram at thumbnail size.** Sized in container units, the
  full name renders around 5px wide in a 42px list thumbnail — unreadable. Below roughly 80px the
  tile shows a single large initial instead, which looks deliberate rather than broken.
- **Deleting an item has to settle its money** (see the ledger rules above). This only became
  obvious once the list view made deletion a one-tap action.
