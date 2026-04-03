/**
 * 商品中心（P1）：主列表單位＝商品，Filter Bar + Saved Views + 狀態/規則/owner（API 持久化）
 */
import { useProductsWorkbench } from "./products/useProductsWorkbench";
import { ProductsPageView } from "./products/ProductsPageView";

export default function ProductsPage() {
  const wb = useProductsWorkbench();
  return <ProductsPageView wb={wb} />;
}
