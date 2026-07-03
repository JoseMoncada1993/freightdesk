import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import ImportCsvModal from "@/components/ImportCsvModal";
import { supabase } from "@/lib/supabase";
import DataTable from "@/components/DataTable";
import StatCard from "@/components/ui/StatCard";
import Badge from "@/components/ui/Badge";
import Modal, { Field, ModalActions, ErrorText, inputCls } from "@/components/ui/Modal";
import {
  useAddInventoryItem,
  useAddWarehouse,
  useInventoryItems,
  useInventoryLevels,
  useInventoryMovements,
  useRecordMovement,
  useWarehouses,
} from "@/hooks/useInventory";
import { useCustomers } from "@/hooks/useTables";
import { exportCsv, exportButtonProps } from "@/lib/csv";
import type { InventoryLevelEnriched, InventoryMovementEnriched, MovementType } from "@/lib/types";

const num = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString());

function AddWarehouseForm({ onClose }: { onClose: () => void }) {
  const add = useAddWarehouse();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address1, setAddress1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [dockDoors, setDockDoors] = useState("");
  const [trailerSpots, setTrailerSpots] = useState("");

  const canSubmit = code.trim() !== "" && name.trim() !== "" && !add.isPending;

  const handleSubmit = () =>
    add.mutate(
      {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        address1: address1.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        zip_code: zip.trim() || null,
        dock_doors: dockDoors ? Number(dockDoors) : null,
        trailer_spots: trailerSpots ? Number(trailerSpots) : null,
      },
      { onSuccess: onClose },
    );

  return (
    <Modal
      title="Add warehouse"
      onClose={onClose}
      footer={
        <ModalActions onCancel={onClose} onSubmit={handleSubmit} submitLabel="Add warehouse" pending={add.isPending} disabled={!canSubmit} />
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Code * (short ID, e.g. HOU-01)">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="HOU-01" className={inputCls} />
        </Field>
        <Field label="Name *">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Houston Distribution Center" className={inputCls} />
        </Field>
      </div>
      <Field label="Address">
        <input value={address1} onChange={(e) => setAddress1(e.target.value)} className={inputCls} />
      </Field>
      <div className="grid grid-cols-3 gap-4">
        <Field label="City">
          <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
        </Field>
        <Field label="State">
          <input value={state} onChange={(e) => setState(e.target.value)} className={inputCls} />
        </Field>
        <Field label="ZIP">
          <input value={zip} onChange={(e) => setZip(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Dock doors">
          <input value={dockDoors} onChange={(e) => setDockDoors(e.target.value)} inputMode="numeric" className={inputCls} />
        </Field>
        <Field label="Trailer spots">
          <input value={trailerSpots} onChange={(e) => setTrailerSpots(e.target.value)} inputMode="numeric" className={inputCls} />
        </Field>
      </div>
      <ErrorText error={add.error} />
    </Modal>
  );
}

function AddItemForm({ onClose }: { onClose: () => void }) {
  const customers = useCustomers();
  const warehouses = useWarehouses();
  const add = useAddInventoryItem();
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [uom, setUom] = useState("pallet");
  const [weight, setWeight] = useState("");
  const [value, setValue] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [initialQty, setInitialQty] = useState("");

  const wantsStock = warehouseId !== "" || initialQty !== "";
  const stockValid = !wantsStock || (warehouseId !== "" && Number(initialQty) > 0);
  const canSubmit = sku.trim() !== "" && description.trim() !== "" && stockValid && !add.isPending;

  const handleSubmit = () =>
    add.mutate(
      {
        sku: sku.trim(),
        description: description.trim(),
        customer_id: customerId ? Number(customerId) : null,
        uom: uom.trim() || "pallet",
        unit_weight_lbs: weight ? Number(weight) : null,
        unit_value_usd: value ? Number(value) : null,
        initialWarehouseId: warehouseId ? Number(warehouseId) : undefined,
        initialQty: initialQty ? Number(initialQty) : undefined,
      },
      { onSuccess: onClose },
    );

  return (
    <Modal
      title="Add inventory item"
      onClose={onClose}
      footer={
        <ModalActions onCancel={onClose} onSubmit={handleSubmit} submitLabel="Add item" pending={add.isPending} disabled={!canSubmit} />
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="SKU *">
          <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU-1009" className={inputCls} />
        </Field>
        <Field label="Unit of measure">
          <input value={uom} onChange={(e) => setUom(e.target.value)} placeholder="pallet" className={inputCls} />
        </Field>
      </div>
      <Field label="Description *">
        <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
      </Field>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Customer (owner)">
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {(customers.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name ?? c.company_name ?? `#${c.id}`}</option>
            ))}
          </select>
        </Field>
        <Field label="Unit weight (lbs)">
          <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" className={inputCls} />
        </Field>
        <Field label="Unit value ($)">
          <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" className={inputCls} />
        </Field>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-700 mb-3">Opening stock (optional) — receive this item into a warehouse now</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Warehouse location">
            <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputCls}>
              <option value="">— none yet —</option>
              {(warehouses.data ?? []).map((w) => (
                <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Quantity on hand">
            <input value={initialQty} onChange={(e) => setInitialQty(e.target.value)} inputMode="decimal" placeholder="e.g. 20" className={inputCls} />
          </Field>
        </div>
        {wantsStock && !stockValid && (
          <p className="mt-2 text-xs text-amber-600">Pick a warehouse and a quantity greater than 0 (or clear both).</p>
        )}
      </div>
      <ErrorText error={add.error} />
    </Modal>
  );
}

function MovementForm({ onClose }: { onClose: () => void }) {
  const warehouses = useWarehouses();
  const items = useInventoryItems();
  const record = useRecordMovement();
  const [warehouseId, setWarehouseId] = useState("");
  const [movementType, setMovementType] = useState<MovementType>("inbound");
  const [loadRef, setLoadRef] = useState("");
  const [notes, setNotes] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  // itemId -> qty text; presence in the map means the SKU is selected
  const [qtys, setQtys] = useState<Record<number, string>>({});

  const list = (items.data ?? []).filter((i) => {
    if (!itemSearch.trim()) return true;
    const q = itemSearch.trim().toLowerCase();
    return i.sku.toLowerCase().includes(q) || i.description.toLowerCase().includes(q);
  });

  const toggleItem = (id: number) =>
    setQtys((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = "";
      return next;
    });

  const chosen = Object.entries(qtys).map(([id, q]) => ({ itemId: Number(id), qty: Number(q) }));
  const canSubmit =
    warehouseId !== "" &&
    chosen.length > 0 &&
    chosen.every((c) => !Number.isNaN(c.qty) && c.qty !== 0) &&
    !record.isPending;

  const handleSubmit = () =>
    record.mutate(
      {
        warehouseId: Number(warehouseId),
        movementType,
        items: chosen,
        loadRef: loadRef.trim() || undefined,
        notes: notes.trim() || undefined,
      },
      { onSuccess: onClose },
    );

  return (
    <Modal
      title="Record movement (one or many SKUs)"
      onClose={onClose}
      wide
      footer={
        <ModalActions
          onCancel={onClose}
          onSubmit={handleSubmit}
          submitLabel={chosen.length > 1 ? `Record ${chosen.length} movements` : "Record"}
          pending={record.isPending}
          disabled={!canSubmit}
        />
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Warehouse *">
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={inputCls}>
            <option value="">Select…</option>
            {(warehouses.data ?? []).map((w) => (
              <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select value={movementType} onChange={(e) => setMovementType(e.target.value as MovementType)} className={inputCls}>
            <option value="inbound">Inbound (receive)</option>
            <option value="outbound">Outbound (ship)</option>
            <option value="adjustment">Adjustment (+/-)</option>
          </select>
        </Field>
        <Field label="Load ref (applies to all)">
          <input value={loadRef} onChange={(e) => setLoadRef(e.target.value)} placeholder="LD-2101" className={inputCls} />
        </Field>
        <Field label="Notes (applies to all)">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
        </Field>
      </div>

      <Field label={`Items * — check one or more SKUs and enter a quantity for each (${chosen.length} selected)`}>
        <input
          value={itemSearch}
          onChange={(e) => setItemSearch(e.target.value)}
          placeholder="Search SKU or description…"
          className={`${inputCls} mb-2`}
        />
        <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
          {list.length === 0 && <div className="p-3 text-sm text-slate-400">No items match.</div>}
          {list.map((i) => {
            const isSel = i.id in qtys;
            return (
              <div key={i.id} className={`flex items-center gap-3 px-3 py-2 ${isSel ? "bg-blue-50" : ""}`}>
                <input type="checkbox" checked={isSel} onChange={() => toggleItem(i.id)} className="rounded border-slate-300" />
                <span className="text-sm flex-1">
                  <span className="font-medium">{i.sku}</span>
                  <span className="text-slate-500"> — {i.description}</span>
                </span>
                {isSel && (
                  <input
                    value={qtys[i.id]}
                    onChange={(e) => setQtys((prev) => ({ ...prev, [i.id]: e.target.value }))}
                    inputMode="decimal"
                    placeholder={movementType === "adjustment" ? "-3 or 5" : "qty"}
                    className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
                  />
                )}
              </div>
            );
          })}
        </div>
      </Field>
      <ErrorText error={record.error} />
    </Modal>
  );
}

export default function Inventory() {
  const levels = useInventoryLevels();
  const movements = useInventoryMovements();
  const warehouses = useWarehouses();
  const qc = useQueryClient();
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddWarehouse, setShowAddWarehouse] = useState(false);
  const [showMovement, setShowMovement] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [lowOnly, setLowOnly] = useState(false);

  const all = levels.data ?? [];
  const rows = useMemo(() => {
    let out = all;
    if (warehouseFilter !== "all") out = out.filter((r) => r.warehouse_code === warehouseFilter);
    if (lowOnly) out = out.filter((r) => r.low_stock);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((r) =>
        [r.sku, r.description, r.customer_name, r.warehouse_code]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    return out;
  }, [all, search, warehouseFilter, lowOnly]);

  const totalOnHand = all.reduce((s, r) => s + (r.qty_on_hand ?? 0), 0);
  const lowStock = all.filter((r) => r.low_stock).length;
  const skus = new Set(all.map((r) => r.sku)).size;

  const doExport = () =>
    exportCsv(
      rows.map((r) => ({
        sku: r.sku, description: r.description, customer: r.customer_name,
        warehouse: r.warehouse_code, on_hand: r.qty_on_hand, allocated: r.qty_allocated,
        available: r.qty_available, reorder_point: r.reorder_point, low_stock: r.low_stock,
      })),
      "inventory_levels",
    );

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="On-hand levels by warehouse, with movement ledger"
        action={
          <div className="flex gap-2 flex-wrap justify-end">
            <button onClick={doExport} {...exportButtonProps(rows.length)}>Export CSV</button>
            <button
              onClick={() => setShowImport(true)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Import CSV
            </button>
            <button
              onClick={() => setShowAddWarehouse(true)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              + Add warehouse
            </button>
            <button
              onClick={() => setShowAddItem(true)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              + Add item
            </button>
            <button
              onClick={() => setShowMovement(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Record movement
            </button>
          </div>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Active SKUs" value={levels.isLoading ? "…" : skus} />
        <StatCard label="Units on hand" value={levels.isLoading ? "…" : totalOnHand.toLocaleString()} hint="across all warehouses" />
        <StatCard label="Low stock lines" value={levels.isLoading ? "…" : lowStock} hint="at or below reorder point" />
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search SKU, description, customer…"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="all">All warehouses</option>
          {(warehouses.data ?? []).map((w) => (
            <option key={w.id} value={w.code}>{w.code}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} className="rounded border-slate-300" />
          Low stock only
        </label>
      </div>

      <h2 className="font-semibold mb-3">Stock levels</h2>
      <DataTable<InventoryLevelEnriched>
        rows={rows}
        isLoading={levels.isLoading}
        error={levels.error}
        rowKey={(r) => r.id ?? Math.random()}
        empty="No inventory yet — add an item and record an inbound movement."
        columns={[
          { header: "SKU", cell: (r) => <span className="font-medium">{r.sku}</span>, sort: (r) => r.sku },
          { header: "Description", cell: (r) => r.description ?? "—", sort: (r) => r.description },
          { header: "Customer", cell: (r) => r.customer_name ?? "—", sort: (r) => r.customer_name },
          { header: "Warehouse", cell: (r) => r.warehouse_code ?? "—", sort: (r) => r.warehouse_code },
          { header: "On hand", cell: (r) => num(r.qty_on_hand), sort: (r) => r.qty_on_hand },
          { header: "Allocated", cell: (r) => num(r.qty_allocated), sort: (r) => r.qty_allocated },
          { header: "Available", cell: (r) => num(r.qty_available), sort: (r) => r.qty_available },
          { header: "Reorder pt", cell: (r) => num(r.reorder_point), sort: (r) => r.reorder_point },
          {
            header: "Alert",
            cell: (r) =>
              r.low_stock ? (
                <span className="inline-block rounded-full bg-red-100 text-red-700 px-2.5 py-0.5 text-xs font-medium">Low stock</span>
              ) : (
                <span className="text-slate-300">—</span>
              ),
          },
        ]}
      />

      <h2 className="font-semibold mt-8 mb-3">Recent movements</h2>
      <DataTable<InventoryMovementEnriched>
        rows={movements.data}
        isLoading={movements.isLoading}
        error={movements.error}
        rowKey={(r) => r.id ?? Math.random()}
        empty="No movements recorded yet."
        columns={[
          { header: "When", cell: (r) => (r.occurred_at ? new Date(r.occurred_at).toLocaleString() : "—"), sort: (r) => r.occurred_at },
          { header: "Type", cell: (r) => <Badge value={r.movement_type} />, sort: (r) => r.movement_type },
          { header: "SKU", cell: (r) => r.sku ?? "—", sort: (r) => r.sku },
          { header: "Warehouse", cell: (r) => r.warehouse_code ?? "—", sort: (r) => r.warehouse_code },
          { header: "Qty", cell: (r) => num(r.qty) },
          { header: "Load ref", cell: (r) => r.load_ref ?? "—" },
          { header: "Notes", cell: (r) => r.notes ?? "—" },
        ]}
      />

      {showAddItem && <AddItemForm onClose={() => setShowAddItem(false)} />}
      {showAddWarehouse && <AddWarehouseForm onClose={() => setShowAddWarehouse(false)} />}
      {showMovement && <MovementForm onClose={() => setShowMovement(false)} />}
      {showImport && (
        <ImportCsvModal
          title="Import inventory items from CSV"
          fields={[
            { key: "sku", aliases: ["sku"], required: true },
            { key: "description", aliases: ["description", "desc"], required: true },
            { key: "uom", aliases: ["uom", "unit"] },
            { key: "unit_weight_lbs", aliases: ["unit_weight_lbs", "weight"] },
            { key: "unit_value_usd", aliases: ["unit_value_usd", "value"] },
          ]}
          exampleHeader="sku, description, uom, unit_weight_lbs, unit_value_usd"
          toPayload={(r) => ({
            sku: r.sku,
            description: r.description,
            uom: r.uom || "pallet",
            unit_weight_lbs: r.unit_weight_lbs ? Number(r.unit_weight_lbs) || null : null,
            unit_value_usd: r.unit_value_usd ? Number(r.unit_value_usd) || null : null,
          })}
          onImport={async (importRows) => {
            const { error: e } = await supabase.from("inventory_items").insert(importRows as never);
            if (e) throw e;
            qc.invalidateQueries({ queryKey: ["inventory_items"] });
            qc.invalidateQueries({ queryKey: ["inventory_levels"] });
          }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
