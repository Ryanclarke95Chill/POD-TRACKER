import { Switch, Route, useLocation, Router } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Analytics from "@/pages/analytics";

import ViewAll from "@/pages/view-all";
import AdminPage from "@/pages/admin";
import SimpleImport from "@/pages/simple-import";
import Settings from "@/pages/settings";
import CustomDashboards from "@/pages/custom-dashboards";
import UserManagement from "@/pages/user-management";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

function App() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();

  // Redirect to login if not authenticated and not already at login
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token && location !== "/") {
      setLocation("/");
    } else if (token && location === "/") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, location, setLocation]);

  return (
    <Router>
      <TooltipProvider>
        <Toaster />
        <div className="min-h-screen flex flex-col">
          <Switch>
            <Route path="/" component={Login} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/analytics" component={Analytics} />

            <Route path="/view-all" component={ViewAll} />
            <Route path="/custom-dashboards" component={CustomDashboards} />
            <Route path="/user-management" component={UserManagement} />
            <Route path="/simple-import" component={SimpleImport} />
            <Route path="/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </TooltipProvider>
    </Router>
  );
}

export default App;
