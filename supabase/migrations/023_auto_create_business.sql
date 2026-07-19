-- ================================================================
-- Migration: Auto-create Business on User Signup
-- Description: Updates the handle_new_user trigger to create a default business
-- ================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  new_business_id uuid;
begin
  -- 1. Create the profile
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');

  -- 2. Auto-create a default business for the user
  insert into public.businesses (
    owner_id, 
    name, 
    type,
    opening_cash_balance
  )
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'full_name', 'Chowdhury Agro'), 
    'cattle',
    0
  )
  returning id into new_business_id;

  return new;
end;
$$;
