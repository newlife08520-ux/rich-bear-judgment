import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider, useAuth } from "@/lib/auth";
import { EmployeeProvider } from "@/lib/employee-context";
import { AppScopeProvider } from "@/hooks/use-app-scope";
import { WorkbenchFilterProvider } from "@/lib/workbench-filter-context";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import ProductsPage from "@/pages/products";
import TasksPage from "@/pages/tasks";
import ProductMappingPage from "@/pages/product-mapping";
import JudgmentPage from "@/pages/judgment";
import FbAdsPage from "@/pages/fb-ads";
import GA4AnalysisPage from "@/pages/ga4-analysis";
import HistoryPage from "@/pages/history";
import SettingsPage from "@/pages/settings";
import TeamSettingsPage from "@/pages/team-settings";
import SettingsThresholdsPage from "@/pages/settings-thresholds";
import SettingsPromptsPage from "@/pages/settings-prompts";
import SettingsProfitRulesPage from "@/pages/settings-profit-rules";
import AssetsPage from "@/pages/assets";
import PublishPlaceholderPage from "@/pages/publish-placeholder";
import PublishHistoryPlaceholderPage from "@/pages/publish-history-placeholder";
import CreativeLifecyclePage from "@/pages/creative-lifecycle";
import CreativesPage from "@/pages/creatives";
import ScorecardPage from "@/pages/scorecard";
import NotFound from "@/pages/not-found";
import { Scale } from "lucide-react";

function LoadingScreen() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-background gap-4">
      <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Scale className="w-6 h-6 text-primary" />
      </div>
      <div className="flex items-center gap-2">
        <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">載入中...</span>
      </div>
    </div>
  );
}

function AuthenticatedApp() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3.5rem",
  };

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.shiftKey) return;
      const el = (e.target as HTMLElement).closest?.(".table-scroll-container");
      if (!el) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    document.addEventListener("wheel", onWheel, { passive: false });
    return () => document.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <EmployeeProvider>
      <AppScopeProvider>
        <WorkbenchFilterProvider>
        <SidebarProvider style={sidebarStyle as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1 min-w-0">
            <main className="flex-1 min-h-0 overflow-auto">
              <Switch>
                <Route path="/" component={DashboardPage} />
                <Route path="/products" component={ProductsPage} />
                <Route path="/tasks" component={TasksPage} />
                <Route path="/mapping" component={ProductMappingPage} />
                <Route path="/judgment" component={JudgmentPage} />
                <Route path="/fb-ads" component={FbAdsPage} />
                <Route path="/ga4" component={GA4AnalysisPage} />
                <Route path="/history" component={HistoryPage} />
                <Route path="/assets" component={AssetsPage} />
                <Route path="/creative-lifecycle" component={CreativeLifecyclePage} />
                <Route path="/creatives" component={CreativesPage} />
                <Route path="/scorecard" component={ScorecardPage} />
                <Route path="/publish/history" component={PublishHistoryPlaceholderPage} />
                <Route path="/publish" component={PublishPlaceholderPage} />
                <Route path="/settings/team" component={TeamSettingsPage} />
                <Route path="/settings/thresholds" component={SettingsThresholdsPage} />
                <Route path="/settings/prompts" component={SettingsPromptsPage} />
                <Route path="/settings/profit-rules" component={SettingsProfitRulesPage} />
                <Route path="/settings" component={SettingsPage} />
                <Route component={NotFound} />
              </Switch>
            </main>
          </div>
        </div>
        </SidebarProvider>
        </WorkbenchFilterProvider>
      </AppScopeProvider>
    </EmployeeProvider>
  );
}

function AppRouter() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginPage />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
