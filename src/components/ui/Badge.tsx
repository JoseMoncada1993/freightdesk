const COLORS: Record<string, string> = {
  // load statuses
  pending: "bg-purple-100 text-purple-700",
  quoted: "bg-slate-100 text-slate-700",
  booked: "bg-blue-100 text-blue-700",
  in_transit: "bg-amber-100 text-amber-700",
  delayed: "bg-orange-100 text-orange-700",
  exception: "bg-red-100 text-red-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-slate-200 text-slate-500",
  // trailer statuses
  Empty: "bg-slate-100 text-slate-700",
  Loaded: "bg-emerald-100 text-emerald-700",
  Partial: "bg-amber-100 text-amber-700",
  "Out of service": "bg-red-100 text-red-700",
  Reserved: "bg-blue-100 text-blue-700",
  // task statuses
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  done: "bg-emerald-100 text-emerald-700",
  // movement types
  inbound: "bg-emerald-100 text-emerald-700",
  outbound: "bg-blue-100 text-blue-700",
  adjustment: "bg-amber-100 text-amber-700",
};

export default function Badge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-slate-400">—</span>;
  const cls = COLORS[value] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {value.replace(/_/g, " ")}
    </span>
  );
}
