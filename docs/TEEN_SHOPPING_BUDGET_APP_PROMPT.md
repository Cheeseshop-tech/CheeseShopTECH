# Teen Shopping Budget App — Build Prompt + Open Questions

**Status:** PROMPT + DECISION SHEET. No app code written yet.
**Prepared by:** Claude Code, at the request of Rick Posada
**Date:** 2026-08-19 (rev. 2 — access model, budget model, and fallback UI decided)
**Input doc:** "Teen Shopping Budget App — Spec" (chat-prepared, same date)

Two things live here:

- **Part A — The Build Prompt.** Self-contained. Paste it into a fresh Claude Code session
  and it can build v1 without re-reading the original spec.
- **Part B — Questions for Rick.** What Part A still assumes. Answered items are recorded at the
  top of Part B; the rest carry recommended defaults, so you can reply
  `defaults, except 5b` and the build starts.

## Decisions locked in rev. 2

| Decision | Answer |
|---|---|
| Auto-filled vs. manually-entered items | Look identical. No badge, no failure styling. |
| Access | One simple shared link per person. No accounts, no passwords. |
| Goals funding | A single shared pot of parent money, entered by the parents. |
| Her savings | Tracked separately per Goal, alongside parent money. |
| Parent actions | Approve/decline, set the pot, and pledge to specific Goals. |

Those last three interlock, so state the relationship plainly: **the pot is the ceiling, pledges
are allocations out of it.** Parents enter one number (say $300). Pledging $80 toward the boots
draws that $80 down, leaving $220 unallocated. Her own saved money is a separate track that never
touches the pot. That is what keeps "budget" and "pledges" from becoming two systems that
disagree.

---

# Part A — The Build Prompt

> Copy from here to the end of Part A.

## Context

Build a mobile-first web app for a 15-year-old to catalog things she wants to buy, sorted into
Needs / Wants / Goals, with a linked parent view where her parents can approve items, fund a
shared savings pot, and pledge from it toward specific Goals. It is a private family app — three
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
  display_name  text  -- 'Ella' | 'Mom' | 'Dad' — used for attribution
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

contributions          -- the money ledger; progress is derived, never stored as a total
  id            uuid
  item_id       uuid -> items.id
  link_id       uuid -> access_links.id   -- who did it, for attribution
  source        text  -- 'teen' | 'parent'
  kind          text  -- 'saved' (her money) | 'pledged' (an allocation from the pot)
  amount_cents  int
  fulfilled_at  timestamptz  -- pledges only: set when the money actually changes hands
  note          text
  created_at    timestamptz
```

**Derived figures — compute these, never store them:**

- Goal progress = `sum(saved) + sum(pledged)` over `price_cents`, rendered as two segments so her
  money and parent money stay visually distinct.
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
- Card: image thumbnail left, name + price + source site right, priority dot, status pill (only
  when not `open`). Tap → Item Detail. Swipe → quick actions (change bucket, mark purchased,
  delete).
- **Auto-filled and manually-entered items are visually identical.** No badge, no icon, no
  differing styling anywhere in the app. `entry_method` is recorded for diagnostics only.
- Within a section, sort by `priority` then `sort_order`; drag-to-reorder within a priority band.
- Section header shows a running total of open items in that bucket. The Goals header also shows
  the pot's remaining balance.
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
  hatched), amount remaining, and "+ Add savings" writing a `contributions` row.
- History strip: when it was added, and any parent actions taken, attributed by name.

**4. Parent View** (same app, parent token)
- Header: **the pot** — total budget (tap to edit), amount allocated, amount unallocated. This is
  the primary parent-facing number.
- Same three buckets, read-only, plus per item: **Approve**, **Decline**, and on Goals,
  **Pledge $__** (drawing from the pot) and a checkbox to mark a pledge fulfilled.
- "New since you last looked" filter, driven by `access_links.last_seen_at`.
- Household totals: open request value by bucket, pledged vs. fulfilled, total purchased.

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

## Non-goals for v1 (state these back if asked to add them)

Push notifications. Native apps / app store. Offline mode. Price-drop tracking. Accounts,
passwords, or email. Multiple households. Sharing outside the family. Analytics or third-party
tracking of any kind — this is a minor's data; keep it to Supabase and nothing else. Payments.
Chores/allowance tracking. Retailer affiliate links.

## Acceptance criteria for v1

1. Opening her link on her phone installs to the home screen, opens chromeless, and works
   thereafter without the link — token persisted, URL hash cleared.
2. Pasting a Sephora product URL fills name, price, and image in under 8 seconds.
3. Pasting a URL from a site that blocks scraping produces an ordinary empty form with no error
   surface, and the saved item is indistinguishable from an auto-filled one anywhere in the app.
4. Items land in the right bucket and can be re-bucketed and reordered by drag on touch.
5. Parents set the pot to $300; a $80 pledge on one Goal shows $220 unallocated; the Goal's bar
   shows her savings and the pledge as separate segments, with the pledge hatched until fulfilled.
6. A parent token calling the item create/edit/delete endpoints directly gets 403 — verified with
   curl against the deployed Functions, not by checking that the button is hidden.
7. Rotating links from a parent token invalidates all previous links immediately; the old link
   shows the "no longer valid" screen.
8. A change on one device appears on the other within ~30s, or immediately on refocus.
9. Tested at 390px wide (iPhone viewport) with no horizontal scroll anywhere.

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

## Still open

### 1. Money mechanics
**a.** Does the pot ever refill on a schedule, or do you just top it up by hand when it runs low?
> **Recommended:** top up by hand. A recurring reset needs a rollover rule and date handling, which
> is real work for a number you'll edit six times a year.
**b.** When she marks a Goal purchased, do the pledges against it get consumed (pot stays down) or
released back to the pot?
> **Recommended:** consumed — the money was spent. But confirm, because the opposite is defensible
> if a pledge sometimes goes unspent.
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
**a.** What should it be called? It shows under the home screen icon.
**b.** Style direction — a screenshot of an app she likes beats any adjective here.
**c.** Is she reviewing this before it ships, or is it a surprise? Changes how much I guess at.
**d.** Dark mode following the phone's setting?
> **Recommended:** yes. Cheap if done from the start, annoying to retrofit.

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
**b.** Build v1 straight from your answers, or produce a clickable mockup first for her to react to
before any backend work?
