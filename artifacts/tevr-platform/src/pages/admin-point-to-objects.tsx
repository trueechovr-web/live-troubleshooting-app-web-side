import { useMemo } from "react";
import { useLocation } from "wouter";
import {
  useListCustomers,
  useListLocations,
  useListQrDictionary,
  getGetLocationQrCodesQueryOptions,
} from "@workspace/api-client-react";
import { useQueries } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AdminPointToObjects() {
  const [, setLocation] = useLocation();

  const customers  = useListCustomers();
  const customer   = customers.data?.[0];
  const customerId = customer?.id ?? "";

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

  const locationItems = useMemo(() => {
    return (locations.data ?? []).map((loc, i) => {
      const qrData = locationQrQueries[i]?.data;
      const codes = (qrData?.qrCodes ?? []).map((qr) => ({
        qrValue: qr.qrValue,
        displayName: nameMap.get(qr.qrValue) ?? qr.qrValue,
        hasName: nameMap.has(qr.qrValue),
        calibratedAt: qr.calibratedAt,
      }));
      return { id: loc.id, name: loc.name, codes, loading: locationQrQueries[i]?.isLoading };
    });
  }, [locations.data, locationQrQueries, nameMap]);

  const totalItems = locationItems.reduce((s, l) => s + l.codes.length, 0);
  const isLoading  = customers.isLoading || locations.isLoading;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            data-testid="back-to-settings"
            onClick={() => setLocation("/admin/settings")}
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
            Objects available in the Point-to menu are automatically sourced from QR codes calibrated
            by headsets. Each location becomes a category tab, and its calibrated QR codes become the
            selectable objects. Manage names and calibration data in{" "}
            <button
              onClick={() => setLocation("/admin/settings/qr-dictionary")}
              className="text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              QR Code Dictionary
            </button>
            .
          </p>
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Loading…
          </div>
        ) : !customer ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No customer account found.
          </div>
        ) : locationItems.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="text-muted-foreground">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No locations set up yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create locations and calibrate headsets in the QR Code Dictionary to populate this menu.
              </p>
            </div>
            <button
              onClick={() => setLocation("/admin/settings/qr-dictionary")}
              className="mt-1 text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Go to QR Code Dictionary
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {totalItems} {totalItems === 1 ? "item" : "items"} across {locationItems.length}{" "}
                {locationItems.length === 1 ? "location" : "locations"}
              </p>
              <button
                onClick={() => setLocation("/admin/settings/qr-dictionary")}
                className="text-xs text-primary hover:opacity-80 transition-opacity flex items-center gap-1"
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                </svg>
                Manage in QR Code Dictionary
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {locationItems.map((loc) => (
                <div key={loc.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-sm font-semibold text-foreground">{loc.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {loc.loading ? "…" : `${loc.codes.length} ${loc.codes.length === 1 ? "item" : "items"}`}
                    </span>
                  </div>

                  {loc.loading ? (
                    <div className="px-5 py-4 text-sm text-muted-foreground">Loading…</div>
                  ) : loc.codes.length === 0 ? (
                    <div className="px-5 py-4 text-sm text-muted-foreground italic">
                      No calibrated QR codes in this location
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {loc.codes.map((code) => (
                        <li key={code.qrValue} className="px-5 py-3 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">
                              {code.qrValue}
                            </span>
                            {code.hasName ? (
                              <span className="text-sm font-medium text-foreground truncate">
                                {code.displayName}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground italic truncate">
                                No name — shown as QR value
                              </span>
                            )}
                          </div>
                          {code.calibratedAt && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              {new Date(code.calibratedAt).toLocaleDateString()}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
