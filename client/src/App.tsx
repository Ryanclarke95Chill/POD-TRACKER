import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

function App() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();

  // Redirect to login if not authenticated and not already at login
  useEffect(() => {
    if (!isAuthenticated && location !== "/") {
      setLocation("/");
    }
  }, [isAuthenticated, location, setLocation]);

  // Redirect to dashboard if authenticated and at login page
  useEffect(() => {
    if (isAuthenticated && location === "/") {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, location, setLocation]);

  return (
    <TooltipProvider>
      <Toaster />
      <div className="min-h-screen flex flex-col">
        <Switch>
          <Route path="/" component={Login} />
          <Route path="/dashboard" component={Dashboard} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </TooltipProvider>
  );
}

export default App;
