import { useLocation } from "wouter";

const actions = [
  {
    id: "troubleshoot",
    title: "Start Troubleshooting Stream",
    description: "Select an online headset and open a live video session with a field technician.",
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    path: "/admin/troubleshoot",
    accent: "hsl(210 100% 56%)",
    available: true,
  },
  {
    id: "settings",
    title: "Settings",
    description: "Configure account preferences, notification settings, and integration options.",
    icon: (
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    path: null,
    accent: "hsl(217 32% 35%)",
    available: false,
  },
];

export default function AdminHome() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-primary-foreground" />
          </div>
          <span className="font-mono text-xl font-bold tracking-tight">TEVR</span>
          <span className="text-muted-foreground font-mono text-sm">/ Client Admin</span>
        </div>
        <button
          data-testid="back-to-login"
          onClick={() => setLocation("/")}
          className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign Out
        </button>
      </header>

      <div className="px-8 py-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <p className="text-xs font-mono text-primary uppercase tracking-widest mb-1">Meridian Manufacturing</p>
          <h1 className="text-2xl font-bold mb-1">Admin Portal</h1>
          <p className="text-muted-foreground text-sm">Select an action to get started</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {actions.map((action) => (
            <button
              key={action.id}
              data-testid={`action-${action.id}`}
              onClick={() => action.available && action.path ? setLocation(action.path) : null}
              disabled={!action.available}
              className={`group relative flex flex-col gap-5 rounded-xl border bg-card p-8 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary ${
                action.available
                  ? "border-border hover:border-primary/40 hover:shadow-xl hover:scale-[1.02] active:scale-[0.99] cursor-pointer"
                  : "border-border opacity-50 cursor-not-allowed"
              }`}
            >
              {action.available && (
                <div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-5 transition-opacity"
                  style={{ background: action.accent }}
                />
              )}
              <div
                className="w-14 h-14 rounded-lg flex items-center justify-center"
                style={{
                  background: `${action.accent}22`,
                  color: action.accent,
                  border: `1px solid ${action.accent}44`,
                }}
              >
                {action.icon}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground mb-2">{action.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{action.description}</p>
              </div>
              {!action.available && (
                <span className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground border border-border rounded px-2 py-0.5 w-fit">
                  Coming Soon
                </span>
              )}
              {action.available && (
                <div className="flex items-center gap-1 text-xs font-mono" style={{ color: action.accent }}>
                  <span>Open</span>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
