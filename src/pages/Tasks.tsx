import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import ImportCsvModal from "@/components/ImportCsvModal";
import { supabase } from "@/lib/supabase";
import Badge from "@/components/ui/Badge";
import Modal, { Field, ModalActions, ErrorText, inputCls } from "@/components/ui/Modal";
import { useTasks } from "@/hooks/useTables";
import { useLoads } from "@/hooks/useLoads";
import { useAddTask, useUpdateTask } from "@/hooks/useMutations";
import { exportCsv, exportButtonProps } from "@/lib/csv";
import { TASK_STATUSES } from "@/lib/types";
import type { TaskRecord, TaskStatus } from "@/lib/types";

const NEXT_STATUS: Record<string, TaskStatus> = {
  open: "in_progress",
  in_progress: "done",
  done: "open",
};

const overdue = (t: TaskRecord) =>
  t.due_date != null && t.status !== "done" && new Date(t.due_date) < new Date(new Date().toDateString());

const ageDays = (t: TaskRecord) =>
  Math.max(0, Math.floor((Date.now() - new Date(t.created_at).getTime()) / 864e5));

function TaskForm({ task, onClose }: { task: TaskRecord | null; onClose: () => void }) {
  const add = useAddTask();
  const update = useUpdateTask();
  const loads = useLoads();
  const editing = task != null;

  const [title, setTitle] = useState(task?.title ?? "");
  const [assignee, setAssignee] = useState(task?.assignee ?? "");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [loadId, setLoadId] = useState(task?.load_id ? String(task.load_id) : "");
  const [status, setStatus] = useState<TaskStatus>((task?.status as TaskStatus) ?? "open");
  const [notes, setNotes] = useState(task?.notes ?? "");

  const pending = add.isPending || update.isPending;
  const canSubmit = title.trim() !== "" && !pending;

  const handleSubmit = () => {
    const payload = {
      title: title.trim(),
      assignee: assignee.trim() || null,
      due_date: dueDate || null,
      load_id: loadId ? Number(loadId) : null,
      status,
      notes: notes.trim() || null,
    };
    if (editing) {
      update.mutate({ id: task.id, ...payload }, { onSuccess: onClose });
    } else {
      add.mutate(payload, { onSuccess: onClose });
    }
  };

  return (
    <Modal
      title={editing ? "Edit task" : "Add task"}
      onClose={onClose}
      footer={
        <ModalActions
          onCancel={onClose}
          onSubmit={handleSubmit}
          submitLabel={editing ? "Save changes" : "Add task"}
          pending={pending}
          disabled={!canSubmit}
        />
      }
    >
      <Field label="Title *">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Assignee">
          <input value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Due / scheduled date">
          <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} type="date" className={inputCls} />
        </Field>
        <Field label="Linked load">
          <select value={loadId} onChange={(e) => setLoadId(e.target.value)} className={inputCls}>
            <option value="">—</option>
            {(loads.data ?? []).map((l) => (
              <option key={l.id ?? undefined} value={l.id ?? ""}>{l.ref}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className={inputCls}>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} />
      </Field>
      <ErrorText error={add.error ?? update.error} />
    </Modal>
  );
}

export default function Tasks() {
  const { data, isLoading, error } = useTasks();
  const update = useUpdateTask();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editing, setEditing] = useState<TaskRecord | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");

  const assignees = useMemo(
    () => Array.from(new Set((data ?? []).map((t) => t.assignee).filter(Boolean))).sort() as string[],
    [data],
  );

  const rows = useMemo(() => {
    let out = (data ?? []).filter((t) => (showArchived ? t.archived : !t.archived));
    if (statusFilter === "scheduled") {
      out = out.filter((t) => t.due_date != null && new Date(t.due_date) > new Date() && t.status !== "done");
    } else if (statusFilter !== "all") {
      out = out.filter((t) => t.status === statusFilter);
    }
    if (assigneeFilter !== "all") out = out.filter((t) => t.assignee === assigneeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((t) =>
        [t.title, t.assignee, t.notes].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
      );
    }
    return out;
  }, [data, showArchived, search, statusFilter, assigneeFilter]);

  const doExport = () =>
    exportCsv(
      rows.map((t) => ({
        title: t.title, assignee: t.assignee, status: t.status, due_date: t.due_date,
        age_days: ageDays(t), load_id: t.load_id, notes: t.notes, created_at: t.created_at,
      })),
      "tasks",
    );

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle="Click a status chip to advance it. Click headers to sort."
        action={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button onClick={doExport} {...exportButtonProps(rows.length)}>Export CSV</button>
            <button
              onClick={() => setShowImport(true)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Import CSV
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Add task
            </button>
          </div>
        }
      />
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, assignee, notes…"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
          <option value="scheduled">Scheduled (future due date)</option>
        </select>
        <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
          <option value="all">All assignees</option>
          {assignees.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="rounded border-slate-300" />
          Archived
        </label>
      </div>
      <DataTable<TaskRecord>
        rows={rows}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        empty={showArchived ? "No archived tasks." : "No tasks match this filter."}
        columns={[
          { header: "Title", cell: (r) => <span className="font-medium">{r.title}</span>, sort: (r) => r.title },
          { header: "Assignee", cell: (r) => r.assignee ?? "—", sort: (r) => r.assignee },
          {
            header: "Status",
            cell: (r) => (
              <button
                onClick={() => update.mutate({ id: r.id, status: NEXT_STATUS[r.status] ?? "open" })}
                title="Click to advance status"
              >
                <Badge value={r.status} />
              </button>
            ),
            sort: (r) => r.status,
          },
          {
            header: "Due",
            cell: (r) =>
              r.due_date ? (
                <span className={overdue(r) ? "text-red-600 font-medium" : ""}>
                  {new Date(r.due_date + "T00:00:00").toLocaleDateString()}
                </span>
              ) : (
                "—"
              ),
            sort: (r) => r.due_date,
          },
          {
            header: "Age",
            cell: (r) => {
              const d = ageDays(r);
              return <span className={d > 7 && r.status !== "done" ? "text-amber-600 font-medium" : ""}>{d}d</span>;
            },
            sort: (r) => ageDays(r),
          },
          { header: "Load", cell: (r) => (r.load_id == null ? "—" : `#${r.load_id}`), sort: (r) => r.load_id },
          { header: "Notes", cell: (r) => r.notes ?? "—" },
          {
            header: "",
            cell: (r) => (
              <div className="flex gap-2 justify-end whitespace-nowrap">
                <button onClick={() => setEditing(r)} className="text-blue-600 hover:underline text-xs font-medium">
                  Edit
                </button>
                <button
                  onClick={() => update.mutate({ id: r.id, archived: !r.archived })}
                  className="text-slate-500 hover:underline text-xs font-medium"
                >
                  {r.archived ? "Restore" : "Archive"}
                </button>
              </div>
            ),
          },
        ]}
      />
      {showAdd && <TaskForm task={null} onClose={() => setShowAdd(false)} />}
      {editing && <TaskForm task={editing} onClose={() => setEditing(null)} />}
      {showImport && (
        <ImportCsvModal
          title="Import tasks from CSV"
          fields={[
            { key: "title", aliases: ["title", "task"], required: true },
            { key: "assignee", aliases: ["assignee", "owner"] },
            { key: "status", aliases: ["status"] },
            { key: "due_date", aliases: ["due_date", "due"] },
            { key: "notes", aliases: ["notes"] },
          ]}
          exampleHeader="title, assignee, status, due_date, notes"
          toPayload={(r) => ({
            title: r.title,
            assignee: r.assignee || null,
            status: TASK_STATUSES.includes(r.status?.toLowerCase() as never) ? r.status.toLowerCase() : "open",
            due_date: r.due_date && !Number.isNaN(new Date(r.due_date).getTime())
              ? new Date(r.due_date).toISOString().slice(0, 10)
              : null,
            notes: r.notes || null,
          })}
          onImport={async (importRows) => {
            const { error: e } = await supabase.from("tasks").insert(importRows as never);
            if (e) throw e;
            qc.invalidateQueries({ queryKey: ["tasks"] });
          }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
