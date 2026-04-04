import { useEffect, type ComponentType } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider, useAuth, canAccess } from "@/lib/auth";
import AccessDeniedPage from "@/pages/access-denied";
import { EmployeeProvider } from "@/lib/employee-context";
import { AppScopeProvider } from "@/hooks/use-app-scope";
import { WorkbenchFilterProvider } from "@/lib/workbench-filter-context";
import { ProductViewScopeProvider } from "@/hooks/use-product-view-scope";
import { MetaApiErrorProvider } from "@/context/meta-api-error-context";
import { MetaGlobalErrorBanner } from "@/components/meta/MetaGlobalErrorBanner";
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
import PublishCenterPage from "@/pages/publish-center-page";
import PublishHistoryPlaceholderPage from "@/pages/publish-history-placeholder";
import CreativeLifecyclePage from "@/pages/creative-lifecycle";
import CreativeIntelligencePage from "@/pages/creative-intelligence";
import CreativesPage from "@/pages/creatives";
import ScorecardPage from "@/pages/scorecard";
import ExecutionHistoryPage from "@/pages/execution-history";
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

function gatePage(user: { role?: string }, path: string, Page: ComponentType) {
  return canAccess(user.role, path) ? <Page /> : <AccessDeniedPage />;
}

function AuthenticatedApp({ user }: { user: { id: string; role?: string } }) {
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
      <AppScopeProvider userId={user.id}>
        <WorkbenchFilterProvider>
        <ProductViewScopeProvider>
        <MetaApiErrorProvider>
        <SidebarProvider style={sidebarStyle as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1 min-w-0">
            <MetaGlobalErrorBanner />
            <main className="flex-1 min-h-0 overflow-auto">
              <Switch>
                <Route path="/">{() => gatePage(user, "/", DashboardPage)}</Route>
                <Route path="/products">{() => gatePage(user, "/products", ProductsPage)}</Route>
                <Route path="/tasks">{() => gatePage(user, "/tasks", TasksPage)}</Route>
                <Route path="/mapping">{() => gatePage(user, "/mapping", ProductMappingPage)}</Route>
                <Route path="/judgment">{() => gatePage(user, "/judgment", JudgmentPage)}</Route>
                <Route path="/fb-ads">{() => gatePage(user, "/fb-ads", FbAdsPage)}</Route>
                <Route path="/ga4">{() => gatePage(user, "/ga4", GA4AnalysisPage)}</Route>
                <Route path="/history">{() => gatePage(user, "/history", HistoryPage)}</Route>
                <Route path="/assets">{() => gatePage(user, "/assets", AssetsPage)}</Route>
                <Route path="/creative-lifecycle">
                  {() => gatePage(user, "/creative-lifecycle", CreativeLifecyclePage)}
                </Route>
                <Route path="/creative-intelligence">
                  {() => gatePage(user, "/creative-intelligence", CreativeIntelligencePage)}
                </Route>
                <Route path="/creatives">{() => gatePage(user, "/creatives", CreativesPage)}</Route>
                <Route path="/scorecard">{() => gatePage(user, "/scorecard", ScorecardPage)}</Route>
                <Route path="/publish/history">
                  {() => gatePage(user, "/publish/history", PublishHistoryPlaceholderPage)}
                </Route>
                <Route path="/publish">{() => gatePage(user, "/publish", PublishCenterPage)}</Route>
                <Route path="/execution-history">
                  {() => gatePage(user, "/execution-history", ExecutionHistoryPage)}
                </Route>
                <Route path="/settings/team">{() => gatePage(user, "/settings/team", TeamSettingsPage)}</Route>
                <Route path="/settings/thresholds">
                  {() => gatePage(user, "/settings/thresholds", SettingsThresholdsPage)}
                </Route>
                <Route path="/settings/prompts">
                  {() => gatePage(user, "/settings/prompts", SettingsPromptsPage)}
                </Route>
                <Route path="/settings/profit-rules">
                  {() => gatePage(user, "/settings/profit-rules", SettingsProfitRulesPage)}
                </Route>
                <Route path="/settings">{() => gatePage(user, "/settings", SettingsPage)}</Route>
                <Route component={NotFound} />
              </Switch>
            </main>
          </div>
        </div>
        </SidebarProvider>
        </MetaApiErrorProvider>
        </ProductViewScopeProvider>
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

  return <AuthenticatedApp user={user} />;
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
