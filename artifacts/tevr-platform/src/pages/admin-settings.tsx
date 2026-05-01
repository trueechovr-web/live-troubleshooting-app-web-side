import { useParams, useLocation } from "wouter";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AdminSettings() {
  const { customerId } = useParams<{ customerId: string }>();
  const [, setLocation] = useLocation();

  const sections = [
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
      path: `/admin/${customerId}/settings/point-to-objects`,
      colorClass: "text-violet-600 bg-violet-50 border-violet-200 dark:text-violet-400 dark:bg-violet-950/50 dark:border-violet-900",
      ctaClass: "text-violet-600 dark:text-violet-400",
    },
    {
      id: "qr-dictionary",
      title: "QR Code Dictionary",
      description:
        "Manage named locations and the company-wide QR code dictionary. Spatial calibration data pushed from Meta Quest headsets is stored here.",
      icon: (
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75V16.5zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
        </svg>
      ),
      path: `/admin/${customerId}/settings/qr-dictionary`,
      colorClass: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-900",
      ctaClass: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            data-testid="back-to-admin"
            onClick={() => setLocation(`/admin/${customerId}`)}
            className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-sm bg-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">True Echo VR</span>
          <span className="text-muted-foreground text-sm">Account Settings</span>
        </div>
        <ThemeToggle />
      </header>

      <div className="px-6 py-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-foreground mb-1">Account Settings</h1>
          <p className="text-sm text-muted-foreground">Select a section to configure.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sections.map((section) => (
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
          ))}
        </div>
      </div>
    </div>
  );
}
