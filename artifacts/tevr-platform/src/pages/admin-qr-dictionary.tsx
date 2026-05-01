import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { usePortalMode } from "@/hooks/usePortalMode";
import {
  useGetCustomer,
  useListLocations,
  useCreateLocation,
  useDeleteLocation,
  useListQrDictionary,
  useCreateQrDictionaryEntry,
  useUpdateQrDictionaryEntry,
  useDeleteQrDictionaryEntry,
  getListLocationsQueryKey,
  getListQrDictionaryQueryKey,
} from "@workspace/api-client-react";
import type { QrDictionaryEntry, LocationSummary } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/ThemeToggle";

function Breadcrumb({ label }: { label: string }) {
  return (
    <>
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-muted-foreground/50">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
      <span className="text-muted-foreground text-sm">{label}</span>
    </>
  );
}

type DraftEntry = { localId: string; serverId: string | null; qrValue: string; name: string };

function newDraft(e: QrDictionaryEntry): DraftEntry {
  return { localId: e.id, serverId: e.id, qrValue: e.qrValue, name: e.name };
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminQrDictionary() {
  const { customerId = "" } = useParams<{ customerId: string }>();
  const [, setLocation] = useLocation();
  const { isTevrMode, base } = usePortalMode();
  const queryClient = useQueryClient();

  const customer = useGetCustomer(customerId, { query: { enabled: !!customerId } });
  const locationsQuery = useListLocations(customerId, { query: { enabled: !!customerId } });
  const dictQuery = useListQrDictionary(customerId, { query: { enabled: !!customerId } });

  /* ── Dictionary local state ── */
  const [draft, setDraft] = useState<DraftEntry[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [dictDirty, setDictDirty] = useState(false);
  const [dictSaveMsg, setDictSaveMsg] = useState("");
  const [dictSaving, setDictSaving] = useState(false);

  useEffect(() => {
    if (dictQuery.data && !dictDirty) {
      setDraft(dictQuery.data.map(newDraft));
      setDeletedIds([]);
    }
  }, [dictQuery.data, dictDirty]);

  const updateDraft = (next: DraftEntry[]) => { setDraft(next); setDictDirty(true); setDictSaveMsg(""); };

  const handleAddEntry = () => {
    const localId = `new-${Date.now()}`;
    updateDraft([{ localId, serverId: null, qrValue: "", name: "" }, ...draft]);
  };

  const handleEntryChange = (localId: string, field: "qrValue" | "name", val: string) =>
    updateDraft(draft.map((e) => (e.localId === localId ? { ...e, [field]: val } : e)));

  const handleDeleteEntry = (localId: string) => {
    const entry = draft.find((e) => e.localId === localId);
    if (entry?.serverId) setDeletedIds((prev) => [...prev, entry.serverId!]);
    updateDraft(draft.filter((e) => e.localId !== localId));
  };

  const createEntry = useCreateQrDictionaryEntry();
  const updateEntry = useUpdateQrDictionaryEntry();
  const deleteEntry = useDeleteQrDictionaryEntry();

  const handleSaveDictionary = async () => {
    if (!customerId) return;
    const dupeValues = draft.map((e) => e.qrValue.trim().toLowerCase()).filter((v, i, a) => v && a.indexOf(v) !== i);
    if (dupeValues.length > 0) { setDictSaveMsg(`Duplicate QR value: "${dupeValues[0]}"`); return; }

    setDictSaving(true);
    setDictSaveMsg("");
    try {
      const originalMap = new Map((dictQuery.data ?? []).map((e) => [e.id, e]));

      await Promise.all([
        ...deletedIds.map((id) => deleteEntry.mutateAsync({ customerId, entryId: id })),
        ...draft
          .filter((e) => !e.serverId && e.qrValue.trim() && e.name.trim())
          .map((e) => createEntry.mutateAsync({ customerId, data: { qrValue: e.qrValue.trim(), name: e.name.trim() } })),
        ...draft
          .filter((e) => {
            if (!e.serverId) return false;
            const orig = originalMap.get(e.serverId);
            return orig && (orig.qrValue !== e.qrValue.trim() || orig.name !== e.name.trim());
          })
          .map((e) =>
            updateEntry.mutateAsync({
              customerId,
              entryId: e.serverId!,
              data: { qrValue: e.qrValue.trim(), name: e.name.trim() },
            }),
          ),
      ]);

      await queryClient.invalidateQueries({ queryKey: getListQrDictionaryQueryKey(customerId) });
      setDictDirty(false);
      setDeletedIds([]);
      setDictSaveMsg("Saved");
      setTimeout(() => setDictSaveMsg(""), 2500);
    } catch (err: unknown) {
      const serverMsg =
        typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "";
      setDictSaveMsg(serverMsg.includes("already exists") ? serverMsg : "Failed to save");
    } finally {
      setDictSaving(false);
    }
  };

  const handleDiscardDict = () => {
    if (dictQuery.data) { setDraft(dictQuery.data.map(newDraft)); setDeletedIds([]); setDictDirty(false); setDictSaveMsg(""); }
  };

  /* ── Location state ── */
  const [newLocName, setNewLocName] = useState("");
  const [addingLoc, setAddingLoc] = useState(false);
  const createLocation = useCreateLocation();
  const deleteLocation = useDeleteLocation();

  const handleAddLocation = async () => {
    if (!newLocName.trim() || !customerId) return;
    setAddingLoc(true);
    try {
      await createLocation.mutateAsync({ customerId, data: { name: newLocName.trim() } });
      await queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey(customerId) });
      setNewLocName("");
    } finally {
      setAddingLoc(false);
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!customerId) return;
    await deleteLocation.mutateAsync({ customerId, locationId });
    await queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey(customerId) });
  };

  const isLoading = locationsQuery.isLoading || dictQuery.isLoading;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            data-testid="back-to-settings"
            onClick={() => setLocation(`${base}/${customerId}/settings`)}
            className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
          <span className="text-muted-foreground text-sm">{isTevrMode ? "TEVR Operations" : "Account Settings"}</span>
          {isTevrMode && customer.data?.name && (
            <span className="ml-1 px-3 py-1 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 text-sm font-bold border border-red-200 dark:border-red-800 tracking-wide">
              {customer.data.name}
            </span>
          )}
          <Breadcrumb label="QR Code Dictionary" />
        </div>
        <ThemeToggle />
      </header>

      <div className="px-6 py-8 max-w-3xl mx-auto">
        {isLoading ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading…</div>
        ) : !customerId ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">No customer account found.</div>
        ) : (
          <div className="flex flex-col gap-6">

            {/* ── Name Dictionary ── */}
            <section>
              <div className="mb-3">
                <h2 className="text-base font-semibold text-foreground">Name Dictionary</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Map QR code values to human-readable names. These names apply across all locations and are pushed to headsets on app start.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground">{draft.length} {draft.length === 1 ? "entry" : "entries"}</p>
                  <button
                    onClick={handleAddEntry}
                    className="text-sm px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors"
                  >
                    + Add entry
                  </button>
                </div>

                {draft.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No entries yet. Add a QR code name above.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1 mb-1">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">QR Value</span>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</span>
                      <span />
                    </div>
                    {draft.map((entry) => (
                      <div key={entry.localId} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                        <input
                          type="text"
                          value={entry.qrValue}
                          placeholder="e.g. TEVR-OBJ-001"
                          onChange={(e) => handleEntryChange(entry.localId, "qrValue", e.target.value)}
                          className="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                        />
                        <input
                          type="text"
                          value={entry.name}
                          placeholder="e.g. Espresso Machine"
                          onChange={(e) => handleEntryChange(entry.localId, "name", e.target.value)}
                          className="bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                          onClick={() => handleDeleteEntry(entry.localId)}
                          className="w-9 h-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Delete"
                        >
                          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-border">
                  {dictSaveMsg && (
                    <span className={`text-sm font-medium ${dictSaveMsg === "Saved" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                      {dictSaveMsg}
                    </span>
                  )}
                  <button
                    onClick={handleDiscardDict}
                    disabled={!dictDirty || dictSaving}
                    className="text-sm px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Discard changes
                  </button>
                  <button
                    onClick={handleSaveDictionary}
                    disabled={!dictDirty || dictSaving}
                    className="text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {dictSaving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>
            </section>

            {/* ── Locations ── */}
            <section>
              <div className="mb-3">
                <h2 className="text-base font-semibold text-foreground">Locations</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Each location stores its own spatial calibration data pushed by a Meta Quest headset.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newLocName}
                    placeholder="Location name (e.g. Downtown)"
                    onChange={(e) => setNewLocName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddLocation()}
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={handleAddLocation}
                    disabled={!newLocName.trim() || addingLoc}
                    className="text-sm px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {addingLoc ? "Adding…" : "+ Add"}
                  </button>
                </div>

                {(locationsQuery.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No locations yet. Add one above.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border">
                    {(locationsQuery.data ?? []).map((loc) => (
                      <li key={loc.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                        <button
                          onClick={() => setLocation(`${base}/${customerId}/settings/qr-dictionary/${loc.id}`)}
                          className="flex-1 flex items-center gap-3 text-left group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-900 flex items-center justify-center shrink-0">
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-emerald-600 dark:text-emerald-400">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{loc.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {loc.qrCodeCount} QR {loc.qrCodeCount === 1 ? "code" : "codes"}
                              {loc.lastCalibratedAt ? ` · Last calibrated ${relativeTime(loc.lastCalibratedAt)}` : " · Not calibrated"}
                            </p>
                          </div>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteLocation(loc.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                          title="Delete location"
                        >
                          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

          </div>
        )}
      </div>
    </div>
  );
}
