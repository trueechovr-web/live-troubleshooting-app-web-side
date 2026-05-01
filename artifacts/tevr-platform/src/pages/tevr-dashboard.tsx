import { useLocation } from "wouter";
import { useListCustomers, useGetDashboardSummary } from "@workspace/api-client-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const statusConfig: Record<string, { label: string; className: string }> = {
  active:   { label: "Active",   className: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-900" },
  inactive: { label: "Inactive", className: "text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/50 dark:border-red-900" },
  trial:    { label: "Trial",    className: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-900" },
};

export default function TevrDashboard() {
  const [, setLocation] = useLocation();
  const customers = useListCustomers();
  const summary = useGetDashboardSummary();

  const stats = [
    { label: "Total Customers", value: summary.data?.totalCustomers ?? 0 },
    { label: "Total Headsets",  value: summary.data?.totalHeadsets ?? 0 },
    { label: "Active Headsets", value: summary.data?.activeHeadsets ?? 0 },
    { label: "Live Sessions",   value: summary.data?.activeSessions ?? 0 },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-sm bg-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">True Echo VR</span>
          <span className="text-muted-foreground text-sm">Operations</span>
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

      <div className="px-6 py-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-foreground mb-1">Operations Overview</h1>
          <p className="text-muted-foreground text-sm">Platform-wide metrics and customer accounts</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <p className="text-xs text-muted-foreground mb-2 font-medium">{stat.label}</p>
              <p
                data-testid={`stat-${stat.label.replace(/ /g, "-").toLowerCase()}`}
                className="text-3xl font-semibold text-foreground tabular-nums"
              >
                {summary.isLoading ? "—" : stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Customer Accounts</h2>
            <span className="text-sm text-muted-foreground">
              {customers.data?.length ?? 0} accounts
            </span>
          </div>

          {customers.isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Version</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Headsets</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Active</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground">Since</th>
                </tr>
              </thead>
              <tbody>
                {customers.data?.map((c) => {
                  const s = statusConfig[c.status] ?? statusConfig.inactive;
                  return (
                    <tr
                      key={c.id}
                      data-testid={`customer-row-${c.id}`}
                      onClick={() => setLocation(`/admin/${c.id}`)}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium text-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.contactEmail}</p>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground font-mono text-xs">{c.programVersion}</td>
                      <td className="px-6 py-4 tabular-nums text-foreground">{c.headsetCount}</td>
                      <td className="px-6 py-4 tabular-nums text-foreground">{c.activeHeadsets}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${s.className}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
