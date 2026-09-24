# Cattle pages redesign: plan

- **Pages:** the cattle list page (`/dashboard/cattle`) and the cattle profile page (`/dashboard/cattle/[id]`).
- **Goal:**
  - see at a glance which animal is doing well and which needs attention, and what is due;
  - see when to sell.
- **Constraint:** **no existing function is lost.** Every function below keeps working and stays reachable.

## 1. Function inventory (everything that must keep working)

### Cattle list
| # | Function | Component / action | Where it goes in the new design |
|---|---|---|---|
| L1 | Add cattle (tag/breed validation) | `AddCattleDialog` | Header, primary button |
| L2 | Bulk import (Excel) | `BulkLivestockImportDialog` | Header, "More" menu |
| L3 | Record weight, one or all | `CattleActionsMenu` → weight dialog | Header "Record weight" + card button |
| L4 | Add cost (one or several animals) | `CattleActionsMenu` → cost dialog | "More" menu |
| L5 | Health event for animals | `CattleActionsMenu` → health dialog | "More" menu + card button |
| L6 | Export CSV | `/dashboard/cattle/export` | "More" menu |
| L7 | View profile | link | Whole card, and "Details" |
| L8 | Quarantine on/off | `toggleQuarantine` | Card "···" menu |
| L9 | Record death | `markAsDeceased` (with confirmation) | Card "···" menu |
| L10 | Bulk weigh selected | `BulkWeightDialog` | Table view, selection bar |
| L11 | Batch operations (selected) | `BatchOperationsDialog` | Table view, selection bar |
| L12 | Quick filters (all, active, unweighed, sick, high gain, qurbani, sold) | local state | Filter chips (plus: ready to sell, losing money) |
| L13 | Sort / filter / column search | `EnterpriseDataGrid` | Table view kept; card view gets a sort menu + search |
| L14 | `?open=` deep link | page param | Kept |

### Cattle profile
| # | Function | Component | New place |
|---|---|---|---|
| P1 | Edit animal | `EditCattleDialog` | Header |
| P2 | Quarantine, Qurbani mark, mark dead / undo, print | `CattleDetailMoreMenu` | Header "···" |
| P3 | Undo sale (time-limited) | `UndoSaleButton` | Header (unchanged) |
| P4 | Recent-view tracking | `TrackCattleView` | Unchanged |
| P5 | Worker simplified view | `WorkerActionPad` (role worker) | Unchanged |
| P6 | Weight log, add/edit, growth chart | `WeightSection`, `WeightLog` | Tab "Weight & growth" |
| P7 | Growth forecast | `GrowthForecastCard` | Tab "Weight & growth" |
| P8 | Health workspace, medical history, treatments | `HealthSection` (`HealthWorkspace`, `MedicalHistoryTab`) | Tab "Health" |
| P9 | Ration plan | `DailyFeedRequirementCard` | Tab "Feed" |
| P10 | Sell impact / cash | `SellCashImpactCard` | Tab "Money" |
| P11 | Cost timeline | `CostTimelineCard` | Tab "Money" |
| P12 | Photos | `PhotosSection` / `CattlePhotoGallery` | Tab "Photos" |
| P13 | Timeline (unified + life cycle) | `TimelineSection` | Tab "Timeline" |
| P14 | QR code, insurance | `QRCodeCard`, `InsuranceCard` | Tab "ID & insurance" |
| P15 | Tab deep links (`?tab=weights`, `?tab=health`) | `CattleDetailTabs` | Kept (same ids) |

## 2. One source of numbers
Weight (with its basis), daily gain, cost so far, estimated worth, estimated profit, "ready to sell" and next health task come
from **the homepage model** (`src/lib/home/home-model.ts`). The homepage, the list and the profile therefore always show the
same figures. The list adds sold and dead animals, with their realised result from the sale.

## 3. Cattle list: layout (mobile first)
1. **Header:**
   - title and count;
   - search (tag or name);
   - **+ Add cattle**, **Record weight**, and a **More** menu (import, cost, health, export).
2. **Herd summary (4 tiles):**
   - live weight (measured vs estimated);
   - average daily gain (measured);
   - invested vs estimated worth;
   - ready to sell.
3. **Filter chips:** all · ready to sell · needs weighing · health due · slow growth · losing money · quarantine · qurbani · sold/dead. There is also a **sort** menu: profit, daily gain, days on farm, tag.
4. **Animal cards:**
   - tag, name, breed/sex, badges;
   - **weight sparkline** (measured points; estimates hollow);
   - weight + basis, daily gain, **target-weight progress**;
   - cost / worth / profit (estimate labelled);
   - next health task;
   - buttons **Weight · Health · Details** and a "···" menu (quarantine, death).
5. **Table view:** a switch between card and table. The table keeps selection, bulk weigh and batch operations.
6. **Sold / dead:** a collapsed section with the realised result.

## 4. Cattle profile: layout
1. **Header:**
   - back link, tag and name, status badges;
   - Edit, Undo sale (when allowed), and "···".
2. **Summary (replaces the 3-column hero), using the same numbers as the list:**
   - weight (basis, last weighed), daily gain, target progress;
   - cost so far (purchase / feed / medicine / other), worth today, profit (estimates labelled);
   - days on farm, next health task.
3. **Quick actions:** Record weight · Treatment · Add cost.
4. **Tabs (ids unchanged for deep links):** Overview · Weight & growth · Health · Feed · Money · Timeline · Photos · ID & insurance. Tab content reuses the existing components (P6 to P14), so their functions are not rewritten.

## 5. Order of work
1. Data: extend the list loader with the home model per animal, weight series, next health task, and sold/dead results. No new DB objects.
2. List page UI (cards, chips, sort, search, summary), keeping the table view and all dialogs.
3. Profile summary + header + quick actions; tabs untouched inside.
4. Bangla + English text, light/dark theme, 390 px mobile.
5. Verification:
   - tests for the new model parts;
   - tsc, lint, build;
   - screenshots of the real pages on the production copy (logged in as the owner, local only);
   - every function in §1 clicked through or checked in code.
6. Commit locally; **no deploy** until the owner says so.

## 6. Verification (done 2026-09-25, local production copy, logged in as the owner)

| Check | Result |
|---|---|
| L1 Add cattle, incl. `?open=add` deep link | Opens (the link was ignored before) |
| L3 Weigh, incl. `?open=bulk-weigh` deep link | Opens (the link was ignored before) |
| L2 Import, L4/L5/L6 cost, health, export (header "···") | Present and opening |
| L8/L9 card "···" (quarantine, record death) | Present, same server actions as before |
| L10–L13 table view (selection, bulk weigh, batch ops, filters, columns, export, paging) | Unchanged component, embedded |
| P1–P15 profile (edit, more menu, undo sale, tabs, worker view) | Unchanged components; `?tab=weight`/`health` land correctly; old `?tab=weights` still works |
| Same figures on homepage, list and profile | C001: 325 kg, ৳1,03,445, ৳26,574 everywhere |
| Profile FCR | Now actual eaten kg (4.14 from 475.9 kg); it used ration-plan kg (8.41) |
| Mobile 390 px | No horizontal overflow (the global top bar overflowed on every page; fixed) |
| Light/dark, Bangla/English | Screenshots checked |
| Tests / types / lint / build | 501/501 · clean · 0 errors · success |
