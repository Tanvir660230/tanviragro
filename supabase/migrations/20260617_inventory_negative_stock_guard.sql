-- Prevent negative inventory at the database level.
-- This makes the stock check in logConsumption TOCTOU-safe: even if two
-- concurrent requests both read "enough stock" and attempt to insert, the
-- trigger rejects the second one atomically inside the same transaction.

create or replace function check_inventory_stock()
returns trigger
language plpgsql
as $$
declare
  net_qty numeric;
begin
  -- Only guard outbound transactions (consumption, adjustment-out).
  if NEW.type not in ('consumption') then
    return NEW;
  end if;

  -- Sum all transactions for this item: positive = in, negative = out.
  select coalesce(sum(
    case
      when type in ('purchase', 'adjustment') and qty > 0 then qty
      when type = 'consumption' then -qty
      when type = 'adjustment' and qty < 0 then qty  -- already negative
      else 0
    end
  ), 0)
  into net_qty
  from inventory_transactions
  where item_id = NEW.item_id;

  -- Include the row being inserted.
  net_qty := net_qty - NEW.qty;

  if net_qty < -0.0001 then  -- small epsilon for floating point
    raise exception 'Insufficient stock for item %. Available: %, Requested: %',
      NEW.item_id,
      net_qty + NEW.qty,
      NEW.qty
      using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$;

-- Drop and recreate so this migration is idempotent.
drop trigger if exists trg_check_inventory_stock on inventory_transactions;

create trigger trg_check_inventory_stock
before insert on inventory_transactions
for each row execute function check_inventory_stock();
