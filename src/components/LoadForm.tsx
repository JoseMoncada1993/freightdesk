// Full shipment form: add or edit a load with shipper/consignee details,
// customer auto-fill, carrier assignment, and an auto-quote from ZIP mileage.
import { useMemo, useState } from "react";
import Modal, { Field, ModalActions, ErrorText, inputCls } from "@/components/ui/Modal";
import { estimateMiles, estimateQuote, DEFAULT_RATE_PER_MILE, DEFAULT_FUEL_PCT, DEFAULT_MIN_CHARGE } from "@/lib/distance";
import { useSaveFullLoad } from "@/hooks/useMutations";
import { useCarriers, useCustomerAddresses, useCustomers } from "@/hooks/useTables";
import { LOAD_STATUSES, TRANSPORT_TYPES } from "@/lib/types";
import type { Customer, CustomerAddress, LoadEnriched } from "@/lib/types";

const EQUIPMENT = ["Dry van 53'", "Dry van 48'", "Reefer", "Flatbed", "Step deck", "Box truck", "Sprinter", "Container", "Other"];

// Suggestions for the freight "Type" field (handling-unit / service type). Free
// text — the input stays editable so any value can be entered.
const FREIGHT_TYPES = ["LTL", "FTL", "Pallets", "Boxes", "Crates", "Cases", "Drums", "Rolls", "Loose", "Skids"];

interface LoadFormProps {
  load: LoadEnriched | null; // null = add
  onClose: () => void;
}

interface Party {
  name: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  contact: string;
  phone: string;
}

const emptyParty: Party = { name: "", address1: "", address2: "", city: "", state: "", zip: "", contact: "", phone: "" };

function partyFromCustomer(c: Customer): Party {
  return {
    name: c.company_name || c.name || "",
    address1: c.address1 ?? "",
    address2: c.address2 ?? "",
    city: c.city ?? "",
    state: c.state ?? "",
    zip: c.zip_code ?? "",
    contact: [c.first_name, c.last_name].filter(Boolean).join(" ") || (c.name ?? ""),
    phone: c.contact_phone ?? "",
  };
}

function partyFromAddress(c: Customer | undefined, a: CustomerAddress): Party {
  return {
    name: `${c?.company_name || c?.name || ""}${a.label ? ` - ${a.label}` : ""}`.trim(),
    address1: a.address1 ?? "",
    address2: a.address2 ?? "",
    city: a.city ?? "",
    state: a.state ?? "",
    zip: a.zip_code ?? "",
    contact: a.contact_name ?? "",
    phone: a.contact_phone ?? "",
  };
}

function PartyFields({
  title, party, set, customers, addresses, onFill,
}: {
  title: string;
  party: Party;
  set: (p: Party) => void;
  customers: Customer[];
  addresses: CustomerAddress[];
  onFill: (p: Party) => void;
}) {
  const [fillId, setFillId] = useState("");

  const applyFill = () => {
    if (fillId.startsWith("c:")) {
      const c = customers.find((x) => String(x.id) === fillId.slice(2));
      if (c) onFill(partyFromCustomer(c));
    } else if (fillId.startsWith("a:")) {
      const a = addresses.find((x) => String(x.id) === fillId.slice(2));
      if (a) onFill(partyFromAddress(customers.find((c) => c.id === a.customer_id), a));
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <div className="flex items-center gap-2">
          <select value={fillId} onChange={(e) => setFillId(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-xs">
            <option value="">Fill from customer…</option>
            {customers.map((c) => {
              const extra = addresses.filter((a) => a.customer_id === c.id);
              const label = c.name ?? c.company_name ?? `#${c.id}`;
              return [
                <option key={`c:${c.id}`} value={`c:${c.id}`}>
                  {label}{extra.length > 0 ? " (main address)" : ""}
                </option>,
                ...extra.map((a) => (
                  <option key={`a:${a.id}`} value={`a:${a.id}`}>
                    {label} — {a.label}
                  </option>
                )),
              ];
            })}
          </select>
          <button
            type="button"
            onClick={applyFill}
            disabled={!fillId}
            className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-40"
          >
            Fill
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name">
          <input value={party.name} onChange={(e) => set({ ...party, name: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Contact">
          <input value={party.contact} onChange={(e) => set({ ...party, contact: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Address 1">
          <input value={party.address1} onChange={(e) => set({ ...party, address1: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Address 2">
          <input value={party.address2} onChange={(e) => set({ ...party, address2: e.target.value })} className={inputCls} />
        </Field>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <Field label="City">
          <input value={party.city} onChange={(e) => set({ ...party, city: e.target.value })} className={inputCls} />
        </Field>
        <Field label="State">
          <input value={party.state} onChange={(e) => set({ ...party, state: e.target.value })} className={inputCls} />
        </Field>
        <Field label="ZIP">
          <input value={party.zip} onChange={(e) => set({ ...party, zip: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Phone">
          <input value={party.phone} onChange={(e) => set({ ...party, phone: e.target.value })} className={inputCls} />
        </Field>
      </div>
    </div>
  );
}

// datetime-local <-> ISO helpers (shows/edits both date and time)
const toDateInput = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromDateInput = (v: string) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export default function LoadForm({ load, onClose }: LoadFormProps) {
  const editing = load != null;
  const save = useSaveFullLoad();
  const carriers = useCarriers();
  const customers = useCustomers();
  const addressBook = useCustomerAddresses();
  const customerList = customers.data ?? [];
  const addressList = addressBook.data ?? [];

  const [ref, setRef] = useState(load?.ref ?? "");
  const [customerId, setCustomerId] = useState(load?.customer_id ? String(load.customer_id) : "");
  const [carrierId, setCarrierId] = useState(load?.carrier_id ? String(load.carrier_id) : "");
  const [status, setStatus] = useState(load?.status ?? "pending");
  const [transportType, setTransportType] = useState(load?.transport_type ?? "");
  const [equipment, setEquipment] = useState(load?.equipment_type ?? "");
  const [commodity, setCommodity] = useState(load?.commodity ?? "");
  const [qty, setQty] = useState(load?.qty != null ? String(load.qty) : "");
  const [freightType, setFreightType] = useState(load?.freight_type ?? "");
  const [weight, setWeight] = useState(load?.weight_lbs != null ? String(load.weight_lbs) : "");
  const [bolNumber, setBolNumber] = useState(load?.bol_number ?? "");
  const [pickupDate, setPickupDate] = useState(toDateInput(load?.pickup_at));
  const [deliveryDate, setDeliveryDate] = useState(toDateInput(load?.delivery_at));
  const [rateUsd, setRateUsd] = useState(load?.rate_usd != null ? String(load.rate_usd) : "");
  const [carrierPay, setCarrierPay] = useState(load?.carrier_pay_usd != null ? String(load.carrier_pay_usd) : "");
  const [ratePerMile, setRatePerMile] = useState(String(DEFAULT_RATE_PER_MILE));
  const [notes, setNotes] = useState(load?.notes ?? "");

  const [shipper, setShipper] = useState<Party>(
    load
      ? {
          name: load.shipper_name ?? "", address1: load.shipper_address1 ?? "", address2: load.shipper_address2 ?? "",
          city: load.shipper_city ?? "", state: load.shipper_state ?? "", zip: load.shipper_zip ?? load.origin_zip ?? "",
          contact: load.shipper_contact ?? "", phone: load.shipper_phone ?? "",
        }
      : emptyParty,
  );
  const [consignee, setConsignee] = useState<Party>(
    load
      ? {
          name: load.consignee_name ?? "", address1: load.consignee_address1 ?? "", address2: load.consignee_address2 ?? "",
          city: load.consignee_city ?? "", state: load.consignee_state ?? "", zip: load.consignee_zip ?? load.dest_zip ?? "",
          contact: load.consignee_contact ?? "", phone: load.consignee_phone ?? "",
        }
      : emptyParty,
  );

  // Mileage + suggested quote from ZIPs
  const distance = useMemo(() => estimateMiles(shipper.zip, consignee.zip), [shipper.zip, consignee.zip]);
  const suggested = useMemo(() => {
    if (!distance) return null;
    return estimateQuote(distance.roadMiles, {
      ratePerMile: Number(ratePerMile) || 0,
      fuelPct: DEFAULT_FUEL_PCT,
      minCharge: DEFAULT_MIN_CHARGE,
    });
  }, [distance, ratePerMile]);

  const canSubmit = ref.trim() !== "" && !save.isPending;

  const handleSubmit = () => {
    const originLabel = shipper.city && shipper.state ? `${shipper.city}, ${shipper.state}` : shipper.zip || "?";
    const destLabel = consignee.city && consignee.state ? `${consignee.city}, ${consignee.state}` : consignee.zip || "?";
    save.mutate(
      {
        id: editing && load.id != null ? load.id : undefined,
        ref: ref.trim(),
        customer_id: customerId ? Number(customerId) : null,
        carrier_id: carrierId ? Number(carrierId) : null,
        status,
        transport_type: transportType || null,
        equipment_type: equipment || null,
        commodity: commodity.trim() || null,
        qty: qty ? Number(qty) : null,
        freight_type: freightType.trim() || null,
        weight_lbs: weight ? Number(weight) : null,
        bol_number: bolNumber.trim() || null,
        pickup_at: fromDateInput(pickupDate),
        delivery_at: fromDateInput(deliveryDate),
        rate_usd: rateUsd ? Number(rateUsd) : null,
        carrier_pay_usd: carrierPay ? Number(carrierPay) : null,
        rate_per_mile: ratePerMile ? Number(ratePerMile) : null,
        miles_calc: distance ? distance.roadMiles : null,
        notes: notes.trim() || null,
        shipper_name: shipper.name || null, shipper_address1: shipper.address1 || null, shipper_address2: shipper.address2 || null,
        shipper_city: shipper.city || null, shipper_state: shipper.state || null, shipper_zip: shipper.zip || null,
        shipper_contact: shipper.contact || null, shipper_phone: shipper.phone || null,
        origin_city: shipper.city || null, origin_state: shipper.state || null, origin_zip: shipper.zip || null,
        consignee_name: consignee.name || null, consignee_address1: consignee.address1 || null, consignee_address2: consignee.address2 || null,
        consignee_city: consignee.city || null, consignee_state: consignee.state || null, consignee_zip: consignee.zip || null,
        consignee_contact: consignee.contact || null, consignee_phone: consignee.phone || null,
        dest_city: consignee.city || null, dest_state: consignee.state || null, dest_zip: consignee.zip || null,
        laneOrigin: editing ? undefined : originLabel,
        laneDestination: editing ? undefined : destLabel,
        laneMiles: distance ? distance.roadMiles : null,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal
      title={editing ? `Edit shipment ${load.ref ?? ""}` : "Add shipment"}
      onClose={onClose}
      wide
      footer={
        <ModalActions
          onCancel={onClose}
          onSubmit={handleSubmit}
          submitLabel={editing ? "Save changes" : "Add shipment"}
          pending={save.isPending}
          disabled={!canSubmit}
        />
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <Field label="Reference *">
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="LD-2105" className={inputCls} />
        </Field>
        <Field label="Customer">
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {customerList.map((c) => (
              <option key={c.id} value={c.id}>{c.name ?? c.company_name ?? `#${c.id}`}</option>
            ))}
          </select>
        </Field>
        <Field label="Carrier">
          <select value={carrierId} onChange={(e) => setCarrierId(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {(carriers.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <PartyFields title="Pickup (Ship From)" party={shipper} set={setShipper} customers={customerList} addresses={addressList} onFill={setShipper} />
      <PartyFields title="Delivery (Ship To)" party={consignee} set={setConsignee} customers={customerList} addresses={addressList} onFill={setConsignee} />

      <div className="grid grid-cols-3 gap-3">
        <Field label="Transportation type">
          <select value={transportType} onChange={(e) => setTransportType(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {TRANSPORT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Equipment">
          <select value={equipment} onChange={(e) => setEquipment(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {EQUIPMENT.map((eq) => (
              <option key={eq} value={eq}>{eq}</option>
            ))}
          </select>
        </Field>
        <Field label="Commodity">
          <input value={commodity} onChange={(e) => setCommodity(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Qty">
          <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" placeholder="e.g. 12" className={inputCls} />
        </Field>
        <Field label="Type">
          <input
            value={freightType}
            onChange={(e) => setFreightType(e.target.value)}
            list="freight-types"
            placeholder="e.g. Pallets, LTL"
            className={inputCls}
          />
          <datalist id="freight-types">
            {FREIGHT_TYPES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
        <Field label="Weight (lbs)">
          <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="numeric" className={inputCls} />
        </Field>
        <Field label="BOL #">
          <input value={bolNumber} onChange={(e) => setBolNumber(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Pickup date &amp; time">
          <input value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} type="datetime-local" className={inputCls} />
        </Field>
        <Field label="Delivery date &amp; time">
          <input value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} type="datetime-local" className={inputCls} />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            {(editing && load.status && !LOAD_STATUSES.includes(load.status as never) ? [load.status, ...LOAD_STATUSES] : LOAD_STATUSES).map((st) => (
              <option key={st} value={st}>{st.replace(/_/g, " ")}</option>
            ))}
          </select>
        </Field>
        <Field label="Rate / mile ($)">
          <input value={ratePerMile} onChange={(e) => setRatePerMile(e.target.value)} inputMode="decimal" className={inputCls} />
        </Field>
        <Field label="Customer rate ($)">
          <input value={rateUsd} onChange={(e) => setRateUsd(e.target.value)} inputMode="decimal" className={inputCls} />
        </Field>
        <Field label="Carrier pay ($)">
          <input value={carrierPay} onChange={(e) => setCarrierPay(e.target.value)} inputMode="decimal" className={inputCls} />
        </Field>
        <div className="flex items-end pb-1">
          {rateUsd && carrierPay && !Number.isNaN(Number(rateUsd)) && !Number.isNaN(Number(carrierPay)) && (
            <span className={`text-sm font-medium ${Number(rateUsd) - Number(carrierPay) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              Margin: ${(Number(rateUsd) - Number(carrierPay)).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm flex items-baseline justify-between">
        {distance ? (
          <>
            <span className="text-slate-500">
              Estimated {distance.roadMiles.toLocaleString()} road miles ({shipper.zip} → {consignee.zip})
            </span>
            {suggested && (
              <button
                type="button"
                onClick={() => setRateUsd(String(suggested.quote))}
                className="text-blue-600 hover:underline text-xs font-medium"
              >
                Use suggested quote: ${suggested.quote.toLocaleString()}
              </button>
            )}
          </>
        ) : (
          <span className="text-slate-400">Enter pickup + delivery ZIPs to estimate miles and a quote.</span>
        )}
      </div>

      <Field label="Notes / special instructions (prints on the BOL)">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
      </Field>
      <ErrorText error={save.error} />
    </Modal>
  );
}
