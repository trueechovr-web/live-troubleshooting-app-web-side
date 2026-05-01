import { useParams, useLocation } from "wouter";
import { useGetCustomer } from "@workspace/api-client-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { usePortalMode } from "@/hooks/usePortalMode";

export default function AdminHome() {
  const { customerId } = useParams<{ customerId: string }>();
  const [, setLocation] = useLocation();
  const { isTevrMode, base } = usePortalMode();
  const customer = useGetCustomer(customerId, { query: { enabled: !!customerId } });

  const customerName = customer.data?.name ?? "Loading…";

  const actions = [
    {
      id: "troubleshoot",
      title: "Start Troubleshooting Session",
      description: "Select an online headset and open a live video session with a field technician.",
      icon: (
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
        </svg>
      ),
      path: `${base}/${customerId}/troubleshoot`,
      available: true,
      colorClass: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/50 dark:border-blue-900",
      ctaClass: "text-blue-600 dark:text-blue-400",
    },
    {
      id: "settings",
      title: "Account Settings",
      description: "Configure preferences, notification settings, and integration options.",
      icon: (
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      path: `${base}/${customerId}/settings`,
      available: true,
      colorClass: "text-violet-600 bg-violet-50 border-violet-200 dark:text-violet-400 dark:bg-violet-950/50 dark:border-violet-900",
      ctaClass: "text-violet-600 dark:text-violet-400",
    },
  ];

  const backPath = isTevrMode ? "/tevr" : "/admin";
  const headerSubtitle = isTevrMode ? "TEVR Operations" : "Client Admin";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation(backPath)}
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

      <div className="px-6 py-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <p className="text-sm text-primary font-medium mb-1">{customerName}</p>
          <h1 className="text-xl font-semibold text-foreground mb-1">Admin Portal</h1>
          <p className="text-muted-foreground text-sm">Select an action to get started</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {actions.map((action) => (
            <button
              key={action.id}
              data-testid={`action-${action.id}`}
              onClick={() => action.available && action.path ? setLocation(action.path) : null}
              disabled={!action.available}
              className={`group flex flex-col gap-5 rounded-xl border border-border bg-card p-7 text-left shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${
                action.available
                  ? "hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                  : "opacity-50 cursor-not-allowed"
              }`}
            >
              <div className={`w-11 h-11 rounded-lg flex items-center justify-center border ${action.colorClass}`}>
                {action.icon}
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-foreground mb-1.5">{action.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{action.description}</p>
              </div>
              {!action.available ? (
                <span className="text-xs text-muted-foreground border border-border rounded-md px-2 py-1 w-fit font-medium">
                  Coming soon
                </span>
              ) : (
                <div className={`flex items-center gap-1 text-sm font-medium ${action.ctaClass}`}>
                  <span>Open</span>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
