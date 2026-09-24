-- ============================================================================
-- Configurable expense categories (utilities first) + audited cost entries.
-- Rollback: supabase/rollback/20260925110000_expense_categories_down.sql
--
-- * expense_categories: per-business, admin-managed list. `kind` decides the accounting
--   account, so a renamed category never changes where its expenses are booked.
--   Categories are disabled, never deleted (history keeps pointing at them).
-- * cost_entries.category_id links an expense to a category; the old free-text
--   `category` stays for existing rows and reports.
-- * cost_entry_audit: every insert/update of a cost entry (incl. soft delete) is logged
--   by a trigger with the old and new row — edits are corrections, not silent rewrites.
-- * data_correction_audit: generic audit for one-off data corrections outside the ledger.
-- * Optional bill/invoice attachment (private storage bucket, one folder per business).
-- Additive and idempotent.
-- ============================================================================
begin;

-- ── 1. Categories ────────────────────────────────────────────────────────────
create table if not exists public.expense_categories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind        text not null check (kind in ('utility','labor','rent','transport','repair','veterinary','general')),
  name        text not null check (length(btrim(name)) between 1 and 80),
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);
create unique index if not exists uq_expense_categories_name
  on public.expense_categories (business_id, kind, lower(btrim(name)));
create index if not exists idx_expense_categories_biz on public.expense_categories (business_id, kind, is_active);

comment on column public.expense_categories.kind is
  'Accounting group: utility → 6300 Utilities, labor → 6200, rent → 6400, transport → 6700, repair → 6800, veterinary → 6100, general → 6600';

alter table public.expense_categories enable row level security;
drop policy if exists "expense categories readable by tenant" on public.expense_categories;
create policy "expense categories readable by tenant" on public.expense_categories
  for select using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
      union
      select business_id from public.business_users where user_id = auth.uid() and coalesce((to_jsonb(business_users) ->> 'is_active')::boolean, true)
    )
  );
drop policy if exists "expense categories managed by tenant" on public.expense_categories;
create policy "expense categories managed by tenant" on public.expense_categories
  for insert with check (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
      union
      select business_id from public.business_users where user_id = auth.uid() and coalesce((to_jsonb(business_users) ->> 'is_active')::boolean, true)
    )
  );
drop policy if exists "expense categories updated by tenant" on public.expense_categories;
create policy "expense categories updated by tenant" on public.expense_categories
  for update using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
      union
      select business_id from public.business_users where user_id = auth.uid() and coalesce((to_jsonb(business_users) ->> 'is_active')::boolean, true)
    )
  );
-- no delete policy: categories are disabled, never deleted

create or replace function public.trg_expense_categories_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_expense_categories_touch on public.expense_categories;
create trigger trg_expense_categories_touch before update on public.expense_categories
  for each row execute function public.trg_expense_categories_touch();

-- default utility categories for every business (existing and new)
create or replace function public.seed_default_expense_categories(p_business_id uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.expense_categories (business_id, kind, name, sort_order, created_by)
  select p_business_id, 'utility', v.name, v.ord, null
  from (values ('Electricity', 1), ('WiFi / Internet', 2), ('Gas', 3), ('Water', 4), ('Telephone', 5), ('Other utilities', 9)) v(name, ord)
  on conflict do nothing
$$;
revoke all on function public.seed_default_expense_categories(uuid) from public, anon, authenticated;

select public.seed_default_expense_categories(id) from public.businesses;

create or replace function public.trg_businesses_seed_categories() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform public.seed_default_expense_categories(new.id); return new; end $$;
drop trigger if exists trg_businesses_seed_categories on public.businesses;
create trigger trg_businesses_seed_categories after insert on public.businesses
  for each row execute function public.trg_businesses_seed_categories();

-- ── 2. Link cost entries to categories; optional attachment ───────────────────
alter table public.cost_entries
  add column if not exists category_id     uuid references public.expense_categories(id),
  add column if not exists attachment_path text;
create index if not exists idx_cost_entries_category on public.cost_entries (category_id);

-- a cost entry may only use a category of its own business
create or replace function public.trg_cost_entries_category_check() returns trigger language plpgsql as $$
begin
  if new.category_id is not null and not exists (
       select 1 from public.expense_categories c where c.id = new.category_id and c.business_id = new.business_id) then
    raise exception 'Expense category does not belong to this business' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_cost_entries_category_check on public.cost_entries;
create trigger trg_cost_entries_category_check before insert or update of category_id, business_id on public.cost_entries
  for each row execute function public.trg_cost_entries_category_check();

-- ── 3. Audit of every cost entry change ───────────────────────────────────────
create table if not exists public.cost_entry_audit (
  id            uuid primary key default gen_random_uuid(),
  cost_entry_id uuid not null,
  business_id   uuid not null,
  action        text not null check (action in ('insert','update','soft_delete','restore')),
  old_row       jsonb,
  new_row       jsonb,
  changed_by    uuid default auth.uid(),
  changed_at    timestamptz not null default now()
);
create index if not exists idx_cost_entry_audit_entry on public.cost_entry_audit (cost_entry_id, changed_at);
alter table public.cost_entry_audit enable row level security;
drop policy if exists "cost entry audit readable by tenant" on public.cost_entry_audit;
create policy "cost entry audit readable by tenant" on public.cost_entry_audit
  for select using (
    business_id in (
      select id from public.businesses where owner_id = auth.uid()
      union
      select business_id from public.business_users where user_id = auth.uid() and coalesce((to_jsonb(business_users) ->> 'is_active')::boolean, true)
    )
  );
-- written only by the trigger (security definer); no insert/update/delete policies

create or replace function public.trg_cost_entries_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'insert';
  elsif old.deleted_at is null and new.deleted_at is not null then
    v_action := 'soft_delete';
  elsif old.deleted_at is not null and new.deleted_at is null then
    v_action := 'restore';
  else
    if to_jsonb(old) = to_jsonb(new) then return new; end if;
    v_action := 'update';
  end if;
  insert into public.cost_entry_audit (cost_entry_id, business_id, action, old_row, new_row)
  values (new.id, new.business_id, v_action, case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new));
  return new;
end $$;
drop trigger if exists trg_cost_entries_audit on public.cost_entries;
create trigger trg_cost_entries_audit after insert or update on public.cost_entries
  for each row execute function public.trg_cost_entries_audit();

-- ── 4. Generic audit for one-off data corrections (outside the inventory ledger) ──
create table if not exists public.data_correction_audit (
  id               uuid primary key default gen_random_uuid(),
  correction_batch text not null,
  table_name       text not null,
  row_id           uuid not null,
  field            text not null,
  old_value        text,
  new_value        text,
  reason           text not null,
  evidence         text,
  created_at       timestamptz not null default now(),
  created_by       uuid default auth.uid()
);
create index if not exists idx_data_correction_audit_row on public.data_correction_audit (table_name, row_id);
alter table public.data_correction_audit enable row level security;
-- readable by service role / SQL editor only (it can reference several tables)

-- ── 5. Private bucket for bills (only where Supabase storage exists) ──────────
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('expense-bills', 'expense-bills', false)
    on conflict (id) do nothing;
    -- objects live under "<business_id>/…"; members of that business may read and add
    execute $p$drop policy if exists "expense bills readable by tenant" on storage.objects$p$;
    execute $p$create policy "expense bills readable by tenant" on storage.objects for select using (
      bucket_id = 'expense-bills' and (storage.foldername(name))[1]::uuid in (
        select id from public.businesses where owner_id = auth.uid()
        union select business_id from public.business_users where user_id = auth.uid() and coalesce((to_jsonb(business_users) ->> 'is_active')::boolean, true)))$p$;
    execute $p$drop policy if exists "expense bills uploaded by tenant" on storage.objects$p$;
    execute $p$create policy "expense bills uploaded by tenant" on storage.objects for insert with check (
      bucket_id = 'expense-bills' and (storage.foldername(name))[1]::uuid in (
        select id from public.businesses where owner_id = auth.uid()
        union select business_id from public.business_users where user_id = auth.uid() and coalesce((to_jsonb(business_users) ->> 'is_active')::boolean, true)))$p$;
  end if;
end $$;

commit;
