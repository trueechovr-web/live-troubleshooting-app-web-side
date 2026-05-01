import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { usePortalMode } from "@/hooks/usePortalMode";
import {
  useGetCustomer,
  useGetLocationQrCodes,
  useClearLocationQrCodes,
  useListQrDictionary,
  getGetLocationQrCodesQueryKey,
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
  const qrData = useGetLocationQrCodes(locationId);
  const dictQuery = useListQrDictionary(customerId, { query: { enabled: !!customerId } });
  const clearMutation = useClearLocationQrCodes();

  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState("");

  const nameMap = new Map((dictQuery.data ?? []).map((d) => [d.qrValue, d.name]));

  const handleClear = async () => {
    setClearing(true);
    setClearMsg("");
    try {
      await clearMutation.mutateAsync({ locationId });
      await queryClient.invalidateQueries({ queryKey: getGetLocationQrCodesQueryKey(locationId) });
      setClearMsg("Calibration cleared");
      setTimeout(() => setClearMsg(""), 3000);
    } catch {
      setClearMsg("Failed to clear");
    } finally {
      setClearing(false);
    }
  };

  const isLoading = qrData.isLoading;
  const location = qrData.data;
  const qrCodes = location?.qrCodes ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            data-testid="back-to-qr-dictionary"
            onClick={() => setLocation(`${base}/${customerId}/settings/qr-dictionary`)}
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
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-muted-foreground/50">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <button onClick={() => setLocation(`${base}/${customerId}/settings/qr-dictionary`)} className="text-muted-foreground text-sm hover:text-foreground transition-colors">
            QR Code Dictionary
          </button>
          {location && (
            <>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-muted-foreground/50">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              <span className="text-muted-foreground text-sm">{location.locationName}</span>
            </>
          )}
        </div>
        <ThemeToggle />
      </header>

      <div className="px-6 py-8 max-w-4xl mx-auto">
        {isLoading ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading…</div>
        ) : !location ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Location not found.</div>
        ) : (
          <>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold text-foreground mb-1">{location.locationName}</h1>
                <p className="text-sm text-muted-foreground">
                  {location.lastCalibratedAt
                    ? <>Last calibrated <span className="font-medium text-foreground">{relativeTime(location.lastCalibratedAt)}</span>{location.lastCalibratedByHeadsetId ? <> by headset <span className="font-mono text-xs bg-muted rounded px-1 py-0.5">{location.lastCalibratedByHeadsetId}</span></> : ""}</>
                    : "Not yet calibrated"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{qrCodes.length} calibrated QR {qrCodes.length === 1 ? "code" : "codes"}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {clearMsg && (
                  <span className={`text-sm font-medium ${clearMsg === "Calibration cleared" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    {clearMsg}
                  </span>
                )}
                <button
                  onClick={handleClear}
                  disabled={clearing || qrCodes.length === 0}
                  className="text-sm px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive hover:bg-destructive/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {clearing ? "Clearing…" : "Clear calibration"}
                </button>
              </div>
            </div>

            {qrCodes.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="text-muted-foreground">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No calibration data</p>
                <p className="text-xs text-muted-foreground">Open the Unity app on a Meta Quest headset, select this location, and complete a calibration scan to populate this dictionary.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">QR Value</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Position (x, y, z)</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rotation (x, y, z, w)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {qrCodes.map((qr) => {
                        const name = nameMap.get(qr.qrValue);
                        return (
                          <tr key={qr.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3">
                              {name ? (
                                <span className="font-medium text-foreground">{name}</span>
                              ) : (
                                <span className="text-muted-foreground italic">Unnamed</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs bg-muted rounded px-2 py-1 text-foreground">{qr.qrValue}</span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                              {fmt(qr.posX)}, {fmt(qr.posY)}, {fmt(qr.posZ)}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                              {fmt(qr.rotX)}, {fmt(qr.rotY)}, {fmt(qr.rotZ)}, {fmt(qr.rotW)}
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
