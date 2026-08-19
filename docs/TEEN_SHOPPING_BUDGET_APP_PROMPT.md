# Teen Shopping Budget App — Build Prompt + Open Questions

**Status:** PROMPT + DECISION SHEET. No app code written yet.
**Prepared by:** Claude Code, at the request of Rick Posada
**Date:** 2026-08-19
**Input doc:** "Teen Shopping Budget App — Spec" (chat-prepared, same date)

Two things live here:

- **Part A — The Build Prompt.** Self-contained. Paste it into a fresh Claude Code session
  and it can build v1 without re-reading the original spec.
- **Part B — Questions for Rick.** Everything Part A had to assume. Each question carries a
  recommended default, so you can reply `defaults, except 3b and 7` and the build starts.

Part A is written against the defaults in Part B. Change a default, change Part A.

---

# Part A — The Build Prompt

> Copy from here to the end of Part A.

## Context

Build a mobile-first web app for a 15-year-old to catalog things she wants to buy, sorted into
Needs / Wants / Goals, with a linked parent view where her parents can approve items or pledge
money toward them. It is a private family app — two to three known users, no signups, no public
listing, no growth features. Target: a working v1 in a weekend of focused build time.

Primary user is on an iPhone in Safari, adding items while browsing Sephora, Depop, and
boutique Instagram shops. Every design decision resolves toward "fast to add an item on a phone,
one-handed." The parent view is secondary and can be plainer.

## Stack (decided — do not re-litigate unless something is genuinely blocked)

- **Front end:** React + Vite, TypeScript, single-page app. Tailwind for styling. No component
  library — the surface is small enough that hand-rolled cards and a bottom tab bar are less
  work than adapting one.
- **PWA:** web app manifest + `apple-touch-icon` so it installs to the iOS home screen and opens
  chromeless. No service worker / offline mode in v1 (see Non-goals).
- **Backend:** Supabase — Postgres, Auth (email magic link), Row Level Security, and Realtime for
  the parent view staying in sync. No custom server.
- **Scraping:** Firecrawl, called from a **Netlify Function** (`/api/scrape`), never from the
  browser. The Firecrawl key must not ship in client JS.
- **Images:** scraped image URLs are re-hosted via Cloudinary fetch/upload rather than hotlinked —
  retailer CDNs hotlink-block, expire URLs, and break the list a month later. Uploaded
  screenshots go to the same place.
- **Hosting:** Netlify (matches existing CheeseShop TECH deploys). Free tier is sufficient.

Environment variables (`.env`, never committed): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`FIRECRAWL_API_KEY`, `CLOUDINARY_URL`. Commit a `.env.example` with the keys and no values.

## Data model

```
profiles
  id            uuid  (= auth.users.id)
  display_name  text
  role          text  -- 'teen' | 'parent'
  household_id  uuid

items
  id            uuid
  household_id  uuid
  created_by    uuid  -> profiles.id
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
  entry_method  text  -- 'auto' | 'manual' | 'screenshot'
  status        text  -- 'open' | 'approved' | 'declined' | 'purchased' | 'archived'
  created_at    timestamptz
  updated_at    timestamptz

contributions          -- the money ledger; Goals progress is derived, never stored as a total
  id            uuid
  item_id       uuid -> items.id
  contributor   uuid -> profiles.id
  source        text  -- 'teen' | 'parent'
  kind          text  -- 'saved' | 'pledged'
  amount_cents  int
  note          text
  created_at    timestamptz
```

**Progress on a Goal is always computed** as `sum(contributions.amount_cents) / price_cents`,
broken out by `source` so "I saved $40, Dad pledged $60" renders as two segments of one bar.
Never write a running total to `items` — it will drift.

**RLS:** every row is scoped by `household_id`. A user reads and writes only rows in their own
household. Additionally: `role = 'parent'` may not INSERT, UPDATE, or DELETE `items` (they can
only change `status` and add `contributions`); `role = 'teen'` may not edit or delete a parent's
`contributions`. Enforce this in policies, not just in the UI.

## Screens

**1. My List** (default screen, teen)
- Three sections — Needs, Wants, Goals — as a segmented control at top; content is a single
  vertical scroll of cards. Vertical cards only; no horizontal carousels, no timeline/Gantt views.
- Card: image thumbnail left, name + price + source site right, priority dot, status pill
  (only when not `open`). Tap the card → Item Detail. Long-press or swipe → quick actions
  (change bucket, mark purchased, delete).
- Within a section, sort by `priority` then `sort_order`; manual drag-to-reorder within a priority
  band.
- Section header shows a running total of open items in that bucket.
- Empty states matter here — an empty Goals tab should say what a Goal is and offer "Add one."

**2. Add Item** (a full-screen sheet from a persistent `+` button)
- Top field: paste a product link. On paste, immediately show the card in a "fetching…" skeleton
  state and call `/api/scrape`. Do not make her wait on a spinner before she can type.
- Auto-fill returns name, price, image, source site. Every field stays editable — treat scraped
  values as a first draft, not truth.
- If scraping fails or returns junk, fall back **in place**: the same form, all fields empty and
  editable, plus a quiet inline note ("Couldn't read that site — fill it in yourself") and an
  "Add a screenshot" button. Same form either way; the only difference is one line of copy and a
  small `entry_method` badge on the saved card. Do not route her to a different screen.
- Required to save: name + bucket. Everything else optional.
- Bucket picker, priority picker, notes.

**3. Item Detail**
- Full image, name, price, source link (opens the original), notes, bucket, priority, status.
- For Goals only: progress bar (teen-saved vs. parent-pledged segments), amount remaining, and
  a "+ Add savings" action that writes a `contributions` row.
- History strip: who added it, when, and any parent actions taken.

**4. Parent View**
- Same three buckets, read-only by default, plus per item: **Approve**, **Decline**, and
  **Pledge $__**. Approving does not move money; it is a signal.
- A "New since you last looked" badge/filter — the parent's job is scanning what changed.
- Household totals: open request value by bucket, total pledged, total already purchased.

## Scraping behavior (`/api/scrape`)

- Input: a URL. Output: `{ name, price_cents, currency, image_url, source_site, confidence }`.
- Firecrawl scrape with a JSON extraction schema for those fields. Prefer Open Graph and
  `schema.org/Product` markup when present; fall back to Firecrawl's extraction.
- Handle: request timeout (8s hard cap — she is on cellular and will not wait), non-200, blocked
  domains, missing price, and currency symbols other than `$`.
- **Never fail loudly.** Any failure returns 200 with empty fields and `confidence: 0`; the client
  renders the manual form. A scraping error must never cost her the item.
- Cache by normalized URL for 24h so re-pasting the same link is free.
- Expect ~10–20% failure — Instagram Shops and some fast-fashion apps block scraping. That is
  the designed-for path, not the error path.

## Non-goals for v1 (state these back if asked to add them)

Push notifications. Native apps / app store. Offline mode. Price-drop tracking. Multiple
households or any tenancy beyond this one family. Sharing outside the family. Analytics or
third-party tracking of any kind — this is a minor's data; keep it to Supabase and nothing else.
Payments. Chores/allowance tracking. Retailer affiliate links.

## Acceptance criteria for v1

1. Teen signs in on her phone, installs to home screen, and the app opens chromeless.
2. Pasting a Sephora product URL fills name, price, and image in under 8 seconds.
3. Pasting a URL from a site that blocks scraping leaves her on the same form with a usable
   manual fallback, and the saved item is indistinguishable in quality from an auto-filled one.
4. Items land in the right bucket and can be re-bucketed and reordered by drag on touch.
5. A Goal shows a two-segment progress bar and updates when either party adds money.
6. A parent signing in sees every item, can approve and pledge, and cannot add, edit, or delete
   items — verified against RLS policies with the parent's token, not just the UI.
7. A change on one device appears on the other within a few seconds without a manual refresh.
8. Tested at 390px wide (iPhone viewport) with no horizontal scroll anywhere.

## Deliverables

Working app deployed to Netlify. `README.md` covering local setup, env vars, Supabase schema +
RLS SQL (checked into `supabase/migrations/`), and how to add the second parent account. Seed
script with a handful of realistic items so the UI can be reviewed before real data exists.

> End of build prompt.

---

# Part B — Questions for Rick

Reply inline, or just say "defaults" and note the exceptions.

### 1. Access & accounts
**a.** Parent access — separate login, or a shareable link?
*(This is open question #2 in your spec.)*
> **Recommended:** separate logins via emailed magic link. A shareable link that can approve
> spending and disclose a minor's shopping list is a link that can be forwarded, screenshotted,
> or found in a group chat. Magic links are ~30 extra minutes of build time and there is no
> password for anyone to lose.

**b.** How many parent accounts — you and your wife separately, or one shared parent login?
> **Recommended:** two separate accounts, so pledges are attributed ("Mom pledged $30").

**c.** Should your daughter see *who* approved or pledged, or just that it happened?
> **Recommended:** show who. It is the interesting part.

### 2. The manual-entry fallback
*(Your open question #1.)*
**a.** Should a manually-entered item look different from an auto-filled one?
> **Recommended:** identical form, one quiet inline note when scraping fails, and a small badge
> on the saved card. She needs to know the app tried and failed — otherwise it reads as broken —
> but the item itself shouldn't feel second-class.

**b.** Screenshot fallback: for v1, is the screenshot just an image she attaches (and she types
the name/price), or do you want the app to read the price *out of* the screenshot?
> **Recommended:** attach-only for v1. Vision extraction from screenshots is a real feature with
> a real accuracy problem; it is a great v1.1 and a bad way to spend your Saturday.

### 3. Goals and money
*(Your open question #3.)*
**a.** Confirm: Goals track daughter-saved and parent-pledged separately on the same item?
> **Recommended:** yes — the ledger model in Part A handles it, and it is the same work either way.

**b.** Is a parent pledge a *promise* or *money actually handed over*? Do you need to mark a
pledge as "paid"?
> **Recommended:** v1 treats it as a promise, with a checkbox to mark it fulfilled. Without that,
> the progress bar quietly lies about how much money exists.

**c.** Can she log savings that aren't tied to any specific item — a general balance she then
allocates?
> **Recommended:** no for v1. It turns a wishlist into an accounting app.

### 4. Buckets and priority
*(Your open question #4.)*
**a.** Any split within Needs — recurring (restocks) vs. one-time?
> **Recommended:** not as a bucket. Add a `recurring` flag on the item in v1.1 once you see
> whether restocks actually pile up. Adding a fourth bucket now costs UI everywhere.

**b.** How should priority work — a 3-level picker (must have / would like / someday), star
rating, or pure drag-to-reorder?
> **Recommended:** 3-level picker plus drag within a level. Pure drag-ordering gets unusable past
> ~20 items on a phone.

**c.** When something is bought — delete, or archive to a "Got it" view?
> **Recommended:** archive. The purchase history is the most interesting data this app will
> produce, and it costs one status value.

### 5. Money details
**a.** Should prices include tax/shipping, or is sticker price fine?
> **Recommended:** sticker price. One number, entered once.
**b.** Any spending limits or budget ceilings per bucket (e.g. "Needs under $50/month")?
> **Recommended:** none in v1 — the spec is a wishlist, not a budget enforcer. Say the word if
> you want a monthly cap with a progress meter, it's a contained addition.
**c.** USD only, or does resale/vintage shopping pull in other currencies?
> **Recommended:** USD only; the schema carries a currency field so it isn't a rewrite later.

### 6. Look and feel
**a.** What should it be called? It shows on her home screen icon.
**b.** Any style direction — clean/minimal, soft pastel, something closer to her own taste? A
screenshot of an app she likes is worth more than adjectives here.
> **Recommended:** ask her, not me. Also: is she a reviewer on this before it ships, or is it a
> surprise? That changes how much I guess at.
**c.** Dark mode?
> **Recommended:** yes, follow the phone's setting. It's cheap if done from the start.

### 7. Privacy — worth a deliberate answer
This is a minor's shopping and spending data on the open internet.
**a.** Confirm no analytics, no third-party scripts, no error-reporting service that receives
item content.
> **Recommended:** confirm. Part A assumes this.

**b.** Should the app be reachable at a guessable URL (a Netlify subdomain, unlisted but public)
with auth as the only gate — or do you want it behind a second gate (Netlify password protection
or IP-limited)?
> **Recommended:** auth-only is fine given RLS is correct, but say if you'd rather have belt and
> suspenders.

**c.** Data retention: is anything ever deleted, or does it accumulate forever?
> **Recommended:** accumulate for v1; it's tiny. Worth revisiting when she turns 18 and it
> becomes her data to decide about.

### 8. Scope check
**a.** Is anything in the Non-goals list actually a must-have? (Notifications is the likely one —
"tell me when she adds something" is a reasonable parent ask.)
> **Recommended:** if you want that, email-on-new-item is far cheaper than push and gets you 90%
> of the value.
**b.** Do you want me to build v1 straight from your answers, or produce a clickable UI mockup
first for her to react to before any backend work?

