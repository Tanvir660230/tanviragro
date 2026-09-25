# Inventory page (`/dashboard/inventory`): redesign plan

The page is built around the farm's real flow: **buy → start using → when it runs out, count what is left.**
No daily entry is needed.

The problem with the current page is that it mixes two ways of working:
- **the old ration-plan card:** "Active Feeding", which says an engine recalculates, although that engine was removed;
- **a floating "Record Feeding" daily button.**

Meanwhile, the new way (usage periods) is not on the page at all.

## 1. Function inventory (all kept)
| # | Function | Component | New place |
|---|---|---|---|
| I1 | Inventory sections (10 links) | `InventorySubNav` | 5 main links + "More" (same 10 destinations) |
| I2 | Add item (`?open=add`) | `AddItemDialog` | Header, primary |
| I3 | Add purchase | link | Header, primary "Buy feed" |
| I4 | Purchase history, movements, adjustments, reports, warehouse, AI, products | links | Sub-nav / "More" + recent activity link |
| I5 | Feed mixer | link | Tools row |
| I6 | Record feeding (optional daily entry) | `DailyFeedDeductButton` | Tools row, labelled optional (floating mobile button removed) |
| I7 | Start using a feed / recipe | Feed Usage `StartDialog` | "Not started yet" list + "In use" section |
| I8 | Finished: closing count | Feed Usage `EndDialog` | Each "In use" card |
| I9 | Per-item actions: add stock, log use, edit, stock finished, roughage setting, discontinue… | `StockSection` / `ItemActions` | "All stock" (unchanged component) |
| I10 | Category filter, table/cards view, discontinued items | `StockSection` | Unchanged |
| I11 | Recipes: create, edit, activate, delete, restore | `RecipesSection` | Setup (collapsed) |
| I12 | Ration-plan dates (recipe from/until, roughage until) | `ActiveFeedingDashboard` | Setup, text corrected: "plan only, nothing is deducted" |
| I13 | Low-stock alerts, recent movements | `InventoryDashboardClient` (removed, no longer used) | Replaced by the summary + "running low" + recent activity |

## 2. One source of numbers
- **Feed in use, days left and running estimate** come from the feed engine (`loadFeedData`), the same source as the homepage and Feed Usage.
- **Stock value** comes from the database's unit cost (moving average): value = qty × current cost.
- **The item list's "days left"** comes from the feed engine when it has a daily figure (open period or learned usage). Otherwise it falls back to the ration plan, as before.

## 3. Layout (mobile first)
1. **Header:** title, **Buy feed**, **Add item**.
2. **Summary tiles:**
   - stock value;
   - feeds in use;
   - running out within 7 days;
   - feed cost this month (actual).
3. **In use:** one card per open usage period, showing:
   - start date and days running;
   - stock left and days left (bar);
   - running estimate, marked as an estimate;
   - a **Finished — count what is left** button.
4. **In stock, not started:** one row per item, with a **Start using** button.
5. **All stock:** `StockSection`, unchanged.
6. **Recent activity:** the last purchases and movements, each with business date and entry date, plus a "full history" link.
7. **Tools:** Feed mixer · Record feeding (optional).
8. **Setup (collapsed):** recipes and ration-plan dates.

## 4. Verification
- Every function above is clicked through or checked.
- The numbers match the homepage and Feed Usage.
- Screenshots: 390 px mobile and desktop, light/dark, Bangla/English, on the production copy.
- Tests, types, lint and build.
- Commit locally; **no deploy.**

## 5. Verification results (production copy, local)
- **Start using:** on Straw from "not started", this created an open period, and the page showed "In use · 1" with stock, days left and a running estimate. The test period was then removed from the local copy.
- **Finished:** the dialog opens with a closing count per item, an end date and an optional next target.
- **Stock value tile:** equals the "All stock" valuation (৳12,923).
- **Mobile, 390 px, Bangla:** no horizontal overflow. The desktop layout was also reviewed.
- **Removed as unreferenced:** `InventoryDashboardClient`.
- **Checks:** `tsc` clean, eslint shows no new warnings, jest 501/501, and `next build` succeeds.
- **Deploy:** none.
