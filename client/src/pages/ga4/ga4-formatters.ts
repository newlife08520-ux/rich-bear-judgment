export function formatPercent(v: number): string {
  return `${v.toFixed(2)}%`;
}

export function formatNumber(v: number): string {
  return v.toLocaleString();
}
