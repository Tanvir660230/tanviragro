# Master UX Blueprint

**Product:** Chowdhury Agro ERP (Tanvir Agro)
**Date:** September 10, 2026
**Status:** Strategic Blueprint — No Code Changes
**Purpose:** Single source of truth for all future design and implementation decisions

---

## PART 1 — PRODUCT EXPERIENCE

### 1.1 Product Philosophy

**"One farm. One system. One feeling."**

Every interaction with Chowdhury Agro ERP should communicate: this is a single, unified platform that understands agriculture. Not a collection of pages stitched together. Not a dashboard with bolted-on modules. One coherent product where every screen belongs to the same family.

The product must feel inevitable. When a user moves from Dashboard to Livestock to Finance to Reports, every transition should feel like turning pages in the same book — same typography, same spacing, same interaction patterns, same rhythm. The user should never have to re-learn how to use the product on a new page.

**Core Belief:** Farmers and farm managers are not IT professionals. The interface must be so intuitive that it teaches itself. Every unnecessary click is a missed feeding. Every confusing label is a misdiagnosed cow. Every slow page load is time stolen from the farm.

### 1.2 User Experience Philosophy

**Principle 1: Progressive Disclosure**
Show only what the user needs at this moment. Surface the 20% of features that solve 80% of daily tasks. Hide advanced features behind discoverable paths. Never overwhelm a Worker with Owner-level complexity.

**Principle 2: Contextual Intelligence**
The system should know what the user is trying to do and provide the right tools at the right time. When viewing a sick cow, the screen should surface treatment history, medicine stock, and vet contacts — not bury them across three pages.

**Principle 3: Zero Friction**
Every action should be completable within 3 clicks from any starting point. The most common workflows (weigh cattle, log health event, record sale, check stock) should be achievable from the sidebar in one click and a form.

**Principle 4: Visual Calm**
The interface should be visually quiet. White space is not wasted space — it is breathing room for decision-making. Every pixel of clutter adds cognitive load that takes focus away from the farm.

**Principle 5: Confidence Through Feedback**
Every action must produce immediate, visible feedback. When cattle are weighed, the user should see the confirmation instantly. When a sale is recorded, the P&L should update. When something fails, the error should explain what happened and how to fix it.

### 1.3 Navigation Philosophy

**"Three rules. Three clicks. Three seconds."**

Navigation should be invisible when not needed and instantly available when it is. The user should always know:
1. **Where they are** (breadcrumb, highlighted sidebar item)
2. **Where they can go** (sidebar groups, related pages)
3. **How to get back** (back button, breadcrumb trail)

The sidebar is the spine of the application. It should never change its structure unexpectedly. Groups should be logical and stable. The Command Palette (Cmd+K) is the emergency exit — when the user cannot find something in the sidebar, the command palette should find it instantly.

### 1.4 Information Philosophy

**"Data is not information. Information is not insight. Insight is not action."**

Every screen must answer three questions at a glance:
1. **What is the current state?** (summary KPIs, status indicators)
2. **What changed since last time?** (alerts, badges, deltas)
3. **What should I do next?** (action buttons, recommendations, AI suggestions)

Raw data tables without context are useless. A list of 400 cattle with no summary metrics, no filtering defaults, and no quick actions forces the user to mentally process everything. Instead: show 6 summary cards at the top, a smart default filter, and an obvious "What needs attention today" section.

### 1.5 Interaction Philosophy

**Consistency over novelty.** Every form, every dialog, every table, every chart should work the same way across the entire application. If inline editing works on the Cattle page, it should work the same way on the Inventory page. If a delete confirmation uses an AlertDialog, every delete confirmation should use an AlertDialog.

**Keyboard-first where possible.** Power users (Admins, Managers) should be able to navigate the entire application without touching the mouse. Cmd+K for search, Alt+1-5 for page jumps, Ctrl+B for sidebar toggle, Enter to confirm, Escape to cancel.

### 1.6 Performance Philosophy

**"Speed is a feature."** The application should feel like it is running locally, even on a 3G connection in a rural area. This means:
- Client-side navigation (no full page reloads)
- Streaming server components (show skeleton immediately, stream content as it arrives)
- Optimistic UI (show the action as done, reconcile in background)
- Prefetching (hover over sidebar item -> prefetch the page)
- Persistent layout (sidebar, topbar never re-render on navigation)

### 1.7 Accessibility Philosophy

**WCAG 2.1 AA minimum.** Every interactive element must be keyboard-navigable. Every visual element must have sufficient contrast. Every action must have screen reader announcements. Skip navigation links must work. Focus management must be correct in dialogs and modals.

---

## PART 2 — INFORMATION ARCHITECTURE

### 2.1 Complete Page Inventory

Every page is mapped below with purpose, user, goals, information needs, navigation role, frequency, and priority.

#### DASHBOARD (/dashboard) — P0
- **Purpose:** Command center — everything the user needs right now
- **Primary User:** Owner, Admin, Manager
- **Goal:** Understand business health in under 10 seconds
- **Critical Info:** Total cattle, net P&L, pending health events, low stock, upcoming calvings
- **Quick Actions:** Add Cattle, Record Weight, Log Health Event, Record Sale, Add Cost
- **Nav:** Central hub — every page connects here
- **Frequency:** Every session, multiple times per day

#### CATTLE MANAGEMENT (/dashboard/cattle) — P0
- **Purpose:** Complete livestock directory — browse, search, filter, manage every animal
- **Primary User:** All roles
- **Goal:** Find a specific animal or group quickly
- **Critical Info:** Tag ID, breed, status, weight, ADG, pen, health alerts
- **Quick Actions:** Add Cattle, Bulk Weigh, Filter, Export CSV
- **Nav:** Child of Farm & Operations sidebar group
- **Frequency:** 5-10 times per day for farm staff

#### CATTLE DETAIL (/dashboard/cattle/[id]) — P0
- **Purpose:** Complete lifecycle view of a single animal
- **Goal:** Make a decision about this animal (treat, weigh, sell, breed)
- **Critical Info:** Status, weight trend, health events, breeding history, total cost
- **Quick Actions:** Record Weight, Log Health, Breed, Sell, Transfer, Add Photo
- **Nav:** Drill-down from Cattle list

#### PEN MANAGEMENT (/dashboard/cattle/pens) — P1
- **Purpose:** Visualize and manage physical farm spaces
- **Goal:** Understand pen occupancy and assign cattle
- **Critical Info:** Pen name, occupancy, capacity, cattle per pen
- **Quick Actions:** Add Pen, Transfer Cattle, View Pen Detail

#### CATTLE ANALYTICS (/dashboard/cattle/analytics) — P1
- **Purpose:** Data-driven insights on herd performance
- **Goal:** Identify top/bottom performers, track growth
- **Critical Info:** ADG by breed, weight distribution, performer rankings
- **Quick Actions:** Export Report, Filter by Date/Breed

#### BREEDING & GENETICS (/dashboard/cattle/breeding) — P1
- **Purpose:** Complete reproduction lifecycle management
- **Primary User:** Veterinarian, Manager, Owner
- **Goal:** Track breeding status of every eligible animal
- **Critical Info:** Heat records, pregnancy status, breeding attempts, expected calving dates
- **Quick Actions:** Log Heat, Record AI Breeding, Confirm Pregnancy, Log Calving

#### HEALTH & VACCINES (/dashboard/cattle/health) — P0
- **Purpose:** Clinical command center — health monitoring, treatments, vaccinations
- **Primary User:** Veterinarian, Staff, Manager
- **Goal:** Identify animals needing immediate attention
- **Critical Info:** Overdue events, active treatments, upcoming vaccinations, death records
- **Quick Actions:** Log Health Event, Schedule Vaccination, Record Treatment

#### FEED PLANNING (/dashboard/cattle/feed) — P1
- **Purpose:** Nutritional management — plan rations, track consumption, optimize costs
- **Primary User:** Manager, Staff, Worker
- **Goal:** Know what to feed each pen today and the cost
- **Critical Info:** Today's rations by pen, feed cost per head, daily consumption
- **Quick Actions:** Log Feed Distribution, Adjust Ration, View Recipes

#### INVENTORY (/dashboard/inventory) — P0
- **Purpose:** Complete inventory management — stock levels, transactions, recipes
- **Primary User:** Manager, Staff
- **Goal:** Know current stock levels, identify low stock items
- **Critical Info:** Current stock, low stock alerts, recent transactions
- **Quick Actions:** Add Item, Record Transaction, Bulk Import, View Low Stock

#### FINANCE (/dashboard/finance) — P0
- **Purpose:** Financial overview — P&L, costs, revenue, profitability
- **Primary User:** Owner, Admin
- **Goal:** Understand financial health — am I profitable?
- **Critical Info:** Net P&L, total revenue, total costs, cost breakdown
- **Quick Actions:** Add Cost, Record Sale, View P&L, Export Statement
- **Note:** Currently 600+ lines with duplicate components — MUST be decomposed

#### FINANCE - LOANS (/dashboard/finance/loans) — P1
- **Purpose:** Track loan obligations, payment schedules, interest
- **Primary User:** Owner, Admin
- **Goal:** Monitor upcoming payments and total debt exposure
- **Critical Info:** Outstanding balance, next payment due, interest rate

#### ACCOUNTING (/dashboard/accounting) — P1
- **Purpose:** Double-entry bookkeeping — ledger, journal entries, financial statements
- **Primary User:** Owner, Admin, Accountant
- **Goal:** Ensure books are balanced and statements accurate
- **Critical Info:** Trial balance, account balances, journal entry count
- **Subpages (all P2):** Income Statement, Balance Sheet, Cash Flow, Trial Balance, Fixed Assets

#### PARTNERS & EQUITY (/dashboard/partners) — P1
- **Purpose:** Investor management — partner ledger, equity tracking, dividends
- **Primary User:** Owner, Admin
- **Goal:** Know each partner's equity stake and transaction history
- **Critical Info:** Partner equity balances, total equity, fee rates
- **Quick Actions:** Add Partner, Record Transaction, Generate Statement

#### COMMERCE (/dashboard/commerce) — P0 [HIDDEN]
- **Purpose:** Sales and order management — orders, invoices, transfers
- **Goal:** Track orders and ensure timely fulfillment
- **Critical Info:** Pending orders, revenue, outstanding invoices
- **Nav Status:** NOT IN SIDEBAR — completely hidden from navigation

#### VENDORS (/dashboard/vendors) — P1 [HIDDEN]
- **Purpose:** Supplier management — vendor directory, purchase history
- **Goal:** Know which suppliers to contact for needed items
- **Nav Status:** Only in mobile "More" menu — hidden on desktop sidebar

#### COMPLIANCE (/dashboard/compliance) — P1 [HIDDEN]
- **Purpose:** Regulatory and vaccination compliance tracking
- **Goal:** Ensure all animals are vaccinated on schedule
- **Nav Status:** Only in mobile "More" menu — hidden on desktop sidebar

#### NOTIFICATIONS (/dashboard/notifications) — P0 [HIDDEN]
- **Purpose:** Centralized alert center — all actionable items in one place
- **Goal:** See everything that needs attention right now
- **Critical Info:** Overdue health events, low stock, loan payments, insurance expiring
- **Nav Status:** NOT IN SIDEBAR — must be accessible via bell icon in TopBar

#### OPERATIONS (/dashboard/operations) — P2 [HIDDEN]
- **Purpose:** System monitoring, audit trail, technical metrics
- **Nav Status:** Only in mobile "More" menu — add to Admin sidebar group

#### SETTINGS (/dashboard/settings) — P2
- **Purpose:** System configuration — business info, users, preferences
- **Primary User:** Owner, Admin
- **Note:** Currently 800+ lines — MUST be split into sub-routes

#### REPORTS (/dashboard/report) — P0 [BROKEN]
- **Purpose:** Executive reporting — generate, view, export business reports
- **Primary User:** Owner, Admin
- **Nav Status:** BROKEN 404 — referenced in sidebar but page.tsx does not exist

#### AI ASSISTANT (hidden) — P0 [HIDDEN]
- **Purpose:** AI-powered intelligence — predictions, recommendations, NL queries
- **Goal:** Provide proactive intelligence for better decisions
- **Critical Info:** Disease risk, mortality forecasts, growth projections, feed optimization
- **Nav Status:** COMPLETELY HIDDEN — must be surfaced as sidebar item + floating assistant

#### WORKFLOW ENGINE (hidden) — P1 [HIDDEN]
- **Purpose:** Automate multi-step business processes via templates
- **Goal:** Execute standardized workflows (cattle intake, death recording, sale processing)
- **Nav Status:** COMPLETELY HIDDEN — 7 template categories with zero UI

#### ANALYTICS / BI (hidden) — P1 [HIDDEN]
- **Purpose:** Business intelligence — KPI engine, custom reports, BI dashboards
- **Goal:** Data-driven decision making across all business domains
- **Nav Status:** COMPLETELY HIDDEN — backend engines for KPI, custom reports, BI

#### BULK IMPORT (hidden) — P1 [HIDDEN]
- **Purpose:** Bulk data operations — CSV import, mass updates
- **Goal:** Reduce data entry time for large datasets
- **Nav Status:** COMPLETELY HIDDEN — bulk-import.ts exists with no UI

#### AUDIT LOG (hidden) — P2 [HIDDEN]
- **Purpose:** Complete audit trail — who changed what and when
- **Goal:** Compliance, accountability, debugging
- **Nav Status:** COMPLETELY HIDDEN — audit_log table exists with no viewer

---

## PART 3 — PAGE BLUEPRINTS

For every major page, the optimal layout structure is defined. Each section includes its rationale.

### 3.1 Dashboard Blueprint (/dashboard)

```
TopBar (persistent)
  Logo + Business Name | Global Search (Cmd+K) | Quick Create (+)
  Notification Bell (badge) | Theme Toggle | Profile Menu

Sidebar (persistent, collapsible) → See Part 5

Breadcrumb: "Overview"

Page Title: "Welcome back, {FirstName}" + last login timestamp
Subtitle: "{Day}, {Date} — {Total Cattle} cattle across {Total Pens} pens"

Quick Action Bar: [+ Add Cattle] [Record Weight] [Log Health] [Record Sale] [+ More]

KPI Summary Row (6 cards, responsive grid):
  [Total Cattle] [Active Treatments] [Net P&L This Month]
  [Low Stock Items] [Upcoming Calvings] [Today's Tasks Count]

Main Content (2-col desktop, 1-col mobile):
  Left (wider):
    "What Needs Attention" — overdue health + upcoming tasks (max 5, clickable)
    "Herd Overview" — cattle count by status + breed distribution chart
    "Weight Trends" — avg weight over 30 days with ADG line
    "Recent Activity" — last 10 actions with timestamps
  Right (narrower):
    "Financial Snapshot" — Revenue vs Costs, Net P&L (green/red)
    "Feed & Inventory" — today's consumption + low stock items
    "Breeding Calendar" — upcoming heats + expected calvings (30 days)
    "Cash Flow Forecast" — 30-day forward projection
    "AI Insights" — top 3 recommendations with confidence scores

Mobile Sticky Footer: [Home] [Cattle] [Inventory] [Finance] [More]
```

**Rationale:** KPI row answers "how are we doing?" in 3 seconds. Attention section answers "what do I do next?" Two-column puts actionable items left (where eyes start), contextual data right.

### 3.2 Cattle Management Blueprint (/dashboard/cattle)

```
Header: "Livestock Management" + "{count} cattle" subtitle
  Actions: [+ Add Cattle] [Bulk Weigh] [Export] [⋮ More]

KPI Row: [Total Head] [Avg Weight] [Avg ADG] [Active %] [Pregnant] [Under Treatment]

Tab Bar: [All] [Active] [Sold] [Deceased] [Pregnant] [Under Treatment] [New This Month]

Toolbar: [Search...] [Breed ▾] [Pen ▾] [Status ▾] [Weight Range] [Table|Cards View]

EnterpriseDataGrid:
  Columns: ☑ Tag | Breed | Status | Weight | ADG | Pen | Health | Last Weighed | Actions
  Features: Sort, inline weight edit, bulk select, row actions, pagination (25/50/100)
  Empty State: "No cattle match" + [Add Cattle]
  Loading: Skeleton rows matching structure

Bulk Action Bar (on selection): [Log Health] [Weight] [Transfer] [Export] [Delete]
Footer: Summary row with weight column totals
```

**Rationale:** Most-used page. Tab bar eliminates filter clicks for common views. EnterpriseDataGrid ensures consistency. Bulk action bar prevents navigation away for batch operations.

### 3.3 Cattle Detail Blueprint (/dashboard/cattle/[id])

```
Header: Back → /cattle | "{Tag} — {Breed}" + status badge
  Subtitle: "Pen: {Pen} | Added: {Date} | Days: {N}"
  Actions: [Edit] [Record Weight] [Log Health] [⋮ More]

Tabs: [Overview] [Weight History] [Health] [Breeding] [Feed & Cost] [Photos] [Activity]

Overview Tab (default):
  Summary Cards: [Current Weight] [ADG] [Total Cost] [Revenue] [P/L] [Status]
  Left: Weight chart | Cost pie chart | Lifecycle vertical timeline
  Right: Quick info panel | Upcoming events | Recent activity | Pen mates

Weight Tab: Full weight log table + chart overlay
Health Tab: Chronological health events with outcomes
Breeding Tab: Breeding records, heat cycles, pregnancy status
Feed Tab: Feed consumption, cost allocation, profitability
Photos Tab: Gallery with upload
Activity Tab: Complete audit trail
```

### 3.4 Health Hub Blueprint (/dashboard/cattle/health)

```
Header: "Health & Vaccination Hub" + "{active} treatments | {overdue} overdue"
  Actions: [+ Log Event] [Schedule Vaccination] [Record Treatment]

KPI Row: [Active] [Overdue] [Upcoming This Week] [Compliance %] [Mortality] [Medicine Alert]

Alert Banner: "⚠ {N} overdue treatments" → [View Now]

Tabs: [All] [Overdue] [Upcoming] [In Treatment] [Completed] [Vaccinations] [Deaths]

Content:
  Left (60%): Event cards grouped by date (today/yesterday/week/earlier)
    Each card: {Icon} {Tag} — {Title} | {Date} | {Staff} | {Badge} [View][Complete][Reschedule]
  Right (40%): Medicine stock alerts | Vaccination calendar (14 days)
    Disease pattern insights | AI health predictions
```

### 3.5 Inventory Blueprint (/dashboard/inventory)

```
Header: "Feed & Inventory" + "{N} items | {M} low stock"
  Actions: [+ Add Item] [Record Transaction] [Bulk Import] [Manage Recipes]

KPI Row: [Total Items] [Low Stock] [Total Value] [Transactions This Month]

Tab Bar: [All Items] [Low Stock] [Feed Items] [Medicine] [Supplies] [Archived]

Toolbar: [Search...] [Category ▾] [Supplier ▾] [Stock Status ▾] [Table|Cards]

EnterpriseDataGrid:
  Columns: ☑ Name | Category | Current Stock | Unit | Min Level | Unit Cost
           | Supplier | Last Transaction | Status | Actions
  Inline edit: Current stock quantity (quick adjustment)
  Status badges: In Stock (green) | Low (yellow) | Out (red)

Bulk Action Bar: [Adjust Stock] [Export Selected] [Delete]
Transaction History Panel: Slide-over panel showing recent transactions for selected item
```

### 3.6 Finance Blueprint (/dashboard/finance)

**CRITICAL: This page must be decomposed. Currently 600+ lines with duplicate components.**

```
Header: "Finance & Profitability"
  Actions: [+ Add Cost] [Record Sale] [View Full P&L] [Export Statement]

Tab Bar: [Overview] [Costs] [Revenue] [P&L Analysis] [Trends] [AI Insights]

Overview Tab (default):
  KPI Row: [Total Revenue] [Total Costs] [Net P&L] [Cost per Head]
           [Revenue per Head] [Profit Margin %]
  
  Left (60%):
    P&L Bar Chart (monthly, current year)
    Cost Breakdown Donut (by category: feed, labor, medicine, equipment, other)
    Revenue Breakdown Donut (by source: cattle sales, milk, other)
  Right (40%):
    Top 5 Cost Categories with trend arrows
    Top 5 Revenue Sources with trend arrows
    Monthly comparison card (this month vs last month vs same month last year)
    "AI Cost Optimization" card with suggestions

Costs Tab: Full cost entry list with filters, inline editing, bulk categorize
Revenue Tab: Full sales list with filters, inline editing
P&L Tab: Formal P&L statement view (Income Statement format)
Trends Tab: Time-series charts for all financial metrics
AI Insights Tab: Predictive analytics, cost optimization, revenue forecasting
```

### 3.7 Breeding Hub Blueprint (/dashboard/cattle/breeding)

```
Header: "Breeding & Reproduction"
  Actions: [+ Log Heat] [Record AI Breeding] [+ More]

KPI Row: [Pregnant] [In Heat This Week] [Due This Month] [Conception Rate]
         [Active Bulls/Semen] [Calves Born This Year]

Tab Bar: [Calendar View] [List View] [AI Overview] [Semen Inventory]

Calendar View (default): Monthly calendar with events pinned
  Pregnancy confirmations (green), Heat detections (orange),
  Expected calvings (blue), AI breedings (purple)
  Click date → expand to show animals + quick actions

List View: EnterpriseDataGrid of all breeding records
  Columns: Animal | Event Type | Date | Outcome | Staff | Next Event | Actions

AI Overview: AI predictions for breeding optimization
  - "Animal X is likely to come into heat in 3 days"
  - "Breeding success rate improved 12% after switching to {semen}"
  - "Consider culling Animal Y — 3 failed breedings"

Semen Inventory: Track semen straws, bull info, usage
```

### 3.8 Accounting Blueprint (/dashboard/accounting)

```
Header: "General Ledger & Accounting"
  Actions: [+ Journal Entry] [Reconcile] [Generate Statement] [Export]

KPI Row: [Total Accounts] [Unbalanced Entries] [Period Net Income]
         [Total Assets] [Total Liabilities] [Equity]

Tab Bar: [Journal] [Accounts] [Trial Balance] [Statements] [Fixed Assets]

Journal Tab: EnterpriseDataGrid of journal entries
  Columns: Date | Entry # | Description | Debit | Credit | Status | Actions
  Filter: Period, account, status, amount range

Accounts Tab: Chart of accounts tree view with balances
Statements Tab: Links to Income Statement, Balance Sheet, Cash Flow
  Each rendered as a preview card with [View Full] [Export PDF]
Fixed Assets Tab: Asset register with depreciation schedules
```

### 3.9 Partners & Equity Blueprint (/dashboard/partners)

```
Header: "Partners & Equity Management"
  Actions: [+ Add Partner] [Record Transaction] [Calculate Dividends]

KPI Row: [Total Partners] [Total Equity] [Management Fee Rate]
         [This Period Dividends] [Capital Calls This Year]

Content: Two-panel layout
  Left (50%): Partner cards grid
    Each card: Name | Equity Stake % | Balance | Last Transaction
    Click → expand to full partner view
  Right (50%): Selected partner detail
    Equity balance, transaction history, statement generator
    [Generate PDF Statement] [Record Capital Call] [Record Dividend]
```

### 3.10 Settings Blueprint (/dashboard/settings)

**CRITICAL: Currently 800+ lines. MUST be split into sub-routes.**

```
Header: "System Settings"

Left Sidebar (within page):
  [Business Profile] [Users & Roles] [Tax Configuration]
  [Weight Units] [Market Prices] [Notification Prefs] [Feature Flags] [Data Management]

Content: Sub-route based, each section is its own page
  Business Profile: Name, logo, address, contact info
  Users & Roles: User list, role assignment, invitation
  Tax Configuration: Tax rates, categories
  Weight Units: kg/lb toggle, measurement defaults
  Market Prices: Current market rates for cattle categories
  Notification Prefs: Email, push, in-app notification toggles
  Feature Flags: Owner toggle per business for optional features
  Data Management: Export all data, import data, delete account
```

### 3.11 Reports Blueprint (/dashboard/report) — TO BE BUILT

```
Header: "Executive Reports"
  Actions: [+ Generate Report] [Schedule Report] [Export All]

Report Type Selector (cards):
  [Financial Summary] [Herd Performance] [Health & Mortality]
  [Feed Efficiency] [Breeding Performance] [Full Business Report]

Selected Report View:
  Period Selector: [This Month] [This Quarter] [This Year] [Custom Range]
  Generate button → streaming report generation with skeleton
  
  Report Output:
    Executive Summary (AI-generated narrative)
    KPI Dashboard (key metrics for selected period)
    Detailed Sections (charts + tables)
    Comparison: vs previous period, vs same period last year
    Export: [PDF] [Excel] [Print]
```

### 3.12 AI Assistant Blueprint — TO BE BUILT (P0)

```
Access Points:
  1. Sidebar: "AI Assistant" nav item with Sparkles icon
  2. Floating action button: bottom-right corner, always visible
  3. Dashboard: "AI Insights" card
  4. Contextual: AI suggestions embedded in relevant pages

AI Assistant Page (/dashboard/ai):
  Header: "AI Intelligence Hub"
  
  Tab Bar: [Insights] [Predictions] [Recommendations] [Ask Question] [Automation]
  
  Insights Tab:
    Cards grouped by domain:
      Health Risk: "3 cattle showing early signs of respiratory distress"
      Feed Optimization: "Switching to Recipe B could save 8% on feed costs"
      Growth: "Cattle in Pen A are gaining 15% more weight than Pen B"
      Financial: "Cash flow deficit projected in 45 days at current burn rate"
  
  Predictions Tab:
    Disease risk scores per animal (heatmap or ranked list)
    Mortality risk predictions
    Growth trajectory forecasts
    Feed cost projections
    Cash flow forecasts
  
  Recommendations Tab:
    Actionable items ranked by impact:
      "Move cattle X to Pen B — projected +0.2 kg/day ADG" [Accept] [Dismiss]
      "Reduce feed ration for pen C — cattle are above target weight" [Accept] [Dismiss]
  
  Ask Question Tab:
    Natural language input: "What was my net profit last month?"
    AI generates answer from business data
    Shows source data for transparency
  
  Automation Tab:
    Active automations (e.g., "Alert me when ADG drops below X")
    Create new automation rules
```

### 3.13 Workflow Engine Blueprint — TO BE BUILT (P1)

```
Access: Sidebar "Workflows" item under Administration

Header: "Workflow Engine"
  Actions: [+ Create Workflow] [Browse Templates]

Template Library (grid of cards):
  Category: Cattle Operations
    [Cattle Intake] [Cattle Sale] [Death Recording] [Transfer]
  Category: Health Operations
    [Vaccination Protocol] [Treatment Protocol] [Emergency Response]
  Category: Financial Operations
    [Monthly Close] [Partner Distribution] [Loan Application]
  Category: Compliance
    [Regulatory Filing] [Audit Preparation]

Active Workflows Tab:
  EnterpriseDataGrid of running workflows
  Columns: Name | Status | Started | Steps Complete | Next Step | Actions
  
Workflow Builder (for custom workflows):
  Visual step-by-step editor
  Drag-and-drop step ordering
  Conditional logic (if/then)
  Notification triggers at each step
  Deadline management
```

### 3.14 Notifications Blueprint (/dashboard/notifications)

```
Header: "Notification Center"
  Actions: [Mark All Read] [Filter: All|Unread|Alerts|Tasks]

Notification List:
  Grouped by: Today | Yesterday | This Week | Earlier
  Each notification card:
    {Type Icon} {Title}
    {Description/body text}
    {Time} — {Source page link}
    [Mark Read] [Dismiss] [Go to Source]
  
  Type indicators: Health (red), Stock (yellow), Financial (green),
                   Breeding (purple), System (gray)

Empty State: "All caught up! No pending notifications."
```

### 3.15 Commerce Blueprint (/dashboard/commerce) — TO BE BUILT OUT

```
Header: "Commerce & Orders"
  Actions: [+ Create Order] [Record Sale] [Manage Invoices]

KPI Row: [Pending Orders] [Revenue This Month] [Outstanding Invoices] [Completed This Week]

Tab Bar: [Orders] [Invoices] [Customers] [Transfers]

Orders Tab: EnterpriseDataGrid of orders
  Columns: Order # | Customer | Items | Total | Status | Date | Actions
  Status badges: Pending (yellow) | Processing (blue) | Completed (green) | Cancelled (red)
```

---

## PART 4 — USER JOURNEYS

### 4.1 Daily Operations Journey (Most Common)

**User: Farm Worker/Staff — Every Day**

```
Login → Dashboard → Check "What Needs Attention" → 2 overdue health events
  → Click event → Cattle Detail → Record treatment (dialog, no page nav)
  → Mark complete → Cattle page → Tab "Under Treatment" → Verify
  → Inventory → Check feed stock → 2 items low → Record distribution
  → Dashboard → Verify tasks updated
```
**Friction Risk:** Navigating between Health Hub and Cattle Detail requires context switching
**Improvement:** Embedded "Mark Complete" on health event cards eliminates page navigation

### 4.2 Financial Review Journey (Weekly)

**User: Owner/Admin — Weekly**

```
Dashboard → Scan P&L KPI → Click → Finance Overview
  → Monthly P&L chart → Identify cost spike → Click category → Drill into entries
  → Filter by date → Identify increase → Costs tab → Bulk categorize
  → Overview → Verify correction → AI Insights tab → Review suggestions
  → Export P&L as PDF → Share with partner
```
**Friction Risk:** Finance page is overwhelming (600+ lines) with duplicates
**Improvement:** Decompose into focused tabs. AI Insights should surface proactively.

### 4.3 New Cattle Intake Journey

**User: Manager/Staff — As Needed**

```
[+ Add Cattle] via Quick Create → Form dialog → Submit
  → Optimistic UI shows cattle immediately → Cattle Detail opens
  → Verify info → Schedule health check → Assign to pen → Record initial weight
  → Cattle appears in herd overview with all associations
```
**Improvement:** Workflow Engine template could guide this entire process step-by-step.

### 4.4 Monthly Close Journey

**User: Owner/Admin — Monthly**

```
Accounting → Review trial balance → Journal → Approve entries
  → Finance → Full month P&L → Partners → Calculate dividends
  → Reports → Generate Full Business Report → Export PDF → Archive
```
**Friction Risk:** Requires visiting 4 different pages — significant context switching
**Improvement:** Workflow Engine "Monthly Close" template with checklist.

### 4.5 Emergency Health Response Journey

**User: Veterinarian — Urgent**

```
Notification: "Animal X showing distress" → Click → Cattle Detail
  → Review health timeline → [Log Emergency] → Fast-entry form
  → System checks medicine stock → Treatment recorded → Status updated
  → AI suggests: "Similar symptoms treated with {medicine}" → Follow-up auto-scheduled
```
**Friction Risk:** Every second counts — must be fastest path in the app
**Improvement:** Emergency shortcut (Alt+E) for fast-entry health form.

### 4.6 Inventory Procurement Journey

**User: Manager — Weekly**

```
Inventory → Tab "Low Stock" → Review 5 items → Click item → View history + supplier
  → Contact supplier → After delivery: Record transaction → Stock updated
  → Bulk Import for multiple deliveries → All stock above minimum
```
**Improvement:** AI could suggest optimal reorder quantities and timing.

### 4.7 Breeding Management Journey

**User: Veterinarian/Manager — Daily**

```
Cattle → Breeding → Calendar View → Today: 2 heats, 1 AI scheduled
  → Click heat → Log AI breeding → Record bull/semen/technician
  → System: "Expected calving: {date}" + "Check in 21 days"
  → Semen inventory: 12 straws Bull A (low) → AI Overview → "3 heats this week"
```

### 4.8 Settings & Configuration Journey

**User: Owner — One-Time/Occasional**

```
Settings → Business Profile → Users → Invite + assign role → Tax → Update rate
  → Market Prices → Update rates → Feature Flags → Enable AI Insights
```
**Friction Risk:** Currently 800+ lines in one page — overwhelming
**Improvement:** Split into sub-routes with left sidebar navigation.

---

## PART 5 — GLOBAL NAVIGATION

### 5.1 Navigation Architecture Overview

7 layers, each serving a distinct purpose:
1. **Sidebar** — Primary navigation spine
2. **TopBar** — Quick access utilities
3. **Breadcrumb** — Location awareness
4. **Command Palette** — Universal search and action
5. **Context Navigation** — Page-specific tabs and filters
6. **Quick Access** — Keyboard shortcuts and favorites
7. **Notification System** — Push-style alerts

### 5.2 Sidebar Redesign

**Current:** 3 groups, 12 visible items. Commerce, Vendors, Compliance, Notifications, Operations hidden.

**Target:** 5 groups, all pages visible, role-filtered.

```
┌─────────────────────────────────────┐
│ 🏢 {Business Name} / Role Badge     │
│                                      │
│ ── Quick Access ────────────────── │
│ 🏠 Overview                          │
│ 🤖 AI Assistant ✨ [NEW]            │
│                                      │
│ ── Farm & Operations ──────────── │
│ 🐄 Livestock Management          ▾  │
│   All Cattle | Farms & Pens         │
│   Analytics | Breeding | Health     │
│   Feed Plan                         │
│ 📦 Feed & Inventory               ▾  │
│   Stock | Transactions | Recipes    │
│   Bulk Import [NEW] 🔥             │
│ 🏪 Vendors [NEW]                    │
│                                      │
│ ── Business & Finance ─────────── │
│ 💰 Finance                        ▾  │
│   Overview | Costs | Revenue | Loans│
│ 📒 Accounting                     ▾  │
│   Ledger | P&L | Balance Sheet     │
│   Cash Flow | Trial Balance | Assets│
│ 👥 Partners & Equity               │
│ 🛒 Commerce [NEW]                   │
│                                      │
│ ── Intelligence ───────────────── │
│ 📊 Analytics & BI [NEW]            │
│ 🔄 Workflows [NEW]                  │
│ 📋 Compliance                       │
│                                      │
│ ── Administration ─────────────── │
│ 📄 Executive Reports                │
│ 🔔 Notifications [NEW]              │
│ ⚙️ System Settings                  │
│ 🖥️ Operations [NEW]                 │
│                                      │
│ ── Footer ────────────────────── │
│ 📌 Pinned | 🕐 Recent              │
│ [Pin] [Collapse]                    │
└─────────────────────────────────────┘
```

**Key Decisions:**
- Quick Access at top: Dashboard + AI Assistant (always visible)
- New pages get [NEW] badge for discoverability
- "Intelligence" group is new — Analytics, Workflows, Compliance together
- Pinned/Recent at bottom for power users
- Role filtering: Workers see only Farm items; Owners see everything

### 5.3 TopBar Redesign

```
┌─────────────────────────────────────────────────────┐
│ ☰ Toggle │ {Logo} {Business Name} │ 🔍 Cmd+K │ ⚡+ 🌙 👤 │
└─────────────────────────────────────────────────────┘
```

Right section: Command Search trigger, Quick Create (+), Notification Bell (badge), Theme Toggle, Profile Menu (avatar → settings, logout)

### 5.4 Command Palette (Cmd+K)

**Current:** Basic search with 7 pages and 6 actions

**Target:** Comprehensive command palette:

```
┌─────────────────────────────────────────────────┐
│ 🔍 Search pages, cattle, actions, or ask AI... │
│─────────────────────────────────────────────────│
│ ── Recent ──                                    │
│ 🐄 Cattle Management                            │
│ 💰 Finance                                      │
│ ── Pages ── (all 25+ pages)                    │
│ ── Quick Actions ──                             │
│ ➕ Add Cattle | ⚖️ Bulk Weigh | 💊 Log Health  │
│ 💲 Record Sale | 📥 Bulk Import                 │
│ ── Cattle Search ──                             │
│ 🐄 TAG-001 — Holstein — Active                  │
│ ── AI ──                                        │
│ 🤖 Ask AI: "What was my net profit..."          │
│ ┌─────────────────────────────────────────────┐ │
│ │ ↑↓ Navigate  ↵ Go  Esc Close  / Focus AI  │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Improvements:** All pages (not just 7), recent pages, AI query, category headers, keyboard hints.

### 5.5 Keyboard Shortcuts

| Shortcut | Action | Scope |
|----------|--------|-------|
| Cmd/Ctrl+K | Open Command Palette | Global |
| Cmd/Ctrl+B | Toggle Sidebar | Global |
| Cmd/Ctrl+J | Toggle Right Utility Panel | Global |
| Cmd/Ctrl+/ | Show Keyboard Shortcuts | Global |
| Alt+1-6 | Quick Jump (Dashboard→Partners) | Global |
| Alt+E | Emergency Health Entry | Global |
| N/P | Next/Previous (in lists) | Contextual |
| Enter | Confirm/Select | Contextual |
| Escape | Cancel/Close | Global |

### 5.6 Breadcrumb System

Pattern: `{Section} / {Page} / {Sub-page} / {Detail}`
Examples:
- `Overview`
- `Livestock / All Cattle / TAG-001`
- `Finance / Costs`
- `Settings / Users & Roles`

Rules: Always visible below TopBar. Current page bold, not clickable. On mobile, truncate deep paths with "...". Auto-generated from URL structure.

---

## PART 6 — DESIGN SYSTEM BLUEPRINT

### 6.1 Foundation

Built on existing shadcn/ui + Tailwind CSS 4. No new UI library. All custom components extend shadcn primitives with consistent patterns.

**Token Hierarchy:** CSS Custom Properties → Tailwind utilities → CVA variants → Page-level overrides (exception-only)

### 6.2 Color System

```
Primary:       hsl(142 76% 36%)  — Green (agriculture theme)
Secondary:     hsl(210 40% 96%)  — Light gray
Destructive:   hsl(0 84% 60%)    — Red
Success:       hsl(142 76% 36%)  — Green
Warning:       hsl(38 92% 50%)   — Amber
Info:          hsl(217 91% 60%)  — Blue

Status Colors (consistent everywhere):
  Active/Healthy:  emerald-500     Warning/Low:     amber-500
  Danger/Critical: red-500         Info:            blue-500
  Processing:      purple-500      Inactive:        slate-400

Chart Series (Recharts): Green → Blue → Amber → Red → Purple → Cyan
```

### 6.3 Typography Scale

```
Page Title:      text-2xl font-bold tracking-tight
Section Title:   text-xl font-semibold tracking-tight
Card Title:      text-base font-semibold
Subtitle:        text-sm text-muted-foreground
Body:            text-sm leading-relaxed
Caption:         text-xs text-muted-foreground
Label:           text-xs font-medium uppercase tracking-wider text-muted-foreground
KPI Value:       text-2xl font-bold tabular-nums
Badge:           text-[11px] font-semibold
Table Header:    text-xs font-medium uppercase tracking-wider text-muted-foreground
```

### 6.4 Spacing & Radius

```
4px base unit: xs=4, sm=8, md=16, lg=24, xl=32, 2xl=48
Page Padding: Mobile p-3.5, Tablet p-5, Desktop p-6, Wide p-8
Card Padding: p-5 standard, p-4 compact
Grid Gap: gap-4 standard, gap-6 between major sections

Radius: sm=0.375rem (badges), md=0.5rem (buttons/inputs), lg=0.75rem (cards),
        xl=1rem (feature cards), 2xl=1.25rem (KPI cards), full=9999px (avatars/pills)
Standard: Cards use rounded-xl. Buttons use rounded-lg.

Shadows: xs=subtle elements, sm=standard cards, md=elevated cards, lg=dialogs
```

### 6.5 Component Specifications

#### Buttons
- **Variants:** default (primary green), secondary, outline, ghost, destructive, link
- **Sizes:** sm (h-8), md (h-9, default), lg (h-10), icon (h-9 w-9)
- **Rules:** Primary action = default variant. Secondary = outline. Danger = destructive. Page CTA = lg. Table actions = sm.

#### Cards
- **Standard:** bg-card border rounded-xl shadow-xs p-5
- **KPI:** bg-card border rounded-2xl p-5. Icon (h-10 w-10 rounded-xl bg-primary/10) + Value (text-2xl font-bold) + Label (text-xs text-muted-foreground) + Trend indicator
- **Alert:** bg-{severity}/5 border-{severity}/20 with 3px left border
- **Interactive:** Standard + cursor-pointer hover:shadow-sm transition

#### Forms
- **Input:** h-9 px-3 text-sm rounded-lg border. Focus: ring-2 ring-ring. Error: border-destructive
- **Layout:** Label above (text-sm font-medium), Error below (text-xs text-destructive), space-y-2 between pairs, space-y-4 between fields
- **Dialog Forms:** Title + description top, fields in groups, footer [Cancel] [Submit] right-aligned

#### EnterpriseDataGrid
- **Header:** bg-muted/50 text-xs uppercase sticky
- **Rows:** border-b hover:bg-muted/30, height: h-12/14/16 density
- **Bulk Bar:** Fixed bottom, bg-card shadow-lg, "Selected {N}" + actions
- **Skeleton:** 5 shimmer rows matching column widths

#### Dialogs & Drawers
- **Overlay:** bg-black/50 backdrop-blur-sm
- **Dialog:** max-w-lg rounded-xl shadow-xl p-6
- **Drawer:** Slide from right, max-w-md
- **AlertDialog:** For destructive confirmations

#### Badges
- **Variants:** default, secondary, destructive, outline, success, warning, info, neutral
- **Size:** text-[11px] font-semibold px-2 py-0.5 rounded-full

#### Empty States
- **Standard:** Icon (h-14 w-14 rounded-2xl bg-muted/40) + Title (text-base font-bold) + Description + CTA
- **Compact:** Smaller icon (h-11 w-11), text-sm, py-8

#### Loading States
- **Skeleton:** Animated shimmer matching content shape
- **Spinner:** Loader2 with animate-spin (inline or full-page)
- **Progress Bar:** For known-duration operations

---

## PART 7 — VISUAL HIERARCHY

### 7.1 Content Hierarchy

Every page follows a strict top-to-bottom information priority:

```
Level 1 (Most Important):  KPI Summary Row — answers "how are we doing?"
Level 2 (High):            Alert banners — answers "what needs attention NOW?"
Level 3 (Medium):          Primary content — the main data/interaction area
Level 4 (Supporting):      Charts and analytics — visual context
Level 5 (Reference):       Related records, recent activity, history
Level 6 (Least Important): Footer actions, metadata, timestamps
```

### 7.2 Card Hierarchy

Three tiers of visual prominence:

```
Tier 1 — Hero Cards (KPIs):
  Rounded-2xl, subtle shadow, larger padding
  Primary color accent (icon background or border)
  Highest contrast text
  Maximum width: 200px per card
  Grid: 6 across on desktop, 3 on tablet, 2 on mobile

Tier 2 — Content Cards (main content):
  Rounded-xl, standard shadow, standard padding
  No accent color (neutral border)
  Standard text contrast
  Full width of container column

Tier 3 — Reference Cards (sidebar, secondary):
  Rounded-lg or borderless (bg-muted)
  Minimal shadow
  Smaller text, muted colors
  Narrow column width (1/3 of layout)
```

### 7.3 Spacing Rules

```
Between page sections:     space-y-6 (24px)
Between cards in grid:     gap-4 (16px)
Between card sections:     space-y-4 (16px)
Within card content:       space-y-3 (12px)
Between inline elements:   gap-2 (8px)
Between tight elements:    gap-1 (4px)

Vertical rhythm: Every section starts with a title, then content, then actions.
Horizontal rhythm: Content flows left-to-right with consistent column gutters.
```

### 7.4 Alignment Rules

```
Page content:   Left-aligned (never center a full page)
Section titles: Left-aligned
KPI cards:      Center-aligned text within card
Tables:         Left-aligned text, right-aligned numbers
Charts:         Left-aligned within container
Dialogs:        Center-aligned overlay, left-aligned content
Buttons:        Right-aligned in footers, left-aligned in action bars
```

### 7.5 Responsive Behavior

```
Desktop (>= 1024px):
  Sidebar visible (expanded or collapsed)
  2-column layouts where specified
  Full KPI row (6 cards)
  Standard padding (p-6 to p-8)

Tablet (768px - 1023px):
  Sidebar collapsed (icon rail only)
  2-column where possible, 1-column for complex layouts
  KPI row wraps (3+3 or 2+2+2)
  Reduced padding (p-5)

Mobile (< 768px):
  Sidebar hidden (drawer on hamburger tap)
  Bottom navigation bar visible
  Single column layout always
  KPI row: horizontal scroll or stacked
  Compact padding (p-3.5)
  Tables: Card view instead of grid view
  Dialogs: Full-screen sheets
  FAB (Floating Action Button) for primary action
```

### 7.6 Animation Principles

```
Transitions:
  Page navigation: fade-in 150ms ease-out
  Card hover: shadow transition 150ms ease
  Dialog open: scale from 95% to 100%, opacity 0 to 1, 200ms
  Dialog close: reverse, 150ms
  Drawer slide: translate-x 200ms ease-out
  Skeleton: shimmer animation 2s infinite linear
  Badge appear: scale from 0 to 1, 200ms spring
  Toast appear: slide-in from right, 300ms
  Toast dismiss: slide-out, 200ms

Rules:
  - No animation on initial page load (content appears immediately)
  - Animations only on user-initiated state changes
  - Prefer 150ms for micro-interactions, 200ms for transitions
  - Never use animation to convey information (always pair with visual change)
  - Respect prefers-reduced-motion
```

---

## PART 8 — PERFORMANCE EXPERIENCE

### 8.1 Performance Philosophy

**"The application should feel instant."** Users on rural farm networks cannot wait. Every architectural decision must optimize for perceived performance.

### 8.2 Loading Strategy

```
Page Load Sequence (user perception):
  0ms:     Sidebar + TopBar appear (persistent, never re-render)
  0-50ms:  Skeleton placeholders appear for page content
  50-200ms: Server components stream in progressively
  200-500ms: Full page rendered
  Total perceived load: < 200ms (skeleton → content)

Key Principles:
  1. Persistent Layout: Sidebar and TopBar are in the dashboard layout.
     They never re-render on page navigation. Only the {children} slot changes.

  2. Streaming SSR: Server components stream HTML as data becomes available.
     Skeleton shows immediately, content fills in as DB queries complete.

  3. Client-Side Navigation: Next.js App Router handles all in-app navigation.
     No full page reloads. No white flashes.

  4. Prefetching: When user hovers over a sidebar item, prefetch the page.
     By the time they click, data is already loaded.

  5. Optimistic UI: When user submits a form (add cattle, record weight),
     show the result immediately in the UI. Reconcile with server in background.
     Rollback only on server error.

  6. Background Refresh: Use React Query stale-while-revalidate pattern.
     Data is shown immediately from cache, refreshed in background.
     User never sees a loading spinner for data they've already seen.
```

### 8.3 Caching Strategy

```
Static Data (breeds, roles, units):
  Cache: Forever (build-time or long-lived)
  Revalidate: On settings change

Semi-Dynamic Data (cattle list, inventory):
  Cache: 60 seconds
  Revalidate: Background on stale access
  Invalidation: On mutation

Real-Time Data (dashboard KPIs, health alerts):
  Cache: 30 seconds
  Revalidate: On visibility change (refetch on tab focus)
  Supabase Realtime: Push updates for critical changes

User-Specific Data (profile, preferences):
  Cache: Session duration
  Revalidate: On mutation only
```

### 8.4 Offline Support

```
Current: Serwist (PWA) + offline sync queue
Target Enhancement:
  - Cache last 5 visited pages for offline viewing
  - Queue form submissions when offline, sync when online
  - Show offline banner with pending sync count
  - Auto-sync when connection restored
  - Critical: Health events and weight records must be storable offline
```

### 8.5 Zero Layout Shift

```
Rules:
  - Sidebar width is fixed (w-52 expanded, w-16 collapsed) — never shifts content
  - TopBar height is fixed (h-14) — never shifts content
  - KPI cards have fixed min-height — content loads into existing space
  - Tables use skeleton rows with exact height matching real rows
  - Images (cattle photos) use aspect-ratio containers to prevent shift
  - Dialogs use fixed max-width — no content-caused resizing
```

### 8.6 Performance Metrics Targets

```
Largest Contentful Paint (LCP):  < 2.5s
First Input Delay (FID):         < 100ms
Cumulative Layout Shift (CLS):   < 0.1
Time to Interactive (TTI):       < 3.5s
First Contentful Paint (FCP):    < 1.5s
Server Response Time (TTFB):     < 800ms
```

---

## PART 9 — FEATURE DISCOVERY

### 9.1 Principle: Zero Hidden Capabilities

Every backend capability must have at least one discoverable UI surface. No feature should require reading source code to know it exists.

### 9.2 Hidden Feature Exposure Map

| Hidden Feature | Where It Should Appear | How Users Discover It | Priority |
|---|---|---|---|
| **AI Prediction Engine** | Sidebar "AI Assistant" + Dashboard "AI Insights" card + floating Sparkles button | Sidebar nav item + persistent floating button + proactive dashboard card | P0 |
| **AI Recommendation Engine** | AI Assistant "Recommendations" tab + contextual cards on relevant pages (Cattle, Feed, Finance) | Contextual suggestions appear on pages they relate to | P0 |
| **AI Natural Language Query** | AI Assistant "Ask Question" tab + Command Palette "/" prefix | Command Palette AI mode + dedicated AI page tab | P1 |
| **AI Automation Proposals** | AI Assistant "Automation" tab + notification when automation is triggered | Proactive notifications when automations fire | P1 |
| **AI Nutrition Advisor** | Feed Planning page sidebar + AI Insights on Dashboard | Embedded in Feed Planning as "AI Suggestion" card | P1 |
| **KPI Engine** | Dashboard KPI row + each page's summary row | Primary dashboard content + page-level KPI cards | P0 |
| **Custom Report Engine** | Reports page "Generate Report" flow | Reports page template selector | P1 |
| **BI Engine** | Analytics & BI sidebar group + Dashboard charts | New "Analytics & BI" sidebar section with dashboards | P1 |
| **Workflow Engine** | Sidebar "Workflows" + "Create Workflow" in Quick Create (+) menu | Sidebar nav + Quick Create dropdown | P1 |
| **Bulk Import Engine** | Inventory "Bulk Import" button + Cattle page "Import" action | Prominent button on list pages + Quick Create menu | P1 |
| **Vital Signs Recording** | Health Hub "Record Vitals" action + Cattle Detail "Health" tab | Button in Health Hub + tab in Cattle Detail | P1 |
| **Prescription Management** | Health Hub "Prescriptions" sub-tab + Cattle Detail medical panel | Tab within Health Hub | P2 |
| **Profitability Engine** | Finance "P&L Analysis" tab + Cattle Detail "Feed & Cost" tab | Embedded in existing finance and cattle pages | P1 |
| **Cost Allocation Engine** | Finance "Costs" tab + Settings "Cost Allocation Rules" | Finance tab + Settings sub-page | P2 |
| **Data Governance Engine** | Operations page "Data Quality" section + Settings "Data Management" | Operations sub-section + Settings page | P2 |
| **QR Code Generation** | Cattle Detail header + Cattle list row action "Download QR" | Button on cattle detail + row action menu | P2 |
| **Onboarding Wizard** | First login detection → auto-trigger | Automatic on first login, restartable from Settings | P2 |
| **Contextual Tooltips** | Every KPI card, every chart, every agricultural metric | Hover/tap on info icons next to metrics | P2 |
| **Feature Flags UI** | Settings "Feature Flags" section | Settings sub-page for Owners | P2 |
| **Audit Log Viewer** | Operations "Audit Trail" tab + Cattle Detail "Activity" tab | Operations page + cattle detail tab | P2 |

### 9.3 Discovery Mechanisms

```
1. Sidebar Navigation:   Primary discovery. Every feature gets a nav item or child item.
2. Command Palette:       Secondary discovery. Every feature searchable via Cmd+K.
3. Quick Create Menu:     Action discovery. Common creation actions in (+) dropdown.
4. Contextual Cards:      Proactive discovery. AI/BI insights appear on relevant pages.
5. Notifications:         Passive discovery. "New feature: AI Assistant is now available"
6. Onboarding Tour:       Guided discovery. First-login walkthrough highlights key features.
7. Empty States:          Triggered discovery. "No reports yet. Generate your first report."
8. Tooltips:              Micro discovery. Info icons explain metrics and features.
```

---

## PART 10 — PAGE PRIORITY

### 10.1 Priority Ranking

Every page ranked by: Why redesign first, UX impact, business impact, and implementation complexity.

#### CRITICAL PRIORITY (P0) — Redesign First

| Page | Why First | UX Impact | Business Impact | Complexity |
|---|---|---|---|---|
| **Dashboard** | First screen 80% of time. Sets tone for entire product. All KPIs live here. | Very High — affects every session | Very High — primary decision-making surface | Medium |
| **Cattle Management** | Most-used page. 5-10x daily by farm staff. Core business entity. | Very High — daily tool for all staff | Very High — herd management is the business | Medium |
| **Cattle Detail** | Decision hub for every individual animal. 10-20x daily. | Very High — every animal interaction | Very High — individual animal decisions | Medium |
| **Health Hub** | Time-critical. Overdue events = dead animals. | Very High — lives depend on it | Very High — mortality directly impacts revenue | High |
| **Finance** | Financial health = business survival. Currently broken (600+ lines, duplicates). | Very High — weekly decision-making | Very High — profitability analysis | High (decomposition) |
| **Reports** | BROKEN (404). Sidebar links to missing page. Must be rebuilt. | High — executive visibility | High — stakeholder reporting | Medium (build from scratch) |
| **AI Assistant** | Massive backend investment with zero visibility. Highest ROI opportunity. | Very High — proactive intelligence | Very High — AI predictions save money/lives | High (new UI) |
| **Inventory** | Feed is largest variable cost. Stockouts halt operations. | High — daily tool | Very High — operational continuity | Medium |
| **Notifications** | Central alert center. Prevents missed critical events. | High — awareness | High — prevents losses | Low |

#### HIGH PRIORITY (P1) — Redesign Second

| Page | Why | UX Impact | Business Impact | Complexity |
|---|---|---|---|---|
| **Breeding Hub** | Revenue-driving. Conception rates = herd growth = revenue. | High | High | Medium |
| **Feed Planning** | Largest variable cost optimization. AI Nutrition Advisor hidden. | High | High | Medium |
| **Accounting** | Compliance + financial accuracy. | Medium | High | Low |
| **Partners** | Investor relations. Equity management. | Medium | Medium-High | Low |
| **Commerce** | HIDDEN from navigation. Revenue generation. | Medium | High | Medium |
| **Vendors** | HIDDEN from navigation. Procurement efficiency. | Medium | Medium | Low |
| **Compliance** | HIDDEN from navigation. Regulatory risk. | Medium | Medium-High | Low |
| **Analytics & BI** | HIDDEN. KPI engine + BI engine unused. | Medium | High | High (new section) |
| **Workflow Engine** | HIDDEN. 7 template categories unused. | Medium | High | High (new UI) |
| **Pen Management** | Operational daily tool. | Medium | Medium | Low |

#### MEDIUM PRIORITY (P2) — Redesign Third

| Page | Why | UX Impact | Business Impact | Complexity |
|---|---|---|---|---|
| **Settings** | One-time setup. Currently 800+ lines needing decomposition. | Medium | Low-Medium | Medium (decomposition) |
| **Operations** | HIDDEN. System monitoring for admins. | Low-Medium | Low-Medium | Low |
| **Cattle Analytics** | Strategic insights. Used weekly. | Medium | Medium | Medium |
| **Accounting Subpages** | Income Statement, Balance Sheet, etc. | Low-Medium | Medium | Low (follow accounting pattern) |
| **Growth Analytics** | Long-term planning. Monthly use. | Low | Medium | Medium |
| **Audit Log** | HIDDEN. Compliance requirement. | Low | Medium | Low |
| **Onboarding Wizard** | New user experience. | Medium | Medium | Medium |

---

## PART 11 — IMPLEMENTATION ROADMAP

### 11.1 Phased Strategy

5 phases. Each must be substantially complete before the next begins.

### Phase 0: Foundation (Week 1-2)

**Goal:** Fix broken things and establish design system foundations.

Deliverables:
1. Fix Report page (create /dashboard/report/page.tsx) — eliminates 404
2. Add missing sidebar items (Commerce, Vendors, Compliance, Notifications, Operations)
3. Audit and consolidate design tokens (color, typography, spacing, radius)
4. Standardize all existing EmptyState, PageHeader, and loading skeleton usage
5. Fix notification bell to link to /dashboard/notifications

Dependencies: None — foundation for everything. Must complete before Phase 1.

### Phase 1: Core Experience (Week 3-6)

**Goal:** Redesign the 5 most-used pages.

Deliverables:
1. **Dashboard** — KPI row (6 cards), "What Needs Attention", Financial Snapshot, AI Insights card, 2-col responsive layout
2. **Cattle Management** — Tab bar, unified EnterpriseDataGrid, bulk action bar, filter toolbar
3. **Cattle Detail** — Tab structure (Overview/Weight/Health/Breeding/Feed/Photos/Activity), summary cards, charts, lifecycle timeline
4. **Health Hub** — Alert banner, date-grouped event cards, right sidebar (medicine stock + calendar)
5. **Inventory** — Tab bar, EnterpriseDataGrid with inline stock editing, bulk import button

Dependencies: Phase 0. Must complete before Phase 2 (these are daily-use tools).

### Phase 2: Intelligence & Navigation (Week 7-10)

**Goal:** Surface hidden capabilities and improve navigation.

Deliverables:
1. **Command Palette** — All 25+ pages, recent pages, AI query mode, category headers
2. **AI Assistant** — /dashboard/ai with Insights/Predictions/Recommendations/Ask/Automation tabs
3. **Notifications** — Bell badge in TopBar, redesigned /notifications page, date-grouped cards
4. **Sidebar** — 5 groups, [NEW] badges, role filtering, Pinned/Recent footer
5. **Finance decomposition** — Split into tab-based layout (Overview/Costs/Revenue/P&L/Trends/AI)

Dependencies: Phase 1 (Dashboard must exist for AI Insights card).

### Phase 3: Deep Features (Week 11-14)

**Goal:** Complete business module redesigns and expose remaining hidden capabilities.

Deliverables:
1. **Breeding Hub** — Calendar view, list view, AI breeding insights, semen inventory
2. **Accounting** — Tab-based (Journal/Accounts/Trial Balance/Statements/Assets)
3. **Partners & Equity** — Two-panel layout, statement generator
4. **Reports** — Build from scratch: type selector, period picker, streaming generation, PDF/Excel export
5. **Commerce** — Add to sidebar, orders EnterpriseDataGrid, invoice management
6. **Settings** — Split into sub-routes with left sidebar nav

Dependencies: Phase 2. Sidebar redesign must be in place.

### Phase 4: Advanced Intelligence (Week 15-18)

**Goal:** Full AI/BI surface and workflow automation.

Deliverables:
1. **Analytics & BI dashboard** — KPI engine visualizations, custom report builder, BI dashboards
2. **Workflow Engine UI** — Template library, active workflows grid, simple builder
3. **Bulk Import wizard** — CSV upload, column mapping, validation, progress
4. **Audit Log viewer** — Filterable audit trail in Operations
5. **AI-powered context** — AI suggestions on Cattle Detail, Nutrition on Feed Planning, Cost on Finance

Dependencies: Phase 3. AI Assistant page must exist.

### Phase 5: Polish & Scale (Week 19-22)

**Goal:** Enterprise-grade polish, mobile optimization, onboarding.

Deliverables:
1. **Mobile optimization** — Responsive testing, card view for tables, FAB, bottom nav
2. **Onboarding wizard** — First-login tour, "What's new" notifications, contextual tooltips
3. **Keyboard shortcuts** — Full audit, shortcuts modal (Cmd+/), Alt+E emergency health
4. **Animation polish** — Consistent transitions, prefers-reduced-motion, micro-interactions
5. **Performance** — Prefetching, React Query optimization, layout shift fixes, Lighthouse 90+

Dependencies: Phase 4. All pages redesigned.

### 11.2 Dependency Graph

```
Phase 0 ──→ Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4 ──→ Phase 5
(Foundation)   (Core)      (Intel)     (Deep)      (AI/BI)     (Polish)
```

### 11.3 Component Build Order

Components must be built in dependency order:

```
Tier 0 (No deps):      Design tokens, color system, typography scale
Tier 1 (→ Tier 0):     Button, Badge, Input variants
Tier 2 (→ Tier 1):     Cards (Standard/KPI/Alert/Interactive), EmptyState, Skeleton, Loading
Tier 3 (→ Tier 2):     EnterpriseDataGrid, Forms (Dialog/Drawer/AlertDialog), PageContainer/Header/Content
Tier 4 (→ Tier 3):     Dashboard layout, List page pattern, Detail page pattern
Tier 5 (→ Tier 4):     Specific pages (Dashboard, Cattle, Health, AI, Reports, Workflows)
```

### 11.4 Backend Capabilities Exposure Order

```
Phase 0: Notifications (link to existing page)
Phase 1: KPI Engine (Dashboard + page-level KPIs)
Phase 2: AI Prediction/Recommendation Engines, Custom Reports
Phase 3: BI Engine, Profitability Engine, Bulk Import Engine
Phase 4: Workflow Engine, Cost Allocation, Audit Log, Data Governance
Phase 5: AI Natural Language, AI Automation, Contextual Tooltips, Feature Flags
```

---

## APPENDIX A — CURRENT vs TARGET STATE

### Navigation

| Aspect | Current | Target |
|--------|---------|--------|
| Sidebar items visible | 12 | 25+ |
| Hidden pages | 6 | 0 |
| Sidebar groups | 3 | 5 |
| Command Palette pages | 7 | 25+ |
| Keyboard shortcuts | 6 | 15+ |
| Role filtering | Basic | Full |

### Pages

| Aspect | Current | Target |
|--------|---------|--------|
| Dashboard KPIs | Variable | 6 standardized cards |
| Cattle filters | Basic | Tab bar + advanced toolbar |
| Finance | 600+ lines, duplicates | Tab-based, decomposed |
| Settings | 800+ lines, monolithic | Sub-routes with sidebar |
| Health Hub | Basic list | Alert banner + cards + sidebar |
| AI visibility | Zero | Sidebar + Dashboard + floating button |
| Reports | 404 broken | Full generation with export |
| Empty states | 3+ implementations | 1 shared component |

---

## APPENDIX B — MEASURING SUCCESS

### Quantitative Targets

```
Feature Utilization:   58% → 85% (Phase 2) → 95% (Phase 4)
Page Error Rate:       0% (after Phase 0)
Time to First Action:  < 10 seconds from login
Daily Active Features: Avg 8 per session (up from ~4)
Mobile Usability:      Lighthouse 90+ (after Phase 5)
```

### Qualitative Targets

```
User Confidence:       "I know where everything is"
Feature Discovery:     "I learned about a new feature this week"
Task Satisfaction:     "That was easy/fast"
Visual Consistency:    "Every page belongs to the same product"
```

---

*Master UX Blueprint generated by analyzing 900+ source files, the complete Product Architecture Audit, and current navigation/layout implementation. No files were modified. This document is the single source of truth for all future design and implementation decisions.*