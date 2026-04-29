import { useLocation } from "wouter";
import { ThemeToggle } from "@/components/ThemeToggle";

const roles = [
  {
    id: "admin",
    label: "Client Admin",
    description: "Manage headsets, start troubleshooting sessions, and oversee field operations.",
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    path: "/admin",
    colorClass: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/60",
    borderClass: "border-blue-200 dark:border-blue-900",
  },
  {
    id: "tech",
    label: "Client Tech",
    description: "Join live support sessions from your headset or browser as a field technician.",
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
    path: "/tech",
    colorClass: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/60",
    borderClass: "border-emerald-200 dark:border-emerald-900",
  },
  {
    id: "tevr",
    label: "TEVR Admin",
    description: "True Echo VR internal portal — view all customers, deployments, and platform metrics.",
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
    path: "/tevr",
    colorClass: "text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-950/60",
    borderClass: "border-violet-200 dark:border-violet-900",
  },
];

export default function LoginPage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-sm bg-primary-foreground" />
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground">True Echo VR</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-semibold text-foreground mb-2">Welcome back</h1>
            <p className="text-muted-foreground">Select your role to continue to your portal</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {roles.map((role) => (
              <button
                key={role.id}
                data-testid={`role-card-${role.id}`}
                onClick={() => setLocation(role.path)}
                className="group flex flex-col gap-5 rounded-xl border border-border bg-card p-7 text-left shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
              >
                <div className={`w-11 h-11 rounded-lg flex items-center justify-center border ${role.colorClass} ${role.borderClass}`}>
                  {role.icon}
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-foreground mb-1.5">{role.label}</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{role.description}</p>
                </div>
                <div className="flex items-center gap-1 text-sm font-medium text-primary">
                  <span>Continue</span>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </div>
              </button>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-8">
            © {new Date().getFullYear()} True Echo VR. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
