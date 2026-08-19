# Dream Machine

Banking and budgeting for a teenager. Three people, three links, no accounts.

She catalogs things she wants across **Needs**, **Wants**, and **Goals**, banks money she
earns into a savings balance and puts it toward goals; her parents fund one shared pot,
approve items, and pledge from the pot toward specific goals.

- `docs/DREAM_MACHINE_APP_PROMPT.md` (repo root) — the spec and every decision behind it.
- `docs/prototype/dream-machine-prototype.html` — the clickable mockup, no backend.

## What you need

Four free accounts. **Put every key into Netlify's environment variables — never into a
file in this repo.** Nothing here is `VITE_`-prefixed on purpose: anything with that prefix
is compiled into the browser bundle, where a key is readable by anyone.

| Variable | From | Needed? |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API | Yes |
| `FIRECRAWL_API_KEY` | firecrawl.dev | Optional — see *Reading links* |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary dashboard | Recommended |
| `CLOUDINARY_UPLOAD_PRESET` | Cloudinary → Settings → Upload | Only for photo upload |

## Setting it up

1. **Database.** In Supabase → SQL Editor, run `supabase/migrations/0001_init.sql`.
2. **Deploy.** Point Netlify at this repo with base directory `app/`. Paste the variables
   above into Site configuration → Environment variables. Deploy.
3. **Mint the links.** Locally, with the two Supabase variables set:

   ```
   SITE_URL=https://your-site.netlify.app \
   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
   npm run mint -- "Posada" Bella Mom Dad
   ```

   It prints one link per person. Send each person only their own — the link *is* the
   identity. Tokens are stored only as SHA-256 hashes, so this is the one time they exist.
4. **Install.** Each person opens their link once, then Share → Add to Home Screen.
   The token moves into local storage and the URL is cleaned, so it never sits in the
   address bar or in Safari's history.

If a link is ever forwarded or screenshotted, any parent can **Rotate every link** from the
parent view. Old links stop working immediately.

## Reading links

`/api/scrape` tries the cheap thing first: a plain fetch that reads Open Graph and
schema.org markup, which most retailers publish. Firecrawl is the fallback for pages that
come back thin or refuse the request. Without `FIRECRAWL_API_KEY` the app still works —
it just falls back to typing more often.

Roughly one add in five will come back empty (Instagram shops, some fast-fashion apps).
That is a designed-for path: the endpoint always returns 200 with empty fields, and the
form looks exactly as it does when she types from scratch. **Never make a failed read
show an error** — it reads as her mistake, and it is not.

## Images

Photos are re-served through Cloudinary's fetch delivery rather than hotlinked: retailer
CDNs block hotlinking and expire URLs, so a hotlinked list quietly breaks a month later.
Fetch also applies the uniform 4:5 crop the grid depends on.

Cloudinary must allow fetch from any origin — Settings → Security → *Allowed fetch
domains*, left empty for all. Without `CLOUDINARY_CLOUD_NAME` the app falls back to the
retailer's own URL, which works until it doesn't.

Items with no image are not blank: the name is set as the picture, shrinking to a monogram
at thumbnail size.

## The share sheet (iOS)

So she never has to leave the shop. Build a Shortcut:

1. New Shortcut → **Get URLs from Input** (accepts URLs, show in Share Sheet: on).
2. **Get Contents of URL** → `https://your-site.netlify.app/api/share`
   - Method `POST`, Header `x-dm-token` = *her token* (the part after `#t=` in her link)
   - Request Body JSON: `url` = the URL from step 1, `bucket` = `want`
3. Name it "Add to Dream Machine".

Now: Share → Add to Dream Machine, from anywhere, without opening the app. Rotating links
invalidates the Shortcut too — update its header afterwards.

On Android the same endpoint is reachable from the manifest's `share_target`; no Shortcut
needed.

## Development

```
npm install
npm run build          # typecheck + bundle
npm run dev            # netlify dev, functions included (needs the env vars)
npm run dev:web        # vite only, no functions
npx tsc -p tsconfig.functions.json   # typecheck the serverless functions
node scripts/make-icons.mjs          # regenerate the home-screen icons
```

## How the money works

Every total is derived from one ledger; nothing is stored as a running balance, because a
stored total drifts.

- **Her balance** = deposits − allocations. Only deposits add; only allocations spend.
- **Money on a goal** = her allocations and direct entries, plus parent pledges.
- **Pot remaining** = the pot − everything pledged.

Two deliberate asymmetries:

- **Allocating more than she has is refused.** Her balance is money that exists or doesn't.
- **Pledging more than the pot is allowed**, and shows the pot over-allocated in red. A
  parent may promise their own kid money; the app's job is to say so, not to veto it.

**Deleting an item settles its money** rather than orphaning it: her allocations return to
her balance, her direct-to-goal entries become deposits (that money never passed through
the balance and would otherwise vanish), and pledges free up the pot. The confirmation says
the amounts before anything happens.

## Security notes, honestly

- Anyone holding a link is that person. That is the trade the link model makes, and
  rotation is what makes it acceptable.
- Permissions are enforced in the functions, not the UI. A parent token calling the item
  endpoints gets a 403; hiding a button is not a permission.
- Row Level Security is enabled on every table with **no policies**, so anon and
  authenticated roles are denied outright. Only the service key (server-side) reads.
- The failed-token throttle lives in instance memory, so it only covers one warm function
  instance. At three users that is a reasonable trade; a shared counter table is the
  upgrade if this ever stops being a family app.
- No analytics, no third-party scripts, no error reporting. This is a minor's data.
