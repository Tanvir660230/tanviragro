-- ================================================================
-- Tanvir Agro ERP — Soft Delete, RBAC & Team
-- Run in Supabase SQL Editor → New Query
-- ================================================================

-- ── Soft Delete: add deleted_at to key tables ─────────────────────
alter table cost_entries     add column if not exists deleted_at timestamptz;
alter table weight_logs      add column if not exists deleted_at timestamptz;
alter table inventory_items  add column if not exists deleted_at timestamptz;

-- Partial indexes for fast "not deleted" filtering
create index if not exists idx_cost_entries_not_deleted
  on cost_entries (id) where deleted_at is null;

create index if not exists idx_weight_logs_not_deleted
  on weight_logs (id) where deleted_at is null;

create index if not exists idx_inventory_items_not_deleted
  on inventory_items (id) where deleted_at is null;

-- ── Business Members (RBAC) ───────────────────────────────────────
-- Roles: 'admin' (full access) | 'manager' (cattle + inventory) | 'staff' (cattle + inventory, read-only finance)
create table if not exists business_members (
  id          uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'staff' check (role in ('admin','manager','staff')),
  invited_by  uuid references auth.users(id),
  joined_at   timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (business_id, user_id)
);

-- Index for quick lookup of a user's role in a business
create index if not exists idx_business_members_user
  on business_members (user_id, business_id);

-- RLS
alter table business_members enable row level security;

-- Business owners can read and manage their members
create policy "owner can manage members"
  on business_members
  using (
    business_id in (
      select id from businesses where owner_id = auth.uid()
    )
  )
  with check (
    business_id in (
      select id from businesses where owner_id = auth.uid()
    )
  );

-- Members can read their own record
create policy "member can view own record"
  on business_members for select
  using (user_id = auth.uid());
