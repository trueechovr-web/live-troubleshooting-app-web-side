import { useParams, useLocation } from "wouter";
import { useGetCustomer } from "@workspace/api-client-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { usePortalMode } from "@/hooks/usePortalMode";

export default function AdminTechSetup() {
  const { customerId = "" } = useParams<{ customerId: string }>();
  const [, setLocation] = useLocation();
  const { isTevrMode, base } = usePortalMode();

  const customer = useGetCustomer(customerId, { query: { enabled: !!customerId } });

  return (
    <div className="min-h-screen bg-background text-foreground">
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
          <span className="text-muted-foreground text-sm">Client Tech Setup</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="px-6 py-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-foreground mb-1">Client Tech Setup</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage field technician profiles and control their permissions.
          </p>
        </div>

        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="text-muted-foreground">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-foreground mb-2">Coming soon</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            This section will let you create tech profiles, assign login credentials, and control
            permissions — including which locations techs are authorised to calibrate.
          </p>
        </div>
      </div>
    </div>
  );
}
