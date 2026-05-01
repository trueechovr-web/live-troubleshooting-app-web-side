import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetCustomer,
  useUpdateCustomerPointToObjects,
  getGetCustomerQueryKey,
  useListLocations,
  useListQrDictionary,
  getGetLocationQrCodesQueryOptions,
} from "@workspace/api-client-react";
import type { PointToItem } from "@workspace/api-client-react";
import { useQueryClient, useQueries } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/ThemeToggle";

function DropLine({ show }: { show: boolean }) {
  return (
    <div className="px-1 py-[3px]">
      <div className={`h-0.5 rounded-full transition-all duration-150 ${show ? "bg-primary opacity-100" : "bg-transparent opacity-0"}`} />
    </div>
  );
}

export default function AdminPointToObjects() {
  const { customerId = "" } = useParams<{ customerId: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const customer = useGetCustomer(customerId, { query: { enabled: !!customerId } });

  const [items, setItems] = useState<PointToItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [pickerForCat, setPickerForCat] = useState<number | null>(null);

  const dragItem     = useRef<number | null>(null);
  const dropInsertIdx = useRef<number | null>(null);
  const [dropLineIdx, setDropLineIdx] = useState<number | null>(null);

  /* ── Load data ── */
  const locations  = useListLocations(customerId, { query: { enabled: !!customerId } });
  const dictionary = useListQrDictionary(customerId, { query: { enabled: !!customerId } });

  const nameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of dictionary.data ?? []) map.set(e.qrValue, e.name);
    return map;
  }, [dictionary.data]);

  const locationQrQueries = useQueries({
    queries: (locations.data ?? []).map((loc) => getGetLocationQrCodesQueryOptions(loc.id)),
  });

  const availableQrCodes = useMemo(() => {
    return (locations.data ?? []).flatMap((loc, i) => {
      const qrData = locationQrQueries[i]?.data;
      return (qrData?.qrCodes ?? []).map((qr) => ({
        qrValue: qr.qrValue,
        displayName: nameMap.get(qr.qrValue) ?? qr.qrValue,
        locationName: loc.name,
      }));
    });
  }, [locations.data, locationQrQueries, nameMap]);

  const qrLoadingDone = locationQrQueries.every((q) => !q.isLoading);

  useEffect(() => {
    if (customer.data && !dirty) setItems(customer.data.pointToObjects ?? []);
  }, [customer.data, dirty]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const updateMutation = useUpdateCustomerPointToObjects();

  const updateItems = (next: PointToItem[]) => { setItems(next); setDirty(true); setSaveMessage(""); };

  /* ── Category ops ── */
  const handleAddCategory = () => updateItems([{ label: "", children: [] }, ...items]);

  const handleRenameCategory = (idx: number, label: string) =>
    updateItems(items.map((it, i) => (i === idx ? { ...it, label } : it)));

  const handleDeleteCategory = (idx: number) => {
    if (pickerForCat === idx) setPickerForCat(null);
    updateItems(items.filter((_, i) => i !== idx));
  };

  /* ── QR code assignment ── */
  const handleAddQrCode = (catIdx: number, qrValue: string) => {
    updateItems(
      items.map((it, i) =>
        i === catIdx
          ? { ...it, children: [...(it.children ?? []), { label: qrValue }] }
          : it,
      ),
    );
  };

  const handleRemoveQrCode = (catIdx: number, qrValue: string) => {
    updateItems(
      items.map((it, i) =>
        i === catIdx
          ? { ...it, children: (it.children ?? []).filter((c) => c.label !== qrValue) }
          : it,
      ),
    );
  };

  /* ── Category drag ── */
  const handleDragStart = (idx: number) => { dragItem.current = idx; };

  const handleItemDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const insertIdx = e.clientY < rect.top + rect.height / 2 ? idx : idx + 1;
    setDropLineIdx(insertIdx);
    dropInsertIdx.current = insertIdx;
  };

  const handleDragEnd = () => {
    setDropLineIdx(null);
    const from = dragItem.current;
    const to   = dropInsertIdx.current;
    dragItem.current    = null;
    dropInsertIdx.current = null;
    if (from === null || to === null || from === to || from + 1 === to) return;
    const next = [...items];
    const [removed] = next.splice(from, 1);
    next.splice(to > from ? to - 1 : to, 0, removed);
    updateItems(next);
  };

  /* ── Save / reset ── */
  const handleSave = () => {
    if (!customerId) return;
    const cleaned: PointToItem[] = items
      .map((it) => {
        const label = it.label.trim();
        if (!label) return null;
        const children = (it.children ?? []).filter((c) => c.label.trim().length > 0);
        return { label, children };
      })
      .filter((it): it is PointToItem => it !== null);

    const dupe = cleaned.map((it) => it.label.toLowerCase()).find((l, i, arr) => arr.indexOf(l) !== i);
    if (dupe) { setSaveMessage(`Duplicate category: "${dupe}"`); return; }

    updateMutation.mutate(
      { customerId, data: cleaned },
      {
        onSuccess: () => {
          setItems(cleaned);
          setDirty(false);
          setSaveMessage("Saved");
          queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(customerId) });
          setTimeout(() => setSaveMessage(""), 2500);
        },
        onError: () => setSaveMessage("Failed to save"),
      },
    );
  };

  const handleReset = () => {
    if (customer.data) { setItems(customer.data.pointToObjects ?? []); setDirty(false); setSaveMessage(""); setPickerForCat(null); }
  };

  const isLoading = customer.isLoading || locations.isLoading;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            data-testid="back-to-settings"
            onClick={() => setLocation(`/admin/${customerId}/settings`)}
            className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-sm bg-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">True Echo VR</span>
          <span className="text-muted-foreground text-sm">Account Settings</span>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-muted-foreground/50">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-muted-foreground text-sm">Point-to Object Menu</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="px-6 py-8 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground mb-1">Point-to Object Menu</h1>
          <p className="text-sm text-muted-foreground">
            Create categories that operators see during live sessions. Assign calibrated QR codes to
            each category — during a call the categories appear on the left and the selected QR codes
            appear on the right. Manage QR code names in{" "}
            <button
              onClick={() => setLocation(`/admin/${customerId}/settings/qr-dictionary`)}
              className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              QR Code Dictionary
            </button>
            .
          </p>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading…</div>
        ) : !customer.data ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">No customer account found.</div>
        ) : (
          <>
            {availableQrCodes.length === 0 && qrLoadingDone && (
              <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-start gap-3">
                <svg width="16" height="16" className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  No calibrated QR codes found. Headsets must scan and calibrate QR codes before they
                  can be assigned to categories. Set up locations in{" "}
                  <button onClick={() => setLocation(`/admin/${customerId}/settings/qr-dictionary`)} className="underline underline-offset-1 hover:opacity-80">
                    QR Code Dictionary
                  </button>
                  .
                </p>
              </div>
            )}

            <div className="rounded-xl border border-border bg-card p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{customer.data?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {items.length} {items.length === 1 ? "category" : "categories"}
                  </p>
                </div>
                <button
                  data-testid="add-category"
                  onClick={handleAddCategory}
                  className="text-sm px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors"
                >
                  + Add category
                </button>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No categories yet. Add a category to start organizing QR codes.
                </p>
              ) : (
                <ul className="flex flex-col">
                  <DropLine show={dropLineIdx === 0} />
                  {items.map((item, idx) => {
                    const assignedQrValues = new Set((item.children ?? []).map((c) => c.label));
                    const isPickerOpen = pickerForCat === idx;

                    const unassigned = availableQrCodes.filter((qr) => !assignedQrValues.has(qr.qrValue));
                    const byLocation: Record<string, typeof availableQrCodes> = {};
                    for (const qr of unassigned) {
                      if (!byLocation[qr.locationName]) byLocation[qr.locationName] = [];
                      byLocation[qr.locationName].push(qr);
                    }

                    return (
                      <li key={idx} data-testid={`category-${idx}`}>
                        <div
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={(e) => handleItemDragOver(e, idx)}
                          onDragEnd={handleDragEnd}
                          className="rounded-lg border border-border bg-background overflow-hidden cursor-grab active:cursor-grabbing active:opacity-50"
                        >
                          {/* Category header row */}
                          <div className="flex items-center gap-2 p-3">
                            <span className="text-muted-foreground/40 hover:text-muted-foreground shrink-0 px-0.5" title="Drag to reorder">
                              <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8.5 6a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-7 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-7 7a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                              </svg>
                            </span>
                            <input
                              type="text"
                              data-testid={`category-${idx}-label`}
                              value={item.label}
                              placeholder="Category name"
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              onChange={(e) => handleRenameCategory(idx, e.target.value)}
                              className="flex-1 bg-transparent border border-border rounded-md px-3 py-2 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                              {(item.children ?? []).length} {(item.children ?? []).length === 1 ? "item" : "items"}
                            </span>
                            <button
                              data-testid={`category-${idx}-delete`}
                              onClick={(e) => { e.stopPropagation(); handleDeleteCategory(idx); }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="w-9 h-9 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                              title="Delete category"
                            >
                              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </div>

                          {/* Assigned QR codes */}
                          {(item.children ?? []).length > 0 && (
                            <div className="border-t border-border/60 px-3 pb-2 pt-1">
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {(item.children ?? []).map((child) => {
                                  const displayName = nameMap.get(child.label) ?? child.label;
                                  return (
                                    <span
                                      key={child.label}
                                      className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1.5 rounded-lg"
                                    >
                                      <span className="font-mono text-primary/70 text-[10px]">{child.label}</span>
                                      <span>{displayName !== child.label ? displayName : ""}</span>
                                      <button
                                        data-testid={`category-${idx}-remove-${child.label}`}
                                        onClick={(e) => { e.stopPropagation(); handleRemoveQrCode(idx, child.label); }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        className="w-3.5 h-3.5 rounded-full hover:bg-primary/20 flex items-center justify-center transition-colors ml-0.5"
                                        title="Remove"
                                      >
                                        <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Add QR code button */}
                          <div className="border-t border-border/60 px-3 py-2" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                            <button
                              data-testid={`category-${idx}-add-qr`}
                              onClick={(e) => { e.stopPropagation(); setPickerForCat(isPickerOpen ? null : idx); }}
                              className={`text-xs px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
                                isPickerOpen
                                  ? "bg-primary/10 text-primary"
                                  : "text-primary hover:bg-primary/10"
                              }`}
                            >
                              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d={isPickerOpen ? "M4.5 15.75l7.5-7.5 7.5 7.5" : "M12 4.5v15m7.5-7.5h-15"} />
                              </svg>
                              {isPickerOpen ? "Close picker" : "Add QR codes"}
                            </button>
                          </div>

                          {/* QR code picker */}
                          {isPickerOpen && (
                            <div
                              className="border-t border-border bg-muted/30 px-4 py-3 max-h-52 overflow-y-auto"
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              {!qrLoadingDone ? (
                                <p className="text-xs text-muted-foreground">Loading QR codes…</p>
                              ) : Object.keys(byLocation).length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">
                                  {availableQrCodes.length === 0
                                    ? "No calibrated QR codes available yet."
                                    : "All calibrated QR codes are already assigned to this category."}
                                </p>
                              ) : (
                                <div className="flex flex-col gap-3">
                                  {Object.entries(byLocation).map(([locName, codes]) => (
                                    <div key={locName}>
                                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{locName}</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {codes.map((qr) => (
                                          <button
                                            key={qr.qrValue}
                                            data-testid={`picker-${idx}-${qr.qrValue}`}
                                            onClick={() => handleAddQrCode(idx, qr.qrValue)}
                                            className="inline-flex items-center gap-1.5 border border-border bg-background hover:bg-primary/10 hover:border-primary text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                                          >
                                            <span className="font-mono text-muted-foreground text-[10px]">{qr.qrValue}</span>
                                            {qr.displayName !== qr.qrValue && (
                                              <span className="text-foreground">{qr.displayName}</span>
                                            )}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <DropLine show={dropLineIdx === idx + 1} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              {saveMessage && (
                <span
                  data-testid="save-message"
                  className={`text-sm font-medium ${saveMessage === "Saved" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
                >
                  {saveMessage}
                </span>
              )}
              <button
                data-testid="reset"
                onClick={handleReset}
                disabled={!dirty || updateMutation.isPending}
                className="text-sm px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Discard changes
              </button>
              <button
                data-testid="save"
                onClick={handleSave}
                disabled={!dirty || updateMutation.isPending}
                className="text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
