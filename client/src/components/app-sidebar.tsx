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
  Image,
  Send,
  ListChecks,
  ListTodo,
  Package,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useEmployee, getDepartmentLabel } from "@/lib/employee-context";

/** 日常主導航：一眼知道每天會用的頁面 */
const dailyNavItems = [
  { title: "今日決策中心", icon: LayoutDashboard, url: "/" },
  { title: "商品作戰室", icon: Package, url: "/products" },
  { title: "任務中心", icon: ListTodo, url: "/tasks" },
  { title: "RICH BEAR 審判官", icon: Gavel, url: "/judgment" },
  { title: "素材中心", icon: Image, url: "/assets" },
  { title: "素材生命週期", icon: TrendingUp, url: "/creative-lifecycle" },
  { title: "成功率成績單", icon: BarChart3, url: "/scorecard" },
  { title: "投放中心", icon: Send, url: "/publish" },
  { title: "投放紀錄", icon: ListChecks, url: "/publish/history" },
];

const settingsNavItem = { title: "設定中心", icon: Settings, url: "/settings" };

const roleLabels: Record<string, string> = {
  admin: "最高管理員",
  manager: "行銷總監",
  user: "行銷專員",
};

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { employee } = useEmployee();
  const [location] = useLocation();

  const navItems = [ ...dailyNavItems, settingsNavItem ];

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
        <SidebarGroup>
          <SidebarGroupLabel>日常</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {dailyNavItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    data-active={location === item.url || undefined}
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
        <SidebarGroup>
          <SidebarGroupLabel>管理與設定</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild data-active={location === "/settings" || location.startsWith("/settings/") || undefined}>
                  <Link href="/settings">
                    <Settings className="w-4 h-4" />
                    <span>設定中心</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
              <p className="text-[10px] text-muted-foreground truncate" data-testid="text-user-role">
                {roleLabels[user?.role || "user"]} · 模擬：{employee.name}
              </p>
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
