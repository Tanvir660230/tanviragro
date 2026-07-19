"use client";

import dynamic from "next/dynamic";

export const RevenueVsCostChartWrapper = dynamic(
  () => import("./RevenueVsCostChart").then((m) => m.RevenueVsCostChart),
  { ssr: false }
);
