"use client";

import { useEffect, useRef } from "react";
import { runAutoFeedDeductions } from "@/app/dashboard/(app)/inventory/actions";

export function AutoEngineRunner() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    // Run silently in the background
    runAutoFeedDeductions().catch(console.error);
  }, []);

  return null;
}
