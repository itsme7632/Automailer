import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { AppLayout } from "@/components/layout/AppLayout";

import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AuthCallback from "@/pages/AuthCallback";
import Dashboard from "@/pages/Dashboard";
import LeadsImport from "@/pages/LeadsImport";
import Templates from "@/pages/Templates";
import TemplateEditor from "@/pages/TemplateEditor";
import Drafts from "@/pages/Drafts";
import Settings from "@/pages/Settings";
import MailboxSettings from "@/pages/MailboxSettings";
import Admin from "@/pages/Admin";
import AdminLogin from "@/pages/AdminLogin";
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
      {/* Public routes */}
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/auth/callback" component={AuthCallback} />

      {/* Admin auth */}
      <Route path="/admin/login" component={AdminLogin} />

      {/* Admin protected routes */}
      <Route path="/admin/dashboard">
        <AdminRoute>
          <AppLayout><Admin /></AppLayout>
        </AdminRoute>
      </Route>

      {/* /admin → redirect to /admin/dashboard (AdminRoute handles auth check) */}
      <Route path="/admin">
        <AdminRoute>
          <Redirect to="/admin/dashboard" />
        </AdminRoute>
      </Route>

      {/* User protected routes */}
      <Route path="/dashboard">
        <ProtectedRoute>
          <AppLayout><Dashboard /></AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/leads/import">
        <ProtectedRoute>
          <AppLayout><LeadsImport /></AppLayout>
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

      <Route path="/mailbox">
        <ProtectedRoute>
          <AppLayout><MailboxSettings /></AppLayout>
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
