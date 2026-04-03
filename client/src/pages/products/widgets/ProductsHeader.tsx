import { Package } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function ProductsHeader() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 p-4 border-b shrink-0">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <h1 className="page-title flex items-center gap-2">
          <Package className="w-5 h-5" />
          商品中心
        </h1>
      </div>
    </header>
  );
}
