-- Each sale keeps the animal's full cost on the day it was recorded.
--
-- The profit of a sold animal stays live (the farm position: purchase + own costs + its share
-- of feed and running costs), so a cost dated on or before the sale but recorded later still
-- lands on it. This column keeps the figure at the moment of sale, so the animal's page can say
-- "cost was ৳X when sold, ৳Y has been added since" instead of the profit changing silently.
--
-- Written by the app right after sell_cattle_group; null for sales recorded before this.
-- The sale guard (trg_sale_group_guard) does not cover this column, so it can be written
-- without the group-write flag. Safe to re-run.

begin;

alter table public.sales add column if not exists cost_at_sale numeric(14, 2);

comment on column public.sales.cost_at_sale is
  'Full cost of the animal (farm position) when the sale was recorded. Reference only: the live cost is the truth.';

commit;
