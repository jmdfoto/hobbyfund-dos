# 08 — Progress Charts

Spec section 5.

## Savings progress visual
- Simple chart (bar or sparkline) of Save balance over time, computed as a running cumulative sum of
  Save-bucket transactions in date order.
- Empty-state message shown until the first save transaction exists.

## Invest progress visual (spec: "consider a second, similar visual")
- Similar chart for Invest balance over time, showing contribution vs. match as separate series/stacked
  segments.

## Acceptance Criteria
- With zero save transactions, the empty state renders instead of an empty/broken chart.
- Adding a save transaction immediately updates the chart with the new cumulative point.
- The invest chart visually separates contribution from match (e.g. two stacked colors), not just a
  single total line.
