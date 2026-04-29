import { useLocation } from "wouter";
import { useListCustomers, useGetDashboardSummary } from "@workspace/api-client-react";

const statusColor: Record<string, string> = {
  active: "hsl(142 71% 45%)",
  inactive: "hsl(0 72% 51%)",
  trial: "hsl(43 96% 56%)",
};

export default function TevrDashboard() {
  const [, setLocation] = useLocation();
  const customers = useListCustomers();
  const summary = useGetDashboardSummary();

  const stats = [
    { label: "Total Customers", value: summary.data?.totalCustomers ?? 0 },
    { label: "Total Headsets", value: summary.data?.totalHeadsets ?? 0 },
    { label: "Active Headsets", value: summary.data?.activeHeadsets ?? 0 },
    { label: "Live Sessions", value: summary.data?.activeSessions ?? 0 },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-primary-foreground" />
          </div>
          <span className="font-mono text-xl font-bold tracking-tight">TEVR</span>
          <span className="text-muted-foreground font-mono text-sm">/ Operations Hub</span>
        </div>
        <button
          data-testid="back-to-login"
          onClick={() => setLocation("/")}
          className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign Out
        </button>
      </header>

      <div className="px-8 py-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-1">Operations Overview</h1>
          <p className="text-muted-foreground text-sm font-mono">Platform-wide metrics and customer status</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-card border border-border rounded-lg p-5">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-2">{stat.label}</p>
              <p data-testid={`stat-${stat.label.replace(/ /g, "-").toLowerCase()}`} className="text-3xl font-bold font-mono text-foreground">
                {summary.isLoading ? "—" : stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Customer Accounts</h2>
            <span className="text-xs font-mono text-muted-foreground">
              {customers.data?.length ?? 0} accounts
            </span>
          </div>

          {customers.isLoading ? (
            <div className="p-8 text-center text-muted-foreground font-mono text-sm">Loading...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left text-xs font-mono text-muted-foreground uppercase tracking-widest">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-mono text-muted-foreground uppercase tracking-widest">Version</th>
                  <th className="px-6 py-3 text-left text-xs font-mono text-muted-foreground uppercase tracking-widest">Headsets</th>
                  <th className="px-6 py-3 text-left text-xs font-mono text-muted-foreground uppercase tracking-widest">Active</th>
                  <th className="px-6 py-3 text-left text-xs font-mono text-muted-foreground uppercase tracking-widest">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-mono text-muted-foreground uppercase tracking-widest">Since</th>
                </tr>
              </thead>
              <tbody>
                {customers.data?.map((c) => (
                  <tr
                    key={c.id}
                    data-testid={`customer-row-${c.id}`}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{c.contactEmail}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-muted-foreground">{c.programVersion}</td>
                    <td className="px-6 py-4 font-mono text-foreground">{c.headsetCount}</td>
                    <td className="px-6 py-4 font-mono text-foreground">{c.activeHeadsets}</td>
                    <td className="px-6 py-4">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono capitalize"
                        style={{
                          color: statusColor[c.status],
                          background: `${statusColor[c.status]}22`,
                          border: `1px solid ${statusColor[c.status]}44`,
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor[c.status] }} />
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
