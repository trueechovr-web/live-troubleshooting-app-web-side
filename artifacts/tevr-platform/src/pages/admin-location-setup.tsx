import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { usePortalMode } from "@/hooks/usePortalMode";
import {
  useGetCustomer,
  useListLocations,
  useCreateLocation,
  useUpdateLocation,
  useDeleteLocation,
  getListLocationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/ThemeToggle";
import { QRCodeSVG } from "qrcode.react";

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function lsKey(locationId: string) {
  return `tevr_qr_generated_${locationId}`;
}

interface QrOverlayProps {
  locationName: string;
  qrValue: string;
  onClose: () => void;
}

function QrOverlay({ locationName, qrValue, onClose }: QrOverlayProps) {
  const [qrSize, setQrSize] = useState(() =>
    Math.min(700, Math.max(200, window.innerHeight - 300), window.innerWidth - 80)
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);

    const handleResize = () =>
      setQrSize(Math.min(700, Math.max(200, window.innerHeight - 300), window.innerWidth - 80));
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleResize);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white"
      role="dialog"
      aria-modal="true"
      aria-label={`Setup QR code for ${locationName}`}
    >
      <button
        onClick={onClose}
        className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
        aria-label="Close"
      >
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex flex-col items-center gap-4 px-8">
        <div className="text-center">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-1">Headset Setup</p>
          <h2 className="text-2xl font-bold text-gray-900">{locationName}</h2>
        </div>

        <div className="p-3 bg-white border-2 border-gray-100 rounded-2xl shadow-sm">
          <QRCodeSVG
            value={qrValue}
            size={qrSize}
            level="M"
            marginSize={4}
            fgColor="#000000"
            bgColor="#ffffff"
            style={{ display: "block" }}
            shapeRendering="crispEdges"
          />
        </div>

        <div className="text-center max-w-xs">
          <p className="text-sm font-medium text-gray-600">Hold your headset up to scan</p>
          <p className="text-xs text-gray-400 mt-1">The headset app will register to this location automatically</p>
        </div>

        <p className="text-[10px] text-gray-300 font-mono break-all max-w-xs text-center">{qrValue}</p>
      </div>
    </div>
  );
}

export default function AdminLocationSetup() {
  const { customerId = "" } = useParams<{ customerId: string }>();
  const [, setLocation] = useLocation();
  const { isTevrMode, base } = usePortalMode();
  const queryClient = useQueryClient();

  const customer = useGetCustomer(customerId, { query: { enabled: !!customerId } });
  const locationsQuery = useListLocations(customerId, { query: { enabled: !!customerId } });

  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();
  const deleteLocation = useDeleteLocation();

  const [newLocName, setNewLocName] = useState("");
  const [addingLoc, setAddingLoc] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [generatedIds, setGeneratedIds] = useState<Set<string>>(() => {
    const set = new Set<string>();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("tevr_qr_generated_")) {
          set.add(key.replace("tevr_qr_generated_", ""));
        }
      }
    } catch {}
    return set;
  });

  const [qrOverlay, setQrOverlay] = useState<{ locationId: string; locationName: string } | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [generatingQrId, setGeneratingQrId] = useState<string | null>(null);

  const handleGenerateQr = useCallback(async (locationId: string, locationName: string) => {
    setGeneratingQrId(locationId);
    try {
      const resp = await fetch("/api/headsets/setup-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, locationId }),
      });
      if (!resp.ok) throw new Error("Failed to generate setup code");
      const { code } = await resp.json() as { code: string };
      const apiBaseUrl = window.location.origin + "/api";
      const payload = JSON.stringify({ setupCode: code, apiBaseUrl });
      try { localStorage.setItem(lsKey(locationId), "1"); } catch {}
      setGeneratedIds((prev) => new Set(prev).add(locationId));
      setQrPayload(payload);
      setQrOverlay({ locationId, locationName });
    } catch (err) {
      console.error("[QR] Failed to generate setup code", err);
    } finally {
      setGeneratingQrId(null);
    }
  }, [customerId]);

  const handleCloseQr = useCallback(() => { setQrOverlay(null); setQrPayload(null); }, []);

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

  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const handleSaveEdit = async (locationId: string) => {
    if (!editingName.trim()) return;
    setSavingId(locationId);
    try {
      await updateLocation.mutateAsync({ customerId, locationId, data: { name: editingName.trim() } });
      await queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey(customerId) });
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    setDeletingId(locationId);
    try {
      await deleteLocation.mutateAsync({ customerId, locationId });
      await queryClient.invalidateQueries({ queryKey: getListLocationsQueryKey(customerId) });
    } finally {
      setDeletingId(null);
    }
  };

  const locations = locationsQuery.data ?? [];

  const activeQrValue = qrOverlay ? qrPayload : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {qrOverlay && activeQrValue && (
        <QrOverlay
          locationName={qrOverlay.locationName}
          qrValue={activeQrValue}
          onClose={handleCloseQr}
        />
      )}

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
          <span className="text-muted-foreground text-sm">
            {isTevrMode ? "TEVR Operations" : "Location and QR Code Management"}
          </span>
          {isTevrMode && customer.data?.name && (
            <span className="ml-1 px-3 py-1 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 text-sm font-bold border border-red-200 dark:border-red-800 tracking-wide">
              {customer.data.name}
            </span>
          )}
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-muted-foreground/50">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-muted-foreground text-sm">Location Setup</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="px-6 py-8 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground mb-1">Location Setup</h1>
          <p className="text-sm text-muted-foreground">
            Add and manage your physical locations. Each location stores its own spatial calibration data
            pushed by a Meta Quest headset.
          </p>
        </div>

        {/* Add new location */}
        <div className="rounded-xl border border-border bg-card p-5 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">Add Location</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newLocName}
              placeholder="e.g. Downtown Store, Warehouse A"
              onChange={(e) => setNewLocName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddLocation()}
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={handleAddLocation}
              disabled={!newLocName.trim() || addingLoc}
              className="text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {addingLoc ? "Adding…" : "Add"}
            </button>
          </div>
        </div>

        {/* Location list */}
        {locationsQuery.isLoading ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading…</div>
        ) : locations.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="text-muted-foreground">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No locations yet</p>
            <p className="text-xs text-muted-foreground">Add your first location above to get started.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <ul className="divide-y divide-border">
              {locations.map((loc) => {
                const hasGenerated = generatedIds.has(loc.id);
                return (
                  <li key={loc.id} className="flex items-center gap-3 px-5 py-4">
                    {editingId === loc.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          autoFocus
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(loc.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="flex-1 bg-background border border-primary rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                          onClick={() => handleSaveEdit(loc.id)}
                          disabled={savingId === loc.id || !editingName.trim()}
                          className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
                        >
                          {savingId === loc.id ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setLocation(`${base}/${customerId}/settings/locations/${loc.id}`)}
                          className="flex-1 flex items-center gap-3 text-left group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/50 dark:border-blue-900 flex items-center justify-center shrink-0">
                            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-blue-600 dark:text-blue-400">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">{loc.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {loc.qrCodeCount} QR {loc.qrCodeCount === 1 ? "code" : "codes"}
                              {loc.lastCalibratedAt
                                ? ` · Calibrated ${relativeTime(loc.lastCalibratedAt)}`
                                : " · Not yet calibrated"}
                            </p>
                          </div>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                          </svg>
                        </button>

                        {/* Setup QR button */}
                        <button
                          onClick={() => handleGenerateQr(loc.id, loc.name)}
                          disabled={generatingQrId === loc.id}
                          className={`shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-wait ${
                            hasGenerated
                              ? "border-teal-300 text-teal-700 bg-teal-50 hover:bg-teal-100 dark:border-teal-700 dark:text-teal-400 dark:bg-teal-950/40 dark:hover:bg-teal-950/70 focus:ring-teal-400"
                              : "border-border text-muted-foreground hover:text-foreground hover:bg-muted focus:ring-primary"
                          }`}
                          title={hasGenerated ? "See QR Code" : "Generate Setup QR"}
                        >
                          {generatingQrId === loc.id ? (
                            <svg width="12" height="12" className="animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75V16.5zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                            </svg>
                          )}
                          {generatingQrId === loc.id ? "Generating…" : hasGenerated ? "See QR Code" : "Generate Setup QR"}
                        </button>

                        <button
                          onClick={() => handleStartEdit(loc.id, loc.name)}
                          className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                          title="Rename"
                        >
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteLocation(loc.id)}
                          disabled={deletingId === loc.id}
                          className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 disabled:opacity-40"
                          title="Delete location"
                        >
                          {deletingId === loc.id ? (
                            <svg width="14" height="14" className="animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          )}
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
