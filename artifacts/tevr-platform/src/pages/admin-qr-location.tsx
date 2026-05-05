import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { usePortalMode } from "@/hooks/usePortalMode";
import {
  useGetCustomer,
  useGetLocationQrCodeSettings,
  useSetLocationQrCodeSetting,
  useClearLocationQrCodes,
  getGetLocationQrCodeSettingsQueryKey,
  LocationQrCodeSettingsView,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/ThemeToggle";

function fmt(n: number) { return n.toFixed(2); }

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminQrLocation() {
  const [, setLocation] = useLocation();
  const { customerId = "", locationId = "" } = useParams<{ customerId: string; locationId: string }>();
  const { isTevrMode, base } = usePortalMode();
  const queryClient = useQueryClient();

  const customer = useGetCustomer(customerId, { query: { enabled: !!customerId } });
  const settingsQuery = useGetLocationQrCodeSettings(locationId, { query: { enabled: !!locationId } });
  const setSettingMutation = useSetLocationQrCodeSetting();
  const clearMutation = useClearLocationQrCodes();

  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState("");

  const locationData = settingsQuery.data;
  const entries = locationData?.entries ?? [];

  const calibratedCount = entries.filter((e) => !!e.calibratedAt).length;
  const enabledCount = entries.filter((e) => e.enabled).length;

  const lastCalibratedEntry = entries
    .filter((e) => !!e.calibratedAt)
    .sort((a, b) => new Date(b.calibratedAt!).getTime() - new Date(a.calibratedAt!).getTime())[0];

  const queryKey = getGetLocationQrCodeSettingsQueryKey(locationId);

  const handleToggle = async (qrDictionaryEntryId: string, currentEnabled: boolean) => {
    const previous = queryClient.getQueryData<LocationQrCodeSettingsView>(queryKey);

    queryClient.setQueryData<LocationQrCodeSettingsView>(queryKey, (old) => {
      if (!old) return old;
      return {
        ...old,
        entries: old.entries.map((e) =>
          e.qrDictionaryEntryId === qrDictionaryEntryId
            ? { ...e, enabled: !currentEnabled }
            : e
        ),
      };
    });

    try {
      await setSettingMutation.mutateAsync({
        locationId,
        qrDictionaryEntryId,
        data: { enabled: !currentEnabled },
      });
    } catch {
      queryClient.setQueryData(queryKey, previous);
    } finally {
      queryClient.invalidateQueries({ queryKey });
    }
  };

  const handleClear = async () => {
    setClearing(true);
    setClearMsg("");
    try {
      await clearMutation.mutateAsync({ locationId });
      await queryClient.invalidateQueries({ queryKey });
      setClearMsg("Calibration cleared");
      setTimeout(() => setClearMsg(""), 3000);
    } catch {
      setClearMsg("Failed to clear");
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            data-testid="back-to-location-setup"
            onClick={() => setLocation(`${base}/${customerId}/settings/locations`)}
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
          <span className="text-muted-foreground text-sm">{isTevrMode ? "TEVR Operations" : "Location and QR Code Management"}</span>
          {isTevrMode && customer.data?.name && (
            <span className="ml-1 px-3 py-1 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 text-sm font-bold border border-red-200 dark:border-red-800 tracking-wide">
              {customer.data.name}
            </span>
          )}
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-muted-foreground/50">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <button onClick={() => setLocation(`${base}/${customerId}/settings/locations`)} className="text-muted-foreground text-sm hover:text-foreground transition-colors">
            Location Setup
          </button>
          {locationData && (
            <>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-muted-foreground/50">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              <span className="text-muted-foreground text-sm">{locationData.locationName}</span>
            </>
          )}
        </div>
        <ThemeToggle />
      </header>

      <div className="px-6 py-8 max-w-4xl mx-auto">
        {settingsQuery.isLoading ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading…</div>
        ) : !locationData ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Location not found.</div>
        ) : (
          <>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold text-foreground mb-1">{locationData.locationName}</h1>
                <p className="text-sm text-muted-foreground">
                  {lastCalibratedEntry?.calibratedAt
                    ? <>Last calibrated <span className="font-medium text-foreground">{relativeTime(lastCalibratedEntry.calibratedAt)}</span>{lastCalibratedEntry.headsetId ? <> by headset <span className="font-mono text-xs bg-muted rounded px-1 py-0.5">{lastCalibratedEntry.headsetId}</span></> : ""}</>
                    : "Not yet calibrated"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {calibratedCount} calibrated · {enabledCount} of {entries.length} enabled
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {clearMsg && (
                  <span className={`text-sm font-medium ${clearMsg === "Calibration cleared" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    {clearMsg}
                  </span>
                )}
                <button
                  onClick={handleClear}
                  disabled={clearing || calibratedCount === 0}
                  className="text-sm px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive hover:bg-destructive/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {clearing ? "Clearing…" : "Clear calibration"}
                </button>
              </div>
            </div>

            {entries.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="text-muted-foreground">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No QR codes in dictionary</p>
                <p className="text-xs text-muted-foreground">Add QR codes to the company dictionary first, then come back here to manage which ones are active at this location.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-10">Active</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">QR Value</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Calibration</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Position (x, y, z)</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rotation (x, y, z, w)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {entries.map((entry) => {
                        const isDisabled = !entry.enabled;
                        return (
                          <tr
                            key={entry.qrDictionaryEntryId}
                            className={`transition-colors ${isDisabled ? "opacity-40" : "hover:bg-muted/20"}`}
                          >
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleToggle(entry.qrDictionaryEntryId, entry.enabled)}
                                title={entry.enabled ? "Disable for this location" : "Enable for this location"}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${
                                  entry.enabled ? "bg-primary" : "bg-muted-foreground/30"
                                }`}
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                    entry.enabled ? "translate-x-4" : "translate-x-1"
                                  }`}
                                />
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-foreground">{entry.name}</span>
                                {isDisabled && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                                    Disabled for this location
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs bg-muted rounded px-2 py-1 text-foreground">{entry.qrValue}</span>
                            </td>
                            <td className="px-4 py-3">
                              {entry.calibratedAt ? (
                                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                  Calibrated {relativeTime(entry.calibratedAt)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Not yet calibrated</span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                              {entry.posX != null ? `${fmt(entry.posX)}, ${fmt(entry.posY!)}, ${fmt(entry.posZ!)}` : "—"}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                              {entry.rotX != null ? `${fmt(entry.rotX)}, ${fmt(entry.rotY!)}, ${fmt(entry.rotZ!)}, ${fmt(entry.rotW!)}` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
