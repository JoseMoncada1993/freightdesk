import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { useTasks } from "@/hooks/useTables";
import type { TaskRecord } from "@/lib/types";

export default function Tasks() {
  const { data, isLoading, error } = useTasks();
  return (
    <div>
      <PageHeader title="Tasks" subtitle="Workflow tasks and assignments" />
      <DataTable<TaskRecord>
        rows={data}
        isLoading={isLoading}
        error={error}
        rowKey={(r) => r.id}
        columns={[
          { header: "Title", cell: (r) => r.title },
          { header: "Assignee", cell: (r) => r.assignee ?? "—" },
          { header: "Status", cell: (r) => r.status },
          { header: "Due", cell: (r) => r.due_date ?? "—" },
        ]}
      />
    </div>
  );
}
