import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";

import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AuthCallback from "@/pages/AuthCallback";
import Dashboard from "@/pages/Dashboard";
import Followups from "@/pages/Followups";
import Campaigns from "@/pages/Campaigns";
import CampaignDetail from "@/pages/CampaignDetail";
import Leads from "@/pages/Leads";
import LeadsImport from "@/pages/LeadsImport";
import Templates from "@/pages/Templates";
import TemplateEditor from "@/pages/TemplateEditor";
import Drafts from "@/pages/Drafts";
import Settings from "@/pages/Settings";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/auth/callback" component={AuthCallback} />

      <Route path="/dashboard">
        <ProtectedRoute>
          <AppLayout><Dashboard /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/followups">
        <ProtectedRoute>
          <AppLayout><Followups /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/campaigns">
        <ProtectedRoute>
          <AppLayout><Campaigns /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/campaigns/:id">
        <ProtectedRoute>
          <AppLayout><CampaignDetail /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/leads/import">
        <ProtectedRoute>
          <AppLayout><LeadsImport /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/leads">
        <ProtectedRoute>
          <AppLayout><Leads /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/templates">
        <ProtectedRoute>
          <AppLayout><Templates /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/templates/:id">
        <ProtectedRoute>
          <AppLayout><TemplateEditor /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/drafts">
        <ProtectedRoute>
          <AppLayout><Drafts /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/settings">
        <ProtectedRoute>
          <AppLayout><Settings /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin">
        <ProtectedRoute>
          <AppLayout><Admin /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
