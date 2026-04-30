import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import TevrDashboard from "@/pages/tevr-dashboard";
import AdminHome from "@/pages/admin-home";
import AdminTroubleshoot from "@/pages/admin-troubleshoot";
import AdminSession from "@/pages/admin-session";
import AdminSettings from "@/pages/admin-settings";
import AdminPointToObjects from "@/pages/admin-point-to-objects";
import TechPortal from "@/pages/tech-portal";
import TechSession from "@/pages/tech-session";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={LoginPage} />
      <Route path="/tevr" component={TevrDashboard} />
      <Route path="/admin" component={AdminHome} />
      <Route path="/admin/troubleshoot" component={AdminTroubleshoot} />
      <Route path="/admin/session/:sessionId" component={AdminSession} />
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/admin/settings/point-to-objects" component={AdminPointToObjects} />
      <Route path="/tech" component={TechPortal} />
      <Route path="/tech/session" component={TechSession} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
