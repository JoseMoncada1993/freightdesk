import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { supabase } from "@/lib/supabase";

type TaskRow = {
  id: number;
  title: string;
  assignee: string | null;
  status: string | null;
  due_date: string | null;
  notes: string | null;
  archived: boolean;
  created_at: string;
};

type TaskForm = {
  title: string;
  assignee: string;
  status: string;
  due_date: string;
  notes: string;
};

const STATUS_OPTIONS = ["Open", "In Progress", "Blocked", "Done"];

const EMPTY_FORM: TaskForm = {
  title: "",
  assignee: "",
  status: "Open",
  due_date: "",
  notes: "",
};

function ageInDays(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return 0;
  const diff = Date.now() - created;
  return Math.max(0, Math.floor(diff / 86400000));
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[\s_-]+/g, " ").trim();
}

export default function Tasks() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("age");
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["tasks"],
    queryFn: async (): Promise<TaskRow[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, assignee, status, due_date, notes, archived, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TaskRow[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { id: number | null; values: TaskForm }) => {
      const record = {
        title: payload.values.title,
        assignee: payload.values.assignee || null,
        status: payload.values.status,
        due_date: payload.values.due_date || null,
        notes: payload.values.notes || null,
      };
      if (payload.id == null) {
        const { error } = await supabase.from("tasks").insert(record);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tasks").update(record).eq("id", payload.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      closeModal();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (payload: { id: number; archived: boolean }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ archived: payload.archived })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(row: TaskRow) {
    setEditingId(row.id);
    setForm({
      title: row.title ?? "",
      assignee: row.assignee ?? "",
      status: row.status ?? "Open",
      due_date: row.due_date ?? "",
      notes: row.notes ?? "",
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function setField(key: keyof TaskForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveMutation.mutate({ id: editingId, values: form });
  }

  const rows = useMemo(() => {
    let list = (data ?? []).filter((t) => t.archived === showArchived);
    if (statusFilter !== "all") {
      list = list.filter((t) => norm(t.status ?? "") === norm(statusFilter));
    }
    if (search.trim() !== "") {
      const q = search.toLowerCase();
      list = list.filter((t) =>
        (t.title ?? "").toLowerCase().includes(q) ||
        (t.assignee ?? "").toLowerCase().includes(q) ||
        (t.notes ?? "").toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    if (sortBy === "age") {
      sorted.sort((a, b) => ageInDays(b.created_at) - ageInDays(a.created_at));
    } else if (sortBy === "due") {
      sorted.sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
    } else if (sortBy === "title") {
      sorted.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
    }
    return sorted;
  }, [data, statusFilter, sortBy, showArchived, search]);

  const controlClass =
    "rounded border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none";
  const inputClass =
    "w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle="Workflow tasks and assignments"
        action={
          <button
            type="button"
            onClick={openAdd}
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            New Task
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600">
          Status:{" "}
          <select
            className={controlClass}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          Sort by:{" "}
          <select
            className={controlClass}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="age">Age (oldest first)</option>
            <option value="due">Due date</option>
            <option value="title">Title</option>
          </select>
        </label>
        <input
          type="text"
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      <DataTable<TaskRow>
        rows={rows}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        empty={showArchived ? "No archived tasks." : "No tasks yet. Use the New Task button to add one."}
        columns={[
          { header: "Age", cell: (r) => ageInDays(r.created_at) + "d" },
          { header: "Title", cell: (r) => r.title },
          { header: "Assignee", cell: (r) => r.assignee ?? "â" },
          { header: "Status", cell: (r) => r.status ?? "â" },
          { header: "Due Date", cell: (r) => r.due_date ?? "â" },
          { header: "Notes", cell: (r) => r.notes ?? "â" },
          {
            header: "",
            cell: (r) => (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => archiveMutation.mutate({ id: r.id, archived: !r.archived })}
                  className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  {r.archived ? "Unarchive" : "Archive"}
                </button>
              </div>
            ),
          },
        ]}
      />

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              {editingId == null ? "New Task" : "Edit Task"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
                <input
                  className={inputClass}
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Assignee</label>
                <input
                  className={inputClass}
                  value={form.assignee}
                  onChange={(e) => setField("assignee", e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                <select
                  className={inputClass}
                  value={form.status}
                  onChange={(e) => setField("status", e.target.value)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Due Date</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.due_date}
                  onChange={(e) => setField("due_date", e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  className={inputClass}
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                />
              </div>
              {saveMutation.isError && (
                <p className="text-sm text-red-600">Could not save. Please try again.</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {saveMutation.isPending ? "Savingâ¦" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
