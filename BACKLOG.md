# FreightDesk Backlog — sorted by priority

Source: Improvements.pdf (Jose, Jul 3 2026) + build council roadmap.
Rule: work top to bottom. Check items off as they ship.

## P0 — Blockers (do first, app must work live)

- [ ] **Deploy the app live** (see deploy guide) — until deployed, only localhost works
- [x] **Fix "failing to save load"** — ROOT CAUSE FOUND (2026-07-03): the lanes table
      only allowed reads, not inserts (missing RLS policy), so creating the lane
      during save was always rejected. Fixed in migration 0006 and verified with a
      live test insert as an authenticated user. Also fixed the error display so
      real database messages show instead of "Something went wrong."
- [ ] **Create login users** in Supabase dashboard (Authentication → Users)

## P1 — Core workflow (Shipments is the money screen)

- [x] **Shipments: full shipment details form** — shipper & consignee blocks,
      equipment, commodity, weight, BOL #, customer, carrier; "Fill from customer"
      auto-populates pickup / ship-to addresses (shipped 2026-07-03)
- [x] **Shipments: edit existing shipments** (Edit button reopens full form)
- [x] **BOL PDF generator** — zero-dependency PDF engine recreating the template
      layout; per-row BOL button + multi-select → Generate BOLs downloads one PDF
      per shipment. Blank fields (trailer #, seal #) print as fill-in lines.
      Follow-up if needed: true in-PDF editable form fields (AcroForm).
- [x] **Shipments: "Active" quick filter** (default view, hides delivered/exception),
      column sorting on every column, Age column (amber when >7 days old)
- [x] **Shipments: archive delivered/done shipments** (+ Archived toggle)

## P2 — Usability across modules

- [x] **Shipments: "pending" status added and made the default** (2026-07-03, pt3 list)
- [x] **Shipments: transportation type per shipment** — FTL, LTL, Container, Direct LTL,
      Domestic, Direct Domestic, Direct Truckload — with table column and CSV
      import/export support (2026-07-03, pt3 list)
- [x] **Shipments: pickup and delivery date &amp; time columns** — form now captures
      time of day too (2026-07-03, pt3 list)
- [x] **Customers: edit additional addresses + facility type, business hours, and
      special instructions per address** (2026-07-03, pt3 list)

- [x] **BOL: bottom section rebuilt to match template screenshot** — declared value,
      COD amount + fee terms, liability note (49 USC § 14706), received-subject-to
      text, and the 4-cell signature row with full wording (2026-07-03)
- [x] **Inventory: add item with warehouse location + opening stock** in one step (2026-07-03)
- [x] **Inventory: bulk movements** — check multiple SKUs, per-SKU quantities, one
      shared warehouse/type/load ref (2026-07-03)

- [x] **Search + filters + column sorting** on Drop Trailers (incl. site filter),
      Tasks (incl. assignee filter), and Inventory (warehouse + low-stock filters) (2026-07-03)
- [x] **Export CSV on every module** — Shipments, Trailers, Inventory, Customers,
      Carriers, Tasks (2026-07-03). Import (CSV upload) still to do:
- [x] **Import CSV** into Customers, Carriers, and Inventory items — flexible column
      matching, preview with per-row problem report before importing (2026-07-03)
- [x] **Drop Trailers: per-site breakdown** — expandable summary table; click a site
      to filter the board (2026-07-03)
- [x] **Drop Trailers: archive gated-out trailers** (2026-07-03)
- [x] **Tasks: edit tasks, age column, "Scheduled" filter for future due dates** (2026-07-03)
- [x] **Customers: multiple addresses per customer** — address book on the Edit
      customer form; saved addresses appear in the shipment form's "Fill from
      customer" dropdown (e.g. "Acme — Dallas DC") (2026-07-03)
- [x] **Inventory: + Add warehouse button** (was SQL-only before) (2026-07-03)
- [x] **Import CSV on Shipments and Tasks** — shipments match customer/carrier
      names automatically; invalid statuses default safely (2026-07-03)
- [x] **Carriers: add "Freight forwarder" and "Customs broker" to mode list** (2026-07-03)
- [x] **Dashboard: diesel price widget** (EIA weekly diesel API) — DieselWidget
      recovered from the parallel branch during the 2026-07-03 merge, wired into
      the Dashboard; reads VITE_EIA_API_KEY from .env (Jose pastes the key)

## P3 — Business growth (council roadmap)

- [x] **Margin tracking** — carrier pay field on the shipment form with live margin
      preview, color-coded Margin column on the board, Booked Margin KPI on the
      dashboard (2026-07-03)
- [x] **Invoicing / AR aging** — new Billing page: create invoices on delivered
      loads (auto invoice #, Net-30 default due date), mark paid/undo, KPI cards
      (ready to invoice / outstanding / overdue / collected), 0-30/31-60/61-90/90+
      aging buckets, days-outstanding column, CSV export (2026-07-03)
- [x] **Notifications** — "Needs attention" alert center on the Dashboard: expired/
      expiring COIs, overdue invoices, 48h+ trailer dwell, low stock, overdue tasks,
      each linking to its module (2026-07-03)
- [x] **Role-based access — foundation** — roles on profiles (admin/dispatcher/
      warehouse/accounting/viewer), my_role() helper, activation playbook in
      migration 0011. Policies stay permissive until the first hire — flip them
      then using the documented steps. Also hardened all DB functions per the
      Supabase security advisor (migration 0012) (2026-07-03)
- [ ] **Role-based access — activation** — when hiring: assign roles, tighten
      table policies per migration 0011 comments
- [ ] **Customer portal** — read-only tracking + inventory per customer (build when
      a customer asks for it)
- [ ] **Enable leaked-password protection** — Supabase dashboard → Authentication →
      Providers → Password (one click, Jose to do)

## Done

- [x] Drop Trailers module (yard board, gate in/out, dwell alerts)
- [x] Inventory module (warehouses, SKUs, levels, movement ledger)
- [x] CRUD on Customers, Carriers, Tasks; document uploads; dashboard KPIs
- [x] Fixed .env URL typo, stale types, status constraint, view RLS bypass
- [x] BOL template + improvements list saved to `templates/`
