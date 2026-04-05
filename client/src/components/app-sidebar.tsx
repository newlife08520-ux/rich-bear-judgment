import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Scale,
  LayoutDashboard,
  Gavel,
  Settings,
  LogOut,
  BarChart3,
  Calculator,
  Image,
  Send,
  ListChecks,
  ListTodo,
  ClipboardList,
  Package,
  TrendingUp,
  Brain,
  Wallet,
  FileBarChart,
  ChevronDown,
  Users,
  SlidersHorizontal,
  Map,
  Zap,
  History,
} from "lucide-react";
import { useAuth, canAccess } from "@/lib/auth";
import { useEmployee, getDepartmentLabel } from "@/lib/employee-context";
import { cn } from "@/lib/utils";

type NavItem = { title: string; icon: React.ComponentType<{ className?: string }>; url: string };

const mainBattleItems: NavItem[] = [
  { title: "今日指揮台", icon: LayoutDashboard, url: "/" },
  { title: "審判官", icon: Gavel, url: "/judgment" },
  { title: "任務中心", icon: ListTodo, url: "/tasks" },
];

const analysisItems: NavItem[] = [
  { title: "預算控制", icon: Wallet, url: "/fb-ads" },
  { title: "GA4 漏斗", icon: FileBarChart, url: "/ga4" },
  { title: "商品中心", icon: Package, url: "/products" },
  { title: "素材中心", icon: Image, url: "/assets" },
  { title: "創意智慧", icon: Brain, url: "/creative-intelligence" },
];

const publishItems: NavItem[] = [
  { title: "投放中心", icon: Send, url: "/publish" },
  { title: "投放紀錄", icon: ListChecks, url: "/publish/history" },
  { title: "素材生命週期", icon: TrendingUp, url: "/creative-lifecycle" },
];

const settingsItems: NavItem[] = [
  { title: "設定", icon: Settings, url: "/settings" },
  { title: "團隊", icon: Users, url: "/settings/team" },
  { title: "閾值", icon: SlidersHorizontal, url: "/settings/thresholds" },
  { title: "成本比", icon: Calculator, url: "/settings/profit-rules" },
];

const moreItems: NavItem[] = [
  { title: "成功率成績單", icon: BarChart3, url: "/scorecard" },
  { title: "執行稽核", icon: ClipboardList, url: "/execution-history" },
  { title: "商品映射", icon: Map, url: "/mapping" },
  { title: "素材審判", icon: Zap, url: "/creatives" },
  { title: "判讀紀錄", icon: History, url: "/history" },
];

const roleLabels: Record<string, string> = {
  admin: "最高管理員",
  manager: "行銷總監",
  user: "行銷專員",
};

const isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV === true;

function isNavActive(location: string, url: string): boolean {
  if (url === "/") return location === "/";
  return location === url || location.startsWith(`${url}/`);
}

function SidebarNavCollapsible({
  groupTitle,
  defaultOpen,
  items,
  testIdPrefix,
}: {
  groupTitle: string;
  defaultOpen: boolean;
  items: NavItem[];
  testIdPrefix: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [location] = useLocation();

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-testid={`sidebar-group-${testIdPrefix}`}>
      <SidebarGroup className="py-0">
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent/50 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <SidebarGroupLabel className="p-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {groupTitle}
          </SidebarGroupLabel>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={isNavActive(location, item.url)}
                    data-testid={`nav-${item.url.replace(/\//g, "-").replace(/^-/, "") || "dashboard"}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

function filterNav(role: string | undefined, items: NavItem[]): NavItem[] {
  return items.filter((i) => canAccess(role, i.url));
}

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { employee } = useEmployee();
  const role = user?.role;
  const mainNav = filterNav(role, mainBattleItems);
  const analysisNav = filterNav(role, analysisItems);
  const publishNav = filterNav(role, publishItems);
  const settingsNav = filterNav(role, settingsItems);
  const moreNav = filterNav(role, moreItems);

  return (
    <Sidebar>
      <SidebarHeader className="p-0 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center dark:bg-muted dark:border-border">
            <Scale className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-bold tracking-tight" data-testid="text-app-title">
            華麗熊審判官
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-1 px-1">
        {mainNav.length > 0 ? (
          <SidebarNavCollapsible groupTitle="主戰場" defaultOpen items={mainNav} testIdPrefix="main" />
        ) : null}
        {analysisNav.length > 0 ? (
          <SidebarNavCollapsible groupTitle="分析" defaultOpen={false} items={analysisNav} testIdPrefix="analysis" />
        ) : null}
        {publishNav.length > 0 ? (
          <SidebarNavCollapsible groupTitle="投放" defaultOpen={false} items={publishNav} testIdPrefix="publish" />
        ) : null}
        {settingsNav.length > 0 ? (
          <SidebarNavCollapsible groupTitle="設定" defaultOpen={false} items={settingsNav} testIdPrefix="settings" />
        ) : null}
        {moreNav.length > 0 ? (
          <SidebarNavCollapsible groupTitle="更多" defaultOpen={false} items={moreNav} testIdPrefix="more" />
        ) : null}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="w-7 h-7 shrink-0">
              <AvatarFallback className="text-xs bg-slate-100 text-primary dark:bg-muted">
                {user?.displayName?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" data-testid="text-username">
                {user?.displayName}
              </p>
              {isDev ? (
                <p className="text-xs text-muted-foreground truncate" data-testid="text-user-role">
                  {getDepartmentLabel(employee.department)} · 模擬：{employee.name}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground truncate" data-testid="text-user-role">
                  {roleLabels[user?.role || "user"]}
                </p>
              )}
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={logout} data-testid="button-logout">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
