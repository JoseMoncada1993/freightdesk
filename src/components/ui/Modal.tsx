import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export default function Modal({ title, onClose, children, footer, wide }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-12 overflow-y-auto">
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-lg"} rounded-xl bg-white shadow-xl border border-slate-200`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <div className="space-y-4 px-6 py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">{footer}</div>
        )}
      </div>
    </div>
  );
}

export const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

interface FieldProps {
  label: string;
  children: ReactNode;
}

export function Field({ label, children }: FieldProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-600">{label}</label>
      {children}
    </div>
  );
}

interface ModalActionsProps {
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  pending?: boolean;
  disabled?: boolean;
}

export function ModalActions({ onCancel, onSubmit, submitLabel, pending, disabled }: ModalActionsProps) {
  return (
    <>
      <button onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
        Cancel
      </button>
      <button
        onClick={onSubmit}
        disabled={disabled || pending}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null;
  // Supabase errors are plain objects with a .message (not Error instances),
  // so read .message generically and fall back to JSON for anything else.
  let message = "Something went wrong.";
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "object" && error !== null && "message" in error) {
    const withDetails = error as { message?: unknown; details?: unknown; hint?: unknown };
    message = [withDetails.message, withDetails.details, withDetails.hint]
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      .join(" — ") || message;
  } else if (typeof error === "string") {
    message = error;
  }
  return <p className="text-sm text-red-600">{message}</p>;
}
