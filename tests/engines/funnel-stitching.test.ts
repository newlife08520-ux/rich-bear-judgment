import { describe, expect, it } from "vitest";
import { runFunnelDiagnostics, stitchFunnelData } from "@shared/funnel-stitching";

describe("stitchFunnelData", () => {
  const fb = [
    {
      productName: "A",
      spend: 100,
      revenue: 200,
      roas: 2,
      impressions: 1000,
      clicks: 50,
      conversions: 3,
    },
  ];

  it("marks full when GA4 has signal for same product", () => {
    const rows = stitchFunnelData(fb, [
      { productName: "A", sessions: 100, bounceRate: 0.4, addToCart: 5, purchases: 1 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.stitchConfidence).toBe("full");
    expect(rows[0]!.sessions).toBe(100);
  });

  it("marks fb_only when GA4 missing", () => {
    const rows = stitchFunnelData(fb, []);
    expect(rows[0]!.stitchConfidence).toBe("fb_only");
    expect(rows[0]!.stitchNote).toBeDefined();
  });

  it("appends ga4_only rows not present in FB", () => {
    const rows = stitchFunnelData(fb, [
      { productName: "A", sessions: 10, bounceRate: 0.1, addToCart: 1, purchases: 0 },
      { productName: "B", sessions: 20, bounceRate: 0.2, addToCart: 2, purchases: 1 },
    ]);
    const b = rows.find((r) => r.productName === "B");
    expect(b?.stitchConfidence).toBe("ga4_only");
    expect(b?.spend).toBe(0);
  });

  it("treats zero GA4 metrics as fb_only even if row exists with zeros", () => {
    const rows = stitchFunnelData(fb, [
      { productName: "A", sessions: 0, bounceRate: 0, addToCart: 0, purchases: 0 },
    ]);
    expect(rows[0]!.stitchConfidence).toBe("fb_only");
  });
});

describe("runFunnelDiagnostics", () => {
  it("emits landing_page_break when ctr and bounce are extreme", () => {
    const w = runFunnelDiagnostics(
      [
        {
          productName: "X",
          spend: 1,
          clicks: 1,
          ctr: 3,
          sessions: 100,
          bounceRate: 0.8,
          addToCart: 0,
          purchases: 0,
          addToCartRate: 0,
          purchaseRate: 0,
          stitchConfidence: "full",
        },
      ],
      { funnelEvidence: true }
    );
    expect(w.some((x) => x.type === "landing_page_break")).toBe(true);
  });

  it("emits checkout_resistance when many addToCart but few purchases", () => {
    const w = runFunnelDiagnostics(
      [
        {
          productName: "Y",
          spend: 1,
          clicks: 1,
          ctr: 1,
          sessions: 100,
          bounceRate: 0.3,
          addToCart: 20,
          purchases: 1,
          addToCartRate: 0.2,
          purchaseRate: 0.01,
          stitchConfidence: "full",
        },
      ],
      { funnelEvidence: true }
    );
    expect(w.some((x) => x.type === "checkout_resistance")).toBe(true);
  });
});
