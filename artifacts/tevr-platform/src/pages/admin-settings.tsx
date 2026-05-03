import { useParams, useLocation } from "wouter";
import { useGetCustomer, useUpdateCustomerFeatureFlags } from "@workspace/api-client-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { usePortalMode } from "@/hooks/usePortalMode";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCustomerQueryKey } from "@workspace/api-client-react";

export default function AdminSettings() {
  const { customerId } = useParams<{ customerId: string }>();
  const [, setLocation] = useLocation();
  const { isTevrMode, base } = usePortalMode();
  const customer = useGetCustomer(customerId, { query: { enabled: !!customerId } });
  const queryClient = useQueryClient();
  const updateFeatureFlags = useUpdateCustomerFeatureFlags();

  const handleToggleSessionHistory = (enabled: boolean) => {
    updateFeatureFlags.mutate(
      { customerId, data: { sessionHistoryEnabled: enabled } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(customerId) });
        },
      },
    );
  };

  const sections = [
    {
      id: "locations",
      title: "Location Setup",
      description:
        "Add and manage your physical locations. Each location stores its own spatial calibration data from Meta Quest headsets.",
      icon: (
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
        </svg>
      ),
      path: `${base}/${customerId}/settings/locations`,
      colorClass: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/50 dark:border-blue-900",
      ctaClass: "text-blue-600 dark:text-blue-400",
      comingSoon: false,
    },
    {
      id: "qr-dictionary",
      title: "QR Code Dictionary",
      description:
        "Map QR code values to human-readable names. This company-wide dictionary is applied across all locations and pushed to headsets on startup.",
      icon: (
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75V16.5zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
        </svg>
      ),
      path: `${base}/${customerId}/settings/qr-dictionary`,
      colorClass: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-900",
      ctaClass: "text-emerald-600 dark:text-emerald-400",
      comingSoon: false,
    },
    {
      id: "point-to-objects",
      title: "Point-to Object Menu",
      description:
        "Configure the objects an admin can highlight during a live session. Add items, create submenus, and set the display order.",
      icon: (
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
        </svg>
      ),
      path: `${base}/${customerId}/settings/point-to-objects`,
      colorClass: "text-violet-600 bg-violet-50 border-violet-200 dark:text-violet-400 dark:bg-violet-950/50 dark:border-violet-900",
      ctaClass: "text-violet-600 dark:text-violet-400",
      comingSoon: false,
    },
    {
      id: "tech-setup",
      title: "Client Tech Setup",
      description:
        "Create tech profiles, assign credentials, and control permissions — including which locations techs are authorised to calibrate.",
      icon: (
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
      path: `${base}/${customerId}/settings/tech-setup`,
      colorClass: "text-muted-foreground bg-muted border-border",
      ctaClass: "",
      comingSoon: true,
    },
  ];

  const headerSubtitle = isTevrMode ? "TEVR Operations" : "Location and QR Code Management";
  const sessionHistoryEnabled = customer.data?.sessionHistoryEnabled ?? false;

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
        <ThemeToggle />
      </header>

      <div className="px-6 py-8 max-w-4xl mx-auto space-y-10">
        <div>
          <div className="mb-8">
            <h1 className="text-xl font-semibold text-foreground mb-1">Location and QR Code Management</h1>
            <p className="text-sm text-muted-foreground">Select a section to configure.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sections.map((section) => (
              section.comingSoon ? (
                <div
                  key={section.id}
                  data-testid={`section-${section.id}`}
                  className="flex flex-col gap-5 rounded-xl border border-border bg-card p-7 opacity-60 cursor-not-allowed select-none"
                >
                  <div className={`w-11 h-11 rounded-lg flex items-center justify-center border ${section.colorClass}`}>
                    {section.icon}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-base font-semibold text-foreground mb-1.5">{section.title}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">{section.description}</p>
                  </div>
                  <span className="text-xs text-muted-foreground border border-border rounded-md px-2 py-1 w-fit font-medium">
                    Coming soon
                  </span>
                </div>
              ) : (
                <button
                  key={section.id}
                  data-testid={`section-${section.id}`}
                  onClick={() => setLocation(section.path)}
                  className="group flex flex-col gap-5 rounded-xl border border-border bg-card p-7 text-left shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                >
                  <div className={`w-11 h-11 rounded-lg flex items-center justify-center border ${section.colorClass}`}>
                    {section.icon}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-base font-semibold text-foreground mb-1.5">{section.title}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">{section.description}</p>
                  </div>
                  <div className={`flex items-center gap-1 text-sm font-medium ${section.ctaClass}`}>
                    <span>Open</span>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </div>
                </button>
              )
            ))}
          </div>
        </div>

        {isTevrMode && (
          <div>
            <div className="mb-5">
              <h2 className="text-base font-semibold text-foreground mb-1">Premium Features</h2>
              <p className="text-sm text-muted-foreground">Enable or disable paid add-ons for this customer. Changes take effect immediately.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <label className="flex items-start gap-4 cursor-pointer group">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    data-testid="toggle-session-history"
                    checked={sessionHistoryEnabled}
                    disabled={updateFeatureFlags.isPending || customer.isLoading}
                    onChange={(e) => handleToggleSessionHistory(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className={`w-11 h-6 rounded-full border-2 transition-colors peer-disabled:opacity-50 ${sessionHistoryEnabled ? "bg-primary border-primary" : "bg-muted border-border"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm mt-0.5 transition-transform ${sessionHistoryEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">Session History &amp; AI Summaries</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-medium border border-amber-200 dark:border-amber-800">
                      Premium
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    Enables real-time audio transcription during live sessions and AI-generated summaries when sessions end. Session History becomes visible in the client portal.
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
