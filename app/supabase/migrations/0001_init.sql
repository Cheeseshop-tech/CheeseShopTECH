-- Dream Machine — schema.
-- Every row is reached only through the Netlify Functions using the service key.
-- RLS is enabled with NO policies on purpose: that denies anon and authenticated
-- roles outright, so a leaked publishable key yields nothing. The service role
-- bypasses RLS, which is why the functions still work.

create extension if not exists pgcrypto;

create table households (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  goal_budget_cents integer not null default 0,   -- the pot: parent money for Goals
  updated_at        timestamptz not null default now()
);

create table access_links (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  token_hash    text not null unique,             -- sha256 of the token; the token itself is never stored
  role          text not null check (role in ('teen','parent')),
  display_name  text not null,
  revoked_at    timestamptz,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index on access_links (household_id);

create table items (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  bucket        text not null check (bucket in ('need','want','goal')),
  name          text not null,
  price_cents   integer,
  currency      text not null default 'USD',
  image_url     text,
  source_url    text,
  source_site   text,
  notes         text,
  priority      integer not null default 2 check (priority between 1 and 3),
  sort_order    double precision not null default 0,
  entry_method  text not null default 'manual' check (entry_method in ('auto','manual','screenshot')),
  status        text not null default 'open' check (status in ('open','approved','declined','purchased','archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on items (household_id, bucket, priority, sort_order);

create table contributions (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  item_id       uuid references items(id) on delete cascade,
  link_id       uuid references access_links(id) on delete set null,
  source        text not null check (source in ('teen','parent')),
  kind          text not null check (kind in ('deposit','allocate','direct','pledged')),
  amount_cents  integer not null,
  fulfilled_at  timestamptz,
  note          text,
  created_at    timestamptz not null default now(),

  -- a deposit is the only entry not tied to an item; everything else must name one
  constraint deposit_has_no_item check ((kind = 'deposit') = (item_id is null)),
  constraint teen_kinds check (source <> 'teen' or kind in ('deposit','allocate','direct')),
  constraint parent_kinds check (source <> 'parent' or kind = 'pledged')
);
create index on contributions (household_id, item_id);

alter table households    enable row level security;
alter table access_links  enable row level security;
alter table items         enable row level security;
alter table contributions enable row level security;
