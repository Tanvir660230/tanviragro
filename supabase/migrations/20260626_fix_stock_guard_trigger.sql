-- Fix: trigger referenced 'adjustment' which is not in the transaction_type enum,
-- causing every consumption insert to fail with:
--   "invalid input value for enum transaction_type: 'adjustment'"
--
-- The enum only has 'purchase' and 'consumption'. Remove all 'adjustment' references.

create or replace function check_inventory_stock()
returns trigger
language plpgsql
as $$
declare
  net_qty numeric;
begin
  -- Only guard outbound transactions (consumption type only).
  if NEW.type <> 'consumption' then
    return NEW;
  end if;

  -- Net stock = purchases in − consumptions out (for this item).
  select coalesce(sum(
    case
      when type = 'purchase' and qty > 0 then qty
      when type = 'consumption'           then -qty
      else 0
    end
  ), 0)
  into net_qty
  from inventory_transactions
  where item_id = NEW.item_id;

  -- Include the row being inserted.
  net_qty := net_qty - NEW.qty;

  if net_qty < -0.0001 then
    raise exception 'Insufficient stock for item %. Available: %, Requested: %',
      NEW.item_id,
      net_qty + NEW.qty,
      NEW.qty
      using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$;

-- Recreate trigger (idempotent).
drop trigger if exists trg_check_inventory_stock on inventory_transactions;

create trigger trg_check_inventory_stock
before insert on inventory_transactions
for each row execute function check_inventory_stock();
