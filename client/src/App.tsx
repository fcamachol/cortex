import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Dashboard from "@/pages/dashboard";
import ActionsPage from "@/pages/actions";
import QRTestPage from "@/pages/qr-test";
import { TasksPage } from "@/pages/TasksPage";
import FinancePage from "@/pages/FinancePage";
import ContactsPage from "@/pages/ContactsPage";
import { SpacesPage } from "@/components/spaces/SpacesPage";
import DriveSpacesPage from "@/pages/DriveSpacesPage";
import DatabaseViewer from "@/pages/database-viewer";
import { GroupManagement } from "@/pages/GroupManagement";
import { RealtimeMonitor } from "@/pages/RealtimeMonitor";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";
import Sidebar from "@/components/layout/sidebar";

function AuthenticatedRoutes() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/actions" component={ActionsPage} />
      <Route path="/tasks" component={TasksPage} />
      <Route path="/finance" component={FinancePage} />
      <Route path="/contacts" component={() => <ContactsPage userId="7804247f-3ae8-4eb2-8c6d-2c44f967ad42" />} />
      <Route path="/drive-spaces" component={DriveSpacesPage} />
      <Route path="/groups" component={() => <GroupManagement spaceId="7804247f-3ae8-4eb2-8c6d-2c44f967ad42" />} />
      <Route path="/monitor" component={() => <RealtimeMonitor spaceId="7804247f-3ae8-4eb2-8c6d-2c44f967ad42" />} />
      <Route path="/database" component={DatabaseViewer} />
      <Route path="/qr-test" component={QRTestPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function UnauthenticatedRoutes() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/signup" component={SignupPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route component={LoginPage} />
    </Switch>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <AuthenticatedRoutes /> : <UnauthenticatedRoutes />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
