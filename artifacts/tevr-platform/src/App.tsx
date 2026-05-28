import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import TevrDashboard from "@/pages/tevr-dashboard";
import ClientList from "@/pages/client-list";
import AdminHome from "@/pages/admin-home";
import AdminTroubleshoot from "@/pages/admin-troubleshoot";
import AdminSession from "@/pages/admin-session";
import AdminSettings from "@/pages/admin-settings";
import AdminPointToObjects from "@/pages/admin-point-to-objects";
import AdminQrDictionary from "@/pages/admin-qr-dictionary";
import AdminQrLocation from "@/pages/admin-qr-location";
import AdminLocationSetup from "@/pages/admin-location-setup";
import AdminTechSetup from "@/pages/admin-tech-setup";
import AdminSessionHistory from "@/pages/admin-session-history";
import AdminHeadsetManagement from "@/pages/admin-headset-management";
import DebugHeadsetSimulator from "@/pages/debug-headset-simulator";
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

      {/* TEVR Admin Operations */}
      <Route path="/tevr" component={TevrDashboard} />
      <Route path="/tevr/debug/headset-simulator" component={DebugHeadsetSimulator} />
      <Route path="/tevr/:customerId" component={AdminHome} />
      <Route path="/tevr/:customerId/troubleshoot" component={AdminTroubleshoot} />
      <Route path="/tevr/:customerId/session/:sessionId" component={AdminSession} />
      <Route path="/tevr/:customerId/settings" component={AdminSettings} />
      <Route path="/tevr/:customerId/settings/point-to-objects" component={AdminPointToObjects} />
      <Route path="/tevr/:customerId/settings/locations" component={AdminLocationSetup} />
      <Route path="/tevr/:customerId/settings/locations/:locationId" component={AdminQrLocation} />
      <Route path="/tevr/:customerId/settings/qr-dictionary" component={AdminQrDictionary} />
      <Route path="/tevr/:customerId/settings/qr-dictionary/:locationId" component={AdminQrLocation} />
      <Route path="/tevr/:customerId/settings/tech-setup" component={AdminTechSetup} />
      <Route path="/tevr/:customerId/session-history" component={AdminSessionHistory} />
      <Route path="/tevr/:customerId/headsets" component={AdminHeadsetManagement} />

      {/* Client Admin */}
      <Route path="/admin" component={ClientList} />
      <Route path="/admin/:customerId" component={AdminHome} />
      <Route path="/admin/:customerId/troubleshoot" component={AdminTroubleshoot} />
      <Route path="/admin/:customerId/session/:sessionId" component={AdminSession} />
      <Route path="/admin/:customerId/settings" component={AdminSettings} />
      <Route path="/admin/:customerId/settings/point-to-objects" component={AdminPointToObjects} />
      <Route path="/admin/:customerId/settings/locations" component={AdminLocationSetup} />
      <Route path="/admin/:customerId/settings/locations/:locationId" component={AdminQrLocation} />
      <Route path="/admin/:customerId/settings/qr-dictionary" component={AdminQrDictionary} />
      <Route path="/admin/:customerId/settings/qr-dictionary/:locationId" component={AdminQrLocation} />
      <Route path="/admin/:customerId/settings/tech-setup" component={AdminTechSetup} />
      <Route path="/admin/:customerId/session-history" component={AdminSessionHistory} />
      <Route path="/admin/:customerId/headsets" component={AdminHeadsetManagement} />

      {/* Field Tech */}
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
