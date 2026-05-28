import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useListCustomerHeadsets, useCreateSession, useGetCustomer } from "@workspace/api-client-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { usePortalMode } from "@/hooks/usePortalMode";

const statusConfig = {
  online:  { label: "Ready",   className: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-900" },
  busy:    { label: "In Use",  className: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-900" },
  offline: { label: "Offline", className: "text-slate-500 bg-slate-100 border-slate-200 dark:text-slate-500 dark:bg-slate-800/50 dark:border-slate-700" },
};

const batteryColor = (level: number) =>
  level > 50 ? "text-emerald-600 dark:text-emerald-400"
  : level > 20 ? "text-amber-600 dark:text-amber-400"
  : "text-red-600 dark:text-red-400";

function BatteryIcon({ level }: { level: number }) {
  const colorClass = batteryColor(level);
  const fillPct = `${level}%`;
  return (
    <div className={`flex items-center gap-1.5 ${colorClass}`}>
      <div className="relative w-7 h-3.5 rounded-sm border border-current">
        <div
          className="absolute inset-0.5 rounded-sm transition-all bg-current"
          style={{ width: fillPct }}
        />
        <div className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-0.5 h-2 rounded-r bg-current" />
      </div>
      <span className="text-xs tabular-nums font-medium">{level}%</span>
    </div>
  );
}

export default function AdminTroubleshoot() {
  const { customerId } = useParams<{ customerId: string }>();
  const [, setLocation] = useLocation();
  const { isTevrMode, base } = usePortalMode();
  const customer = useGetCustomer(customerId, { query: { enabled: !!customerId } });
  const [connecting, setConnecting] = useState<string | null>(null);

  const headsets = useListCustomerHeadsets(customerId, { query: { enabled: !!customerId } });
  const createSession = useCreateSession();

  const availableHeadsets = headsets.data?.filter((h) => h.status === "online" || h.status === "busy") ?? [];
  const offlineHeadsets   = headsets.data?.filter((h) => h.status === "offline") ?? [];

  const handleConnect = (headsetId: string) => {
    setConnecting(headsetId);
    createSession.mutate(
      { data: { headsetId, role: "admin" } },
      {
        onSuccess: (session) => setLocation(`${base}/${customerId}/session/${session.id}`),
        onError: () => setConnecting(null),
      }
    );
  };

  const headerSubtitle = isTevrMode ? "TEVR Operations" : "Troubleshoot";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            data-testid="back-to-admin"
            onClick={() => setLocation(`${base}/${customerId}`)}
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
          <span className="text-muted-foreground text-sm">{headerSubtitle}</span>
          {isTevrMode && customer.data?.name && (
            <span className="ml-1 px-3 py-1 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 text-sm font-bold border border-red-200 dark:border-red-800 tracking-wide">
              {customer.data.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {availableHeadsets.length > 0 && (
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm text-muted-foreground">
                {availableHeadsets.length} device{availableHeadsets.length !== 1 ? "s" : ""} available
              </span>
            </div>
          )}
          <ThemeToggle />
        </div>
      </header>

      <div className="px-6 py-8 max-w-5xl mx-auto">
        <div className="mb-7">
          <h1 className="text-xl font-semibold text-foreground mb-1">Select a Headset</h1>
          <p className="text-sm text-muted-foreground">Choose a connected device to begin a live troubleshooting session</p>
        </div>

        {headsets.isLoading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">Scanning for devices…</div>
        ) : availableHeadsets.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">No devices currently available</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableHeadsets.map((headset) => {
              const status = statusConfig[headset.status];
              const isConnecting = connecting === headset.id;
              return (
                <button
                  key={headset.id}
                  data-testid={`headset-card-${headset.id}`}
                  onClick={() => handleConnect(headset.id)}
                  disabled={isConnecting || createSession.isPending}
                  className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-6 text-left shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-wait disabled:translate-y-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{headset.label}</h3>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{headset.serialNumber}</p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${status.className}`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <BatteryIcon level={headset.batteryLevel} />
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
                      </svg>
                      <span className="font-mono">FW {headset.firmwareVersion}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {headset.customerName}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
                    <span className="text-xs text-muted-foreground">
                      {new Date(headset.lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-sm font-medium text-primary group-hover:underline">
                      {isConnecting ? "Connecting…" : "Connect"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {offlineHeadsets.length > 0 && (
          <div className="mt-10">
            <p className="text-xs font-medium text-muted-foreground mb-3">Offline devices</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {offlineHeadsets.map((headset) => (
                <div
                  key={headset.id}
                  data-testid={`headset-offline-${headset.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card/60 p-4 opacity-50"
                >
                  <div className="w-2 h-2 rounded-full bg-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{headset.label}</p>
                    <p className="text-xs text-muted-foreground font-mono">{headset.serialNumber}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
