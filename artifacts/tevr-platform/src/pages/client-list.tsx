import { useLocation } from "wouter";
import { useListCustomers } from "@workspace/api-client-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const statusConfig: Record<string, { label: string; dot: string; badge: string }> = {
  active:   { label: "Active",   dot: "bg-emerald-500", badge: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-900" },
  inactive: { label: "Inactive", dot: "bg-slate-400",   badge: "text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-slate-800/50 dark:border-slate-700" },
  trial:    { label: "Trial",    dot: "bg-amber-400",   badge: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-900" },
};

export default function ClientList() {
  const [, setLocation] = useLocation();
  const customers = useListCustomers();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-sm bg-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">True Echo VR</span>
          <span className="text-muted-foreground text-sm">Client Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            data-testid="back-to-login"
            onClick={() => setLocation("/")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="px-6 py-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-foreground mb-1">Select a Client</h1>
          <p className="text-sm text-muted-foreground">
            Choose the account you want to manage.
          </p>
        </div>

        {customers.isLoading ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Loading…</div>
        ) : (customers.data ?? []).length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground text-center">No client accounts found.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {(customers.data ?? []).map((c) => {
              const s = statusConfig[c.status] ?? statusConfig.inactive;
              return (
                <button
                  key={c.id}
                  data-testid={`client-card-${c.id}`}
                  onClick={() => setLocation(`/admin/${c.id}`)}
                  className="group flex items-center gap-4 rounded-xl border border-border bg-card px-6 py-4 text-left shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-semibold text-sm">
                    {c.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border shrink-0 ${s.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{c.contactEmail}</p>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 text-right">
                    <div>
                      <p className="text-sm font-semibold text-foreground tabular-nums">{c.headsetCount}</p>
                      <p className="text-xs text-muted-foreground">headsets</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{c.activeHeadsets}</p>
                      <p className="text-xs text-muted-foreground">active</p>
                    </div>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
