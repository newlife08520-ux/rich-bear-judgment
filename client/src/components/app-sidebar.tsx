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
  Zap,
  FileBarChart,
  Wallet,
  Brain,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useEmployee, getDepartmentLabel } from "@/lib/employee-context";

/** Batch 1：主導航僅 5 項；其餘收斂為次導航。 */

/** 主導航 5 項 */
const mainNavItems = [
  { title: "今日決策中心", icon: LayoutDashboard, url: "/" },
  { title: "商品中心", icon: Package, url: "/products" },
  { title: "素材審判", icon: Zap, url: "/creatives" },
  { title: "預算控制", icon: Wallet, url: "/fb-ads" },
  { title: "審判官", icon: Gavel, url: "/judgment" },
];

/** 次導航：漏斗/站內證據、行動紀錄、發佈/素材中心、設定 */
const subNavItems = [
  { title: "漏斗 / 站內證據", icon: FileBarChart, url: "/ga4" },
  { title: "行動紀錄", icon: ListTodo, url: "/tasks" },
  { title: "執行稽核", icon: ClipboardList, url: "/execution-history" },
  { title: "素材中心", icon: Image, url: "/assets" },
  { title: "素材生命週期", icon: TrendingUp, url: "/creative-lifecycle" },
  { title: "Creative Intelligence", icon: Brain, url: "/creative-intelligence" },
  { title: "投放中心", icon: Send, url: "/publish" },
  { title: "投放紀錄", icon: ListChecks, url: "/publish/history" },
  { title: "素材工廠效率與命中率", icon: BarChart3, url: "/scorecard" },
  { title: "獲利規則中心", icon: Calculator, url: "/settings/profit-rules" },
  { title: "設定中心", icon: Settings, url: "/settings" },
];

const roleLabels: Record<string, string> = {
  admin: "最高管理員",
  manager: "行銷總監",
  user: "行銷專員",
};

const isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV === true;

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { employee } = useEmployee();
  const [location] = useLocation();

  type NavItem = { title: string; icon: React.ComponentType<{ className?: string }>; url: string };
  const renderNav = (items: NavItem[], groupLabel: string) => (
    <SidebarGroup key={groupLabel}>
      <SidebarGroupLabel>{groupLabel}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                asChild
                data-active={location === item.url || (item.url !== "/" && location.startsWith(item.url)) || undefined}
                data-testid={`nav-${item.url.replace("/", "") || "dashboard"}`}
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
    </SidebarGroup>
  );

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 border border-primary/20">
            <Scale className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display font-bold text-base tracking-tight" data-testid="text-app-title">
              AI 行銷總監
            </h1>
            <p className="text-xs text-muted-foreground">你的數據幕僚</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {renderNav(mainNavItems, "主導航")}
        {renderNav(subNavItems, "更多")}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="w-7 h-7 shrink-0">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {user?.displayName?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate" data-testid="text-username">
                {user?.displayName}
              </p>
              {isDev ? (
                <p className="text-[10px] text-muted-foreground truncate" data-testid="text-user-role">
                  {getDepartmentLabel(employee.department)} · 模擬：{employee.name}
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground truncate" data-testid="text-user-role">
                  {roleLabels[user?.role || "user"]}
                </p>
              )}
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
