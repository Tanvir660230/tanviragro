-- ================================================================
-- Tanvir Agro ERP — Smart Inventory: Recipes, Supplements, Medicine
-- ================================================================

-- ── Feed Recipes ──────────────────────────────────────────────────
-- A named formula that produces a batch of mixed feed
-- e.g. "Fattening Mix 100kg" = 60kg Wheat Bran + 30kg Rice Polish + 10kg Soybean
create table feed_recipes (
  id          uuid primary key default uuid_generate_v4(),
  business_id uuid references businesses(id) on delete cascade,
  name        text not null,
  output_qty  numeric(10,2) not null default 100,
  output_unit text not null default 'kg',
  notes       text,
  created_at  timestamptz not null default now()
);

-- ── Recipe Ingredients ────────────────────────────────────────────
-- Each row = one ingredient line in the recipe
create table recipe_ingredients (
  id             uuid primary key default uuid_generate_v4(),
  recipe_id      uuid references feed_recipes(id) on delete cascade,
  item_id        uuid references inventory_items(id) on delete restrict,
  qty_per_batch  numeric(10,3) not null check (qty_per_batch > 0),
  created_at     timestamptz not null default now()
);

-- ── Supplement Rules ──────────────────────────────────────────────
-- "For every 100 [unit] of feed_item consumed, also consume qty_per_100 of supplement_item"
-- e.g. per 100kg Fattening Mix → 500g Vitamin Premix
create table supplement_rules (
  id                 uuid primary key default uuid_generate_v4(),
  business_id        uuid references businesses(id) on delete cascade,
  feed_item_id       uuid references inventory_items(id) on delete cascade,
  supplement_item_id uuid references inventory_items(id) on delete cascade,
  qty_per_100        numeric(10,4) not null check (qty_per_100 > 0),
  created_at         timestamptz not null default now(),
  unique(feed_item_id, supplement_item_id)
);

-- ── Medicine Protocols ────────────────────────────────────────────
-- Dosing rules attached to a medicine inventory item
-- dose_per_100kg_weight: how many [unit] per 100kg of animal body weight
-- frequency_days: repeat interval (null = one-time / as-needed)
create table medicine_protocols (
  id                    uuid primary key default uuid_generate_v4(),
  item_id               uuid references inventory_items(id) on delete cascade,
  dose_per_100kg_weight numeric(10,4) not null check (dose_per_100kg_weight > 0),
  frequency_days        integer check (frequency_days > 0),
  notes                 text,
  created_at            timestamptz not null default now(),
  unique(item_id)
);

-- ── Row Level Security ────────────────────────────────────────────
alter table feed_recipes       enable row level security;
alter table recipe_ingredients enable row level security;
alter table supplement_rules   enable row level security;
alter table medicine_protocols enable row level security;

create policy "feed_recipes in own business"
  on feed_recipes for all using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

create policy "recipe_ingredients in own business"
  on recipe_ingredients for all using (
    recipe_id in (
      select r.id from feed_recipes r
      join businesses b on r.business_id = b.id
      where b.owner_id = auth.uid()
    )
  );

create policy "supplement_rules in own business"
  on supplement_rules for all using (
    business_id in (select id from businesses where owner_id = auth.uid())
  );

create policy "medicine_protocols for own items"
  on medicine_protocols for all using (
    item_id in (
      select i.id from inventory_items i
      join businesses b on i.business_id = b.id
      where b.owner_id = auth.uid()
    )
  );
