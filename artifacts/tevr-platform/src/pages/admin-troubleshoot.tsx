import { useState } from "react";
import { useLocation } from "wouter";
import { useListHeadsets, useCreateSession } from "@workspace/api-client-react";

const statusConfig = {
  online: { label: "Ready", color: "hsl(142 71% 45%)" },
  busy: { label: "Busy", color: "hsl(43 96% 56%)" },
  offline: { label: "Offline", color: "hsl(217 32% 35%)" },
};

function BatteryIcon({ level }: { level: number }) {
  const color = level > 50 ? "hsl(142 71% 45%)" : level > 20 ? "hsl(43 96% 56%)" : "hsl(0 72% 51%)";
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative w-8 h-4 rounded-sm border" style={{ borderColor: color }}>
        <div
          className="absolute inset-0.5 rounded-sm transition-all"
          style={{ width: `${(level / 100) * 100}%`, background: color }}
        />
        <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-0.5 h-2 rounded-r-sm" style={{ background: color }} />
      </div>
      <span className="text-xs font-mono" style={{ color }}>{level}%</span>
    </div>
  );
}

export default function AdminTroubleshoot() {
  const [, setLocation] = useLocation();
  const [connecting, setConnecting] = useState<string | null>(null);

  const headsets = useListHeadsets();
  const createSession = useCreateSession();

  const availableHeadsets = headsets.data?.filter((h) => h.status === "online" || h.status === "busy") ?? [];

  const handleConnect = async (headsetId: string) => {
    setConnecting(headsetId);
    createSession.mutate(
      { data: { headsetId, role: "admin" } },
      {
        onSuccess: (session) => {
          setLocation(`/admin/session/${session.id}`);
        },
        onError: () => setConnecting(null),
      }
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            data-testid="back-to-admin"
            onClick={() => setLocation("/admin")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-primary-foreground" />
          </div>
          <span className="font-mono text-xl font-bold tracking-tight">TEVR</span>
          <span className="text-muted-foreground font-mono text-sm">/ Troubleshoot</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs font-mono text-muted-foreground">{availableHeadsets.length} unit{availableHeadsets.length !== 1 ? "s" : ""} available</span>
        </div>
      </header>

      <div className="px-8 py-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">Select a Headset</h1>
          <p className="text-muted-foreground text-sm">Choose a connected headset to begin a live troubleshooting session</p>
        </div>

        {headsets.isLoading ? (
          <div className="text-center py-12 text-muted-foreground font-mono text-sm">Scanning for devices...</div>
        ) : availableHeadsets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground font-mono text-sm">No headsets currently online</p>
          </div>
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
                  className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-6 text-left hover:border-primary/40 hover:shadow-lg hover:scale-[1.02] active:scale-[0.99] transition-all duration-200 disabled:opacity-70 disabled:cursor-wait focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground text-base">{headset.label}</h3>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">{headset.serialNumber}</p>
                    </div>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono"
                      style={{
                        color: status.color,
                        background: `${status.color}22`,
                        border: `1px solid ${status.color}44`,
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.color }} />
                      {status.label}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <BatteryIcon level={headset.batteryLevel} />
                    <div className="flex items-center gap-1.5">
                      <svg width="14" height="14" className="text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
                      </svg>
                      <span className="text-xs font-mono text-muted-foreground">FW {headset.firmwareVersion}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Customer: <span className="text-foreground">{headset.customerName}</span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
                    <span className="text-xs text-muted-foreground font-mono">
                      Last seen {new Date(headset.lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-xs font-mono text-primary group-hover:text-primary transition-colors">
                      {isConnecting ? "Connecting..." : "Connect"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {headsets.data && headsets.data.filter((h) => h.status === "offline").length > 0 && (
          <div className="mt-8">
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">Offline Units</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {headsets.data.filter((h) => h.status === "offline").map((headset) => (
                <div
                  key={headset.id}
                  data-testid={`headset-offline-${headset.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-4 opacity-50"
                >
                  <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{headset.label}</p>
                    <p className="text-xs font-mono text-muted-foreground">{headset.serialNumber}</p>
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
