export function ProductsUnmappedPanel(props: { productLevelUnmapped: Array<{ productName: string }> }) {
  const { productLevelUnmapped } = props;
  if (productLevelUnmapped.length === 0) return null;
  return (
    <div className="text-xs">
      <span className="font-medium">未映射活動：</span>
      {productLevelUnmapped
        .slice(0, 10)
        .map((p) => p.productName)
        .join("、")}
      {productLevelUnmapped.length > 10 && ` …共 ${productLevelUnmapped.length} 筆`}
    </div>
  );
}
