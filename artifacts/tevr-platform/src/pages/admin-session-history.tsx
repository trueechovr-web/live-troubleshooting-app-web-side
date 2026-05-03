import { useParams, useLocation } from "wouter";
import { useGetCustomer, useGetSessionHistory } from "@workspace/api-client-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { usePortalMode } from "@/hooks/usePortalMode";

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminSessionHistory() {
  const { customerId = "" } = useParams<{ customerId: string }>();
  const [, setLocation] = useLocation();
  const { isTevrMode, base } = usePortalMode();

  const customer = useGetCustomer(customerId, { query: { enabled: !!customerId } });
  const history = useGetSessionHistory(customerId, { query: { enabled: !!customerId } });

  const headerSubtitle = isTevrMode ? "TEVR Operations" : "Client Admin";

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

      <div className="px-6 py-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <p className="text-sm text-primary font-medium mb-1">{customer.data?.name ?? "…"}</p>
          <h1 className="text-xl font-semibold text-foreground mb-1">Session History</h1>
          <p className="text-muted-foreground text-sm">Past support sessions with AI-generated summaries.</p>
        </div>

        {history.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : history.data?.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <div className="w-12 h-12 rounded-xl border border-border bg-muted flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} className="text-muted-foreground">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No sessions yet</p>
            <p className="text-sm text-muted-foreground">Completed sessions will appear here once the first call ends.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {history.data?.map((session) => (
              <div
                key={session.id}
                className="rounded-xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-muted-foreground">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{session.headsetLabel}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(session.startedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {session.durationSeconds != null && (
                      <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-md font-mono">
                        {formatDuration(session.durationSeconds)}
                      </span>
                    )}
                    <span className="text-xs px-2.5 py-1 rounded-md bg-muted text-muted-foreground font-medium">
                      Ended
                    </span>
                  </div>
                </div>

                {session.adminNotes != null && (
                  <div className="mb-3 flex items-start gap-3 bg-background border border-border rounded-lg px-4 py-3">
                    <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                      session.resolved === true
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    }`}>
                      {session.resolved === true ? (
                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                        Reported issue · {session.resolved === true ? "Resolved" : session.resolved === false ? "Follow-up needed" : "Unknown"}
                      </p>
                      <p className="text-sm text-foreground">{session.adminNotes}</p>
                    </div>
                  </div>
                )}

                {session.summary ? (
                  <div className="bg-muted/50 border border-border/60 rounded-lg px-4 py-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">AI Summary</p>
                    <p className="text-sm text-foreground leading-relaxed">{session.summary}</p>
                  </div>
                ) : (
                  <div className="bg-muted/30 border border-dashed border-border rounded-lg px-4 py-3">
                    <p className="text-sm text-muted-foreground italic">No summary available for this session.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
