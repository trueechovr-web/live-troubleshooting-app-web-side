import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateSession } from "@workspace/api-client-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function TechPortal() {
  const [, setLocation] = useLocation();
  const [starting, setStarting] = useState(false);
  const createSession = useCreateSession();

  const handleStartSession = () => {
    setStarting(true);
    createSession.mutate(
      { data: { headsetId: "hs-005", role: "tech" } },
      {
        onSuccess: (session) => {
          setLocation(`/tech/session?roomCode=${session.roomCode}&sessionId=${session.id}`);
        },
        onError: () => setStarting(false),
      }
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-sm bg-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">True Echo VR</span>
          <span className="text-muted-foreground text-sm">Tech Portal</span>
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

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 flex items-center justify-center mx-auto mb-6">
            <svg width="28" height="28" className="text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
            </svg>
          </div>

          <p className="text-sm font-medium text-muted-foreground mb-2">Field Technician</p>
          <h1 className="text-2xl font-semibold text-foreground mb-3">Ready to start?</h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-2">
            Start a live session to connect with a remote admin. Your camera and microphone will be shared once the session begins.
          </p>
          <p className="text-xs text-muted-foreground mb-10">
            Make sure your headset is powered on and connected before starting.
          </p>

          <button
            data-testid="start-session"
            onClick={handleStartSession}
            disabled={starting || createSession.isPending}
            className="w-full py-3 px-6 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-wait focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background shadow-sm"
          >
            {starting ? "Starting session…" : "Start Live Troubleshooting Session"}
          </button>
        </div>
      </div>
    </div>
  );
}
