import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useListCustomerHeadsets,
  useUpdateHeadset,
  useDeleteHeadset,
  useGetCustomer,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/ThemeToggle";
import { usePortalMode } from "@/hooks/usePortalMode";

const statusConfig = {
  online: {
    label: "Online",
    className: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-900",
    dot: "bg-emerald-500",
  },
  busy: {
    label: "In Use",
    className: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-900",
    dot: "bg-amber-500",
  },
  offline: {
    label: "Offline",
    className: "text-slate-500 bg-slate-100 border-slate-200 dark:text-slate-500 dark:bg-slate-800/50 dark:border-slate-700",
    dot: "bg-slate-400",
  },
};

function formatLastSeen(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString();
}

export default function AdminHeadsetManagement() {
  const { customerId } = useParams<{ customerId: string }>();
  const [, setLocation] = useLocation();
  const { isTevrMode, base } = usePortalMode();
  const queryClient = useQueryClient();

  const customer = useGetCustomer(customerId, { query: { enabled: !!customerId } });
  const headsets = useListCustomerHeadsets(customerId, { query: { enabled: !!customerId } });
  const updateHeadset = useUpdateHeadset();
  const deleteHeadset = useDeleteHeadset();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const startEdit = (id: string, currentLabel: string) => {
    setEditingId(id);
    setEditLabel(currentLabel);
  };

  const saveEdit = (id: string) => {
    if (!editLabel.trim()) return;
    updateHeadset.mutate(
      { headsetId: id, data: { label: editLabel.trim() } },
      {
        onSuccess: () => {
          setEditingId(null);
          queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/headsets`] });
        },
      }
    );
  };

  const confirmDelete = (id: string) => {
    deleteHeadset.mutate(
      { headsetId: id },
      {
        onSuccess: () => {
          setConfirmDeleteId(null);
          queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/headsets`] });
        },
      }
    );
  };

  const headerSubtitle = isTevrMode ? "TEVR Operations" : "Headsets";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation(`${base}/${customerId}`)}
            className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Back"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-sm bg-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">
            {isTevrMode ? "True Echo VR" : (customer.data?.name ?? "…")}
          </span>
          <span className="text-muted-foreground text-sm">{headerSubtitle}</span>
          {isTevrMode && customer.data?.name && (
            <span className="ml-1 px-3 py-1 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 text-sm font-bold border border-red-200 dark:border-red-800 tracking-wide">
              {customer.data.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            onClick={() => setLocation("/")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="px-6 py-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-foreground mb-1">Headset Management</h1>
          <p className="text-sm text-muted-foreground">
            View and manage all registered headsets for this account. Headsets register automatically when the Unity app first launches.
          </p>
        </div>

        {headsets.isLoading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Loading headsets…</div>
        ) : !headsets.data || headsets.data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="text-muted-foreground">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-foreground mb-1">No headsets registered yet</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Headsets will appear here automatically once the Unity app launches and calls the registration endpoint.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Label</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground hidden sm:table-cell">Serial Number</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground hidden md:table-cell">Last Seen</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground hidden lg:table-cell">Firmware</th>
                  <th className="text-right px-5 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {headsets.data.map((headset, idx) => {
                  const sc = statusConfig[headset.status] ?? statusConfig.offline;
                  const isEditing = editingId === headset.id;
                  const isDeleting = confirmDeleteId === headset.id;
                  return (
                    <tr
                      key={headset.id}
                      className={`border-b border-border last:border-0 ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                    >
                      <td className="px-5 py-4">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              type="text"
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(headset.id);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              className="border border-border rounded-md px-2 py-1 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary w-40"
                            />
                            <button
                              onClick={() => saveEdit(headset.id)}
                              disabled={updateHeadset.isPending}
                              className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="font-medium text-foreground">{headset.label}</span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-muted-foreground hidden sm:table-cell">
                        {headset.serialNumber}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${sc.className}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-muted-foreground hidden md:table-cell">
                        {formatLastSeen(headset.lastSeen)}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-muted-foreground hidden lg:table-cell">
                        {headset.firmwareVersion}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {isDeleting ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-muted-foreground">Delete?</span>
                            <button
                              onClick={() => confirmDelete(headset.id)}
                              disabled={deleteHeadset.isPending}
                              className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                            >
                              {deleteHeadset.isPending ? "Deleting…" : "Yes, delete"}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs text-muted-foreground hover:text-foreground"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => startEdit(headset.id, headset.label)}
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              Rename
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(headset.id)}
                              className="text-xs font-medium text-red-600 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          {headsets.data?.length ?? 0} headset{(headsets.data?.length ?? 0) !== 1 ? "s" : ""} registered
        </p>
      </div>

      {/* Delete confirmation dialog */}
    </div>
  );
}
